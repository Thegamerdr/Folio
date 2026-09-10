import { describe, expect, it } from 'vitest';
import { getState, type AppState } from '../store';
import { buildFinancialPlanFromState } from './financialPlan';
import { selectRitualFinancialReview } from './ritualFinancialReview';

const now = new Date('2026-09-10T12:00:00Z');
function fixture(): AppState {
  const base = getState();
  return {
    ...base,
    accounts: [],
    transactions: [],
    pots: [],
    subs: [],
    subPaused: {},
    subOverrides: {},
    whatIfHolds: [],
    spendHold: null,
    reviewQueue: [],
    reviewQueueSpillover: [],
    currentBalance: {
      amount: 1700,
      source: 'user-entered',
      confidence: 'corrected',
      provided: true,
      setAt: now.toISOString(),
    },
    onboarding: {
      ...base.onboarding,
      done: true,
      monthlyIncome: 1800,
      payday: 10,
      financialSetupConfirmed: true,
    },
    incomeSources: [
      {
        id: 'pay',
        label: 'Pay',
        amount: 1800,
        cadence: 'monthly',
        dayOfMonth: 10,
        source: 'manual',
      },
    ],
    calendarEvents: [
      { id: 'rent', date: '2026-09-12', kind: 'out', title: 'Rent and bills', amount: -950 },
    ],
    debts: [
      {
        id: 'card',
        name: 'Card',
        balance: 220,
        kind: 'card',
        minPayment: 40,
        dueDom: 19,
        apr: 19.9,
        addedAt: now.toISOString(),
      },
    ],
    modeExtras: { reset: 70 },
    bufferAmount: 200,
  };
}
function review(state = fixture(), owed = 1000) {
  const plan = buildFinancialPlanFromState(state, { now });
  return { plan, ...selectRitualFinancialReview(state, plan, owed) };
}

describe('ritual guidance respects the canonical current spending limit', () => {
  it('cannot offer repayment from next payday income instead of the £220 current limit', () => {
    const result = review();
    expect(
      result.plan.timeline.find((point) => point.date === result.plan.nextIncomeDate)?.closingMinor,
    ).toBe(221000);
    expect(result.plan.safeToSpendMinor).toBe(22000);
    expect(result.availableForExtra).toBe(220);
    expect(result.repayHeadroom).toBe(220);
    expect(result.spendingSummary).toContain('Safe to spend until payday: £220');
  });
  it('preserves repayment of a borrowed pot without offering more than is owed', () => {
    expect(review(fixture(), 50).repayHeadroom).toBe(50);
    expect(review(fixture(), 0).repayHeadroom).toBe(0);
  });
  it('withholds allocation and reassurance for incomplete costs despite a positive forecast', () => {
    const state = fixture();
    state.onboarding = { ...state.onboarding, done: false, financialSetupConfirmed: false };
    const result = review(state);
    expect(result.plan.safeToSpendMinor).toBe(22000);
    expect([result.availableForExtra, result.repayHeadroom]).toEqual([0, 0]);
    expect(result.spendingSummary).toContain('We need your numbers');
    expect(result.spendingSummary).not.toContain('Safe to spend');
  });
  it('keeps an overdue bill reserved and avoids reassuring even when the number is positive', () => {
    const state = fixture();
    state.calendarEvents = [{ ...state.calendarEvents[0]!, date: '2026-09-06' }];
    const result = review(state);
    expect(result.plan.safeToSpendMinor).toBe(22000);
    expect(result.repayHeadroom).toBe(0);
    expect(result.spendingSummary).toContain('Overdue commitments need attention');
    expect(result.spendingSummary).toContain('Estimate after recorded costs and buffer: £220');
    expect(result.spendingSummary).not.toContain('Safe to spend');
  });
  it('withholds optional allocation while pending figures need review', () => {
    const state = fixture();
    state.reviewQueue = [
      {
        id: 'review',
        source: 'manual',
        merchant: 'Unconfirmed bill',
        amount: -20,
        addedAt: now.toISOString(),
      },
    ];
    const result = review(state);
    expect(result.availableForExtra).toBe(0);
    expect(result.spendingSummary).toContain('Some figures need your review');
    expect(result.spendingSummary).not.toContain('Safe to spend');
  });
  it('does not use a confirmed zero-income setup as proof that money is available', () => {
    const state = fixture();
    state.incomeSources = [];
    state.onboarding.monthlyIncome = 0;
    const result = review(state);
    expect(result.availableForExtra).toBe(0);
    expect(result.spendingSummary).toContain('No next income date');
    expect(result.spendingSummary).not.toContain('Safe to spend');
  });
  it('keeps an actual shortfall signed and does not suggest a repayment', () => {
    const state = fixture();
    state.currentBalance = { ...state.currentBalance, amount: 1000 };
    const result = review(state);
    expect(result.plan.safeToSpendMinor).toBe(-48000);
    expect(result.repayHeadroom).toBe(0);
    expect(result.spendingSummary).toContain('−£480');
    expect(result.spendingSummary).not.toContain('Safe to spend');
  });
});
