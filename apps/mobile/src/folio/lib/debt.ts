/**
 * Debt amortization engine — BUILD_PLAN §3 (the AddEntry "debt" path,
 * `@rn-engine debt-engine`). The fixed-payment payoff schedule behind a debt
 * the user types in: "Klarna sofa, £540, due on the 12th, monthly, 6 left".
 *
 * This is the BNPL / fixed-instalment shape (Klarna, Clearpay, a payment plan):
 * a known balance cleared by a known number of EQUAL payments on a regular
 * cadence. It is deliberately NOT the interest-bearing primitive in
 * `packages/finance-engine` (`projectDebtSchedule`, which models an APR and a
 * declining-balance amortization). The AddEntry form captures no rate — only
 * `{ name, balance, dueDay, cadence, paymentsLeft }` plus the per-payment
 * amount — so this engine schedules exactly those `paymentsLeft` dated
 * outflows and reports when the balance is cleared. If a rate path is ever
 * added to the form, the finance-engine primitive is the place for it; this
 * stays the honest no-rate plan.
 *
 * What it produces:
 *   - `payments`: one dated row per remaining payment (length === paymentsLeft),
 *     each carrying the running balance so a row can say "this clears it". The
 *     dates honour the cadence (weekly / monthly / yearly) anchored to `dueDay`,
 *     and reuse the SAME clamp + weekend rule as `payday.ts` (Feb-31 -> Feb
 *     28/29; a weekend due-date shifts to the previous working day) so a debt
 *     payment never lands on a date payday would have moved off.
 *   - `payoffDate`: the ISO date of the final payment (the date the balance
 *     reaches zero), or `null` when there are no payments left.
 *   - `remaining`: the count of scheduled payments (=== payments.length).
 *   - `finalPayment`: the last payment's amount — the per-payment amount for an
 *     exact split, or the smaller residual that clears a balance that does not
 *     divide evenly (so the schedule clears the balance to the penny, never
 *     over- or under-shooting).
 *
 * Honesty: the engine never invents a rate, never auto-counts a payment as a
 * posted fact (the AddEntry path surfaces these as dated COMMITMENTS the user
 * accepts), and clears the balance exactly — the sum of `payments` always
 * equals the modelled balance.
 *
 * Pure and deterministic: no I/O, no react-native, no DOM, no local-timezone
 * dependence. Dates are plain ISO "YYYY-MM-DD" strings; the only `Date` use is
 * the UTC construction inside `resolvePayday` (timezone-immune). The day-of-
 * month clamp + weekend shift are delegated to the sibling payday engine so the
 * two never drift. Imported relatively as `./payday` so the pure-logic test
 * runner (no `@` alias) resolves it.
 */

import { resolvePayday, type WeekendRule } from './payday';

/** The cadence a debt's instalments fall on. Weekly / monthly / yearly cover
 *  the AddEntry form's options (the "· N left" labels encode `monthly`/`weekly`
 *  + `paymentsLeft`); `yearly` rounds out the recurrence set for completeness. */
export type DebtCadence = 'weekly' | 'monthly' | 'yearly';

/** The input the AddEntry debt path hands the engine. `balance` is the total
 *  still owed; `amount` is the agreed per-payment instalment; `paymentsLeft` is
 *  how many instalments remain. `dueDay` is the day-of-month the instalment
 *  falls on (1..31; clamped per month like payday). */
export type DebtInput = {
  /** Display name — "Klarna sofa", "Car finance". Carried onto each payment. */
  name: string;
  /** Total £ still owed. The schedule clears exactly this much. */
  balance: number;
  /** Day-of-month the instalment is due (1..31). Clamped to the month's last
   *  valid day (Feb 31 -> 28/29) exactly like a payday rule. */
  dueDay: number;
  /** weekly | monthly | yearly. Drives how the dated rows step forward. */
  cadence: DebtCadence;
  /** How many instalments remain. The schedule has exactly this many rows. */
  paymentsLeft: number;
  /** The agreed per-payment instalment (£). The final row may be smaller when
   *  the balance does not divide evenly, so the schedule clears to the penny. */
  amount: number;
};

/** One dated instalment in the payoff schedule. */
export type DebtPayment = {
  /** 1-based instalment number (1 = the next one due). */
  index: number;
  /** ISO date (YYYY-MM-DD) the instalment falls on. */
  date: string;
  /** £ paid this instalment (the final row may be a smaller residual). */
  amount: number;
  /** £ still owed AFTER this instalment. The final row is exactly 0. */
  balanceAfter: number;
};

