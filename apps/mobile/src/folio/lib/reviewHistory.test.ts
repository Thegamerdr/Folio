import { describe, expect, it } from 'vitest';

import { buildDecisionHistoryRows, buildPendingReviewRows } from './reviewHistory';
import type { ReviewItem, StoredTxnEdit, TimelineEvent, Transaction } from '../store';

const transaction = (id: string, when: string, merchant: string): Transaction => ({
  id,
  when,
  merchant,
  amount: -42,
  category: 'other',
  source: 'manual',
});

describe('review history projections', () => {
  it('keeps posted decisions and each immutable correction visible', () => {
    const tx = transaction('txn-1', '2026-08-01T10:00:00.000Z', 'Cafe');
    const edit: StoredTxnEdit = {
      id: 'edit-1',
      txnId: tx.id,
      field: 'amount',
      before: -42,
      after: -40,
      at: '2026-08-02T10:00:00.000Z',
      by: 'user',
    };
    const rows = buildDecisionHistoryRows({ transactions: [tx], edits: [edit], events: [] });
    expect(rows.map((row) => row.id)).toEqual(['edit-1', 'added:txn-1']);
    expect(rows[0]).toMatchObject({ kind: 'edited', title: 'Cafe', before: -42, after: -40 });
    expect(rows[1]).toMatchObject({ kind: 'added', title: 'Cafe' });
  });

  it('maps ignored and subscription events without inventing details', () => {
    const events: TimelineEvent[] = [
      {
        id: 'ignore-1',
        at: '2026-08-03T10:00:00.000Z',
        kind: 'review-ignored',
        subject: 'Unknown',
      },
      {
        id: 'pause-1',
        at: '2026-08-02T10:00:00.000Z',
        kind: 'sub-paused',
        subject: 'Music',
        note: 'for one cycle',
      },
    ];
    const rows = buildDecisionHistoryRows({ transactions: [], edits: [], events });
    expect(rows.map((row) => row.kind)).toEqual(['ignored', 'paused']);
    expect(rows[0]?.note).toBeUndefined();
    expect(rows[1]?.note).toBe('for one cycle');
  });

  it('keeps pending review separate and preserves its staged values', () => {
    const queue: ReviewItem[] = [
      {
        id: 'pending-1',
        source: 'pdf',
        merchant: 'Market',
        amount: -12,
        date: '2026-08-04',
        addedAt: '2026-08-04T10:00:00.000Z',
      },
    ];
    expect(buildPendingReviewRows(queue)).toEqual([
      {
        id: 'pending-1',
        at: '2026-08-04T10:00:00.000Z',
        title: 'Market',
        amount: -12,
        date: '2026-08-04',
        source: 'pdf',
      },
    ]);
  });
});
