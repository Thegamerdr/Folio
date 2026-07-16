import { BillingProviderError, googlePlayProvider } from './google';
import { entitlementSigner } from './signing';
import type {
  EntitlementGrantClaims,
  EntitlementStore,
  GrantSigner,
  PurchaseProvider,
  RuntimeEnv,
} from './types';

const PRODUCT_TIERS = new Map<string, 'full' | 'live'>([
  ['folio.full', 'full'],
  ['folio.live.monthly', 'live'],
  ['folio.live.yearly', 'live'],
  ['folio.plus.monthly', 'full'],
  ['folio.plus.yearly', 'full'],
  ['folio.pro.monthly', 'full'],
  ['folio.pro.yearly', 'full'],
]);
const LIVE_OFFLINE_GRACE_MS = 72 * 60 * 60 * 1000;
const LIVE_REFRESH_MS = 24 * 60 * 60 * 1000;
const FULL_REFRESH_MS = 90 * 24 * 60 * 60 * 1000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const runtimeEnv = env as RuntimeEnv;
    const provider = googlePlayProvider(runtimeEnv);
    const signer = entitlementSigner(runtimeEnv);
    const store = env.ENTITLEMENTS === undefined ? null : kvStore(env.ENTITLEMENTS);
    try {
      return await handleRequest(request, store, provider, signer, runtimeEnv);
    } catch (reason: unknown) {
      const known = reason instanceof BillingProviderError ? reason : null;
      console.error(
        JSON.stringify({
          message: 'billing entitlement request failed',
          path: new URL(request.url).pathname,
          code: known?.code ?? 'internal_error',
        }),
      );
      return json(
        {
          error: userMessage(known?.code),
          code: known?.code ?? 'service_unavailable',
        },
        known?.status ?? 503,
        request,
        runtimeEnv,
      );
    }
  },
} satisfies ExportedHandler<Env>;

export async function handleRequest(
  request: Request,
  store: EntitlementStore | null,
  provider: PurchaseProvider,
  signer: GrantSigner,
  env: RuntimeEnv,
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return preflight(request, env);
  if (request.method === 'GET' && url.pathname === '/health') {
    return json(
      {
        ok: true,
        service: 'melo-billing-entitlements',
        packageName: env.PACKAGE_NAME,
        provider: 'google-play-developer-api',
        providerConfigured: provider.configured,
        signerConfigured: signer.configured,
        tokenStoreConfigured: store !== null,
        clientGrantsAccepted: false,
        purchaseTokensStored: false,
        products: [...PRODUCT_TIERS.keys()],
      },
      200,
      request,
      env,
    );
  }
  if (request.method === 'GET' && url.pathname === '/.well-known/jwks.json') {
    if (signer.publicJwk === null) {
      return json({ keys: [] }, 200, request, env);
    }
    return json(
      {
        keys: [
          {
            ...signer.publicJwk,
            use: 'sig',
            alg: 'EdDSA',
            kid: env.ENTITLEMENT_SIGNING_KEY_ID,
          },
        ],
      },
      200,
      request,
      env,
    );
  }
  if (request.method !== 'POST' || url.pathname !== '/v1/google/verify') {
    return json({ error: 'Route not found.', code: 'not_found' }, 404, request, env);
  }
  if (!provider.configured) {
    throw new BillingProviderError(
      'provider_not_configured',
      503,
      'Google Play verification is not configured.',
    );
  }
  if (!signer.configured) {
    throw new BillingProviderError(
      'signer_not_configured',
      503,
      'Entitlement signing is not configured.',
    );
  }
  const body = await safeJsonBody(request);
  const productId = typeof body['productId'] === 'string' ? body['productId'] : '';
  const purchaseToken = typeof body['purchaseToken'] === 'string' ? body['purchaseToken'] : '';
  const expectedTier = PRODUCT_TIERS.get(productId);
  if (expectedTier === undefined || purchaseToken.length < 8 || purchaseToken.length > 4096) {
    return json(
      { error: 'The purchase proof is invalid.', code: 'invalid_request' },
      400,
      request,
      env,
    );
  }
  const proof = await provider.verify(productId, purchaseToken);
  if (proof.productId !== productId || proof.tier !== expectedTier) {
    throw new BillingProviderError('proof_mismatch', 409, 'The verified purchase did not match.');
  }
  const now = Date.now();
  const tokenHash = await sha256Base64Url(purchaseToken);
  const expiresAtMs = proof.expiresAt === null ? null : Date.parse(proof.expiresAt);
  const graceUntil =
    expiresAtMs === null || !Number.isFinite(expiresAtMs)
      ? null
      : new Date(expiresAtMs + LIVE_OFFLINE_GRACE_MS).toISOString();
  const refreshAfter = new Date(
    now + (proof.tier === 'live' ? LIVE_REFRESH_MS : FULL_REFRESH_MS),
  ).toISOString();
  const claims: EntitlementGrantClaims = {
    v: 1,
    platform: 'google-play',
    tier: proof.tier,
    productId,
    tokenHash,
    providerState: proof.providerState,
    expiresAt: proof.expiresAt,
    refreshAfter,
    graceUntil,
    test: proof.test,
  };
  const grant = await signer.sign(claims);
  const acknowledgedByBackend = proof.acknowledged
    ? true
    : await provider.acknowledge(productId, purchaseToken).catch(() => false);
  if (store !== null) {
    const retentionSeconds =
      graceUntil === null
        ? 400 * 24 * 60 * 60
        : Math.max(24 * 60 * 60, Math.floor((Date.parse(graceUntil) - now) / 1000));
    await store.put(
      `purchase:${tokenHash}`,
      JSON.stringify({
        v: 1,
        productId,
        tier: proof.tier,
        providerState: proof.providerState,
        verifiedAt: new Date(now).toISOString(),
        expiresAt: proof.expiresAt,
      }),
      { expirationTtl: retentionSeconds },
    );
  }
  return json(
    {
      grant,
      entitlement: claims,
      acknowledgedByBackend,
    },
    200,
    request,
    env,
  );
}

function kvStore(namespace: KVNamespace): EntitlementStore {
  return {
    put: (key, value, options) => namespace.put(key, value, options),
  };
}

async function safeJsonBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > 8192) {
    throw new BillingProviderError('request_too_large', 413, 'Request too large.');
  }
  try {
    const body: unknown = await request.json();
    return body !== null && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function userMessage(code: string | undefined): string {
  if (code === 'purchase_pending') return 'Google Play is still processing this purchase.';
  if (
    code === 'purchase_not_found' ||
    code === 'purchase_not_owned' ||
    code === 'purchase_not_active' ||
    code === 'purchase_expired'
  ) {
    return 'Google Play could not confirm an active purchase.';
  }
  if (code === 'provider_not_configured' || code === 'signer_not_configured') {
    return 'Store verification is not configured for this Melo build yet.';
  }
  return 'Store verification is temporarily unavailable. No charge has been unlocked in Melo.';
}

function preflight(request: Request, env: RuntimeEnv): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

function json(body: unknown, status: number, request: Request, env: RuntimeEnv): Response {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders(request, env),
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

function corsHeaders(request: Request, env: RuntimeEnv): Record<string, string> {
  const origin = request.headers.get('origin');
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowOrigin = origin !== null && allowed.includes(origin) ? origin : 'null';
  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'Origin',
  };
}
