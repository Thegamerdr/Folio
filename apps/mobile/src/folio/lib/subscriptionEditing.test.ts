import { describe, expect, it } from 'vitest';
import { getState, type AppState } from '../store';
import { toFinancialPlanInput } from './financialPlan';
import { buildSubscriptionEditPatch, subscriptionEditBoundary } from './subscriptionEditing';
const NOW = new Date(2026, 8, 9);
function fixture(): AppState {
  const base = getState();
  return {
    ...base,
    subs: [
      {
        name: 'Phone',
        cost: 35,
        nextRenewalISO: '2026-08-12',
        obligationAnchorISO: '2026-08-12',
        nextRenewalDaysAway: 3,
        lastUsedDaysAgo: 0,
        usesPerMonth: 1,
        obligationOccurrences: { '2026-08-12': { status: 'partial', paidMinor: 1000 } },
      },
    ],
    subPaused: { Phone: false },
    subOverrides: { Phone: -3 },
    household: {
      partnerName: base.household?.partnerName ?? '',
      defaultShare: base.household?.defaultShare ?? 0.5,
      subShareOverrides: { Phone: 0.4 },
    },
  };
}
describe('bill details edit', () => {
  it('renames all linked settings atomically and preserves the current occurrence and cash', () => {
    const state = fixture();
    const before = JSON.stringify(state);
    const boundary = subscriptionEditBoundary(state, 'Phone', NOW);
    expect(boundary.protectedDate).toBe('2026-09-09');
    const patch = buildSubscriptionEditPatch(
      state,
      'Phone',
      { name: 'Household phone', cost: 40, periodDays: 7, futureDate: '2026-10-09' },
      NOW,
    );
    const edited = { ...state, ...patch };
    const dates = toFinancialPlanInput(edited, { now: NOW, horizonDays: 40 }).commitments!.filter(
      (item) => item.id.startsWith('subscription:'),
    );
    expect(
      dates
        .filter((item) => item.date <= '2026-09-09')
        .map((item) => [item.date, item.amountMinor]),
    ).toEqual([
      ['2026-08-09', 2500],
      ['2026-09-09', 3500],
    ]);
    expect(dates.find((item) => item.date === '2026-10-09')?.amountMinor).toBe(4000);
    expect(dates.find((item) => item.date === '2026-10-16')?.amountMinor).toBe(4000);
    expect(edited.subOverrides).toEqual({ 'Household phone': -3 });
    expect(edited.subPaused).toEqual({ 'Household phone': false });
    expect(edited.household!.subShareOverrides).toEqual({ 'Household phone': 0.4 });
    expect(edited.currentBalance).toEqual(state.currentBalance);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('keeps paid history and rejects a future schedule that would replace the current occurrence', () => {
    const state = fixture();
    state.subs[0]!.obligationOccurrences = { '2026-08-12': { status: 'paid', amountMinor: 3500 } };
    expect(() =>
      buildSubscriptionEditPatch(
        state,
        'Phone',
        { name: 'Phone', cost: 40, periodDays: null, futureDate: '2026-09-09' },
        NOW,
      ),
    ).toThrow('after the current occurrence');
    const patch = buildSubscriptionEditPatch(
      state,
      'Phone',
      { name: 'Phone', cost: 40, periodDays: null, futureDate: '2026-10-09' },
      NOW,
    );
    expect(patch.subs?.[0]?.obligationOccurrences?.['2026-08-12']).toEqual({
      status: 'paid',
      amountMinor: 3500,
    });
  });
  it('does not alter schedule for a name-only edit and rejects duplicate bill names', () => {
    const state = fixture();
    const boundary = subscriptionEditBoundary(state, 'Phone', NOW);
    const patch = buildSubscriptionEditPatch(
      state,
      'Phone',
      { name: 'Mobile', cost: 35, periodDays: null, futureDate: boundary.defaultDate },
      NOW,
    );
    expect(patch.subs?.[0]?.obligationAnchorISO).toBe('2026-08-12');
    state.subs.push({ ...state.subs[0]!, name: 'Mobile' });
    expect(() =>
      buildSubscriptionEditPatch(
        state,
        'Phone',
        { name: 'Mobile', cost: 35, periodDays: null, futureDate: boundary.defaultDate },
        NOW,
      ),
    ).toThrow('already');
  });
});
