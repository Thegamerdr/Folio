import { beforeEach, describe, expect, it } from 'vitest';
import { getState, resetToEmpty, type AppState, type Pot } from '../store';
import { buildFinancialPlanFromState } from './financialPlan';
import {
  previewPotReallocation,
  selectPotProgress,
  selectPotsPresentation,
} from './potsPresentation';
import { formatMoney } from './financialPresentation';

const now = new Date('2026-09-10T12:00:00Z');
const pot: Pot = {
  id: 'buffer',
  name: 'Evidence buffer',
  saved: 0,
  goal: 1000,
  perWeek: 0,
  accent: true,
  cadence: { kind: 'after-payday' },
};

function fixture(): AppState {
  const state = getState();
  return {
    ...state,
    accounts: [],
    pots: [pot],
    transactions: [],
    debts: [],
    calendarEvents: [],
    incomeSources: [],
    currentBalance: {
      ...state.currentBalance,
      amount: 1500,
      provided: true,
      confidence: 'corrected',
    },
    onboarding: {
      ...state.onboarding,
      done: true,
      financialSetupConfirmed: true,
      monthlyIncome: 1800,
      payday: 10,
    },
    subs: [
      {
        name: 'Overdue commitment',
        cost: 1415,
        renewalPeriodDays: 365,
        obligationAnchorISO: '2026-09-09',
        nextRenewalISO: '2026-09-09',
        nextRenewalDaysAway: 0,
        usesPerMonth: 0,
        lastUsedDaysAgo: 0,
      },
    ],
    subPaused: {},
    subOverrides: {},
    spendHold: null,
    whatIfHolds: [],
    reviewQueue: [],
    reviewQueueSpillover: [],
    modeExtras: { reset: 0 },
    bufferAmount: 200,
  };
}

beforeEach(() => resetToEmpty());

describe('Pots progress and canonical money presentation', () => {
  it('never calls a new zero-funded, zero-pace £1,000 pot complete', () => {
    expect(selectPotProgress(pot)).toEqual({
      goalMet: false,
      remaining: 1000,
      paceLabel: 'No top-up pace set',
      etaLabel: '£1,000 left to set aside',
    });
    expect(selectPotProgress({ ...pot, saved: 123.45 }).etaLabel).toBe('£876.55 left to set aside');
  });
  it('marks only a positive goal with enough saved as met', () => {
    expect(selectPotProgress({ ...pot, saved: 1000 }).goalMet).toBe(true);
    expect(selectPotProgress({ ...pot, saved: 1200 }).etaLabel).toBe('Goal met');
    expect(selectPotProgress({ ...pot, goal: 0 }).etaLabel).toBe('No goal set');
    expect(selectPotProgress({ ...pot, saved: -20 }).etaLabel).toBe('£1,020 left to set aside');
  });
  it('estimates weeks only for an actual weekly pace and preserves pennies', () => {
    expect(
      selectPotProgress({
        ...pot,
        saved: 975,
        perWeek: 12.5,
        cadence: { kind: 'weekly', weekday: 5 },
      }),
    ).toMatchObject({
      paceLabel: '£12.50 planned each week',
      etaLabel: 'About 2 weeks at this pace',
    });
    expect(
      selectPotProgress({
        ...pot,
        saved: 990,
        perWeek: 12.5,
        cadence: { kind: 'weekly', weekday: 5 },
      }).etaLabel,
    ).toBe('About 1 week at this pace');
    expect(selectPotProgress({ ...pot, perWeek: 20 })).toMatchObject({
      paceLabel: '£20 planned after payday',
      etaLabel: '£1,000 left to set aside',
    });
    expect(
      selectPotProgress({ ...pot, perWeek: 20, cadence: { kind: 'monthly', dayOfMonth: 10 } })
        .paceLabel,
    ).toBe('£20 planned each month');
  });
  it('shows canonical £115 shortfall beside distinctly labelled £1,500 cash outside pots', () => {
    const state = fixture();
    const plan = buildFinancialPlanFromState(state, { now });
    const model = selectPotsPresentation(state, plan);
    expect(model).toMatchObject({
      safe: -115,
      label: 'Gap after bills, essentials and buffer',
      cashOutsidePots: 1500,
    });
    expect(model.presentation.canReassure).toBe(false);
    expect(model.message).toContain('overdue');
    expect(formatMoney(model.cashOutsidePots!)).toBe('£1,500');
  });
  it('keeps unknown setup guarded and does not fabricate money during clock loading', () => {
    expect(selectPotsPresentation(fixture(), null)).toMatchObject({
      safe: null,
      cashOutsidePots: null,
      label: 'Checking your plan',
    });
    const state = fixture();
    state.onboarding = { ...state.onboarding, done: false, financialSetupConfirmed: false };
    expect(
      selectPotsPresentation(state, buildFinancialPlanFromState(state, { now })),
    ).toMatchObject({ safe: null, label: 'We need your numbers' });
  });
  it('uses protected positive pot totals without treating negative pot tracking as extra cash', () => {
    const state = fixture();
    state.pots = [
      { ...pot, saved: 100.25 },
      { ...pot, id: 'borrowed', saved: -20 },
    ];
    const model = selectPotsPresentation(state, buildFinancialPlanFromState(state, { now }));
    expect(model.cashOutsidePots).toBe(1399.75);
    expect(model.safe).toBe(-215.25);
  });
  it('compares reallocations through the canonical plan without mutating saved state or cash', () => {
    const state = fixture();
    state.pots = [
      { ...pot, saved: 100.25 },
      { ...pot, id: 'holiday', saved: 20 },
    ];
    const before = JSON.stringify(state);
    const preview = previewPotReallocation(state, 'buffer', 'holiday', 12.5, now);
    expect(preview.delta).toBe(0);
    expect(preview.before.currentBalanceMinor).toBe(150000);
    expect(preview.after.currentBalanceMinor).toBe(150000);
    expect(preview.model.safe).toBe(preview.before.safeToSpendMinor / 100);
    expect(JSON.stringify(state)).toBe(before);
  });
});
