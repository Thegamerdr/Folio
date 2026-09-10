import type { Debt, TimelineEvent, Transaction } from '../store';
import { formatFinancialDate } from './financialPresentation';

/** Present recorded state without inferring a repayment from tracking removal or a zero balance. */
export function selectDebtTrackingPresentation(args: {
  debts: readonly Debt[];
  transactions: readonly Transaction[];
  timelineEvents: readonly TimelineEvent[];
}) {
  const active = args.debts.filter((debt) => debt.balance > 0);
  const cleared = args.debts
    .filter((debt) => debt.balance === 0)
    .map((debt) => {
      const lastPayment = args.transactions
        .filter(
          (transaction) =>
            transaction.financialAction?.kind === 'debt-payment' &&
            transaction.financialAction.debtId === debt.id &&
            transaction.financialAction.principalAppliedMinor > 0,
        )
        .sort((a, b) => b.when.localeCompare(a.when))[0];
      return { debt, lastPaymentAt: lastPayment?.when };
    });
  const currentIds = new Set(args.debts.map((debt) => debt.id));
  const removedById = new Map<string, { id: string; name: string; removedAt?: string }>();
  // The durable log is newest first; use identity instead of the user-editable name.
  const latestEvents = new Map<string, TimelineEvent>();
  for (const event of [...args.timelineEvents].sort((a, b) => b.at.localeCompare(a.at))) {
    if (
      (event.kind === 'debt-removed' || event.kind === 'debt-restored') &&
      event.entityId &&
      !latestEvents.has(event.entityId)
    )
      latestEvents.set(event.entityId, event);
  }
  for (const [id, event] of latestEvents) {
    if (event.kind === 'debt-removed' && !currentIds.has(id))
      removedById.set(id, { id, name: event.subject, removedAt: event.at });
  }
  // Old installs may have preserved payments but no tracking-removal receipt. Keep that known
  // history visible without inventing either a removal date or a zero balance.
  for (const transaction of args.transactions) {
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
  const removed = [...removedById.values()];
  const status = active.length
    ? 'active'
    : cleared.length
      ? 'cleared'
      : removed.length
        ? 'removed'
        : 'never';
  const lastPaymentAt = cleared.every((item) => item.lastPaymentAt !== undefined)
    ? cleared
        .map((item) => item.lastPaymentAt!)
        .sort()
        .at(-1)
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
