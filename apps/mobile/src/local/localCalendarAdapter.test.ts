import { describe, expect, it } from 'vitest';

import {
  addPlannedCommitment,
  buildLocalRouteSummary,
  createEmptyLocalLedgerState,
  createInitialLocalLedgerState,
  stageStatementImport,
} from './localLedger.js';
import {
  buildLocalCalendarModel,
  filterLocalCalendarEventsForDate,
} from './localCalendarAdapter.js';

describe('local canonical calendar adapter', () => {
  it('builds the calendar from canonical calendar items and materialises local time through the calendar engine', () => {
    const ledger = addPlannedCommitment(createEmptyLocalLedgerState('2026-06-22'), {
      amountText: '25.00',
      date: '2026-06-24',
      title: 'Dentist',
    });
    const calendar = buildLocalCalendarModel(ledger, buildLocalRouteSummary(ledger));

    expect(calendar.calendarItemCount).toBe(5);
    expect(calendar.plannerItemCount).toBe(0);
    expect(calendar.materializedUtcInstants).toEqual([
      '2026-06-24T08:00:00Z',
      '2026-06-24T08:00:00Z',
      '2026-06-22T08:00:00Z',
      '2026-06-22T08:00:00Z',
      '2026-06-22T08:00:00Z',
    ]);
    expect(calendar.agenda).toContainEqual(
      expect.objectContaining({
        amount: '-\u00a325',
        date: '2026-06-24',
        detail: 'Protected commitment',
        title: 'Dentist',
        tone: 'confirmed',
      }),
    );
    expect(calendar.agenda).toContainEqual(
      expect.objectContaining({
        date: '2026-06-24',
        detail: 'Plan deadline',
        title: 'Protect Dentist deadline',
      }),
    );
    expect(calendar.agenda).toContainEqual(
      expect.objectContaining({
        date: '2026-06-22',
        detail: 'Planned contribution',
        title: 'Protect Dentist planned contribution',
      }),
    );
    expect(calendar.agenda).toContainEqual(
      expect.objectContaining({
        date: '2026-06-22',
        detail: 'Plan review date',
        title: 'Protect Dentist review',
      }),
    );
    expect(calendar.agenda).toContainEqual(
      expect.objectContaining({
        detail: 'Recovery follow-up',
        title: 'Review recovery impact',
        tone: 'attention',
      }),
    );
  });

  it('keeps staged import rows as review tasks before they become calendar facts', () => {
    const ledger = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-22,Cfee,-3.25',
    ).state;
    const calendar = buildLocalCalendarModel(ledger, buildLocalRouteSummary(ledger));
    const serialized = JSON.stringify(calendar);

    expect(calendar.calendarItemCount).toBe(1);
    expect(calendar.plannerItemCount).toBe(1);
    expect(calendar.agenda).toContainEqual(
      expect.objectContaining({
        amount: '',
        date: '2026-06-22',
        detail: 'Review task',
        title: 'Review Cfee',
        tone: 'attention',
      }),
    );
    expect(serialized).not.toMatch(/\bconfidence\b|confidence_|_confidence|\bscore\b/i);
  });

  it('filters selected-day rows without dropping route or canonical calendar items from the agenda', () => {
    const ledger = addPlannedCommitment(createInitialLocalLedgerState('2026-06-22'), {
      amountText: '25.00',
      date: '2026-06-24',
      title: 'Dentist',
    });
    const calendar = buildLocalCalendarModel(ledger, buildLocalRouteSummary(ledger));
    const selectedRows = filterLocalCalendarEventsForDate(calendar.agenda, '2026-06-24');

    expect(selectedRows.map((row) => row.title)).toEqual(['Dentist', 'Protect Dentist deadline']);
    expect(calendar.agenda.map((row) => row.title)).toEqual(
      expect.arrayContaining(['Current route', 'Payday', 'Dentist']),
    );
  });

  it('sorts attention review rows before confirmed route rows on the same day', () => {
    const ledger = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-22,Coffee,-3.25',
    ).state;
    const calendar = buildLocalCalendarModel(ledger, buildLocalRouteSummary(ledger));
    const todayRows = filterLocalCalendarEventsForDate(calendar.agenda, '2026-06-22');

    expect(todayRows[0]).toMatchObject({
      detail: 'Review task',
      title: 'Review Coffee',
      tone: 'attention',
    });
    expect(todayRows.map((row) => row.title)).toContain('Current route');
  });
});
