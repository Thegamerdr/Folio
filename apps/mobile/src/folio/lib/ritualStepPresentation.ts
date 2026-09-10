import type { AppState, Sub } from '../store';
import { subscriptionCadence } from '../screens/commitmentHelpers';
import { MODE_LABEL, type MoneyMode } from './modes/types';
import { formatFinancialDate, formatMoney } from './financialPresentation';

/** Every mode visits the same recorded-pot and forecast controls. Their labels name those actions. */
export function ritualStepFrames(
  mode: MoneyMode,
  recordedSetAside: number,
  hasForecastPauses = false,
) {
  return {
    review: { eyebrow: `Review · ${MODE_LABEL[mode]}`, cta: 'Review pot amounts' },
    pots: {
      eyebrow: 'Pot contributions',
      headlineLead: 'Any money ',
      headlineAccent: 'to set aside',
      headlineTrail: '?',
      statLabel: 'Recorded pot contributions',
      statValue: recordedSetAside,
    },
    forecast: {
      eyebrow: 'Forecast',
      headlineLead: 'Check the ',
      headlineAccent: 'forecast',
      headlineTrail: ' before payday.',
      cta: hasForecastPauses ? 'Review forecast pauses' : 'Leave a note for next-you',
    },
  };
}

export function ritualStatText(value: number, kind: 'money' | 'count' = 'money'): string {
  return kind === 'count'
    ? value.toLocaleString('en-GB', { maximumFractionDigits: 0 })
    : formatMoney(value);
}

/** Snapshot optional steps when the review opens. Applying a choice must not delete the active
 * step and shift the following note out from under the current navigation index. */
export function ritualOptionalSteps(
  state: Pick<AppState, 'subs' | 'subPaused' | 'pots' | 'potLedger'>,
) {
  const resumePrompts = state.subs.filter(
    (subscription) =>
      state.subPaused[subscription.name] &&
      subscription.pausedUntil &&
      (subscription.autoResume ?? 'prompt') === 'prompt',
  );
  const activePots = new Set(state.pots.map((pot) => pot.id));
  const owed: Record<string, number> = {};
  for (const entry of state.potLedger) {
    if (!activePots.has(entry.potId)) continue;
    if (entry.kind === 'borrow') owed[entry.potId] = (owed[entry.potId] ?? 0) + entry.amount;
    if (entry.kind === 'repay') owed[entry.potId] = (owed[entry.potId] ?? 0) - entry.amount;
  }
  return { resumePrompts, includeRepay: Object.values(owed).some((amount) => amount > 0) };
}

/** Stored pause reasons may be inferred from usage. Only the forecast setting is known here. */
export function ritualPausePresentation(
  subscription: Pick<Sub, 'cost' | 'renewalPeriodDays' | 'pausedUntil'>,
) {
  return {
    amount: `${formatMoney(subscription.cost)} · ${subscriptionCadence(subscription).toLowerCase()}`,
    date: subscription.pausedUntil
      ? `Paused in your forecast until ${formatFinancialDate(subscription.pausedUntil)}`
      : 'Paused in your forecast',
    detail:
      'Melo has not paused payments with the provider. Check their payment schedule before relying on this date.',
  };
}
