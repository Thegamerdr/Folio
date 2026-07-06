// Extended caught-signal ORDERING contract — DATA_INTELLIGENCE.md phase ⑥ ("drift ranks BELOW
// income-caught and bill-caught in the one-sheet-per-landing ordering").
//
// Node-safe by design (mirrors caughtBillsOrdering.test.ts's own header note): VisualizerScreen.tsx /
// ReviewScreen.tsx import the react-native runtime and so cannot load under the Node test runner
// (the repo's vitest glob is `apps/**/*.test.ts`). Both screens' post-landing check is a thin,
// deterministic wrapper over exactly this store contract — findCaughtIncome -> findCaughtBills ->
// findDriftCandidates -> findCaughtAnnual, in that order, opening at most one sheet per landing. We
// exercise that exact extended contract directly.

import { beforeEach, describe, expect, it } from 'vitest';

import { addTransactionsBatch, getState, resetAll, setSubs, upsertIncomeSource } from '../store';
import { findCaughtBills } from './caughtBills';
import { findCaughtIncome } from './caughtIncome';
import { findDriftCandidates } from './caughtDrift';
import { findCaughtAnnual } from './caughtAnnual';

/** The exact "which caught-sheet, if any" decision the two screens make after a batch lands,
 *  extended with the two phase ⑥ checks ranked below income/bill (task brief ordering). */
function resolveCaughtSheet():
  | 'income-caught'
  | 'bill-caught'
  | 'drift-caught'
  | 'annual-caught'
  | null {
  const state = getState();
  const incomeSignals = findCaughtIncome(
    state.transactions,
    state.incomeSources ?? [],
    state.dismissedIncomeSignals ?? [],
  );
  if (incomeSignals.length > 0) return 'income-caught';

  const billSignals = findCaughtBills(
    state.transactions,
    state.subs.map((s) => s.name),
    state.dismissedBillSignals ?? [],
  );
  if (billSignals.length > 0) return 'bill-caught';

  const driftSignals = findDriftCandidates(
    state.transactions,
    state.incomeSources ?? [],
    state.subs,
    state.dismissedDriftSignals ?? [],
  );
  if (driftSignals.length > 0) return 'drift-caught';

  const annualSignals = findCaughtAnnual(
    state.transactions,
    state.dismissedAnnualSignals ?? [],
    state.subs.map((s) => s.name),
  );
  if (annualSignals.length > 0) return 'annual-caught';

  return null;
}

type Row = {
  merchant: string;
  amount: number;
  when: string;
  category: 'bills' | 'income';
  source: 'manual';
};

function monthlyRows(
  merchant: string,
  signedPounds: number,
  startIso: string,
  count: number,
): Row[] {
  const rows: Row[] = [];
  const start = new Date(`${startIso}T00:00:00Z`);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(start.getTime() + i * 30 * 86_400_000);
    rows.push({
      merchant,
      amount: signedPounds,
      when: d.toISOString(),
      category: signedPounds > 0 ? 'income' : 'bills',
      source: 'manual',
    });
  }
  return rows;
}

// A dedicated "sink" merchant — exists purely to absorb findCaughtSubs's one-candidate double-propose
// exclusion (see caughtBillsOrdering.test.ts's own identical fixture note) so "Octopus Energy" (the
// merchant under test in the bill-catch fixtures below) is free to surface as a bill candidate rather
// than being excluded as "currently offered as a sub".
const SINK_ROWS = monthlyRows('Zzz Sink Co', -5, '2026-01-01', 3);

beforeEach(() => {
  resetAll();
});

