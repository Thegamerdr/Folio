import { beforeEach, describe, expect, it } from 'vitest';
import { getState, resetToEmpty, type AppState } from '../store';
import { buildFinancialPlanFromState } from './financialPlan';
import { buildRecoveryRoutePreview } from './recoveryPreview';
import { selectRecoveryPreviewPresentation } from './recoveryPreviewPresentation';

const now = new Date('2026-09-10T12:00:00Z');
beforeEach(() => resetToEmpty());
function fixture(): AppState {
  const base = getState();
  return {
    ...base,
    accounts: [],
    currentBalance: { ...base.currentBalance, amount: 1000, provided: true },
    onboarding: {
      ...base.onboarding,
      monthlyIncome: 1800,
      payday: 20,
      financialSetupConfirmed: true,
    },
    calendarEvents: [{ id: 'rent', date: '2026-09-09', kind: 'out', title: 'Rent', amount: -800 }],
    subs: [
      {
        name: 'Entertainment streaming',
        cost: 200,
        nextRenewalISO: '2026-09-12',
        nextRenewalDaysAway: 2,
        lastUsedDaysAgo: 0,
        usesPerMonth: 1,
      },
    ],
    bufferAmount: 100,
    modeExtras: { reset: 0 },
  };
}
describe('Recovery preview safety prerequisites', () => {
  it('keeps a canonical positive pause preview conditional while overdue rent remains', () => {
    const state = fixture();
    const before = JSON.stringify(state);
    const plan = buildFinancialPlanFromState(state, { now });
    const route = buildRecoveryRoutePreview(state, now);
    expect(route.shortfall).toBe(100);
    expect(route.subscriptionLift).toBe(200);
    const result = selectRecoveryPreviewPresentation(
      state,
      plan,
      -route.shortfall + route.subscriptionLift,
      true,
    );
    expect(result.closesGap).toBe(true);
    expect(result.canReassure).toBe(false);
    expect(result.mood).toBe('concern');
    expect(result.caption).toContain('1 overdue commitment is still reserved');
    expect(result.meloLine).toContain('Check what has actually been paid');
    expect(JSON.stringify(state)).toBe(before);
    expect(plan.safeToSpendMinor).toBe(-10000);
  });
  it('retains review and incomplete-state warnings even when the selected amount is positive', () => {
    const base = fixture();
    const review: AppState = {
      ...base,
      calendarEvents: [],
      reviewQueue: [
        {
          id: 'pending',
          source: 'paste',
          addedAt: now.toISOString(),
          merchant: 'Unchecked entry',
          amount: -7.89,
          date: '2026-09-10',
        },
      ],
    };
    const plan = buildFinancialPlanFromState(review, { now });
    expect(selectRecoveryPreviewPresentation(review, plan, 100, true)).toMatchObject({
      canReassure: false,
      mood: 'concern',
    });
    expect(selectRecoveryPreviewPresentation(review, plan, 100, true).caption).toContain(
      'Review the pending figures',
    );
    const partial = {
      ...base,
      calendarEvents: [],
      onboarding: { ...base.onboarding, financialSetupConfirmed: false, done: false },
    };
    expect(
      selectRecoveryPreviewPresentation(
        partial,
        buildFinancialPlanFromState(partial, { now }),
        100,
        true,
      ).caption,
    ).toContain('Add or confirm');
  });
  it('keeps missing income conditional and preserves a negative amount to the penny', () => {
    const state = { ...fixture(), calendarEvents: [] };
    const plan = buildFinancialPlanFromState(state, { now });
    expect(
      selectRecoveryPreviewPresentation(state, { ...plan, nextIncomeDate: null }, 0, true)
        .canReassure,
    ).toBe(false);
    expect(selectRecoveryPreviewPresentation(state, plan, -10.46, true)).toMatchObject({
      canReassure: false,
      mood: 'concern',
      closesGap: false,
      caption: 'Still £10.46 short. Review the remaining gap.',
    });
  });
  it('permits a confirmed gap-closing preview without changing the current financial snapshot', () => {
    const state = { ...fixture(), calendarEvents: [] };
    const plan = buildFinancialPlanFromState(state, { now });
    expect(selectRecoveryPreviewPresentation(state, plan, 0, true)).toMatchObject({
      canReassure: true,
      mood: 'calm',
      closesGap: true,
      caption: 'This preview closes the forecast gap.',
    });
    expect(selectRecoveryPreviewPresentation(state, plan, 0, false).canReassure).toBe(false);
  });
});
