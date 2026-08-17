/**
 * Income-cadence engine — Phase ① of the data-intelligence program.
 *
 * Today the store carries only `onboarding.payday` (day-of-month) +
 * `monthlyIncome`, and `calendarEvents.ts` injects ONE monthly income lump for
 * every user via `nextDayOfMonth`. That is wrong for anyone not paid monthly on
 * a fixed day: weekly, fortnightly, four-weekly, and last-working-day earners
 * all get the wrong "next payday" and the wrong in-window income total.
 *
 * `IncomeSource` (see `../store`) generalises "one recurring pay event" to five
 * cadences. This module is the SINGLE place that turns a list of sources into
 * dated events / the next occurrence — every caller (calendarEvents,
 * storeRoute, notifications, the home widget) must go through
 * `projectIncomeEvents` / `nextIncomeDate` / `daysToNextIncome` rather than
 * re-deriving payday math locally, so behaviour never drifts between screens.
 *
 * Cadence resolution rules:
 *   - monthly          : `dayOfMonth`, resolved via the existing `resolvePayday`
 *                         engine (Feb-31 clamp + weekend-previous shift). This
 *                         is the ONLY cadence that reuses payday.ts's rules —
 *                         they are not redefined here.
 *   - weekly           : `anchorISO` + 7-day steps.
 *   - fortnightly      : `anchorISO` + 14-day steps.
 *   - four-weekly      : `anchorISO` + 28-day steps.
 *   - last-working-day : the last non-weekend day of each calendar month
 *                         (walks backward from the month's last day, skipping
 *                         Sat/Sun — mirrors `isBusinessDay` from payday.ts).
 *
 * Pure and deterministic: no I/O, no react-native, no DOM, no local-timezone
 * dependence. All dates are plain ISO "YYYY-MM-DD" strings, which sort
 * lexically, so every comparison here is a plain string compare. The only
 * `Date` use is UTC construction to read a weekday or step by whole days, which
 * is timezone-immune. Types come from the data spine `@/folio/store`, imported
 * relatively as `../store` so the pure-logic test runner (no `@` alias)
 * resolves it.
 */

import { bankAnalyticsTransactions, type AppState, type IncomeSource } from '../store';
import { workspaceLocalDate } from './workspaceRoot';
import { isBusinessDay, resolvePayday } from './payday';
import { monthlyEquivalent } from './driftSignals';
import { monthlySpendBaseline, monthlyIncomeSeries, percentile } from './historyStats';

const ISO_DATE_LENGTH = 10; // "YYYY-MM-DD"
const MILLIS_PER_DAY = 86_400_000;
const CADENCE_STEP_DAYS: Record<'weekly' | 'fortnightly' | 'four-weekly', number> = {
  weekly: 7,
  fortnightly: 14,
  'four-weekly': 28,
};

/** Parsed Y/M/D triple. Months are 1-based here (1 = January). */
type Ymd = { year: number; month: number; day: number };

/**
 * Parse an ISO "YYYY-MM-DD" into a 1-based Y/M/D. Throws on malformed input —
 * this is an engine boundary; bad input must fail fast, not silently produce a
 * NaN date. Mirrors `payday.ts`'s / `potCadence.ts`'s own parsers.
 */
function parseIsoDate(date: string): Ymd {
  if (date.length < ISO_DATE_LENGTH) {
    throw new Error(`income: expected "YYYY-MM-DD", got "${date}"`);
  }
  const parts = date.slice(0, ISO_DATE_LENGTH).split('-');
  const yearPart = parts[0] ?? '';
  const monthPart = parts[1] ?? '';
  const dayPart = parts[2] ?? '';
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    yearPart.length !== 4 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error(`income: expected "YYYY-MM-DD", got "${date}"`);
  }
  return { year, month, day };
}

