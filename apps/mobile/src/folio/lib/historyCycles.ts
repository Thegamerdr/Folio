// Historic cycle synthesis — DATA_INTELLIGENCE.md phase ④(B).
//
// Today, `cycles[]` (the app's flat ritual-summary `CycleRecord`) has exactly
// two writers: `PaydayRitualScreen`'s `addCycle` (a live, walked-through
// ritual) and the debug-only `fastForwardMonth` synthetic generator. There is
// NO path from "N months of imported transaction history" to N synthesized
// `CycleRecord`s — a user who bulk-imports 6 months of statement rows gets 0
// cycles, and Insights stays in its empty state regardless of import volume
// (see DATA_INTELLIGENCE.md §5(B)).
//
// This module is the pure synthesizer half of the fix: given the ledger,
// declared income sources, and the cycles that already exist, reconstruct one
// `CycleRecord` per PAST FULL calendar month that has enough transaction
// volume to be worth summarising, tagged `reconstructed: true` so callers
// (Insights, the ritual-offer gate) can tell "lived-through, ritual-sealed"
// cycles from "inferred from a bulk import" apart.
//
// HONESTY discipline (matches caughtSubs.ts / merchantMemory.ts): a
// reconstructed cycle is a best-effort approximation, not a ritual-sealed
// fact. It never overwrites a lived cycle for the same month, and it is
// idempotent — re-running the synthesizer over the same history + the same
// month never produces a duplicate entry, it upserts the SAME record (keyed by
// month) instead. See `synthesizeHistoryCycles`'s doc for the exact rules.
//
// Split discipline: pure and Node-testable (no react-native, no DOM, no store
// mutation) — collected by the apps/**\/*.test.ts vitest runner via
// historyCycles.test.ts. `store.ts`'s `syncHistoryCycles` action is the thin
// wiring that calls this over the live state and merges the result in.

import type { CycleRecord, IncomeSource, Transaction } from '../store';

/** A transaction month needs at least this many rows before it's worth
 *  synthesizing a cycle for — a handful of stray rows in an otherwise-empty
 *  month would produce a misleadingly confident-looking summary. */
const MIN_TRANSACTIONS_PER_MONTH = 5;

/** PARTIAL FIRST MONTH guard (DATA_INTELLIGENCE.md phase ④): a bulk-imported statement range can
 *  start mid-month (e.g. a bank export beginning on the 18th), so the earliest covered month may
 *  not actually be a full calendar month — its true start is unknown, only its true END (the
 *  statement's last day in that month) is. If the earliest transaction in that month falls later
 *  than this day-of-month, treat the month's start as unknown and skip reconstruction entirely
 *  (a "tightPoint"/"spare" computed only from a partial month would misreport the whole month as
 *  tighter — or calmer — than it actually was). A day this small still lets a statement that
 *  genuinely starts on/near the 1st (the common case) reconstruct normally. */
const FIRST_MONTH_MAX_START_DAY = 4;

/** "YYYY-MM" slice of an ISO date/timestamp string. */
function monthKeyOf(isoDateOrTimestamp: string): string {
  return isoDateOrTimestamp.slice(0, 7);
}

/** Human label matching the existing `CycleRecord.label` convention seen in
 *  `DEFAULTS.cycles` / `fastForwardMonth` ("June", "May") — but this
 *  synthesizer spans potentially many distinct years, so a bare month name
 *  would collide across years ("June" 2025 vs "June" 2026). Use "Month YYYY"
 *  (e.g. "June 2026") — still reads naturally, never ambiguous. */
function labelFor(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const monthName = new Date(Date.UTC(year, monthIndex, 1)).toLocaleString('en-GB', {
    month: 'long',
    timeZone: 'UTC',
  });
  return `${monthName} ${yearStr}`;
}

/** The last day (inclusive, ISO "YYYY-MM-DD") of a "YYYY-MM" month key. */
function monthEndIso(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-based; Date.UTC(year, month, 0) = last day of `month`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
}

/** A reconstructed `CycleRecord` — same shape as the live, ritual-sealed
 *  record plus the honesty tag. `reconstructed: true` is always present
 *  (never `false`/absent) so a simple truthy check distinguishes it from a
 *  lived cycle everywhere it's read. */
export type ReconstructedCycleRecord = CycleRecord & { reconstructed: true };

