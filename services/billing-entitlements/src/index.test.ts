import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleRequest, parsePublicVerificationFlag } from './index';
import type {
  EntitlementGrantClaims,
  EntitlementStore,
  EntitlementTier,
  GrantSigner,
  ProviderProof,
  PurchaseProvider,
  RuntimeEnv,
} from './types';

type VerificationRateLimiter = Pick<RateLimit, 'limit'>;

const VALID_PRODUCT = 'melo_plus_monthly';
const VALID_TOKEN = 'synthetic-play-token-123';
const SYNTHETIC_SOURCE = 'synthetic-cloudflare-source';
const enabledEnv: RuntimeEnv = {
  PACKAGE_NAME: 'com.melomoney.app',
  GOOGLE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
  ENTITLEMENT_ISSUER: 'https://billing.example.test',
  ENTITLEMENT_AUDIENCE: 'com.melomoney.app',
  ENTITLEMENT_SIGNING_KEY_ID: 'test-key',
  ENTITLEMENT_SIGNING_PUBLIC_JWK: '{"kty":"OKP","crv":"Ed25519","x":"test"}',
  BILLING_PUBLIC_VERIFICATION_ENABLED: 'true',
};

function provider(
  overrides: Partial<Awaited<ReturnType<PurchaseProvider['verify']>>> = {},
): PurchaseProvider {
  return {
    configured: true,
    verify: vi.fn(
      async (productId: string): Promise<ProviderProof> => ({
        productId,
        tier: (productId.startsWith('melo_pro_') ? 'pro' : 'plus') satisfies EntitlementTier,
        providerState: 'SUBSCRIPTION_STATE_ACTIVE',
        expiresAt: '2026-08-14T12:00:00.000Z',
        acknowledged: false,
        test: false,
        ...overrides,
      }),
    ),
    acknowledge: vi.fn(async () => true),
  };
}

function signer(captured: EntitlementGrantClaims[]): GrantSigner {
  return {
    configured: true,
    publicJwk: { kty: 'OKP', crv: 'Ed25519', x: 'test' },
    sign: vi.fn(async (claims) => {
      captured.push(claims);
      return 'signed.grant.value';
    }),
  };
}

function store(writes: string[]): EntitlementStore {
  return {
    put: vi.fn(async (key, value) => {
      writes.push(`${key}:${value}`);
    }),
  };
}

function limiter(success = true, keys: string[] = []): VerificationRateLimiter {
  return {
    limit: vi.fn(async ({ key }: RateLimitOptions): Promise<RateLimitOutcome> => {
      keys.push(key);
      return { success };
    }),
  };
}

function throwingLimiter(): VerificationRateLimiter {
  return {
    limit: vi.fn(async () => {
      throw new Error('synthetic limiter failure');
    }),
  };
}

function malformedLimiter(): VerificationRateLimiter {
  return {
    limit: vi.fn(async () => Object.create(null) as RateLimitOutcome),
  };
}

function verifyRequest(
  body: string = JSON.stringify({ productId: VALID_PRODUCT, purchaseToken: VALID_TOKEN }),
  headers: Readonly<Record<string, string>> = {},
): Request {
  return new Request('https://billing.example.test/v1/google/verify', {
    method: 'POST',
    headers: {
      'cf-connecting-ip': SYNTHETIC_SOURCE,
      'content-type': 'application/json',
      ...headers,
    },
    body,
  });
}

function streamedRequest(
  chunks: readonly Uint8Array[],
  headers: Readonly<Record<string, string>> = {},
): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  const init: RequestInit & { duplex: 'half' } = {
    method: 'POST',
    headers: {
      'cf-connecting-ip': SYNTHETIC_SOURCE,
      'content-type': 'application/json',
      ...headers,
    },
    body: stream,
    duplex: 'half',
  };
  return new Request('https://billing.example.test/v1/google/verify', init);
}