/** "YYYY-MM" slice of a Y/M/D (the year-month `resolvePayday` expects). */
function yearMonthOf(ymd: Ymd): string {
  const mm = ymd.month < 10 ? `0${ymd.month}` : String(ymd.month);
  return `${ymd.year}-${mm}`;
}

/** UTC milliseconds for a Y/M/D triple (timezone-immune day arithmetic). */
function utcMillis({ year, month, day }: Ymd): number {
  return Date.UTC(year, month - 1, day);
}

/** Format UTC milliseconds back to an ISO "YYYY-MM-DD". */
function isoFromMillis(ms: number): string {
  return new Date(ms).toISOString().slice(0, ISO_DATE_LENGTH);
}

/** The "YYYY-MM" one calendar month after the given month. */
function nextYearMonth(ymd: Ymd): string {
  const month = ymd.month === 12 ? 1 : ymd.month + 1;
  const year = ymd.month === 12 ? ymd.year + 1 : ymd.year;
  const mm = month < 10 ? `0${month}` : String(month);
  return `${year}-${mm}`;
}

/** Days in a given 1-based month, honouring leap years (same trick as payday.ts). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The last non-weekend day of the month containing `ymd`'s year/month, as an
 * ISO date. Walks backward from the month's last calendar day, skipping
 * Sat/Sun — the same "walk to the nearest business day" idea `payday.ts` uses
 * for its weekend shift, but always walking backward (a payday is never moved
 * INTO the next month by this cadence).
 */
function lastWorkingDayOfMonth(year: number, month: number): string {
  const lastDay = daysInMonth(year, month);
  let ms = utcMillis({ year, month, day: lastDay });
  while (new Date(ms).getUTCDay() === 0 || new Date(ms).getUTCDay() === 6) {
    ms -= MILLIS_PER_DAY;
  }
  return isoFromMillis(ms);
}

/**
 * Next last-working-day occurrence on/after `now`. Tries the current month
 * first; if that resolved date is strictly before `now`, rolls to next month.
 */
function nextLastWorkingDay(now: Ymd): string {
  const nowIso = isoFromMillis(utcMillis(now));
  const thisMonth = lastWorkingDayOfMonth(now.year, now.month);
  if (thisMonth >= nowIso) return thisMonth;
  const nextYear = now.month === 12 ? now.year + 1 : now.year;
  const nextMonth = now.month === 12 ? 1 : now.month + 1;
  return lastWorkingDayOfMonth(nextYear, nextMonth);
}

/**
 * Shift a weekend-landing date to the working day before it, same rule
 * `payday.ts`'s default `weekendRule: "previous"` applies to monthly paydays
 * (UK payroll convention: pay early when a date lands on a weekend). Reuses
 * `isBusinessDay` rather than redefining the weekend check here. Walking
 * (rather than a fixed -1/-2) keeps the door open for the same post-MVP
 * bank-holiday lookup `payday.ts` documents.
 *
 * IMPORTANT: this shifts only the *emitted* date, never the anchor grid
 * itself — `nextFromAnchor` still computes `anchorISO + k*stepDays` on the
 * unshifted grid, so next week's occurrence is `thisShiftedDate's unshifted
 * grid date + stepDays`, not `thisShiftedDate + stepDays` (which would drift
 * the whole cadence earlier every time it crosses a weekend).
 */
function shiftWeekendToPrevious(iso: string): string {
  let ms = utcMillis(parseIsoDate(iso));
  while (!isBusinessDay(isoFromMillis(ms))) {
    ms -= MILLIS_PER_DAY;
  }
  return isoFromMillis(ms);
}

/**
 * A week-based cadence's resolved occurrence: the UNSHIFTED anchor-grid date
 * (`anchorISO + k*stepDays`, used to advance a search cursor without ever
 * re-visiting the same grid cell) alongside the weekend-shifted date that is
 * actually paid/emitted. Kept as two fields rather than one string because a
 * caller stepping "past this occurrence" must step past the GRID date, not
 * the shifted one — see `projectIncomeEvents`'s cursor-advance comment for
 * why collapsing these to a single shifted date causes an infinite loop.
 */
