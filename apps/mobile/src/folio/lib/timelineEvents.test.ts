// Timeline row-builder tests — pure-logic coverage for
// apps/mobile/src/folio/lib/timelineEvents.ts (@rn-engine timeline-verbs).
//
// Pins: transactions with no matching edit read "Added"; a transaction with a matching
// edits[].txnId reads "Edited"; timelineEvents map to their truthful verb + note (sub-paused →
// "Paused"/"for one cycle", sub-resumed → "Resumed"/no note, review-ignored → "Ignored"/"hidden
// from future checks"); the merge is newest-first by timestamp regardless of source; and the
// function is pure (no store reads, no mutation of its inputs).
//
// Node-safe: touches only this module + the Transaction/TimelineEvent/StoredTxnEdit types (no
// react-native runtime, no DOM), so it is a plain `.test.ts`.

import { describe, expect, it } from 'vitest';

import { buildTimelineRows, verbForTransaction } from './timelineEvents';
import type { Transaction, StoredTxnEdit, TimelineEvent } from '../store';

function txn(
  id: string,
  when: string,
  merchant: string,
  extra: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    when,
    merchant,
    amount: -10,
    category: 'other',
    source: 'manual',
    ...extra,
  };
}

function edit(txnId: string, extra: Partial<StoredTxnEdit> = {}): StoredTxnEdit {
  return {
    txnId,
    field: 'merchant',
    before: 'Old',
    after: 'New',
    at: '2026-07-01T00:00:00.000Z',
    by: 'user',
    ...extra,
  };
}

function event(kind: TimelineEvent['kind'], subject: string, at: string): TimelineEvent {
  return { id: `evt-${subject}-${at}`, at, kind, subject };
}

describe('verbForTransaction', () => {
  it('reads "Added" when there is no matching edit', () => {
    expect(verbForTransaction(txn('t1', '2026-07-01T00:00:00.000Z', 'Tesco'), [])).toBe('Added');
  });

  it('reads "Edited" when edits carries an entry keyed by this txnId', () => {
    const t = txn('t1', '2026-07-01T00:00:00.000Z', 'Tesco');
    expect(verbForTransaction(t, [edit('t1')])).toBe('Edited');
  });

  it('reads "Added" when edits exist but key a DIFFERENT transaction', () => {
    const t = txn('t1', '2026-07-01T00:00:00.000Z', 'Tesco');
    expect(verbForTransaction(t, [edit('other-txn')])).toBe('Added');
  });

  it('uses truthful lifecycle and movement verbs before generic edit history', () => {
    expect(
      verbForTransaction(
        txn('pending', '2026-07-01T00:00:00.000Z', 'Card hold', {
          lifecycleStatus: 'pending',
        }),
        [edit('pending')],
      ),
    ).toBe('Pending');
    expect(
      verbForTransaction(
        txn('declined', '2026-07-01T00:00:00.000Z', 'Declined card', {
          lifecycleStatus: 'void',
          lifecycleReason: 'declined',
        }),
        [],
      ),
    ).toBe('Declined');
    expect(
      verbForTransaction(
        txn('refund', '2026-07-01T00:00:00.000Z', 'Refund', {
          amount: 10,
          moneyMovementKind: 'refund',
          refundOfId: 'purchase',
        }),
        [],
      ),
    ).toBe('Refunded');
    expect(
      verbForTransaction(
        txn('transfer', '2026-07-01T00:00:00.000Z', 'Move', {
          moneyMovementKind: 'transfer',
          transferLinkId: 'move-1',
        }),
        [],
      ),
    ).toBe('Transferred');
  });
});

