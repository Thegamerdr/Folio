/**
 * Sub-signals — recurring-charge DETECTION engine. Pure, deterministic, no I/O,
 * no react-native imports, no UI. A plain TS module collected by the
 * apps/**\/*.test.ts vitest runner via its colocated subSignals.test.ts.
 *
 * DETECTION ONLY. This module surfaces facts about *money movement* — that a
 * payment recurs, its cadence, its amount (and amount change), a missed
 * expected charge, a returned payment, and two series to one merchant. It must
 * NEVER assert *usage*, *value*, *waste*, *decay*, or a *cancel* recommendation:
 * banking data proves a payment recurred, it cannot prove a product was used.
 * See SUBSCRIPTION_SIGNAL_RESEARCH.md and ENGINES.md §6 "Subs — usage decay".
 *
 * The honesty rule is enforced *by construction*: `RecurringSignal` has no
 * usage / value / cancel / decay field, so the unsafe claim is unrepresentable.
 * Thresholds are Moneyhub's published minimum sample counts and working-day
 * date tolerances (research §6).
 *
 * Types are intentionally local. The only allowed cross-module import is a TS
 * *type* from the data spine ('../store'), and none is needed here, so this file
 * has zero folio imports.
 */

// ---------------------------------------------------------------------------
// Public input / output contracts.
// ---------------------------------------------------------------------------

/** How a charge was taken — widens the date-drift tolerance for Direct Debits. */
export type PaymentType = 'card' | 'direct-debit';

/** One imported/accepted money movement. Spend is negative, a return positive. */
export type Charge = {
  /** Raw merchant string as imported; normalised internally for grouping. */
  merchant: string;
  /** Signed GBP. Spend negative, credit/return positive (store convention). */
  amount: number;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  /** Optional — defaults to `card` (the tighter ≤3 working-day tolerance). */
  paymentType?: PaymentType;
};

/** Confirmed series vs below-threshold candidate (surfaced quietly). */
export type RecurringStatus = 'series' | 'candidate';

export type Cadence = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * The predicted next amount, as a band, in MINOR units (pence) and unsigned.
 * `variable` is true when the observed charges were not all the same amount.
 */
export type AmountRange = {
  lowerMinor: number;
  upperMinor: number;
  variable: boolean;
};

/** A sustained step in the charge amount — a fact, never a verdict. */
export type PriceChange = {
  fromMinor: number;
  toMinor: number;
  /** ISO date of the first charge at the new amount. */
  atDate: string;
};

/**
 * A detected recurring-payment signal. Descriptive, payment-derived only.
 *
 * Deliberately carries NO usage / value / cancel / decay / importance field —
 * the honesty guarantee is structural (see module header). Adding such a field
 * would make an unprovable claim representable; do not.
 */
export type RecurringSignal = {
  /** Display merchant (the most common raw spelling in the group). */
  merchant: string;
  status: RecurringStatus;
  cadence: Cadence;
  /** Count of money-out charges in this series. */
  occurrences: number;
  amount: AmountRange;
  /** ISO date of the first charge in the series. */
  firstSeen: string;
  /** ISO date of the most recent charge in the series. */
  lastSeen: string;
  /** ISO date the next charge is predicted around (within the tolerance band). */
  nextExpected: string;
  /** Present only when a sustained amount step was observed. */
  priceChanged?: PriceChange;
  /** Expected charge not seen by `now` — a fact about the data, scoped to it. */
  wentQuiet: boolean;
  /** A charge was reversed shortly after (likely insufficient funds). */
  paymentReturned: boolean;
  /** ≥2 series to the same merchant were detected. */
  possibleDuplicate: boolean;
};

export type DetectOptions = {
  /** ISO `YYYY-MM-DD` "now" for the wentQuiet check. Omit to skip wentQuiet. */
  now?: string;
};

// ---------------------------------------------------------------------------
// Tuning constants — all grounded in research §6.
// ---------------------------------------------------------------------------

const MINOR = 100;
const DAY_MS = 86_400_000;

/** Nominal period for each cadence, in days. */
const CADENCE_DAYS: Record<Cadence, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
};

/** Moneyhub minimum sample counts to confirm a series (research §6.2). */
const CADENCE_MIN_OCCURRENCES: Record<Cadence, number> = {
  weekly: 8,
  fortnightly: 6,
  monthly: 3,
  quarterly: 4,
  yearly: 3,
};

