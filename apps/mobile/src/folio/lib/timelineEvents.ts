// @rn-engine timeline-verbs — the missing event engine behind TimelineScreen's verb-state rows.
//
// The web design source (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/
// ScreenTimeline.tsx) never actually built this: it hardcoded 8 demo rows using a 5-verb union
// (Added / Left for later / Ignored / Edited / Paused) and read neither `transactions` nor `cycles`
// despite its own doc header claiming it did. There is nothing to "port" for the verb projection —
// this file is the real, first-class implementation, built from two real sources:
//
//   1. `transactions` (+ `edits`) — every posted spend/income is an "Added" row; a transaction with
//      at least one correction in `edits` is "Edited" instead (a Melo-logged spend is ALSO edited,
//      by definition — see `verbForTransaction`).
//   2. `timelineEvents` (store.ts) — the append-only log this port introduces for the two verb-state
//      moments that have no other durable, human-readable trace: a subscription paused/resumed, and
//      a Review candidate ignored. The action suppresses exact future matches until the user unhides
//      it, so the visible verb says "Ignored" rather than misrepresenting it as a temporary deferral.
//
// Both sources are merged newest-first by timestamp into one `TimelineRow[]` feed. Pure — no store
// reads here; callers (TimelineScreen) pass in the two slices + `now`.

import type { Transaction, StoredTxnEdit, TimelineEvent } from '../store';

// The verbs the web's ScreenTimeline union defines, reproduced verbatim (COPY FROZEN — no new verb
// strings. The web demo distinguished "Left for later" and "Ignored", but the real native action is
// the latter: it writes a durable suppression signature and is reversible from Hidden review.
export type TimelineVerb =
  | 'Added'
  | 'Pending'
  | 'Declined'
  | 'Reversed'
  | 'Voided'
  | 'Duplicate'
  | 'Refunded'
  | 'Transferred'
  | 'Left for later'
  | 'Ignored'
  | 'Edited'
  | 'Paused'
  | 'Resumed';

export type TimelineRow = {
  id: string;
  /** ISO timestamp — the sort key. Row builders elsewhere (TimelineScreen) format this for display. */
  at: string;
  verb: TimelineVerb;
  what: string;
  note?: string;
  category?: string;
};

/** Transaction → verb. A transaction with at least one entry in `edits` (keyed by `txnId`) reads
 *  "Edited" — this covers both a user correction AND a Melo-logged nudge, since both are edits.
 *  Everything else is "Added". */
export function verbForTransaction(
  txn: Transaction,
  edits: readonly StoredTxnEdit[],
): TimelineVerb {
  if (txn.lifecycleStatus === 'pending') return 'Pending';
  if (txn.lifecycleStatus === 'reversed' || txn.reversalOfId !== undefined) return 'Reversed';
  if (txn.lifecycleStatus === 'void') {
    if (txn.lifecycleReason === 'declined') return 'Declined';
    if (txn.lifecycleReason === 'duplicate') return 'Duplicate';
    return 'Voided';
  }
  if (txn.moneyMovementKind === 'refund') return 'Refunded';
  if (txn.moneyMovementKind === 'transfer') return 'Transferred';
  const wasEdited = edits.some((e) => e.txnId === txn.id);
  return wasEdited ? 'Edited' : 'Added';
}

function lifecycleNoteForTransaction(txn: Transaction): string | undefined {
  switch (verbForTransaction(txn, [])) {
    case 'Pending':
      return 'waiting to settle · not counted yet';
    case 'Declined':
      return 'kept in history · not counted';
    case 'Duplicate':
      return 'linked as a duplicate · not counted';
    case 'Reversed':
      return 'reversal kept in history';
    case 'Voided':
      return 'kept in history · not counted';
    case 'Refunded':
      return txn.refundOfId === undefined
        ? 'refund · original transaction not linked'
        : 'refund linked to the original transaction';
    case 'Transferred':
      return 'between your accounts · not income or spending';
    default:
      return undefined;
  }
}

/** TimelineEvent.kind → verb + calm note. */
function verbForEvent(kind: TimelineEvent['kind']): {
  verb: TimelineVerb;
  note: string | undefined;
} {
  switch (kind) {
    case 'sub-paused':
      return { verb: 'Paused', note: 'for one cycle' };
    case 'sub-resumed':
      return { verb: 'Resumed', note: undefined };
    case 'review-ignored':
      return { verb: 'Ignored', note: 'hidden from future checks' };
    default:
      return { verb: 'Added', note: undefined };
  }
}

/** Merge `transactions` + `timelineEvents` into one newest-first `TimelineRow[]`. Pure. */
export function buildTimelineRows(args: {
  transactions: readonly Transaction[];
  edits: readonly StoredTxnEdit[];
  events: readonly TimelineEvent[];
}): TimelineRow[] {
  const { transactions, edits, events } = args;

  const txnRows: TimelineRow[] = transactions.map((txn) => {
    const note = lifecycleNoteForTransaction(txn);
    return {
      id: txn.id,
      at: txn.when,
      verb: verbForTransaction(txn, edits),
      what: txn.merchant,
      ...(note === undefined ? {} : { note }),
    };
  });

  const eventRows: TimelineRow[] = events.map((evt) => {
    const { verb, note } = verbForEvent(evt.kind);
    return {
      id: evt.id,
      at: evt.at,
      verb,
      what: evt.subject,
      ...(evt.note !== undefined ? { note: evt.note } : note !== undefined ? { note } : {}),
    };
  });

  return [...txnRows, ...eventRows].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}
