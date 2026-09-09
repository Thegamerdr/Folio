import { describe, expect, it } from 'vitest';

import { simulateFinancialAffordability } from '@folio/finance-engine';
import { getState, type AppState } from '../store';
import { buildFinancialPlanFromState, toFinancialPlanInput } from './financialPlan';
import { routeFromStore } from './storeRoute';
import { presentStabilityCanonicalPlan } from './stabilityPresentation';

const NOW = new Date('2026-09-09T00:00:00Z');

function fixture(overrides: Partial<AppState> = {}): AppState {
  const base = getState();
  return {
    ...base,
    accounts: [],
    currentBalance: {
      amount: 1800,
      source: 'user-entered',
      confidence: 'corrected',
      setAt: '2026-09-09T00:00:00Z',
    },
    onboarding: { ...base.onboarding, monthlyIncome: 1800, payday: 28 },
    incomeSources: [],
    transactions: [],
    calendarEvents: [
      { id: 'rent', date: '2026-09-12', kind: 'out', title: 'Rent and bills', amount: -950 },
    ],
    subs: [],
    subPaused: {},
    subOverrides: {},
    pots: [],
    debts: [
      {
        id: 'card',
        name: 'Card',
        kind: 'card',
        balance: 1000,
        apr: 24,
        minPayment: 80,
        dueDom: 18,
        addedAt: '2026-01-01',
      },
    ],
    bufferAmount: 200,
    modeExtras: { ...(base.modeExtras ?? {}), reset: 70 },
    ...overrides,
  };
}

