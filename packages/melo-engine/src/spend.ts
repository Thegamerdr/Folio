/**
 * Spend observation (MELO_BLUEPRINT.md §2 P7): the run-rate that makes the danger date LIVE.
 * Logging a spend is what lets the forecast move — and "the danger date moved" is the flagship
 * moment of the product. Rounding is conservative in the user's favour throughout: the observed
 * run-rate rounds UP (assume you spend a little more), so danger arrives on the honest side.
 * Also here: the UK weekend payday shift and the derived recovery move (no hardcoded £8s).
 */

import { addDays, assertPence, daysBetween, toEpochDay, type ISODate, type Pence } from './core.js';

export interface SpendEntry {
  readonly id: string;
  readonly amountPence: Pence;
  readonly atISO: ISODate;
  readonly note?: string;
}

const RUN_RATE_WINDOW_DAYS = 7;

/**
 * Observed discretionary spend per day over the trailing window.
 * Null when nothing has been logged — the caller falls back to the essentials plan and the
 * forecast says so honestly rather than pretending to know.
 */
export function observedRunRatePence(
  entries: readonly SpendEntry[],
  today: ISODate,
  windowDays: number = RUN_RATE_WINDOW_DAYS,
): Pence | null {
  const inWindow = entries.filter((e) => {
    const age = daysBetween(e.atISO, today);
    return age >= 0 && age < windowDays;
  });
  if (inWindow.length === 0) return null;
  for (const e of inWindow) assertPence(e.amountPence, `spend ${e.id} amountPence`);

  const oldestAge = Math.max(...inWindow.map((e) => daysBetween(e.atISO, today)));
  const spanDays = Math.min(windowDays, oldestAge + 1);
  const totalPence = inWindow.reduce((sum, e) => sum + e.amountPence, 0);
  return Math.ceil(totalPence / spanDays);
}

/** Day of week for an ISO date, 0 = Sunday … 6 = Saturday (epoch day 0 = Thursday). */
export function dayOfWeek(date: ISODate): number {
  return ((toEpochDay(date) % 7) + 7 + 4) % 7;
}

/**
 * UK payday convention: a payday landing on a weekend is paid the Friday BEFORE.
 * (§13 risk 16 — asked-once-handled-forever lives at the surface; the shift itself lives here.)
 */
export function shiftWeekendToFriday(date: ISODate): ISODate {
  const dow = dayOfWeek(date);
  if (dow === 6) return addDays(date, -1); // Saturday → Friday
  if (dow === 0) return addDays(date, -2); // Sunday → Friday
  return date;
}

const MOVE_FLOOR_PENCE = 5_00;
const MOVE_CEILING_PENCE = 20_00;

/**
 * The recovery "one move today" (§2 P4), derived instead of hardcoded: enough per day to close
 * the overshoot by payday, floored at £5 (always achievable) and capped at £20 (never a lecture
 * disguised as a number). Rounded up to a whole pound — a clean ask.
 */
export function recoveryMovePence(safeZonePence: Pence, daysToPayday: number): Pence {
  if (safeZonePence >= 0) return MOVE_FLOOR_PENCE;
  const perDay = Math.ceil(Math.abs(safeZonePence) / Math.max(daysToPayday, 1) / 100) * 100;
  return Math.min(Math.max(perDay, MOVE_FLOOR_PENCE), MOVE_CEILING_PENCE);
}