/**
 * Reconstruct one `CycleRecord` per past, FULL calendar month in `transactions`
 * that has at least `MIN_TRANSACTIONS_PER_MONTH` rows, merged against
 * `existingCycles` per these rules:
 *
 *   - The CURRENT calendar month (per `todayISO`) is NEVER synthesized, full
 *     or not — it isn't over yet, so any summary would misreport an
 *     in-progress month as closed.
 *   - A month that already has a LIVED (non-reconstructed) cycle in
 *     `existingCycles` is left untouched — a lived, ritual-sealed cycle
 *     always wins over an inferred one, never overwritten.
 *   - A month that already has a RECONSTRUCTED cycle from a previous run is
 *     re-synthesized and replaces the old entry (upsert, keyed by month) —
 *     re-running the synthesizer over a growing ledger keeps a reconstructed
 *     month's numbers current as more statement history lands, without ever
 *     duplicating it.
 *   - Every other lived cycle (any month not touched by this run) is passed
 *     through unchanged.
 *   - The EARLIEST month present in `transactions` is skipped when its earliest transaction lands
 *     later than `FIRST_MONTH_MAX_START_DAY` days into the month — a bulk import can start
 *     mid-month, and that month's true start (and therefore its spend/income total) is unknown, so
 *     summarising it would misreport a partial month as a complete one. A month that is genuinely
 *     sparse-but-full (few transactions, but starting near the 1st) still reconstructs normally via
 *     the existing `MIN_TRANSACTIONS_PER_MONTH` floor.
 *
 * Approximation honesty: `tightPoint` here is NOT a real intra-month balance
 * minimum (that needs a dated opening-balance anchor per cycle, which plain
 * transaction rows don't carry — see DATA_INTELLIGENCE.md §5(B) "needs an
 * opening-balance anchor per cycle"). It is approximated as the month's total
 * spend minus total income (floored at 0), i.e. "how far the month's outflows
 * outran its inflows" — a rough proxy for how tight the month got, not a
 * verified low-balance figure. `setAside` is always 0 here: pot-linked
 * transfers aren't identifiable from plain transaction rows without a pot
 * reference on `Transaction`, so this is left at the same honest "unknown"
 * default rather than guessed. `note` says so explicitly, in the same voice as
 * the DEBUG-only `fastForwardMonth` synthetic notes.
 *
 * Pure + deterministic: same inputs -> same output, never mutates inputs.
 *
 * @param transactions the full ledger (store `transactions`, plus any bulk-
 *        imported rows landed via `addTransactionsBatch`)
 * @param incomeSources unused directly by the approximation today, but part
 *        of the function's contract per DATA_INTELLIGENCE.md §5(B) ("anchors
 *        cycle boundaries on detected income events, not `onboarding.payday`
 *        alone") — reserved for when the anchor-per-cycle boundary work
 *        lands; today month boundaries are plain calendar months, since the
 *        approximation already only spans transaction rows, not a real
 *        intra-month balance curve. Kept as a parameter so callers/tests
 *        don't need to change shape when that lands.
 * @param existingCycles the current `cycles[]` — lived + any previously
 *        reconstructed entries
 * @param todayISO ISO "YYYY-MM-DD" for "what is the current calendar month"
 */
export function synthesizeHistoryCycles(
  transactions: readonly Transaction[],
  incomeSources: readonly IncomeSource[],
  existingCycles: readonly CycleRecord[],
  todayISO: string,
): CycleRecord[] {
  // `incomeSources` is part of the documented contract (see doc comment
  // above) but not yet consumed by the approximation itself.
  void incomeSources;

  const currentMonthKey = monthKeyOf(todayISO);

  const byMonth = new Map<string, Transaction[]>();
  for (const txn of transactions) {
    if (txn.financialAction?.kind === 'transfer') continue;
    const monthKey = monthKeyOf(txn.when);
    if (monthKey >= currentMonthKey) continue; // never the current (or a future) month
    const bucket = byMonth.get(monthKey);
    if (bucket) bucket.push(txn);
    else byMonth.set(monthKey, [txn]);
  }

  const livedByMonth = new Map<string, CycleRecord>();
  for (const cycle of existingCycles) {
    if ((cycle as ReconstructedCycleRecord).reconstructed) continue;
    livedByMonth.set(monthKeyOf(cycle.closedAt), cycle);
  }

  // PARTIAL FIRST MONTH (see FIRST_MONTH_MAX_START_DAY doc comment): the earliest month key
  // present in THIS transaction set is the one whose true start is unknowable — every later
  // month in the range is bounded by the (known-complete) month before it, so only the very
  // first one needs the guard.
  const earliestMonthKey = [...byMonth.keys()].sort()[0];

  const reconstructedByMonth = new Map<string, ReconstructedCycleRecord>();

  for (const [monthKey, rows] of byMonth) {
    if (rows.length < MIN_TRANSACTIONS_PER_MONTH) continue;
    if (livedByMonth.has(monthKey)) continue; // a lived cycle always wins

    if (monthKey === earliestMonthKey) {
      const earliestDayOfMonth = Math.min(
        ...rows.map((row) => Number(row.when.slice(8, 10)) || 32),
      );
      // The earliest row lands too late in the month for this to plausibly be a full calendar
      // month — the import range started mid-month, so the month's true start (and therefore its
      // total spend/income) is unknown. Skip reconstruction rather than summarise a partial month
      // as if it were complete.
      if (earliestDayOfMonth > FIRST_MONTH_MAX_START_DAY) continue;
    }

    let spendTotal = 0;
    let incomeTotal = 0;
    for (const row of rows) {
      if (row.financialAction?.kind === 'refund') spendTotal -= row.amount;
      else if (row.amount < 0) spendTotal += -row.amount;
      else incomeTotal += row.amount;
    }
    const tightPoint = Math.max(0, Math.round((spendTotal - incomeTotal) * 100) / 100);
    const spare = Math.round((incomeTotal - spendTotal) * 100) / 100;

    reconstructedByMonth.set(monthKey, {
      closedAt: monthEndIso(monthKey),
      label: labelFor(monthKey),
      spare,
      tightPoint,
      setAside: 0,
      note: 'Reconstructed from imported statement history — an estimate, not a lived ritual.',
      reconstructed: true,
    });
  }

  // Assemble the result: every lived cycle untouched, every reconstructed
  // month upserted (replacing any prior reconstructed entry for that month),
  // newest-first by `closedAt` to match the existing `cycles[]` convention.
  const passthroughLived = existingCycles.filter(
    (c) => !(c as ReconstructedCycleRecord).reconstructed,
  );
  const result: CycleRecord[] = [...passthroughLived, ...reconstructedByMonth.values()];
  result.sort((a, b) => (a.closedAt < b.closedAt ? 1 : a.closedAt > b.closedAt ? -1 : 0));
  return capMergedCycles(result);
}

