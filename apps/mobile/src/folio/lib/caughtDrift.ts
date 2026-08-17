// Caught-drift bridge — DATA_INTELLIGENCE.md phase ⑥ "history-fed forecasts", the confirmation
// surface for lib/driftSignals.ts's two DETECTION checks (income drift + bill drift). Mirrors
// caughtBills.ts / caughtIncome.ts's own split discipline: a pure, Node-testable candidate builder
// plus a thin React hook that wires the live store into it.
//
// ONE SHEET, TWO FLAVOURS (task brief: "one generic pattern, two flavors"): `DriftCaughtCandidate`
// carries a `kind: 'income' | 'bill'` tag so DriftCaughtSheet can render a single component with two
// copy/write branches, instead of two near-duplicate sheets. This mirrors how BillCaughtSheet and
// SubCaughtSheet already read as siblings off the same shape — the drift sheet takes that one step
// further since income-drift and bill-drift really are the same UX ("here's a number that moved,
// update it or don't"), not two different concepts.
//
// HONESTY (mirrors every other caught-* bridge): payment-facts-only, propose-and-confirm. This module
// never writes to the store — DriftCaughtSheet's confirm does that, via `upsertIncomeSource`/`setSubs`.
//
// ORDERING (task brief: "drift ranks BELOW income-caught and bill-caught in the one-sheet-per-landing
// ordering"): this module does not enforce that itself — the two call sites
// (ReviewScreen.onAdd / VisualizerScreen.commit) check findCaughtIncome -> findCaughtBills ->
// findDriftCandidates in that order, opening at most one sheet per landing. See those call sites for
// the extended ordering comment.
//
// PER-MERCHANT RE-PROPOSE COOLDOWN (task: "drift thrash" fix): a NOISY signal (e.g. pay that wobbles
// ±10-14% week to week) can cross the 15% detection threshold, get confirmed or dismissed, then drift
// back across the threshold again on the next landing — re-proposing endlessly for a merchant the user
// already dealt with. `dismissedDriftSignals` (store.ts) now carries `{ merchant, at }` cooldown
// entries (written by BOTH `confirmDriftSignal` and `dismissDriftSignal` — either action means "I just
// dealt with this") instead of a bare dismissed-merchant list. `findDriftCandidates` suppresses a
// merchant for `DRIFT_COOLDOWN_DAYS` after its most recent entry UNLESS the CURRENT deviation exceeds
// `DRIFT_COOLDOWN_BREAKTHROUGH_FRACTION` — a genuinely large new change (a real price rise, a real pay
// change) still surfaces immediately rather than being silenced by a cooldown meant for noise. Detection
// itself is unchanged and keeps re-checking every landing BY DESIGN (this module never stops running the
// detector) — the cooldown only gates whether a qualifying signal is SURFACED as a candidate.

import { useMemo } from 'react';

import {
  useAppStore,
  bankAnalyticsTransactions,
  type DriftCooldownEntry,
  type IncomeSource,
  type Sub,
  type Transaction,
} from '../store';
import {
  detectBillDrift,
  detectIncomeDrift,
  fractionalDeviation,
  type BillDriftSignal,
  type DriftIncomeSource,
  type IncomeDriftSignal,
} from './driftSignals';
import type { Charge } from './subSignals';
import type { IncomeTransaction } from './incomeSignals';

// ---------------------------------------------------------------------------
// Candidate shape — one generic shape for both flavours. Fields that only
// apply to one flavour are optional; DriftCaughtSheet branches on `kind`.
// ---------------------------------------------------------------------------

export type DriftCaughtCandidate =
  | {
      kind: 'income';
      /** The IncomeSource id this candidate would UPDATE in place (never a new source). */
      sourceId: string;
      merchant: string;
      reason: IncomeDriftSignal['reason'];
      storedAmount: number;
      detectedAmount: number;
      storedCadence?: DriftIncomeSource['cadence'];
      detectedCadence?: IncomeDriftSignal['detectedCadence'];
    }
  | {
      kind: 'bill';
      /** The Sub name this candidate would UPDATE in place (matched by name — Subs have no id). */
      merchant: string;
      storedAmount: number;
      detectedAmount: number;
      lastSeenISO: string;
    };

