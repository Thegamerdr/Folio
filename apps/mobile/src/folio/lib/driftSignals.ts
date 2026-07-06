// Drift-signal DETECTION engine — DATA_INTELLIGENCE.md phase ⑥ "history-fed
// forecasts", items 3 (bill-drift) + the drift re-check folded in from phase ②.
//
// Pure, deterministic, no I/O, no react-native imports, no UI. A plain TS
// module collected by the apps/**\/*.test.ts vitest runner via its colocated
// driftSignals.test.ts. Zero folio imports (no `../store` runtime import,
// type-only imports are fine and erased at build time) — mirrors
// subSignals.ts / incomeSignals.ts's own "no folio runtime dependency"
// discipline so this stays independently testable.
//
// DETECTION ONLY, same honesty rule as subSignals.ts / incomeSignals.ts: a
// drift signal reports a FACT about a delta between a stored/declared number
// and what the live transaction history currently shows. It never asserts a
// verdict ("cancel this", "you're being overcharged", "renegotiate") — only
// the observed deviation, so a confirmation surface (mirroring
// SubCaughtSheet's propose-and-confirm pattern) can decide what to do with it.

import { detectIncomeSources, type IncomeTransaction } from './incomeSignals';
import { detectRecurring, type Charge } from './subSignals';

// ---------------------------------------------------------------------------
// Shared tuning.
// ---------------------------------------------------------------------------

/** Both drift checks below use the same "more than 15% off" threshold — the
 *  brief's stated band for both income-amount drift and bill/price-rise
 *  drift. Kept as one constant so the two checks can never silently diverge. */
const DRIFT_THRESHOLD_FRACTION = 0.15;

/** Exported so `lib/caughtDrift.ts` can reuse the EXACT same deviation math for its cooldown
 *  break-through check (task: "drift thrash" fix) — one formula, never a second parallel one. */
export function fractionalDeviation(observed: number, stored: number): number {
  if (stored === 0) return observed === 0 ? 0 : Infinity;
  return Math.abs(observed - stored) / Math.abs(stored);
}

// ---------------------------------------------------------------------------
// Income drift.
// ---------------------------------------------------------------------------

/** The minimal income-source shape this module needs — mirrors the store's
 *  `IncomeSource` fields it actually reads. Kept local (same convention as
 *  historyStats.ts's `HistoryTransaction`) so this stays a standalone,
 *  dependency-free module. */
export type DriftIncomeSource = {
  id: string;
  label: string;
  cadence: 'monthly' | 'weekly' | 'fortnightly' | 'four-weekly' | 'last-working-day';
  amount: number;
  source: 'onboarding' | 'inferred' | 'manual';
};

/** A merchant string paired with its signed amount + date, close enough to
 *  `IncomeTransaction` to feed `detectIncomeSources` directly. */
export type DriftTransaction = IncomeTransaction;

export type IncomeDriftReason = 'amount' | 'cadence' | 'amount-and-cadence';

/**
 * A detected deviation between a declared/inferred `IncomeSource` and what
 * the live transaction history currently shows for that source's merchant.
 * Facts only — no "update this" instruction; a confirmation surface decides
 * what to do with it (mirrors `RecurringSignal` / `IncomeSignal`'s honesty
 * discipline — see module header).
 */
export type IncomeDriftSignal = {
  sourceId: string;
  label: string;
  reason: IncomeDriftReason;
  /** The amount currently stored on the `IncomeSource`. */
  storedAmount: number;
  /** The amount the live detector currently observes for this merchant. */
  detectedAmount: number;
  /** Present only when `reason` includes 'cadence'. */
  storedCadence?: DriftIncomeSource['cadence'];
  detectedCadence?: 'weekly' | 'fortnightly' | 'four-weekly' | 'monthly';
};

/** Cadence vocabularies differ slightly between `IncomeSource` (store) and
 *  `IncomeSignal` (detector — no 'last-working-day', since that cadence
 *  isn't a fixed period a detector could re-derive from credit gaps). Maps
 *  the store's cadence onto the detector's, or `null` when there is no
 *  detector equivalent (so a stored 'last-working-day' source is compared on
 *  amount only, never flagged for a "cadence changed" it structurally cannot
 *  be re-detected against). */
