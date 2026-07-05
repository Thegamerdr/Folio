/**
 * Calendar rows: a chronological list of the things that actually happen in a cycle — today,
 * payday, bills due, bills already landed, and the danger day if one exists. Pure aggregation,
 * no fabrication: a bill only shows as "landed" once the caller says it landed, and there is
 * always exactly one today marker and (when in range) one payday marker.
 */

import { assertPence, daysBetween, type ISODate, type Pence } from './core.js';

export type CalendarRowKind = 'bill-due' | 'bill-landed' | 'payday' | 'danger' | 'today';

export interface CalendarRow {
  readonly dateISO: ISODate;
  readonly kind: CalendarRowKind;
  readonly label: string;
  readonly amountPence: Pence | null;
}

export interface CalendarBill {
  readonly name: string;
  readonly amountPence: Pence;
  readonly dueDate: ISODate;
  readonly landed: boolean;
}

export interface CalendarRowsInputs {
  readonly todayISO: ISODate;
  readonly payday: ISODate;
  readonly cycleStart: ISODate;
  readonly bills: readonly CalendarBill[];
  readonly dangerISO: ISODate | null;
}

function billRow(bill: CalendarBill): CalendarRow {
  return bill.landed
    ? {
        dateISO: bill.dueDate,
        kind: 'bill-landed',
        label: `${bill.name} landed`,
        amountPence: bill.amountPence,
      }
    : {
        dateISO: bill.dueDate,
        kind: 'bill-due',
        label: `${bill.name} due`,
        amountPence: bill.amountPence,
      };
}

/**
 * Chronological rows for this cycle: today, payday (if within [cycleStart, payday]), every
 * bill (landed ones are past bills that already happened this cycle, due ones are ahead), and
 * the danger day if one was projected. Sorted by date; same-date rows keep a stable order
 * (today, danger, payday, bills) so the marker rows anchor the day before the bill list.
 */
export function buildCalendarRows(inputs: CalendarRowsInputs): CalendarRow[] {
  for (const bill of inputs.bills) assertPence(bill.amountPence, `bill ${bill.name} amountPence`);

  const rows: CalendarRow[] = [
    { dateISO: inputs.todayISO, kind: 'today', label: 'Today', amountPence: null },
  ];

  if (inputs.dangerISO !== null) {
    rows.push({ dateISO: inputs.dangerISO, kind: 'danger', label: 'Tight day', amountPence: null });
  }

  const paydayInCycle =
    daysBetween(inputs.cycleStart, inputs.payday) >= 0 &&
    daysBetween(inputs.todayISO, inputs.payday) >= 0;
  if (paydayInCycle) {
    rows.push({ dateISO: inputs.payday, kind: 'payday', label: 'Payday', amountPence: null });
  }

  for (const bill of inputs.bills) {
    // Landed bills are only shown if they landed within this cycle (on or after cycleStart and
    // on or before today) — never fabricate a landing for a bill outside the window.
    if (bill.landed) {
      const withinCycle =
        daysBetween(inputs.cycleStart, bill.dueDate) >= 0 &&
        daysBetween(bill.dueDate, inputs.todayISO) >= 0;
      if (!withinCycle) continue;
    }
    rows.push(billRow(bill));
  }

  const kindRank: Record<CalendarRowKind, number> = {
    today: 0,
    danger: 1,
    payday: 2,
    'bill-landed': 3,
    'bill-due': 3,
  };

  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      // daysBetween(from, to) = epoch(to) - epoch(from), so ascending order needs the args
      // flipped: daysBetween(b, a) = epoch(a) - epoch(b).
      const dayDiff = daysBetween(b.row.dateISO, a.row.dateISO);
      if (dayDiff !== 0) return dayDiff;
      const rankDiff = kindRank[a.row.kind] - kindRank[b.row.kind];
      if (rankDiff !== 0) return rankDiff;
      return a.index - b.index;
    })
    .map((entry) => entry.row);
}
