import type { Debt, TimelineEvent, Transaction } from '../store';
import { formatFinancialDate } from './financialPresentation';

/** Sort recorded history newest first while keeping rows with no usable date visible at the end. */
function sortNewestFirst<T>(
  items: readonly T[],
  getTimestamp: (item: T) => string | undefined,
): T[] {
  return items
    .map((item, index) => ({ item, index, timestamp: getTimestamp(item) }))
    .sort((left, right) => {
      const leftTime = left.timestamp === undefined ? undefined : Date.parse(left.timestamp);
      const rightTime = right.timestamp === undefined ? undefined : Date.parse(right.timestamp);
      const leftKnown = leftTime !== undefined && Number.isFinite(leftTime);
      const rightKnown = rightTime !== undefined && Number.isFinite(rightTime);
      if (leftKnown && rightKnown && leftTime !== rightTime) return rightTime! - leftTime!;
      if (leftKnown !== rightKnown) return leftKnown ? -1 : 1;
      return left.index - right.index;
    })
    .map(({ item }) => item);
}

/** Present recorded state without inferring a repayment from tracking removal or a zero balance. */
export function selectDebtTrackingPresentation(args: {
  debts: readonly Debt[];
  transactions: readonly Transaction[];
  timelineEvents: readonly TimelineEvent[];
}) {
  const active = args.debts.filter((debt) => debt.balance > 0);
  const cleared = sortNewestFirst(
    args.debts
      .filter((debt) => debt.balance === 0)
      .map((debt) => {
        const lastPayment = sortNewestFirst(
          args.transactions.filter(
            (transaction) =>
              transaction.financialAction?.kind === 'debt-payment' &&
              transaction.financialAction.debtId === debt.id &&
              transaction.financialAction.principalAppliedMinor > 0,
          ),
          (transaction) => transaction.when,
        )[0];
        return { debt, lastPaymentAt: lastPayment?.when };
      }),
    (item) => item.lastPaymentAt || item.debt.addedAt,
  );
  const currentIds = new Set(args.debts.map((debt) => debt.id));
  const removedById = new Map<string, { id: string; name: string; removedAt?: string }>();
  // The durable log is newest first; use identity instead of the user-editable name. The final
  // selector below repeats the sort so this remains explicit even if the durable source changes
  // its physical order in a future migration.
  const latestEvents = new Map<string, TimelineEvent>();
  for (const event of sortNewestFirst(args.timelineEvents, (item) => item.at)) {
    if (
      (event.kind === 'debt-removed' || event.kind === 'debt-restored') &&
      event.entityId &&
      !latestEvents.has(event.entityId)
    )
      latestEvents.set(event.entityId, event);
  }
  for (const [id, event] of latestEvents) {
    if (event.kind === 'debt-removed' && !currentIds.has(id)) {
      const removedAt = typeof event.at === 'string' && event.at.trim() ? event.at : undefined;
      removedById.set(id, {
        id,
        name: event.subject,
        ...(removedAt === undefined ? {} : { removedAt }),
      });
    }
  }
  // Old installs may have preserved payments but no tracking-removal receipt. Keep that known
  // history visible without inventing either a removal date or a zero balance.
  // Legacy removed rows have no removal receipt/date. Keep them, but retain the source's newest
  // first transaction convention as their stable unknown-date order.
  for (const transaction of sortNewestFirst(args.transactions, (item) => item.when)) {
    const action = transaction.financialAction;
    if (
      action?.kind === 'debt-payment' &&
      !currentIds.has(action.debtId) &&
      !removedById.has(action.debtId)
    ) {
      removedById.set(action.debtId, {
        id: action.debtId,
        name: transaction.merchant.replace(/^Debt payment:\s*/i, '') || 'Previously recorded debt',
      });
    }
  }
  const removed = sortNewestFirst([...removedById.values()], (item) => item.removedAt);
  const status = active.length
    ? 'active'
    : cleared.length
      ? 'cleared'
      : removed.length
        ? 'removed'
        : 'never';
  const lastPaymentAt = cleared.every((item) => item.lastPaymentAt !== undefined)
    ? sortNewestFirst(
        cleared.map((item) => item.lastPaymentAt!),
        (timestamp) => timestamp,
      )[0]
    : undefined;
  const title =
    status === 'active'
      ? 'Outstanding debts'
      : status === 'cleared'
        ? 'All recorded debts cleared'
        : status === 'removed'
          ? 'Debt tracking removed'
          : 'No debts declared yet';
  const detail =
    status === 'cleared'
      ? `${lastPaymentAt ? `Last recorded payment ${formatFinancialDate(lastPaymentAt)}. ` : ''}Your £0 debt records and payment history stay available. You can edit a balance or undo a recent payment.`
      : status === 'removed'
        ? 'These debts are no longer included in your forecast. Recorded payments and tracked cash were kept. Removing tracking does not pay off or cancel a debt.'
        : 'Add a debt with its balance, monthly minimum and due day so Melo can include its required payment.';
  return { status, active, cleared, removed, title, detail, lastPaymentAt } as const;
}
