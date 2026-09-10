import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getState,
  getPersistBlob,
  resetToEmpty,
  setPartial,
  logDebtPayment,
  editTransaction,
  removeTransaction,
  addTransaction,
} from '../store';
import { isDebtPayment, type DebtPaymentTransaction } from './debtPaymentLedger';
import { previewDebtPaymentChange } from './paymentPresentation';
import { buildFinancialPlanFromState } from './financialPlan';

const now = new Date('2026-09-09T12:00:00Z');
const at = now.toISOString();
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  resetToEmpty();
  const base = getState();
  setPartial({
    currentBalance: { amount: 1800, source: 'user-entered', confidence: 'corrected', setAt: at },
    accounts: [
      {
        id: 'main',
        name: 'Main',
        kind: 'bank',
        isLiability: false,
        balanceMinor: 1800,
        balanceAsOfISO: at,
        addedAt: at,
      },
    ],
    onboarding: {
      ...base.onboarding,
      monthlyIncome: 1800,
      payday: 28,
      done: true,
      financialSetupConfirmed: true,
    },
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
        addedAt: at,
      },
    ],
    bufferAmount: 200,
    modeExtras: { reset: 70 },
  });
});
afterEach(() => vi.useRealTimers());
function request(amount: number): DebtPaymentTransaction {
  return {
    id: 'preview',
    when: at,
    merchant: 'Debt payment: Card',
    amount: -amount,
    category: 'bills',
    source: 'manual',
    accountId: 'main',
    financialAction: { kind: 'debt-payment', debtId: 'card', principalAppliedMinor: 0 },
  };
}
function assertPreviewMatchesCommit(preview: ReturnType<typeof previewDebtPaymentChange>) {
  expect(preview.afterPlan).toEqual(buildFinancialPlanFromState(getState(), { now }));
  expect(preview.rows.map((row) => row.after)).toEqual([
    getState().currentBalance.amount,
    getState().debts![0]!.balance,
    preview.afterPlan.safeToSpendMinor / 100,
  ]);
}
describe('payment consequence previews use canonical transitions without writing', () => {
  it('allows metadata-only correction after account closure and debt tracking removal without moving money', () => {
    logDebtPayment('card', 40, 'main');
    const before = getState().transactions[0]!;
    if (!isDebtPayment(before)) throw new Error('missing payment');
    setPartial({
      accounts: getState().accounts!.map((account) => ({ ...account, closed: true })),
      debts: [],
    });
    const blob = getPersistBlob();
    const preview = previewDebtPaymentChange(
      getState(),
      before,
      { ...before, merchant: 'Corrected description', when: '2026-09-08T12:00:00Z' },
      at,
    );
    expect(getPersistBlob()).toBe(blob);
    expect(preview.rows.every((row) => row.before === row.after)).toBe(true);
    editTransaction(
      before.id,
      { merchant: 'Corrected description', when: '2026-09-08T12:00:00Z' },
      'user',
    );
    expect(preview.afterPlan).toEqual(buildFinancialPlanFromState(getState(), { now }));
  });
  it('previews creation and the exact £1,700 cash / £220 debt / £280 safe correction', () => {
    const blob = getPersistBlob();
    const create = previewDebtPaymentChange(getState(), undefined, request(40), at);
    expect(getPersistBlob()).toBe(blob);
    logDebtPayment('card', 40, 'main');
    assertPreviewMatchesCommit(create);
    const before = getState().transactions[0]!;
    if (!isDebtPayment(before)) throw new Error('missing payment');
    const correction = previewDebtPaymentChange(
      getState(),
      before,
      { ...before, amount: -100 },
      at,
    );
    expect(correction.rows.map((row) => row.after)).toEqual([1700, 220, 280]);
    editTransaction(before.id, { amount: -100 }, 'user');
    assertPreviewMatchesCommit(correction);
  });
  it('previews removal and restores the identical payment with Undo', () => {
    logDebtPayment('card', 100, 'main');
    const before = getState().transactions[0]!;
    if (!isDebtPayment(before)) throw new Error('missing payment');
    const removal = previewDebtPaymentChange(getState(), before, undefined, at);
    expect(removal.rows.map((row) => row.after)).toEqual([1800, 320, 380]);
    removeTransaction(before.id);
    assertPreviewMatchesCommit(removal);
    addTransaction(before);
    expect([
      getState().currentBalance.amount,
      getState().debts![0]!.balance,
      buildFinancialPlanFromState(getState(), { now }).safeToSpendMinor / 100,
    ]).toEqual([1700, 220, 280]);
  });
  it('explains the full cash debit and capped principal for an overpayment', () => {
    const preview = previewDebtPaymentChange(getState(), undefined, request(400), at);
    expect(preview.rows.slice(0, 2).map((row) => row.after)).toEqual([1400, 0]);
    logDebtPayment('card', 400, 'main');
    assertPreviewMatchesCommit(preview);
  });
  it('rejects zero, invalid precision and unavailable linked debt without mutating', () => {
    const blob = getPersistBlob();
    for (const amount of [0, 1.111])
      expect(() => previewDebtPaymentChange(getState(), undefined, request(amount), at)).toThrow();
    expect(() =>
      previewDebtPaymentChange(
        getState(),
        undefined,
        {
          ...request(40),
          financialAction: { kind: 'debt-payment', debtId: 'missing', principalAppliedMinor: 0 },
        },
        at,
      ),
    ).toThrow();
    expect(getPersistBlob()).toBe(blob);
  });
});
