/**
 * Pot top-up cadence engine — ENGINES.md §6 "Pot top-up cadence — after income
 * arrives" (and §7 @rn-engine pot-cadence).
 *
 * The web prototype hardcodes a Friday pot top-up in `deriveCalendarEvents`.
 * That is a bug: a fixed Friday lies in any month where Friday is the day before
 * payday. This engine resolves a pot's real `cadence` to the next concrete
 * top-up date instead:
 *
 *   - after-payday : the next payday date (the only honest default — money goes
 *                    to pots after it arrives). If no payday is known, returns
 *                    the ASK_USER sentinel so onboarding asks before offering
 *                    after-payday as the default. NEVER a guessed date, never
 *                    silently Friday.
 *   - weekly       : the next occurrence of the user-picked weekday (0 = Sun ..
 *                    6 = Sat), on or after `now`.
 *   - monthly      : the next occurrence of the user-picked day-of-month,
 *                    clamped with the SAME rule as payday (Feb 31 -> Feb 28/29,
 *                    never March) by delegating to `resolvePayday` from the
 *                    sibling payday engine.
 *   - custom       : the user re-picks each time; their date is returned
 *                    verbatim, the engine does not second-guess it.
 *
 * Pure and deterministic: no I/O, no react-native, no DOM, no local-timezone
 * dependence. Dates are plain ISO "YYYY-MM-DD" strings (which sort lexically, so
 * comparisons are string compares); the only `Date` use is UTC construction to
 * read a weekday, which is timezone-immune. The cadence shape comes from the
 * data spine `@/folio/store`, imported relatively as `../store` so the
 * pure-logic test runner (no `@` alias) resolves it.
 */

import type { PotCadence } from '../store';
import { resolvePayday } from './payday';

const ISO_DATE_LENGTH = 10; // "YYYY-MM-DD"
const DAYS_PER_WEEK = 7;

/** Context the resolver needs. All dates are ISO "YYYY-MM-DD". */
export type TopUpContext = {
  /** "Today", as an ISO date. The resolution is computed on/after this day. */
  now: string;
  /** The next known payday (ISO date), if the app knows one. Drives the
   *  `after-payday` cadence; absent OR explicitly `undefined` -> ASK_USER.
   *  `string | undefined` (not bare optional) so callers under
   *  exactOptionalPropertyTypes may pass an undefined that flowed in from an
   *  optional store read or spread — the engine treats both as "no payday". */
  nextPayday?: string | undefined;
};

/**
 * The outcome of resolving a cadence. Either a concrete ISO date, or the
 * `ask-user` sentinel meaning "Folio cannot honestly pick a date yet — ask".
 * A discriminated union is used rather than a magic string so the sentinel can
 * never be mistaken for a real date by a caller.
 */
export type TopUpResolution = { kind: 'date'; date: string } | { kind: 'ask-user' };

/**
 * Sentinel returned when `after-payday` is requested but no payday is known.
 * Frozen so callers cannot mutate the shared value. Per ENGINES.md §6: "If no
 * payday is known, onboarding asks before offering `after-payday` as the
 * default."
 */
export const ASK_USER: TopUpResolution = Object.freeze({ kind: 'ask-user' });

/** Parsed Y/M/D triple. Months are 1-based here (1 = January). */
type Ymd = { year: number; month: number; day: number };

const MILLIS_PER_DAY = 86_400_000;

/**
 * Parse an ISO "YYYY-MM-DD" into a 1-based Y/M/D. Throws on malformed input —
 * this is an engine boundary; bad input must fail fast, not silently produce a
 * NaN date.
 */
function parseIsoDate(date: string): Ymd {
  if (date.length < ISO_DATE_LENGTH) {
    throw new Error(`potCadence: expected "YYYY-MM-DD", got "${date}"`);
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
    throw new Error(`potCadence: expected "YYYY-MM-DD", got "${date}"`);
  }
  return { year, month, day };
}

/** "YYYY-MM" slice of an ISO date (the year-month `resolvePayday` expects). */
function yearMonthOf(ymd: Ymd): string {
  const mm = ymd.month < 10 ? `0${ymd.month}` : String(ymd.month);
  return `${ymd.year}-${mm}`;
}

/** UTC milliseconds for a Y/M/D triple (timezone-immune day arithmetic). */
function utcMillis({ year, month, day }: Ymd): number {
  return Date.UTC(year, month - 1, day);
}

/** 0 = Sunday … 6 = Saturday, read in UTC so local tz never shifts the day. */
function weekdayOf(ymd: Ymd): number {
  return new Date(utcMillis(ymd)).getUTCDay();
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

/**
 * Next ISO date (on/after `now`) whose UTC weekday equals `weekday` (0..6).
 * Walks forward 0..6 days — when `now` already IS the target weekday, returns
 * `now` itself.
 */
function nextWeekday(now: Ymd, weekday: number): string {
  const target = ((Math.trunc(weekday) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const current = weekdayOf(now);
  const delta = (((target - current) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return isoFromMillis(utcMillis(now) + delta * MILLIS_PER_DAY);
}

/**
 * Next ISO date (on/after `now`) for a monthly day-of-month, clamped with the
 * payday engine's rule (Feb 31 -> Feb 28/29, never overflow into March). Tries
 * this month first; if that resolved date is strictly before `now`, rolls to
 * the next month and resolves again. ISO dates sort lexically, so the compare
 * is a plain string compare.
 */
function nextMonthlyDay(now: Ymd, dayOfMonth: number): string {
  const thisMonth = resolvePayday({ dayOfMonth }, yearMonthOf(now));
  const nowIso = isoFromMillis(utcMillis(now));
  if (thisMonth >= nowIso) return thisMonth;
  return resolvePayday({ dayOfMonth }, nextYearMonth(now));
}

/**
 * Resolve a pot's top-up cadence to the next concrete top-up date, or the
 * ASK_USER sentinel when an `after-payday` pot has no known payday.
 */
export function resolveNextTopUp(cadence: PotCadence, ctx: TopUpContext): TopUpResolution {
  switch (cadence.kind) {
    case 'after-payday': {
      if (ctx.nextPayday === undefined) return ASK_USER;
      return { kind: 'date', date: ctx.nextPayday };
    }
    case 'weekly': {
      const now = parseIsoDate(ctx.now);
      return { kind: 'date', date: nextWeekday(now, cadence.weekday) };
    }
    case 'monthly': {
      const now = parseIsoDate(ctx.now);
      return { kind: 'date', date: nextMonthlyDay(now, cadence.dayOfMonth) };
    }
    case 'custom': {
      return { kind: 'date', date: cadence.nextDate };
    }
  }
}
