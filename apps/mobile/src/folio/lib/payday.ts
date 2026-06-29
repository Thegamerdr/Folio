/**
 * Payday-clamp engine — ENGINES.md §6 "Payday — overflow + weekends + holidays"
 * (and §7 @rn-engine payday-clamp).
 *
 * Resolves a recurring day-of-month payday rule to a concrete calendar date for
 * a given month, with two corrections the prototype's raw JS `Date` math gets
 * wrong:
 *
 *   (1) Month-overflow clamp. "Paid on the 31st" in February resolves to Feb 28
 *       (or 29 in a leap year), never overflowing to March. JS `new Date(y, 1,
 *       31)` silently rolls to Mar 3 — that throws the whole path off by days,
 *       so we clamp to the last valid day of the month instead.
 *   (2) Weekend shift. UK payroll convention pays early when a date lands on a
 *       weekend. Default `weekendRule: "previous"` (the working day before);
 *       `"next"` moves to the following Monday; `"exact"` leaves it untouched.
 *
 * UK bank holidays are post-MVP. `isBusinessDay(date)` is the documented hook —
 * for now it reports weekends-only; the holiday lookup wires in later without
 * changing this contract.
 *
 * Pure and deterministic: no I/O, no react-native, no DOM, no local-timezone
 * dependence. All arithmetic is on plain numbers; the only `Date` use is a
 * UTC construction purely to read a weekday, which is timezone-immune. Types,
 * if needed, come from the data spine `@/folio/store`, imported relatively as
 * `../store` so the pure-logic test runner (no `@` alias) resolves it.
 */

/** How to handle a payday that lands on a Saturday or Sunday. */
export type WeekendRule = 'previous' | 'next' | 'exact';

/** A recurring day-of-month payday rule (income, bill, sub, pot top-up). */
export type PaydayRule = {
  /** 1..31. Clamped to the month's last valid day when it overflows. */
  dayOfMonth: number;
  /** Default `"previous"` (UK payroll convention). */
  weekendRule?: WeekendRule;
};

const ISO_DATE_LENGTH = 10; // "YYYY-MM-DD"
const SATURDAY = 6;
const SUNDAY = 0;
const DEFAULT_WEEKEND_RULE: WeekendRule = 'previous';

/** Parsed Y/M/D triple. Months are 1-based here (1 = January). */
type Ymd = { year: number; month: number; day: number };

/**
 * Days in a given 1-based month, honouring leap years. `new Date(y, m, 0)`
 * (day 0 of the *next* month = last day of this month) is the standard trick;
 * we read it back via UTC to stay timezone-immune.
 */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday, read in UTC so local tz never shifts the day. */
function weekdayOf({ year, month, day }: Ymd): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Zero-pad a positive integer to two digits ("3" -> "03"). */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatYmd({ year, month, day }: Ymd): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Parse "YYYY-MM" into a 1-based year/month. Throws on malformed input — this
 * is an engine boundary; bad input must fail fast, not silently produce NaN.
 */
function parseYearMonth(yearMonth: string): { year: number; month: number } {
  const parts = yearMonth.split('-');
  if (parts.length !== 2) {
    throw new Error(`resolvePayday: expected "YYYY-MM", got "${yearMonth}"`);
  }
  const yearPart = parts[0] ?? '';
  const monthPart = parts[1] ?? '';
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    yearPart.length !== 4 ||
    month < 1 ||
    month > 12
  ) {
    throw new Error(`resolvePayday: expected "YYYY-MM", got "${yearMonth}"`);
  }
  return { year, month };
}

/** Step a Y/M/D triple by ±1 day, rolling across month/year boundaries. */
function addOneDay({ year, month, day }: Ymd, direction: 1 | -1): Ymd {
  const next = new Date(Date.UTC(year, month - 1, day + direction));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

/**
 * Shift a weekend date to the nearest working day per the rule. `"previous"`
 * walks back, `"next"` walks forward, `"exact"` returns the date untouched.
 * Walking (rather than fixed ±1/±2) keeps the door open for the post-MVP
 * bank-holiday lookup: once `isBusinessDay` knows about holidays, the same loop
 * skips them too.
 */
function shiftForWeekend(ymd: Ymd, rule: WeekendRule): Ymd {
  if (rule === 'exact') return ymd;
  const direction: 1 | -1 = rule === 'next' ? 1 : -1;
  let cursor = ymd;
  while (!isBusinessDayYmd(cursor)) {
    cursor = addOneDay(cursor, direction);
  }
  return cursor;
}

function isBusinessDayYmd(ymd: Ymd): boolean {
  const weekday = weekdayOf(ymd);
  return weekday !== SATURDAY && weekday !== SUNDAY;
}

/**
 * Resolve a recurring day-of-month payday rule to a concrete ISO date
 * ("YYYY-MM-DD") for the given month ("YYYY-MM").
 *
 * Order is clamp-then-shift: first pin an out-of-range day to the month's last
 * valid day, then move off any weekend per `weekendRule`. The shift may cross a
 * month boundary (e.g. `"next"` from Oct 31 Sat -> Nov 2 Mon); that is correct —
 * the working day genuinely falls in the next month.
 */
export function resolvePayday(rule: PaydayRule, yearMonth: string): string {
  const { year, month } = parseYearMonth(yearMonth);
  const rawDay = Math.trunc(rule.dayOfMonth);
  // Clamp into [1 .. lastDayOfMonth]. Defensive on the low end too: a 0/negative
  // day-of-month is nonsense, so pin it to the 1st rather than overflow backward.
  const lastValid = daysInMonth(year, month);
  const day = Math.min(Math.max(rawDay, 1), lastValid);

  const clamped: Ymd = { year, month, day };
  const weekendRule = rule.weekendRule ?? DEFAULT_WEEKEND_RULE;
  return formatYmd(shiftForWeekend(clamped, weekendRule));
}

/**
 * Whether an ISO date ("YYYY-MM-DD") is a UK working day.
 *
 * MVP: weekends-only — Saturday and Sunday are non-business, everything else is
 * business. UK bank holidays are post-MVP (documented hook): the holiday lookup
 * slots in here later without changing the signature. Read in UTC so the answer
 * never depends on the runtime's local timezone.
 */
export function isBusinessDay(date: string): boolean {
  if (date.length < ISO_DATE_LENGTH) {
    throw new Error(`isBusinessDay: expected "YYYY-MM-DD", got "${date}"`);
  }
  const parts = date.slice(0, ISO_DATE_LENGTH).split('-');
  const yearPart = parts[0] ?? '';
  const monthPart = parts[1] ?? '';
  const dayPart = parts[2] ?? '';
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error(`isBusinessDay: expected "YYYY-MM-DD", got "${date}"`);
  }
  return isBusinessDayYmd({ year, month, day });
}
