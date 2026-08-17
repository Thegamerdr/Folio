import { BillingProviderError, googlePlayProvider } from './google';
import { entitlementSigner } from './signing';
import type {
  EntitlementGrantClaims,
  EntitlementStore,
  GrantSigner,
  PurchaseProvider,
  RuntimeEnv,
} from './types';

const PRODUCT_TIERS = new Map<string, 'plus' | 'pro'>([
  ['melo_plus_monthly', 'plus'],
  ['melo_plus_yearly', 'plus'],
  ['melo_pro_monthly', 'pro'],
  ['melo_pro_yearly', 'pro'],
]);
const OFFLINE_GRACE_MS = 72 * 60 * 60 * 1000;
const REFRESH_MS = 24 * 60 * 60 * 1000;
const MAX_VERIFICATION_BODY_BYTES = 8192;
const RATE_LIMIT_RETRY_AFTER_SECONDS = 60;
const VERIFY_ROUTE = '/v1/google/verify';
const SOURCE_RATE_KEY_VERSION = 'melo-play-verify-source-v1';
const PURCHASE_RATE_KEY_VERSION = 'melo-play-verify-purchase-v1';

type VerificationRateLimiter = Pick<RateLimit, 'limit'>;
type BodyReadResult =
  | Readonly<{ ok: true; value: Record<string, unknown> }>
  | Readonly<{ ok: false; status: 400 | 413 | 415; code: 'invalid_request' | 'request_too_large' }>;
type RateDecision = 'allowed' | 'denied' | 'unavailable';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const runtimeEnv = env as RuntimeEnv;
    const provider = googlePlayProvider(runtimeEnv);
    const signer = entitlementSigner(runtimeEnv);
    const store = env.ENTITLEMENTS === undefined ? null : kvStore(env.ENTITLEMENTS);
    try {
      return await handleRequest(
        request,
        store,
        provider,
        signer,
        runtimeEnv,
        env.VERIFY_SOURCE_RATE_LIMITER,
        env.VERIFY_PURCHASE_RATE_LIMITER,
      );
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
  sourceRateLimiter: VerificationRateLimiter | null = null,
  purchaseRateLimiter: VerificationRateLimiter | null = null,
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
        publicVerificationEnabled: parsePublicVerificationFlag(
          env.BILLING_PUBLIC_VERIFICATION_ENABLED,
        ),
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
  if (request.method !== 'POST' || url.pathname !== VERIFY_ROUTE) {
    return json({ error: 'Route not found.', code: 'not_found' }, 404, request, env);
  }
  if (!parsePublicVerificationFlag(env.BILLING_PUBLIC_VERIFICATION_ENABLED)) {
    return verificationUnavailable(request, env);
  }

  const sourceIdentity = request.headers.get('cf-connecting-ip');
  if (sourceIdentity === null || sourceIdentity.trim().length === 0) {
    logVerificationDecision('source_identity', 'source_identity_missing', 'error');
    return verificationUnavailable(request, env);
  }
  const sourceKey = await rateLimitKey(SOURCE_RATE_KEY_VERSION, sourceIdentity.trim());
  const sourceDecision = await rateDecision(sourceRateLimiter, sourceKey);
  if (sourceDecision === 'denied') {
    logVerificationDecision('source_rate_limit', 'rate_limited', 'warn');
    return verificationRateLimited(request, env);
  }
  if (sourceDecision === 'unavailable') {
    logVerificationDecision('source_rate_limit', 'source_limiter_unavailable', 'error');
    return verificationUnavailable(request, env);
  }

  const bodyResult = await safeJsonBody(request);
  if (!bodyResult.ok) {
    return json(
      { error: 'The purchase proof is invalid.', code: bodyResult.code },
      bodyResult.status,
      request,
      env,
    );
  }
  const body = bodyResult.value;
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

  const purchaseKey = await rateLimitKey(PURCHASE_RATE_KEY_VERSION, productId, purchaseToken);
  const purchaseDecision = await rateDecision(purchaseRateLimiter, purchaseKey);
  if (purchaseDecision === 'denied') {
    logVerificationDecision('purchase_rate_limit', 'rate_limited', 'warn');
    return verificationRateLimited(request, env);
  }
  if (purchaseDecision === 'unavailable') {
    logVerificationDecision('purchase_rate_limit', 'purchase_limiter_unavailable', 'error');
    return verificationUnavailable(request, env);
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
      : new Date(expiresAtMs + OFFLINE_GRACE_MS).toISOString();
  const refreshAfter = new Date(now + REFRESH_MS).toISOString();
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

export function parsePublicVerificationFlag(value: unknown): boolean {
  return typeof value === 'string' && value.trim() === 'true';
}

async function safeJsonBody(request: Request): Promise<BodyReadResult> {
  const contentType = request.headers.get('content-type');
  if (!isJsonContentType(contentType)) {
    return { ok: false, status: 415, code: 'invalid_request' };
  }

  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null) {
    const normalizedLength = declaredLength.trim();
    if (!/^\d+$/u.test(normalizedLength)) {
      return { ok: false, status: 400, code: 'invalid_request' };
    }
    const declaredBytes = Number(normalizedLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > MAX_VERIFICATION_BODY_BYTES) {
      return { ok: false, status: 413, code: 'request_too_large' };
    }
  }

  const bytes = await readBoundedBody(request);
  if (bytes === null) return { ok: false, status: 413, code: 'request_too_large' };

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, status: 400, code: 'invalid_request' };
  }

  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, status: 400, code: 'invalid_request' };
  }
  return isPlainObject(body)
    ? { ok: true, value: body }
    : { ok: false, status: 400, code: 'invalid_request' };
}

