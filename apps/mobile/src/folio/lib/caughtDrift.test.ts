// Caught-drift tests — pure-logic coverage for lib/caughtDrift.ts, plus the store-level "confirm
// updates the SAME entity in place" contract DriftCaughtSheet's confirm() relies on (mirrors
// caughtBillsOrdering.test.ts's pattern of pinning a sheet's exact store writes via the same store
// primitives the sheet itself calls), plus the per-merchant re-propose COOLDOWN (task: "drift thrash"
// fix) — confirm/dismiss quiet a merchant for 45 days unless a new deviation exceeds 30%.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  confirmDriftSignal,
  dismissDriftSignal,
  getState,
  resetAll,
  setSubs,
  upsertIncomeSource,
  type DriftCooldownEntry,
  type IncomeSource,
  type Sub,
} from '../store';
import { findDriftCandidates } from './caughtDrift';
import type { Transaction } from '../store';

function plusDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString();
}

function creditTxns(
  merchant: string,
  amount: number,
  startIso: string,
  every: number,
  count: number,
): Transaction[] {
  const rows: Transaction[] = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({
      id: `t-${merchant}-${i}`,
      merchant,
      amount,
      when: plusDays(startIso, i * every),
      category: 'income',
      source: 'manual',
    });
  }
  return rows;
}

function debitTxns(
  merchant: string,
  amount: number,
  startIso: string,
  every: number,
  count: number,
): Transaction[] {
  const rows: Transaction[] = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({
      id: `t-${merchant}-${i}`,
      merchant,
      amount: -Math.abs(amount),
      when: plusDays(startIso, i * every),
      category: 'bills',
      source: 'manual',
    });
  }
  return rows;
}

beforeEach(() => {
  resetAll();
});

describe('findDriftCandidates', () => {
  it('surfaces an income-drift candidate tagged kind:"income" carrying the sourceId to update', () => {
    const source: IncomeSource = {
      id: 'income-1',
      label: 'Acme Payroll',
      cadence: 'monthly',
      dayOfMonth: 1,
      amount: 2000,
      source: 'onboarding',
    };
    const transactions = creditTxns('Acme Payroll', 2500, '2026-01-01', 30, 4);
    const candidates = findDriftCandidates(transactions, [source], [], []);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      kind: 'income',
      sourceId: 'income-1',
      merchant: 'Acme Payroll',
      storedAmount: 2000,
    });
  });

  it('surfaces a bill-drift candidate tagged kind:"bill" carrying the merchant to update', () => {
    const sub: Sub = {
      name: 'Netflix',
      cost: 10,
      nextRenewalDaysAway: 30,
      lastUsedDaysAgo: 0,
      usesPerMonth: 0,
    };
    const transactions = debitTxns('Netflix', 13, '2026-01-01', 30, 3);
    const candidates = findDriftCandidates(transactions, [], [sub], []);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ kind: 'bill', merchant: 'Netflix', storedAmount: 10 });
  });

  it('a merchant within its cooldown window is excluded from both flavours (small deviations)', () => {
    const source: IncomeSource = {
      id: 'income-1',
      label: 'Acme Payroll',
      cadence: 'monthly',
      dayOfMonth: 1,
      amount: 2000,
      source: 'onboarding',
    };
    const sub: Sub = {
      name: 'Netflix',
      cost: 10,
      nextRenewalDaysAway: 30,
      lastUsedDaysAgo: 0,
      usesPerMonth: 0,
    };
    const transactions = [
      ...creditTxns('Acme Payroll', 2500, '2026-01-01', 30, 4), // 25% deviation
      ...debitTxns('Netflix', 13, '2026-01-01', 30, 3), // 30% deviation
    ];
    // Both deviations are AT OR UNDER the 30% cooldown breakthrough bar (25% and exactly 30%, which
    // does not exceed the bar — see findDriftCandidates' `>` comparison), so an active cooldown for
    // each merchant suppresses both, exactly like the old bare-dismissed-list contract this test
    // pinned before the "drift thrash" cooldown fix.
    const now = Date.parse('2026-03-01T00:00:00Z');
    const cooldown: DriftCooldownEntry[] = [
      { merchant: 'acme payroll', at: new Date(now).toISOString() },
      { merchant: 'netflix', at: new Date(now).toISOString() },
    ];
    const candidates = findDriftCandidates(transactions, [source], [sub], cooldown, now);
    expect(candidates).toEqual([]);
  });
});

