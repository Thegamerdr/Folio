import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addTransaction,
  applyMeloTool,
  editTransaction,
  getPersistBlob,
  getState,
  hydrateFromBlob,
  removeTransaction,
  resetToEmpty,
  setPartial,
} from './store';
import { buildFinancialPlanFromState } from './lib/financialPlan';
import { createCanonicalAppStateProjection } from './lib/canonicalStateProjection';
import { readCanonicalAppStateMoneyProjection } from './lib/canonicalAppStateReadProjection';

const NOW = new Date('2026-09-09T12:00:00Z');

function fixtureB() {
  resetToEmpty();
  const base = getState();
  setPartial({
    currentBalance: {
      amount: 1800,
      source: 'user-entered',
      confidence: 'corrected',
      setAt: NOW.toISOString(),
    },
    accounts: [
      {
        id: 'acct-main',
        name: 'Main',
        kind: 'bank',
        isLiability: false,
        balanceMinor: 1800,
        balanceAsOfISO: NOW.toISOString(),
        addedAt: NOW.toISOString(),
      },
    ],
    onboarding: { ...base.onboarding, monthlyIncome: 1800, payday: 28, done: true },
    incomeSources: [],
    transactions: [],
    subs: [],
    pots: [],
    calendarEvents: [
      { id: 'rent', date: '2026-09-12', kind: 'out', title: 'Rent and bills', amount: -950 },
    ],
    debts: [
      {
        id: 'card',
        name: 'Card',
        kind: 'card',
        balance: 320,
        apr: 0,
        minPayment: 80,
        dueDom: 18,
        addedAt: NOW.toISOString(),
      },
    ],
    bufferAmount: 200,
    modeExtras: { ...base.modeExtras, reset: 70 },
  });
}

function balances() {
  return {
    cash: getState().currentBalance.amount,
    debt: getState().debts?.[0]?.balance,
    safe: buildFinancialPlanFromState(getState(), { now: NOW }).safeToSpendMinor / 100,
  };
}
function pay(amount: number) {
  const result = applyMeloTool('log_debt_payment', { debtId: 'card', amount });
  expect(result.applied).toBe(true);
  return { result, txn: getState().transactions[0]! };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  fixtureB();
});
afterEach(() => vi.useRealTimers());