function toDetectorCadence(
  cadence: DriftIncomeSource['cadence'],
): 'weekly' | 'fortnightly' | 'four-weekly' | 'monthly' | null {
  if (cadence === 'last-working-day') return null;
  return cadence;
}

/** Occurrences per calendar month, nominal — used to put a per-occurrence
 *  amount onto a common monthly-equivalent footing before comparing across
 *  cadences (an `IncomeSource.amount` is "per occurrence at its OWN declared
 *  cadence", e.g. a weekly source's `amount` is the per-week figure, so a
 *  raw amount-vs-amount compare against a monthly-cadence detected signal
 *  would spuriously read as a huge amount deviation whenever ONLY the
 *  cadence changed). `last-working-day` is monthly-equivalent (one
 *  occurrence per month). */
const OCCURRENCES_PER_MONTH: Record<
  'weekly' | 'fortnightly' | 'four-weekly' | 'monthly' | 'last-working-day',
  number
> = {
  weekly: 4.33,
  fortnightly: 2.166,
  'four-weekly': 1.0825,
  monthly: 1,
  'last-working-day': 1,
};

/** Monthly-equivalent total for a per-occurrence amount at the given cadence.
 *  Exported so other callers needing an `IncomeSource`-cadence-aware monthly
 *  footing (e.g. `MeloChatSheet`'s live-snapshot income figure) reuse this
 *  EXACT table rather than re-deriving a second, potentially-diverging one —
 *  this is the only cadence table that already covers all five `IncomeSource`
 *  cadences including `last-working-day`. */
export function monthlyEquivalent(
  amountPerOccurrence: number,
  cadence: DriftIncomeSource['cadence'] | 'weekly' | 'fortnightly' | 'four-weekly' | 'monthly',
): number {
  return amountPerOccurrence * OCCURRENCES_PER_MONTH[cadence];
}

/**
 * For each `IncomeSource` whose `source` is `'inferred'` or `'onboarding'`
 * (i.e. not a manually hand-entered figure — a `'manual'` source is the
 * user's own explicit number and is never second-guessed against detection),
 * re-run the live income-detection engine (`detectIncomeSources`) over
 * `transactions` for that source's merchant/label and compare:
 *
 *   - `reason: 'amount'`     — the detected median amount deviates more than
 *     `DRIFT_THRESHOLD_FRACTION` (15%) from the stored amount, cadence matches.
 *   - `reason: 'cadence'`    — the detector now classifies a DIFFERENT cadence
 *     for the same merchant, amount within tolerance.
 *   - `reason: 'amount-and-cadence'` — both differ.
 *
 * A source with no matching detected signal at all (the merchant no longer
 * clears the detector's occurrence/cadence thresholds) produces NO signal —
 * that is a "went quiet" fact, out of scope for this drift check (see
 * `subSignals.ts`'s `wentQuiet` for the analogous concept on the spend side).
 *
 * Pure: never mutates `sources` or `transactions`.
 */
