// History statistics — DATA_INTELLIGENCE.md phase ⑥ "history-fed forecasts".
//
// Pure, deterministic, no I/O, no react-native imports, no UI. A plain TS
// module collected by the apps/**\/*.test.ts vitest runner via its colocated
// historyStats.test.ts. Zero folio imports (no `../store` runtime import) —
// callers project `Transaction[]` down to the small local shape this module
// needs, same discipline as subSignals.ts / incomeSignals.ts.
//
// Every number this module returns is explicitly an ESTIMATE derived from
// however much history is available — it never asserts a verdict ("you're
// fine", "you're overspending"). Callers are responsible for framing these as
// estimates in any user-facing copy (see irregular.ts and MONEY_MODES.md §2.5
// for the consuming strategy).

const DAY_MS = 86_400_000;

/** The minimal transaction shape this module needs. Mirrors the store's
 *  `Transaction` fields it actually reads — kept local so this stays a
 *  standalone, dependency-free module (same convention as subSignals.ts's
 *  `Charge` / incomeSignals.ts's `IncomeTransaction`). */
export type HistoryTransaction = {
  /** ISO timestamp or "YYYY-MM-DD" — only the date portion is read. */
  when: string;
  /** Signed GBP. Credit/inflow positive, spend negative (store convention). */
  amount: number;
  /** Optional — when present, enables per-category baselines. */
  category?: string;
};

/** "YYYY-MM" slice of an ISO date/timestamp string. */
function monthKeyOf(isoDateOrTimestamp: string): string {
  return isoDateOrTimestamp.slice(0, 7);
}

/**
 * Total credit (positive-amount) inflow per PAST FULL calendar month present
 * in `transactions`, relative to `todayISO`. The current (in-progress) month
 * is always excluded — it isn't over yet, so its total would understate a
 * real month's income and skew any percentile computed over the series.
 *
 * Returned oldest-first, one entry per month that had at least one credit
 * row (a month with zero credits is omitted rather than reported as a
 * misleading "£0 income" month — see `percentile`'s doc for why a sparse
 * series should stay short rather than padded with zeros).
 *
 * Pure: never mutates `transactions`; same input -> same output.
 */
export function monthlyIncomeSeries(
  transactions: readonly HistoryTransaction[],
  todayISO: string,
): number[] {
  const currentMonthKey = monthKeyOf(todayISO);
  const byMonth = new Map<string, number>();

  for (const txn of transactions) {
    if (txn.amount <= 0) continue;
    const monthKey = monthKeyOf(txn.when);
    if (monthKey >= currentMonthKey) continue; // never the current/future month
    byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + txn.amount);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, total]) => total);
}

/**
 * The `p`th percentile (0-100) of `series` via linear interpolation between
 * the two nearest ranks (the same method Excel's `PERCENTILE.INC` and
 * numpy's default `linear` interpolation use) — chosen because it gives a
 * smooth, monotonic answer across small samples rather than snapping to a
 * single observed value, which matters here since real users rarely have
 * more than 6-18 months of history.
 *
 * `series` need not be pre-sorted — this function sorts a copy internally so
 * callers can pass raw output straight from `monthlyIncomeSeries`.
 *
 * Returns 0 for an empty series (no history to estimate from — callers must
 * treat this as "insufficient data", not a real zero-income estimate).
 * A single-element series returns that element for every percentile (no
 * interpolation is possible with one point).
 *
 * Pure: never mutates `series`.
 */
export function percentile(series: readonly number[], p: number): number {
  if (series.length === 0) return 0;
  const sorted = [...series].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0] as number;

  const clampedP = Math.min(100, Math.max(0, p));
  // Rank in [0, n-1] — the "index space" position of the requested percentile.
  const rank = (clampedP / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  if (lowerIndex === upperIndex) return sorted[lowerIndex] as number;

  const lowerValue = sorted[lowerIndex] as number;
  const upperValue = sorted[upperIndex] as number;
  const fraction = rank - lowerIndex;
  return lowerValue + (upperValue - lowerValue) * fraction;
}

/** One category's baseline: the median past-month spend, plus how many
 *  distinct past months contributed to that median (so a caller can judge
 *  how much to trust a baseline built from only 1-2 months). */
export type SpendBaseline = {
  medianMonthlySpend: number;
  monthsObserved: number;
};

