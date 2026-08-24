// Pure projections for Review's durable decision history.
//
// Review-before-truth keeps queued candidates separate from posted transactions. This module
// deliberately preserves that distinction: pending entries come from reviewQueue, while decision
// entries come from transactions/edits/timelineEvents. It never infers an explanation that the
// store does not contain.

import type { ReviewItem, StoredTxnEdit, TimelineEvent, Transaction } from '../store';

export type DecisionHistoryKind = 'added' | 'edited' | 'ignored' | 'paused' | 'resumed';

export type DecisionHistoryRow = {
  id: string;
  at: string;
  kind: DecisionHistoryKind;
  title: string;
  transactionId?: string;
  field?: StoredTxnEdit['field'];
  before?: StoredTxnEdit['before'];
  after?: StoredTxnEdit['after'];
  note?: string;
};

export type PendingReviewRow = {
  id: string;
  at: string;
  title: string;
  amount: number;
  date?: string;
  source: ReviewItem['source'];
};

/** Build the read-only decision history from the durable native authorities. */
export function buildDecisionHistoryRows(args: {
  transactions: readonly Transaction[];
  edits: readonly StoredTxnEdit[];
  events: readonly TimelineEvent[];
}): DecisionHistoryRow[] {
  const { transactions, edits, events } = args;
  const titles = new Map(transactions.map((transaction) => [transaction.id, transaction.merchant]));

  const transactionRows: DecisionHistoryRow[] = transactions.map((transaction) => ({
    id: `added:${transaction.id}`,
    at: transaction.when,
    // The confirmed transaction remains the original activity. Its immutable corrections are
    // separate rows below, so an edited item never rewrites history or creates a duplicate
    // transaction-level "Changed" decision.
    kind: 'added',
    title: transaction.merchant,
    transactionId: transaction.id,
  }));

  const editRows: DecisionHistoryRow[] = edits.map((edit, index) => ({
    id: edit.id ?? `edit:${edit.txnId}:${edit.at}:${index}`,
    at: edit.at,
    kind: 'edited',
    title: titles.get(edit.txnId) ?? 'A transaction',
    transactionId: edit.txnId,
    field: edit.field,
    before: edit.before,
    after: edit.after,
  }));

  const eventRows: DecisionHistoryRow[] = events.flatMap((event): DecisionHistoryRow[] => {
    if (event.kind === 'review-ignored') {
      return [
        {
          id: event.id,
          at: event.at,
          kind: 'ignored' as const,
          title: event.subject,
          ...(event.note !== undefined ? { note: event.note } : {}),
        },
      ];
    }
    return [
      {
        id: event.id,
        at: event.at,
        kind: event.kind === 'sub-paused' ? ('paused' as const) : ('resumed' as const),
        title: event.subject,
        ...(event.note !== undefined ? { note: event.note } : {}),
      },
    ];
  });

  // Keep the transaction-level row for a compact activity history, but expose every immutable
  // field correction as its own decision row so before/after values are never collapsed away.
  return [...transactionRows, ...editRows, ...eventRows].sort((a, b) => {
    const delta = new Date(b.at).getTime() - new Date(a.at).getTime();
    return Number.isFinite(delta) && delta !== 0 ? delta : b.id.localeCompare(a.id);
  });
}

/** Pending candidates are proposals, not history. Keep the source and date exactly as staged. */
export function buildPendingReviewRows(queue: readonly ReviewItem[]): PendingReviewRow[] {
  // The store keeps the visible queue in decision order (newest first, with spillover refill
  // preserving that order). Do not reorder it here: the first row is the same candidate ReviewScreen
  // will open, so the hub and detail must agree about what "next" means.
  return queue.map((item) => ({
    id: item.id,
    at: item.addedAt,
    title: item.merchant,
    amount: item.amount,
    ...(item.date !== undefined ? { date: item.date } : {}),
    source: item.source,
  }));
}
