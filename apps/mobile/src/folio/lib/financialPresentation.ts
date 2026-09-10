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
  // A paused or nudged future commitment is a user-owned forecast assumption. The finance engine
  // still owns the amount; this gate only keeps shared copy from calling the resulting estimate
  // unconditionally safe until the user confirms the changed date/occurrence.
  const pausedForecastCount = state.subs.filter((subscription) => {
    if (!state.subPaused[subscription.name]) return false;
    return plan?.asOf === undefined || subscription.pausedUntil === undefined
      ? true
      : subscription.pausedUntil > plan.asOf;
  }).length;
  const nudgedForecastCount = state.subs.filter((subscription) => {
    const delta = state.subOverrides[subscription.name];
    return typeof delta === 'number' && Number.isFinite(delta) && delta !== 0;
  }).length;
  const forecastAssumptionCount = pausedForecastCount + nudgedForecastCount;
  const canReassure =
    complete &&
    Boolean(plan?.nextIncomeDate) &&
    overdueCount === 0 &&
    pendingReview === 0 &&
    forecastAssumptionCount === 0 &&
    (plan?.safeToSpendMinor ?? -1) >= 0;
  const label =
    plan === null
      ? 'Checking your plan'
      : !complete
        ? 'We need your numbers'
        : overdueCount > 0
          ? 'Overdue commitments need attention'
          : pendingReview > 0
            ? 'Some figures need your review'
            : !plan?.nextIncomeDate
              ? 'No next income date'
              : forecastAssumptionCount > 0
                ? 'Check your forecast changes'
                : plan.safeToSpendMinor < 0
                  ? 'Gap after bills, essentials and buffer'
                  : 'Safe to spend until payday';
  const message =
    plan === null
      ? 'Checking your recorded numbers and dates.'
      : !complete
        ? `Add or confirm your ${needs.join(', ')}. Only numbers you add are used.`
        : overdueCount > 0
          ? `${overdueCount} overdue ${overdueCount === 1 ? 'commitment is' : 'commitments are'} still reserved. Check what has actually been paid.`
          : pendingReview > 0
            ? 'Review the pending figures before relying on this estimate.'
            : !plan?.nextIncomeDate
              ? 'No expected income is recorded. Review your income dates before relying on a spending amount.'
              : forecastAssumptionCount > 0
                ? 'Your forecast includes paused or moved bills. This does not change payments with your provider. Check what is actually due before relying on this estimate.'
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
    pausedForecastCount,
    nudgedForecastCount,
    forecastAssumptionCount,
    canReassure,
    label,
    message,
  };
}

/** Shortfall copy is only authoritative for a complete plan with a known income date. */
export function shouldShowShortfall(
  plan: Pick<FinancialPlanResult, 'safeToSpendMinor' | 'nextIncomeDate'> | null,
  presentation: Pick<ReturnType<typeof selectFinancialPresentation>, 'complete'>,
): boolean {
  return Boolean(
    presentation.complete && plan?.nextIncomeDate && plan.safeToSpendMinor < 0,
  );
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

/** Name the amount itself separately from an overdue/review status that qualifies it. */
export function financialAmountLabel(
  plan: Pick<FinancialPlanResult, 'safeToSpendMinor'>,
  presentation: Pick<ReturnType<typeof selectFinancialPresentation>, 'canReassure'>,
): string {
  if (plan.safeToSpendMinor < 0) return 'Gap after bills, essentials and buffer';
  return presentation.canReassure
    ? 'Safe to spend until payday'
    : 'After recorded costs and buffer';
}

/** Mode suggestions are financial guidance too, so only show them for a qualified picture. */
export function qualifyModeSuggestion<T>(
  suggestion: T | null,
  presentation: Pick<ReturnType<typeof selectFinancialPresentation>, 'canReassure'>,
): T | null {
  return presentation.canReassure ? suggestion : null;
}

export function formatMoney(amount: number, decimals = false): string {
  if (!Number.isFinite(amount)) return 'Not available';
  const hasPennies = Math.round(Math.abs(amount) * 100) % 100 !== 0;
  return `${amount < 0 ? '−' : ''}£${Math.abs(amount).toLocaleString('en-GB', {
    minimumFractionDigits: decimals || hasPennies ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}
