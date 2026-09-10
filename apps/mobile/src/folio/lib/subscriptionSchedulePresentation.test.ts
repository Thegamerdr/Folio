import { describe, expect, it } from 'vitest';
import { getState, type AppState } from '../store';
import { toFinancialPlanInput } from './financialPlan';
import { buildSubscriptionEditPatch } from './subscriptionEditing';
import { subscriptionSchedulePresentation } from './subscriptionSchedulePresentation';

const NOW = new Date(2026, 8, 10, 12);
function fixture(): AppState {
  const base = getState();
  return {
    ...base,
    currentBalance: { ...base.currentBalance, amount: 1800, provided: true },
    subs: [
      {
        name: 'Rent + bills',
        cost: 950,
        nextRenewalISO: '2026-09-12',
        obligationAnchorISO: '2026-09-12',
        nextRenewalDaysAway: 2,
        lastUsedDaysAgo: 0,
        usesPerMonth: 1,
      },
    ],
    subPaused: {},
    subOverrides: {},
  };
}

describe('bill card recurring amount and preserved occurrence', () => {
  it('pairs the new £951 amount with 12 October while keeping £950 due 12 September', () => {
    const before = fixture();
    const edited = {
      ...before,
      ...buildSubscriptionEditPatch(
        before,
        'Rent + bills',
        { name: 'Rent + bills', cost: 951, periodDays: null, futureDate: '2026-10-12' },
        NOW,
      ),
    };
    const plan = toFinancialPlanInput(edited, { now: NOW, horizonDays: 365 });
    const snapshot = JSON.stringify({ edited, plan });
    expect(subscriptionSchedulePresentation(edited.subs[0]!, plan.asOf, plan.commitments!)).toEqual(
      {
        amountLabel: 'Future scheduled amount',
        dateLabel: 'New schedule starts 12 Oct 2026',
      },
    );
    expect(edited.subs[0]!.cost).toBe(951);
    expect(plan.commitments!.find((item) => item.date === '2026-09-12')?.amountMinor).toBe(95000);
    expect(plan.commitments!.find((item) => item.date === '2026-10-12')?.amountMinor).toBe(95100);
    expect(edited.currentBalance.amount).toBe(1800);
    expect(JSON.stringify({ edited, plan })).toBe(snapshot);
  });

  it('labels an unchanged recurring amount and preserves a partial current remainder', () => {
    const state = fixture();
    state.subs[0]!.obligationOccurrences = {
      '2026-09-12': { status: 'partial', amountMinor: 95000, paidMinor: 5000 },
    };
    const plan = toFinancialPlanInput(state, { now: NOW, horizonDays: 365 });
    expect(subscriptionSchedulePresentation(state.subs[0]!, plan.asOf, plan.commitments!)).toEqual({
      amountLabel: 'Scheduled amount',
      dateLabel: 'Next scheduled 12 Sept 2026',
    });
    expect(plan.commitments!.find((item) => item.date === '2026-09-12')?.amountMinor).toBe(90000);
    expect(state.subs[0]!.cost).toBe(950);
  });

  it('uses the recorded schedule date rather than a temporary forecast placement', () => {
    const state = fixture();
    state.subOverrides['Rent + bills'] = -3;
    const plan = toFinancialPlanInput(state, { now: NOW, horizonDays: 365 });
    expect(plan.commitments!.find((item) => item.id.endsWith(':2026-09-12'))?.date).toBe(
      '2026-09-09',
    );
    expect(subscriptionSchedulePresentation(state.subs[0]!, plan.asOf, plan.commitments!)).toEqual({
      amountLabel: 'Scheduled amount',
      dateLabel: 'Next scheduled 12 Sept 2026',
    });
  });

  it('includes a bill due today and advances after its paid occurrence', () => {
    const state = fixture();
    const today = new Date(2026, 8, 12, 12);
    let plan = toFinancialPlanInput(state, { now: today, horizonDays: 365 });
    expect(
      subscriptionSchedulePresentation(state.subs[0]!, plan.asOf, plan.commitments!).dateLabel,
    ).toBe('Next scheduled 12 Sept 2026');
    state.subs[0]!.obligationOccurrences = { '2026-09-12': { status: 'paid' } };
    plan = toFinancialPlanInput(state, { now: today, horizonDays: 365 });
    expect(
      subscriptionSchedulePresentation(state.subs[0]!, plan.asOf, plan.commitments!).dateLabel,
    ).toBe('Next scheduled 12 Oct 2026');
  });
});
