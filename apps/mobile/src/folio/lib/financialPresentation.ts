import type { FinancialPlanResult } from '@folio/finance-engine';
import type { AppState } from '../store';

/** Presentation prerequisites only. Every monetary result remains owned by finance-engine. */
export function selectFinancialPresentation(state: AppState, plan: FinancialPlanResult | null) {
  const balance = state.currentBalance;
  const balanceKnown =
    balance.provided === true ||
    balance.amount !== 0 ||
    balance.confidence === 'corrected' ||
    ['statement', 'pdf-derived', 'ocr-derived'].includes(balance.source);
  const confirmed = state.onboarding.financialSetupConfirmed === true;
  const incomeKnown = confirmed || Boolean(plan?.nextIncomeDate);
  // Older completed manual setups explicitly wrote this slot even for a zero allowance.
  const costsKnown =
    confirmed ||
    (state.onboarding.done &&
      Object.prototype.hasOwnProperty.call(state.modeExtras ?? {}, 'reset'));
  const needs: string[] = [];
  if (!balanceKnown) needs.push('current balance');
  if (!incomeKnown) needs.push('payday and income');
  if (!costsKnown) needs.push('regular costs, essentials and buffer');
  const complete = needs.length === 0;
  const overdue = plan?.pendingObligations.filter((item) => item.date < plan.asOf) ?? [];
  const overdueCount = overdue.length;
  const pendingReview =
    (state.reviewQueue?.length ?? 0) + (state.reviewQueueSpillover?.length ?? 0);
  const canReassure =
    complete &&
    Boolean(plan?.nextIncomeDate) &&
    overdueCount === 0 &&
    pendingReview === 0 &&
    (plan?.safeToSpendMinor ?? -1) >= 0;
  const label = !complete
    ? 'We need your numbers'
    : overdueCount > 0
      ? 'Overdue commitments need attention'
      : pendingReview > 0
        ? 'Some figures need your review'
        : !plan?.nextIncomeDate
          ? 'No next income date'
          : plan.safeToSpendMinor < 0
            ? 'Gap after bills, essentials and buffer'
            : 'Safe to spend until payday';
  const message = !complete
    ? `Add or confirm your ${needs.join(', ')}. Only numbers you add are used.`
    : overdueCount > 0
      ? `${overdueCount} overdue ${overdueCount === 1 ? 'commitment is' : 'commitments are'} still reserved. Check what has actually been paid.`
      : pendingReview > 0
        ? 'Review the pending figures before relying on this estimate.'
        : !plan?.nextIncomeDate
          ? 'No expected income is recorded. Review your income dates before relying on a spending amount.'
          : plan.safeToSpendMinor < 0
            ? 'The current plan leaves a gap. Review the costs and dates that create it.'
            : 'After your recorded bills, essentials, debt minimums and buffer.';
  return {
    complete,
    needs,
    balanceKnown,
    incomeKnown,
    costsKnown,
    overdue,
    overdueCount,
    pendingReview,
    canReassure,
    label,
    message,
  };
}

export function formatFinancialDate(iso: string | null | undefined): string {
  if (!iso) return 'Not set';
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatMoney(amount: number, decimals = false): string {
  if (!Number.isFinite(amount)) return 'Not available';
  const hasPennies = Math.round(Math.abs(amount) * 100) % 100 !== 0;
  return `${amount < 0 ? '−' : ''}£${Math.abs(amount).toLocaleString('en-GB', {
    minimumFractionDigits: decimals || hasPennies ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}