function exactSizeBody(targetBytes: number): string {
  const input = { productId: VALID_PRODUCT, purchaseToken: VALID_TOKEN, padding: '' };
  const empty = JSON.stringify(input);
  const paddingBytes = targetBytes - new TextEncoder().encode(empty).byteLength;
  if (paddingBytes < 0) throw new Error('Target body size is too small.');
  return JSON.stringify({ ...input, padding: 'x'.repeat(paddingBytes) });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('billing entitlement worker', () => {
  it('parses the public verification switch strictly', () => {
    expect(parsePublicVerificationFlag('true')).toBe(true);
    expect(parsePublicVerificationFlag('  true\n')).toBe(true);
    for (const value of [undefined, null, false, true, '', 'false', 'TRUE', 'yes', '1']) {
      expect(parsePublicVerificationFlag(value)).toBe(false);
    }
  });

  it('reports boolean readiness without exposing bindings, secrets, or raw switch values', async () => {
    const response = await handleRequest(
      new Request('https://billing.example.test/health'),
      null,
      { ...provider(), configured: false },
      { ...signer([]), configured: false, publicJwk: null },
      {
        ...enabledEnv,
        BILLING_PUBLIC_VERIFICATION_ENABLED: 'false',
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: 'synthetic-private-secret',
      },
    );
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({
      providerConfigured: false,
      signerConfigured: false,
      tokenStoreConfigured: false,
      publicVerificationEnabled: false,
      clientGrantsAccepted: false,
      purchaseTokensStored: false,
      products: ['melo_plus_monthly', 'melo_plus_yearly', 'melo_pro_monthly', 'melo_pro_yearly'],
    });
    expect(text).not.toContain('VERIFY_SOURCE_RATE_LIMITER');
    expect(text).not.toContain('VERIFY_PURCHASE_RATE_LIMITER');
    expect(text).not.toContain('synthetic-private-secret');
  });

  it.each([undefined, 'false', '', 'FALSE', 'yes', '1'])(
    'keeps verification unavailable for switch value %s before any control or provider call',
    async (flag) => {
      const purchaseProvider = provider();
      const sourceLimiter = limiter();
      const purchaseLimiter = limiter();
      const response = await handleRequest(
        verifyRequest(),
        null,
        purchaseProvider,
        signer([]),
        { ...enabledEnv, BILLING_PUBLIC_VERIFICATION_ENABLED: flag },
        sourceLimiter,
        purchaseLimiter,
      );

      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: 'verification_unavailable' });
      expect(sourceLimiter.limit).not.toHaveBeenCalled();
      expect(purchaseLimiter.limit).not.toHaveBeenCalled();
      expect(purchaseProvider.verify).not.toHaveBeenCalled();
    },
  );

  it('fails closed when the trusted Cloudflare source identity is absent', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const purchaseProvider = provider();
    const response = await handleRequest(
      verifyRequest(undefined, { 'cf-connecting-ip': '' }),
      null,
      purchaseProvider,
      signer([]),
      enabledEnv,
      limiter(),
      limiter(),
    );

    expect(response.status).toBe(503);
    expect(purchaseProvider.verify).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(
      JSON.stringify({
        route: '/v1/google/verify',
        stage: 'source_identity',
        code: 'source_identity_missing',
      }),
    );
  });

  it.each([
    ['missing', null],
    ['throwing', throwingLimiter()],
    ['malformed', malformedLimiter()],
  ] as const)('fails closed when the source limiter is %s', async (_case, sourceLimiter) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const purchaseProvider = provider();
    const response = await handleRequest(
      verifyRequest(),
      null,
      purchaseProvider,
      signer([]),
      enabledEnv,
      sourceLimiter,
      limiter(),
    );

    expect(response.status).toBe(503);
    expect(purchaseProvider.verify).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null],
    ['throwing', throwingLimiter()],
    ['malformed', malformedLimiter()],
  ] as const)('fails closed when the purchase limiter is %s', async (_case, purchaseLimiter) => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const purchaseProvider = provider();
    const response = await handleRequest(
      verifyRequest(),
      null,
      purchaseProvider,
      signer([]),
      enabledEnv,
      limiter(),
      purchaseLimiter,
    );

    expect(response.status).toBe(503);
    expect(purchaseProvider.verify).not.toHaveBeenCalled();
    const logged = errorLog.mock.calls.flat().join(' ');
    expect(logged).not.toContain(VALID_TOKEN);
    expect(logged).not.toContain(SYNTHETIC_SOURCE);
  });

  it('rejects a declared body above 8192 bytes before provider work', async () => {
    const purchaseProvider = provider();
    const purchaseLimiter = limiter();
    const response = await handleRequest(
      verifyRequest(undefined, { 'content-length': '8193' }),
      null,
      purchaseProvider,
      signer([]),
      enabledEnv,
      limiter(),
      purchaseLimiter,
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: 'request_too_large' });
    expect(purchaseLimiter.limit).not.toHaveBeenCalled();
    expect(purchaseProvider.verify).not.toHaveBeenCalled();
  });

  it.each([
    ['missing length', {}],
    ['dishonest small length', { 'content-length': '10' }],
  ] as const)('rejects an over-limit streamed body with %s', async (_case, headers) => {
    const purchaseProvider = provider();
    const response = await handleRequest(
      streamedRequest([new Uint8Array(5000), new Uint8Array(4000)], headers),
      null,
      purchaseProvider,
      signer([]),
      enabledEnv,
      limiter(),
      limiter(),
    );

    expect(response.status).toBe(413);
    expect(purchaseProvider.verify).not.toHaveBeenCalled();
  });

  it('accepts exactly 8192 actual bytes without truncation', async () => {
    const body = exactSizeBody(8192);
    expect(new TextEncoder().encode(body)).toHaveLength(8192);
    const purchaseProvider = provider();
    const response = await handleRequest(
      verifyRequest(body, { 'content-length': '8192' }),
      null,
      purchaseProvider,
      signer([]),
      enabledEnv,
      limiter(),
      limiter(),
    );

    expect(response.status).toBe(200);
    expect(purchaseProvider.verify).toHaveBeenCalledOnce();
  });

  it('rejects invalid UTF-8 before provider work', async () => {
    const purchaseProvider = provider();
    const response = await handleRequest(
      streamedRequest([Uint8Array.of(0xc3, 0x28)]),
      null,
      purchaseProvider,
      signer([]),
      enabledEnv,
      limiter(),
      limiter(),
    );

    expect(response.status).toBe(400);
    expect(purchaseProvider.verify).not.toHaveBeenCalled();
  });

  it.each(['{', '1', 'null', '[]', '"scalar"'])(
    'rejects malformed or non-object JSON %s before provider work',
    async (body) => {
      const purchaseProvider = provider();
      const response = await handleRequest(
        verifyRequest(body),
        null,
        purchaseProvider,
        signer([]),
        enabledEnv,
        limiter(),
        limiter(),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'invalid_request' });
      expect(purchaseProvider.verify).not.toHaveBeenCalled();
    },
  );

  it('rejects a non-JSON content type before provider work', async () => {
    const purchaseProvider = provider();
    const response = await handleRequest(
      verifyRequest(undefined, { 'content-type': 'text/plain' }),
      null,
      purchaseProvider,
      signer([]),
      enabledEnv,
      limiter(),
      limiter(),
    );

    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({ code: 'invalid_request' });
    expect(purchaseProvider.verify).not.toHaveBeenCalled();
  });

  it('denies at the source limit before body and provider work', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const purchaseProvider = provider();
    const purchaseLimiter = limiter();
    const response = await handleRequest(
      verifyRequest(),
      null,
      purchaseProvider,
      signer([]),
      enabledEnv,
      limiter(false),
      purchaseLimiter,
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(await response.json()).toMatchObject({ code: 'verification_rate_limited' });
    expect(purchaseLimiter.limit).not.toHaveBeenCalled();
    expect(purchaseProvider.verify).not.toHaveBeenCalled();
  });

  it('denies a repeated purchase after validation and before provider work', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const purchaseProvider = provider();
    const response = await handleRequest(
      verifyRequest(),
      null,
      purchaseProvider,
      signer([]),
      enabledEnv,
      limiter(),
      limiter(false),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(purchaseProvider.verify).not.toHaveBeenCalled();
  });

  it('uses fixed-length opaque hashes for both limiter dimensions', async () => {
    const sourceKeys: string[] = [];
    const purchaseKeys: string[] = [];
    const response = await handleRequest(
      verifyRequest(),
      null,
      provider(),
      signer([]),
      enabledEnv,
      limiter(true, sourceKeys),
      limiter(true, purchaseKeys),
    );

    expect(response.status).toBe(200);
    expect(sourceKeys).toHaveLength(1);
    expect(purchaseKeys).toHaveLength(1);
    for (const key of [...sourceKeys, ...purchaseKeys]) {
      expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/u);
      expect(key).not.toContain(SYNTHETIC_SOURCE);
      expect(key).not.toContain(VALID_TOKEN);
      expect(key).not.toContain(`${VALID_PRODUCT}${VALID_TOKEN}`);
    }
    expect(sourceKeys[0]).not.toBe(purchaseKeys[0]);
  });

  it('issues and stores a signed grant only after both abuse controls and provider verification', async () => {
    const claims: EntitlementGrantClaims[] = [];
    const writes: string[] = [];
    const purchaseProvider = provider();
    const sourceLimiter = limiter();
    const purchaseLimiter = limiter();
    const response = await handleRequest(
      verifyRequest(),
      store(writes),
      purchaseProvider,
      signer(claims),
      enabledEnv,
      sourceLimiter,
      purchaseLimiter,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      grant: 'signed.grant.value',
      entitlement: { tier: 'plus', productId: VALID_PRODUCT },
      acknowledgedByBackend: true,
    });
    expect(claims[0]?.tokenHash).not.toContain(VALID_TOKEN);
    expect(writes[0]).not.toContain(VALID_TOKEN);
    expect(sourceLimiter.limit).toHaveBeenCalledBefore(
      purchaseLimiter.limit as ReturnType<typeof vi.fn>,
    );
    expect(purchaseLimiter.limit).toHaveBeenCalledBefore(
      purchaseProvider.verify as ReturnType<typeof vi.fn>,
    );
    expect(purchaseProvider.verify).toHaveBeenCalledBefore(
      purchaseProvider.acknowledge as ReturnType<typeof vi.fn>,
    );
  });

  it('adds a bounded offline grace to a verified Pro subscription', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T12:00:00.000Z'));
    const claims: EntitlementGrantClaims[] = [];
    const response = await handleRequest(
      verifyRequest(
        JSON.stringify({ productId: 'melo_pro_yearly', purchaseToken: 'synthetic-play-token-pro' }),
      ),
      null,
      provider(),
      signer(claims),
      enabledEnv,
      limiter(),
      limiter(),
    );

    expect(response.status).toBe(200);
    expect(claims[0]).toMatchObject({
      tier: 'pro',
      expiresAt: '2026-08-14T12:00:00.000Z',
      graceUntil: '2026-08-17T12:00:00.000Z',
      refreshAfter: '2026-07-15T12:00:00.000Z',
    });
  });

  it('rejects unknown products before the purchase limiter and provider', async () => {
    const purchaseProvider = provider();
    const purchaseLimiter = limiter();
    const response = await handleRequest(
      verifyRequest(
        JSON.stringify({ productId: 'melo_fake', purchaseToken: 'synthetic-play-token-123' }),
      ),
      null,
      purchaseProvider,
      signer([]),
      enabledEnv,
      limiter(),
      purchaseLimiter,
    );

    expect(response.status).toBe(400);
    expect(purchaseLimiter.limit).not.toHaveBeenCalled();
    expect(purchaseProvider.verify).not.toHaveBeenCalled();
  });

  it('checks both controls before reporting provider readiness', async () => {
    const sourceLimiter = limiter();
    const purchaseLimiter = limiter();
    const response = await handleRequest(
      verifyRequest(),
      null,
      { ...provider(), configured: false },
      signer([]),
      enabledEnv,
      sourceLimiter,
      purchaseLimiter,
    ).catch((error: unknown) => error);

    expect(sourceLimiter.limit).toHaveBeenCalledOnce();
    expect(purchaseLimiter.limit).toHaveBeenCalledOnce();
    expect(response).toMatchObject({ code: 'provider_not_configured', status: 503 });
  });
});
