import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addTransaction,
  getPersistBlob,
  getState,
  hydrateFromBlob,
  resetToEmpty,
  setPartial,
} from '../store';
import { buildFinancialPlanFromState } from '../lib/financialPlan';
import { selectFinancialPresentation } from '../lib/financialPresentation';
import { reviewHistoryPresentation } from './reviewHistoryPresentation';

const NOW = new Date('2026-09-10T12:00:00Z');
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  resetToEmpty();
});
afterEach(() => {
  resetToEmpty();
  vi.useRealTimers();
});

describe('reviewed history money receipt', () => {
  it('shows exact imported pennies and unchanged canonical cash after accept and restart', () => {
    setPartial({
      accounts: [],
      currentBalance: { ...getState().currentBalance, amount: 1500, provided: true },
    });
    const before = buildFinancialPlanFromState(getState(), { now: NOW });
    expect(reviewHistoryPresentation(before, 12.34, 'out')).toEqual({
      cash: '£1,500',
      entry: '£12.34 spend',
      detail: 'Adds £12.34 to your history. Tracked cash stays £1,500.',
    });
    addTransaction({ merchant: 'Groceries', amount: -12.34, category: 'food', source: 'manual' });
    expect(getState().transactions[0]?.amount).toBe(-12.34);
    expect(buildFinancialPlanFromState(getState(), { now: NOW }).currentBalanceMinor).toBe(150000);
    hydrateFromBlob(getPersistBlob());
    expect(buildFinancialPlanFromState(getState(), { now: NOW }).currentBalanceMinor).toBe(150000);
    expect(getState().transactions[0]?.amount).toBe(-12.34);
  });

  it('uses the canonical active cash-account sum and retains fractional cash rather than a legacy scalar', () => {
    const state = getState();
    const account = state.accounts![0]!;
    const plan = buildFinancialPlanFromState(
      {
        ...state,
        currentBalance: { ...state.currentBalance, amount: 9000 },
        accounts: [
          { ...account, id: 'main', balanceMinor: 1000.25 },
          { ...account, id: 'savings', balanceMinor: 487.41 },
          { ...account, id: 'closed', balanceMinor: 200, closed: true },
          { ...account, id: 'card', balanceMinor: 300, isLiability: true },
        ],
      },
      { now: NOW },
    );
    expect(reviewHistoryPresentation(plan, 12.34, 'in', true)).toEqual({
      cash: '£1,487.66',
      entry: '£12.34 income',
      detail: 'Adds £12.34 to Business activity. Tracked cash stays £1,487.66.',
    });
  });

  it('does not clamp negative cash or imply imported income clears an overdraft', () => {
    expect(reviewHistoryPresentation({ currentBalanceMinor: -1234 }, 100, 'in').cash).toBe(
      '−£12.34',
    );
    expect(reviewHistoryPresentation({ currentBalanceMinor: -1234 }, 100, 'in').detail).toBe(
      'Adds £100 to your history. Tracked cash stays −£12.34.',
    );
  });

  it('keeps a positive recorded cash balance conditional while an import is awaiting review', () => {
    const base = getState();
    const state = {
      ...base,
      accounts: [],
      currentBalance: { ...base.currentBalance, amount: 1500, provided: true },
      onboarding: {
        ...base.onboarding,
        monthlyIncome: 1800,
        payday: 20,
        financialSetupConfirmed: true,
      },
      reviewQueue: [
        {
          id: 'pending',
          source: 'paste' as const,
          merchant: 'Groceries',
          amount: -12.34,
          date: '2026-09-10',
          addedAt: NOW.toISOString(),
        },
      ],
    };
    const plan = buildFinancialPlanFromState(state, { now: NOW });
    expect(selectFinancialPresentation(state, plan)).toMatchObject({
      pendingReview: 1,
      canReassure: false,
      label: 'Some figures need your review',
    });
  });
});
