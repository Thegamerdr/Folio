import type { FinancialPlanResult } from '@folio/finance-engine';
import type { AppState } from '../store';
import { formatMoney, selectFinancialPresentation } from './financialPresentation';

/** The ritual reviews forecasts; a future salary must never fund an action offered now. */
export function selectRitualFinancialReview(
  state: AppState,
  plan: FinancialPlanResult,
  totalOwed = 0,
) {
  const presentation = selectFinancialPresentation(state, plan);
  const availableForExtra = presentation.canReassure ? plan.availableForExtraMinor / 100 : 0;
  const repayHeadroom = Math.min(Math.max(0, totalOwed), availableForExtra);
  const spendingSummary = presentation.canReassure
    ? `${presentation.label}: ${formatMoney(plan.safeToSpendMinor / 100)}. ${presentation.message}`
    : `${presentation.label}. ${presentation.message}${presentation.complete ? ` Estimate after recorded costs and buffer: ${formatMoney(plan.safeToSpendMinor / 100)}.` : ''}`;
  return { presentation, availableForExtra, repayHeadroom, spendingSummary };
}
