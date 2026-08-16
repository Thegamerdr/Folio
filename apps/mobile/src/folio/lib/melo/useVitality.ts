import { useAppStore } from '../../store';
import { deriveMeloState, deriveMeloVitality } from './state';

/** Live store-derived vitality used by every native Melo unless a stage explicitly overrides it. */
export function useMeloVitality(): number {
  const state = useAppStore((snapshot) => snapshot);
  const monthlyIncome = Math.max(1, state.onboarding.monthlyIncome);
  const subsDueSoon = state.subs
    .filter((sub) => !state.subPaused[sub.name])
    .filter((sub) => sub.nextRenewalDaysAway >= 0 && sub.nextRenewalDaysAway <= 28)
    .reduce((sum, sub) => sum + sub.cost, 0);
  const potGap = state.pots.reduce((sum, pot) => sum + Math.max(0, pot.goal - pot.saved) * 0.25, 0);
  const lastClosedAt = state.cycles[0]?.closedAt;
  const lastClosedMs = lastClosedAt ? Date.parse(lastClosedAt) : Number.NaN;
  const ritualCompletedRecently =
    Number.isFinite(lastClosedMs) && Date.now() - lastClosedMs < 3 * 86_400_000;

  return deriveMeloVitality({
    tightestSpare: state.currentBalance.amount - subsDueSoon - potGap,
    monthlyIncome,
    subs: state.subs,
    subPaused: state.subPaused,
    pots: state.pots,
    currentBalance: state.currentBalance,
    onboarding: state.onboarding,
    ritualCompletedRecently,
  });
}

/** Dim a bright vitality signal when the current money weather is dark. */
export function useWeatherIntensityBias(): number {
  const state = useAppStore((snapshot) => snapshot);
  const weather = deriveMeloState({
    tightestSpare: state.currentBalance.amount,
    monthlyIncome: Math.max(1, state.onboarding.monthlyIncome),
    subs: state.subs,
    subPaused: state.subPaused,
    pots: state.pots,
    currentBalance: state.currentBalance,
    onboarding: state.onboarding,
  }).weather;
  switch (weather) {
    case 'storm':
    case 'alarm':
      return 0.55;
    case 'rainy':
    case 'fog':
      return 0.8;
    default:
      return 1;
  }
}
