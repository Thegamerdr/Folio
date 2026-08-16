import { importPKCS8, SignJWT } from 'jose';

import type { EntitlementTier, ProviderProof, PurchaseProvider, RuntimeEnv } from './types';

const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const PLAY_API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const PRODUCT_TIERS = new Map<string, EntitlementTier>([
  ['melo_plus_monthly', 'plus'],
  ['melo_plus_yearly', 'plus'],
  ['melo_pro_monthly', 'pro'],
  ['melo_pro_yearly', 'pro'],
]);
const VALID_SUBSCRIPTION_STATES = new Set([
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  'SUBSCRIPTION_STATE_CANCELED',
]);

type OAuthCache = { token: string; expiresAt: number } | null;
let oauthCache: OAuthCache = null;

export class BillingProviderError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'BillingProviderError';
  }
}

export function googlePlayProvider(env: RuntimeEnv): PurchaseProvider {
  const configured =
    nonBlank(env.GOOGLE_SERVICE_ACCOUNT_EMAIL) &&
    nonBlank(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) &&
    nonBlank(env.PACKAGE_NAME);

  return {
    configured,
    async verify(productId, purchaseToken) {
      if (!configured) {
        throw new BillingProviderError(
          'provider_not_configured',
          503,
          'Google Play verification is not configured.',
        );
      }
      const accessToken = await accessTokenFor(env);
      return verifySubscription(env, accessToken, productId, purchaseToken);
    },
    async acknowledge(productId, purchaseToken) {
      if (!configured) return false;
      const accessToken = await accessTokenFor(env);
      const packageName = encodeURIComponent(env.PACKAGE_NAME);
      const product = encodeURIComponent(productId);
      const token = encodeURIComponent(purchaseToken);
      const response = await fetch(
        `${PLAY_API}/applications/${packageName}/purchases/subscriptions/${product}/tokens/${token}:acknowledge`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: '{}',
        },
      );
      return response.ok;
    },
  };
}

async function verifySubscription(
  env: RuntimeEnv,
  accessToken: string,
  productId: string,
  purchaseToken: string,
): Promise<ProviderProof> {
  const response = await playGet(
    `${PLAY_API}/applications/${encodeURIComponent(env.PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    accessToken,
  );
  const state = stringAt(response, 'subscriptionState');
  if (!VALID_SUBSCRIPTION_STATES.has(state)) {
    const code =
      state === 'SUBSCRIPTION_STATE_PENDING' ? 'purchase_pending' : 'purchase_not_active';
    invalidProof(code, 'The Play subscription is not currently entitled.');
  }
  const matchingLine = arrayAt(response, 'lineItems').find(
    (item) => stringAt(item, 'productId') === productId,
  );
  if (matchingLine === undefined) {
    invalidProof('product_mismatch', 'The Play subscription is for another product.');
  }
  const expiry = stringAt(matchingLine, 'expiryTime');
  const expiryMs = Date.parse(expiry);
  if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) {
    invalidProof('purchase_expired', 'The Play subscription has expired.');
  }
  const tier = PRODUCT_TIERS.get(productId);
  if (tier === undefined) invalidProof('product_not_allowed', 'The Play product is not allowed.');
  return {
    productId,
    tier,
    providerState: state,
    expiresAt: new Date(expiryMs).toISOString(),
    acknowledged: isAcknowledged(stringAt(response, 'acknowledgementState')),
    test: Boolean(response['testPurchase']),
  };
}

async function playGet(url: string, accessToken: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (response.status === 404) {
    invalidProof('purchase_not_found', 'Google Play did not find this purchase.');
  }
  if (!response.ok) {
    throw new BillingProviderError(
      'provider_unavailable',
      502,
      `Google Play verification returned ${response.status}.`,
    );
  }
  const body: unknown = await response.json();
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new BillingProviderError(
      'provider_invalid_response',
      502,
      'Google Play returned invalid data.',
    );
  }
  return body as Record<string, unknown>;
}

async function accessTokenFor(env: RuntimeEnv): Promise<string> {
  if (oauthCache !== null && oauthCache.expiresAt > Date.now() + 60_000) return oauthCache.token;
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!nonBlank(email) || !nonBlank(privateKey)) {
    throw new BillingProviderError(
      'provider_not_configured',
      503,
      'Google Play is not configured.',
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(privateKey.replace(/\\n/g, '\n'), 'RS256');
  const assertion = await new SignJWT({ scope: ANDROID_PUBLISHER_SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(email)
    .setAudience(env.GOOGLE_TOKEN_URI)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const response = await fetch(env.GOOGLE_TOKEN_URI, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) {
    throw new BillingProviderError(
      'provider_auth_failed',
      502,
      'Google Play authentication failed.',
    );
  }
  const body = (await response.json()) as Record<string, unknown>;
  const token = typeof body['access_token'] === 'string' ? body['access_token'] : '';
  const expiresIn = typeof body['expires_in'] === 'number' ? body['expires_in'] : 3600;
  if (token.length === 0) {
    throw new BillingProviderError(
      'provider_auth_failed',
      502,
      'Google Play returned no access token.',
    );
  }
  oauthCache = { token, expiresAt: Date.now() + Math.max(60, expiresIn) * 1000 };
  return token;
}

function invalidProof(code: string, message: string): never {
  throw new BillingProviderError(code, 409, message);
}

function nonBlank(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringAt(value: unknown, ...path: string[]): string {
  let current: unknown = value;
  for (const key of path) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) return '';
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : '';
}

function arrayAt(value: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const candidate = value[key];
  return Array.isArray(candidate)
    ? candidate.filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === 'object' && !Array.isArray(item),
      )
    : [];
}

function isAcknowledged(value: string): boolean {
  return value === 'ACKNOWLEDGED' || value === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';
}