type AnchorOccurrence = { gridIso: string; shiftedIso: string };

/**
 * Next occurrence (on/after `now`) of a week-based cadence anchored at
 * `anchorISO`, stepping by `stepDays`. Steps forward (or, if the anchor is in
 * the future relative to `now`, backward) by whole multiples of `stepDays` so
 * the returned grid date is the smallest anchor-aligned date that is >= `now`.
 * Anchor drift is by construction: every occurrence is `anchorISO + k*stepDays`
 * for some integer k, so a month boundary never resets the cycle — the grid
 * arithmetic below operates on the UNSHIFTED anchor date; only the returned
 * `shiftedIso` is moved off a weekend (UK payday convention, matching
 * `payday.ts`'s monthly weekend-previous rule). Because the shift only ever
 * moves a date backward by up to two days, it can never cross past `now` and
 * produce a stale result relative to the `Math.ceil` selection above it — if
 * the grid date was `>= now`, the shifted (earlier) date is still the payday
 * for that cycle, not an earlier cycle's.
 */
function nextFromAnchor(nowIso: string, anchorIso: string, stepDays: number): AnchorOccurrence {
  const nowMs = utcMillis(parseIsoDate(nowIso));
  const anchorMs = utcMillis(parseIsoDate(anchorIso));
  const stepMs = stepDays * MILLIS_PER_DAY;
  const diff = nowMs - anchorMs;
  // How many whole steps separate now from the anchor. Math.ceil so we land on
  // the first anchor-aligned date that is >= now (never strictly before).
  const steps = Math.ceil(diff / stepMs);
  const gridIso = isoFromMillis(anchorMs + steps * stepMs);
  return { gridIso, shiftedIso: shiftWeekendToPrevious(gridIso) };
}

/**
 * Next occurrence (on/after `now`) of a monthly day-of-month, clamped with the
 * payday engine's rule (Feb 31 -> Feb 28/29, never overflow into March). Tries
 * this month first; if that resolved date is strictly before `now`, rolls to
 * the next month.
 */
function nextMonthlyDay(now: Ymd, dayOfMonth: number): string {
  const thisMonth = resolvePayday({ dayOfMonth }, yearMonthOf(now));
  const nowIso = isoFromMillis(utcMillis(now));
  if (thisMonth >= nowIso) return thisMonth;
  return resolvePayday({ dayOfMonth }, nextYearMonth(now));
}

/**
 * A resolved occurrence plus the cursor value a caller must search PAST to
 * find the following occurrence. For monthly/last-working-day cadences these
 * are the same value (each calendar month has exactly one occurrence, so
 * stepping past the emitted date is always safe). For week-based cadences
 * they can differ: `date` is the weekend-shifted, actually-paid date, while
 * `seekPast` is the UNSHIFTED anchor-grid date — stepping past the shifted
 * date instead would let the next search re-derive and re-emit the SAME grid
 * occurrence forever whenever a shift moved it backward across the cursor.
 */
type Occurrence = { date: string; seekPast: string };

/**
 * Resolve a single income source's next occurrence on/after `fromIso`. Throws
 * if a week-based cadence is missing its `anchorISO`, or `monthly` is missing
 * its `dayOfMonth` — these are engine-boundary contract violations (the store
 * setters/migration must always populate the field the cadence requires), not
 * something to silently guess around.
 */
