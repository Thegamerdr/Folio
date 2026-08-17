import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAvailablePurchases = vi.fn();

vi.mock('expo-iap', () => ({
  endConnection: vi.fn(),
  fetchProducts: vi.fn(),
  finishTransaction: vi.fn(),
  getAvailablePurchases,
  initConnection: vi.fn(),
  purchaseErrorListener: vi.fn(),
  purchaseUpdatedListener: vi.fn(),
  requestPurchase: vi.fn(),
}));

describe('billing purchase restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only Melo purchases and preserves the successful empty result', async () => {
    getAvailablePurchases.mockResolvedValueOnce([
      { productId: 'melo_plus_monthly', purchaseState: 'purchased' },
      { productId: 'another.app.product', purchaseState: 'purchased' },
    ]);
    const { restoreWithStatus } = await import('./iap');

    await expect(restoreWithStatus()).resolves.toEqual({
      status: 'ok',
      purchases: [{ productId: 'melo_plus_monthly', purchaseState: 'purchased' }],
    });

    getAvailablePurchases.mockResolvedValueOnce([]);
    await expect(restoreWithStatus()).resolves.toEqual({ status: 'ok', purchases: [] });
  });

  it('does not misreport a failed store query as no purchases', async () => {
    getAvailablePurchases.mockRejectedValueOnce(new Error('Play unavailable'));
    const { restoreWithStatus } = await import('./iap');

    await expect(restoreWithStatus()).resolves.toEqual(
      expect.objectContaining({ status: 'unavailable' }),
    );
  });

  it('keeps the legacy array helper fail-closed for non-UI compatibility', async () => {
    getAvailablePurchases.mockRejectedValueOnce(new Error('Play unavailable'));
    const { restore } = await import('./iap');

    await expect(restore()).resolves.toEqual([]);
  });
});
