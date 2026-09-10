import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_ACCOUNT_ID,
  addCalendarEvent,
  addTransaction,
  applyMeloTool,
  getState,
  removeSub,
  resetToEmpty,
  setCurrentBalance,
  setPartial,
  updateDebt,
} from './store';
import { createCanonicalAppStateProjection } from './lib/canonicalStateProjection';
import { buildFinancialPlanFromState } from './lib/financialPlan';
import { buildMeloLocalCalculation } from './lib/meloCalculations';
import { PERSONAL_WORKSPACE_ID } from './lib/workspaceRoot';
import { parseLocalFinanceProposal } from '../local/financeProposal';
import { buildLocalMeloTurn } from '../local/localMeloTurn';

const AS_OF = '2026-09-09T12:00:00.000Z';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(AS_OF));
  resetToEmpty();
  setPartial({
    onboarding: { done: true, name: 'Release fixture', payday: 28, monthlyIncome: 1_800 },
    currentBalance: {
      amount: 1_800,
      source: 'user-entered',
      confidence: 'rough',
      setAt: AS_OF,
    },
    accounts: [
      {
        id: DEFAULT_ACCOUNT_ID,
        name: 'Main',
        kind: 'bank',
        isLiability: false,
        balanceMinor: 1_800,
        balanceAsOfISO: AS_OF,
        addedAt: AS_OF,
      },
    ],
    debts: [
      {
        id: 'klarna',
        name: 'Klarna',
        kind: 'bnpl',
        balance: 320,
        apr: 0,
        minPayment: 80,
        dueDom: 18,
        addedAt: AS_OF,
      },
    ],
    subs: [
      {
        name: 'Rent',
        cost: 950,
        nextRenewalDaysAway: 3,
        nextRenewalISO: '2026-09-12',
        lastUsedDaysAgo: 0,
        usesPerMonth: 0,
      },
    ],
    modeExtras: { reset: 70 },
    bufferAmount: 200,
    tightPointGoal: 380,
    transactions: [],
  });
});

afterEach(() => vi.useRealTimers());

const DEBT_REVIEW_SNAPSHOT = {
  currency: 'GBP' as const,
  availableNowMinor: 38_000,
  tightestDay: '12 Sep 2026',
  tightestBalanceMinor: 38_000,
  protectedItems: ['rent and bills'],
  pendingReviewCount: 0,
  nextPaydayLabel: '28 Sep 2026',
  hasMoneyPicture: true,
  debtCount: 1,
  totalDebtMinor: 32_000,
  monthlyDebtMinimumMinor: 8_000,
};

function personalWorkspace() {
  const workspace = getState().workspaces.find(
    (candidate) => candidate.id === PERSONAL_WORKSPACE_ID,
  );
  if (workspace === undefined) throw new Error('Personal workspace fixture is missing.');
  return workspace;
}

function projection() {
  return createCanonicalAppStateProjection(getState(), personalWorkspace(), AS_OF).mobileSnapshot;
}

function safeMinor(): number {
  // AppState's legacy Account.balanceMinor is pounds-valued; use the scalar path here so this
  // matrix exercises the adapter's pounds → engine-pence conversion without duplicating account
  // projection semantics.
  return buildFinancialPlanFromState(
    { ...getState(), accounts: [] },
    { now: new Date(AS_OF), horizonDays: 35 },
  ).safeToSpendMinor;
}

