import type { FinancialCommitment } from '@folio/finance-engine';
import type { Sub } from '../store';
import { formatFinancialDate } from './financialPresentation';

/** Pair the recurring amount with its own schedule, not a preserved older unpaid occurrence. */
export function subscriptionSchedulePresentation(
  sub: Sub,
  today: string,
  commitments: readonly FinancialCommitment[],
) {
  const anchor = sub.obligationAnchorISO ?? sub.nextRenewalISO;
  const futureChange =
    anchor !== undefined &&
    anchor > today &&
    Object.keys(sub.obligationOccurrences ?? {}).some((date) => date < anchor);
  // Canonical IDs retain the recorded due date when a temporary forecast nudge changes placement.
  const nextDate = commitments
    .filter((item) => item.id.startsWith(`subscription:${sub.name}:`))
    .map((item) => item.id.slice(-10))
    .filter((date) => date >= today && (anchor === undefined || date >= anchor))
    .sort()[0];
  return {
    amountLabel: futureChange ? 'Future scheduled amount' : 'Scheduled amount',
    dateLabel: futureChange
      ? `New schedule starts ${formatFinancialDate(anchor)}`
      : nextDate
        ? `Next scheduled ${formatFinancialDate(nextDate)}`
        : 'Check next date',
  };
}
