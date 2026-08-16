/**
 * Week review (MELO_BLUEPRINT.md §2): the trailing-7-day look back — spend vs plan, quiet days,
 * the biggest day, wins noticed, and what's due next week. Pure aggregation over inputs the
 * caller already holds; no clock, no state. The headline never scolds: under plan is quiet
 * pride, over plan is honest and forward-looking, and an empty log is an invitation, not a
 * verdict. Every user-facing string here must pass lintCopy (asserted in review.test.ts).
 */

import {
  addDays,
  assertPence,
  daysBetween,
  formatPounds,
  toEpochDay,
  type ISODate,
  type Pence,
} from './core.js';
import type { SpendEntry } from './spend.js';

export interface ReviewBill {
  readonly name: string;
  readonly amountPence: Pence;
  readonly dueDate: ISODate;
}

export interface WeekWin {
  readonly id: string;
  readonly atISO: ISODate | null;
}

export interface WeekReviewInputs {
  readonly todayISO: ISODate;
  readonly spendLog: readonly SpendEntry[];
  readonly perDayPence: Pence;
  readonly checksThisWeek: number;
  readonly wins: readonly WeekWin[];
  readonly billsAhead: readonly ReviewBill[];
  readonly safeZonePence: Pence;
  readonly daysToPayday: number;
}

export interface WeekReview {
  readonly weekStartISO: ISODate;
  readonly spentPence: Pence;
  readonly plannedPence: Pence;
  readonly deltaPence: Pence;
  readonly loggedDays: number;
  readonly quietDays: number;
  readonly biggestDay: { readonly atISO: ISODate; readonly amountPence: Pence } | null;
  readonly checksCount: number;
  readonly newWinIds: readonly string[];
  readonly billsDueNextWeek: readonly ReviewBill[];
  readonly headline: string;
  readonly subline: string;
}

const WEEK_DAYS = 7;

/** True when the date sits in the trailing window [today − 6, today], inclusive both ends. */
function isInWeekWindow(atISO: ISODate, todayISO: ISODate): boolean {
  const age = daysBetween(atISO, todayISO);
  return age >= 0 && age < WEEK_DAYS;
}

/**
 * The headline is the week's one-line verdict, and the verdict is never a scolding: an empty
 * log gets an invitation, under plan gets quiet pride, over plan gets an honest number and a
 * forward step. No exclamation marks anywhere near a miss.
 */
function buildHeadline(loggedDays: number, deltaPence: Pence): string {
  if (loggedDays === 0) {
    return 'A foggy week on my side — one logged spend and the picture comes back.';
  }
  if (deltaPence > 0) {
    return `Under plan by ${formatPounds(deltaPence)} — the quiet kind of good week.`;
  }
  if (deltaPence === 0) {
    return 'Right on the plan. A steady week.';
  }
  return `${formatPounds(-deltaPence)} past the plan. Noticing it is the work.`;
}

/** "a", "a and b", or "a, b, and c" — keeps the subline to exactly one sentence. */
function joinAsSentence(parts: readonly string[]): string {
  if (parts.length === 1) return `${parts[0]}.`;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}.`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}.`;
}

/** One sentence weaving in the checks and wins only when there are any to mention. */
function buildSubline(loggedDays: number, checksCount: number, winCount: number): string {
  const parts: string[] = [
    loggedDays === 0
      ? 'Nothing logged this week — a 30-second note is plenty to start'
      : `Logged ${loggedDays} of ${WEEK_DAYS} days`,
  ];
  if (checksCount > 0) {
    parts.push(
      checksCount === 1
        ? 'checked before buying once'
        : `checked before buying ${checksCount} times`,
    );
  }
  if (winCount > 0) {
    parts.push(winCount === 1 ? '1 new win noticed' : `${winCount} new wins noticed`);
  }
  return joinAsSentence(parts);
}

/**
 * Aggregate the trailing 7 days into one calm review. Window is [today − 6, today] inclusive;
 * bills look FORWARD instead: (today, today + 7] — due today is this week's business, not next's.
 */
export function buildWeekReview(inputs: WeekReviewInputs): WeekReview {
  const { todayISO, spendLog, perDayPence, checksThisWeek, wins, billsAhead, safeZonePence } =
    inputs;
  assertPence(perDayPence, 'perDayPence');
  assertPence(safeZonePence, 'safeZonePence');

  const weekStartISO = addDays(todayISO, -(WEEK_DAYS - 1));

  const inWindow = spendLog.filter((e) => isInWeekWindow(e.atISO, todayISO));
  for (const e of inWindow) assertPence(e.amountPence, `spend ${e.id} amountPence`);
  for (const b of billsAhead) assertPence(b.amountPence, `bill ${b.name} amountPence`);

  const spentPence = inWindow.reduce((sum, e) => sum + e.amountPence, 0);
  const plannedPence = perDayPence * WEEK_DAYS;
  const deltaPence = plannedPence - spentPence;

  const byDay = new Map<ISODate, Pence>();
  for (const e of inWindow) byDay.set(e.atISO, (byDay.get(e.atISO) ?? 0) + e.amountPence);

  const loggedDays = byDay.size;
  const quietDays = WEEK_DAYS - loggedDays;

  let biggestDay: { atISO: ISODate; amountPence: Pence } | null = null;
  for (const [atISO, amountPence] of byDay) {
    const beatsOnAmount = biggestDay !== null && amountPence > biggestDay.amountPence;
    const tiesButEarlier =
      biggestDay !== null &&
      amountPence === biggestDay.amountPence &&
      toEpochDay(atISO) < toEpochDay(biggestDay.atISO);
    if (biggestDay === null || beatsOnAmount || tiesButEarlier) {
      biggestDay = { atISO, amountPence };
    }
  }

  const newWinIds = wins
    .filter((w) => w.atISO !== null && isInWeekWindow(w.atISO, todayISO))
    .map((w) => w.id);

  const billsDueNextWeek = billsAhead.filter((b) => {
    const daysAhead = daysBetween(todayISO, b.dueDate);
    return daysAhead > 0 && daysAhead <= WEEK_DAYS;
  });

  return {
    weekStartISO,
    spentPence,
    plannedPence,
    deltaPence,
    loggedDays,
    quietDays,
    biggestDay,
    checksCount: checksThisWeek,
    newWinIds,
    billsDueNextWeek,
    headline: buildHeadline(loggedDays, deltaPence),
    subline: buildSubline(loggedDays, checksThisWeek, newWinIds.length),
  };
}
