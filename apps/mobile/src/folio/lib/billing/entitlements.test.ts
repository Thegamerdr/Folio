// entitlements.ts adapter tests — expo-file-system/legacy is mocked (this module reaches into it
// at import time, which is not Node-safe on its own — same reason persist.ts and clerkAuth.ts are
// never imported un-mocked in their own test files; see persist.test.ts / clerkAuth.test.ts
// header comments). The store (../../store) is real — it is already Node-safe/pure — so
// reconcileEntitlements is exercised against actual store state via getState()/setPartial(),
// matching entitlementsLogic.test.ts's "pure logic, real assertions" style rather than mocking
// the store too.
//
// The mock is registered at module scope (not per-test), so both `entitlements.ts` and the store
// are imported statically at the top — no dynamic re-import / `vi.resetModules()` here, since that
// would give `reconcileEntitlements` a store module instance disconnected from this file's own
// `getState`/`setPartial` calls (the store is a singleton keyed by module identity).

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
    audience: 'com.folio.v2.greenfield',
    keyId: 'test-key',
    publicKey: 'test-public-key',
  }),
}));

vi.mock('./entitlementGrant', () => ({
  verifyEntitlementGrant: (grant: string) =>
    grant === 'signed-full'
      ? {
          tier: 'full',
          productId: 'folio.full',
          expiresAt: null,
          graceUntil: null,
        }
      : grant === 'signed-live'
        ? {
            tier: 'live',
            productId: 'folio.live.monthly',
            expiresAt: '2026-08-01T00:00:00.000Z',
            graceUntil: '2026-08-04T00:00:00.000Z',
          }
        : null,
}));

import { resetAll, setPartial, getState, type LensState } from '../../store';
import { reconcileEntitlements } from './entitlements';

// AppState.lens is optional on the type (shape-migration reasons — see store.ts DEFAULT_LENS),
// so reads go through this helper for a non-optional LensState in test assertions/setup, mirroring
// how useLens() and reconcileEntitlements itself fall back to defaults.
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

beforeEach(() => {
  vi.clearAllMocks();
  resetAll();
});

