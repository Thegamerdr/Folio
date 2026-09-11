import type { FinancialPlanResult } from '@folio/finance-engine';
import type { AppState, Pot } from '../store';
import { buildFinancialPlanFromState } from './financialPlan';
import {
  financialAmountLabel,
  formatFinancialDate,
  formatMoney,
  selectFinancialPresentation,
} from './financialPresentation';

/** Match the calendar's default: an undated pot is planned after payday. */
export function potTopUpTiming(pot: Pick<Pot, 'cadence'>): string {
  switch (pot.cadence?.kind ?? 'after-payday') {
    case 'after-payday':
      return 'after payday';
    case 'monthly':
      return 'each month';
    case 'weekly':
      return 'each week';
    case 'custom':
      return pot.cadence?.kind === 'custom'
        ? `on ${formatFinancialDate(pot.cadence.nextDate)}`
        : 'on your chosen date';
  }
}

/** Goal progress is recorded set-aside money. A missing pace is not a completed goal. */
export function selectPotProgress(pot: Pick<Pot, 'goal' | 'saved' | 'perWeek' | 'cadence'>) {
  const hasGoal = pot.goal > 0;
  const goalMet = hasGoal && pot.saved >= pot.goal;
  const remaining = hasGoal ? Math.max(0, pot.goal - pot.saved) : null;
  const hasPace = pot.perWeek > 0 && Number.isFinite(pot.perWeek);
  const cadence = pot.cadence?.kind ?? 'after-payday';
  const paceLabel = !hasPace
    ? 'No top-up pace set'
    : `${formatMoney(pot.perWeek)} planned ${potTopUpTiming(pot)}`;
  const weeks =
    hasPace && cadence === 'weekly' && remaining !== null
      ? Math.ceil(remaining / pot.perWeek)
      : null;
  const etaLabel = goalMet
    ? 'Goal met'
    : remaining === null
      ? 'No goal set'
      : weeks !== null
        ? `About ${weeks} ${weeks === 1 ? 'week' : 'weeks'} at this pace`
        : `${formatMoney(remaining)} left to set aside`;
  return { goalMet, remaining, paceLabel, etaLabel };
}

/** Distinguish the protected spending amount from raw cash outside the pots. */
export function selectPotsPresentation(state: AppState, plan: FinancialPlanResult | null) {
  const presentation = selectFinancialPresentation(state, plan);
  const safe = plan && presentation.complete ? plan.safeToSpendMinor / 100 : null;
  const protectedPotsMinor =
    plan?.events.find((event) => event.id === 'pots:protected')?.protectedOutflowMinor ?? 0;
  return {
    presentation,
    safe,
    label:
      plan && presentation.complete ? financialAmountLabel(plan, presentation) : presentation.label,
    message: presentation.message,
    cashOutsidePots:
      plan && presentation.balanceKnown
        ? (plan.currentBalanceMinor - protectedPotsMinor) / 100
        : null,
  };
}

/** A read-only preview of the existing reallocation; finance-engine owns both outcomes. */
export function previewPotReallocation(
  state: AppState,
  fromId: string,
  toId: string,
  amount: number,
  now: Date,
) {
  const before = buildFinancialPlanFromState(state, { now });
  const candidate: AppState = {
    ...state,
    pots: state.pots.map((pot) =>
      pot.id === fromId
        ? { ...pot, saved: pot.saved - amount }
        : pot.id === toId
          ? { ...pot, saved: pot.saved + amount }
          : pot,
    ),
  };
  const after = buildFinancialPlanFromState(candidate, { now });
  const model = selectPotsPresentation(candidate, after);
  return {
    before,
    after,
    model,
    delta: (after.safeToSpendMinor - before.safeToSpendMinor) / 100,
  };
}
