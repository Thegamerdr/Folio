import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSpendHold,
  getState,
  resetToEmpty,
  setPartial,
  setSpendHold,
  type AppState,
} from '../store';
import { buildFinancialPlanFromState } from './financialPlan';
import { routeFromStore } from './storeRoute';
import { buildCalendarPresentation } from './calendarPresentation';
import { deriveShortfallBudget, selectShortfallCause } from './shortfallBudget';

const now = new Date('2026-09-28T12:00:00Z');

beforeEach(() => resetToEmpty());

function septemberPaydayState(septemberPaid = false): AppState {
  const base = getState();
  return {
    ...base,
    accounts: [],
    currentBalance: {
      amount: 1800,
      source: 'corrected',
      confidence: 'corrected',
      setAt: now.toISOString(),
    },
    onboarding: { ...base.onboarding, monthlyIncome: 1800, payday: 28 },
    incomeSources: [
      {
        id: 'salary',
        label: 'Salary',
        amount: 1800,
        cadence: 'monthly',
        dayOfMonth: 28,
        source: 'manual',
      },
    ],
    transactions: [],
    calendarEvents: [],
    subs: [
      {
        name: 'Rent and bills',
        cost: 950,
        nextRenewalISO: '2026-09-12',
        obligationAnchorISO: '2026-09-12',
        nextRenewalDaysAway: -16,
        lastUsedDaysAgo: 0,
        usesPerMonth: 0,
        obligationOccurrences: septemberPaid ? { '2026-09-12': { status: 'paid' } } : {},
      },
    ],
    subPaused: {},
    subOverrides: {},
    pots: [],
    debts: [],
    whatIfHolds: [],
    spendHold: null,
    bufferAmount: 200,
    modeExtras: { ...(base.modeExtras ?? {}), reset: 70 },
  };
}

describe('shortfall recovery discretionary budget', () => {
  it('protects overdue September and next October rent: £600 gap and £0 discretionary cap', () => {
    const state = septemberPaydayState();
    const plan = buildFinancialPlanFromState(state, { now });
    const route = routeFromStore(state, now);
    expect(plan.safeToSpendMinor).toBe(-60000);
    expect(route.safeToSpend).toBe(-600);
    // This is future closing cash including the next salary; it is never today's spending budget.
    expect(route.spare).toBe(1390);
    expect(deriveShortfallBudget(route)).toEqual({ gap: 600, daysLeft: 30, dailyCap: 0 });
  });

  it('retains October protection after September is explicitly paid and divides only £350 safe', () => {
    const state = septemberPaydayState(true);
    const route = routeFromStore(state, now);
    expect(route.safeToSpend).toBe(350);
    expect(deriveShortfallBudget(route)).toEqual({ gap: 0, daysLeft: 30, dailyCap: 11 });
  });

  it('a larger future salary cannot increase current discretionary spending capacity', () => {
    const state = septemberPaydayState();
    const biggerSalary = {
      ...state,
      incomeSources: (state.incomeSources ?? []).map((source) => ({ ...source, amount: 5000 })),
    };
    expect(deriveShortfallBudget(routeFromStore(biggerSalary, now))).toEqual({
      gap: 600,
      daysLeft: 30,
      dailyCap: 0,
    });
  });

  it('still reports a buffer shortfall even when cash remains positive', () => {
    const route = routeFromStore(septemberPaydayState(), now);
    expect(
      deriveShortfallBudget({
        ...route,
        safeToSpend: -150,
        tightPoint: { date: '2026-10-27', amount: 50 },
      }),
    ).toEqual({
      gap: 150,
      daysLeft: 30,
      dailyCap: 0,
    });
  });

  it('preserves exact pence in the gap and rounds only the approximate daily guide down', () => {
    const route = routeFromStore(septemberPaydayState(), now);
    expect(deriveShortfallBudget({ ...route, safeToSpend: -0.01 }).gap).toBe(0.01);
    expect(deriveShortfallBudget({ ...route, safeToSpend: -150.45 }).gap).toBe(150.45);
    expect(deriveShortfallBudget({ ...route, safeToSpend: 29.99, daysToPayday: 3 }).dailyCap).toBe(
      9,
    );
    expect(deriveShortfallBudget({ ...route, safeToSpend: 29.99, daysToPayday: 0 }).dailyCap).toBe(
      29,
    );
  });

  it('has no budget before the route is ready', () => {
    expect(deriveShortfallBudget(null)).toEqual({ gap: 0, daysLeft: 0, dailyCap: 0 });
  });

  it('accepting and clearing a zero discretionary hold neither removes essentials nor closes the gap', () => {
    setPartial(septemberPaydayState());
    const before = getState();
    setSpendHold(0, 30, now);
    const held = getState();
    expect(held.spendHold).toMatchObject({ dailyCap: 0, start: '2026-09-28', end: '2026-10-27' });
    expect(held.currentBalance).toEqual(before.currentBalance);
    expect(held.transactions).toEqual(before.transactions);
    expect(held.debts).toEqual(before.debts);
    const plan = buildFinancialPlanFromState(held, { now });
    expect(plan.livingCostMinor).toBe(30000);
    expect(plan.safeToSpendMinor).toBe(-60000);
    expect(deriveShortfallBudget(routeFromStore(held, now))).toEqual({
      gap: 600,
      daysLeft: 30,
      dailyCap: 0,
    });
    clearSpendHold();
    expect(getState().spendHold).toBeNull();
    expect(buildFinancialPlanFromState(getState(), { now }).safeToSpendMinor).toBe(-60000);
  });
});

