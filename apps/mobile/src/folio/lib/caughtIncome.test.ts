// caughtIncome — pure-logic coverage for findCaughtIncome (lib/caughtIncome.ts).
//
// The bridge that turns the income-signal DETECTION engine
// (lib/incomeSignals.ts detectIncomeSources) into IncomeCaughtSheet
// candidates, gated on:
//   • a signal exists (>= the engine's own min-occurrence/run thresholds)
//   • its merchant has NO existing IncomeSource            -> else suppressed
//   • its merchant is NOT in the dismissed list             -> else suppressed
// plus the honesty guarantee (payment facts only) and the field mapping.
//
// Node-safe: touches only the pure `findCaughtIncome` (no react-native, no
// DOM, no store mutation), so it is a plain `.test.ts` collected by the
// apps/**/*.test.ts runner — exactly like caughtSubs.test.ts.

import { describe, expect, it } from 'vitest';

import { findCaughtIncome, sameIncomeMatch, type IncomeCaughtCandidate } from './caughtIncome';
import type { IncomeSource, Transaction } from '../store';

// ---------------------------------------------------------------------------
// Fixture helpers.
// ---------------------------------------------------------------------------

/** A credit transaction (positive amount, store convention). */
function credit(merchant: string, pounds: number, isoDate: string): Transaction {
  return {
    id: `t-${merchant}-${isoDate}`.toLowerCase().replace(/\s+/g, '-'),
    when: `${isoDate}T09:00:00.000Z`,
    merchant,
    amount: pounds,
    category: 'income',
    source: 'seed',
  };
}

/** N monthly credits (~30d apart) of one merchant at a fixed amount. */
function monthlyCredits(
  merchant: string,
  pounds: number,
  startIso: string,
  count: number,
): Transaction[] {
  const rows: Transaction[] = [];
  const start = new Date(`${startIso}T00:00:00Z`);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(start.getTime() + i * 30 * 86_400_000);
    rows.push(credit(merchant, pounds, d.toISOString().slice(0, 10)));
  }
  return rows;
}

/** N weekly credits (~7d apart) of one merchant at a fixed amount — matches
 *  incomeSignals.ts's own MIN_OCCURRENCES.weekly (4) when count >= 4. */
function weeklyCredits(
  merchant: string,
  pounds: number,
  startIso: string,
  count: number,
): Transaction[] {
  const rows: Transaction[] = [];
  const start = new Date(`${startIso}T00:00:00Z`);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(start.getTime() + i * 7 * 86_400_000);
    rows.push(credit(merchant, pounds, d.toISOString().slice(0, 10)));
  }
  return rows;
}

function incomeSource(label: string, overrides: Partial<IncomeSource> = {}): IncomeSource {
  return {
    id: `is-${label}`.toLowerCase().replace(/\s+/g, '-'),
    label,
    cadence: 'monthly',
    dayOfMonth: 1,
    amount: 2000,
    source: 'onboarding',
    ...overrides,
  };
}

function byMerchant(
  list: IncomeCaughtCandidate[],
  merchant: string,
): IncomeCaughtCandidate | undefined {
  return list.find((c) => c.merchant === merchant);
}