/** Date-drift tolerance in WORKING days (research §6.3). */
const TOLERANCE_WORKING_DAYS: Record<PaymentType, number> = {
  card: 3,
  'direct-debit': 4,
};

/** A return must land within this many days of the original charge to count. */
const RETURN_WINDOW_DAYS = 7;

/**
 * Two amounts belong to the same series when the larger is within this factor
 * of the smaller. 1.5 merges a variable utility (£28–£34) but splits two
 * distinct gym tiers (£12 vs £24).
 */
const AMOUNT_SPLIT_FACTOR = 1.5;

// ---------------------------------------------------------------------------
// Small pure helpers.
// ---------------------------------------------------------------------------

/** Lowercase, trim, collapse whitespace, strip punctuation — the group key. */
function normaliseMerchant(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,_·\-]/g, ' ')
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

/** Weekend days (Sat/Sun, UTC) that fall in the OPEN interval (aIso, bIso). */
function weekendDaysBetween(aIso: string, bIso: string): number {
  const start = toMs(aIso);
  const end = toMs(bIso);
  let count = 0;
  for (let t = start + DAY_MS; t < end; t += DAY_MS) {
    const dow = new Date(t).getUTCDay();
    if (dow === 0 || dow === 6) count += 1;
  }
  return count;
}

/**
 * Working-day distance between two ISO days — calendar gap minus the weekend
 * days strictly inside it. Used so a charge that slips over a weekend is not
 * penalised against the working-day tolerance band.
 */
function workingDaysBetween(aIso: string, bIso: string): number {
  const lo = toMs(aIso) <= toMs(bIso) ? aIso : bIso;
  const hi = toMs(aIso) <= toMs(bIso) ? bIso : aIso;
  return calendarDaysBetween(lo, hi) - weekendDaysBetween(lo, hi);
}

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) {
    return sorted[mid] as number;
  }
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

function classifyCadence(medianGapDays: number): Cadence {
  // Nearest nominal period by ratio — symmetric in log space so e.g. a 21-day
  // gap is closer to fortnightly(14) than monthly(30) by proportion.
  const cadences: Cadence[] = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'];
  let best: Cadence = 'monthly';
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
  out: Charge[]; // money-out charges (amount < 0)
  credits: Charge[]; // returns / reversals (amount > 0)
  rawNames: string[]; // raw merchant spellings, for the display label
};

// ---------------------------------------------------------------------------
// Detection.
// ---------------------------------------------------------------------------

/**
 * Detect recurring-payment signals from accepted charges. Pure: the input array
 * and its elements are never mutated; the same input yields the same output.
 *
 * @param charges accepted/imported money movements (manual rows excluded upstream)
 * @param options `now` enables the wentQuiet check
 */
export function detectRecurring(
  charges: readonly Charge[],
  options: DetectOptions = {},
): RecurringSignal[] {
  if (charges.length === 0) return [];

  const groups = groupByMerchant(charges);
  const signals: RecurringSignal[] = [];

  for (const group of groups) {
    const seriesInGroup = buildSignalsForGroup(group, options);
    // possibleDuplicate is a group-level property: ≥2 detected series (status
    // === 'series') to the same merchant. Candidates do not count toward it.
    const confirmedCount = seriesInGroup.filter((s) => s.status === 'series').length;
    const isDuplicate = confirmedCount >= 2;
    for (const s of seriesInGroup) {
      signals.push(isDuplicate ? { ...s, possibleDuplicate: true } : s);
    }
  }

  return signals;
}

function groupByMerchant(charges: readonly Charge[]): Group[] {
  const map = new Map<string, Group>();
  for (const c of charges) {
    const key = normaliseMerchant(c.merchant);
    let g = map.get(key);
    if (g === undefined) {
      g = { key, out: [], credits: [], rawNames: [] };
      map.set(key, g);
    }
    g.rawNames.push(c.merchant);
    if (c.amount < 0) g.out.push(c);
    else if (c.amount > 0) g.credits.push(c);
  }
  return [...map.values()];
}

