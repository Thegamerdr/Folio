import type { FinancialPlanResult } from '@folio/finance-engine';
import type { AppState } from '../store';
import { formatMoney, selectFinancialPresentation } from './financialPresentation';

/** A forecast preview does not confirm overdue payments or unchecked source figures. Keep those
 * recorded prerequisites until commit, while presenting the existing canonical move's amount. */
export function selectRecoveryPreviewPresentation(
  state: AppState,
  plan: FinancialPlanResult,
  afterAmount: number,
  hasSelection: boolean,
) {
  const presentation = selectFinancialPresentation(state, {
    ...plan,
    safeToSpendMinor: Math.round(afterAmount * 100),
  });
  const closesGap = Number.isFinite(afterAmount) && afterAmount >= 0;
  const canReassure = hasSelection && closesGap && presentation.canReassure;
  const needsAttention =
    !presentation.complete ||
    presentation.overdueCount > 0 ||
    presentation.pendingReview > 0 ||
    !plan.nextIncomeDate;
  const caption = !hasSelection
    ? 'Gap after recorded costs and buffer'
    : closesGap
      ? canReassure
        ? 'This preview closes the forecast gap.'
        : `No gap in this preview. ${presentation.message}`
      : `Still ${formatMoney(Math.abs(afterAmount))} short. ${needsAttention ? presentation.message : 'Review the remaining gap.'}`;
  return {
    presentation,
    closesGap,
    canReassure,
    caption,
    mood: canReassure ? ('calm' as const) : ('concern' as const),
    meloLine: hasSelection
      ? needsAttention
        ? presentation.message
        : closesGap
          ? 'This preview covers the current gap. Check the change before saving it.'
          : 'This preview reduces the gap. Review what is still needed before saving.'
      : 'Choose a change to see its effect before saving.',
  };
}
