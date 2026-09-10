import { describe, expect, it } from 'vitest';
import { getState, type AppState } from '../store';
import { buildCalendarPresentation, knownCalendarBalances } from './calendarPresentation';
import { buildFinancialPlanFromState } from './financialPlan';
import { routeFromStore } from './storeRoute';

describe('Calendar trend with incomplete date coverage', () => {
  it('does not turn missing past days or dates beyond the forecast into zero', () => {
    expect(
      knownCalendarBalances(['2026-09-01', '2026-09-10', '2026-09-11', '2027-10-01'], {
        '2026-09-10': 1690,
        '2026-09-11': 1680,
      }),
    ).toEqual([1690, 1680]);
  });
  it('preserves real zero and negative balances and leaves unknown ranges empty', () => {
    expect(knownCalendarBalances(['a', 'b', 'c'], { a: 0, b: -12.45, c: NaN })).toEqual([
      0, -12.45,
    ]);
    expect(knownCalendarBalances(['a', 'b'], {})).toEqual([]);
  });
});

export function calendarFixture(): AppState {
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
    onboarding: { ...base.onboarding, done: true, monthlyIncome: 1800, payday: 9 },
    incomeSources: [],
    pots: [],
    transactions: [],
    calendarEvents: [],
    whatIfHolds: [],
    spendHold: null,
    bufferAmount: 200,
    modeExtras: { ...base.modeExtras, reset: 70 },
    subs: [
      {
        name: 'Rent + bills',
        cost: 950,
        nextRenewalDaysAway: 3,
        nextRenewalISO: '2026-09-12',
        obligationAnchorISO: '2026-09-12',
        lastUsedDaysAgo: 0,
        usesPerMonth: 0,
      },
    ],
    subPaused: {},
    subOverrides: {},
    debts: [],
  };
}
const NOW = new Date(2026, 8, 9);
describe('one Calendar presentation for the parent and Full day', () => {
  it('preserves the 12 September rent row and date when Full day selects it', () => {
    const model = buildCalendarPresentation(calendarFixture(), NOW);
    const parent = model.groups.find((group) => group.date === '2026-09-12')?.events;
    const detail = model.eventsByDay['2026-09-12'];
    expect(detail).toEqual(parent);
    expect(detail).toContainEqual(
      expect.objectContaining({ title: 'Rent + bills', amount: -950, date: '2026-09-12' }),
    );
    expect(model.eventsByDay['2026-09-11']?.some((event) => event.title === 'Rent + bills')).toBe(
      false,
    );
  });
  it('uses the next future payday and exact same canonical balances, without adding today’s income twice', () => {
    const state = calendarFixture();
    const model = buildCalendarPresentation(state, NOW);
    const plan = buildFinancialPlanFromState(state, { now: NOW });
    expect(model.plan.nextIncomeDate).toBe('2026-10-09');
    expect(model.plan.safeToSpendMinor).toBe(35000);
    expect(
      model.events.find((event) => event.source === 'payday' && event.date === '2026-09-09')
        ?.amount,
    ).toBeUndefined();
    expect(model.spareByDay['2026-09-09']).toBe(plan.timeline[0]?.closingMinor! / 100);
  });
  it('includes a debt minimum beside the same Plan obligation', () => {
    const state = calendarFixture();
    state.debts = [
      {
        id: 'card',
        name: 'Evidence card',
        kind: 'card',
        balance: 320,
        apr: 19.9,
        minPayment: 40,
        dueDom: 19,
        minimumDueDate: '2026-09-19',
        addedAt: '2026-09-09',
      },
    ];
    const model = buildCalendarPresentation(state, NOW);
    expect(model.eventsByDay['2026-09-19']).toContainEqual(
      expect.objectContaining({ title: 'Evidence card · minimum payment', amount: -40 }),
    );
    expect(model.plan.pendingObligations).toContainEqual(
      expect.objectContaining({ date: '2026-09-19', amountMinor: 4000, source: 'debt-minimum' }),
    );
  });
  it('retains moved overdue and confirmed-paid dates without duplicate outflows', () => {
    const state = calendarFixture();
    state.subOverrides = { 'Rent + bills': -6 };
    expect(buildCalendarPresentation(state, NOW).eventsByDay['2026-09-06']).toContainEqual(
      expect.objectContaining({ amount: -950, note: expect.stringContaining('Overdue') }),
    );
    state.subs = [
      { ...state.subs[0]!, obligationOccurrences: { '2026-09-12': { status: 'paid' } } },
    ];
    const paid = buildCalendarPresentation(state, NOW);
    expect(paid.eventsByDay['2026-09-06']).toContainEqual(
      expect.objectContaining({
        title: 'Rent + bills',
        note: expect.stringContaining('Confirmed already paid'),
      }),
    );
    expect(paid.eventsByDay['2026-09-06']?.some((event) => event.amount === -950)).toBe(false);
  });
  it('keeps empty dates empty and manual history visible in Full day', () => {
    const state = calendarFixture();
    state.transactions = [
      {
        id: 'old',
        merchant: 'Recorded payment',
        amount: -40,
        when: '2026-09-05T12:00:00Z',
        category: 'other',
        source: 'manual',
      },
    ];
    const model = buildCalendarPresentation(state, NOW);
    expect(model.eventsByDay['2026-09-01']).toBeUndefined();
    expect(model.eventsByDay['2026-09-05']?.length).toBe(1);
  });
});

