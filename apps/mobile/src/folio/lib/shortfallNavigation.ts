import type { FinancialPlanResult } from '@folio/finance-engine';
import type { Pot } from '../store';
import type { selectFinancialPresentation } from './financialPresentation';

/** A zero forecast gap is still conditional when payments or imported figures need review. */
export function shortfallCompletionPresentation(
  presentation: ReturnType<typeof selectFinancialPresentation>,
) {
  return {
    canCelebrate: presentation.canReassure,
    headline: presentation.canReassure ? 'No gap in the current plan' : presentation.label,
    message: presentation.canReassure
      ? presentation.message
      : `The forecast gap is closed. ${presentation.message}`,
    mood: presentation.canReassure ? ('calm' as const) : ('concern' as const),
  };
}

/** Navigation mirrors the existing Shortfall borrow card; opening it never moves money. */
export function fundedPotForShortfall(
  pots: readonly Pot[],
  plan: Pick<FinancialPlanResult, 'safeToSpendMinor'>,
): Pot | null {
  const gap = -plan.safeToSpendMinor / 100;
  if (!Number.isFinite(gap) || gap <= 0) return null;
  return (
    pots
      .filter((pot) => Number.isFinite(pot.saved) && pot.saved >= gap)
      .slice()
      .sort((left, right) => right.saved - left.saved)[0] ?? null
  );
}