/** The resolved amortization for a debt. */
export type DebtSchedule = {
  /** The display name, echoed for the consumer that fans these out. */
  name: string;
  /** One dated row per remaining payment. `length === remaining`. */
  payments: DebtPayment[];
  /** ISO date the balance reaches zero (the last payment), or null when there
   *  is nothing left to pay. */
  payoffDate: string | null;
  /** Count of scheduled payments (=== payments.length). */
  remaining: number;
  /** The final payment's £ amount (the residual that clears the balance), or 0
   *  when there is nothing left to pay. */
  finalPayment: number;
};

/** Anchor for the schedule. `now` is "today" as an ISO date; the first payment
 *  is the next due-date on/after it. `weekendRule` matches payday's default
 *  (UK payroll convention: a weekend instalment moves to the previous working
 *  day) and can be overridden for symmetry with a debt collected `next` or
 *  `exact`. */
export type DebtContext = {
  /** "Today" as an ISO date (YYYY-MM-DD). Defaults to undefined -> derived from
   *  the system clock is intentionally NOT done here (purity): callers pass it. */
  now: string;
  /** Weekend handling for a due-date that lands on a Saturday/Sunday. Defaults
   *  to `previous`, the same default as `resolvePayday`. */
  weekendRule?: WeekendRule;
};

const ISO_DATE_LENGTH = 10; // "YYYY-MM-DD"
const MILLIS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
/** £ are modelled in integer pence so the residual split clears to the penny
 *  without binary-float drift (0.1 + 0.2 problems). */
const PENCE_PER_POUND = 100;

/** Parsed Y/M/D triple. Months are 1-based here (1 = January). */
type Ymd = { year: number; month: number; day: number };

/**
 * Parse an ISO "YYYY-MM-DD" into a 1-based Y/M/D. Throws on malformed input —
 * an engine boundary; bad input fails fast rather than producing a NaN date.
 * Mirrors the sibling engines' parser.
 */
function parseIsoDate(date: string): Ymd {
  if (date.length < ISO_DATE_LENGTH) {
    throw new Error(`debt: expected "YYYY-MM-DD", got "${date}"`);
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
    throw new Error(`debt: expected "YYYY-MM-DD", got "${date}"`);
  }
  return { year, month, day };
}

/** "YYYY-MM" slice for a Y/M/D triple (the year-month `resolvePayday` expects). */
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

/** The "YYYY-MM" `step` calendar months after the given month (step >= 0). */
function advanceYearMonth(ymd: Ymd, step: number): string {
  const zeroBased = ymd.month - 1 + step;
  const year = ymd.year + Math.floor(zeroBased / 12);
  const month = (zeroBased % 12) + 1;
  const mm = month < 10 ? `0${month}` : String(month);
  return `${year}-${mm}`;
}

/**
 * The next monthly/yearly due-date on/after `now`, for `dueDay`, clamped +
 * weekend-shifted by the payday engine. Tries the current month first; if that
 * resolved date is strictly before `now`, rolls forward `monthStep` months
 * (1 = monthly, 12 = yearly) and resolves again. ISO dates sort lexically, so
 * the "strictly before" compare is a plain string compare — the same rule the
 * calendar/pot engines use.
 */
function firstDueOnOrAfter(
  now: Ymd,
  dueDay: number,
  monthStep: number,
  weekendRule: WeekendRule,
): string {
  const nowIso = isoFromMillis(utcMillis(now));
  const thisPeriod = resolvePayday({ dayOfMonth: dueDay, weekendRule }, yearMonthOf(now));
  if (thisPeriod >= nowIso) return thisPeriod;
  return resolvePayday({ dayOfMonth: dueDay, weekendRule }, advanceYearMonth(now, monthStep));
}

/**
 * The `index`-th (0-based) monthly/yearly due-date, given the first due-date.
 * Re-resolves through the payday engine each period so every month gets its own
 * clamp + weekend shift (Feb 31 -> 28/29 in February, March 31 stays the 31st,
 * a weekend instalment moves to the previous working day independently).
 */
function nthMonthlyDue(
  firstDue: string,
  dueDay: number,
  index: number,
  monthStep: number,
  weekendRule: WeekendRule,
): string {
  if (index === 0) return firstDue;
  const first = parseIsoDate(firstDue);
  return resolvePayday(
    { dayOfMonth: dueDay, weekendRule },
    advanceYearMonth(first, index * monthStep),
  );
}

/**
 * The `index`-th (0-based) weekly due-date: the first due-date plus `index`
 * weeks. Weekly debts (Clearpay-style "every Friday") step by a fixed 7 days —
 * NOT by day-of-month — so they are pure UTC-day arithmetic off the resolved
 * first date. The first date itself still came through the payday clamp/shift,
 * so the cadence stays anchored to the agreed weekday.
 */
function nthWeeklyDue(firstDue: string, index: number): string {
  const base = utcMillis(parseIsoDate(firstDue));
  return isoFromMillis(base + index * DAYS_PER_WEEK * MILLIS_PER_DAY);
}