describe('AppState financial plan adapter', () => {
  it('matches the dated Fixture B safe-to-spend path', () => {
    const plan = buildFinancialPlanFromState(fixture(), { now: NOW, horizonDays: 35 });
    expect(plan.nextIncomeDate).toBe('2026-09-28');
    expect(plan.protectedBeforeIncomeMinor).toBe(122000);
    expect(plan.safeToSpendMinor).toBe(38000);
  });

  it('provides Stability with the same protected Fixture B hero amount as the canonical route', () => {
    const safeToSpend = routeFromStore(fixture(), NOW).safeToSpend;
    if (safeToSpend === undefined) throw new Error('Fixture B should resolve a protected route');
    expect(safeToSpend).toBe(380);
    expect(presentStabilityCanonicalPlan(safeToSpend - 0.5, 200)).toMatchObject({
      amount: 379.5,
      headline: '£379.50',
      verdict: 'Known commitments covered until payday.',
      negative: false,
    });
    expect(presentStabilityCanonicalPlan(-20.5, 200)).toMatchObject({
      amount: 0,
      formula: 'safe to spend until payday · £20.50 projected shortfall before payday',
      verdict: '£20.50 projected shortfall before payday.',
      negative: true,
    });
  });

  it('changes only the relevant protections when balance, buffer, or a bill changes', () => {
    expect(
      buildFinancialPlanFromState(
        fixture({ currentBalance: { ...fixture().currentBalance, amount: 1600 } }),
        { now: NOW, horizonDays: 35 },
      ).safeToSpendMinor,
    ).toBe(18000);
    expect(
      buildFinancialPlanFromState(fixture({ bufferAmount: 0 }), { now: NOW, horizonDays: 35 })
        .safeToSpendMinor,
    ).toBe(58000);
    expect(
      buildFinancialPlanFromState(fixture({ calendarEvents: [] }), { now: NOW, horizonDays: 35 })
        .safeToSpendMinor,
    ).toBe(133000);
  });

  it('checks an unexpected spend against the same dated plan', () => {
    const input = toFinancialPlanInput(fixture(), { now: NOW, horizonDays: 35 });
    const result = simulateFinancialAffordability(input, 40000, '2026-09-10');
    expect(result.affordable).toBe(false);
    expect(result.safeToSpendAfterMinor).toBe(-2000);
  });

  it('uses explicit irregular calendar income without inventing a payday', () => {
    const state = fixture({
      currentBalance: { ...fixture().currentBalance, amount: 1000 },
      onboarding: { ...getState().onboarding, monthlyIncome: 0, payday: 0 },
      calendarEvents: [
        { id: 'bill', date: '2026-09-12', kind: 'out', title: 'Bill', amount: -400 },
        { id: 'receipt', date: '2026-09-15', kind: 'in', title: 'Client receipt', amount: 500 },
      ],
      debts: [],
    });
    const plan = buildFinancialPlanFromState(state, { now: NOW, horizonDays: 35 });
    expect(plan.nextIncomeDate).toBe('2026-09-15');
    expect(plan.safeToSpendMinor).toBe(34000);
  });

  it('leaves the income horizon explicit when onboarding has no payday', () => {
    const state = fixture({
      onboarding: { ...getState().onboarding, monthlyIncome: 1800, payday: 0 },
      calendarEvents: [],
      debts: [],
    });
    const plan = buildFinancialPlanFromState(state, { now: NOW, horizonDays: 35 });
    expect(plan.nextIncomeDate).toBeNull();
  });

  it('normalizes a legacy zero renewal cadence without an unbounded forecast loop', () => {
    const state = fixture({
      subs: [
        {
          name: 'Legacy renewal',
          cost: 5,
          nextRenewalDaysAway: 1,
          renewalPeriodDays: 0,
          lastUsedDaysAgo: 0,
          usesPerMonth: 0,
        },
      ],
    });
    const plan = buildFinancialPlanFromState(state, { now: NOW, horizonDays: 35 });
    expect(plan.timeline.length).toBeGreaterThan(0);
    expect(plan.horizonEndDate).toBe('2026-10-14');
  });

  it('uses corrected active cash once and keeps weekly/monthly renewal dates anchored', () => {
    const january = new Date('2026-01-31T00:00:00Z');
    const state = fixture({
      currentBalance: { ...fixture().currentBalance, amount: 500, source: 'corrected' },
      accounts: [
        {
          id: 'active',
          name: 'Active',
          kind: 'bank',
          isLiability: false,
          balanceMinor: 500,
          balanceAsOfISO: january.toISOString(),
          addedAt: january.toISOString(),
        },
        {
          id: 'closed',
          name: 'Closed',
          kind: 'bank',
          isLiability: false,
          closed: true,
          balanceMinor: 9000,
          balanceAsOfISO: january.toISOString(),
          addedAt: january.toISOString(),
        },
        {
          id: 'liability',
          name: 'Card',
          kind: 'bank',
          isLiability: true,
          balanceMinor: 3000,
          balanceAsOfISO: january.toISOString(),
          addedAt: january.toISOString(),
        },
      ],
      onboarding: { ...getState().onboarding, monthlyIncome: 0, payday: 0 },
      incomeSources: [],
      calendarEvents: [],
      transactions: [
        {
          id: 'posted',
          merchant: 'Posted spend',
          amount: -100,
          when: january.toISOString(),
          category: 'shopping',
          source: 'manual',
        },
      ],
      debts: [],
      subs: [
        {
          name: 'Weekly streaming',
          cost: 10,
          nextRenewalDaysAway: 5,
          nextRenewalISO: '2026-02-05',
          renewalPeriodDays: 7,
          lastUsedDaysAgo: 0,
          usesPerMonth: 4,
        },
        {
          name: 'Month 31 streaming',
          cost: 5,
          nextRenewalDaysAway: 0,
          nextRenewalISO: '2026-01-31',
          lastUsedDaysAgo: 0,
          usesPerMonth: 1,
        },
      ],
    });
    const input = toFinancialPlanInput(state, { now: january, horizonDays: 60 });
    expect(input.accounts.main).toBe(50000);
    expect(input.cashflows).toBeUndefined();
    const renewalDates = input.commitments
      ?.filter((item) => item.id.startsWith('subscription:'))
      .map((item) => item.date);
    expect(renewalDates).toEqual(
      expect.arrayContaining([
        '2026-02-05',
        '2026-02-12',
        '2026-02-28',
        '2026-03-05',
        '2026-03-12',
        '2026-03-31',
      ]),
    );
  });
});
