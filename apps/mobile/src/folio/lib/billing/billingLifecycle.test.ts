import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Purchase } from 'expo-iap';

const native = vi.hoisted(() => ({
  ensure: vi.fn(),
  probe: vi.fn(),
  restore: vi.fn(),
  finish: vi.fn(),
  verify: vi.fn(),
  save: vi.fn(),
  reconcile: vi.fn(),
  active: vi.fn(),
  onPurchase: null as null | ((purchase: Purchase) => void),
  cleanup: null as null | (() => void),
}));
vi.mock('react', () => ({
  useEffect: (effect: () => () => void) => {
    native.cleanup = effect();
  },
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock('./iap', () => ({
  ensurePurchaseListeners: native.ensure,
  probeAvailability: native.probe,
  restore: native.restore,
  finishPurchase: native.finish,
  subscribeToPurchaseUpdates: (callback: (purchase: Purchase) => void) => {
    native.onPurchase = callback;
    return () => {
      native.onPurchase = null;
    };
  },
}));
vi.mock('./billingVerification', () => ({ verifyPurchase: native.verify }));
vi.mock('./entitlements', () => ({
  saveVerifiedEntitlement: native.save,
  reconcileEntitlements: native.reconcile,
  loadActiveEntitlements: native.active,
}));

const purchased = {
  productId: 'folio.full',
  purchaseToken: 'proof',
  purchaseState: 'purchased',
} as Purchase;
const verified = { status: 'verified', grant: 'signed', entitlement: { tier: 'full' } };

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  native.probe.mockResolvedValue({ available: true });
  native.restore.mockResolvedValue([]);
  native.finish.mockResolvedValue(true);
  native.verify.mockResolvedValue(verified);
  native.save.mockResolvedValue({ tier: 'full' });
  native.active.mockResolvedValue([]);
});
afterEach(() => {
  native.cleanup?.();
  native.cleanup = null;
});

describe('shipping billing lifecycle', () => {
  it('coalesces paywall/listener proof processing and persists before finishing', async () => {
    const { acceptVerifiedPurchase } = await import('./billingLifecycle');
    await Promise.all([acceptVerifiedPurchase(purchased), acceptVerifiedPurchase(purchased)]);
    expect(native.verify).toHaveBeenCalledTimes(1);
    expect(native.save).toHaveBeenCalledTimes(1);
    expect(native.save.mock.invocationCallOrder[0]).toBeLessThan(
      native.finish.mock.invocationCallOrder[0]!,
    );
  });

  it('does not finish failed verification or storage, and permits later redelivery', async () => {
    const { acceptVerifiedPurchase } = await import('./billingLifecycle');
    native.verify.mockResolvedValueOnce({ status: 'unavailable', message: 'offline' });
    await acceptVerifiedPurchase(purchased);
    native.save.mockResolvedValueOnce(null);
    await acceptVerifiedPurchase(purchased);
    expect(native.finish).not.toHaveBeenCalled();
    expect((await acceptVerifiedPurchase(purchased)).status).toBe('verified');
    expect(native.finish).toHaveBeenCalledTimes(1);
  });

  it('checks local authority before and after native failure, with bounded overdue retries', async () => {
    const { reconcileBillingPurchases, billingRefreshDelay } = await import('./billingLifecycle');
    native.ensure.mockImplementation(() => {
      throw new Error('native unavailable');
    });
    await reconcileBillingPurchases();
    expect(native.reconcile).toHaveBeenCalledTimes(2);
    expect(native.reconcile.mock.invocationCallOrder[0]).toBeLessThan(
      native.ensure.mock.invocationCallOrder[0]!,
    );
    const now = Date.parse('2026-09-05T12:00:00Z');
    expect(billingRefreshDelay([{ refreshAfter: new Date(now - 1).toISOString() }], now)).toBe(
      300_000,
    );
    expect(
      billingRefreshDelay([{ graceUntil: new Date(now + 1_123).toISOString() }], now, true),
    ).toBe(1_000);
  });

  it('accepts pending completion through the mounted listener with no paywall', async () => {
    const { useBillingLifecycle } = await import('./billingLifecycle');
    useBillingLifecycle();
    await vi.waitFor(() => expect(native.restore).toHaveBeenCalledOnce());
    native.verify.mockResolvedValueOnce({ status: 'pending' });
    native.onPurchase?.({ ...purchased, purchaseState: 'pending' } as Purchase);
    await vi.waitFor(() => expect(native.verify).toHaveBeenCalledOnce());
    expect(native.finish).not.toHaveBeenCalled();
    // Let the pending result settle before Play delivers its completed state.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    native.onPurchase?.(purchased);
    await vi.waitFor(() => expect(native.finish).toHaveBeenCalledOnce());
  });
});
