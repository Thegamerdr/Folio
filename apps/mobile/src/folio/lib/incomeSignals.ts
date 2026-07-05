/**
 * Income-signal DETECTION engine — Phase ② of the data-intelligence program.
 *
 * Pure, deterministic, no I/O, no react-native imports, no UI. A plain TS
 * module collected by the apps/**\/*.test.ts vitest runner via its colocated
 * incomeSignals.test.ts. Zero folio imports (no `../store`, no `./subSignals`
 * runtime import) so it stays independently testable; the clustering/cadence
 * approach mirrors `subSignals.ts` but is not imported from it — credits need
 * materially different tolerances (wages vary with hours/overtime; bills do
 * not), so this is a sibling engine, not an extension.
 *
 * DETECTION ONLY. This module surfaces facts about *recurring credits* — that
 * a merchant pays the account repeatedly, at what cadence, and for roughly
 * what amount. It must NEVER assert a verdict or instruction ("this is your
 * salary", "budget around this"). Per phase ① constraint (see
 * DATA_INTELLIGENCE.md §2 "Non-negotiable constraint"): any detected cadence
 * is propose-and-confirm material for a future confirmation UI, never a
 * silent write into the user's declared `IncomeSource` records. This module
 * does not touch the store at all — it only classifies `Transaction[]` in,
 * `IncomeSignal[]` out.
 */

// ---------------------------------------------------------------------------
// Public input / output contracts.
// ---------------------------------------------------------------------------

/** One accepted transaction. Spend is negative, a credit/deposit positive. */
export type IncomeTransaction = {
  /** Raw merchant/description string as imported; normalised internally. */
  merchant: string;
  /** Signed GBP. Credit positive, debit negative (store convention). */
  amount: number;
  /** ISO `YYYY-MM-DD`. */
  date: string;
};

export type IncomeCadence = 'weekly' | 'fortnightly' | 'four-weekly' | 'monthly';

/** How sure the engine is this cluster is a genuine income source. */
export type IncomeConfidence = 'strong' | 'possible';

/**
 * A detected recurring-credit signal. Descriptive, transaction-derived only —
 * deliberately carries no "this is salary" / "spend against this" field. See
 * module header for the honesty rule this mirrors from `subSignals.ts`.
 */
export type IncomeSignal = {
  /** Display merchant (the most common raw spelling in the group). */
  merchant: string;
  cadence: IncomeCadence;
  /** Median credit amount observed, in GBP (unsigned). */
  medianAmount: number;
  /** Count of credits contributing to this signal. */
  occurrences: number;
  /** ISO date of the most recent credit in the series. */
  lastSeenISO: string;
  /** ISO date of the most recent credit — the anchor for projecting forward. */
  anchorISO: string;
  confidence: IncomeConfidence;
};

// ---------------------------------------------------------------------------
// Tuning constants.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** Nominal period for each cadence, in days — same values as subSignals.ts. */
const CADENCE_DAYS: Record<IncomeCadence, number> = {
  weekly: 7,
  fortnightly: 14,
  'four-weekly': 28,
  monthly: 30,
};

/**
 * Minimum occurrences to surface a signal at all. Week-based cadences need
 * more samples than monthly because a single missed/extra pay week is more
 * likely noise at low sample counts (per the brief: "min occurrences: 3 for
 * monthly, 4 for week-based").
 */
const MIN_OCCURRENCES: Record<IncomeCadence, number> = {
  weekly: 4,
  fortnightly: 4,
  'four-weekly': 4,
  monthly: 3,
};

/**
 * Two credits belong to the same amount cluster when the larger is within
 * this factor of the smaller. Wider than subSignals.ts's bill tolerance
 * (1.5x) because wages vary with hours/overtime — the brief calls for ±25%
 * tolerance, which as a same-vs-smaller ratio is 1.25/0.75 ≈ 1.667.
 */
const AMOUNT_SPLIT_FACTOR = 1.667;

/**
 * `strong` confidence requires at least this many occurrences AND every
 * consecutive gap within `STRONG_MAX_DRIFT_DAYS` of the nominal cadence.
 */
const STRONG_MIN_OCCURRENCES = 4;
const STRONG_MAX_DRIFT_DAYS = 2;

/**
 * Consecutive-gap tolerance (calendar days) used to decide whether a pair of
 * credits still belongs to the same in-cadence run at all (looser than the
 * strong-confidence band above). Wages can land a few days either side of
 * the "expected" date around weekends/bank holidays/payroll-run timing.
 */
const RUN_TOLERANCE_DAYS: Record<IncomeCadence, number> = {
  weekly: 4,
  fortnightly: 5,
  'four-weekly': 6,
  monthly: 6,
};

/**
 * A debit within this many days of a credit, with a similar magnitude,
 * marks the pair as a self-transfer/money-shuffle rather than income (see
 * `excludeSelfTransfers`).
 */
const SELF_TRANSFER_WINDOW_DAYS = 3;
/** Same amount-cluster tolerance reused for the debit-counterparty match. */
const SELF_TRANSFER_AMOUNT_FACTOR = 1.1;

