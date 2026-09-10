import { beforeEach, describe, expect, it } from 'vitest';
import {
  getState,
  resetToEmpty,
  setCurrentBalance,
  setPartial,
  getPersistBlob,
  hydrateFromBlob,
  type AppState,
} from '../store';
import { buildFinancialPlanFromState } from './financialPlan';
import {
  formatFinancialDate,
  formatMoney,
  financialAmountLabel,
  selectFinancialPresentation,
} from './financialPresentation';

const now = new Date('2026-09-09T12:00:00Z');
function present(state = getState()) {
  return selectFinancialPresentation(state, buildFinancialPlanFromState(state, { now }));
}
function fullState(): AppState {
  const state = getState();
  return {
    ...state,
    accounts: [],
    currentBalance: { ...state.currentBalance, amount: 1800, provided: true },
    onboarding: {
      ...state.onboarding,
      done: true,
      payday: 9,
      monthlyIncome: 1800,
      financialSetupConfirmed: true,
    },
    incomeSources: [
      {
        id: 'pay',
        label: 'Pay',
        amount: 1800,
        cadence: 'monthly',
        dayOfMonth: 9,
        source: 'manual',
      },
    ],
    subs: [
      {
        name: 'Rent + bills',
        cost: 950,
        nextRenewalISO: '2026-09-12',
        obligationAnchorISO: '2026-09-12',
        nextRenewalDaysAway: 3,
        lastUsedDaysAgo: 0,
        usesPerMonth: 0,
      },
    ],
    bufferAmount: 200,
    modeExtras: { reset: 70 },
  };
}
beforeEach(() => resetToEmpty());
describe('financial presentation prerequisites and coherent results', () => {
  it('labels a negative result as a gap even when the separate status concerns overdue bills', () => {
    const state = fullState();
    state.currentBalance.amount = 100;
    state.subs[0] = {
      ...state.subs[0]!,
      nextRenewalISO: '2026-09-08',
      obligationAnchorISO: '2026-09-08',
    };
    const plan = buildFinancialPlanFromState(state, { now });
    const presentation = selectFinancialPresentation(state, plan);
    expect(presentation.label).toBe('Overdue commitments need attention');
    expect(plan.safeToSpendMinor).toBeLessThan(0);
    expect(financialAmountLabel(plan, presentation)).toBe('Gap after bills, essentials and buffer');
  });
  it('keeps a positive unreviewed amount conditional while retaining the confirmed safe label', () => {
    const state = fullState();
    const plan = buildFinancialPlanFromState(state, { now });
    expect(financialAmountLabel(plan, selectFinancialPresentation(state, plan))).toBe(
      'Safe to spend until payday',
    );
    state.reviewQueue = [
      {
        id: 'pending',
        source: 'paste',
        merchant: 'Groceries',
        amount: -12.34,
        addedAt: now.toISOString(),
      },
    ];
    const pending = selectFinancialPresentation(state, plan);
    expect(pending.label).toBe('Some figures need your review');
    expect(financialAmountLabel(plan, pending)).toBe('After recorded costs and buffer');
  });
  it('keeps a zero remaining amount distinct from its overdue warning', () => {
    const state = fullState();
    state.subs[0] = {
      ...state.subs[0]!,
      nextRenewalISO: '2026-09-08',
      obligationAnchorISO: '2026-09-08',
    };
    const initial = buildFinancialPlanFromState(state, { now });
    state.currentBalance.amount -= initial.safeToSpendMinor / 100;
    const plan = buildFinancialPlanFromState(state, { now });
    const presentation = selectFinancialPresentation(state, plan);
    expect(plan.safeToSpendMinor).toBe(0);
    expect(presentation).toMatchObject({
      label: 'Overdue commitments need attention',
      overdueCount: 1,
      canReassure: false,
    });
    expect(financialAmountLabel(plan, presentation)).toBe('After recorded costs and buffer');
  });
  it('never treats reset or a neutral zero account as a confirmed money picture', () => {
    expect(present()).toMatchObject({ complete: false, balanceKnown: false, canReassure: false });
  });
  it('preserves a deliberately entered zero through persistence without reassuring from missing costs', () => {
    setCurrentBalance({ amount: 0, source: 'user-entered', confidence: 'rough' });
    hydrateFromBlob(getPersistBlob());
    expect(present()).toMatchObject({ balanceKnown: true, complete: false, canReassure: false });
    resetToEmpty();
    expect(present().balanceKnown).toBe(false);
  });
  it('labels cash-only as partial and keeps missing payday and costs explicit', () => {
    setCurrentBalance({ amount: 1800, source: 'user-entered', confidence: 'rough' });
    expect(present().needs).toEqual(['payday and income', 'regular costs, essentials and buffer']);
  });
  it('does not infer current cash from imported transaction history without a closing balance', () => {
    const state = fullState();
    state.currentBalance = { ...getState().currentBalance };
    state.transactions = [
      {
        id: 'history',
        when: '2026-09-01T12:00:00Z',
        merchant: 'Recorded shop',
        amount: -25,
        category: 'food',
        source: 'manual',
      },
    ];
    expect(present(state)).toMatchObject({
      balanceKnown: false,
      complete: false,
      canReassure: false,
    });
  });
  it('uses the verified £350 result for the completed monthly, no-car, bundled-cost fixture', () => {
    const state = fullState();
    const plan = buildFinancialPlanFromState(state, { now });
    expect(plan.safeToSpendMinor).toBe(35000);
    expect([plan.protectedBeforeIncomeMinor, plan.livingCostMinor, plan.debtMinimumMinor]).toEqual([
      125000, 30000, 0,
    ]);
    expect(selectFinancialPresentation(state, plan)).toMatchObject({
      complete: true,
      canReassure: true,
    });
  });
  it('withholds reassuring copy when a future commitment is actively paused', () => {
    const state = fullState();
    state.subPaused = { 'Rent + bills': true };
    state.subs[0] = {
      ...state.subs[0]!,
      pausedAt: '2026-09-09',
      pausedUntil: '2026-09-13',
    };
    const plan = buildFinancialPlanFromState(state, { now });
    const presentation = selectFinancialPresentation(state, plan);
    expect(plan.safeToSpendMinor).toBeGreaterThan(35000);
    expect(presentation).toMatchObject({
      pausedForecastCount: 1,
      nudgedForecastCount: 0,
      forecastAssumptionCount: 1,
      canReassure: false,
      label: 'Check your forecast changes',
    });
    expect(financialAmountLabel(plan, presentation)).toBe('After recorded costs and buffer');
  });
  it('withholds reassuring copy when a future commitment is date-nudged', () => {
    const state = fullState();
    state.subOverrides = { 'Rent + bills': 3 };
    const plan = buildFinancialPlanFromState(state, { now });
    const presentation = selectFinancialPresentation(state, plan);
    expect(presentation).toMatchObject({
      pausedForecastCount: 0,
      nudgedForecastCount: 1,
      forecastAssumptionCount: 1,
      canReassure: false,
      label: 'Check your forecast changes',
    });
    expect(financialAmountLabel(plan, presentation)).toBe('After recorded costs and buffer');
  });
  it('does not keep an expired pause from a stale persisted flag', () => {
    const state = fullState();
    state.subPaused = { 'Rent + bills': true };
    state.subs[0] = {
      ...state.subs[0]!,
      pausedAt: '2026-09-01',
      pausedUntil: '2026-09-09',
    };
    const plan = buildFinancialPlanFromState(state, { now });
    expect(selectFinancialPresentation(state, plan)).toMatchObject({
      pausedForecastCount: 0,
      forecastAssumptionCount: 0,
      canReassure: true,
      label: 'Safe to spend until payday',
    });
  });
  it('keeps an overdue reserve while withholding reassurance', () => {
    const state = fullState();
    state.subs = [
      { ...state.subs[0]!, obligationAnchorISO: '2026-09-06', nextRenewalISO: '2026-09-06' },
    ];
    const p = present(state);
    expect(p.complete).toBe(true);
    expect(p.overdueCount).toBe(1);
    expect(p.canReassure).toBe(false);
  });
  it('distinguishes deliberately confirmed zero income from unknown income without inventing a payday', () => {
    const state = fullState();
    state.incomeSources = [];
    state.onboarding.monthlyIncome = 0;
    const p = present(state);
    expect(p.incomeKnown).toBe(true);
    expect(p.complete).toBe(true);
    expect(p.canReassure).toBe(false);
    expect(p.label).toBe('No next income date');
  });
  it('does not mistake an uncalculated mount-frame plan for missing income', () => {
    const state = fullState();
    const waiting = selectFinancialPresentation(state, null);
    expect(waiting).toMatchObject({
      complete: true,
      canReassure: false,
      label: 'Checking your plan',
      message: 'Checking your recorded numbers and dates.',
    });
    const ready = buildFinancialPlanFromState(state, { now });
    expect(ready.nextIncomeDate).toBe('2026-10-09');
    expect(selectFinancialPresentation(state, ready)).toMatchObject({
      canReassure: true,
      label: 'Safe to spend until payday',
    });
    state.incomeSources = [];
    state.onboarding.monthlyIncome = 0;
    expect(present(state)).toMatchObject({ canReassure: false, label: 'No next income date' });
  });
  it('does not reuse cached figures after a changed input, including mutable caller fixtures', () => {
    const state = fullState();
    const first = buildFinancialPlanFromState(state, { now });
    expect(buildFinancialPlanFromState(state, { now })).toBe(first);
    state.currentBalance.amount = 1700;
    expect(buildFinancialPlanFromState(state, { now }).safeToSpendMinor).toBe(25000);
    expect(first.safeToSpendMinor).toBe(35000);
  });
  it('resets reviewed setup and explicit balance provenance with financial data', () => {
    setPartial(fullState());
    expect(present().complete).toBe(true);
    resetToEmpty();
    expect(present().complete).toBe(false);
  });
  it('keeps money signs/grouping and full dates consistent without changing stored values', () => {
    expect(formatMoney(-1325.25, true)).toBe('−£1,325.25');
    expect(formatMoney(11400)).toBe('£11,400');
    expect(formatMoney(350.25)).toBe('£350.25');
    expect(formatFinancialDate('2026-10-08')).toBe('8 Oct 2026');
    expect(formatFinancialDate(null)).toBe('Not set');
  });
});
