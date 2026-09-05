import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductOrSubscription, Purchase } from 'expo-iap';

const native = vi.hoisted(() => ({
  fetch: vi.fn(),
  request: vi.fn(),
  available: vi.fn(),
  updated: null as null | ((purchase: Purchase) => void),
  platform: { OS: 'android' },
}));
vi.mock('react-native', () => ({ Platform: native.platform }));
vi.mock('expo-iap', () => ({
  fetchProducts: native.fetch,
  requestPurchase: native.request,
  getAvailablePurchases: native.available,
  initConnection: vi.fn().mockResolvedValue(true),
  endConnection: vi.fn(),
  finishTransaction: vi.fn(),
  purchaseUpdatedListener: (callback: (purchase: Purchase) => void) => {
    native.updated = callback;
    return { remove: vi.fn() };
  },
  purchaseErrorListener: () => ({ remove: vi.fn() }),
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  native.request.mockResolvedValue(undefined);
  native.platform.OS = 'android';
});

describe('native purchase adapter', () => {
  it('uses iOS store-localized ordinary periods and leaves finishing to verification', async () => {
    native.platform.OS = 'ios';
    const product = {
      id: 'folio.live.monthly',
      type: 'subs',
      platform: 'ios',
      typeIOS: 'auto-renewable-subscription',
      currency: 'EUR',
      displayPrice: '€4.99',
      subscriptionPeriodUnitIOS: 'month',
      subscriptionPeriodNumberIOS: '1',
    } as ProductOrSubscription;
    native.fetch.mockImplementation(async ({ type }: { type: string }) =>
      type === 'subs' ? [product] : [],
    );
    const { probeAvailability, metadataForProducts, purchase } = await import('./iap');
    expect((await probeAvailability()).products['folio.live.monthly']).toMatchObject({
      displayPrice: '€4.99',
      billingPeriod: 'P1M',
    });
    expect(
      metadataForProducts([
        { ...product, subscriptionPeriodUnitIOS: 'year' } as ProductOrSubscription,
      ]),
    ).toEqual([]);
    const outcome = purchase('folio.live.monthly');
    expect(native.request).toHaveBeenCalledWith({
      request: {
        apple: { sku: 'folio.live.monthly', andDangerouslyFinishTransactionAutomatically: false },
      },
      type: 'subs',
    });
    native.updated?.({
      productId: 'folio.live.monthly',
      purchaseToken: 'signed-jws',
      purchaseState: 'purchased',
    } as Purchase);
    expect((await outcome).status).toBe('purchased');
  });

  it('uses the exact regular base-plan price and offer, independently of Full availability', async () => {
    const { probeAvailability, purchase } = await import('./iap');
    const phase = {
      billingCycleCount: 0,
      billingPeriod: 'P1M',
      formattedPrice: '€4.49',
      priceAmountMicros: '4490000',
      priceCurrencyCode: 'EUR',
      recurrenceMode: 1,
    };
    const product = {
      id: 'folio.live.monthly',
      type: 'subs',
      platform: 'android',
      currency: 'EUR',
      displayPrice: '€0.00',
      subscriptionOfferDetailsAndroid: [
        {
          basePlanId: 'monthly',
          offerId: 'trial',
          offerToken: 'trial-token',
          pricingPhases: { pricingPhaseList: [{ ...phase, formattedPrice: '€0.00' }] },
        },
        {
          basePlanId: 'monthly',
          offerId: null,
          offerToken: 'base-token',
          pricingPhases: { pricingPhaseList: [phase] },
        },
      ],
    } as unknown as ProductOrSubscription;
    native.fetch.mockImplementation(async ({ type }: { type: string }) => {
      if (type === 'in-app') throw new Error('Full not listed');
      return [product];
    });
    const availability = await probeAvailability();
    expect(availability.availableProductIds).toEqual(['folio.live.monthly']);
    expect(availability.products['folio.live.monthly']).toMatchObject({
      displayPrice: '€4.49',
      offerToken: 'base-token',
      billingPeriod: 'P1M',
    });
    const outcome = purchase('folio.live.monthly');
    expect(native.request).toHaveBeenCalledWith(
      expect.objectContaining({
        request: {
          google: {
            skus: ['folio.live.monthly'],
            subscriptionOffers: [{ sku: 'folio.live.monthly', offerToken: 'base-token' }],
          },
        },
      }),
    );
    native.updated?.({
      productId: 'folio.live.monthly',
      purchaseToken: 'proof',
      purchaseState: 'pending',
    } as Purchase);
    expect((await outcome).status).toBe('pending');
    expect((await purchase('folio.plus.monthly')).status).toBe('failed');
  });

  it('keeps post-pending completion and redelivery visible to the app-wide listener', async () => {
    const { purchase, subscribeToPurchaseUpdates, restore } = await import('./iap');
    const listener = vi.fn();
    subscribeToPurchaseUpdates(listener);
    const result = purchase('folio.full');
    const proof = {
      productId: 'folio.full',
      purchaseToken: 'proof',
      purchaseState: 'pending',
    } as Purchase;
    native.updated?.(proof);
    expect((await result).status).toBe('pending');
    native.updated?.({ ...proof, purchaseState: 'purchased' } as Purchase);
    native.updated?.({ ...proof, purchaseState: 'purchased' } as Purchase);
    expect(listener).toHaveBeenCalledTimes(3);
    native.available.mockRejectedValue(new Error('Play offline'));
    await expect(restore()).rejects.toThrow('Play offline');
  });
});
