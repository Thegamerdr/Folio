import { beforeEach, describe, expect, it } from 'vitest';
import { getState, resetToEmpty, setPartial, borrowFromPot, type Pot } from '../store';
import { buildFinancialPlanFromState } from './financialPlan';
import { fundedPotForShortfall, shortfallCompletionPresentation } from './shortfallNavigation';
import { selectFinancialPresentation } from './financialPresentation';

const now = new Date('2026-09-10T12:00:00Z');
const pot = (saved: number): Pot => ({
  id: 'buffer',
  name: 'Buffer',
  saved,
  goal: 1000,
  perWeek: 0,
  accent: false,
  cadence: { kind: 'after-payday' },
});
beforeEach(() => resetToEmpty());

describe('funded-pot Shortfall navigation', () => {
  it('keeps overdue commitments visible after pot borrowing closes the numeric gap', () => {
    const base = getState();
    setPartial({
      accounts: [],
      currentBalance: { ...base.currentBalance, amount: 1000, provided: true },
      onboarding: {
        ...base.onboarding,
        monthlyIncome: 1800,
        payday: 20,
        financialSetupConfirmed: true,
      },
      calendarEvents: [
        { id: 'overdue-rent', date: '2026-09-09', kind: 'out', title: 'Rent', amount: -800 },
      ],
      modeExtras: { ...base.modeExtras, reset: 0 },
      bufferAmount: 100,
      pots: [pot(150)],
    });
    const before = buildFinancialPlanFromState(getState(), { now });
    expect(before.safeToSpendMinor).toBe(-5000);
    borrowFromPot('buffer', 50, 'shortfall-borrow');
    const after = buildFinancialPlanFromState(getState(), { now });
    expect(after.safeToSpendMinor).toBe(0);
    expect(after.currentBalanceMinor).toBe(100000);
    expect(getState().pots[0]?.saved).toBe(100);
    const presentation = selectFinancialPresentation(getState(), after);
    expect(presentation.overdueCount).toBe(1);
    expect(shortfallCompletionPresentation(presentation)).toMatchObject({
      canCelebrate: false,
      headline: 'Overdue commitments need attention',
      mood: 'concern',
      message:
        'The forecast gap is closed. 1 overdue commitment is still reserved. Check what has actually been paid.',
    });
  });
  it('opens the existing pot option for a canonical gap caused by earmarking saved money', () => {
    const base = getState();
    const pots = [pot(150)];
    const state = {
      ...base,
      accounts: [],
      currentBalance: { ...base.currentBalance, amount: 1000, provided: true },
      onboarding: {
        ...base.onboarding,
        monthlyIncome: 1800,
        payday: 20,
        financialSetupConfirmed: true,
      },
      calendarEvents: [
        { id: 'rent', date: '2026-09-15', kind: 'out' as const, title: 'Rent', amount: -800 },
      ],
      modeExtras: { ...base.modeExtras, reset: 0 },
      bufferAmount: 100,
      pots,
    };
    const plan = buildFinancialPlanFromState(state, { now });
    expect(plan.safeToSpendMinor).toBe(-5000);
    expect(fundedPotForShortfall(pots, plan)?.id).toBe('buffer');
    expect(pots[0]?.saved).toBe(150);
    expect(state.currentBalance.amount).toBe(1000);
  });
  it('does not offer a pot that cannot cover the existing gap, or invent room in a no-gap state', () => {
    expect(fundedPotForShortfall([pot(20)], { safeToSpendMinor: -13500 })).toBeNull();
    expect(fundedPotForShortfall([pot(200)], { safeToSpendMinor: 0 })).toBeNull();
    expect(fundedPotForShortfall([pot(200)], { safeToSpendMinor: 5000 })).toBeNull();
    expect(fundedPotForShortfall([], { safeToSpendMinor: -5000 })).toBeNull();
  });
  it('retains the existing whole-gap boundary down to the penny and selects the highest saved pot', () => {
    expect(fundedPotForShortfall([pot(10.45)], { safeToSpendMinor: -1046 })).toBeNull();
    expect(fundedPotForShortfall([pot(10.46)], { safeToSpendMinor: -1046 })?.saved).toBe(10.46);
    expect(
      fundedPotForShortfall([pot(20), { ...pot(30), id: 'second' }], { safeToSpendMinor: -1000 })
        ?.id,
    ).toBe('second');
  });
});