function nextOccurrence(source: IncomeSource, fromIso: string): Occurrence {
  switch (source.cadence) {
    case 'monthly': {
      if (source.dayOfMonth === undefined) {
        throw new Error(`income: monthly source "${source.id}" is missing dayOfMonth`);
      }
      const date = nextMonthlyDay(parseIsoDate(fromIso), source.dayOfMonth);
      return { date, seekPast: date };
    }
    case 'last-working-day': {
      const date = nextLastWorkingDay(parseIsoDate(fromIso));
      return { date, seekPast: date };
    }
    case 'weekly':
    case 'fortnightly':
    case 'four-weekly': {
      if (source.anchorISO === undefined) {
        throw new Error(`income: ${source.cadence} source "${source.id}" is missing anchorISO`);
      }
      const { gridIso, shiftedIso } = nextFromAnchor(
        fromIso,
        source.anchorISO,
        CADENCE_STEP_DAYS[source.cadence],
      );
      return { date: shiftedIso, seekPast: gridIso };
    }
  }
}

/** One projected income event — a single source firing on a single date. */
export type IncomeEvent = {
  sourceId: string;
  label: string;
  /** ISO "YYYY-MM-DD". */
  date: string;
  amount: number;
};

/**
 * Project every income source's occurrences inside `[fromIso, fromIso +
 * windowDays]` (inclusive both ends), sorted by date then by the sources'
 * original order for a stable tie-break on same-day pay events. Each source
 * may fire more than once inside a long enough window (e.g. a weekly wage over
 * a 35-day window fires 5-6 times); every occurrence is a distinct event.
 *
 * Pure — no state, no clock reads (both `fromIso` and every source's own
 * anchor/day-of-month are inputs).
 */
export function projectIncomeEvents(
  sources: readonly IncomeSource[],
  fromIso: string,
  windowDays: number,
): IncomeEvent[] {
  const events: IncomeEvent[] = [];
  const windowEndIso = isoFromMillis(
    utcMillis(parseIsoDate(fromIso)) + windowDays * MILLIS_PER_DAY,
  );
  for (const source of sources) {
    let cursor = fromIso;
    // Guard against a pathological zero/near-zero step producing an infinite
    // loop; every real cadence steps forward by at least a day per iteration.
    let guard = 0;
    const MAX_ITER = 1000;
    while (cursor <= windowEndIso && guard < MAX_ITER) {
      const { date, seekPast } = nextOccurrence(source, cursor);
      if (date > windowEndIso) break;
      events.push({
        sourceId: source.id,
        label: source.label,
        date,
        amount: source.amount,
      });
      // Step past `seekPast` (the UNSHIFTED anchor-grid date for week-based
      // cadences, same as `date` for monthly/last-working-day) so the next
      // iteration finds the FOLLOWING occurrence, not the same one again.
      // Stepping past the emitted `date` instead would loop forever whenever a
      // weekend shift moves `date` earlier than `seekPast` — the next search
      // would land back inside the same grid cell and re-emit it endlessly.
      cursor = isoFromMillis(utcMillis(parseIsoDate(seekPast)) + MILLIS_PER_DAY);
      guard++;
    }
  }
  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return events;
}

/**
 * The single next income date across every source, on/after `todayIso`. `null`
 * when there are no sources (the legacy single-payday path is the caller's
 * fallback in that case). Pure.
 */
export function nextIncomeDate(sources: readonly IncomeSource[], todayIso: string): string | null {
  if (sources.length === 0) return null;
  let earliest: string | null = null;
  for (const source of sources) {
    const { date } = nextOccurrence(source, todayIso);
    if (earliest === null || date < earliest) earliest = date;
  }
  return earliest;
}

/**
 * Whole days from `todayIso` to the next income date across every source.
 * `null` when there are no sources. 0 when income lands today.
 */
export function daysToNextIncome(
  sources: readonly IncomeSource[],
  todayIso: string,
): number | null {
  const next = nextIncomeDate(sources, todayIso);
  if (next === null) return null;
  const todayMs = utcMillis(parseIsoDate(todayIso));
  const nextMs = utcMillis(parseIsoDate(next));
  return Math.round((nextMs - todayMs) / MILLIS_PER_DAY);
}

