import type { FinancialPlanResult } from '@folio/finance-engine';
import { formatFinancialDate, formatMoney } from './financialPresentation';

/** Display the next unresolved minimum from the same dated events as the money path.
 * The full event horizon matters: the next minimum can fall after the next payday. */
export function selectDebtMinimumPresentation(
  plan: Pick<FinancialPlanResult, 'asOf' | 'events'> | null | undefined,
  debtId?: string,
) {
  if (!plan) return null;
  const event = plan.events
    .filter(
      (item) =>
        item.source === 'debt-minimum' &&
        item.protectedOutflowMinor > 0 &&
        (debtId === undefined ||
          item.id.slice('debt-minimum:'.length, item.id.lastIndexOf(':')) === debtId),
    )
    .sort(
      (left, right) =>
        (left.originalDate ?? left.date).localeCompare(right.originalDate ?? right.date) ||
        left.id.localeCompare(right.id),
    )[0];
  if (!event) return null;
  const date = event.originalDate ?? event.date;
  const overdue = date < plan.asOf;
  const dueLabel = overdue
    ? `Overdue ${formatFinancialDate(date)}`
    : date === plan.asOf
      ? `Due today · ${formatFinancialDate(date)}`
      : `Due ${formatFinancialDate(date)}`;
  return {
    id: event.id,
    label: event.label,
    date,
    amountMinor: event.protectedOutflowMinor,
    amountLabel: `${formatMoney(event.protectedOutflowMinor / 100)} remaining`,
    overdue,
    dueLabel,
  };
}