export function detectIncomeDrift(
  sources: readonly DriftIncomeSource[],
  transactions: readonly DriftTransaction[],
): IncomeDriftSignal[] {
  const candidateSources = sources.filter(
    (s) => s.source === 'inferred' || s.source === 'onboarding',
  );
  if (candidateSources.length === 0) return [];

  const signals = detectIncomeSources(transactions);
  const signalsByMerchant = new Map<string, (typeof signals)[number]>();
  for (const signal of signals) {
    // Multiple clusters can exist per merchant (e.g. two amount tiers); keep
    // the one with the most occurrences as the representative match — the
    // most-observed pattern is the more likely match for a declared source.
    const existing = signalsByMerchant.get(normaliseLabel(signal.merchant));
    if (existing === undefined || signal.occurrences > existing.occurrences) {
      signalsByMerchant.set(normaliseLabel(signal.merchant), signal);
    }
  }

  const results: IncomeDriftSignal[] = [];
  for (const source of candidateSources) {
    const matched = signalsByMerchant.get(normaliseLabel(source.label));
    if (matched === undefined) continue;

    // Compare on a MONTHLY-EQUIVALENT footing, not the raw per-occurrence
    // amounts directly — `source.amount` is per-occurrence at the source's
    // OWN declared cadence (e.g. a weekly source's amount is a per-week
    // figure), so a raw compare against a detected signal at a DIFFERENT
    // cadence would spuriously read as a huge amount deviation whenever only
    // the cadence changed (a £470/week source is £2036/month-equivalent,
    // correctly close to a stored £2000/month source).
    const storedMonthlyEquivalent = monthlyEquivalent(source.amount, source.cadence);
    const detectedMonthlyEquivalent = monthlyEquivalent(matched.medianAmount, matched.cadence);
    const amountDeviated =
      fractionalDeviation(detectedMonthlyEquivalent, storedMonthlyEquivalent) >
      DRIFT_THRESHOLD_FRACTION;
    const expectedDetectorCadence = toDetectorCadence(source.cadence);
    const cadenceChanged =
      expectedDetectorCadence !== null && matched.cadence !== expectedDetectorCadence;

    if (!amountDeviated && !cadenceChanged) continue;

    const reason: IncomeDriftReason =
      amountDeviated && cadenceChanged
        ? 'amount-and-cadence'
        : amountDeviated
          ? 'amount'
          : 'cadence';

    const signal: IncomeDriftSignal = {
      sourceId: source.id,
      label: source.label,
      reason,
      storedAmount: source.amount,
      detectedAmount: matched.medianAmount,
    };
    if (cadenceChanged) {
      signal.storedCadence = source.cadence;
      signal.detectedCadence = matched.cadence;
    }
    results.push(signal);
  }
  return results;
}

function normaliseLabel(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,_·-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Bill drift (price-rise class).
// ---------------------------------------------------------------------------

/** The minimal sub/bill-catalog shape this module needs — mirrors the
 *  store's `Sub` fields it actually reads. */
export type DriftCatalogEntry = {
  name: string;
  cost: number;
};

export type BillDriftSignal = {
  name: string;
  /** The cost currently stored on the catalog entry. */
  storedCost: number;
  /** The amount the live detector currently observes for this merchant. */
  detectedCost: number;
  /** ISO date of the most recent charge the detector observed. */
  lastSeen: string;
};

/**
 * For each catalog merchant (a `Sub` — this codebase's single recurring-
 * outflow entity for both subscriptions and bills, see caughtBills.ts's
 * module header "REAL BILL ENTITY DECISION"), re-run the recurring-charge
 * DETECTION engine (`detectRecurring`) over `transactions` and compare the
 * most recently observed charge amount against the stored `cost`. A
 * deviation beyond `DRIFT_THRESHOLD_FRACTION` (15%) either direction is
 * reported — this is the general "price rise (or fall)" class the brief
 * calls for, not scoped to a rise only, since a fact-only signal shouldn't
 * assume direction.
 *
 * A catalog entry with no matching detected series at all produces no
 * signal (nothing to compare against yet, or the merchant's charges don't
 * currently clear the detector's thresholds).
 *
 * Pure: never mutates `catalog` or `transactions`.
 */
export function detectBillDrift(
  catalog: readonly DriftCatalogEntry[],
  transactions: readonly Charge[],
): BillDriftSignal[] {
  if (catalog.length === 0) return [];

  const signals = detectRecurring(transactions);
  const signalsByMerchant = new Map<string, (typeof signals)[number]>();
  for (const signal of signals) {
    if (signal.status !== 'series') continue;
    const key = normaliseLabel(signal.merchant);
    const existing = signalsByMerchant.get(key);
    if (existing === undefined || signal.occurrences > existing.occurrences) {
      signalsByMerchant.set(key, signal);
    }
  }

  const results: BillDriftSignal[] = [];
  for (const entry of catalog) {
    const matched = signalsByMerchant.get(normaliseLabel(entry.name));
    if (matched === undefined) continue;

    // The most recently observed charge magnitude, unsigned GBP.
    const detectedCost = matched.amount.upperMinor / 100;
    const deviated = fractionalDeviation(detectedCost, entry.cost) > DRIFT_THRESHOLD_FRACTION;
    if (!deviated) continue;

    results.push({
      name: entry.name,
      storedCost: entry.cost,
      detectedCost,
      lastSeen: matched.lastSeen,
    });
  }
  return results;
}