/** Pick the most frequent raw spelling as the display label (ties → first seen). */
function displayName(rawNames: string[]): string {
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

function buildSignalsForGroup(group: Group, options: DetectOptions): RecurringSignal[] {
  // Split the merchant's out-charges into amount clusters so two distinct
  // tiers (a duplicate) become two series, while a variable bill stays one.
  const clusters = clusterByAmount(group.out);
  const label = displayName(group.rawNames);
  const out: RecurringSignal[] = [];

  for (const cluster of clusters) {
    const sig = buildSignalForCluster(cluster, group.credits, label, options);
    if (sig !== null) out.push(sig);
  }
  return out;
}

/**
 * Cluster charges by amount magnitude. Sort by |amount|, then start a new
 * cluster whenever the next magnitude exceeds the running cluster minimum by
 * more than AMOUNT_SPLIT_FACTOR. A price *rise* within a series (£9.99→£11.99)
 * stays in one cluster; two unrelated tiers (£12 vs £24) split.
 */
function clusterByAmount(outCharges: readonly Charge[]): Charge[][] {
  if (outCharges.length === 0) return [];
  const sorted = [...outCharges].sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount));
  const clusters: Charge[][] = [];
  let current: Charge[] = [];
  let clusterMin = Math.abs((sorted[0] as Charge).amount);

  for (const c of sorted) {
    const mag = Math.abs(c.amount);
    if (current.length === 0) {
      current.push(c);
      clusterMin = mag;
      continue;
    }
    if (mag > clusterMin * AMOUNT_SPLIT_FACTOR) {
      clusters.push(current);
      current = [c];
      clusterMin = mag;
    } else {
      current.push(c);
    }
  }
  if (current.length > 0) clusters.push(current);
  return clusters;
}

function buildSignalForCluster(
  cluster: readonly Charge[],
  credits: readonly Charge[],
  label: string,
  options: DetectOptions,
): RecurringSignal | null {
  if (cluster.length < 2) return null; // a single charge is not recurring

  const sorted = [...cluster].sort((a, b) => toMs(a.date) - toMs(b.date));
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    gaps.push(calendarDaysBetween((sorted[i - 1] as Charge).date, (sorted[i] as Charge).date));
  }
  const medianGap = median([...gaps].sort((a, b) => a - b));
  const cadence = classifyCadence(medianGap);

  // In-series check (research §6.3): every consecutive gap must land within the
  // cadence period ± the working-day tolerance for that pair's payment type
  // (card ≤3, Direct Debit ≤4 working days). A pair whose actual date drifts
  // beyond the band breaks the run; we keep the longest consecutive in-tolerance
  // sub-run as the confirmed series for this cluster. Working-day distance is
  // used so a charge that merely slips over a weekend is not penalised.
  const byDate = longestInToleranceRun(sorted, cadence);
  if (byDate.length < 2) return null; // no two consecutive charges held the band

  const occurrences = byDate.length;
  const status: RecurringStatus =
    occurrences >= CADENCE_MIN_OCCURRENCES[cadence] ? 'series' : 'candidate';

  const amount = amountRange(byDate);
  const priceChanged = detectPriceChange(byDate);
  const firstSeen = (byDate[0] as Charge).date;
  const lastSeen = (byDate[byDate.length - 1] as Charge).date;
  const nextExpected = isoOf(toMs(lastSeen) + CADENCE_DAYS[cadence] * DAY_MS);

  const wentQuiet = computeWentQuiet(lastSeen, cadence, byDate, options.now);
  const paymentReturned = computePaymentReturned(byDate, credits);

  const signal: RecurringSignal = {
    merchant: label,
    status,
    cadence,
    occurrences,
    amount,
    firstSeen,
    lastSeen,
    nextExpected,
    wentQuiet,
    paymentReturned,
    possibleDuplicate: false, // set at the group level in detectRecurring
  };
  // Only attach priceChanged when present (exactOptionalPropertyTypes-safe).
  return priceChanged === null ? signal : { ...signal, priceChanged };
}

/** The wider band of a consecutive pair: a Direct Debit on either side widens the
 *  tolerance to the DD window, matching the research's "DD can be over 4 working
 *  days" allowance. Charges default to `card` (the tighter ≤3 band). */
function pairToleranceWorkingDays(a: Charge, b: Charge): number {
  const cardBand = TOLERANCE_WORKING_DAYS.card;
  const ddBand = TOLERANCE_WORKING_DAYS['direct-debit'];
  const isDd = a.paymentType === 'direct-debit' || b.paymentType === 'direct-debit';
  return isDd ? ddBand : cardBand;
}

