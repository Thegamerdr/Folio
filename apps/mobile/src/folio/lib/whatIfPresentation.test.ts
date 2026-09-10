import { describe, expect, it } from 'vitest';
import { getState, type AppState, type WhatIfHold } from '../store';
import { buildFinancialPlanFromState } from './financialPlan';
import { buildWhatIfPresentation, selectWhatIfCurrentPresentation } from './whatIfPresentation';
import { selectFinancialPresentation } from './financialPresentation';

function fixture(): AppState {
  const base = getState();
  return {
    ...base,
    accounts: [],
    currentBalance: { ...base.currentBalance, amount: 1800 },
    onboarding: { ...base.onboarding, payday: 9, monthlyIncome: 1800 },
    incomeSources: [],
    subs: [],
    subPaused: {},
    subOverrides: {},
    calendarEvents: [],
    transactions: [],
    debts: [],
    pots: [],
    whatIfHolds: [],
    spendHold: null,
    bufferAmount: 200,
    modeExtras: { ...base.modeExtras, reset: 70 },
  };
}
const NOW = new Date(2026, 8, 9);
describe('What If canonical preview', () => {
  it('keeps positive current room distinct from a negative preview and an overdue status', () => {
    const state = fixture();
    state.onboarding.financialSetupConfirmed = true;
    state.calendarEvents = [
      { id: 'unpaid', title: 'Rent', date: '2026-09-08', amount: 100, kind: 'out' },
    ];
    state.reviewQueue = [
      {
        id: 'pending',
        source: 'paste',
        merchant: 'Groceries',
        amount: -12.34,
        addedAt: NOW.toISOString(),
      },
    ];
    const starting = buildFinancialPlanFromState(state, { now: NOW });
    state.currentBalance.amount -= starting.safeToSpendMinor / 100 - 5;
    const current = buildFinancialPlanFromState(state, { now: NOW });
    const scenario = buildWhatIfPresentation(state, NOW, 40, 'once');
    expect(current.safeToSpendMinor).toBe(500);
    expect(scenario.preview.safeToSpendMinor).toBe(-3500);
    expect(selectWhatIfCurrentPresentation(state, current)).toEqual({
      caption: 'Remaining after recorded costs and buffer. Until 9 Oct 2026.',
      qualification: 'Overdue commitments need attention',
    });
    expect(buildWhatIfPresentation(state, NOW, 40, 'once', 1).preview.nextIncomeDate).toBe(
      '2026-10-10',
    );
    expect(selectWhatIfCurrentPresentation(state, current).caption).toContain('9 Oct 2026');
  });
  it('qualifies positive current room when figures still need review', () => {
    const state = fixture();
    state.onboarding.financialSetupConfirmed = true;
    state.reviewQueue = [
      {
        id: 'pending',
        source: 'paste',
        merchant: 'Groceries',
        amount: -12.34,
        addedAt: NOW.toISOString(),
      },
    ];
    const current = buildFinancialPlanFromState(state, { now: NOW });
    expect(current.safeToSpendMinor).toBeGreaterThan(0);
    expect(selectWhatIfCurrentPresentation(state, current).qualification).toBe(
      'Some figures need your review',
    );
  });
  it.each([0, -5])(
    'describes actual current %s room independently of a proposed spend',
    (amount) => {
      const state = fixture();
      state.onboarding.financialSetupConfirmed = true;
      const starting = buildFinancialPlanFromState(state, { now: NOW });
      state.currentBalance.amount -= starting.safeToSpendMinor / 100 - amount;
      const current = buildFinancialPlanFromState(state, { now: NOW });
      expect(current.safeToSpendMinor).toBe(amount * 100);
      expect(selectWhatIfCurrentPresentation(state, current).caption).toBe(
        amount === 0
          ? 'No room remains after recorded costs and buffer. Until 9 Oct 2026.'
          : 'Recorded costs and buffer leave a gap. Until 9 Oct 2026.',
      );
    },
  );
  it.each(['once', 'weekly', 'monthly'] as const)(
    'matches a saved %s hold without mutating cash or the original state',
    (recurrence) => {
      const state = fixture();
      const before = JSON.stringify(state);
      const result = buildWhatIfPresentation(state, NOW, 40, recurrence);
      const hold: WhatIfHold = { id: 'saved', amount: 40, recurrence, addedAt: NOW.toISOString() };
      const saved = buildFinancialPlanFromState({ ...state, whatIfHolds: [hold] }, { now: NOW });
      expect(result.preview.safeToSpendMinor).toBe(saved.safeToSpendMinor);
      expect(result.preview.lowestProjectedMinor).toBe(saved.lowestProjectedMinor);
      expect(JSON.stringify(state)).toBe(before);
      expect(saved.currentBalanceMinor).toBe(180000);
    },
  );
  it('keeps payday shift hypothetical and states the separate save consequence', () => {
    const state = fixture();
    const result = buildWhatIfPresentation(state, NOW, 40, 'weekly', 1);
    expect(result.preview.nextIncomeDate).toBe('2026-10-10');
    expect(result.savedHold.nextIncomeDate).toBe('2026-10-09');
    expect(result.preview.safeToSpendMinor).toBeLessThanOrEqual(result.savedHold.safeToSpendMinor);
  });
  it('preserves negative scenarios as valid previews', () => {
    const state = fixture();
    state.currentBalance = { ...state.currentBalance, amount: 20 };
    expect(
      buildWhatIfPresentation(state, NOW, 500, 'monthly').preview.safeToSpendMinor,
    ).toBeLessThan(0);
  });
  it('does not turn a positive preview into reassurance while overdue costs remain', () => {
    const state = fixture();
    state.onboarding = { ...state.onboarding, financialSetupConfirmed: true };
    state.calendarEvents = [
      { id: 'unpaid', title: 'Rent', date: '2026-09-08', amount: 100, kind: 'out' },
    ];
    const result = buildWhatIfPresentation(state, NOW, 40, 'once', 1);
    for (const plan of [result.preview, result.savedHold]) {
      expect(plan.safeToSpendMinor).toBeGreaterThan(0);
      expect(selectFinancialPresentation(state, plan)).toMatchObject({
        complete: true,
        canReassure: false,
        overdueCount: 1,
      });
    }
  });
});

it('uses the saved-hold retention limit and amount rounding', () => {
  const state = fixture();
  state.whatIfHolds = Array.from({ length: 24 }, (_, index) => ({
    id: `old-${index}`,
    amount: index + 1,
    recurrence: 'once' as const,
    addedAt: NOW.toISOString(),
  }));
  const expected = buildFinancialPlanFromState(
    {
      ...state,
      whatIfHolds: [
        { id: 'new', amount: 41, recurrence: 'once' as const, addedAt: NOW.toISOString() },
        ...state.whatIfHolds,
      ].slice(0, 24),
    },
    { now: NOW },
  );
  expect(buildWhatIfPresentation(state, NOW, 40.6, 'once').savedHold.safeToSpendMinor).toBe(
    expected.safeToSpendMinor,
  );
});