// ---------------------------------------------------------------------------
// Small pure helpers (mirrors subSignals.ts's approach; kept local/duplicated
// deliberately — see module header on why this is a sibling, not an import).
// ---------------------------------------------------------------------------

/** Lowercase, trim, collapse whitespace, strip punctuation — the group key. */
function normaliseMerchant(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,_·-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toMs(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime();
}

function isoOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function calendarDaysBetween(aIso: string, bIso: string): number {
  return Math.round((toMs(bIso) - toMs(aIso)) / DAY_MS);
}

function median(sorted: readonly number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid] as number;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

function classifyCadence(medianGapDays: number): IncomeCadence {
  // Nearest nominal period by ratio — symmetric in log space, same approach
  // as subSignals.ts's classifyCadence.
  const cadences: IncomeCadence[] = ['weekly', 'fortnightly', 'four-weekly', 'monthly'];
  let best: IncomeCadence = 'monthly';
  let bestScore = Infinity;
  for (const c of cadences) {
    const nominal = CADENCE_DAYS[c];
    const ratio = medianGapDays > 0 ? medianGapDays / nominal : nominal;
    const score = Math.abs(Math.log(ratio));
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Internal working shapes.
// ---------------------------------------------------------------------------

type Group = {
  key: string;
  credits: IncomeTransaction[];
  debits: IncomeTransaction[];
  rawNames: string[];
};

// ---------------------------------------------------------------------------
// Detection.
// ---------------------------------------------------------------------------

/**
 * Detect recurring-income signals from accepted transactions. Pure: the input
 * array and its elements are never mutated; the same input yields the same
 * output.
 *
 * @param transactions accepted/imported money movements (manual rows excluded upstream)
 */
export function detectIncomeSources(transactions: readonly IncomeTransaction[]): IncomeSignal[] {
  if (transactions.length === 0) return [];

  const groups = groupByMerchant(transactions);
  const signals: IncomeSignal[] = [];

  for (const group of groups) {
    if (group.credits.length < 2) continue;
    if (isLikelySelfTransfer(group)) continue;

    const clusters = clusterByAmount(group.credits);
    const label = displayName(group.rawNames);
    for (const cluster of clusters) {
      const signal = buildSignalForCluster(cluster, label);
      if (signal !== null) signals.push(signal);
    }
  }

  return signals;
}

function groupByMerchant(transactions: readonly IncomeTransaction[]): Group[] {
  const map = new Map<string, Group>();
  for (const t of transactions) {
    const key = normaliseMerchant(t.merchant);
    let g = map.get(key);
    if (g === undefined) {
      g = { key, credits: [], debits: [], rawNames: [] };
      map.set(key, g);
    }
    g.rawNames.push(t.merchant);
    if (t.amount > 0) g.credits.push(t);
    else if (t.amount < 0) g.debits.push(t);
  }
  return [...map.values()];
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

/**
 * Excludes money-shuffling: a merchant whose credits are matched by similarly
 * -sized debits to/from the SAME normalised counterparty within a short
 * window (the "rent paid out, rent refunded back" pattern) is not income —
 * it is the user moving their own money. A merchant matching the user's own
 * name is not detectable from transaction data alone, so this heuristic
 * (debit + credit round-trip to one counterparty) is the practical proxy the
 * brief calls for.
 *
 * Conservative: only excludes the group when EVERY credit has a matching
 * nearby debit of similar magnitude — a merchant that is mostly genuine
 * income with one unrelated coincidental debit should still be detected.
 */
function isLikelySelfTransfer(group: Group): boolean {
  if (group.debits.length === 0) return false;
  return group.credits.every((credit) => hasMatchingDebit(credit, group.debits));
}

function hasMatchingDebit(
  credit: IncomeTransaction,
  debits: readonly IncomeTransaction[],
): boolean {
  const creditMag = Math.abs(credit.amount);
  for (const debit of debits) {
    const debitMag = Math.abs(debit.amount);
    const larger = Math.max(creditMag, debitMag);
    const smaller = Math.min(creditMag, debitMag);
    if (smaller <= 0) continue;
    if (larger / smaller > SELF_TRANSFER_AMOUNT_FACTOR) continue;
    const gap = Math.abs(calendarDaysBetween(debit.date, credit.date));
    if (gap <= SELF_TRANSFER_WINDOW_DAYS) return true;
  }
  return false;
}

/**
 * Cluster credits by amount magnitude. Sort by amount, then start a new
 * cluster whenever the next magnitude exceeds the running cluster minimum by
 * more than AMOUNT_SPLIT_FACTOR. Wider tolerance than subSignals.ts's bill
 * clustering because wage credits vary with hours/overtime.
 */
function clusterByAmount(credits: readonly IncomeTransaction[]): IncomeTransaction[][] {
  if (credits.length === 0) return [];
  const sorted = [...credits].sort((a, b) => a.amount - b.amount);
  const clusters: IncomeTransaction[][] = [];
  let current: IncomeTransaction[] = [];
  let clusterMin = (sorted[0] as IncomeTransaction).amount;

  for (const c of sorted) {
    if (current.length === 0) {
      current = [c];
      clusterMin = c.amount;
      continue;
    }
    if (c.amount > clusterMin * AMOUNT_SPLIT_FACTOR) {
      clusters.push(current);
      current = [c];
      clusterMin = c.amount;
    } else {
      current.push(c);
    }
  }
  if (current.length > 0) clusters.push(current);
  return clusters;
}

function buildSignalForCluster(
  cluster: readonly IncomeTransaction[],
  label: string,
): IncomeSignal | null {
  if (cluster.length < 2) return null;

  const sorted = [...cluster].sort((a, b) => toMs(a.date) - toMs(b.date));
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    gaps.push(
      calendarDaysBetween(
        (sorted[i - 1] as IncomeTransaction).date,
        (sorted[i] as IncomeTransaction).date,
      ),
    );
  }
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const medianGap = median(sortedGaps);
  const cadence = classifyCadence(medianGap);

  const run = longestInToleranceRun(sorted, cadence);
  if (run.length < 2) return null;

  const occurrences = run.length;
  if (occurrences < MIN_OCCURRENCES[cadence]) return null;

  const amounts = run.map((t) => t.amount).sort((a, b) => a - b);
  const medianAmount = median(amounts);
  const lastSeenISO = (run[run.length - 1] as IncomeTransaction).date;

  const confidence = computeConfidence(run, cadence, occurrences);

  return {
    merchant: label,
    cadence,
    medianAmount,
    occurrences,
    lastSeenISO,
    anchorISO: lastSeenISO,
    confidence,
  };
}

/**
 * The longest run of consecutive credits whose every step holds the cadence
 * within RUN_TOLERANCE_DAYS. Mirrors subSignals.ts's longestInToleranceRun
 * but in plain calendar days (no working-day adjustment — wage credit dates
 * are noisier than direct debits, so a working-day-only tolerance would be
 * too tight in practice for this signal's purpose).
 */
function longestInToleranceRun(
  sortedByDate: readonly IncomeTransaction[],
  cadence: IncomeCadence,
): IncomeTransaction[] {
  if (sortedByDate.length < 2) return [...sortedByDate];
  const nominalDays = CADENCE_DAYS[cadence];
  const tolerance = RUN_TOLERANCE_DAYS[cadence];

  let best: IncomeTransaction[] = [];
  let run: IncomeTransaction[] = [sortedByDate[0] as IncomeTransaction];
  for (let i = 1; i < sortedByDate.length; i += 1) {
    const prev = sortedByDate[i - 1] as IncomeTransaction;
    const current = sortedByDate[i] as IncomeTransaction;
    const expectedMs = toMs(prev.date) + nominalDays * DAY_MS;
    const drift = Math.abs(Math.round((toMs(current.date) - expectedMs) / DAY_MS));
    if (drift <= tolerance) {
      run.push(current);
    } else {
      if (run.length > best.length) best = run;
      run = [current];
    }
  }
  if (run.length > best.length) best = run;
  return best;
}

/**
 * Amounts within this fraction of the median count as "stable" for the
 * strong-confidence amount check. Wages that vary with hours/overtime (e.g.
 * agency payroll varying +/-20%) fall outside this band and read as
 * `possible`, even when the dates themselves land exactly on schedule.
 */
const STRONG_MAX_AMOUNT_VARIANCE = 0.05;

/**
 * `strong` when there are at least STRONG_MIN_OCCURRENCES credits, every
 * consecutive gap in the run sits within STRONG_MAX_DRIFT_DAYS of the nominal
 * cadence period, AND every amount sits within STRONG_MAX_AMOUNT_VARIANCE of
 * the median; `possible` otherwise. A weekly wage that varies with hours (e.g.
 * agency payroll +/-20%) reads as `possible` on amount instability alone, even
 * when it lands reliably on the same weekday — variable amount is itself a
 * sign this needs a human to confirm it before anything is built on top of it.
 */
function computeConfidence(
  run: readonly IncomeTransaction[],
  cadence: IncomeCadence,
  occurrences: number,
): IncomeConfidence {
  if (occurrences < STRONG_MIN_OCCURRENCES) return 'possible';

  const nominalDays = CADENCE_DAYS[cadence];
  for (let i = 1; i < run.length; i += 1) {
    const prev = run[i - 1] as IncomeTransaction;
    const current = run[i] as IncomeTransaction;
    const expectedMs = toMs(prev.date) + nominalDays * DAY_MS;
    const drift = Math.abs(Math.round((toMs(current.date) - expectedMs) / DAY_MS));
    if (drift > STRONG_MAX_DRIFT_DAYS) return 'possible';
  }

  const amounts = run.map((t) => t.amount).sort((a, b) => a - b);
  const medianAmount = median(amounts);
  for (const amount of amounts) {
    const varianceFraction = medianAmount > 0 ? Math.abs(amount - medianAmount) / medianAmount : 0;
    if (varianceFraction > STRONG_MAX_AMOUNT_VARIANCE) return 'possible';
  }

  return 'strong';
}
