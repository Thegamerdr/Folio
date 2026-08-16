// What-Changed summary tests — pure logic (lib/whatChanged.ts). The component (ui/WhatChangedRow)
// is JSX/react-native and outside the Node runner's glob; the summary maths it renders is fully
// pinned here instead (same boundary as ctaMode.ts vs PaywallScreen).

import { describe, expect, it } from 'vitest';
import {
  createCurrencyCode,
  createInstantString,
  createMoney,
  createWorkspaceId,
  type MaterialFinancialChange,
} from '@folio/domain';

import { summarizeWhatChanged } from './whatChanged';
import type { TimelineRow } from './timelineEvents';
import type { StatementImportRecord } from '../store';

const SEEN = '2026-07-10T12:00:00.000Z';
const GBP = createCurrencyCode('GBP');

function row(at: string, what: string, verb: TimelineRow['verb'] = 'Added'): TimelineRow {
  return { id: `${what}-${at}`, at, verb, what };
}

function statementImport(atISO: string, rowCount: number): StatementImportRecord {
  return { id: `imp-${atISO}`, source: 'pdf', rowCount, atISO };
}

function materialChange(at: string): MaterialFinancialChange {
  const amount = createMoney({ minorUnits: -2500, currency: GBP });
  return {
    id: `change-${at}`,
    workspaceId: createWorkspaceId('workspace_personal_local'),
    occurredAt: createInstantString(at),
    detectedAt: createInstantString(at),
    type: 'bill_amount_change',
    sourceIds: ['fact_bill_rent'],
    truth: 'user_confirmed',
    monetaryEffect: amount,
    rangeEffect: { conservativeBoundaryDelta: amount },
    causes: [
      {
        id: `cause-${at}`,
        label: 'Rent increased reduced the Safe Range',
        weight: 'primary',
        sourceFactIds: ['fact_bill_rent'],
        amount,
      },
    ],
    affectedDecisionIds: [],
    reviewRequired: false,
    userActionRequired: true,
    explanationCode: 'material.bill_amount_change.worsened.user_confirmed',
  };
}

describe('summarizeWhatChanged', () => {
  it('is null with no baseline yet — the row stays hidden until the first silent stamp', () => {
    expect(
      summarizeWhatChanged({
        rows: [row('2026-07-11T09:00:00.000Z', 'Tesco')],
        imports: [],
        seenISO: null,
      }),
    ).toBeNull();
  });

  it('is null when nothing changed since the baseline', () => {
    expect(
      summarizeWhatChanged({
        rows: [row('2026-07-09T09:00:00.000Z', 'Tesco')],
        imports: [statementImport('2026-07-08T09:00:00.000Z', 40)],
        seenISO: SEEN,
      }),
    ).toBeNull();
  });

  it('is null on a corrupt baseline rather than throwing or shouting a full history', () => {
    expect(
      summarizeWhatChanged({
        rows: [row('2026-07-11T09:00:00.000Z', 'Tesco')],
        imports: [],
        seenISO: 'not-a-date',
      }),
    ).toBeNull();
  });

  it('names a single change with its lowercased verb', () => {
    const summary = summarizeWhatChanged({
      rows: [row('2026-07-11T09:00:00.000Z', 'Tesco', 'Added')],
      imports: [],
      seenISO: SEEN,
    });
    expect(summary).toEqual({ count: 1, headline: 'Tesco added' });
  });

  it('leads with the NEWEST change and counts the rest as a tail', () => {
    const summary = summarizeWhatChanged({
      rows: [
        row('2026-07-11T08:00:00.000Z', 'Tesco', 'Added'),
        row('2026-07-11T10:00:00.000Z', 'Disney+', 'Paused'),
        row('2026-07-11T09:00:00.000Z', 'Boots', 'Edited'),
      ],
      imports: [],
      seenISO: SEEN,
    });
    expect(summary).toEqual({ count: 3, headline: 'Disney+ paused · 2 more' });
  });

  it('counts a statement import as ONE change even though its rows carry historical dates', () => {
    const summary = summarizeWhatChanged({
      // The import landed AFTER the baseline, but every transaction in it is dated last month —
      // those rows correctly do not count individually; the import moment itself does.
      rows: [row('2026-06-02T00:00:00.000Z', 'Old grocery shop')],
      imports: [statementImport('2026-07-11T09:30:00.000Z', 42)],
      seenISO: SEEN,
    });
    expect(summary).toEqual({ count: 1, headline: 'Statement read · 42 rows' });
  });

  it('uses the singular row word for a one-row import', () => {
    const summary = summarizeWhatChanged({
      rows: [],
      imports: [statementImport('2026-07-11T09:30:00.000Z', 1)],
      seenISO: SEEN,
    });
    expect(summary?.headline).toBe('Statement read · 1 row');
  });

  it('merges rows and imports into one count, newest item leading', () => {
    const summary = summarizeWhatChanged({
      rows: [row('2026-07-11T11:00:00.000Z', 'Tesco', 'Added')],
      imports: [statementImport('2026-07-11T09:30:00.000Z', 10)],
      seenISO: SEEN,
    });
    expect(summary).toEqual({ count: 2, headline: 'Tesco added · 1 more' });
  });

  it('uses persisted material-change causality ahead of generic row summaries', () => {
    const summary = summarizeWhatChanged({
      rows: [row('2026-07-11T11:00:00.000Z', 'Tesco', 'Added')],
      imports: [],
      materialChanges: [materialChange('2026-07-11T12:00:00.000Z')],
      seenISO: SEEN,
    });

    expect(summary?.count).toBe(2);
    expect(summary?.headline).toContain('Rent increased reduced the Safe Range');
    expect(summary?.headline).toContain('£25 down');
  });

  it('ignores rows with unparsable timestamps instead of crashing', () => {
    const summary = summarizeWhatChanged({
      rows: [row('garbage', 'Tesco'), row('2026-07-11T09:00:00.000Z', 'Boots')],
      imports: [],
      seenISO: SEEN,
    });
    expect(summary).toEqual({ count: 1, headline: 'Boots added' });
  });
});