/**
 * The longest run of consecutive charges whose every step holds the cadence
 * within its working-day tolerance band. For each consecutive pair the expected
 * date is `prev + nominal cadence`; the drift is the WORKING-day distance from
 * that expected date to the actual one, compared against the pair's tolerance
 * (DD-wide when either side is a Direct Debit). The first pair that drifts beyond
 * the band ends the current run; the longest run found is returned. Pure — the
 * input is never mutated; ties resolve to the earliest (longest) run.
 */
function longestInToleranceRun(sortedByDate: readonly Charge[], cadence: Cadence): Charge[] {
  if (sortedByDate.length < 2) return [...sortedByDate];
  const nominalDays = CADENCE_DAYS[cadence];

  let best: Charge[] = [];
  let run: Charge[] = [sortedByDate[0] as Charge];
  for (let i = 1; i < sortedByDate.length; i += 1) {
    const prev = sortedByDate[i - 1] as Charge;
    const current = sortedByDate[i] as Charge;
    const expectedIso = isoOf(toMs(prev.date) + nominalDays * DAY_MS);
    const driftWorkingDays = workingDaysBetween(expectedIso, current.date);
    if (driftWorkingDays <= pairToleranceWorkingDays(prev, current)) {
      run.push(current);
    } else {
      if (run.length > best.length) best = run;
      run = [current];
    }
  }
  if (run.length > best.length) best = run;
  return best;
}

function amountRange(byDate: readonly Charge[]): AmountRange {
  const magsMinor = byDate.map((c) => Math.round(Math.abs(c.amount) * MINOR));
  const lowerMinor = Math.min(...magsMinor);
  const upperMinor = Math.max(...magsMinor);
  return { lowerMinor, upperMinor, variable: lowerMinor !== upperMinor };
}

/**
 * A sustained step: the amount changes from one stable level to a higher (or
 * lower) stable level and stays there. Reported as the first→last distinct
 * level transition observed. Returns null for fixed or merely noisy amounts.
 */
function detectPriceChange(byDate: readonly Charge[]): PriceChange | null {
  const magsMinor = byDate.map((c) => Math.round(Math.abs(c.amount) * MINOR));
  const first = magsMinor[0] as number;
  const last = magsMinor[magsMinor.length - 1] as number;
  if (first === last) return null;

  // Find the first index whose amount differs from the opening level AND holds
  // through to the end (a sustained step, not a one-off blip).
  for (let i = 1; i < magsMinor.length; i += 1) {
    const level = magsMinor[i] as number;
    if (level === first) continue;
    const holds = magsMinor.slice(i).every((m) => m === level);
    if (holds) {
      return { fromMinor: first, toMinor: level, atDate: (byDate[i] as Charge).date };
    }
  }
  return null;
}

/**
 * wentQuiet: a confirmed series' next charge was expected by `now` but no
 * charge has been seen since `lastSeen`. Scoped strictly to what the data
 * showed — it is NOT "you cancelled". Requires `now`; without it, false.
 */
function computeWentQuiet(
  lastSeen: string,
  cadence: Cadence,
  byDate: readonly Charge[],
  now: string | undefined,
): boolean {
  if (now === undefined) return false;
  if (byDate.length < 2) return false;
  // Grace: one cadence period plus a working-week of slack before we call it quiet.
  const graceDays = CADENCE_DAYS[cadence] + 7;
  const expectedBy = toMs(lastSeen) + graceDays * DAY_MS;
  return toMs(now) > expectedBy;
}

/**
 * paymentReturned: a credit (positive amount) to the same merchant whose
 * magnitude matches an out-charge and lands within RETURN_WINDOW_DAYS after it
 * — the Moneyhub "returned payment, likely insufficient funds" signal.
 */
function computePaymentReturned(
  byDate: readonly Charge[],
  credits: readonly Charge[],
): boolean {
  if (credits.length === 0) return false;
  for (const credit of credits) {
    const creditMinor = Math.round(Math.abs(credit.amount) * MINOR);
    for (const charge of byDate) {
      const chargeMinor = Math.round(Math.abs(charge.amount) * MINOR);
      if (creditMinor !== chargeMinor) continue;
      const lag = calendarDaysBetween(charge.date, credit.date);
      if (lag >= 0 && lag <= RETURN_WINDOW_DAYS) return true;
    }
  }
  return false;
}
