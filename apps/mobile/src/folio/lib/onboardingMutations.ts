import {
  getState,
  hasConfiguredMoneyPicture,
  isRealUser,
  resetToEmpty,
  setBufferAmount,
  setCurrentBalance,
  setIncomeSources,
  setModeExtra,
  setMoneyMode,
  setOnboarding,
  setPots,
  type AppState,
  type IncomeSource,
  type Pot,
} from '../store';
import { monthlyEquivalent } from './driftSignals';
import type { MoneyMode } from './modes/types';

const WEEK_BASED_CADENCES = new Set<IncomeSource['cadence']>([
  'weekly',
  'fortnightly',
  'four-weekly',
]);

export type OnboardingCommitInput = Readonly<{
  name: string;
  payday: number;
  monthlyIncome: number;
  balance: number;
  pickedPots: ReadonlyArray<Omit<Pot, 'saved'>>;
  cadence: IncomeSource['cadence'];
  anchorISO: string;
  legacyPayday: number;
  intentMode: MoneyMode;
  modeExtra: number;
}>;

/** Shared first-run/returning classifier for the sheet and its mutations. */
export function isOnboardingFirstRun(state: AppState): boolean {
  const legacySample = state.currentBalance.source === 'sample' && !isRealUser(state);
  return legacySample || (!state.onboarding.done && !hasConfiguredMoneyPicture(state));
}

/**
 * Commit the onboarding sheet's values without treating a returning user's editor as a wipe.
 *
 * The first-run sample is the only state this path is allowed to clean. A returning or partially
 * configured workspace keeps every existing record, source and pot; the editor updates only the
 * onboarding context and its owned source. This is intentionally the production mutation seam so
 * tests cannot accidentally reproduce a copy of the handler logic.
 */
export function commitOnboarding(input: OnboardingCommitInput): void {
  const before = getState();
  const firstRun = isOnboardingFirstRun(before);
  const legacySample = before.currentBalance.source === 'sample' && !isRealUser(before);

  if (legacySample) resetToEmpty();

  setOnboarding({
    name: input.name,
    payday: input.legacyPayday,
    monthlyIncome: monthlyEquivalent(input.monthlyIncome, input.cadence),
    done: true,
  });

  const incomeSource: IncomeSource = {
    id: 'income-onboarding-pay',
    label: 'Pay',
    cadence: input.cadence,
    amount: input.monthlyIncome,
    source: 'onboarding',
    ...(input.cadence === 'monthly' ? { dayOfMonth: input.payday } : {}),
    ...(WEEK_BASED_CADENCES.has(input.cadence) ? { anchorISO: input.anchorISO } : {}),
  };
  // The onboarding source is this sheet's owned row. Every other source belongs to the user and
  // must remain intact (e.g. an inferred salary or a second manual income stream).
  setIncomeSources((previous) => {
    const index = previous.findIndex((source) => source.id === incomeSource.id);
    if (index < 0) return [...previous, incomeSource];
    return previous.map((source, sourceIndex) => (sourceIndex === index ? incomeSource : source));
  });

  // A returning-user entry is specifically the Payday and income editor. Do not silently rewrite
  // balances, mode answers or pots just because those controls are still present in the shared
  // onboarding flow. The first-run path owns those setup values and starts all selected pots at £0.
  if (!firstRun) return;

  setMoneyMode(input.intentMode);
  setModeExtra(input.intentMode, input.modeExtra);
  if (input.intentMode === 'survival' || input.intentMode === 'stability') {
    setBufferAmount(input.modeExtra);
  }
  if (input.balance > 0) {
    setCurrentBalance({ amount: input.balance, source: 'user-entered', confidence: 'rough' });
  }
  const nextPots = input.pickedPots.map((pot) => ({ ...pot, saved: 0 }));
  if (nextPots.length > 0) setPots(nextPots);
}

/** Skip is a cancellation for a configured workspace. On a first-run legacy sample, clean only the
 * sample fixture while leaving onboarding incomplete; a genuinely empty first run is already safe.
 */
export function skipOnboardingForNow(): void {
  const before = getState();
  if (before.onboarding.done || !isOnboardingFirstRun(before)) return;
  if (before.currentBalance.source === 'sample') resetToEmpty({ onboardingDone: false });
}
