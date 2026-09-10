// Pure projections for Review's durable decision history.
//
// Review-before-truth keeps queued candidates separate from posted transactions. This module
// deliberately preserves that distinction: pending entries come from reviewQueue, while decision
// entries come from transactions/edits/timelineEvents. It never infers an explanation that the
// store does not contain.

import type { ReviewItem, StoredTxnEdit, TimelineEvent, Transaction } from '../store';

export const HISTORY_SCOPE = {
  activity: {
    title: 'What you added and corrected.',
    description: 'Confirmed money records, newest first. Corrections also appear in Decisions.',
    empty: 'No money records yet. Add a transaction or review a statement to start your activity.',
  },
  decisions: {
    title: 'Choices you confirmed.',
    description:
      'Corrections, bills paused or resumed, debt tracking changes, and items put aside. Open a record to review the current details.',
    empty: 'No corrections or other choices yet. New transactions appear in Activity.',
  },
  transactions: {
    title: 'Your confirmed transactions.',
    description:
      'Money in and out, using the latest corrected amount. Open details to see the history or make a correction.',
    empty: 'No confirmed transactions yet. Items waiting for review stay in Review.',
  },
  saw: {
    title: 'The figures Melo uses.',
    description:
      'These are the same confirmed transactions shown in Transactions. This view is not a separate record of Melo making changes.',
    empty:
      'No confirmed transaction figures yet. Melo will use only the numbers you add or confirm.',
  },
} as const;

/** Only offer a correction for a transaction that still exists. Other choices use their real home. */
export function historyDestination(
  row: DecisionHistoryRow,
  transactions: readonly Pick<Transaction, 'id'>[],
) {
  if (row.transactionId && transactions.some((item) => item.id === row.transactionId))
    return {
      kind: 'transaction' as const,
      id: row.transactionId,
      label: 'View details and correct',
    };
  if (row.kind === 'paused' || row.kind === 'resumed')
    return { kind: 'bills' as const, label: 'Review this bill' };
  if (row.kind === 'ignored') return { kind: 'hidden' as const, label: 'Review hidden items' };
  if (row.kind === 'debt-removed' || row.kind === 'debt-restored')
    return { kind: 'debts' as const, label: 'View debt tracking and history' };
  return null;
}

export type DecisionHistoryKind =
  | 'added'
  | 'edited'
  | 'ignored'
  | 'paused'
  | 'resumed'
  | 'debt-removed'
  | 'debt-restored';

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
    if (event.kind === 'debt-removed' || event.kind === 'debt-restored') {
      return [
        {
          id: event.id,
          at: event.at,
          kind: event.kind,
          title: event.subject,
          ...(event.note !== undefined ? { note: event.note } : {}),
        },
      ];
    }
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