describe('shortfall cause projection', () => {
  it('uses the pre-income low date when the route chart dips again after payday', () => {
    const base = getState();
    const state: AppState = {
      ...base,
      accounts: [],
      currentBalance: { ...base.currentBalance, amount: 1000 },
      onboarding: { ...base.onboarding, done: true, monthlyIncome: 1000, payday: 15 },
      incomeSources: [],
      transactions: [],
      calendarEvents: [
        {
          id: 'gap-before-payday',
          date: '2026-09-14',
          kind: 'out',
          title: 'Recovery Gap 2',
          amount: -1500,
        },
        {
          id: 'later-bill',
          date: '2026-09-24',
          kind: 'out',
          title: 'Later bill',
          amount: -160,
        },
      ],
      subs: [],
      subPaused: {},
      subOverrides: {},
      pots: [],
      debts: [],
      bufferAmount: 0,
      whatIfHolds: [],
      spendHold: null,
    };
    const model = buildCalendarPresentation(state, new Date('2026-09-12T12:00:00Z'));
    const selected = selectShortfallCause({
      routeDate: '2026-09-24',
      lowestBeforeIncomeDate: model.lowestBeforeIncome.date,
      events: model.events,
    });
    expect(model.lowestBeforeIncome.date).toBe('2026-09-14');
    expect(selected).toMatchObject({ date: '2026-09-14' });
    expect(selected.event).toMatchObject({ title: 'Recovery Gap 2', amount: -1500 });
  });

  it('falls back honestly when income is unknown or no event explains a buffer-only gap', () => {
    expect(
      selectShortfallCause({ routeDate: '2026-09-24', events: [] }),
    ).toEqual({ date: '2026-09-24', event: null });
    expect(
      selectShortfallCause({
        routeDate: '2026-09-24',
        lowestBeforeIncomeDate: '2026-09-14',
        events: [
          {
            id: 'in',
            date: '2026-09-14',
            kind: 'in',
            source: 'payday',
            title: 'Income',
            amount: 1000,
          },
          {
            id: 'other-day',
            date: '2026-09-15',
            kind: 'out',
            source: 'bill',
            title: 'Other',
            amount: -5,
          },
        ],
      }),
    ).toEqual({ date: '2026-09-14', event: null });
  });

  it('selects an overdue matching outflow while keeping unrelated and non-outflow events out', () => {
    const overdue = {
      id: 'overdue',
      date: '2026-09-14',
      kind: 'out' as const,
      source: 'bill' as const,
      title: 'Overdue bill',
      amount: -200,
    };
    const selected = selectShortfallCause({
      routeDate: '2026-09-24',
      lowestBeforeIncomeDate: '2026-09-14',
      events: [
        {
          id: 'income',
          date: '2026-09-14',
          kind: 'in',
          source: 'payday',
          title: 'Income',
          amount: 500,
        },
        overdue,
      ],
    });
    expect(selected.event).toEqual(overdue);
  });
});
