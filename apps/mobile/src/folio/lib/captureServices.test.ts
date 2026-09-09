import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Purchase } from 'expo-iap';

const mock = vi.hoisted(() => ({
  extra: {} as Record<string, string>,
  native: {
    endConnection: vi.fn(),
    fetchProducts: vi.fn(),
    finishTransaction: vi.fn(),
    getAvailablePurchases: vi.fn(),
    initConnection: vi.fn(),
    purchaseErrorListener: vi.fn(),
    purchaseUpdatedListener: vi.fn(),
    requestPurchase: vi.fn(),
  },
}));
vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: mock.extra } } }));
vi.mock('@clerk/clerk-expo/token-cache', () => ({ tokenCache: undefined }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-iap', () => mock.native);

import { getClerkPublishableKey, isClerkConfigured } from './clerkAuth';
import {
  getOpenBankingDeletionUrl,
  getOpenBankingUrl,
  isOpenBankingEnabled,
} from './openBankingConfig';
import { billingVerificationConfig, verifyPurchase } from './billing/billingVerification';
import * as iap from './billing/iap';
import { resolveMeloAiProviderConfig, sendMeloChat } from '../../local/meloAiClient';

const services = {
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_synthetic',
  EXPO_PUBLIC_MELO_OPEN_BANKING_ENABLED: 'true',
  EXPO_PUBLIC_MELO_OPEN_BANKING_URL: 'https://bank.example.test',
  EXPO_PUBLIC_MELO_BILLING_ENTITLEMENT_PUBLIC_KEY: 'synthetic-public-key',
  EXPO_PUBLIC_MELO_BILLING_URL: 'https://billing.example.test',
};
const proof = {
  productId: 'folio.full',
  purchaseToken: 'synthetic-proof',
  purchaseState: 'purchased',
} as Purchase;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('EXPO_PUBLIC_MELO_PARITY_CAPTURE', 'true');
  vi.stubGlobal('fetch', vi.fn());
  for (const key of Object.keys(services)) {
    vi.stubEnv(key, '');
    delete mock.extra[key];
  }
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('capture builds cannot use real account services', () => {
  it.each(['env', 'extra'])('overrides configured %s credentials and endpoints', async (source) => {
    for (const [key, value] of Object.entries(services)) {
      if (source === 'env') vi.stubEnv(key, value);
      else mock.extra[key] = value;
    }
    expect(getClerkPublishableKey()).toBeUndefined();
    expect(isClerkConfigured()).toBe(false);
    expect(isOpenBankingEnabled()).toBe(false);
    expect(getOpenBankingUrl()).toBeUndefined();
    expect(getOpenBankingDeletionUrl()).toBeUndefined();
    expect(billingVerificationConfig()).toBeNull();
    expect((await verifyPurchase(proof)).status).toBe('unavailable');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('never connects, buys, restores, finishes or listens to real native store purchases', async () => {
    iap.ensurePurchaseListeners();
    expect((await iap.probeAvailability()).available).toBe(false);
    expect(await iap.queryProducts()).toEqual([]);
    expect((await iap.purchase('folio.full')).status).toBe('failed');
    expect(await iap.restore()).toEqual([]);
    expect(await iap.finishPurchase(proof)).toBe(false);
    await iap.closeConnection();
    for (const nativeCall of Object.values(mock.native)) expect(nativeCall).not.toHaveBeenCalled();
  });

  it('keeps the retired remote conversation transport inert for fixture context', async () => {
    expect(resolveMeloAiProviderConfig()).toEqual({ configured: false });
    expect((await sendMeloChat({ messages: [], tone: 'calm' })).status).toBe('no-provider');
    expect(fetch).not.toHaveBeenCalled();
  });
});