/** CYCLES RETENTION cap for the merged (lived + reconstructed) result of `synthesizeHistoryCycles`
 *  (DATA_INTELLIGENCE.md phase ④). A bulk import can plausibly backfill years of statement
 *  history — Insights' whole point for a returning user is that history — so this cap is far
 *  looser than `addCycle`/`fastForwardMonth`'s 24 (2 years of live ritual closes): 60 entries,
 *  roughly 5 years of months. When the merged list exceeds the cap, the OLDEST RECONSTRUCTED
 *  entries are evicted first (by `closedAt`, ascending); a lived, ritual-sealed cycle is NEVER
 *  evicted by this function, however far back it goes — it is the one thing here the user
 *  actually walked through, so retention should always favour it over an inferred estimate. If
 *  lived cycles alone already exceed the cap (unlikely — that's 5+ years of live rituals), they
 *  are passed through in full rather than trimmed; this function only ever removes reconstructed
 *  entries. `cycles` is assumed already sorted newest-first by `closedAt` (the convention every
 *  writer in this module and `store.ts` follows) and the return preserves that order. */
export function capMergedCycles(cycles: readonly CycleRecord[], cap = 60): CycleRecord[] {
  if (cycles.length <= cap) return [...cycles];

  const lived = cycles.filter((c) => !(c as ReconstructedCycleRecord).reconstructed);
  const reconstructed = cycles.filter((c) => (c as ReconstructedCycleRecord).reconstructed);

  const reconstructedBudget = Math.max(0, cap - lived.length);
  // Oldest-first so `.slice` from the end keeps the NEWEST `reconstructedBudget` entries —
  // i.e. the oldest reconstructed entries are the ones evicted.
  const oldestFirst = [...reconstructed].sort((a, b) => (a.closedAt < b.closedAt ? -1 : 1));
  const keptReconstructed = new Set(
    oldestFirst.slice(Math.max(0, oldestFirst.length - reconstructedBudget)).map((c) => c.closedAt),
  );

  return cycles.filter(
    (c) => !(c as ReconstructedCycleRecord).reconstructed || keptReconstructed.has(c.closedAt),
  );
}

/**
 * The most recent LIVED (non-reconstructed) cycle in `cycles`, or `null` when
 * there isn't one. `cycles` is newest-first by convention (every writer —
 * `addCycle`, `fastForwardMonth` — prepends), but this helper does not trust
 * that ordering blindly: it picks the lived cycle with the latest `closedAt`,
 * so a reconstructed cycle sitting ahead of it in the array (e.g. a
 * backfilled month closing later than the user's last live ritual) can never
 * shadow it.
 *
 * Existing callers must use this instead of `cycles[0]` wherever "the last
 * ritual the user actually walked through" is the intent (e.g.
 * `TodayNudges.tsx`'s `shouldOfferRitual` gate) — a reconstructed past month
 * must never suppress or otherwise stand in for the live ritual-offer nudge.
 */
export function latestLivedCycle(cycles: readonly CycleRecord[]): CycleRecord | null {
  let latest: CycleRecord | null = null;
  for (const cycle of cycles) {
    if ((cycle as ReconstructedCycleRecord).reconstructed) continue;
    if (latest === null || cycle.closedAt > latest.closedAt) latest = cycle;
  }
  return latest;
}
