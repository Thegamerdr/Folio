// Caught-signal ORDERING contract — DATA_INTELLIGENCE.md phase ⑤(B) "Surface after statement batches
// land — same call sites as income-caught ... income proposal takes precedence if both fire (one
// sheet per landing, bills queue for the next landing)".
//
// Node-safe by design: VisualizerScreen.tsx / ReviewScreen.tsx import the react-native runtime and so
// cannot load under the Node test runner (the repo's vitest glob is `apps/**/*.test.ts`). Both
// screens' post-landing check is a thin, deterministic wrapper over exactly this store contract —
// `findCaughtIncome(...)` then, only if empty, `findCaughtBills(...)` — with no react-native
// dependency in that decision itself (see VisualizerScreen.commit / ReviewScreen.onAdd for the real
// call sites this mirrors). We exercise that exact contract directly.
//
// Also pins BillCaughtSheet's confirm mechanics (writes the same `subs[]` catalog SubCaughtSheet
// writes to — see lib/caughtBills.ts's module-header decision note) and the dismissed-list contract,
// via the same store primitives the sheet itself calls.
//
// FIXTURE NOTE (mirrors caughtBills.test.ts's own header note): `detectRecurring` has no
// subscription-vs-bill distinction, so a ledger with only ONE qualifying merchant makes that
// merchant findCaughtSubs's one candidate — which findCaughtBills's double-propose guard then
// excludes (subs take precedence over the one currently-offered candidate). Every fixture below that
// expects a POSITIVE bill catch includes a fixed "sink" merchant transaction batch to absorb that
// exclusion, so the merchant under test is free to surface.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  addTransactionsBatch,
  dismissBillSignal,
  getState,
  resetAll,
  setSubs,
  upsertIncomeSource,
  type Sub,
} from '../store';
import { findCaughtBills } from './caughtBills';
import { findCaughtIncome } from './caughtIncome';

/** The exact "which caught-sheet, if any" decision the two screens make after a batch lands. */
function resolveCaughtSheet(): 'income-caught' | 'bill-caught' | null {
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

  return null;
}

type Row = {
  merchant: string;
  amount: number;
  when: string;
  category: 'bills' | 'income';
  source: 'manual';
};

/** N monthly rows (~30d apart) of one merchant, signed £ (negative = spend). */
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
// exclusion so "Octopus Energy" (the merchant under test in every bill-positive fixture below) is free
// to surface (see file header note). Its own cadence/amount are irrelevant to the assertions.
const SINK_ROWS = monthlyRows('Zzz Sink Co', -5, '2026-01-01', 3);

/** Lands Octopus Energy's recurring-bill batch FIRST, then the sink batch SECOND. Each
 *  `addTransactionsBatch` call prepends its own rows ahead of everything already stored (newest
 *  landing first — see `addTransactionsBatch`'s doc), so the sink — landed LAST — ends up first in
 *  `transactions` and therefore first in `groupByMerchant`'s iteration order, making it
 *  findCaughtSubs's `caught[0]` (the merchant SubCaughtSheet would currently show). The double-propose
 *  guard then excludes the SINK, not Octopus Energy — leaving Octopus Energy free to surface as the
 *  one real bill candidate under test. Call-order here is load-bearing; do not reorder. */
function seedOctopusAsBillCandidate(): void {
  addTransactionsBatch(monthlyRows('Octopus Energy', -118.4, '2026-04-01', 3));
  addTransactionsBatch(SINK_ROWS);
}

beforeEach(() => {
  resetAll();
});

