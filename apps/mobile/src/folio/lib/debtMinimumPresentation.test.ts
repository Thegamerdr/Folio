import { describe, expect, it } from 'vitest';
import { getState, type AppState, type Debt } from '../store';
import { buildFinancialPlanFromState } from './financialPlan';
import { selectDebtMinimumPresentation } from './debtMinimumPresentation';

const now = new Date('2026-09-10T12:00:00Z');
const debt: Debt = {
  id: 'card',
  name: 'Evidence card',
  kind: 'card',
  balance: 320,
  apr: 0,
  minPayment: 80,
  dueDom: 6,
  minimumDueDate: '2026-09-06',
  addedAt: '2026-09-01',
};
function planFor(debts: Debt[]) {
  const base = getState();
  const state: AppState = {
    ...base,
    currentBalance: {
      amount: 1800,
      source: 'user-entered',
      confidence: 'corrected',
      setAt: now.toISOString(),
    },
    accounts: [],
    debts,
    transactions: [],
    subs: [],
    pots: [],
    calendarEvents: [],
    incomeSources: [],
    subPaused: {},
    subOverrides: {},
    whatIfHolds: [],
    spendHold: null,
    onboarding: { ...base.onboarding, done: true, monthlyIncome: 1800, payday: 28 },
    modeExtras: { reset: 70 },
    bufferAmount: 200,
  };
  return buildFinancialPlanFromState(state, { now });
}

describe('canonical next debt minimum presentation', () => {
  it('keeps the original overdue date instead of wrapping a past due day to next month', () => {
    const plan = planFor([debt]);
    const result = selectDebtMinimumPresentation(plan);
    expect(result).toMatchObject({
      date: '2026-09-06',
      amountMinor: 8000,
      overdue: true,
      dueLabel: 'Overdue 6 Sept 2026',
    });
    expect(result?.amountMinor).toBe(plan.pendingObligations[0]?.amountMinor);
  });
  it('shows only the unpaid remainder after a partially confirmed minimum', () => {
    const plan = planFor([
      { ...debt, minimumOccurrences: { '2026-09-06': { status: 'partial', paidMinor: 3000 } } },
    ]);
    expect(selectDebtMinimumPresentation(plan, 'card')).toMatchObject({
      amountMinor: 5000,
      amountLabel: '£50 remaining',
      overdue: true,
    });
    expect(debt.minPayment).toBe(80);
  });
  it('advances a paid occurrence to the next canonical minimum even beyond the next payday', () => {
    const plan = planFor([{ ...debt, minimumOccurrences: { '2026-09-06': { status: 'paid' } } }]);
    expect(plan.nextIncomeDate).toBe('2026-09-28');
    expect(plan.pendingObligations.filter((row) => row.source === 'debt-minimum')).toHaveLength(0);
    expect(selectDebtMinimumPresentation(plan, 'card')).toMatchObject({
      date: '2026-10-06',
      amountMinor: 8000,
      overdue: false,
      dueLabel: 'Due 6 Oct 2026',
    });
  });
  it('shows the engine-capped final principal rather than the contractual monthly minimum', () => {
    expect(selectDebtMinimumPresentation(planFor([{ ...debt, balance: 20.45 }]))).toMatchObject({
      amountMinor: 2045,
      amountLabel: '£20.45 remaining',
    });
  });
  it('makes today explicit with the same full date shown in Calendar', () => {
    const plan = planFor([{ ...debt, dueDom: 10, minimumDueDate: '2026-09-10' }]);
    expect(selectDebtMinimumPresentation(plan)?.dueLabel).toBe('Due today · 10 Sept 2026');
  });
  it('selects the earliest unresolved portfolio occurrence and can select a named debt independently', () => {
    const plan = planFor([
      debt,
      { ...debt, id: 'loan', name: 'Small loan', dueDom: 3, minimumDueDate: '2026-09-03' },
    ]);
    expect(selectDebtMinimumPresentation(plan)?.label).toBe('Small loan minimum payment');
    expect(selectDebtMinimumPresentation(plan, 'card')?.label).toBe(
      'Evidence card minimum payment',
    );
  });
  it('does not invent a payment for cleared debt, zero minimums, a missing debt or an unavailable plan', () => {
    expect(selectDebtMinimumPresentation(planFor([{ ...debt, balance: 0 }]))).toBeNull();
    expect(selectDebtMinimumPresentation(planFor([{ ...debt, minPayment: 0 }]))).toBeNull();
    expect(selectDebtMinimumPresentation(planFor([debt]), 'missing')).toBeNull();
    expect(selectDebtMinimumPresentation(null)).toBeNull();
  });
  it('does not confuse a debt with an identifier that shares its prefix', () => {
    const plan = planFor([{ ...debt, id: 'card:imported' }]);
    expect(selectDebtMinimumPresentation(plan, 'card')).toBeNull();
    expect(selectDebtMinimumPresentation(plan, 'card:imported')?.amountMinor).toBe(8000);
  });
});