/**
 * Median PAST-month spend (debit magnitude, i.e. `-amount` for amount < 0),
 * overall when `category` is omitted, or scoped to transactions whose
 * `category` matches when given. The current (in-progress) calendar month is
 * always excluded, same reasoning as `monthlyIncomeSeries`.
 *
 * A month with zero matching spend is NOT included as a 0 in the median —
 * an omitted month usually means "no transactions imported that far back yet"
 * or "no spend in that category that month", and folding it in as a hard
 * zero would understate a genuine spender's baseline. `monthsObserved` still
 * reports how many months actually had matching rows, so callers can frame
 * a thin baseline (1-2 months) as more tentative than a deep one.
 *
 * Pure: never mutates `transactions`.
 */
export function monthlySpendBaseline(
  transactions: readonly HistoryTransaction[],
  todayISO: string,
  category?: string,
): SpendBaseline {
  const currentMonthKey = monthKeyOf(todayISO);
  const byMonth = new Map<string, number>();

  for (const txn of transactions) {
    if (txn.amount >= 0) continue; // spend only
    if (category !== undefined && txn.category !== category) continue;
    const monthKey = monthKeyOf(txn.when);
    if (monthKey >= currentMonthKey) continue;
    byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + -txn.amount);
  }

  const totals = [...byMonth.values()].sort((a, b) => a - b);
  return {
    medianMonthlySpend: medianOf(totals),
    monthsObserved: totals.length,
  };
}

function medianOf(sorted: readonly number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid] as number;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** A candidate annual-cadence debit series — the "insurance / TV licence"
 *  class the yearly minimum-occurrence rule in subSignals.ts (3 occurrences)
 *  is too strict for with only 1-2 years of imported history. Always labelled
 *  'possible' — this is a gentler, separate detector, never a `series`
 *  promotion; see module header + DATA_INTELLIGENCE.md phase ⑥ item 5
 *  ("annual-bill radar"). */
export type AnnualCandidate = {
  merchant: string;
  /** Unsigned GBP — the most recent charge magnitude observed. */
  amount: number;
  occurrences: number;
  /** ISO date of the most recent charge. */
  lastSeen: string;
  status: 'possible';
};

const YEAR_NOMINAL_DAYS = 365;
/** ±20 days around the nominal 365-day gap — the "same time next year" band. */
const YEAR_GAP_TOLERANCE_DAYS = 20;
/** Alternate qualifying rule: consecutive charges 11-13 months apart (inclusive)
 *  by calendar-month count, not just a strict day-count — catches a March->April
 *  drift year-to-year that a pure day-gap check would just miss the tolerance on. */
const MONTHS_APART_ALTERNATE = new Set([11, 12, 13]);
const MIN_ANNUAL_OCCURRENCES = 2;

function toMs(iso: string): number {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime();
}

function calendarDaysBetween(aIso: string, bIso: string): number {
  return Math.round((toMs(bIso) - toMs(aIso)) / DAY_MS);
}

/** Whole calendar months between two ISO dates (b - a), using only the
 *  year/month fields — e.g. 2025-03-01 -> 2026-03-15 is 12, regardless of
 *  day-of-month. Used for the MONTHS_APART_ALTERNATE check. */
function monthsApart(aIso: string, bIso: string): number {
  const aYear = Number(aIso.slice(0, 4));
  const aMonth = Number(aIso.slice(5, 7));
  const bYear = Number(bIso.slice(0, 4));
  const bMonth = Number(bIso.slice(5, 7));
  return (bYear - aYear) * 12 + (bMonth - aMonth);
}

/** Lowercase, trim, collapse whitespace, strip punctuation — the group key.
 *  Same normalisation subSignals.ts / incomeSignals.ts use, duplicated here
 *  deliberately per this module's own "no folio imports" discipline. */
