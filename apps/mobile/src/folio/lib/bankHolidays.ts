/**
 * Versioned England/Wales bank-holiday rules used by launch payday calculations. The recurring
 * statutory pattern is deterministic; any future one-off proclamation must be added to
 * `EXCEPTIONAL_HOLIDAYS` with a policy-version bump before the supported period is extended.
 */
export const BANK_HOLIDAY_POLICY = {
  version: 'gb-eng-bank-holidays-2024-2035-v1',
  jurisdiction: 'GB-ENG',
  effectiveFrom: '2024-01-01',
  expiresAfter: '2035-12-31',
  sourceReference: 'UK bank-holiday statutory recurring calendar',
} as const;

const EXCEPTIONAL_HOLIDAYS = new Set<string>();
const MIN_YEAR = 2024;
const MAX_YEAR = 2035;
const MILLIS_PER_DAY = 86_400_000;

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateParts(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value.slice(0, 10));
  if (match === null) throw new Error(`bank holidays: expected YYYY-MM-DD, got "${value}"`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`bank holidays: expected a valid YYYY-MM-DD, got "${value}"`);
  }
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`bank holidays: expected a valid YYYY-MM-DD, got "${value}"`);
  }
  return { year, month, day };
}

function assertPolicyYear(year: number): void {
  if (year < MIN_YEAR || year > MAX_YEAR) {
    throw new Error(
      `Bank-holiday policy ${BANK_HOLIDAY_POLICY.version} does not cover year ${year}.`,
    );
  }
}

function addDays(value: string, days: number): string {
  const { year, month, day } = dateParts(value);
  return new Date(Date.UTC(year, month - 1, day) + days * MILLIS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

function weekday(value: string): number {
  const { year, month, day } = dateParts(value);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function mondayInMonth(year: number, month: number, fromStart: boolean): string {
  const day = fromStart ? 1 : new Date(Date.UTC(year, month, 0)).getUTCDate();
  let value = iso(year, month, day);
  while (weekday(value) !== 1) value = addDays(value, fromStart ? 1 : -1);
  return value;
}

/** Anonymous Gregorian algorithm. Returns Easter Sunday. */
function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

function addFixedHolidayWithSubstitute(holidays: Set<string>, value: string): void {
  const day = weekday(value);
  if (day !== 0 && day !== 6) {
    holidays.add(value);
    return;
  }
  let substitute = addDays(value, day === 6 ? 2 : 1);
  while (holidays.has(substitute) || weekday(substitute) === 0 || weekday(substitute) === 6) {
    substitute = addDays(substitute, 1);
  }
  holidays.add(substitute);
}

export function englandWalesBankHolidays(year: number): ReadonlySet<string> {
  if (!Number.isInteger(year)) throw new Error('bank holidays: expected an integer year');
  assertPolicyYear(year);
  const holidays = new Set<string>();
  addFixedHolidayWithSubstitute(holidays, iso(year, 1, 1));
  const easter = easterSunday(year);
  holidays.add(addDays(easter, -2));
  holidays.add(addDays(easter, 1));
  holidays.add(mondayInMonth(year, 5, true));
  holidays.add(mondayInMonth(year, 5, false));
  holidays.add(mondayInMonth(year, 8, false));
  addFixedHolidayWithSubstitute(holidays, iso(year, 12, 25));
  addFixedHolidayWithSubstitute(holidays, iso(year, 12, 26));
  for (const exceptional of EXCEPTIONAL_HOLIDAYS) {
    if (exceptional.startsWith(`${year}-`)) holidays.add(exceptional);
  }
  return holidays;
}

export function isEnglandWalesBankHoliday(value: string): boolean {
  const { year } = dateParts(value);
  assertPolicyYear(year);
  return englandWalesBankHolidays(year).has(value.slice(0, 10));
}