describe('extended ordering — income > bill > drift > annual, one sheet per landing', () => {
  it('a landing that qualifies ONLY for bill drift opens drift-caught (nothing higher fires)', () => {
    // A clean catalog with ONLY the merchant under test — declared at £10, then a landing where the
    // SAME merchant now charges £15 (50% drift, over the 15% threshold). No new-catch signal exists
    // for this merchant (already catalogued), so income-caught/bill-caught both stay empty and only
    // drift-caught qualifies.
    setSubs(() => [
      { name: 'Netflix', cost: 10, nextRenewalDaysAway: 30, lastUsedDaysAgo: 0, usesPerMonth: 0 },
    ]);
    addTransactionsBatch(monthlyRows('Netflix', -15, '2026-01-01', 3));
    expect(resolveCaughtSheet()).toBe('drift-caught');
  });

  it('a landing with BOTH a new bill-catch AND a drift candidate -> bill-caught wins, drift waits', () => {
    setSubs(() => [
      { name: 'Netflix', cost: 10, nextRenewalDaysAway: 30, lastUsedDaysAgo: 0, usesPerMonth: 0 },
    ]);
    // Octopus Energy (a fresh recurring bill, not catalogued) lands FIRST, then the sink batch SECOND
    // — same load-bearing call order as caughtBillsOrdering.test.ts's seedOctopusAsBillCandidate, so
    // the sink (not Octopus Energy) absorbs findCaughtSubs's one-candidate double-propose exclusion.
    addTransactionsBatch(monthlyRows('Octopus Energy', -60, '2026-01-05', 3));
    addTransactionsBatch(SINK_ROWS);
    addTransactionsBatch(monthlyRows('Netflix', -15, '2026-01-01', 3)); // drift candidate
    expect(resolveCaughtSheet()).toBe('bill-caught');
  });

  it('the deferred drift surfaces once the higher-priority bill-catch is resolved', () => {
    setSubs(() => [
      { name: 'Netflix', cost: 10, nextRenewalDaysAway: 30, lastUsedDaysAgo: 0, usesPerMonth: 0 },
    ]);
    addTransactionsBatch(monthlyRows('Octopus Energy', -60, '2026-01-05', 3));
    addTransactionsBatch(SINK_ROWS);
    addTransactionsBatch(monthlyRows('Netflix', -15, '2026-01-01', 3));
    expect(resolveCaughtSheet()).toBe('bill-caught');

    // BillCaughtSheet's own confirm path appends Octopus Energy to the catalog; once catalogued,
    // findCaughtBills no longer offers it, so the drift candidate (still qualifying, untouched) gets
    // its turn on the next evaluation — proving "queues for the next landing", not "lost".
    setSubs((prev) => [
      ...prev,
      {
        name: 'Octopus Energy',
        cost: 60,
        nextRenewalDaysAway: 30,
        lastUsedDaysAgo: 0,
        usesPerMonth: 0,
      },
    ]);
    expect(resolveCaughtSheet()).toBe('drift-caught');
  });

  it('a landing that qualifies ONLY for the annual radar opens annual-caught', () => {
    setSubs(() => []);
    addTransactionsBatch([
      {
        merchant: 'TV Licensing',
        amount: -159,
        when: '2025-04-10T00:00:00.000Z',
        category: 'bills',
        source: 'manual',
      },
      {
        merchant: 'TV Licensing',
        amount: -159,
        when: '2026-04-12T00:00:00.000Z',
        category: 'bills',
        source: 'manual',
      },
    ]);
    expect(resolveCaughtSheet()).toBe('annual-caught');
  });

  it('income still wins over every phase ⑥ signal when both fire the same landing', () => {
    setSubs(() => [
      { name: 'Netflix', cost: 10, nextRenewalDaysAway: 30, lastUsedDaysAgo: 0, usesPerMonth: 0 },
    ]);
    addTransactionsBatch([
      ...monthlyRows('Stafflink Payroll', 1800, '2026-04-01', 3),
      ...monthlyRows('Netflix', -15, '2026-04-05', 3),
    ]);
    expect(resolveCaughtSheet()).toBe('income-caught');
  });

  it('a landing with nothing qualifying anywhere opens nothing', () => {
    setSubs(() => []);
    addTransactionsBatch(monthlyRows('One Off Ltd', -42, '2026-05-01', 1));
    expect(resolveCaughtSheet()).toBeNull();
  });
});