describe('DriftCaughtSheet confirm contract — updates the SAME entity in place, never appends', () => {
  it('income-flavour confirm replaces the SAME IncomeSource id (upsertIncomeSource contract)', () => {
    const original: IncomeSource = {
      id: 'income-1',
      label: 'Acme Payroll',
      cadence: 'monthly',
      dayOfMonth: 1,
      amount: 2000,
      source: 'onboarding',
    };
    upsertIncomeSource(original);
    const transactions = creditTxns('Acme Payroll', 2500, '2026-01-01', 30, 4);
    const [candidate] = findDriftCandidates(transactions, [original], [], []);
    expect(candidate).toBeDefined();
    expect(candidate!.kind).toBe('income');

    // The sheet's exact confirm() write (see DriftCaughtSheet.tsx confirm()).
    if (candidate!.kind === 'income') {
      upsertIncomeSource({ ...original, amount: candidate!.detectedAmount });
    }

    const sources = getState().incomeSources ?? [];
    expect(sources).toHaveLength(1); // never a second source for the same id
    expect(sources[0]?.id).toBe('income-1');
    expect(sources[0]?.amount).toBeCloseTo(2500, 5);
  });

  it('bill-flavour confirm updates the SAME Sub by name (setSubs cost update, never a new Sub)', () => {
    setSubs(() => [
      { name: 'Netflix', cost: 10, nextRenewalDaysAway: 30, lastUsedDaysAgo: 0, usesPerMonth: 3 },
    ]);
    const transactions = debitTxns('Netflix', 13, '2026-01-01', 30, 3);
    const [candidate] = findDriftCandidates(transactions, [], getState().subs, []);
    expect(candidate).toBeDefined();
    expect(candidate!.kind).toBe('bill');

    // The sheet's exact confirm() write (see DriftCaughtSheet.tsx confirm()).
    setSubs((prev) =>
      prev.map((sub) =>
        sub.name.trim().toLowerCase() === candidate!.merchant.trim().toLowerCase()
          ? { ...sub, cost: candidate!.detectedAmount }
          : sub,
      ),
    );

    const subs = getState().subs;
    expect(subs).toHaveLength(1); // never a second Sub for the same merchant
    expect(subs[0]?.name).toBe('Netflix');
    expect(subs[0]?.cost).toBeCloseTo(13, 5);
    expect(subs[0]?.usesPerMonth).toBe(3); // untouched fields survive the update
  });
});

