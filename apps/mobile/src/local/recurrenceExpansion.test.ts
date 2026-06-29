import { describe, expect, it } from 'vitest';

import {
  buildLocalRouteSummary,
  createEmptyLocalLedgerState,
  type LocalLedgerState,
  type LocalLedgerTransaction,
} from './localLedger.js';

// Pins FIX 1: a transaction marked monthly/weekly carries its recurrence, but the route used to
// include only the single stored occurrence — so the projected balance and tightest point silently
// stopped including a recurring salary or rent after the first cycle. The route now expands each
// recurring transaction into its future occurrences across the horizon. These tests construct a
// multi-cycle picture whose true tightest point lives in a LATER cycle and so FAIL against the old
// non-expanding builder (which would only ever see one rent and one salary).

const asOf = '2026-06-28';

function dayString(daysAfter: number): string {
  const base = Date.parse(`${asOf}T00:00:00.000Z`);
  return new Date(base + daysAfter * 86_400_000).toISOString().slice(0, 10);
}

function confirmedTransaction(
  partial: Pick<LocalLedgerTransaction, 'id' | 'title' | 'amountMinor' | 'date'> &
    Partial<LocalLedgerTransaction>,
): LocalLedgerTransaction {
  return {
    source: 'manual',
    status: 'confirmed',
    protected: false,
    certainty: 'expected',
    ...partial,
  };
}

function ledgerWith(
  cashOnHandMinor: number,
  transactions: readonly LocalLedgerTransaction[],
): LocalLedgerState {
  return {
    ...createEmptyLocalLedgerState(asOf),
    cashOnHandMinor,
    transactions,
  };
}

describe('recurrence expansion across multiple cycles', () => {
  it('keeps including a monthly salary and rent in every cycle to the horizon', () => {
    // Cash £900. Each cycle: rent -£800 (D+10, +1 month, +2 months ...), then salary +£850
    // (D+20, ...). Because rent lands before the matching salary, the balance dips by £800 every
    // month and only recovers £50 net per cycle. The lowest point is therefore reached just after
    // the THIRD rent (~D+70), not the first. Non-expanding code sees only the first rent and first
    // salary, so it would report the first dip (£100) as the tightest and miss the real squeeze.
    const ledger = ledgerWith(90_000, [
      confirmedTransaction({
        id: 'rent',
        title: 'Rent',
        amountMinor: -80_000,
        date: dayString(10),
        repeats: 'monthly',
      }),
      confirmedTransaction({
        id: 'salary',
        title: 'Salary',
        amountMinor: 85_000,
        date: dayString(20),
        repeats: 'monthly',
      }),
    ]);

    const route = buildLocalRouteSummary(ledger);

    // Three rents and three salaries should now exist on the route (plus Today), so the dated route
    // points are far more than the two stored transactions.
    const datedDeltas = route.points.filter((point) => point.deltaMinor !== 0).length;
    expect(datedDeltas).toBeGreaterThanOrEqual(6);

    // The true tightest point is after the third rent: 90_000 then -800/+850 each cycle.
    // Cycle 1: after rent 10_000, after salary 95_000.
    // Cycle 2: after rent 15_000, after salary 100_000.
    // Cycle 3: after rent 20_000, after salary 105_000.
    // The lowest balance anywhere is 10_000 (first rent dip) — but the picture must still SHOW all
    // three cycles. Assert the final projected balance reflects three net +£50 cycles, which is only
    // possible if every occurrence was expanded.
    const finalBalance = route.points[route.points.length - 1]?.balanceMinor;
    expect(finalBalance).toBe(105_000);

    // confirmedTransactionCount stays honest — it counts the two records the user actually stored,
    // not the projected future occurrences.
    expect(route.confirmedTransactionCount).toBe(2);
  });

  it('drives the tightest point into a later cycle when each cycle loses money', () => {
    // Cash £250. Rent -£100 monthly at D+5; salary +£90 monthly at D+25. Net -£10 per cycle, and
    // each cycle the rent dip is £10 lower than the last. The tightest point therefore marches into
    // the third cycle. Non-expanding code only sees the first £150 dip and reports a too-high (too
    // reassuring) tightest balance.
    const ledger = ledgerWith(25_000, [
      confirmedTransaction({
        id: 'rent2',
        title: 'Rent',
        amountMinor: -10_000,
        date: dayString(5),
        repeats: 'monthly',
      }),
      confirmedTransaction({
        id: 'salary2',
        title: 'Salary',
        amountMinor: 9_000,
        date: dayString(25),
        repeats: 'monthly',
      }),
    ]);

    const route = buildLocalRouteSummary(ledger);

    // Cycle 1 rent: 15_000. Cycle 2 rent (after +9000 salary -> 24_000, then -10_000): 14_000.
    // Cycle 3 rent (24_000 - 1000 net ... ) the running low keeps dropping by 1_000 per cycle.
    // The tightest must be below the first-cycle dip of 15_000.
    expect(route.tightestBalanceMinor).toBeLessThan(15_000);
  });

  it('expands a weekly income across many weeks', () => {
    // Weekly income should produce roughly a dozen occurrences across the 95-day horizon, not one.
    const ledger = ledgerWith(0, [
      confirmedTransaction({
        id: 'weekly-pay',
        title: 'Weekly pay',
        amountMinor: 10_000,
        date: dayString(7),
        repeats: 'weekly',
      }),
    ]);

    const route = buildLocalRouteSummary(ledger);

    const incomePoints = route.points.filter((point) => point.deltaMinor === 10_000).length;
    // 95 days from D0 -> first occurrence D+7, then weekly up to ~D+91 ≈ 13 occurrences.
    expect(incomePoints).toBeGreaterThanOrEqual(10);

    // Final projected balance is the sum of all expanded weekly incomes.
    const finalBalance = route.points[route.points.length - 1]?.balanceMinor ?? 0;
    expect(finalBalance).toBe(incomePoints * 10_000);
  });

  it('does not double-count: a non-repeating transaction stays a single occurrence', () => {
    const ledger = ledgerWith(50_000, [
      confirmedTransaction({
        id: 'one-off',
        title: 'One-off bill',
        amountMinor: -20_000,
        date: dayString(9),
      }),
    ]);

    const route = buildLocalRouteSummary(ledger);

    const dated = route.points.filter((point) => point.deltaMinor !== 0);
    expect(dated).toHaveLength(1);
    expect(route.points[route.points.length - 1]?.balanceMinor).toBe(30_000);
  });
});
