import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: {} } },
}));

describe('billing verification network boundary', () => {
  const originalKey = process.env['EXPO_PUBLIC_MELO_BILLING_ENTITLEMENT_PUBLIC_KEY'];

  beforeEach(() => {
    process.env['EXPO_PUBLIC_MELO_BILLING_ENTITLEMENT_PUBLIC_KEY'] = 'test-public-key';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (originalKey === undefined) {
      delete process.env['EXPO_PUBLIC_MELO_BILLING_ENTITLEMENT_PUBLIC_KEY'];
    } else {
      process.env['EXPO_PUBLIC_MELO_BILLING_ENTITLEMENT_PUBLIC_KEY'] = originalKey;
    }
  });

  it('bounds a stalled verifier request instead of leaving the purchase UI busy forever', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            });
          }),
      ),
    );
    const { verifyGooglePurchase } = await import('./billingVerification');
    const outcome = verifyGooglePurchase({
      productId: 'melo_plus_monthly',
      purchaseState: 'purchased',
      purchaseToken: 'play-token',
    } as never);

    await vi.advanceTimersByTimeAsync(20_001);
    await expect(outcome).resolves.toEqual({
      status: 'unavailable',
      message: 'Store verification is temporarily unavailable. Try Restore purchases shortly.',
    });
  });

  it('rejects missing purchase proof before any network request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { verifyGooglePurchase } = await import('./billingVerification');

    await expect(
      verifyGooglePurchase({
        productId: 'melo_plus_monthly',
        purchaseState: 'purchased',
      } as never),
    ).resolves.toMatchObject({ status: 'rejected' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('store billing capability', () => {
  it('enables only the platform backed by the shipped signed verifier', async () => {
    const { storeBillingCapability } = await import('./billingVerification');

    expect(storeBillingCapability('android')).toEqual({
      supported: true,
      verificationRoute: 'google-play',
    });
    expect(storeBillingCapability('ios')).toEqual({
      supported: false,
      message: 'App Store purchase verification is not available in this Melo build yet.',
    });
    expect(storeBillingCapability('web')).toMatchObject({ supported: false });
  });
});
