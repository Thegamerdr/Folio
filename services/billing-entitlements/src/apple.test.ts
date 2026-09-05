import { describe, expect, it } from 'vitest';

import { appleProvider, type AppleSdk } from './apple';
import type { RuntimeEnv } from './types';

const baseEnv: RuntimeEnv = {
  PACKAGE_NAME: 'com.folio.v2.greenfield',
  GOOGLE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
  APPLE_ISSUER_ID: 'issuer',
  APPLE_KEY_ID: 'key',
  APPLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nnot-a-key\n-----END PRIVATE KEY-----',
  APPLE_BUNDLE_ID: 'com.folio.v2.greenfield',
  APPLE_APP_ID: '123456',
  APPLE_ENVIRONMENT: 'Production',
  ENTITLEMENT_ISSUER: 'https://billing.example.test',
  ENTITLEMENT_AUDIENCE: 'com.folio.v2.greenfield',
  ENTITLEMENT_SIGNING_KEY_ID: 'test-key',
};

function fakeSdk(input: {
  supplied: Record<string, unknown>;
  fresh: Record<string, unknown>;
  latest: Record<string, unknown>;
  renewal: Record<string, unknown>;
  status: number;
}): AppleSdk {
  class FakeVerifier {
    constructor(
      _roots: Buffer[],
      onlineChecks: boolean,
      environment: string,
      bundleId: string,
      appAppleId?: number,
    ) {
      expect(onlineChecks).toBe(true);
      expect(environment).toBe('Sandbox');
      expect(bundleId).toBe('com.folio.v2.greenfield');
      expect(appAppleId).toBeUndefined();
    }

    async verifyAndDecodeTransaction(value: string): Promise<Record<string, unknown>> {
      return value === 'supplied' ? input.supplied : value === 'fresh' ? input.fresh : input.latest;
    }

    async verifyAndDecodeRenewalInfo(): Promise<Record<string, unknown>> {
      return input.renewal;
    }
  }

  class FakeClient {
    constructor(..._args: unknown[]) {}

    async getTransactionInfo(): Promise<{ signedTransactionInfo: string }> {
      return { signedTransactionInfo: 'fresh' };
    }

    async getAllSubscriptionStatuses(): Promise<{
      data: Array<{
        lastTransactions: Array<{
          signedTransactionInfo: string;
          signedRenewalInfo: string;
          status: number;
        }>;
      }>;
    }> {
      return {
        data: [
          {
            lastTransactions: [
              {
                signedTransactionInfo: 'latest',
                signedRenewalInfo: 'renewal',
                status: input.status,
              },
            ],
          },
        ],
      };
    }
  }

  return {
    SignedDataVerifier: FakeVerifier,
    AppStoreServerAPIClient: FakeClient,
    Environment: { PRODUCTION: 'Production', SANDBOX: 'Sandbox' },
    Status: { ACTIVE: 1, BILLING_GRACE_PERIOD: 4 },
  } as unknown as AppleSdk;
}