it('reconciles every visible dated amount with the canonical timeline, including capped debt minimums', () => {
  const state = calendarFixture();
  state.debts = [
    {
      id: 'zero',
      name: 'Interest-free card',
      kind: 'card',
      balance: 50,
      apr: 0,
      minPayment: 40,
      dueDom: 12,
      minimumDueDate: '2026-09-12',
      addedAt: '2026-09-09',
    },
  ];
  state.pots = [{ id: 'pot', name: 'Emergency', saved: 20, goal: 100, perWeek: 0, accent: false }];
  const model = buildCalendarPresentation(state, NOW);
  let previous = model.plan.currentBalanceMinor;
  for (const point of model.plan.timeline.filter((row) => row.date <= model.end)) {
    const sum = model.events
      .filter((event) => (event.date < model.today ? model.today : event.date) === point.date)
      .reduce((total, event) => total + Math.round((event.amount ?? 0) * 100), 0);
    expect(sum, point.date).toBe(point.netChangeMinor);
    expect(previous + sum).toBe(point.closingMinor);
    previous = point.closingMinor;
  }
  expect(model.eventsByDay['2026-10-12']).toContainEqual(
    expect.objectContaining({ title: 'Interest-free card · minimum payment', amount: -10 }),
  );
});

it('keeps later Month and direct Full day dates in the canonical horizon and agrees with the route adapter', () => {
  const state = calendarFixture();
  const model = buildCalendarPresentation(state, NOW);
  expect(model.eventsByDay['2026-11-12']).toContainEqual(
    expect.objectContaining({ title: 'Rent + bills', amount: -950 }),
  );
  const route = routeFromStore(state, NOW);
  for (const point of route.points) expect(model.spareByDay[point.date]).toBe(point.y);
});
it('reserves overdue money exactly once on today while displaying its original due date', () => {
  const state = calendarFixture();
  state.subOverrides = { 'Rent + bills': -6 };
  const model = buildCalendarPresentation(state, NOW);
  const rentEvents = model.plan.events.filter(
    (event) => event.id === 'subscription:Rent + bills:2026-09-12',
  );
  expect(rentEvents).toHaveLength(1);
  expect(rentEvents[0]).toMatchObject({
    date: '2026-09-09',
    originalDate: '2026-09-06',
    amountMinor: -95000,
  });
  expect(model.events.filter((event) => event.id === rentEvents[0]!.id)).toHaveLength(1);
  expect(
    model.plan.pendingObligations.filter((event) =>
      event.id.startsWith('subscription:Rent + bills:'),
    ),
  ).toHaveLength(2);
  // The next month's nudged charge also falls before 9 October; it is a distinct obligation.
  expect(model.plan.safeToSpendMinor).toBe(-60000);
});

it('carries the canonical closing balance across days without a money event', () => {
  const state = calendarFixture();
  state.modeExtras = { ...state.modeExtras, reset: 0 };
  const model = buildCalendarPresentation(state, NOW);
  const route = routeFromStore(state, NOW);
  for (const point of route.points) expect(model.spareByDay[point.date]).toBe(point.y);
  expect(model.spareByDay['2026-09-10']).toBe(1800);
  expect(model.spareByDay['2026-09-13']).toBe(850);
});
