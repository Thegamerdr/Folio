import { describe, expect, it } from 'vitest';
import { getState, type AppState } from '../store';
import { transitionDebtPayment, type DebtPaymentTransaction } from './debtPaymentLedger';

const AT = '2026-09-09T12:00:00Z';

function harness() {
  const base = getState();
  let state: AppState = {
    ...base,
    transactions: [],
    accounts: [
      {
        id: 'cash',
        kind: 'bank',
        name: 'Cash',
        isLiability: false,
        balanceMinor: 1800,
        balanceAsOfISO: AT,
        addedAt: AT,
      },
    ],
    currentBalance: { amount: 1800, source: 'user-entered', confidence: 'corrected', setAt: AT },
    debts: [
      {
        id: 'card',
        name: 'Card',
        kind: 'card',
        balance: 320,
        minPayment: 80,
        apr: 0,
        dueDom: 18,
        addedAt: AT,
      },
    ],
  };
  const amounts = new Map<string, number>();
  const saved = new Map<string, DebtPaymentTransaction>();
  function verify() {
    const total = [...amounts.values()].reduce((sum, value) => sum + value, 0);
    expect(state.currentBalance.amount).toBe(1800 - total);
    expect(state.debts?.[0]?.balance).toBe(Math.max(0, 320 - total));
    expect(state.transactions).toHaveLength(amounts.size);
    expect(state.transactions.reduce((sum, row) => sum - row.amount, 0)).toBe(total);
  }
  function transition(
    before: DebtPaymentTransaction | undefined,
    after: DebtPaymentTransaction | undefined,
    restore = false,
  ) {
    state = { ...state, ...transitionDebtPayment(state, before, after, AT, restore).patch };
    verify();
  }
  function row(id: string): DebtPaymentTransaction {
    return state.transactions.find((item) => item.id === id) as DebtPaymentTransaction;
  }
  return {
    create(id: string, amount: number) {
      amounts.set(id, amount);
      transition(undefined, {
        id,
        when: AT,
        merchant: 'Debt payment',
        amount: -amount,
        category: 'bills',
        source: 'melo',
        accountId: 'cash',
        financialAction: { kind: 'debt-payment', debtId: 'card', principalAppliedMinor: 0 },
      });
    },
    edit(id: string, amount: number) {
      amounts.set(id, amount);
      transition(row(id), { ...row(id), amount: -amount });
    },
    remove(id: string) {
      saved.set(id, row(id));
      amounts.delete(id);
      transition(row(id), undefined);
    },
    restore(id: string) {
      const value = saved.get(id)!;
      amounts.set(id, -value.amount);
      transition(undefined, value, true);
    },
  };
}

describe('independent debt payment conservation model', () => {
  it('matches cash and remaining principal through a chain of capped edits, deletes and restores', () => {
    const plan = harness();
    plan.create('first', 40);
    plan.create('second', 100);
    plan.create('third', 250);
    plan.edit('first', 80);
    plan.edit('second', 40);
    plan.remove('third');
    plan.restore('third');
    plan.edit('second', 350);
    plan.remove('first');
    plan.restore('first');
    plan.remove('second');
    plan.remove('third');
  });

  it('keeps deleted posting order distinct from a newly created payment when deletion is undone', () => {
    const plan = harness();
    plan.create('first', 40);
    plan.create('deleted', 100);
    plan.remove('deleted');
    plan.create('newer', 200);
    plan.restore('deleted');
    plan.edit('deleted', 150);
    plan.remove('newer');
  });
});
