import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getInfoAsync, readAsStringAsync, writeAsStringAsync } = vi.hoisted(() => ({
  getInfoAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  writeAsStringAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file://doc/',
  EncodingType: { UTF8: 'utf8' },
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
}));

vi.mock('./billingVerification', () => ({
  billingVerificationConfig: () => ({
    issuer: 'https://billing.test',
    audience: 'com.melomoney.app',
    keyId: 'test-key',
    publicKey: 'test-public-key',
  }),
}));

vi.mock('./entitlementGrant', () => ({
  verifyEntitlementGrant: (grant: string) =>
    grant === 'signed-plus'
      ? {
          tier: 'plus',
          productId: 'melo_plus_monthly',
          expiresAt: '2026-08-01T00:00:00.000Z',
          graceUntil: '2026-08-04T00:00:00.000Z',
        }
      : grant === 'signed-pro'
        ? {
            tier: 'pro',
            productId: 'melo_pro_yearly',
            expiresAt: '2026-08-01T00:00:00.000Z',
            graceUntil: '2026-08-04T00:00:00.000Z',
          }
        : null,
}));

import { getState, resetAll, setPartial, type LensState } from '../../store';
import { reconcileEntitlements } from './entitlements';

const FALLBACK_LENS: LensState = {
  plusUnlocked: false,
  proUnlocked: false,
  trialCycleId: null,
  trialEndedCycleId: null,
  trialEndAcknowledged: true,
};
function lens(): LensState {
  return getState().lens ?? FALLBACK_LENS;
}

function signedRecord(tier: 'plus' | 'pro') {
  return JSON.stringify({
    v: 3,
    records: [
      {
        source: 'store',
        tier,
        productId: tier === 'plus' ? 'melo_plus_monthly' : 'melo_pro_yearly',
        grant: tier === 'plus' ? 'signed-plus' : 'signed-pro',
      },
    ],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetAll();
});

describe('reconcileEntitlements', () => {
  it('keeps Free when no signed entitlement exists', async () => {
    getInfoAsync.mockResolvedValue({ exists: false });
    await reconcileEntitlements();
    expect(lens()).toMatchObject({ plusUnlocked: false, proUnlocked: false });
  });

  it('never trusts an unsigned local tier label', async () => {
    getInfoAsync.mockResolvedValue({ exists: true });
    readAsStringAsync.mockResolvedValue(
      JSON.stringify({ v: 3, records: [{ source: 'store', tier: 'pro' }] }),
    );
    await reconcileEntitlements();
    expect(lens()).toMatchObject({ plusUnlocked: false, proUnlocked: false });
  });

  it('applies a signed Plus grant to Plus only', async () => {
    getInfoAsync.mockResolvedValue({ exists: true });
    readAsStringAsync.mockResolvedValue(signedRecord('plus'));
    await reconcileEntitlements();
    expect(lens()).toMatchObject({ plusUnlocked: true, proUnlocked: false });
  });

  it('applies a signed Pro grant as the Plus superset', async () => {
    getInfoAsync.mockResolvedValue({ exists: true });
    readAsStringAsync.mockResolvedValue(signedRecord('pro'));
    await reconcileEntitlements();
    expect(lens()).toMatchObject({ plusUnlocked: true, proUnlocked: true });
  });

  it('clears stale paid flags when no active signed grant remains', async () => {
    getInfoAsync.mockResolvedValue({ exists: false });
    setPartial({ lens: { ...lens(), plusUnlocked: true, proUnlocked: true } });
    await reconcileEntitlements();
    expect(lens()).toMatchObject({ plusUnlocked: false, proUnlocked: false });
  });

  it('never throws on a read failure', async () => {
    getInfoAsync.mockRejectedValue(new Error('disk error'));
    await expect(reconcileEntitlements()).resolves.toBeUndefined();
  });
});
