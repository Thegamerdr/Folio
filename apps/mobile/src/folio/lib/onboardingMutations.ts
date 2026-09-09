import {
  getState,
  hasConfiguredMoneyPicture,
  isRealUser,
  resetToEmpty,
  setBufferAmount,
  setCurrentBalance,
  setEssentialsWeeklyAmount,
  setIncomeSources,
  setModeExtra,
  setMoneyMode,
  setOnboarding,
  setPots,
  setSubs,
  type AppState,
  type IncomeSource,
  type Pot,
} from '../store';
import { monthlyEquivalent } from './driftSignals';
import { daysUntilDayOfMonth } from './renewalMath';
import type { MoneyMode } from './modes/types';

const WEEK_BASED_CADENCES = new Set<IncomeSource['cadence']>([
  'weekly',
  'fortnightly',
  'four-weekly',
]);

function nextMonthlyCommitmentISO(dayOfMonth: number): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const requestedDay = Math.min(31, Math.max(1, Math.round(dayOfMonth)));
  const daysInMonth = (targetYear: number, targetMonth: number) =>
    new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  let targetYear = year;
  let targetMonth = month;
  let targetDay = Math.min(requestedDay, daysInMonth(targetYear, targetMonth));
  const candidate = Date.UTC(targetYear, targetMonth, targetDay);
  if (candidate < Date.UTC(year, month, now.getUTCDate())) {
    targetMonth += 1;
    if (targetMonth === 12) {
      targetMonth = 0;
      targetYear += 1;
    }
    targetDay = Math.min(requestedDay, daysInMonth(targetYear, targetMonth));
  }
  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth + 1).padStart(2, '0')}-${String(
    targetDay,
  ).padStart(2, '0')}`;
}

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
  /** Explicit protected cash floor, including an intentional £0 choice. */
  desiredBuffer?: number;
  /** Optional first-run weekly essentials allowance. Stored in the existing Reset-mode context
   * slot so every projection can use one durable value without another parallel finance store. */
  weeklyEssentials?: number;
  /** Optional first-run bundled recurring commitment (for example rent + bills in one payment). */
  bundledCommitment?: Readonly<{ name: string; amount: number; dueDom: number }>;
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
    ...(input.bundledCommitment === undefined
      ? {}
      : { bundledCommitmentName: input.bundledCommitment.name.trim() || 'Rent + bills' }),
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

  // A returning-user entry updates only the fields this editor owns. Balance, mode and pots remain
  // untouched, while the explicit essentials/buffer/bundled-bill controls are durable corrections
  // to the same financial context used by Today and Plan.
  if (!firstRun) {
    if (input.desiredBuffer !== undefined) setBufferAmount(input.desiredBuffer);
    if (input.weeklyEssentials !== undefined) setEssentialsWeeklyAmount(input.weeklyEssentials);
    if (input.balance !== before.currentBalance.amount) {
      setCurrentBalance({ amount: input.balance, source: 'user-entered', confidence: 'rough' });
    }
    if (input.bundledCommitment !== undefined) {
      const bundled = input.bundledCommitment;
      const bundledName = bundled.name.trim() || 'Rent + bills';
      const priorBundledName = before.onboarding.bundledCommitmentName;
      setSubs((previous) => [
        // The default label is the legacy owned key; the chosen label is the current owned key.
        // Filtering both makes repeated saves idempotent even when the user keeps a custom name.
        ...previous.filter(
          (subscription) =>
            subscription.name !== 'Rent + bills' &&
            subscription.name !== bundledName &&
            subscription.name !== priorBundledName,
        ),
        ...(bundled.amount > 0
          ? [{
              name: bundledName,
              cost: Math.max(0, Math.round(bundled.amount * 100) / 100),
              nextRenewalDaysAway: daysUntilDayOfMonth(
                Math.min(31, Math.max(1, Math.round(bundled.dueDom))),
                new Date().toISOString().slice(0, 10),
              ),
              nextRenewalISO: nextMonthlyCommitmentISO(bundled.dueDom),
              lastUsedDaysAgo: 0,
              usesPerMonth: 0,
            }]
          : []),
      ]);
    }
    return;
  }

  setMoneyMode(input.intentMode);
  setModeExtra(input.intentMode, input.modeExtra);
  if (input.desiredBuffer !== undefined) setBufferAmount(input.desiredBuffer);
  else if (input.intentMode === 'survival' || input.intentMode === 'stability') setBufferAmount(input.modeExtra);
  // Reset mode's existing mode-extra is the canonical weekly essentials allowance. Capture it even
  // when the user chose another lens so the safe-to-spend projection has a real denominator.
  setEssentialsWeeklyAmount(input.weeklyEssentials ?? 0);
  const bundled = input.bundledCommitment;
  const bundledName = bundled?.name.trim() || 'Rent + bills';
  const priorBundledName = before.onboarding.bundledCommitmentName;
  setSubs((previous) => {
    const withoutOnboardingCommitment = previous.filter(
      (subscription) =>
        subscription.name !== 'Rent + bills' &&
        subscription.name !== bundledName &&
        subscription.name !== priorBundledName,
    );
    if (bundled === undefined || !(bundled.amount > 0)) return withoutOnboardingCommitment;
    return [
      ...withoutOnboardingCommitment,
      {
        name: bundledName,
        cost: Math.max(0, Math.round(bundled.amount * 100) / 100),
        nextRenewalDaysAway: daysUntilDayOfMonth(
          Math.min(31, Math.max(1, Math.round(bundled.dueDom))),
          new Date().toISOString().slice(0, 10),
        ),
        nextRenewalISO: nextMonthlyCommitmentISO(bundled.dueDom),
        lastUsedDaysAgo: 0,
        usesPerMonth: 0,
      },
    ];
  });
  setCurrentBalance({ amount: input.balance, source: 'user-entered', confidence: 'rough' });
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
