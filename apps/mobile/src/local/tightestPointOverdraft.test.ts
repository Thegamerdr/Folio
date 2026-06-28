import { describe, expect, it } from 'vitest';

import {
  buildLocalRouteSummary,
  createEmptyLocalLedgerState,
  type LocalLedgerState,
  type LocalLedgerTransaction,
} from './localLedger.js';

// Pins FIX 1: the Today hero must not hide a current overdraft. tightestPointFromRoute used to drop
// point0 (today's opening balance) via points.slice(1) whenever a later point existed, so an
// overdrawn-today-then-paid-later picture reported a positive tightest and a falsely reassuring
// "your money lasts" verdict. The tightest must be the lowest balance ANYWHERE on the route,
// including today. This test fails against the old slice(1).

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

describe('tightestPointFromRoute includes today (overdraft is not hidden)', () => {
  it('reports an overdrawn-today balance as the tightest, dated today', () => {
    // Cash -£50 today, a £1000 payday at D+14, no protected bills. The opening (today) balance is
    // the tightest point of the whole route — the later payday must not let it be dropped.
    const ledger = ledgerWith(-5000, [
      confirmedTransaction({
        id: 'payday-future',
        title: 'Payday',
        amountMinor: 100_000,
        date: dayString(14),
      }),
    ]);

    const route = buildLocalRouteSummary(ledger);

    expect(route.tightestBalanceMinor).toBe(-5000);
    expect(route.tightestDay).toBe('Today');
  });

  it('still finds a normal mid-window dip (no regression on the common case)', () => {
    // Cash £50, an £80 spend at D+4 dips the route to -£30, a £200 income at D+9 recovers it.
    const ledger = ledgerWith(5000, [
      confirmedTransaction({
        id: 'spend-dip',
        title: 'Big spend',
        amountMinor: -8000,
        date: dayString(4),
      }),
      confirmedTransaction({
        id: 'income-recover',
        title: 'Income',
        amountMinor: 20_000,
        date: dayString(9),
      }),
    ]);

    const route = buildLocalRouteSummary(ledger);

    expect(route.tightestBalanceMinor).toBe(-3000);
    // The dip day (D+4), not Today, is the tightest here.
    expect(route.tightestDay).not.toBe('Today');
  });
});