describe('reconcileEntitlements', () => {
  it('is a no-op when nothing is persisted (missing file)', async () => {
    getInfoAsync.mockResolvedValue({ exists: false });

    await reconcileEntitlements();

    expect(lens().plusUnlocked).toBe(false);
    expect(lens().proUnlocked).toBe(false);
  });

  it('is a no-op for a preview/trial entitlement (governed by lens.trialCycleId instead)', async () => {
    getInfoAsync.mockResolvedValue({ exists: true });
    readAsStringAsync.mockResolvedValue(
      JSON.stringify({ v: 1, record: { source: 'preview', tier: 'plus' } }),
    );

    await reconcileEntitlements();

    expect(lens().plusUnlocked).toBe(false);
  });

  it('does not trust an unsigned legacy store Plus label', async () => {
    getInfoAsync.mockResolvedValue({ exists: true });
    readAsStringAsync.mockResolvedValue(
      JSON.stringify({ v: 1, record: { source: 'store', tier: 'plus' } }),
    );
    setPartial({ lens: { ...lens(), plusUnlocked: false, proUnlocked: false } });

    await reconcileEntitlements();

    // Free/Full/Live restructure: Full is written through setLensFullUnlocked, which sets BOTH
    // legacy persisted flags — a legacy Plus purchaser owns Full outright.
    expect(lens().plusUnlocked).toBe(false);
    expect(lens().proUnlocked).toBe(false);
  });

  it('does not trust an unsigned legacy store Pro label', async () => {
    getInfoAsync.mockResolvedValue({ exists: true });
    readAsStringAsync.mockResolvedValue(
      JSON.stringify({ v: 1, record: { source: 'store', tier: 'pro' } }),
    );
    setPartial({ lens: { ...lens(), plusUnlocked: false, proUnlocked: false } });

    await reconcileEntitlements();

    expect(lens().proUnlocked).toBe(false);
    expect(lens().plusUnlocked).toBe(false);
  });

  it('does not trust an unsigned local Full label', async () => {
    getInfoAsync.mockResolvedValue({ exists: true });
    readAsStringAsync.mockResolvedValue(
      JSON.stringify({ v: 1, record: { source: 'store', tier: 'full' } }),
    );
    setPartial({ lens: { ...lens(), plusUnlocked: false, proUnlocked: false } });

    await reconcileEntitlements();

    expect(lens().plusUnlocked).toBe(false);
    expect(lens().proUnlocked).toBe(false);
  });

  it('repairs Full only from a verified signed grant', async () => {
    getInfoAsync.mockResolvedValue({ exists: true });
    readAsStringAsync.mockResolvedValue(
      JSON.stringify({
        v: 2,
        records: [
          {
            source: 'store',
            tier: 'full',
            productId: 'folio.full',
            grant: 'signed-full',
          },
        ],
      }),
    );

    await reconcileEntitlements();

    expect(lens().plusUnlocked).toBe(true);
    expect(lens().proUnlocked).toBe(true);
  });

  it('never touches lens flags for a Live entitlement — Live gates AI quantity, not lenses', async () => {
    getInfoAsync.mockResolvedValue({ exists: true });
    readAsStringAsync.mockResolvedValue(
      JSON.stringify({ v: 1, record: { source: 'store', tier: 'live' } }),
    );
    setPartial({ lens: { ...lens(), plusUnlocked: false, proUnlocked: false } });

    await reconcileEntitlements();

    expect(lens().plusUnlocked).toBe(false);
    expect(lens().proUnlocked).toBe(false);
  });

  it('does nothing when the flag already matches the entitlement (idempotent)', async () => {
    getInfoAsync.mockResolvedValue({ exists: true });
    readAsStringAsync.mockResolvedValue(
      JSON.stringify({ v: 1, record: { source: 'store', tier: 'plus' } }),
    );
    setPartial({ lens: { ...lens(), plusUnlocked: true, proUnlocked: false } });

    await reconcileEntitlements();

    expect(lens().plusUnlocked).toBe(true);
    expect(lens().proUnlocked).toBe(false);
  });

  it('never revokes an unlock when the store entitlement has expired (fail open, no offline punishment)', async () => {
    getInfoAsync.mockResolvedValue({ exists: true });
    readAsStringAsync.mockResolvedValue(
      JSON.stringify({
        v: 1,
        record: { source: 'store', tier: 'pro', expiresAt: '2020-01-01T00:00:00.000Z' },
      }),
    );
    setPartial({ lens: { ...lens(), plusUnlocked: true, proUnlocked: true } });

    await reconcileEntitlements();

    // Still unlocked — reconciliation must never revoke, expired or not.
    expect(lens().proUnlocked).toBe(true);
    expect(lens().plusUnlocked).toBe(true);
  });

  it('does not unlock from an expired store entitlement when nothing was unlocked to begin with', async () => {
    getInfoAsync.mockResolvedValue({ exists: true });
    readAsStringAsync.mockResolvedValue(
      JSON.stringify({
        v: 1,
        record: { source: 'store', tier: 'plus', expiresAt: '2020-01-01T00:00:00.000Z' },
      }),
    );
    setPartial({ lens: { ...lens(), plusUnlocked: false, proUnlocked: false } });

    await reconcileEntitlements();

    // isEntitlementActive() is false for this record, so loadActiveEntitlement() resolves to
    // null and reconcileEntitlements treats it as "no entitlement" — it must not newly unlock.
    expect(lens().plusUnlocked).toBe(false);
    expect(lens().proUnlocked).toBe(false);
  });

  it('never throws on a read failure', async () => {
    getInfoAsync.mockRejectedValue(new Error('disk error'));

    await expect(reconcileEntitlements()).resolves.toBeUndefined();
  });
});