// ---------------------------------------------------------------------------
// Per-merchant re-propose COOLDOWN — task: "drift thrash" fix. A noisy signal (pay wobbling ±10-14%)
// crosses the 15% detection threshold, gets confirmed or dismissed, then must NOT immediately
// re-propose on the next landing; a genuinely large (>30%) new deviation still breaks through.
// ---------------------------------------------------------------------------
describe('findDriftCandidates cooldown', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  const netflixSub: Sub = {
    name: 'Netflix',
    cost: 10,
    nextRenewalDaysAway: 30,
    lastUsedDaysAgo: 0,
    usesPerMonth: 0,
  };

  it('confirming a drift candidate goes quiet for 45 days (small re-deviation stays suppressed)', () => {
    const t0 = Date.parse('2026-03-01T00:00:00Z');
    const transactions = debitTxns('Netflix', 13, '2026-01-01', 30, 3); // 30% at £10 stored
    const [candidate] = findDriftCandidates(transactions, [], [netflixSub], [], t0);
    expect(candidate).toBeDefined();
    expect(candidate!.kind).toBe('bill');

    confirmDriftSignal(candidate!.merchant);
    const cooldown = getState().dismissedDriftSignals ?? [];
    expect(cooldown).toHaveLength(1);
    expect(cooldown[0]?.merchant).toBe('netflix');

    // Same £13 detected cost re-evaluated 10 days later (well inside the 45-day window) against the
    // NOW-updated stored cost (£13) -> deviation is 0%, well under the 30% breakthrough bar either way.
    const updatedSub: Sub = { ...netflixSub, cost: 13 };
    const stillNoisy = debitTxns('Netflix', 14.5, '2026-01-01', 30, 3); // 11.5% off £13 — noise-scale
    const tPlus10Days = t0 + 10 * DAY_MS;
    expect(findDriftCandidates(stillNoisy, [], [updatedSub], cooldown, tPlus10Days)).toEqual([]);
  });

  it('a >30% deviation breaks through an active cooldown', () => {
    const t0 = Date.parse('2026-03-01T00:00:00Z');
    const cooldown: DriftCooldownEntry[] = [
      { merchant: 'netflix', at: new Date(t0).toISOString() },
    ];
    // Stored £10, detected £14 -> 40% deviation, over the 30% breakthrough bar.
    const bigJump = debitTxns('Netflix', 14, '2026-01-01', 30, 3);
    const tPlus5Days = t0 + 5 * DAY_MS;
    const candidates = findDriftCandidates(bigJump, [], [netflixSub], cooldown, tPlus5Days);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.kind).toBe('bill');
  });

  it('dismissing a drift candidate also goes quiet for 45 days', () => {
    const t0 = Date.parse('2026-03-01T00:00:00Z');
    const transactions = debitTxns('Netflix', 13, '2026-01-01', 30, 3);
    const [candidate] = findDriftCandidates(transactions, [], [netflixSub], [], t0);
    expect(candidate).toBeDefined();

    dismissDriftSignal(candidate!.merchant);
    const cooldown = getState().dismissedDriftSignals ?? [];
    expect(cooldown).toHaveLength(1);

    const tPlus20Days = t0 + 20 * DAY_MS;
    expect(findDriftCandidates(transactions, [], [netflixSub], cooldown, tPlus20Days)).toEqual([]);
  });

  it('the cooldown lapses after 45 days — the same small deviation surfaces again', () => {
    const t0 = Date.parse('2026-03-01T00:00:00Z');
    const cooldown: DriftCooldownEntry[] = [
      { merchant: 'netflix', at: new Date(t0).toISOString() },
    ];
    const transactions = debitTxns('Netflix', 13, '2026-01-01', 30, 3); // 30% deviation, under 45 days
    const tPlus46Days = t0 + 46 * DAY_MS;
    const candidates = findDriftCandidates(transactions, [], [netflixSub], cooldown, tPlus46Days);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.kind).toBe('bill');
  });

  it('income-flavour cooldown suppresses a small re-deviation the same way as bill-flavour', () => {
    const t0 = Date.parse('2026-03-01T00:00:00Z');
    const source: IncomeSource = {
      id: 'income-1',
      label: 'Acme Payroll',
      cadence: 'monthly',
      dayOfMonth: 1,
      amount: 2000,
      source: 'onboarding',
    };
    const transactions = creditTxns('Acme Payroll', 2500, '2026-01-01', 30, 4); // 25% deviation
    const [candidate] = findDriftCandidates(transactions, [source], [], [], t0);
    expect(candidate).toBeDefined();

    confirmDriftSignal(candidate!.merchant);
    const cooldown = getState().dismissedDriftSignals ?? [];

    const updatedSource: IncomeSource = { ...source, amount: 2500 };
    const noisyAgain = creditTxns('Acme Payroll', 2700, '2026-01-01', 30, 4); // 8% off the new 2500
    const tPlus15Days = t0 + 15 * DAY_MS;
    expect(findDriftCandidates(noisyAgain, [updatedSource], [], cooldown, tPlus15Days)).toEqual([]);
  });
});
