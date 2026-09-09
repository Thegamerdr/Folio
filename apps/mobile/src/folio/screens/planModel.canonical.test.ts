import { describe, expect, it } from 'vitest';
import { getState, type AppState } from '../store';
import { buildFinancialPlanFromState } from '../lib/financialPlan';
import { buildCanonicalPlanUpcoming } from './planModel';

function fixture(): AppState {
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
    incomeSources: [],
    transactions: [],
    calendarEvents: [],
    pots: [],
    debts: [],
    subs: [
      {
        name: 'Rent and bills',
        cost: 950,
        nextRenewalISO: '2026-10-12',
        obligationAnchorISO: '2026-09-12',
        nextRenewalDaysAway: 14,
        lastUsedDaysAgo: 0,
        usesPerMonth: 0,
      },
    ],
    subPaused: {},
    subOverrides: {},
    whatIfHolds: [],
    spendHold: null,
    bufferAmount: 200,
    modeExtras: { ...(base.modeExtras ?? {}), reset: 70 },
  };
}

describe('canonical Plan pending list', () => {
  it('shows overdue September rent and October rent on payday with the same £600 shortfall', () => {
    const plan = buildFinancialPlanFromState(fixture(), {
      now: new Date('2026-09-28T12:00:00Z'),
    });
    const rows = buildCanonicalPlanUpcoming(plan);
    expect(plan.nextIncomeDate).toBe('2026-10-28');
    expect(plan.safeToSpendMinor).toBe(-60_000);
    expect(rows.map(({ date, amount, note }) => ({ date, amount, note }))).toEqual([
      { date: '2026-09-12', amount: 950, note: 'overdue · still unpaid' },
      { date: '2026-10-12', amount: 950, note: 'spoken for' },
    ]);
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(1900);
    expect(rows.reduce((sum, row) => sum + row.amount * 100, 0)).toBe(
      plan.protectedBeforeIncomeMinor - plan.livingCostMinor,
    );
  });

  it('retains overdue rent before payday without pulling the next cycle into that window', () => {
    const plan = buildFinancialPlanFromState(fixture(), {
      now: new Date('2026-09-19T12:00:00Z'),
    });
    expect(plan.nextIncomeDate).toBe('2026-09-28');
    expect(buildCanonicalPlanUpcoming(plan).map((row) => [row.date, row.amount])).toEqual([
      ['2026-09-12', 950],
    ]);
  });

  it('shows only outstanding partial amounts and excludes settled or boundary-day bills', () => {
    const base = fixture();
    const state: AppState = {
      ...base,
      subs: [
        {
          ...base.subs[0]!,
          obligationOccurrences: {
            '2026-09-12': { status: 'partial', paidMinor: 30_000 },
            '2026-10-12': { status: 'paid' },
          },
        },
      ],
      calendarEvents: [
        { id: 'boundary', kind: 'out', title: 'Boundary bill', date: '2026-10-28', amount: -100 },
        {
          id: 'cancelled',
          kind: 'out',
          title: 'Cancelled bill',
          date: '2026-09-10',
          amount: -80,
          obligationStatus: 'cancelled',
        },
      ],
    };
    const rows = buildCanonicalPlanUpcoming(
      buildFinancialPlanFromState(state, { now: new Date('2026-09-28T12:00:00Z') }),
    );
    expect(rows.map((row) => [row.name, row.date, row.amount])).toEqual([
      ['Rent and bills', '2026-09-12', 650],
    ]);
  });

  it('keeps all pending cycles before irregular income beyond the old 35-day calendar', () => {
    const base = fixture();
    const plan = buildFinancialPlanFromState(
      {
        ...base,
        onboarding: { ...base.onboarding, monthlyIncome: 0, payday: 0 },
        calendarEvents: [
          { id: 'client', kind: 'in', title: 'Client', date: '2026-11-17', amount: 1800 },
        ],
      },
      { now: new Date('2026-09-28T12:00:00Z') },
    );
    expect(plan.nextIncomeDate).toBe('2026-11-17');
    expect(buildCanonicalPlanUpcoming(plan).map((row) => row.date)).toEqual([
      '2026-09-12',
      '2026-10-12',
      '2026-11-12',
    ]);
  });

  it('uses the engine-capped overdue debt minimum exactly once and preserves its original due day', () => {
    const plan = buildFinancialPlanFromState(
      {
        ...fixture(),
        subs: [],
        debts: [
          {
            id: 'card',
            name: 'Card',
            kind: 'card',
            balance: 50,
            minPayment: 80,
            apr: 0,
            dueDom: 12,
            minimumDueDate: '2026-09-12',
            addedAt: '2026-09-09T12:00:00Z',
          },
        ],
      },
      { now: new Date('2026-09-28T12:00:00Z') },
    );
    expect(plan.debtMinimumMinor).toBe(5000);
    expect(buildCanonicalPlanUpcoming(plan)).toEqual([
      {
        id: 'debt-minimum:card:2026-09-12',
        date: '2026-09-12',
        name: 'Card minimum payment',
        amount: 50,
        note: 'overdue · still unpaid',
      },
    ]);
  });
});
