import { importPKCS8, SignJWT } from 'jose';

import type { EntitlementTier, ProviderProof, PurchaseProvider, RuntimeEnv } from './types';
import { BILLING_PRODUCT_TIERS } from './catalog';

const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const PLAY_API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const GOOGLE_REQUEST_TIMEOUT_MS = 15_000;
const GOOGLE_RESPONSE_MAX_BYTES = 1_048_576;
const FULL_PRODUCT = 'folio.full';
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
    nonBlank(env.PACKAGE_NAME) &&
    env.GOOGLE_TOKEN_URI === GOOGLE_TOKEN_URI;

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
      return productId === FULL_PRODUCT
        ? verifyOneTime(env, accessToken, productId, purchaseToken)
        : verifySubscription(env, accessToken, productId, purchaseToken);
    },
    async acknowledge(productId, purchaseToken) {
      if (!configured) return false;
      const accessToken = await accessTokenFor(env);
      const packageName = encodeURIComponent(env.PACKAGE_NAME);
      const product = encodeURIComponent(productId);
      const token = encodeURIComponent(purchaseToken);
      const family = productId === FULL_PRODUCT ? 'products' : 'subscriptions';
      const response = await fetchWithTimeout(
        `${PLAY_API}/applications/${packageName}/purchases/${family}/${product}/tokens/${token}:acknowledge`,
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

async function verifyOneTime(
  env: RuntimeEnv,
  accessToken: string,
  productId: string,
  purchaseToken: string,
): Promise<ProviderProof> {
  const response = await playGet(
    `${PLAY_API}/applications/${encodeURIComponent(env.PACKAGE_NAME)}/purchases/productsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    accessToken,
  );
  const state = stringAt(response, 'purchaseStateContext', 'purchaseState');
  const lineItems = arrayAt(response, 'productLineItem');
  const productMatches = lineItems.some((item) => stringAt(item, 'productId') === productId);
  if (!productMatches)
    invalidProof('product_mismatch', 'The Play purchase is for another product.');
  if (state !== 'PURCHASED') {
    const code = state === 'PENDING' ? 'purchase_pending' : 'purchase_not_owned';
    invalidProof(code, 'The Play purchase is not in the purchased state.');
  }
  return {
    productId,
    tier: 'full',
    providerState: state,
    expiresAt: null,
    acknowledged: isAcknowledged(stringAt(response, 'acknowledgementState')),
    test: Boolean(response['testPurchaseContext']),
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
  const tier = BILLING_PRODUCT_TIERS.get(productId) as EntitlementTier | undefined;
  if (tier === undefined || (tier === 'live' && !productId.startsWith('folio.live.'))) {
    invalidProof('product_not_allowed', 'The Play product is not allowed for Melo Live.');
  }
  return {
    productId,
    tier,
    providerState: state,
    expiresAt: tier === 'live' ? new Date(expiryMs).toISOString() : null,
    acknowledged: isAcknowledged(stringAt(response, 'acknowledgementState')),
    test: Boolean(response['testPurchase']),
  };
}

async function playGet(url: string, accessToken: string): Promise<Record<string, unknown>> {
  const response = await fetchWithTimeout(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
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
  const body: unknown = await boundedJson(response);
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
  const response = await fetchWithTimeout(env.GOOGLE_TOKEN_URI, {
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
  const body: unknown = await boundedJson(response);
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new BillingProviderError(
      'provider_auth_failed',
      502,
      'Google returned invalid authentication data.',
    );
  }
  const tokenBody = body as Record<string, unknown>;
  const token = typeof tokenBody['access_token'] === 'string' ? tokenBody['access_token'] : '';
  const expiresIn = typeof tokenBody['expires_in'] === 'number' ? tokenBody['expires_in'] : 3600;
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

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOOGLE_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new BillingProviderError(
        'provider_timeout',
        504,
        'Google Play did not respond before the verification deadline.',
      );
    }
    throw new BillingProviderError(
      'provider_unavailable',
      502,
      'Google Play verification is temporarily unavailable.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function boundedJson(response: Response): Promise<unknown> {
  const length = response.headers.get('content-length');
  if (length !== null && /^\d+$/.test(length) && Number(length) > GOOGLE_RESPONSE_MAX_BYTES) {
    throw new BillingProviderError(
      'provider_response_too_large',
      502,
      'Google returned too much data.',
    );
  }
  const body = await response.arrayBuffer();
  if (body.byteLength > GOOGLE_RESPONSE_MAX_BYTES) {
    throw new BillingProviderError(
      'provider_response_too_large',
      502,
      'Google returned too much data.',
    );
  }
  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    throw new BillingProviderError(
      'provider_invalid_response',
      502,
      'Google returned invalid data.',
    );
  }
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
