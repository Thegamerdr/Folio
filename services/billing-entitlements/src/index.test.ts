import { describe, expect, it, vi } from 'vitest';

import { handleRequest } from './index';
import type {
  EntitlementGrantClaims,
  EntitlementStore,
  EntitlementTier,
  GrantSigner,
  ProviderProof,
  PurchaseProvider,
  RuntimeEnv,
} from './types';

const env: RuntimeEnv = {
  PACKAGE_NAME: 'com.folio.v2.greenfield',
  GOOGLE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
  ENTITLEMENT_ISSUER: 'https://billing.example.test',
  ENTITLEMENT_AUDIENCE: 'com.folio.v2.greenfield',
  ENTITLEMENT_SIGNING_KEY_ID: 'test-key',
  ENTITLEMENT_SIGNING_PUBLIC_JWK: '{"kty":"OKP","crv":"Ed25519","x":"test"}',
};

function provider(
  overrides: Partial<Awaited<ReturnType<PurchaseProvider['verify']>>> = {},
): PurchaseProvider {
  return {
    configured: true,
    verify: vi.fn(
      async (productId: string): Promise<ProviderProof> => ({
        productId,
        tier: (productId === 'folio.full' ? 'full' : 'live') satisfies EntitlementTier,
        providerState: 'PURCHASED',
        expiresAt: productId === 'folio.full' ? null : '2026-08-14T12:00:00.000Z',
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

describe('billing entitlement worker', () => {
  it('reports configuration honestly without accepting client grants', async () => {
    const response = await handleRequest(
      new Request('https://billing.example.test/health'),
      null,
      { ...provider(), configured: false },
      { ...signer([]), configured: false, publicJwk: null },
      env,
    );
    expect(await response.json()).toMatchObject({
      providerConfigured: false,
      signerConfigured: false,
      tokenStoreConfigured: false,
      clientGrantsAccepted: false,
      purchaseTokensStored: false,
    });
  });

  it('exposes the non-secret sellable catalog for console reconciliation', async () => {
    const response = await handleRequest(
      new Request('https://billing.example.test/v1/catalog'),
      null,
      provider(),
      signer([]),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      currency: 'GBP',
      priceAuthority: 'Google Play Console',
      pricesArePrototype: true,
      products: [
        {
          productId: 'folio.full',
          billingType: 'one_time',
          cadence: 'one_time',
          sellable: true,
        },
        {
          productId: 'folio.live.monthly',
          billingType: 'subscription',
          cadence: 'monthly',
          sellable: true,
        },
        {
          productId: 'folio.live.yearly',
          billingType: 'subscription',
          cadence: 'annual',
          sellable: true,
        },
      ],
    });
  });

  it('issues a signed Full grant only after provider verification', async () => {
    const claims: EntitlementGrantClaims[] = [];
    const writes: string[] = [];
    const purchaseProvider = provider();
    const response = await handleRequest(
      new Request('https://billing.example.test/v1/google/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: 'folio.full', purchaseToken: 'play-token-123' }),
      }),
      store(writes),
      purchaseProvider,
      signer(claims),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      grant: 'signed.grant.value',
      entitlement: { tier: 'full', productId: 'folio.full', expiresAt: null },
      acknowledgedByBackend: true,
    });
    expect(claims).toHaveLength(1);
    expect(claims[0]?.tokenHash).not.toContain('play-token-123');
    expect(writes).toHaveLength(1);
    expect(writes[0]).not.toContain('play-token-123');
    expect(purchaseProvider.verify).toHaveBeenCalledBefore(
      purchaseProvider.acknowledge as ReturnType<typeof vi.fn>,
    );
  });

  it('adds a bounded offline grace to a verified Live subscription', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T12:00:00.000Z'));
    const claims: EntitlementGrantClaims[] = [];
    const response = await handleRequest(
      new Request('https://billing.example.test/v1/google/verify', {
        method: 'POST',
        body: JSON.stringify({
          productId: 'folio.live.monthly',
          purchaseToken: 'play-token-live',
        }),
      }),
      null,
      provider(),
      signer(claims),
      env,
    );
    expect(response.status).toBe(200);
    expect(claims[0]).toMatchObject({
      tier: 'live',
      expiresAt: '2026-08-14T12:00:00.000Z',
      graceUntil: '2026-08-17T12:00:00.000Z',
      refreshAfter: '2026-07-15T12:00:00.000Z',
    });
    vi.useRealTimers();
  });

  it('rejects unknown products before calling the provider', async () => {
    const purchaseProvider = provider();
    const response = await handleRequest(
      new Request('https://billing.example.test/v1/google/verify', {
        method: 'POST',
        body: JSON.stringify({ productId: 'folio.fake', purchaseToken: 'play-token-123' }),
      }),
      null,
      purchaseProvider,
      signer([]),
      env,
    );
    expect(response.status).toBe(400);
    expect(purchaseProvider.verify).not.toHaveBeenCalled();
  });

  it('fails closed while provider verification is unconfigured', async () => {
    const response = await handleRequest(
      new Request('https://billing.example.test/v1/google/verify', {
        method: 'POST',
        body: JSON.stringify({ productId: 'folio.full', purchaseToken: 'play-token-123' }),
      }),
      null,
      { ...provider(), configured: false },
      signer([]),
      env,
    ).catch((error: unknown) => error);
    expect(response).toMatchObject({ code: 'provider_not_configured', status: 503 });
  });

  it('routes Apple proof verification separately and signs an App Store grant', async () => {
    const claims: EntitlementGrantClaims[] = [];
    const response = await handleRequest(
      new Request('https://billing.example.test/v1/apple/verify', {
        method: 'POST',
        body: JSON.stringify({
          productId: 'folio.full',
          purchaseToken: 'signed-apple-jws-'.repeat(400),
        }),
      }),
      null,
      provider(),
      signer(claims),
      env,
      provider(),
    );
    expect(response.status).toBe(200);
    expect(claims[0]?.platform).toBe('app-store');
  });
});
