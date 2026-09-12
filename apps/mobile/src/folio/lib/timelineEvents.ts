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

import type { Sub, Transaction, StoredTxnEdit, TimelineEvent } from '../store';

// The verbs the web's ScreenTimeline union defines, reproduced verbatim (COPY FROZEN — no new verb
// strings. The web demo distinguished "Left for later" and "Ignored", but the real native action is
// the latter: it writes a durable suppression signature and is reversible from Hidden review.
export type TimelineVerb =
  | 'Added'
  | 'Left for later'
  | 'Ignored'
  | 'Edited'
  | 'Paused'
  | 'Resumed'
  | 'Removed from tracking'
  | 'Tracking restored';

export type TimelineRow = {
  id: string;
  /** ISO timestamp — the sort key. Row builders elsewhere (TimelineScreen) format this for display. */
  at: string;
  verb: TimelineVerb;
  what: string;
  note?: string;
  category?: string;
};

/** Resolve subscription event identities to the current readable name. Older events may carry
 * the ID in `subject`; newer events carry it in `entityId`. Name matching is deliberately absent:
 * duplicate subscription names must never decide identity. */
export function resolveSubscriptionDisplayName(
  subject: string,
  subscriptions: readonly Pick<Sub, 'id' | 'name'>[] | undefined,
  entityId?: string,
): string {
  // A present entityId marks the new event shape: subject is its persisted readable snapshot.
  // Only resolve the old shape where subject itself carried the immutable ID. This also protects
  // a legitimate label that happens to equal another subscription's ID.
  if (entityId !== undefined && subject !== entityId) return subject;
  return subscriptions?.find((subscription) => subscription.id === subject)?.name ?? subject;
}

function displaySubject(
  event: TimelineEvent,
  subscriptions: readonly Pick<Sub, 'id' | 'name'>[] | undefined,
): string {
  if (event.kind !== 'sub-paused' && event.kind !== 'sub-resumed') return event.subject;
  // New events persist a readable subject alongside entityId. Resolve only the legacy shape where
  // the subject itself is an immutable ID, preserving historical human-readable subjects even if
  // the subscription was renamed or removed.
  return resolveSubscriptionDisplayName(event.subject, subscriptions, event.entityId);
}

/** Transaction → verb. A transaction with at least one entry in `edits` (keyed by `txnId`) reads
 *  "Edited" — this covers both a user correction AND a Melo-logged nudge, since both are edits.
 *  Everything else is "Added". */
export function verbForTransaction(
  txn: Transaction,
  edits: readonly StoredTxnEdit[],
): TimelineVerb {
  const wasEdited = edits.some((e) => e.txnId === txn.id);
  return wasEdited ? 'Edited' : 'Added';
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
    case 'debt-removed':
      return { verb: 'Removed from tracking', note: 'Recorded payments and tracked cash kept' };
    case 'debt-restored':
      return { verb: 'Tracking restored', note: 'Recorded payments and tracked cash kept' };
    default:
      return { verb: 'Added', note: undefined };
  }
}

/** Merge `transactions` + `timelineEvents` into one newest-first `TimelineRow[]`. Pure. */
export function buildTimelineRows(args: {
  transactions: readonly Transaction[];
  edits: readonly StoredTxnEdit[];
  events: readonly TimelineEvent[];
  subscriptions?: readonly Pick<Sub, 'id' | 'name'>[];
}): TimelineRow[] {
  const { transactions, edits, events, subscriptions } = args;

  const txnRows: TimelineRow[] = transactions.map((txn) => ({
    id: txn.id,
    at: txn.when,
    verb: verbForTransaction(txn, edits),
    what: txn.merchant,
  }));

  const eventRows: TimelineRow[] = events.map((evt) => {
    const { verb, note } = verbForEvent(evt.kind);
    return {
      id: evt.id,
      at: evt.at,
      verb,
      what: displaySubject(evt, subscriptions),
      ...(evt.note !== undefined ? { note: evt.note } : note !== undefined ? { note } : {}),
    };
  });

  return [...txnRows, ...eventRows].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}