describe('Melo release behavior matrix (fixed 2026-09-09 fixture)', () => {
  it('corrects a lower actual receipt and projects the changed confirmed transaction', () => {
    addTransaction({
      id: 'salary',
      merchant: 'Salary',
      amount: 1_800,
      category: 'income',
      source: 'manual',
    });
    const result = applyMeloTool('correct_income', { transactionId: 'salary', amount: 1_427 });
    expect(result.applied).toBe(true);
    expect(getState().transactions.find((row) => row.id === 'salary')?.amount).toBe(1_427);
    expect(projection().transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceTransactionId: 'salary',
          amount: { currency: 'GBP', minorUnits: 142_700 },
        }),
      ]),
    );
    setCurrentBalance({ amount: 1_427, source: 'corrected', confidence: 'corrected' });
    expect(safeMinor()).toBe(700);
  });

  it('corrects a higher actual receipt without changing forecast-only income state', () => {
    addTransaction({
      id: 'bonus',
      merchant: 'Salary',
      amount: 1_800,
      category: 'income',
      source: 'manual',
    });
    expect(applyMeloTool('correct_income', { transactionId: 'bonus', amount: 1_950 }).applied).toBe(
      true,
    );
    expect(getState().transactions.find((row) => row.id === 'bonus')?.amount).toBe(1_950);
    expect(getState().onboarding.monthlyIncome).toBe(1_800);
    setCurrentBalance({ amount: 1_950, source: 'corrected', confidence: 'corrected' });
    expect(safeMinor()).toBe(53_000);
  });

  it('rejects a forecast-only income correction when no received record exists', () => {
    const before = structuredClone(getState());
    const result = applyMeloTool('correct_income', { amount: 1_427 });
    expect(result).toMatchObject({ applied: false });
    expect(getState().transactions).toEqual(before.transactions);
    expect(getState().onboarding).toEqual(before.onboarding);
  });

  it('saves a new dated bill and exposes it through the canonical adapter', () => {
    const result = applyMeloTool('set_commitment', {
      name: 'Internet',
      amount: 35,
      dueDate: '2026-09-20',
    });
    expect(result.applied).toBe(true);
    expect(getState().subs.find((sub) => sub.name === 'Internet')).toMatchObject({
      cost: 35,
      nextRenewalISO: '2026-09-20',
    });
    expect(projection().validation).toEqual({ valid: true, issues: [] });
    expect(safeMinor()).toBe(34_500);
  });

  it('rejects an undated new bill instead of guessing its due date', () => {
    const before = structuredClone(getState());
    expect(applyMeloTool('set_commitment', { name: 'Council tax', amount: 150 })).toMatchObject({
      applied: false,
    });
    expect(getState().subs).toEqual(before.subs);
  });

  it('cancels an existing bill through the store and removes its projected subscription', () => {
    removeSub('Rent');
    expect(getState().subs.some((sub) => sub.name === 'Rent')).toBe(false);
    expect(safeMinor()).toBe(133_000);
  });

  it('preserves unknown APR and promotion expiry as explicit debt metadata', () => {
    updateDebt('klarna', { apr: 0, aprKnown: false, promoUntil: '2026-12-31' });
    expect(getState().debts?.[0]).toMatchObject({
      apr: 0,
      aprKnown: false,
      promoUntil: '2026-12-31',
    });
  });

  it('persists arrears and minimum-payment corrections', () => {
    updateDebt('klarna', { arrears: true, minPayment: 95 });
    expect(getState().debts?.[0]).toMatchObject({ arrears: true, minPayment: 95 });
    expect(safeMinor()).toBe(36_500);
  });

  it('handles zero, upward and downward buffer changes with pence preserved', () => {
    expect(applyMeloTool('set_buffer_amount', { amount: 0 }).applied).toBe(true);
    expect(getState().bufferAmount).toBe(0);
    expect(safeMinor()).toBe(58_000);
    expect(applyMeloTool('set_buffer_amount', { amount: 200.5 }).applied).toBe(true);
    expect(getState().bufferAmount).toBe(200.5);
    expect(safeMinor()).toBe(37_950);
    expect(applyMeloTool('set_buffer_amount', { amount: 80.25 }).applied).toBe(true);
    expect(getState().bufferAmount).toBe(80.25);
    expect(safeMinor()).toBe(49_975);
  });

  it('records a completed debt payment as cash outflow and restores it with undo', () => {
    const result = applyMeloTool('log_debt_payment', { debtName: 'Klarna', amount: 400 });
    expect(result.applied).toBe(true);
    expect(getState().debts?.[0]?.balance).toBe(0);
    expect(getState().accounts?.[0]?.balanceMinor).toBe(1_400);
    expect(getState().transactions[0]).toMatchObject({
      amount: -400,
      accountId: DEFAULT_ACCOUNT_ID,
    });
    expect(projection().transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amount: { currency: 'GBP', minorUnits: -40_000 } }),
      ]),
    );
    expect(safeMinor()).toBe(6_000);
    if (result.applied) expect(result.undo()).toBe(true);
    expect(getState().debts?.[0]?.balance).toBe(320);
    expect(getState().accounts?.[0]?.balanceMinor).toBe(1_800);
    expect(getState().transactions).toHaveLength(0);
    expect(safeMinor()).toBe(38_000);
  });

  it('preserves real refund pairing without inventing a second cash event', () => {
    addTransaction({
      id: 'purchase',
      merchant: 'Shop',
      amount: -20,
      category: 'shopping',
      source: 'manual',
    });
    addTransaction({
      id: 'refund',
      merchant: 'Shop',
      amount: 20,
      category: 'income',
      source: 'manual',
    });
    const result = applyMeloTool('log_refund', {
      incomingTransactionId: 'refund',
      originalTransactionId: 'purchase',
    });
    expect(result.applied).toBe(true);
    expect(getState().transactions).toHaveLength(2);
    expect(
      getState().transactions.find((row) => row.id === 'refund')?.financialAction,
    ).toMatchObject({ kind: 'refund', originalTransactionId: 'purchase' });
    expect(safeMinor()).toBe(38_000);
  });

  it('keeps a balance-only debt closure distinct from a completed payment', () => {
    const result = applyMeloTool('set_debt_balance', { debtName: 'Klarna', balance: 0 });
    expect(result.applied).toBe(true);
    expect(getState().debts?.[0]?.balance).toBe(0);
    expect(getState().accounts?.[0]?.balanceMinor).toBe(1_800);
    expect(getState().transactions).toHaveLength(0);
    expect(safeMinor()).toBe(46_000);
  });

  it('applies a positive manual debt balance correction through the proposal and store', () => {
    const proposal = parseLocalFinanceProposal('Update Klarna debt balance to £250');
    expect(proposal).toMatchObject({
      name: 'set_debt_balance',
      args: { debtName: 'Klarna', balance: 250 },
    });
    if (proposal === null) throw new Error('Expected a debt balance proposal.');
    const result = applyMeloTool(proposal.name, proposal.args);
    expect(result.applied).toBe(true);
    expect(getState().debts?.find((debt) => debt.id === 'klarna')).toMatchObject({ balance: 250 });
    expect(getState().accounts?.[0]?.balanceMinor).toBe(1_800);
    expect(safeMinor()).toBe(38_000);
  });

  it('leaves a rejected debt recommendation untouched, then applies the user-edited payment', () => {
    const before = structuredClone({
      debts: getState().debts,
      accounts: getState().accounts,
      transactions: getState().transactions,
    });
    const calculate = (request: Parameters<typeof buildMeloLocalCalculation>[0]['request']) =>
      buildMeloLocalCalculation({
        state: getState(),
        snapshot: DEBT_REVIEW_SNAPSHOT,
        request,
        now: new Date(AS_OF),
      });
    const recommendation = buildLocalMeloTurn({
      prompt: 'Can I overpay £20 using highest-rate-first?',
      snapshot: DEBT_REVIEW_SNAPSHOT,
      tone: 'calm',
      calculate,
    });
    expect(recommendation.reply).toContain('neutral scenario, not advice');
    const rejected = buildLocalMeloTurn({
      prompt: 'Never mind',
      snapshot: DEBT_REVIEW_SNAPSHOT,
      tone: 'calm',
      context: recommendation.context,
      calculate,
    });
    expect(rejected.control).toBe('cancel');
    expect(getState()).toMatchObject(before);
    expect(safeMinor()).toBe(38_000);

    const proposed = buildLocalMeloTurn({
      prompt: 'I paid £40 off Klarna',
      snapshot: DEBT_REVIEW_SNAPSHOT,
      tone: 'calm',
    });
    const suggestion = proposed.suggestions[0];
    expect(suggestion).toMatchObject({ name: 'log_debt_payment', args: { amount: 40 } });
    if (suggestion === undefined) throw new Error('Expected a payment proposal.');
    const edited = applyMeloTool(suggestion.name, { ...suggestion.args, amount: 25 });
    expect(edited.applied).toBe(true);
    expect(getState().debts?.find((debt) => debt.id === 'klarna')?.balance).toBe(295);
    expect(getState().transactions[0]).toMatchObject({ amount: -25 });
    expect(safeMinor()).toBe(35_500);
  });

  it('recalculates Safe Zone after each balance, buffer and bill mutation', () => {
    // Account.balanceMinor is a pounds-valued legacy field in AppState; keeping this adapter check
    // on the scalar path makes the pence conversion at the finance-engine boundary explicit.
    setPartial({ accounts: [] });
    const now = new Date(AS_OF);
    const safe = () =>
      buildFinancialPlanFromState(getState(), { now, horizonDays: 35 }).safeToSpendMinor;
    expect(safe()).toBe(38_000);

    setCurrentBalance({ amount: 1_600, source: 'corrected', confidence: 'corrected' });
    expect(safe()).toBe(18_000);
    expect(applyMeloTool('set_buffer_amount', { amount: 0 }).applied).toBe(true);
    expect(safe()).toBe(38_000);
    expect(applyMeloTool('set_commitment', { name: 'Rent', amount: 1_050 }).applied).toBe(true);
    expect(safe()).toBe(28_000);
  });

  it('keeps a planned extra payment out of writes while accepting a completed event', () => {
    expect(parseLocalFinanceProposal('I want to pay £400')).toBeNull();
    expect(parseLocalFinanceProposal('I paid £400 off Klarna')?.name).toBe('log_debt_payment');
    expect(getState().debts?.[0]?.balance).toBe(320);
  });

  it('rejects a stale debt proposal after the live state changes', () => {
    const stale = applyMeloTool('log_debt_payment', {
      debtName: 'Klarna',
      amount: 40,
      preview: { beforeTotalDebtMinor: 32_000 },
    });
    expect(stale.applied).toBe(true);
    if (stale.applied) stale.undo();
    const currentDebt = getState().debts?.[0];
    if (currentDebt === undefined) throw new Error('Debt fixture is missing.');
    setPartial({ debts: [{ ...currentDebt, balance: 300 }] });
    const rejected = applyMeloTool('log_debt_payment', {
      debtName: 'Klarna',
      amount: 40,
      preview: { beforeTotalDebtMinor: 32_000 },
    });
    expect(rejected).toMatchObject({ applied: false });
    expect(getState().debts?.[0]?.balance).toBe(300);
  });

  it('rejects an ambiguous debt name without changing either row', () => {
    const debt = getState().debts?.[0];
    if (debt === undefined) throw new Error('Debt fixture is missing.');
    setPartial({ debts: [debt, { ...debt, id: 'klarna-2', name: 'Klarna card' }] });
    const before = structuredClone(getState().debts);
    expect(applyMeloTool('set_debt_balance', { debtName: 'Klar', balance: 0 })).toMatchObject({
      applied: false,
    });
    expect(getState().debts).toEqual(before);
  });

  it('stores total essentials in the weekly engine unit when a monthly amount is supplied', () => {
    expect(
      applyMeloTool('set_living_cost', { category: 'food', amount: 100, cadence: 'monthly' })
        .applied,
    ).toBe(true);
    expect(getState().modeExtras?.reset).toBe(23.08);
  });

  it('shows deterministic current and after debt figures before confirmation', () => {
    const turn = parseLocalFinanceProposal('I paid £400 off Klarna');
    expect(turn).toMatchObject({
      name: 'log_debt_payment',
      args: { amount: 400, debtName: 'Klarna' },
    });
    const before = getState().debts?.[0]?.balance;
    expect(before).toBe(320);
    expect(
      applyMeloTool('log_debt_payment', {
        ...(turn?.args ?? {}),
        preview: { beforeTotalDebtMinor: 32_000, afterTotalDebtMinor: 0 },
      }).applied,
    ).toBe(true);
  });

  it('keeps one-off calendar commitments separate from recurring subscriptions', () => {
    addCalendarEvent({ date: '2026-09-18', kind: 'out', title: 'One-off repair', amount: -80 });
    expect(projection().validation).toEqual({ valid: true, issues: [] });
    expect(getState().calendarEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'One-off repair', date: '2026-09-18' }),
      ]),
    );
    expect(getState().subs.some((sub) => sub.name === 'One-off repair')).toBe(false);
  });
});
