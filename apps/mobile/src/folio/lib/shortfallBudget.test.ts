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
import {
  deriveShortfallBudget,
  formatShortfallCauseLine,
  selectShortfallCause,
} from './shortfallBudget';

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
      currentBalance: { ...base.currentBalance, amount: 1680 },
      onboarding: { ...base.onboarding, done: true, monthlyIncome: 400, payday: 15 },
      incomeSources: [
        {
          id: 'payday',
          label: 'Income',
          amount: 400,
          cadence: 'monthly',
          dayOfMonth: 15,
          source: 'manual',
        },
      ],
      transactions: [],
      calendarEvents: [
        {
          id: 'gap-before-payday',
          date: '2026-09-14',
          kind: 'out',
          title: 'Recovery Gap2',
          amount: -1500,
        },
        {
          id: 'small-before-payday',
          date: '2026-09-14',
          kind: 'out',
          title: 'Small outgoing',
          amount: -10,
        },
        {
          id: 'gap-bill',
          date: '2026-09-24',
          kind: 'out',
          title: 'GapBill',
          amount: -1800,
        },
      ],
      subs: [],
      subPaused: {},
      subOverrides: {},
      pots: [
        {
          id: 'protected-buffer',
          name: 'Protected buffer',
          saved: 340,
          goal: 340,
          perWeek: 0,
          accent: false,
          cadence: { kind: 'after-payday' },
        },
      ],
      debts: [],
      bufferAmount: 0,
      whatIfHolds: [],
      spendHold: null,
    };
    const now = new Date('2026-09-12T12:00:00Z');
    const model = buildCalendarPresentation(state, now);
    const route = routeFromStore(state, now);
    const selected = selectShortfallCause({
      routeDate: route.tightPoint.date,
      lowestBeforeIncomeDate: model.lowestBeforeIncome.date,
      nextIncomeDate: model.plan.nextIncomeDate,
      gap: deriveShortfallBudget(route).gap,
      events: model.events,
    });
    expect(route.safeToSpend).toBe(-170);
    expect(route.tightPoint.date).toBe('2026-09-24');
    expect(model.lowestBeforeIncome.date).toBe('2026-09-14');
    expect(selected).toMatchObject({ date: '2026-09-14' });
    expect(selected.event).toMatchObject({ title: 'Recovery Gap2', amount: -1500 });
    expect(formatShortfallCauseLine(selected.event)).toBe(
      'A payment to Recovery Gap2 lands in that stretch.',
    );
  });

  it('falls back honestly when income is unknown or no event explains a buffer-only gap', () => {
    expect(
      selectShortfallCause({ routeDate: '2026-09-24', gap: 0, events: [] }),
    ).toEqual({ date: '2026-09-24', event: null });
    expect(
      selectShortfallCause({
        routeDate: '2026-09-24',
        lowestBeforeIncomeDate: '2026-09-14',
        nextIncomeDate: '2026-09-15',
        gap: 5,
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

  it('selects a real overdue bill outflow while keeping unrelated and non-outgoing events out', () => {
    const overdue = {
      id: 'overdue',
      date: '2026-09-14',
      kind: 'out' as const,
      source: 'bill' as const,
      title: 'Overdue bill',
      amount: -200,
      note: 'Overdue · still reserved until confirmed paid',
    };
    const selected = selectShortfallCause({
      routeDate: '2026-09-24',
      lowestBeforeIncomeDate: '2026-09-14',
      nextIncomeDate: '2026-09-15',
      gap: 200,
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

  it('uses the aggregate fallback when no single protected outgoing can close the gap', () => {
    const selected = selectShortfallCause({
      routeDate: '2026-09-24',
      lowestBeforeIncomeDate: '2026-09-14',
      nextIncomeDate: '2026-09-15',
      gap: 170,
      events: [
        {
          id: 'first',
          date: '2026-09-13',
          kind: 'out',
          source: 'bill',
          title: 'Earlier bill',
          amount: -100,
        },
        {
          id: 'second',
          date: '2026-09-14',
          kind: 'out',
          source: 'manual',
          title: 'Recovery Gap2',
          amount: -150,
        },
      ],
    });
    expect(selected).toEqual({ date: '2026-09-14', event: null });
    expect(formatShortfallCauseLine(selected.event)).toBe(
      'No single payment creates this gap. It builds across this stretch.',
    );
  });

  it('does not name a small payment when the protected buffer leaves a larger gap', () => {
    const selected = selectShortfallCause({
      routeDate: '2026-09-24',
      lowestBeforeIncomeDate: '2026-09-14',
      nextIncomeDate: '2026-09-15',
      gap: 170,
      events: [
        {
          id: 'small',
          date: '2026-09-14',
          kind: 'out',
          source: 'manual',
          title: 'Small outgoing',
          amount: -10,
        },
      ],
    });
    expect(selected).toEqual({ date: '2026-09-14', event: null });
    expect(formatShortfallCauseLine(selected.event)).toBe(
      'No single payment creates this gap. It builds across this stretch.',
    );
  });

  it('does not call protected pot or hold deductions an outgoing cause', () => {
    const selected = selectShortfallCause({
      routeDate: '2026-09-14',
      lowestBeforeIncomeDate: '2026-09-14',
      nextIncomeDate: '2026-09-15',
      gap: 20,
      events: [
        { id: 'pot', date: '2026-09-14', kind: 'out', source: 'pot', title: 'Buffer', amount: -340 },
        { id: 'hold', date: '2026-09-14', kind: 'out', source: 'hold', title: 'Protected costs', amount: -20 },
      ],
    });
    expect(selected).toEqual({ date: '2026-09-14', event: null });
  });
});
