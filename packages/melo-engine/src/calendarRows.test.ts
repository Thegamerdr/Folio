import { describe, expect, it } from 'vitest';

import { buildCalendarRows, type CalendarBill, type CalendarRowsInputs } from './calendarRows.js';

const bill = (over: Partial<CalendarBill> = {}): CalendarBill => ({
  name: 'Rent',
  amountPence: 60_000,
  dueDate: '2026-03-08',
  landed: false,
  ...over,
});

const base = (over: Partial<CalendarRowsInputs> = {}): CalendarRowsInputs => ({
  todayISO: '2026-03-05',
  payday: '2026-03-15',
  cycleStart: '2026-03-01',
  bills: [],
  dangerISO: null,
  ...over,
});

describe('buildCalendarRows — always includes today', () => {
  it('includes a today marker even with nothing else', () => {
    const rows = buildCalendarRows(base());
    expect(rows).toContainEqual({
      dateISO: '2026-03-05',
      kind: 'today',
      label: 'Today',
      amountPence: null,
    });
  });
});

describe('buildCalendarRows — payday', () => {
  it('includes payday when it is within the cycle and ahead of today', () => {
    const rows = buildCalendarRows(base());
    expect(rows).toContainEqual({
      dateISO: '2026-03-15',
      kind: 'payday',
      label: 'Payday',
      amountPence: null,
    });
  });

  it('omits payday when it already passed relative to today', () => {
    const rows = buildCalendarRows(base({ todayISO: '2026-03-20', payday: '2026-03-15' }));
    expect(rows.some((r) => r.kind === 'payday')).toBe(false);
  });
});

describe('buildCalendarRows — bills due and landed', () => {
  it('lists an upcoming bill as bill-due with its amount', () => {
    const rows = buildCalendarRows(base({ bills: [bill({ dueDate: '2026-03-10' })] }));
    expect(rows).toContainEqual({
      dateISO: '2026-03-10',
      kind: 'bill-due',
      label: 'Rent due',
      amountPence: 60_000,
    });
  });

  it('lists a landed bill as bill-landed when it landed within this cycle', () => {
    const rows = buildCalendarRows(
      base({
        bills: [bill({ name: 'Energy', dueDate: '2026-03-03', landed: true, amountPence: 8_000 })],
      }),
    );
    expect(rows).toContainEqual({
      dateISO: '2026-03-03',
      kind: 'bill-landed',
      label: 'Energy landed',
      amountPence: 8_000,
    });
  });

  it('does not fabricate a landed bill from outside this cycle', () => {
    const rows = buildCalendarRows(
      base({
        cycleStart: '2026-03-01',
        todayISO: '2026-03-05',
        bills: [bill({ name: 'OldRent', dueDate: '2026-02-08', landed: true })],
      }),
    );
    expect(rows.some((r) => r.label === 'OldRent landed')).toBe(false);
  });
});

describe('buildCalendarRows — danger day', () => {
  it('includes the danger marker when one is projected', () => {
    const rows = buildCalendarRows(base({ dangerISO: '2026-03-09' }));
    expect(rows).toContainEqual({
      dateISO: '2026-03-09',
      kind: 'danger',
      label: 'Tight day',
      amountPence: null,
    });
  });

  it('omits the danger marker when none is projected', () => {
    const rows = buildCalendarRows(base({ dangerISO: null }));
    expect(rows.some((r) => r.kind === 'danger')).toBe(false);
  });
});

describe('buildCalendarRows — chronological ordering', () => {
  it('sorts every row by date ascending', () => {
    const rows = buildCalendarRows(
      base({
        dangerISO: '2026-03-09',
        bills: [
          bill({ name: 'Phone', dueDate: '2026-03-14', amountPence: 2_500 }),
          bill({ name: 'Energy', dueDate: '2026-03-03', landed: true, amountPence: 8_000 }),
        ],
      }),
    );
    const dates = rows.map((r) => r.dateISO);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it('anchors the today marker before same-day bill rows', () => {
    const rows = buildCalendarRows(
      base({ todayISO: '2026-03-05', bills: [bill({ name: 'Water', dueDate: '2026-03-05' })] }),
    );
    expect(rows[0]).toEqual({
      dateISO: '2026-03-05',
      kind: 'today',
      label: 'Today',
      amountPence: null,
    });
  });
});

describe('buildCalendarRows — integer pence discipline', () => {
  it('fractional bill amounts throw', () => {
    expect(() => buildCalendarRows(base({ bills: [bill({ amountPence: 9.99 })] }))).toThrow(
      /integer pence/,
    );
  });
});