describe('debt payment canonical ledger corrections', () => {
  it('closes the exact £40 to £100 Fixture B reproduction and matches direct £100', () => {
    const { txn } = pay(40);
    expect(balances()).toEqual({ cash: 1760, debt: 280, safe: 340 });
    editTransaction(txn.id, { amount: -100 }, 'user');
    expect(balances()).toEqual({ cash: 1700, debt: 220, safe: 280 });
    fixtureB();
    pay(100);
    expect(balances()).toEqual({ cash: 1700, debt: 220, safe: 280 });
  });
  it('reverses the edited amount once on delete and restores the same posting on undo', () => {
    const { txn } = pay(40);
    editTransaction(txn.id, { amount: -100 }, 'user');
    const edited = getState().transactions[0]!;
    removeTransaction(txn.id);
    removeTransaction(txn.id);
    expect(balances()).toEqual({ cash: 1800, debt: 320, safe: 380 });
    addTransaction(edited);
    addTransaction(edited);
    expect(balances()).toEqual({ cash: 1700, debt: 220, safe: 280 });
    expect(getState().transactions).toHaveLength(1);
  });
  it('supports repeated increases, decreases, edit undo and no-op edits with pence precision', () => {
    const { txn } = pay(40);
    for (const amount of [100, 25.37, 80, 40]) {
      editTransaction(txn.id, { amount: -amount }, 'user');
      expect(getState().currentBalance.amount).toBe(1800 - amount);
      expect(getState().debts?.[0]?.balance).toBe(320 - amount);
    }
    const edits = getState().edits?.length;
    editTransaction(txn.id, { amount: -40 }, 'user');
    expect(getState().edits).toHaveLength(edits!);
    expect(balances()).toEqual({ cash: 1760, debt: 280, safe: 340 });
  });
  it('moves the linked debt and liability effects atomically, including undo', () => {
    const card = getState().debts![0]!;
    setPartial({
      accounts: [
        ...getState().accounts!,
        {
          id: 'liability',
          name: 'Linked card',
          kind: 'credit-card',
          isLiability: true,
          balanceMinor: 500,
          balanceAsOfISO: NOW.toISOString(),
          addedAt: NOW.toISOString(),
        },
      ],
      debts: [
        card,
        {
          ...card,
          id: 'other-card',
          name: 'Linked card',
          balance: 500,
          linkedAccountId: 'liability',
        },
      ],
    });
    const { txn } = pay(40);
    editTransaction(txn.id, { amount: -100, debtId: 'other-card' }, 'user');
    expect(getState().debts?.map((debt) => debt.balance)).toEqual([320, 400]);
    expect(getState().accounts?.map((account) => account.balanceMinor)).toEqual([1700, 400]);
    editTransaction(txn.id, { amount: -40, debtId: 'card' }, 'user');
    expect(getState().debts?.map((debt) => debt.balance)).toEqual([280, 500]);
    expect(getState().accounts?.map((account) => account.balanceMinor)).toEqual([1760, 500]);
    removeTransaction(txn.id);
    expect(getState().debts?.map((debt) => debt.balance)).toEqual([320, 500]);
  });
  it('tracks capped principal separately from cash so overpayment edit and delete are reversible', () => {
    const { txn } = pay(400);
    expect(getState().currentBalance.amount).toBe(1400);
    expect(getState().debts?.[0]?.balance).toBe(0);
    expect(getState().transactions[0]?.financialAction).toMatchObject({
      principalAppliedMinor: 32000,
    });
    editTransaction(txn.id, { amount: -100 }, 'user');
    expect(balances()).toEqual({ cash: 1700, debt: 220, safe: 280 });
    removeTransaction(txn.id);
    expect(balances()).toEqual({ cash: 1800, debt: 320, safe: 380 });
  });
  it('does not lose unrelated cash entries when reversing a completed payment', () => {
    const { result } = pay(40);
    addTransaction(
      { merchant: 'Food', amount: -10, source: 'manual', category: 'food' },
      { updateCurrentBalance: true },
    );
    if (result.applied) expect(result.undo()).toBe(true);
    expect(balances()).toEqual({ cash: 1790, debt: 320, safe: 370 });
    if (result.applied) expect(result.undo()).toBe(false);
    expect(getState().transactions).toHaveLength(1);
  });
  it('rejects invalid replacement amounts and unavailable debt without any partial money writes', () => {
    const { txn } = pay(40);
    for (const patch of [
      { amount: 100 },
      { amount: 0 },
      { amount: NaN },
      { amount: -10.001 },
      { debtId: 'missing' },
    ]) {
      const before = getPersistBlob();
      expect(() => editTransaction(txn.id, patch, 'user')).toThrow();
      expect(getPersistBlob()).toBe(before);
    }
  });
  it('persists the exact effects through native blob hydration and canonical SQLite projection', () => {
    const { txn } = pay(40);
    editTransaction(txn.id, { amount: -100 }, 'user');
    const blob = getPersistBlob();
    fixtureB();
    hydrateFromBlob(blob);
    expect(balances()).toEqual({ cash: 1700, debt: 220, safe: 280 });
    const state = getState();
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId)!;
    const canonical = createCanonicalAppStateProjection(state, workspace, NOW.toISOString());
    const read = readCanonicalAppStateMoneyProjection(
      canonical.repositorySnapshot,
      String(workspace.id),
    );
    expect(read.transactions[0]?.financialAction).toEqual(state.transactions[0]?.financialAction);
    setPartial({ transactions: read.transactions });
    editTransaction(txn.id, { amount: -50 }, 'user');
    expect(balances()).toEqual({ cash: 1750, debt: 270, safe: 330 });
    removeTransaction(txn.id);
    expect(balances()).toEqual({ cash: 1800, debt: 320, safe: 380 });
  });
  it('is idempotent for retried creation identifiers and protects an edited payment from stale creation undo', () => {
    const input = { debtId: 'card', amount: 40, transactionId: 'payment-command-1' };
    const result = applyMeloTool('log_debt_payment', input);
    expect(applyMeloTool('log_debt_payment', input).applied).toBe(true);
    expect(getState().transactions).toHaveLength(1);
    expect(balances()).toEqual({ cash: 1760, debt: 280, safe: 340 });
    editTransaction('payment-command-1', { amount: -100 }, 'user');
    if (result.applied) expect(result.undo()).toBe(false);
    expect(balances()).toEqual({ cash: 1700, debt: 220, safe: 280 });
  });
  it('does not infer reversible effects from pre-fix merchant labels or mutate unsafe legacy payments', () => {
    const legacy = {
      id: 'melo-debt-payment-old',
      when: NOW.toISOString(),
      merchant: 'Debt payment: Card',
      amount: -40,
      category: 'bills' as const,
      source: 'melo' as const,
    };
    setPartial({ transactions: [legacy] });
    const before = getPersistBlob();
    expect(() => editTransaction(legacy.id, { amount: -100 }, 'user')).toThrow(
      'no saved debt effects',
    );
    expect(() => removeTransaction(legacy.id)).toThrow('no saved debt effects');
    expect(getPersistBlob()).toBe(before);
  });
  it('preserves later balance adjustments on metadata edits and replays exact capped effects on deletion undo', () => {
    const { txn } = pay(400);
    setPartial({ debts: getState().debts!.map((debt) => ({ ...debt, balance: 20 })) });
    editTransaction(
      txn.id,
      { merchant: 'Card payoff correction', note: 'Receipt checked' },
      'user',
    );
    expect(getState().debts?.[0]?.balance).toBe(20);
    const edited = getState().transactions[0]!;
    removeTransaction(txn.id);
    expect(getState().debts?.[0]?.balance).toBe(340);
    addTransaction(edited);
    expect(getState().debts?.[0]?.balance).toBe(20);
    expect(getState().currentBalance.amount).toBe(1400);
  });
  it('retains later manual debt increases when reducing an earlier overpayment amount', () => {
    const { txn } = pay(400);
    setPartial({ debts: getState().debts!.map((debt) => ({ ...debt, balance: 20 })) });
    editTransaction(txn.id, { amount: -350 }, 'user');
    expect(getState().debts?.[0]?.balance).toBe(20);
    expect(getState().currentBalance.amount).toBe(1450);
    removeTransaction(txn.id);
    expect(getState().debts?.[0]?.balance).toBe(340);
  });
  it('replays later capped principal when editing an earlier payment and then deleting the later one', () => {
    const first = pay(40).txn;
    const second = pay(300).txn;
    editTransaction(first.id, { amount: -100 }, 'user');
    expect(getState().debts?.[0]?.balance).toBe(0);
    expect(getState().currentBalance.amount).toBe(1400);
    expect(
      getState().transactions.find((row) => row.id === second.id)?.financialAction,
    ).toMatchObject({ principalAppliedMinor: 22000, principalAvailableMinor: 22000 });
    removeTransaction(second.id);
    expect(balances()).toEqual({ cash: 1700, debt: 220, safe: 280 });
    removeTransaction(first.id);
    expect(balances()).toEqual({ cash: 1800, debt: 320, safe: 380 });
  });
  it('replays downstream caps on deletion and undo without duplicating cash movements', () => {
    const first = pay(40).txn;
    const second = pay(300).txn;
    removeTransaction(first.id);
    expect(getState().debts?.[0]?.balance).toBe(20);
    expect(getState().currentBalance.amount).toBe(1500);
    addTransaction(first);
    expect(getState().debts?.[0]?.balance).toBe(0);
    expect(getState().currentBalance.amount).toBe(1460);
    removeTransaction(second.id);
    expect(balances()).toEqual({ cash: 1760, debt: 280, safe: 340 });
  });
  it('retains monotonic posting order after deletion, restart, another payment and restoration', () => {
    pay(40);
    const second = pay(100).txn;
    removeTransaction(second.id);
    hydrateFromBlob(getPersistBlob());
    const third = pay(200).txn;
    addTransaction(second);
    expect(getState().debts?.[0]?.balance).toBe(0);
    expect(getState().currentBalance.amount).toBe(1460);
    removeTransaction(third.id);
    expect(getState().debts?.[0]?.balance).toBe(180);
    expect(getState().currentBalance.amount).toBe(1660);
  });
});