function normaliseMerchant(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,_·-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect debit clusters that recur at roughly annual cadence but have too
 * few occurrences (or too few *years* of history) for `subSignals.ts`'s
 * `detectRecurring` yearly minimum (3) to ever confirm them as a `series` —
 * a real insurance renewal or TV licence with only 2 years of imported
 * statements never clears that bar. This is a deliberately GENTLER, separate
 * detector: every result is labelled `status: 'possible'` (never promoted to
 * a confirmed series), and it only ever surfaces annual-shaped debit
 * clusters, nothing else.
 *
 * A cluster qualifies when it has >= `MIN_ANNUAL_OCCURRENCES` (2) charges to
 * the same merchant, of a similar magnitude (±20% — reuses subSignals.ts's
 * general amount-tolerance idea, applied locally here), AND either:
 *   (a) every consecutive gap is within `YEAR_GAP_TOLERANCE_DAYS` of the
 *       nominal 365-day year, OR
 *   (b) every consecutive gap is 11-13 whole calendar months apart.
 * (b) exists because a charge landing "the following March" can be legitimately
 * 340 or 386 days later depending on where the leap year falls and which day
 * of the month it lands on — a pure day-count window would reject some of
 * those, and a whole-months check is the more honest way to say "roughly a
 * year later" for annual bills.
 *
 * Pure: never mutates `transactions`.
 */
export function detectAnnualCandidates(
  transactions: readonly HistoryTransaction[],
): AnnualCandidate[] {
  const groups = new Map<string, { rawNames: string[]; charges: HistoryTransaction[] }>();
  for (const txn of transactions) {
    if (txn.amount >= 0) continue; // debits only
    const key = normaliseMerchant('merchant' in txn ? merchantOf(txn) : '');
    if (key === '') continue;
    let g = groups.get(key);
    if (g === undefined) {
      g = { rawNames: [], charges: [] };
      groups.set(key, g);
    }
    g.rawNames.push(merchantOf(txn));
    g.charges.push(txn);
  }

  const candidates: AnnualCandidate[] = [];
  for (const group of groups.values()) {
    const sorted = [...group.charges].sort((a, b) => toMs(a.when) - toMs(b.when));
    const run = longestAnnualRun(sorted);
    if (run.length < MIN_ANNUAL_OCCURRENCES) continue;

    const label = displayName(group.rawNames);
    const lastSeen = (run[run.length - 1] as HistoryTransaction).when.slice(0, 10);
    const amount = Math.abs((run[run.length - 1] as HistoryTransaction).amount);
    candidates.push({
      merchant: label,
      amount,
      occurrences: run.length,
      lastSeen,
      status: 'possible',
    });
  }
  return candidates;
}

/** Extracts the merchant field from a `HistoryTransaction`-shaped value that
 *  may or may not carry one — callers passing plain `Transaction` rows always
 *  have it; this module's own minimal type doesn't declare it, so it's read
 *  defensively via an index-free narrow rather than widening the exported
 *  type (this module's public contract stays merchant-agnostic on purpose,
 *  since `monthlyIncomeSeries`/`monthlySpendBaseline` never need it). */
function merchantOf(txn: HistoryTransaction): string {
  const withMerchant = txn as HistoryTransaction & { merchant?: string };
  return withMerchant.merchant ?? '';
}

function amountsSimilar(a: number, b: number): boolean {
  const magA = Math.abs(a);
  const magB = Math.abs(b);
  if (magA <= 0 || magB <= 0) return false;
  const larger = Math.max(magA, magB);
  const smaller = Math.min(magA, magB);
  return larger / smaller <= 1.2;
}

function longestAnnualRun(sortedByDate: readonly HistoryTransaction[]): HistoryTransaction[] {
  if (sortedByDate.length < 2) return [...sortedByDate];

  let best: HistoryTransaction[] = [];
  let run: HistoryTransaction[] = [sortedByDate[0] as HistoryTransaction];
  for (let i = 1; i < sortedByDate.length; i += 1) {
    const prev = sortedByDate[i - 1] as HistoryTransaction;
    const current = sortedByDate[i] as HistoryTransaction;
    const prevDate = prev.when.slice(0, 10);
    const currentDate = current.when.slice(0, 10);
    const gapDays = calendarDaysBetween(prevDate, currentDate);
    const withinDayBand = Math.abs(gapDays - YEAR_NOMINAL_DAYS) <= YEAR_GAP_TOLERANCE_DAYS;
    const withinMonthBand = MONTHS_APART_ALTERNATE.has(monthsApart(prevDate, currentDate));
    const sameAmount = amountsSimilar(prev.amount, current.amount);

    if ((withinDayBand || withinMonthBand) && sameAmount) {
      run.push(current);
    } else {
      if (run.length > best.length) best = run;
      run = [current];
    }
  }
  if (run.length > best.length) best = run;
  return best;
}

/** Pick the most frequent raw spelling as the display label (ties -> first seen). */
function displayName(rawNames: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const n of rawNames) counts.set(n, (counts.get(n) ?? 0) + 1);
  let best = rawNames[0] as string;
  let bestCount = 0;
  for (const n of rawNames) {
    const c = counts.get(n) as number;
    if (c > bestCount) {
      bestCount = c;
      best = n;
    }
  }
  return best.trim();
}
