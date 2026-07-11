// Restore-engine tests (plan 113) — pure validation/summary coverage for
// lib/restore.ts, plus the round-trip that makes an export a REAL recovery
// path: a persist blob exported from live state, cleared, then restored
// through the store's own hydration seam must bring the user's data back.
//
// restoreNative.ts (picker/filesystem shell) is deliberately untested here,
// same as exportNative.ts — it is a thin I/O composition of the pieces this
// file and store.test.ts already pin.
//
// Node-safe: touches only the store module + the pure engine (no react-native
// runtime, no DOM), collected by the apps/**/*.test.ts runner.

import { beforeEach, describe, expect, it } from 'vitest';

import { summarizeRestore, validateRestoreJson } from './restore';
import {
  addTransaction,
  consumeLoadDegraded,
  getPersistBlob,
  getState,
  hydrateFromBlob,
  resetAll,
  resetToEmpty,
  setOnboarding,
} from '../store';

describe('validateRestoreJson — envelope check', () => {
  it('rejects a string that is not JSON', () => {
    expect(validateRestoreJson('not json at all')).toEqual({ ok: false, reason: 'not-json' });
  });

  it('rejects JSON that is not an object (number, string, array, null)', () => {
    expect(validateRestoreJson('42')).toEqual({ ok: false, reason: 'not-an-object' });
    expect(validateRestoreJson('"hello"')).toEqual({ ok: false, reason: 'not-an-object' });
    expect(validateRestoreJson('[1,2,3]')).toEqual({ ok: false, reason: 'not-an-object' });
    expect(validateRestoreJson('null')).toEqual({ ok: false, reason: 'not-an-object' });
  });

  it('rejects an object that does not look like a Folio export', () => {
    expect(validateRestoreJson('{}')).toEqual({ ok: false, reason: 'not-a-folio-export' });
    // One signature key alone is not enough — arbitrary JSON with a `subs`
    // field must not be allowed to replace real data.
    expect(validateRestoreJson('{"subs": []}')).toEqual({
      ok: false,
      reason: 'not-a-folio-export',
    });
  });

  it('accepts a real persist blob from the live store', () => {
    resetAll();
    const result = validateRestoreJson(getPersistBlob());
    expect(result.ok).toBe(true);
  });
});

describe('summarizeRestore — what the confirm sheet shows', () => {
  it('counts lists and surfaces the onboarding name', () => {
    const summary = summarizeRestore({
      transactions: [{}, {}, {}],
      subs: [{}],
      pots: [{}, {}],
      onboarding: { done: true, name: 'Alex', payday: 25, monthlyIncome: 2000 },
    });
    expect(summary).toEqual({ transactions: 3, subs: 1, pots: 2, name: 'Alex' });
  });

  it('reads malformed or missing fields as 0 / null instead of throwing', () => {
    const summary = summarizeRestore({ transactions: 'corrupt', onboarding: null });
    expect(summary).toEqual({ transactions: 0, subs: 0, pots: 0, name: null });
  });
});

describe('restore round-trip — export is a real recovery path', () => {
  beforeEach(() => {
    resetAll();
  });

  it('clear-to-empty then restore brings the persisted data back', () => {
    // Arrange: a REAL user's state (empty start + own data, no demo seed —
    // a real export never carries seed rows, and load()'s marker-based seed
    // purge would rightly strip them for a real user anyway).
    resetToEmpty();
    setOnboarding({ done: true, name: 'Roundtrip', payday: 25, monthlyIncome: 2500 });
    addTransaction({ merchant: 'Corner Shop', amount: -450, category: 'food', source: 'manual' });
    const exported = getPersistBlob();
    const before = JSON.parse(exported) as Record<string, unknown>;

    // Act: the disaster + the recovery.
    resetToEmpty();
    expect(getState().transactions.some((t) => t.merchant === 'Corner Shop')).toBe(false);
    const validation = validateRestoreJson(exported);
    expect(validation.ok).toBe(true);
    hydrateFromBlob(exported);

    // Assert: not degraded, and the persisted fields round-tripped. Subs are
    // compared by identity fields only — load() re-anchors renewal dates by
    // design (date-anchor fix), so day counts may legitimately be recomputed.
    expect(consumeLoadDegraded()).toBe(false);
    const after = JSON.parse(getPersistBlob()) as Record<string, unknown>;
    expect(after.transactions).toEqual(before.transactions);
    expect(after.pots).toEqual(before.pots);
    expect(after.onboarding).toEqual(before.onboarding);
    expect(after.currentBalance).toEqual(before.currentBalance);
    const subNames = (list: unknown) =>
      Array.isArray(list) ? list.map((s) => (s as { name: string }).name) : [];
    expect(subNames(after.subs)).toEqual(subNames(before.subs));
    expect(getState().transactions.some((t) => t.merchant === 'Corner Shop')).toBe(true);
  });

  it('a corrupt list field defaults safely WITHOUT flagging degraded (field tolerance)', () => {
    // Pins the store's actual semantics: per-field corruption is silently
    // defaulted by load()'s guards (same tolerance as a cold boot);
    // `loadDegraded` fires only when the whole pipeline throws. Restore copy
    // must therefore not promise per-field corruption reporting.
    const parsed = JSON.parse(getPersistBlob()) as Record<string, unknown>;
    parsed.subs = 'corrupt — not a list';
    hydrateFromBlob(JSON.stringify(parsed));
    expect(consumeLoadDegraded()).toBe(false);
    // The corrupt section reset to a safe default list; the rest loaded.
    expect(Array.isArray(getState().subs)).toBe(true);
  });
});