/** Project a store `IncomeSource` onto the drift engine's minimal input shape. */
function toDriftIncomeSource(source: IncomeSource): DriftIncomeSource {
  return {
    id: source.id,
    label: source.label,
    cadence: source.cadence === 'last-working-day' ? 'monthly' : source.cadence,
    amount: source.amount,
    source: source.source,
  };
}

/** Project a store `Transaction` onto the drift engine's income-transaction input shape. */
function toIncomeTransaction(txn: Transaction): IncomeTransaction {
  return { merchant: txn.merchant, amount: txn.amount, date: txn.when.slice(0, 10) };
}

/** Project a store `Transaction` onto the drift engine's charge input shape. */
function toCharge(txn: Transaction): Charge {
  return { merchant: txn.merchant, amount: txn.amount, date: txn.when.slice(0, 10) };
}

function normaliseMerchant(raw: string): string {
  return raw.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Per-merchant re-propose cooldown (task: "drift thrash" fix) — see module header.
// ---------------------------------------------------------------------------

/** How long a merchant stays quiet after its drift was confirmed or dismissed. */
const DRIFT_COOLDOWN_DAYS = 45;
const DRIFT_COOLDOWN_MS = DRIFT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

/** A deviation at or above this fraction is a "big real change" and breaks through the cooldown even
 *  while a merchant is otherwise quiet — see module header. Deliberately double the 15%
 *  `DRIFT_THRESHOLD_FRACTION` detection floor (driftSignals.ts), so this is a distinct, HIGHER bar:
 *  every cooldown-covered candidate already cleared the 15% floor to be detected at all; only a
 *  materially larger swing on top of that should override a cooldown the user just set. */
const DRIFT_COOLDOWN_BREAKTHROUGH_FRACTION = 0.3;

/** Whether `merchant` is currently within its cooldown window, given `entries` (store
 *  `dismissedDriftSignals`) and `now` (defaults to the real clock; a param only for deterministic
 *  testing, mirroring this codebase's other `now`-parameterised pure engines). */
function isCoolingDown(
  merchant: string,
  entries: readonly DriftCooldownEntry[],
  now: number,
): boolean {
  const key = normaliseMerchant(merchant);
  const entry = entries.find((e) => e.merchant === key);
  if (entry === undefined) return false;
  const at = Date.parse(entry.at);
  if (Number.isNaN(at)) return false;
  return now - at < DRIFT_COOLDOWN_MS;
}

function toIncomeCandidate(signal: IncomeDriftSignal): DriftCaughtCandidate {
  return {
    kind: 'income',
    sourceId: signal.sourceId,
    merchant: signal.label,
    reason: signal.reason,
    storedAmount: signal.storedAmount,
    detectedAmount: signal.detectedAmount,
    ...(signal.storedCadence !== undefined ? { storedCadence: signal.storedCadence } : {}),
    ...(signal.detectedCadence !== undefined ? { detectedCadence: signal.detectedCadence } : {}),
  };
}

function toBillCandidate(signal: BillDriftSignal): DriftCaughtCandidate {
  return {
    kind: 'bill',
    merchant: signal.name,
    storedAmount: signal.storedCost,
    detectedAmount: signal.detectedCost,
    lastSeenISO: signal.lastSeen,
  };
}

// ---------------------------------------------------------------------------
// Public pure API.
// ---------------------------------------------------------------------------

/**
 * Run BOTH drift detectors (income-amount/cadence drift, bill/price-rise drift) over the live data
 * and return every candidate not currently COOLING DOWN, income first then bills (an arbitrary but
 * stable order — callers only ever consume `[0]`, mirroring every sibling caught-* bridge's
 * "resolved = caught[0]" convention).
 *
 * COOLDOWN (task: "drift thrash" fix — see module header): a merchant with a cooldown entry (confirmed
 * or dismissed within the last `DRIFT_COOLDOWN_DAYS`) is suppressed UNLESS its current deviation
 * exceeds `DRIFT_COOLDOWN_BREAKTHROUGH_FRACTION` — computed on the SAME monthly-equivalent /
 * unsigned-cost footing `detectIncomeDrift`/`detectBillDrift` already used to classify it as drift at
 * all, via the shared `fractionalDeviation` helper (driftSignals.ts). Detection itself never stops
 * running (this module still calls both detectors every time) — the cooldown only gates whether a
 * qualifying signal is SURFACED as a candidate, so a cooled-down merchant simply re-evaluates fresh
 * once the window lapses, exactly like every other deferred caught-* check in this codebase.
 *
 * Pure + deterministic: never mutates the inputs, same inputs -> same output.
 *
 * @param transactions the ledger (store `transactions`)
 * @param incomeSources the user's declared income sources (`incomeSources`)
 * @param subs the recurring-outflow catalog (`subs`)
 * @param cooldownEntries per-merchant confirm/dismiss cooldown log (store `dismissedDriftSignals`)
 * @param now epoch ms; defaults to the real clock — a param only for deterministic testing
 */
export function findDriftCandidates(
  transactions: readonly Transaction[],
  incomeSources: readonly IncomeSource[],
  subs: readonly Sub[],
  cooldownEntries: readonly DriftCooldownEntry[] = [],
  now: number = Date.now(),
): DriftCaughtCandidate[] {
  if (transactions.length === 0) return [];

  const cooling = (merchant: string) => isCoolingDown(merchant, cooldownEntries, now);

  const incomeSignals = detectIncomeDrift(
    incomeSources.map(toDriftIncomeSource),
    transactions.map(toIncomeTransaction),
  ).filter((s) => {
    if (!cooling(s.label)) return true;
    // Cooling down — only a deviation past the (higher) breakthrough bar overrides it. Recompute on
    // the same monthly-equivalent footing the detector itself compared on: a cadence-only signal (no
    // amount deviation) never breaks through on amount alone, mirroring the detector's own reasoning.
    return (
      fractionalDeviation(s.detectedAmount, s.storedAmount) > DRIFT_COOLDOWN_BREAKTHROUGH_FRACTION
    );
  });

  const billSignals = detectBillDrift(
    subs.map((s) => ({ name: s.name, cost: s.cost })),
    transactions.map(toCharge),
  ).filter((s) => {
    if (!cooling(s.name)) return true;
    return fractionalDeviation(s.detectedCost, s.storedCost) > DRIFT_COOLDOWN_BREAKTHROUGH_FRACTION;
  });

  return [...incomeSignals.map(toIncomeCandidate), ...billSignals.map(toBillCandidate)];
}

// ---------------------------------------------------------------------------
// React hook — wires the live store into the pure detector for the sheet.
// ---------------------------------------------------------------------------

/** Live drift candidates derived from the current ledger + declared sources + sub catalog, excluding
 *  anything currently cooling down (see `findDriftCandidates`'s cooldown doc). Recomputed only when
 *  those slices change — `now` is read fresh on each computation (module default), same as every
 *  other live-clock caught-* hook in this codebase.
 *
 *  BANK-ONLY (ACCOUNTS_MODEL.md §2.4): both detectors run over `bankTransactions(state)` — a
 *  credit-card's income/bill drift shouldn't be caught as a bank-side drift signal. Inert on a
 *  single-account (migrated) install. */
export function useCaughtDrift(): DriftCaughtCandidate[] {
  const rawTransactions = useAppStore((state) => state.transactions);
  const accounts = useAppStore((state) => state.accounts);
  const incomeSources = useAppStore((state) => state.incomeSources ?? []);
  const subs = useAppStore((state) => state.subs);
  const dismissedDriftSignals = useAppStore((state) => state.dismissedDriftSignals ?? []);
  const transactions = useMemo(
    () => bankAnalyticsTransactions({ transactions: rawTransactions, accounts }),
    [rawTransactions, accounts],
  );

  return useMemo(
    () => findDriftCandidates(transactions, incomeSources, subs, dismissedDriftSignals),
    [transactions, incomeSources, subs, dismissedDriftSignals],
  );
}