// ---------------------------------------------------------------------------
// Core gating: signal + no existing source + not dismissed -> offer.
// ---------------------------------------------------------------------------
describe('findCaughtIncome — surfaces a real, undeclared, non-dismissed signal', () => {
  it('3 monthly credits of a merchant with no IncomeSource -> caught', () => {
    const txns = monthlyCredits('Stafflink Payroll', 1800, '2026-04-01', 3);
    const caught = findCaughtIncome(txns, [], []);

    const sig = byMerchant(caught, 'Stafflink Payroll');
    expect(sig).toBeDefined();
    expect(sig?.cadence).toBe('monthly');
    expect(sig?.occurrences).toBe(3);
    expect(sig?.medianAmount).toBeCloseTo(1800, 2);
    expect(typeof sig?.lastSeenISO).toBe('string');
    expect(sig?.anchorISO).toBe(sig?.lastSeenISO);
    expect(['strong', 'possible']).toContain(sig?.confidence);
  });

  it('does not infer a refund credit as recurring income', () => {
    const rows = weeklyCredits('Refund desk', 24, '2026-01-05', 4).map((row) => ({
      ...row,
      financialAction: { kind: 'refund' as const, originalTransactionId: 'original' },
    }));
    expect(findCaughtIncome(rows, [], [])).toEqual([]);
  });

  it('does NOT catch a merchant that already has a declared IncomeSource', () => {
    const txns = monthlyCredits('Acme Ltd', 2200, '2026-04-01', 3);
    const caught = findCaughtIncome(txns, [incomeSource('Acme Ltd')], []);
    expect(byMerchant(caught, 'Acme Ltd')).toBeUndefined();
  });

  it('existing-source match is case/whitespace-insensitive', () => {
    const txns = monthlyCredits('Acme Ltd', 2200, '2026-04-01', 3);
    const caught = findCaughtIncome(txns, [incomeSource('  acme ltd  ')], []);
    expect(caught).toHaveLength(0);
  });

  it('does NOT catch a merchant the user already dismissed', () => {
    const txns = monthlyCredits('Gig Co', 950, '2026-04-01', 3);
    const caught = findCaughtIncome(txns, [], ['gig co']);
    expect(byMerchant(caught, 'Gig Co')).toBeUndefined();
  });

  it('dismissed-match is case/whitespace-insensitive', () => {
    const txns = monthlyCredits('Gig Co', 950, '2026-04-01', 3);
    const caught = findCaughtIncome(txns, [], ['  GIG CO  ']);
    expect(caught).toHaveLength(0);
  });

  it('catches an undeclared merchant while skipping a declared one in the same ledger', () => {
    const txns = [
      ...monthlyCredits('Acme Ltd', 2200, '2026-04-01', 3), // declared -> skipped
      ...monthlyCredits('Freelance Client', 600, '2026-04-05', 3), // undeclared -> caught
    ];
    const caught = findCaughtIncome(txns, [incomeSource('Acme Ltd')], []);
    expect(byMerchant(caught, 'Acme Ltd')).toBeUndefined();
    expect(byMerchant(caught, 'Freelance Client')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Same-income matching — the bug this module exists to prevent: onboarding's
// generic "Pay" (declared monthly-equivalent) must recognise a later-detected,
// differently-labelled/cadenced signal as the SAME real income and propose an
// UPDATE (never a second, additional IncomeSource that doubles the runway).
// ---------------------------------------------------------------------------
describe('findCaughtIncome — same-income match proposes an UPDATE, never a duplicate', () => {
  it('weekly £215 candidate vs onboarding monthly £930 "Pay" -> tagged update, not new, not dropped', () => {
    // £215/wk * 52/12 ≈ £931.67 monthly-equivalent — within ±30% of £930 -> same income.
    const txns = weeklyCredits('Acme Staffing Ltd', 215, '2026-04-06', 4);
    const pay = incomeSource('Pay', { cadence: 'monthly', dayOfMonth: 28, amount: 930 });

    const caught = findCaughtIncome(txns, [pay], []);
    const sig = byMerchant(caught, 'Acme Staffing Ltd');

    expect(sig).toBeDefined(); // not silently dropped
    expect(sig?.updatesSourceId).toBe(pay.id); // tagged as an update to the existing source
    expect(caught).toHaveLength(1); // never a second, additional candidate
  });

  it('a genuinely different second income (small side gig vs a big salary) -> proposed as NEW, not an update', () => {
    // £80/month side gig vs a £2000/month salary — well outside the ±30% band.
    const txns = monthlyCredits('Side Gig Co', 80, '2026-04-01', 3);
    const salary = incomeSource('Main Job', { cadence: 'monthly', dayOfMonth: 25, amount: 2000 });

    const caught = findCaughtIncome(txns, [salary], []);
    const sig = byMerchant(caught, 'Side Gig Co');

    expect(sig).toBeDefined();
    expect(sig?.updatesSourceId).toBeUndefined();
  });

  it('when multiple sources exist, only the matching one is offered as the update target', () => {
    const txns = weeklyCredits('Acme Staffing Ltd', 215, '2026-04-06', 4);
    const pay = incomeSource('Pay', { cadence: 'monthly', dayOfMonth: 28, amount: 930 });
    const unrelated = incomeSource('Rent Refund', {
      cadence: 'monthly',
      dayOfMonth: 1,
      amount: 50,
    });

    const caught = findCaughtIncome(txns, [unrelated, pay], []);
    const sig = byMerchant(caught, 'Acme Staffing Ltd');

    expect(sig?.updatesSourceId).toBe(pay.id);
  });
});

describe('sameIncomeMatch — pure amount-only comparison', () => {
  const weeklySignal = (medianAmount: number) => ({
    merchant: 'Acme Staffing Ltd',
    cadence: 'weekly' as const,
    medianAmount,
    occurrences: 4,
    lastSeenISO: '2026-04-27',
    anchorISO: '2026-04-27',
    confidence: 'strong' as const,
  });

  it('weekly £215 (~£931.67/mo) matches a monthly £930 source', () => {
    const source = incomeSource('Pay', { cadence: 'monthly', amount: 930 });
    expect(sameIncomeMatch(weeklySignal(215), source)).toBe(true);
  });

  it('weekly £215 does NOT match an unrelated monthly £2000 source', () => {
    const source = incomeSource('Main Job', { cadence: 'monthly', amount: 2000 });
    expect(sameIncomeMatch(weeklySignal(215), source)).toBe(false);
  });

  it('is symmetric on amount regardless of which side is larger', () => {
    const smallerSource = incomeSource('Pay', { cadence: 'monthly', amount: 900 });
    const largerSource = incomeSource('Pay', { cadence: 'monthly', amount: 960 });
    expect(sameIncomeMatch(weeklySignal(215), smallerSource)).toBe(true);
    expect(sameIncomeMatch(weeklySignal(215), largerSource)).toBe(true);
  });

  it('zero/negative amounts never match (guards divide-by-zero)', () => {
    const source = incomeSource('Pay', { cadence: 'monthly', amount: 0 });
    expect(sameIncomeMatch(weeklySignal(215), source)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Below-threshold / empty inputs — mirrors the engine's own minimums.
// ---------------------------------------------------------------------------
describe('findCaughtIncome — below-threshold and empty inputs', () => {
  it('2 monthly credits (below the engine minimum of 3) -> not caught', () => {
    const txns = monthlyCredits('Too Few Ltd', 1500, '2026-04-01', 2);
    expect(findCaughtIncome(txns, [], [])).toHaveLength(0);
  });

  it('a single isolated credit -> nothing', () => {
    expect(findCaughtIncome([credit('OneOff', 500, '2026-05-01')], [], [])).toHaveLength(0);
  });

  it('empty ledger -> empty result', () => {
    expect(findCaughtIncome([], [], [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Purity + honesty.
// ---------------------------------------------------------------------------
describe('findCaughtIncome — purity + honesty guarantee', () => {
  it('is pure — same input twice is deeply equal and never mutates the inputs', () => {
    const txns = monthlyCredits('Stafflink Payroll', 1800, '2026-04-01', 3);
    const txnsSnapshot = JSON.parse(JSON.stringify(txns));
    const sources = [incomeSource('Acme Ltd')];
    const sourcesSnapshot = JSON.parse(JSON.stringify(sources));

    const a = findCaughtIncome(txns, sources, []);
    const b = findCaughtIncome(txns, sources, []);

    expect(a).toEqual(b);
    expect(txns).toEqual(txnsSnapshot);
    expect(sources).toEqual(sourcesSnapshot);
  });

  it('candidates carry ONLY payment-fact fields — no salary/verdict claim', () => {
    const caught = findCaughtIncome(
      monthlyCredits('Stafflink Payroll', 1800, '2026-04-01', 3),
      [],
      [],
    );
    const sig = byMerchant(caught, 'Stafflink Payroll');
    expect(sig).toBeDefined();

    const allowed = new Set([
      'merchant',
      'cadence',
      'medianAmount',
      'occurrences',
      'lastSeenISO',
      'anchorISO',
      'confidence',
      'updatesSourceId',
    ]);
    for (const k of Object.keys(sig as object)) {
      expect(allowed.has(k)).toBe(true);
    }

    const banned = ['isSalary', 'verdict', 'recommendation', 'budgetAround'];
    const flat = JSON.stringify(sig);
    for (const b of banned) {
      expect(flat.includes(`"${b}":`)).toBe(false);
    }
  });
});