describe('caught-sheet ordering — income takes precedence over bills on the same landing', () => {
  it('a landing with ONLY a qualifying bill signal opens bill-caught', () => {
    seedOctopusAsBillCandidate();
    expect(resolveCaughtSheet()).toBe('bill-caught');
  });

  it('a landing with ONLY a qualifying income signal opens income-caught', () => {
    addTransactionsBatch(monthlyRows('Stafflink Payroll', 1800, '2026-04-01', 3));
    expect(resolveCaughtSheet()).toBe('income-caught');
  });

  it('a landing with BOTH qualifying → income wins; the bill is never surfaced this landing', () => {
    addTransactionsBatch([
      ...monthlyRows('Stafflink Payroll', 1800, '2026-04-01', 3),
      ...monthlyRows('Octopus Energy', -118.4, '2026-04-05', 3),
    ]);
    expect(resolveCaughtSheet()).toBe('income-caught');
  });

  it('the deferred bill surfaces once the income signal no longer qualifies (next re-evaluation)', () => {
    addTransactionsBatch([
      ...SINK_ROWS,
      ...monthlyRows('Stafflink Payroll', 1800, '2026-04-01', 3),
      ...monthlyRows('Octopus Energy', -118.4, '2026-04-05', 3),
    ]);
    expect(resolveCaughtSheet()).toBe('income-caught');

    // IncomeCaughtSheet's own confirm path declares the source (upsertIncomeSource); once declared,
    // findCaughtIncome no longer offers it (its own "no existing IncomeSource" gate). Nothing was
    // lost for the bill in the meantime — it simply re-evaluates fresh and now gets its turn, proving
    // "queues for the next landing" rather than "silently dropped".
    upsertIncomeSource({
      id: 'income-stafflink',
      label: 'Stafflink Payroll',
      cadence: 'monthly',
      dayOfMonth: 1,
      amount: 1800,
      source: 'inferred',
    });
    expect(resolveCaughtSheet()).toBe('bill-caught');
  });

  it('a landing with NEITHER qualifying opens nothing', () => {
    // Too few occurrences for either engine's minimum.
    addTransactionsBatch(monthlyRows('One Off Ltd', -42, '2026-05-01', 1));
    expect(resolveCaughtSheet()).toBeNull();
  });
});

describe('BillCaughtSheet confirm — writes the same subs[] catalog SubCaughtSheet writes to', () => {
  it('confirming a caught bill appends a Sub with the candidate name + amount', () => {
    seedOctopusAsBillCandidate();
    const candidate = findCaughtBills(
      getState().transactions,
      getState().subs.map((s) => s.name),
      getState().dismissedBillSignals ?? [],
    ).find((c) => c.name === 'Octopus Energy');
    expect(candidate).toBeDefined();

    // The sheet's exact confirm() write (see BillCaughtSheet.tsx).
    const newSub: Sub = {
      name: candidate!.name,
      cost: candidate!.amount,
      nextRenewalDaysAway: 30,
      lastUsedDaysAgo: 0,
      usesPerMonth: 0,
    };
    setSubs((prev) => [...prev, newSub]);

    const subs = getState().subs;
    expect(subs.some((s) => s.name === 'Octopus Energy' && s.cost === candidate!.amount)).toBe(
      true,
    );
  });

  it('once confirmed as a sub, the same merchant no longer surfaces from findCaughtBills', () => {
    seedOctopusAsBillCandidate();
    setSubs((prev) => [
      ...prev,
      {
        name: 'Octopus Energy',
        cost: 118.4,
        nextRenewalDaysAway: 30,
        lastUsedDaysAgo: 0,
        usesPerMonth: 0,
      },
    ]);

    const stillCaughtAsBill = findCaughtBills(
      getState().transactions,
      getState().subs.map((s) => s.name),
      [],
    );
    expect(stillCaughtAsBill.find((c) => c.name === 'Octopus Energy')).toBeUndefined();
  });
});

describe('BillCaughtSheet dismiss — remembered across a later detection pass', () => {
  it('dismissing a bill signal keeps it out of findCaughtBills on a subsequent evaluation', () => {
    seedOctopusAsBillCandidate();
    let caught = findCaughtBills(
      getState().transactions,
      getState().subs.map((s) => s.name),
      getState().dismissedBillSignals ?? [],
    );
    expect(caught.find((c) => c.name === 'Octopus Energy')).toBeDefined();

    dismissBillSignal('Octopus Energy');

    // A later landing adds more transactions to the same merchant — still suppressed.
    addTransactionsBatch(monthlyRows('Octopus Energy', -118.4, '2026-07-01', 1));
    caught = findCaughtBills(
      getState().transactions,
      getState().subs.map((s) => s.name),
      getState().dismissedBillSignals ?? [],
    );
    expect(caught.find((c) => c.name === 'Octopus Energy')).toBeUndefined();
  });
});
