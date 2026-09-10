import type { FinancialPlanResult } from '@folio/finance-engine';
import type { AppState } from '../store';
import { buildFinancialPlanFromState } from './financialPlan';
import { formatMoney } from './financialPresentation';

/** Preview the existing addCycle forecast cleanup without recording a review or moving money. */
export function previewRitualCompletion(
  state: AppState,
  beforePlan: FinancialPlanResult,
  now: Date,
) {
  const cleared: string[] = [];
  if (state.spendHold) cleared.push('your spending preview');
  if ((state.whatIfHolds?.length ?? 0) > 0) cleared.push('your What If previews');
  if (Object.values(state.subOverrides).some((offset) => offset !== 0))
    cleared.push('temporary bill-date changes');
  const clearsForecastChanges = cleared.length > 0;
  const afterPlan = clearsForecastChanges
    ? buildFinancialPlanFromState(
        { ...state, subOverrides: {}, spendHold: null, whatIfHolds: [] },
        { now },
      )
    : beforePlan;
  const scope = clearsForecastChanges
    ? `Finishing saves this review and your note. It also clears ${cleared.join(', ')} for this cycle. The forecast returns to your recorded costs and dates.`
    : 'Finishing saves this review and your note.';
  const effect = clearsForecastChanges
    ? `After recorded costs and buffer: ${formatMoney(beforePlan.safeToSpendMinor / 100)} now → ${formatMoney(afterPlan.safeToSpendMinor / 100)} after finishing. Your tracked cash stays ${formatMoney(beforePlan.currentBalanceMinor / 100)}.`
    : null;
  return { clearsForecastChanges, scope, effect, beforePlan, afterPlan };
}
