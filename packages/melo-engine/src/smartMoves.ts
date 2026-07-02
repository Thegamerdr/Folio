/**
 * Smart moves (MELO_BLUEPRINT.md §14): a curated rule table, not ML. Five deterministic,
 * auditable rules checked in rank order; the first that applies wins, and null — "nothing
 * needs fixing" — is a valid, common answer. Every number in the copy is derived from the
 * inputs (never invented): safe amounts display floor-rounded via formatPounds, and the one
 * cost we quote (the buffer top-up) rounds UP — both directions are the honest side.
 */

import { assertPence, formatPounds, toEpochDay, type ISODate, type Pence } from './core.js';

export interface SmartMoveInputs {
  readonly todayISO: ISODate;
  readonly safeZonePence: Pence;
  readonly perDayPence: Pence;
  readonly daysToPayday: number;
  readonly bufferPence: Pence;
  readonly savingsPence: Pence;
  readonly bills: readonly {
    readonly name: string;
    readonly amountPence: Pence;
    readonly dueDate: ISODate;
  }[];
  readonly dangerDaysAway: number | null;
  readonly runRatePence: Pence | null; // observed run-rate; null = not enough data yet
  readonly essentialsPerDayPence: Pence;
}

export interface SmartMove {
  readonly id: 'pace' | 'danger' | 'buffer' | 'billCluster' | 'firstSaving';
  readonly title: string;
  readonly body: string;
}

const BUFFER_TARGET_PENCE = 2_000; // the £20 buffer that makes the early warning real
const BUFFER_ZONE_MULTIPLE = 10; // suggest only when the top-up costs ≤ a tenth of the zone
const FIRST_SAVING_ZONE_PER_DAY_PENCE = 200; // spec: safeZonePence >= 2000 * daysToPayday / 10
const CLUSTER_WINDOW_DAYS = 7;
const CLUSTER_MIN_BILLS = 3;

/**
 * The first applicable rule, ranked by urgency: danger > pace > billCluster > buffer >
 * firstSaving. Null when nothing applies — most days, nothing does.
 */
export function pickSmartMove(inputs: SmartMoveInputs): SmartMove | null {
  assertPence(inputs.safeZonePence, 'safeZonePence');
  assertPence(inputs.perDayPence, 'perDayPence');
  assertPence(inputs.bufferPence, 'bufferPence');
  assertPence(inputs.savingsPence, 'savingsPence');
  assertPence(inputs.essentialsPerDayPence, 'essentialsPerDayPence');
  if (inputs.runRatePence !== null) assertPence(inputs.runRatePence, 'runRatePence');
  for (const bill of inputs.bills) assertPence(bill.amountPence, `bill ${bill.name} amountPence`);
  toEpochDay(inputs.todayISO); // fail fast on a malformed date

  return (
    dangerMove(inputs) ??
    paceMove(inputs) ??
    billClusterMove(inputs) ??
    bufferMove(inputs) ??
    firstSavingMove(inputs)
  );
}

/** Rule 1 — a danger day exists: the one per-day figure that dissolves it, floor-rounded. */
function dangerMove(i: SmartMoveInputs): SmartMove | null {
  if (i.dangerDaysAway === null) return null;
  const keepDryPence = Math.floor(i.safeZonePence / Math.max(i.daysToPayday, 1));
  return {
    id: 'danger',
    title: 'One move keeps it dry',
    body: `Keep to ${formatPounds(keepDryPence)}/day from here and the ${formatPounds(
      i.safeZonePence,
    )} you have lasts to payday. That is the whole move.`,
  };
}

/** Rule 2 — observed pace runs more than 25% over the essentials plan. Both figures, no verdict. */
function paceMove(i: SmartMoveInputs): SmartMove | null {
  if (i.runRatePence === null) return null;
  // runRate > essentials * 1.25, kept in integer arithmetic: runRate * 4 > essentials * 5.
  if (i.runRatePence * 4 <= i.essentialsPerDayPence * 5) return null;
  return {
    id: 'pace',
    title: 'A quick pace check',
    body: `Spending is running at ${formatPounds(i.runRatePence)}/day against the ${formatPounds(
      i.essentialsPerDayPence,
    )}/day plan. No drama — just worth knowing while there is time to steer.`,
  };
}

/** Rule 3 — three or more bills land inside one 7-day window: name the week, suggest spreading. */
function billClusterMove(i: SmartMoveInputs): SmartMove | null {
  if (i.bills.length < CLUSTER_MIN_BILLS) return null;
  const sorted = i.bills
    .map((bill) => ({ day: toEpochDay(bill.dueDate), dueDate: bill.dueDate }))
    .sort((a, b) => a.day - b.day);
  // Any 7-day window holding 3+ bills can be slid right until it starts on a bill, so
  // anchoring at each bill's due date is an exhaustive search. Earliest cluster wins.
  for (const anchor of sorted) {
    const count = sorted.filter(
      (bill) => bill.day >= anchor.day && bill.day < anchor.day + CLUSTER_WINDOW_DAYS,
    ).length;
    if (count >= CLUSTER_MIN_BILLS) {
      return {
        id: 'billCluster',
        title: 'A crowded week for bills',
        body: `${count} of your bills land in the week starting ${formatDayMonth(
          anchor.dueDate,
        )}. Providers will usually move a due date if you ask — spreading them out makes that week lighter.`,
      };
    }
  }
  return null;
}

/** Rule 4 — buffer under £20 and the top-up costs at most a tenth of the zone. */
function bufferMove(i: SmartMoveInputs): SmartMove | null {
  if (i.bufferPence >= BUFFER_TARGET_PENCE) return null;
  const gapPence = BUFFER_TARGET_PENCE - i.bufferPence;
  if (i.safeZonePence < BUFFER_ZONE_MULTIPLE * gapPence) return null;
  const topUp = `£${Math.ceil(gapPence / 100)}`; // a cost, so it rounds UP — never understated
  return {
    id: 'buffer',
    title: 'Make the early warning real',
    body: `Moving ${topUp} across tops the buffer up to £20. It costs little of the ${formatPounds(
      i.safeZonePence,
    )} zone and makes the early warning real.`,
  };
}

/** Rule 5 — no savings yet, and the zone leaves at least £2/day of room for a first £10. */
function firstSavingMove(i: SmartMoveInputs): SmartMove | null {
  if (i.savingsPence !== 0 || i.daysToPayday <= 0) return null;
  if (i.safeZonePence < FIRST_SAVING_ZONE_PER_DAY_PENCE * i.daysToPayday) return null;
  const dayWord = i.daysToPayday === 1 ? 'day' : 'days';
  return {
    id: 'firstSaving',
    title: 'A first £10 put aside',
    body: `The zone has room: ${formatPounds(i.safeZonePence)} across ${i.daysToPayday} ${dayWord}. Even £10 set aside makes the next storm one size smaller.`,
  };
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** "8 March" — derived from the ISO string itself, no clock and no locale. */
function formatDayMonth(date: ISODate): string {
  const month = MONTH_NAMES[Number(date.slice(5, 7)) - 1] ?? date.slice(5, 7);
  return `${Number(date.slice(8, 10))} ${month}`;
}
