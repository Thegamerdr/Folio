// Caught-income bridge — turns the income-signal DETECTION engine
// (`detectIncomeSources`, lib/incomeSignals.ts) into the IncomeCaughtSheet's
// candidate shape, gated on: a signal exists, its merchant has no existing
// `IncomeSource`, and the user hasn't already dismissed that merchant.
//
// HONESTY (mirrors caughtSubs.ts / DATA_INTELLIGENCE.md phase ② "propose-and-
// confirm, never silent-write"): this module is payment-facts-only. It maps
// `IncomeSignal` -> `IncomeCaughtCandidate` carrying the merchant, cadence,
// median amount, occurrence count, and confidence — never a "this is your
// salary" verdict, and it never writes to the store itself. The sheet writes
// via `upsertIncomeSource` only on explicit user confirm.
//
// Split discipline (matches caughtSubs.ts): `findCaughtIncome` is pure and
// Node-testable (no react-native, no DOM, no store mutation) — collected by
// the apps/**\/*.test.ts vitest runner via caughtIncome.test.ts. `useCaughtIncome`
// is the thin React hook that wires the live store into that pure function.

import { useMemo } from 'react';

import { useAppStore, bankTransactions, type IncomeSource, type Transaction } from '../store';
import { detectIncomeSources, type IncomeSignal, type IncomeCadence } from './incomeSignals';

// ---------------------------------------------------------------------------
// Candidate shape — what IncomeCaughtSheet renders. Payment facts only:
//   • merchant      — the detected payer's display spelling
//   • cadence       — weekly / fortnightly / four-weekly / monthly (a fact)
//   • medianAmount  — the median credit observed, in GBP (unsigned, a fact)
//   • occurrences   — how many credits contributed to the signal (a fact)
//   • lastSeenISO   — ISO date of the most recent credit (a fact)
//   • anchorISO     — ISO date to seed a new IncomeSource's anchor (a fact —
//                      same value as lastSeenISO; kept as a separate field so
//                      the sheet never has to know that equivalence)
//   • confidence    — 'strong' | 'possible', straight from the engine — NEVER
//                      upgraded/downgraded here. 'possible' is the signal for
//                      the sheet's hedge copy ("amounts vary — check this").
//   • updatesSourceId — set when this candidate is the SAME real income as an
//                      existing declared `IncomeSource` under a different
//                      cadence/amount/label (see `sameIncomeMatch` below) —
//                      e.g. onboarding declared a monthly-equivalent "Pay" but
//                      the ledger shows it actually lands weekly from a named
//                      employer. When set, the sheet proposes an UPDATE to
//                      that source id, never a second, additional one — the
//                      same real income must never become two IncomeSources.
// ---------------------------------------------------------------------------

export type IncomeCaughtCandidate = {
  merchant: string;
  cadence: IncomeCadence;
  medianAmount: number;
  occurrences: number;
  lastSeenISO: string;
  anchorISO: string;
  confidence: IncomeSignal['confidence'];
  updatesSourceId?: string;
};

/** Lowercase + trim a name for comparison — matches the store's
 *  `dismissIncomeSignal` normalisation and `IncomeSource.label` comparisons. */
function normaliseMerchant(raw: string): string {
  return raw.trim().toLowerCase();
}

function toCandidate(signal: IncomeSignal, updatesSourceId?: string): IncomeCaughtCandidate {
  return {
    merchant: signal.merchant,
    cadence: signal.cadence,
    medianAmount: signal.medianAmount,
    occurrences: signal.occurrences,
    lastSeenISO: signal.lastSeenISO,
    anchorISO: signal.anchorISO,
    confidence: signal.confidence,
    ...(updatesSourceId !== undefined ? { updatesSourceId } : {}),
  };
}

// ---------------------------------------------------------------------------
// Same-income matching — a detected signal and a declared `IncomeSource` are
// the SAME real income (not two incomes) when their monthly-equivalent
// amounts are within ±30%, regardless of label. This is what lets onboarding's
// generic "Pay" (declared monthly, amount-only) recognise a later-detected
// named-merchant weekly signal as an update rather than a brand-new source —
// the failure this whole module exists to prevent (see caughtIncome.test.ts
// "same income, different cadence -> update, never a second source").
// ---------------------------------------------------------------------------

/** Nominal weeks-per-month used to normalise a cadence amount onto a common
 *  monthly-equivalent basis. Deliberately the same constants a payslip-style
 *  annualisation would use (52 weeks / 26 fortnights / 13 four-week periods
 *  per year), so the comparison is a fact-level unit conversion, never a
 *  judgement call about which cadence is "really" correct. */
const MONTHLY_EQUIVALENT_FACTOR: Record<IncomeCadence, number> = {
  weekly: 52 / 12,
  fortnightly: 26 / 12,
  'four-weekly': 13 / 12,
  monthly: 1,
};

/** IncomeSource also carries a 'last-working-day' cadence (lib/store.ts) that
 *  IncomeCadence (this engine's output) never produces — treat it as monthly
 *  for the same-income amount comparison, since it is a monthly pay pattern. */
function sourceMonthlyEquivalent(source: IncomeSource): number {
  const factor =
    source.cadence === 'last-working-day' ? 1 : MONTHLY_EQUIVALENT_FACTOR[source.cadence];
  return source.amount * factor;
}

function candidateMonthlyEquivalent(candidate: IncomeSignal): number {
  return candidate.medianAmount * MONTHLY_EQUIVALENT_FACTOR[candidate.cadence];
}