describe('buildTimelineRows', () => {
  it('maps a plain transaction to an "Added" row', () => {
    const rows = buildTimelineRows({
      transactions: [txn('t1', '2026-07-01T09:00:00.000Z', 'Tesco')],
      edits: [],
      events: [],
    });
    expect(rows).toEqual([
      { id: 't1', at: '2026-07-01T09:00:00.000Z', verb: 'Added', what: 'Tesco' },
    ]);
  });

  it('maps an edited transaction to an "Edited" row', () => {
    const rows = buildTimelineRows({
      transactions: [txn('t1', '2026-07-01T09:00:00.000Z', 'Tesco')],
      edits: [edit('t1')],
      events: [],
    });
    expect(rows[0]!.verb).toBe('Edited');
  });

  it('explains why lifecycle rows are retained without affecting the money picture', () => {
    const rows = buildTimelineRows({
      transactions: [
        txn('pending', '2026-07-01T09:00:00.000Z', 'Card hold', {
          lifecycleStatus: 'pending',
        }),
        txn('duplicate', '2026-07-01T08:00:00.000Z', 'Repeated row', {
          lifecycleStatus: 'void',
          lifecycleReason: 'duplicate',
          duplicateOfId: 'original',
        }),
      ],
      edits: [],
      events: [],
    });

    expect(rows[0]).toMatchObject({ verb: 'Pending', note: 'waiting to settle · not counted yet' });
    expect(rows[1]).toMatchObject({
      verb: 'Duplicate',
      note: 'linked as a duplicate · not counted',
    });
  });

  it('maps sub-paused to "Paused" with a "for one cycle" note', () => {
    const rows = buildTimelineRows({
      transactions: [],
      edits: [],
      events: [event('sub-paused', 'Disney+', '2026-07-01T09:00:00.000Z')],
    });
    expect(rows[0]).toEqual({
      id: 'evt-Disney+-2026-07-01T09:00:00.000Z',
      at: '2026-07-01T09:00:00.000Z',
      verb: 'Paused',
      what: 'Disney+',
      note: 'for one cycle',
    });
  });

  it('maps sub-resumed to "Resumed" with no note', () => {
    const rows = buildTimelineRows({
      transactions: [],
      edits: [],
      events: [event('sub-resumed', 'Disney+', '2026-07-01T09:00:00.000Z')],
    });
    expect(rows[0]!.verb).toBe('Resumed');
    expect(rows[0]!.note).toBeUndefined();
  });

  it('maps review-ignored to the durable action the user actually chose', () => {
    const rows = buildTimelineRows({
      transactions: [],
      edits: [],
      events: [event('review-ignored', 'Klarna', '2026-07-01T09:00:00.000Z')],
    });
    expect(rows[0]!.verb).toBe('Ignored');
    expect(rows[0]!.note).toBe('hidden from future checks');
  });

  it('an explicit event.note overrides the default verb note', () => {
    const rows = buildTimelineRows({
      transactions: [],
      edits: [],
      events: [
        {
          id: 'evt-1',
          at: '2026-07-01T09:00:00.000Z',
          kind: 'sub-paused',
          subject: 'Disney+',
          note: 'custom',
        },
      ],
    });
    expect(rows[0]!.note).toBe('custom');
  });

  it('merges transactions and events newest-first by timestamp, regardless of source', () => {
    const rows = buildTimelineRows({
      transactions: [
        txn('t-old', '2026-07-01T08:00:00.000Z', 'Tesco'),
        txn('t-new', '2026-07-03T08:00:00.000Z', 'Amazon'),
      ],
      edits: [],
      events: [event('sub-paused', 'Disney+', '2026-07-02T08:00:00.000Z')],
    });
    expect(rows.map((r) => r.id)).toEqual([
      't-new',
      'evt-Disney+-2026-07-02T08:00:00.000Z',
      't-old',
    ]);
  });

  it('is pure — does not mutate its input arrays', () => {
    const transactions = [txn('t1', '2026-07-01T09:00:00.000Z', 'Tesco')];
    const edits: StoredTxnEdit[] = [];
    const events: TimelineEvent[] = [event('sub-paused', 'Disney+', '2026-07-01T10:00:00.000Z')];
    const transactionsCopy = [...transactions];
    const eventsCopy = [...events];

    buildTimelineRows({ transactions, edits, events });

    expect(transactions).toEqual(transactionsCopy);
    expect(events).toEqual(eventsCopy);
  });

  it('returns an empty array when there is nothing to show', () => {
    expect(buildTimelineRows({ transactions: [], edits: [], events: [] })).toEqual([]);
  });
});