/** Round a £ value to whole pence (integer), so the residual split is exact. */
function toPence(pounds: number): number {
  return Math.round(pounds * PENCE_PER_POUND);
}

/** Convert integer pence back to a £ number with at most 2 decimals. */
function toPounds(pence: number): number {
  return pence / PENCE_PER_POUND;
}

/**
 * Resolve a debt's input to its dated amortization schedule.
 *
 * Schedule shape:
 *   - exactly `paymentsLeft` rows (after sanitising to a non-negative integer);
 *   - each row dated by the cadence, anchored to `dueDay`, clamped + weekend-
 *     shifted like a payday;
 *   - each row's `amount` is the agreed per-payment instalment, EXCEPT the
 *     final row, which is the residual that clears the balance exactly (so the
 *     sum of `payments` equals the modelled balance to the penny — never an
 *     over- or under-payment);
 *   - the running `balanceAfter` ends at exactly 0 on the final row.
 *
 * The per-payment `amount` is treated as the agreed instalment; the balance is
 * the source of truth for "how much is left", so when `amount * paymentsLeft`
 * does not equal the balance the engine honours the balance (clears it exactly)
 * rather than the instalment (which would leave a stray penny or overpay).
 */
export function buildDebtSchedule(input: DebtInput, ctx: DebtContext): DebtSchedule {
  const weekendRule = ctx.weekendRule ?? 'previous';
  // Sanitise the counts/amounts at the boundary — the form can hand through a
  // zero/negative/NaN; an empty plan is an honest "nothing scheduled", not a crash.
  const remaining = Number.isFinite(input.paymentsLeft)
    ? Math.max(0, Math.trunc(input.paymentsLeft))
    : 0;

  if (remaining === 0) {
    return { name: input.name, payments: [], payoffDate: null, remaining: 0, finalPayment: 0 };
  }

  const now = parseIsoDate(ctx.now);
  const monthStep = input.cadence === 'yearly' ? 12 : 1;
  const firstDue =
    input.cadence === 'weekly'
      ? firstWeeklyDue(now, input.dueDay, weekendRule)
      : firstDueOnOrAfter(now, input.dueDay, monthStep, weekendRule);

  // Work in integer pence so the residual clears to the penny with no float drift.
  // The balance is the source of truth for the total owed; the agreed instalment
  // sizes every row except the last, which absorbs the residual.
  const balancePence = Math.max(0, toPence(input.balance));
  const instalmentPence = Math.max(0, toPence(input.amount));

  const payments: DebtPayment[] = [];
  let owedPence = balancePence;

  for (let i = 0; i < remaining; i++) {
    const isFinal = i === remaining - 1;
    // The final row clears whatever is left (the residual). Earlier rows pay the
    // agreed instalment, but never more than is actually owed (a too-large
    // instalment relative to the balance simply clears it early on this row).
    const payPence = isFinal ? owedPence : Math.min(instalmentPence, owedPence);
    const nextOwed = Math.max(0, owedPence - payPence);

    const date =
      input.cadence === 'weekly'
        ? nthWeeklyDue(firstDue, i)
        : nthMonthlyDue(firstDue, input.dueDay, i, monthStep, weekendRule);

    payments.push({
      index: i + 1,
      date,
      amount: toPounds(payPence),
      balanceAfter: toPounds(nextOwed),
    });

    owedPence = nextOwed;
  }

  const finalRow = payments[payments.length - 1];
  return {
    name: input.name,
    payments,
    payoffDate: finalRow ? finalRow.date : null,
    remaining: payments.length,
    finalPayment: finalRow ? finalRow.amount : 0,
  };
}

/**
 * The first weekly due-date on/after `now`. A weekly debt is still anchored to
 * the agreed `dueDay` for its FIRST resolution (so "set up on the 12th, weekly"
 * starts from a clamped/weekend-shifted 12th), then steps by whole weeks. When
 * that first clamped date is already behind `now`, walk forward a week at a time
 * until it is on/after today — so the next instalment is genuinely upcoming.
 */
function firstWeeklyDue(now: Ymd, dueDay: number, weekendRule: WeekendRule): string {
  const nowIso = isoFromMillis(utcMillis(now));
  let candidate = resolvePayday({ dayOfMonth: dueDay, weekendRule }, yearMonthOf(now));
  // If the anchored day this month is already behind today, roll forward by
  // whole weeks (the weekly cadence) until it is on/after today.
  while (candidate < nowIso) {
    candidate = isoFromMillis(utcMillis(parseIsoDate(candidate)) + DAYS_PER_WEEK * MILLIS_PER_DAY);
  }
  return candidate;
}