describe('Apple Store provider boundary', () => {
  it('requires exact production app identity and server credentials', () => {
    expect(appleProvider(baseEnv).configured).toBe(true);
    expect(appleProvider({ ...baseEnv, APPLE_BUNDLE_ID: 'com.other.app' }).configured).toBe(false);
    expect(appleProvider({ ...baseEnv, APPLE_APP_ID: 'not-a-number' }).configured).toBe(false);
    expect(
      appleProvider({ ...baseEnv, APPLE_ENVIRONMENT: 'Sandbox', APPLE_APP_ID: undefined })
        .configured,
    ).toBe(true);
    expect(appleProvider({ ...baseEnv, APPLE_ENVIRONMENT: undefined }).configured).toBe(false);
  });

  it('fails closed when Apple credentials are absent', async () => {
    const provider = appleProvider({ ...baseEnv, APPLE_PRIVATE_KEY: undefined });
    expect(provider.configured).toBe(false);
    await expect(provider.verify('folio.full', 'unsigned-token')).rejects.toMatchObject({
      code: 'provider_not_configured',
    });
  });

  it('does not accept an unsigned StoreKit token even with configured credentials', async () => {
    await expect(
      appleProvider(baseEnv).verify('folio.full', 'unsigned-token'),
    ).rejects.toBeDefined();
  });

  it('verifies a fresh Sandbox subscription chain with matching renewal metadata', async () => {
    const expires = Date.now() + 60_000;
    const provider = appleProvider(
      { ...baseEnv, APPLE_ENVIRONMENT: 'Sandbox', APPLE_APP_ID: undefined },
      async () =>
        fakeSdk({
          supplied: {
            bundleId: 'com.folio.v2.greenfield',
            environment: 'Sandbox',
            productId: 'folio.live.monthly',
            transactionId: 'tx-1',
            originalTransactionId: 'orig-1',
          },
          fresh: {
            bundleId: 'com.folio.v2.greenfield',
            environment: 'Sandbox',
            productId: 'folio.live.monthly',
            transactionId: 'tx-1',
            originalTransactionId: 'orig-1',
          },
          latest: {
            bundleId: 'com.folio.v2.greenfield',
            environment: 'Sandbox',
            productId: 'folio.live.monthly',
            transactionId: 'tx-2',
            originalTransactionId: 'orig-1',
            expiresDate: expires,
          },
          renewal: {
            productId: 'folio.live.monthly',
            originalTransactionId: 'orig-1',
            environment: 'Sandbox',
          },
          status: 1,
        }),
    );
    await expect(provider.verify('folio.live.monthly', 'supplied')).resolves.toMatchObject({
      providerState: 'ACTIVE',
      expiresAt: new Date(expires).toISOString(),
    });
  });

  it('uses future grace expiry for an already-expired subscription and rejects a revoked chain', async () => {
    const grace = Date.now() + 60_000;
    const provider = appleProvider(
      { ...baseEnv, APPLE_ENVIRONMENT: 'Sandbox', APPLE_APP_ID: undefined },
      async () =>
        fakeSdk({
          supplied: {
            bundleId: 'com.folio.v2.greenfield',
            environment: 'Sandbox',
            productId: 'folio.live.monthly',
            transactionId: 'tx-1',
            originalTransactionId: 'orig-1',
          },
          fresh: {
            bundleId: 'com.folio.v2.greenfield',
            environment: 'Sandbox',
            productId: 'folio.live.monthly',
            transactionId: 'tx-1',
            originalTransactionId: 'orig-1',
          },
          latest: {
            bundleId: 'com.folio.v2.greenfield',
            environment: 'Sandbox',
            productId: 'folio.live.monthly',
            transactionId: 'tx-2',
            originalTransactionId: 'orig-1',
            expiresDate: Date.now() - 60_000,
          },
          renewal: {
            productId: 'folio.live.monthly',
            originalTransactionId: 'orig-1',
            environment: 'Sandbox',
            gracePeriodExpiresDate: grace,
          },
          status: 4,
        }),
    );
    await expect(provider.verify('folio.live.monthly', 'supplied')).resolves.toMatchObject({
      providerState: 'BILLING_GRACE_PERIOD',
      expiresAt: new Date(grace).toISOString(),
    });

    const revoked = appleProvider(
      { ...baseEnv, APPLE_ENVIRONMENT: 'Sandbox', APPLE_APP_ID: undefined },
      async () =>
        fakeSdk({
          supplied: {
            bundleId: 'com.folio.v2.greenfield',
            environment: 'Sandbox',
            productId: 'folio.live.monthly',
            transactionId: 'tx-1',
            originalTransactionId: 'orig-1',
          },
          fresh: {
            bundleId: 'com.folio.v2.greenfield',
            environment: 'Sandbox',
            productId: 'folio.live.monthly',
            transactionId: 'tx-1',
            originalTransactionId: 'orig-1',
          },
          latest: {
            bundleId: 'com.folio.v2.greenfield',
            environment: 'Sandbox',
            productId: 'folio.live.monthly',
            transactionId: 'tx-2',
            originalTransactionId: 'orig-1',
            expiresDate: Date.now() + 60_000,
            revocationDate: Date.now(),
          },
          renewal: {
            productId: 'folio.live.monthly',
            originalTransactionId: 'orig-1',
            environment: 'Sandbox',
          },
          status: 1,
        }),
    );
    await expect(revoked.verify('folio.live.monthly', 'supplied')).rejects.toMatchObject({
      code: 'purchase_not_active',
    });
  });
});