/** ±30% band (as a same-vs-smaller ratio, matching AMOUNT_SPLIT_FACTOR's
 *  convention in incomeSignals.ts): the larger monthly-equivalent must be no
 *  more than this factor times the smaller for the two to count as the same
 *  income. Wider than the engine's own wage-variance tolerance because this
 *  compares two INDEPENDENT sources of truth (onboarding's self-reported
 *  figure vs. the ledger's detected figure), which can legitimately disagree
 *  more than two ledger observations of the same payer would. */
const SAME_INCOME_AMOUNT_FACTOR = 1.3;

/**
 * True when `candidate` and `source` are plausibly the SAME real income
 * (same job/payer, described two different ways) rather than two distinct
 * incomes. Compares monthly-equivalent amounts only — deliberately ignores
 * label, since the whole point is to catch cases where the label differs
 * (onboarding's generic "Pay" vs. a detected employer name).
 *
 * Pure, symmetric, no I/O.
 */
export function sameIncomeMatch(candidate: IncomeSignal, source: IncomeSource): boolean {
  const candidateAmount = candidateMonthlyEquivalent(candidate);
  const sourceAmount = sourceMonthlyEquivalent(source);
  if (candidateAmount <= 0 || sourceAmount <= 0) return false;
  const larger = Math.max(candidateAmount, sourceAmount);
  const smaller = Math.min(candidateAmount, sourceAmount);
  return larger / smaller <= SAME_INCOME_AMOUNT_FACTOR;
}

/** Project a store `Transaction` onto the detector's `IncomeTransaction`
 *  input shape (merchant / amount / date). */
function toIncomeTransaction(txn: Transaction): { merchant: string; amount: number; date: string } {
  return { merchant: txn.merchant, amount: txn.amount, date: txn.when.slice(0, 10) };
}

// ---------------------------------------------------------------------------
// Public pure API.
// ---------------------------------------------------------------------------

/**
 * Run the income-signal detector over the ledger and return signals whose
 * merchant does NOT already have a declared `IncomeSource` under the SAME
 * label, and has NOT been dismissed, mapped to the IncomeCaughtSheet candidate
 * shape. A signal that matches an existing source by label is still dropped
 * (already declared, nothing to offer). A signal that does NOT match by label
 * but IS the same real income by amount (`sameIncomeMatch` — e.g. onboarding's
 * generic "Pay" vs. a detected named employer paying the same real income) is
 * still returned, tagged with `updatesSourceId` so the sheet proposes an
 * UPDATE rather than silently treating it as a second, additional income.
 *
 * Pure + deterministic: never mutates the inputs, same inputs -> same output.
 * Payment facts only (see module header) — no "this is salary" verdict.
 *
 * @param transactions the ledger (store `transactions`)
 * @param existingSources the user's declared income sources (`incomeSources`)
 * @param dismissedMerchants normalised merchant keys the user already said
 *        "not this one" to (store `dismissedIncomeSignals`)
 */
export function findCaughtIncome(
  transactions: readonly Transaction[],
  existingSources: readonly IncomeSource[],
  dismissedMerchants: readonly string[],
): IncomeCaughtCandidate[] {
  if (transactions.length === 0) return [];

  const signals = detectIncomeSources(
    transactions
      .filter(
        (transaction) =>
          transaction.financialAction?.kind !== 'transfer' &&
          transaction.financialAction?.kind !== 'refund',
      )
      .map(toIncomeTransaction),
  );
  if (signals.length === 0) return [];

  const knownLabels = new Set(existingSources.map((s) => normaliseMerchant(s.label)));
  const dismissed = new Set(dismissedMerchants.map(normaliseMerchant));

  return signals
    .filter((s) => !knownLabels.has(normaliseMerchant(s.merchant)))
    .filter((s) => !dismissed.has(normaliseMerchant(s.merchant)))
    .map((s) => {
      const matchedSource = existingSources.find((source) => sameIncomeMatch(s, source));
      return toCandidate(s, matchedSource?.id);
    });
}

// ---------------------------------------------------------------------------
// React hook — wires the live store into the pure detector for the sheet.
// ---------------------------------------------------------------------------

/**
 * Live caught-income candidates derived from the current ledger, excluding
 * any merchant already declared as an income source or already dismissed.
 * Recomputed only when transactions/incomeSources/dismissedIncomeSignals
 * change (so re-renders don't re-run detection).
 *
 * BANK-ONLY (ACCOUNTS_MODEL.md §2.4): detection runs over `bankTransactions(state)`, not
 * `state.transactions` raw — a credit-card refund/transfer must never be caught as bank-side income.
 * Inert on a single-account (migrated) install.
 */
export function useCaughtIncome(): IncomeCaughtCandidate[] {
  const rawTransactions = useAppStore((state) => state.transactions);
  const accounts = useAppStore((state) => state.accounts);
  const incomeSources = useAppStore((state) => state.incomeSources ?? []);
  const dismissedIncomeSignals = useAppStore((state) => state.dismissedIncomeSignals ?? []);
  const transactions = useMemo(
    () => bankTransactions({ transactions: rawTransactions, accounts }),
    [rawTransactions, accounts],
  );

  return useMemo(
    () => findCaughtIncome(transactions, incomeSources, dismissedIncomeSignals),
    [transactions, incomeSources, dismissedIncomeSignals],
  );
}