async function readBoundedBody(request: Request): Promise<Uint8Array | null> {
  if (request.body === null) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      totalBytes += next.value.byteLength;
      if (totalBytes > MAX_VERIFICATION_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(next.value);
    }
  } catch {
    return new Uint8Array();
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}

function isJsonContentType(value: string | null): boolean {
  if (value === null) return false;
  const mediaType = value.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return (
    mediaType === 'application/json' ||
    (mediaType.startsWith('application/') && mediaType.endsWith('+json'))
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

async function rateDecision(
  limiter: VerificationRateLimiter | null,
  key: string,
): Promise<RateDecision> {
  if (limiter === null) return 'unavailable';
  try {
    const outcome: unknown = await limiter.limit({ key });
    if (outcome === null || typeof outcome !== 'object' || Array.isArray(outcome)) {
      return 'unavailable';
    }
    if (!('success' in outcome)) return 'unavailable';
    const success: unknown = outcome.success;
    return typeof success === 'boolean' ? (success ? 'allowed' : 'denied') : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

async function rateLimitKey(label: string, ...parts: string[]): Promise<string> {
  return sha256Base64Url(JSON.stringify([label, ...parts]));
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

function verificationUnavailable(request: Request, env: RuntimeEnv): Response {
  return json(
    {
      error: 'Store verification is temporarily unavailable. Try Restore purchases shortly.',
      code: 'verification_unavailable',
    },
    503,
    request,
    env,
  );
}

function verificationRateLimited(request: Request, env: RuntimeEnv): Response {
  return json(
    {
      error: 'Store verification is temporarily busy. Try Restore purchases shortly.',
      code: 'verification_rate_limited',
    },
    429,
    request,
    env,
    { 'retry-after': String(RATE_LIMIT_RETRY_AFTER_SECONDS) },
  );
}

function logVerificationDecision(
  stage: 'source_identity' | 'source_rate_limit' | 'purchase_rate_limit',
  code: string,
  severity: 'warn' | 'error',
): void {
  const entry = JSON.stringify({ route: VERIFY_ROUTE, stage, code });
  if (severity === 'warn') console.warn(entry);
  else console.error(entry);
}

function preflight(request: Request, env: RuntimeEnv): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

function json(
  body: unknown,
  status: number,
  request: Request,
  env: RuntimeEnv,
  extraHeaders: Readonly<Record<string, string>> = {},
): Response {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders(request, env),
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders,
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
