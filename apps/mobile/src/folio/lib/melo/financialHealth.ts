import type { FinancialPlanResult } from '@folio/finance-engine';
import type { AppState } from '../../store';
import {
  formatFinancialDate,
  formatMoney,
  selectFinancialPresentation,
} from '../financialPresentation';

export type FinancialPlumage = 'dim' | 'warm' | 'bright' | 'radiant';

/** Companion appearance follows the same confirmed, signed spending result as Today.
 * Pot progress or a recent ritual never overrides an incomplete or pressured money picture. */
export function selectMeloFinancialHealth(state: AppState, plan: FinancialPlanResult) {
  const presentation = selectFinancialPresentation(state, plan);
  if (!presentation.canReassure) {
    return {
      presentation,
      vitality: 0,
      plumage: 'dim' as FinancialPlumage,
      dotCount: 0,
      line: presentation.label,
      caption: `${plan.safeToSpendMinor < 0 ? `Shortfall: ${formatMoney(-plan.safeToSpendMinor / 100)}. ` : ''}${presentation.message}`,
      scored: false,
    };
  }
  const income = Math.max(1, state.onboarding.monthlyIncome);
  const safe = Math.max(0, Math.min(1, plan.safeToSpendMinor / 100 / income / 0.4));
  const potShare = state.pots.length
    ? state.pots.filter((pot) => pot.goal > 0 && pot.saved / pot.goal >= 0.6).length /
      state.pots.length
    : 0.5;
  const fresh = state.cycles.some((cycle) => !cycle.reconstructed && Boolean(cycle.closedAt))
    ? 0.08
    : 0;
  const vitality = Math.max(0, Math.min(1, safe * 0.65 + potShare * 0.3 + fresh));
  const plumage: FinancialPlumage =
    vitality < 0.28 ? 'dim' : vitality < 0.55 ? 'warm' : vitality < 0.82 ? 'bright' : 'radiant';
  const dotCount = plumage === 'dim' ? 1 : plumage === 'warm' ? 2 : plumage === 'bright' ? 3 : 4;
  const lines: Record<FinancialPlumage, string> = {
    dim: 'Feathers drawn in.',
    warm: 'Warm at the edges.',
    bright: 'Bright and steady.',
    radiant: 'Full plumage, quietly lit.',
  };
  return {
    presentation,
    vitality,
    plumage,
    dotCount,
    line: lines[plumage],
    caption: `${formatMoney(plan.safeToSpendMinor / 100)} after recorded bills, essentials, debt minimums and buffer until ${formatFinancialDate(plan.nextIncomeDate)}.`,
    scored: true,
  };
}
