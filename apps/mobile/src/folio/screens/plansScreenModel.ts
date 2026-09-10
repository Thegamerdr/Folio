import type { AppState } from '../store';
import { buildFinancialPlanFromState } from '../lib/financialPlan';
import { formatFinancialDate, selectFinancialPresentation } from '../lib/financialPresentation';
import { buildCanonicalPlanUpcoming } from './planModel';

/** The alternate Plans route shares Plan's exact outstanding obligations and income boundary. */
export function buildPlansScreenPresentation(state: AppState, now: Date) {
  const plan = buildFinancialPlanFromState(state, { now });
  const presentation = selectFinancialPresentation(state, plan);
  const upcoming = buildCanonicalPlanUpcoming(plan);
  const low = plan.timeline
    .filter((point) => plan.nextIncomeDate === null || point.date < plan.nextIncomeDate)
    .reduce<
      (typeof plan.timeline)[number] | undefined
    >((prior, point) => (prior === undefined || point.closingMinor < prior.closingMinor ? point : prior), undefined);
  return {
    plan,
    presentation,
    upcoming,
    totalMinor: plan.pendingObligations.reduce((sum, event) => sum + event.amountMinor, 0),
    paydayLabel: plan.nextIncomeDate
      ? `Next payday · ${formatFinancialDate(plan.nextIncomeDate)}`
      : 'Next payday · Not set',
    daysToPayday: plan.nextIncomeDate
      ? Math.round((Date.parse(plan.nextIncomeDate) - Date.parse(plan.asOf)) / 86_400_000)
      : null,
    tightPoint: low ? { date: low.date, amountMinor: low.closingMinor } : null,
    emptyMessage: plan.nextIncomeDate
      ? 'No unpaid bills or debt minimums are recorded before the next payday.'
      : 'No unpaid bills or debt minimums are recorded within this forecast.',
  };
}
