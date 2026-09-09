import { describe, expect, it } from 'vitest';
import { getState, type AppState } from '../store';
import { buildFinancialPlanFromState, toFinancialPlanInput } from './financialPlan';
import { routeFromStore } from './storeRoute';

function paydayState(): AppState {
  const base = getState();
  return {
    ...base,
    accounts: [],
    currentBalance: {
      amount: 1800,
      source: 'user-entered',
      confidence: 'corrected',
      setAt: '2026-09-28T09:00:00Z',
    },
    onboarding: { ...base.onboarding, monthlyIncome: 1800, payday: 28 },
    incomeSources: [
      {
        id: 'salary',
        label: 'Monthly salary',
        amount: 1800,
        cadence: 'monthly',
        dayOfMonth: 28,
        source: 'manual',
      },
    ],
    transactions: [],
    calendarEvents: [
      { id: 'rent', date: '2026-10-12', kind: 'out', title: 'Rent and bills', amount: -950 },
    ],
    subs: [],
    subPaused: {},
    subOverrides: {},
    pots: [],
    debts: [],
    bufferAmount: 200,
    modeExtras: { ...(base.modeExtras ?? {}), reset: 70 },
  };
}

describe('mobile payday release regression', () => {
  it('keeps route safety aligned with the full plan when irregular payday is beyond the 35-day chart', () => {
    const base = paydayState();
    const state: AppState = {
      ...base,
      incomeSources: [],
      onboarding: { ...base.onboarding, monthlyIncome: 0, payday: 0 },
      calendarEvents: [
        {
          id: 'delayed-client',
          title: 'Contract receipt',
          kind: 'in',
          date: '2026-11-17',
          amount: 1800,
        },
        {
          id: 'later-bill',
          title: 'Rent and bills',
          kind: 'out',
          date: '2026-11-12',
          amount: -950,
        },
      ],
    };
    const now = new Date('2026-09-28T09:00:00Z');
    expect(buildFinancialPlanFromState(state, { now }).safeToSpendMinor).toBe(15000);
    expect(routeFromStore(state, now).safeToSpend).toBe(150);
  });

  it('returns £350 from the release reproduction including the income-source adapter', () => {
    const state = paydayState();
    const now = new Date('2026-09-28T09:00:00Z');
    const input = toFinancialPlanInput(state, { now, horizonDays: 40 });
    const plan = buildFinancialPlanFromState(state, { now, horizonDays: 40 });
    expect(plan.safeToSpendMinor).toBe(35000);
    expect(input.nextIncomeDate).toBe('2026-10-28');
    expect(plan.nextIncomeDate).toBe('2026-10-28');
    expect(plan.protectedBeforeIncomeMinor).toBe(125000);
  });

  it('applies the same protection when only onboarding monthly pay is available', () => {
    expect(
      buildFinancialPlanFromState(
        { ...paydayState(), incomeSources: [] },
        {
          now: new Date('2026-09-28T09:00:00Z'),
          horizonDays: 40,
        },
      ).safeToSpendMinor,
    ).toBe(35000);
  });

  it('does not spend a scheduled salary today until the user records the received cash balance', () => {
    const state = paydayState();
    const pending = { ...state, currentBalance: { ...state.currentBalance, amount: 200 } };
    expect(
      buildFinancialPlanFromState(pending, {
        now: new Date('2026-09-28T09:00:00Z'),
        horizonDays: 40,
      }).safeToSpendMinor,
    ).toBe(-125000);
  });

  it('uses the next weekly owner payday after today and protects all seven days of essentials', () => {
    const state = paydayState();
    const plan = buildFinancialPlanFromState(
      {
        ...state,
        calendarEvents: [],
        incomeSources: [
          {
            id: 'owner-weekly',
            label: 'Weekly income',
            amount: 600,
            cadence: 'weekly',
            anchorISO: '2026-09-28',
            source: 'manual',
          },
        ],
      },
      { now: new Date('2026-09-28T09:00:00Z'), horizonDays: 40 },
    );
    expect(plan.nextIncomeDate).toBe('2026-10-05');
    expect(plan.safeToSpendMinor).toBe(153000);
    expect(plan.livingCostMinor).toBe(7000);
  });

  it('treats an irregular manual receipt today as scheduled and uses the next separately dated receipt', () => {
    const state = paydayState();
    const plan = buildFinancialPlanFromState(
      {
        ...state,
        onboarding: { ...state.onboarding, monthlyIncome: 0, payday: 0 },
        incomeSources: [],
        calendarEvents: [
          { id: 'due-today', title: 'Client payment', kind: 'in', date: '2026-09-28', amount: 300 },
          {
            id: 'next-client',
            title: 'Next contract',
            kind: 'in',
            date: '2026-10-09',
            amount: 600,
          },
        ],
      },
      { now: new Date('2026-09-28T09:00:00Z'), horizonDays: 40 },
    );
    expect(plan.nextIncomeDate).toBe('2026-10-09');
    expect(plan.safeToSpendMinor).toBe(149000);
    expect(plan.livingCostMinor).toBe(11000);
  });
});