// ---------------------------------------------------------------------------
// Canonical income/spend selectors (task: SURFACE SELECTOR PROMOTION).
//
// THE monthly income figure every surface must read — promoted here (out of
// `lib/meloSnapshot.ts`, which now just re-exports `liveMonthlyIncome` for
// back-compat) so it lives beside the cadence engine it depends on, with zero
// new folio runtime imports (this module already imports `AppState` type-only
// + `driftSignals`' `monthlyEquivalent`, which has no folio imports itself).
// ---------------------------------------------------------------------------

/**
 * THE canonical monthly-equivalent income figure: summed across every declared
 * `IncomeSource` (cadence-normalised via `monthlyEquivalent`) when the user has
 * declared sources; otherwise falls back to the legacy `onboarding.monthlyIncome`
 * lump. When NEITHER exists (no declared sources AND the legacy lump is 0/unset)
 * but real transaction history is present, falls back further to the MEDIAN of
 * `monthlyIncomeSeries` (past-month realized credits) — an honest estimate
 * grounded in the ledger rather than a hard zero. Every surface that needs "the
 * user's monthly income" must call this — never re-read `onboarding.monthlyIncome`
 * or re-sum `incomeSources` directly, so behaviour never drifts between screens.
 *
 * Pure: reads only `state.incomeSources`, `state.onboarding.monthlyIncome`, and
 * (only when both of those are empty/zero) the ledger.
 *
 * BANK-ONLY (ACCOUNTS_MODEL.md §2.4): the history fallback reads `bankTransactions(state)`, not
 * `state.transactions` raw — a credit-card statement's "salary" — like large credits (refunds,
 * transfers) must never inflate the bank-side income estimate. Inert on a single-account (migrated)
 * install (no liability accounts to exclude).
 */
export function selectMonthlyIncome(state: AppState): number {
  const incomeSources = state.incomeSources ?? [];
  if (incomeSources.length > 0) {
    return incomeSources.reduce((sum, src) => sum + monthlyEquivalent(src.amount, src.cadence), 0);
  }
  if (state.onboarding.monthlyIncome > 0) return state.onboarding.monthlyIncome;

  // No declared income at all — estimate from realized history rather than
  // reporting a hard, misleading £0 when the ledger clearly shows credits.
  const todayIso = workspaceLocalDate(state);
  const series = monthlyIncomeSeries(bankAnalyticsTransactions(state), todayIso);
  return percentile(series, 50);
}

/**
 * THE canonical monthly realized-spend figure: the median past-month debit
 * total across the ledger (`historyStats.ts`'s `monthlySpendBaseline`, scoped to ALL categories). `0`
 * when there is no spend history yet — callers must treat that as "no data", not "no spending". Pure.
 *
 * BANK-ONLY (ACCOUNTS_MODEL.md §2.4): reads `bankTransactions(state)` — a credit-card's spend is
 * borrowing, not bank outflow, and must never inflate this figure. Inert on a single-account
 * (migrated) install.
 */
export function selectMonthlySpend(state: AppState): number {
  const todayIso = workspaceLocalDate(state);
  return monthlySpendBaseline(bankAnalyticsTransactions(state), todayIso).medianMonthlySpend;
}

/**
 * Whether the user has entered ANY real data — imported transactions, declared income sources, or a
 * non-sample balance. Distinct from `onboarding.done` (the onboarding-sheet completion flag): a user
 * who bulk-imports a statement without ever opening onboarding has real data but `onboarding.done` is
 * still `false`, so gating the "sample numbers" nudge on `!onboarding.done` alone nags someone who
 * already imported 2000 transactions. Every "is this still sample data?" check should use this
 * instead of (or alongside) `onboarding.done`. Pure.
 */
export function hasAnyUserData(state: AppState): boolean {
  return (
    state.transactions.length > 0 ||
    (state.incomeSources?.length ?? 0) > 0 ||
    state.currentBalance.source !== 'sample'
  );
}
