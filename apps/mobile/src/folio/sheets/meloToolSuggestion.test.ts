import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMeloTool, getPersistBlob, getState, resetToEmpty, setPartial } from '../store';
import { buildFinancialPlanFromState } from '../lib/financialPlan';

import {
  MELO_TOOL_APPROVAL_DENIED,
  MELO_TOOL_APPROVAL_REQUESTED,
  MELO_TOOL_OUTPUT_AVAILABLE,
  MELO_TOOL_UNDONE,
  decideMeloToolSuggestion,
  describeMeloToolSuggestion,
  getMeloToolSuggestionPhase,
  settleMeloToolApplication,
  settleMeloToolUndo,
  prepareMeloDebtPaymentReview,
  isMeloDebtPaymentReviewCurrent,
} from './meloToolSuggestion';

describe('Melo tool suggestion approval gate', () => {
  const pending = { state: MELO_TOOL_APPROVAL_REQUESTED };

  it('keeps a new suggestion pending until the user decides', () => {
    expect(getMeloToolSuggestionPhase(pending)).toBe('pending');
  });

  it('allows only Confirm to request a real store application', () => {
    expect(decideMeloToolSuggestion(pending, 'confirm')).toEqual({ type: 'apply' });
  });

  it('settles Dismiss without issuing an apply command', () => {
    expect(decideMeloToolSuggestion(pending, 'dismiss')).toEqual({
      type: 'settle',
      settlement: { state: MELO_TOOL_APPROVAL_DENIED },
    });
  });

  it.each([
    {
      label: 'already applied',
      suggestion: {
        state: MELO_TOOL_OUTPUT_AVAILABLE,
        output: { ok: true, message: 'Logged £12.00 at Market' },
      },
    },
    {
      label: 'failed',
      suggestion: {
        state: MELO_TOOL_OUTPUT_AVAILABLE,
        output: { ok: false, message: 'bad args' },
      },
    },
    { label: 'dismissed', suggestion: { state: MELO_TOOL_APPROVAL_DENIED } },
    { label: 'malformed legacy part', suggestion: { state: MELO_TOOL_OUTPUT_AVAILABLE } },
  ])('never reapplies an $label suggestion', ({ suggestion }) => {
    expect(decideMeloToolSuggestion(suggestion, 'confirm')).toEqual({ type: 'ignore' });
    expect(decideMeloToolSuggestion(suggestion, 'dismiss')).toEqual({ type: 'ignore' });
  });

  it('retains the real result returned after confirmation', () => {
    const success = settleMeloToolApplication(true, 'Logged £12.00 at Market');
    const failure = settleMeloToolApplication(false, 'bad args');

    expect(success).toEqual({
      state: MELO_TOOL_OUTPUT_AVAILABLE,
      output: { ok: true, message: 'Logged £12.00 at Market' },
    });
    expect(getMeloToolSuggestionPhase(success)).toBe('applied');
    expect(getMeloToolSuggestionPhase(failure)).toBe('failed');
  });

  it('settles an undone action as a truthful, non-applied transcript state', () => {
    const undone = settleMeloToolUndo();
    expect(undone).toEqual({
      state: MELO_TOOL_UNDONE,
      output: { ok: true, message: 'Undone. Nothing changed.' },
    });
    expect(getMeloToolSuggestionPhase(undone)).toBe('undone');
  });

  it('describes the exact proposed mutation before confirmation', () => {
    expect(describeMeloToolSuggestion('log_spend', { amount: 3.5, merchant: 'Greggs' })).toBe(
      'Log £3.50 spent at Greggs.',
    );
    expect(
      describeMeloToolSuggestion('log_transfer', {
        amount: 100,
        from: 'Current',
        to: 'Savings',
      }),
    ).toBe('Log a £100.00 transfer from Current to Savings.');
  });
});

describe('Melo debt payment review', () => {
  const at = '2026-09-09T12:00:00.000Z';
  const now = new Date(at);
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
          name: 'Evidence card',
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

  function review(amount = 100, extra: Record<string, unknown> = {}) {
    const result = prepareMeloDebtPaymentReview(
      getState(),
      { amount, debtName: 'Evidence card', ...extra },
      at,
      'chat-payment-test',
    );
    if (result.kind !== 'ready') throw new Error(result.message);
    return result;
  }

  it('shows canonical before/after rows without writing and matches the exact committed £1,700 / £220 / £280 fixture', () => {
    const blob = getPersistBlob();
    const prepared = review();
    expect(getPersistBlob()).toBe(blob);
    expect(prepared.rows.map((row) => [row.before, row.after])).toEqual([
      [1800, 1700],
      [320, 220],
      [380, 280],
    ]);
    expect(prepared.input).toMatchObject({
      debtId: 'card',
      cashAccountId: 'main',
      transactionId: 'chat-payment-test',
      amount: 100,
    });
    expect(isMeloDebtPaymentReviewCurrent(getState(), prepared, at)).toBe(true);
    const posted = applyMeloTool('log_debt_payment', prepared.input);
    expect(posted.applied).toBe(true);
    expect([
      getState().currentBalance.amount,
      getState().debts![0]!.balance,
      buildFinancialPlanFromState(getState(), { now }).safeToSpendMinor / 100,
    ]).toEqual(prepared.rows.map((row) => row.after));
    expect(isMeloDebtPaymentReviewCurrent(getState(), prepared, at)).toBe(false);
    expect(getState().transactions.filter((row) => row.id === 'chat-payment-test')).toHaveLength(1);
    if (posted.applied) expect(posted.undo()).toBe(true);
    expect(getState().currentBalance.amount).toBe(1800);
    expect(getState().debts![0]!.balance).toBe(320);
  });

  it('shows the full cash deduction and the selected debt cap for an overpayment, not an estimate from total debt', () => {
    setPartial({
      debts: [
        ...getState().debts!,
        { ...getState().debts![0]!, id: 'other', name: 'Other card', balance: 1000, minPayment: 0 },
      ],
    });
    const prepared = review(400, {
      preview: { beforeTotalDebtMinor: 999999, afterTotalDebtMinor: 123 },
    });
    expect(prepared.principalReduction).toBe(320);
    expect(prepared.excess).toBe(80);
    expect(prepared.rows.slice(0, 2).map((row) => row.after)).toEqual([1400, 0]);
    expect(prepared.explanation).toContain('tracked cash by £400.00 and debt by £320.00');
    expect(prepared.explanation).toContain('£80.00 above the remaining debt');
    expect(applyMeloTool('log_debt_payment', prepared.input).applied).toBe(true);
    expect(getState().debts!.find((debt) => debt.id === 'other')!.balance).toBe(1000);
    expect(buildFinancialPlanFromState(getState(), { now }).safeToSpendMinor / 100).toBe(
      prepared.rows[2]!.after,
    );
  });

  it('rejects stale balance, reserve, account, debt and payday-day reviews', () => {
    const prepared = review();
    const original = getState();
    const mutations = [
      { currentBalance: { ...original.currentBalance, amount: 1799 } },
      { bufferAmount: 201 },
      { accounts: original.accounts!.map((account) => ({ ...account, name: 'Renamed account' })) },
      { debts: original.debts!.map((debt) => ({ ...debt, balance: 319 })) },
      { activeWorkspaceId: 'different-workspace' as typeof original.activeWorkspaceId },
    ];
    for (const mutation of mutations) {
      expect(isMeloDebtPaymentReviewCurrent({ ...original, ...mutation }, prepared, at)).toBe(
        false,
      );
    }
    expect(isMeloDebtPaymentReviewCurrent(original, prepared, '2026-09-10T12:00:00.000Z')).toBe(
      false,
    );
  });

  it('rejects ambiguous cash/debt selection, invalid precision, zero amounts and existing transaction IDs', () => {
    for (const amount of [0, -1, 1.111, NaN]) {
      expect(
        prepareMeloDebtPaymentReview(getState(), { amount, debtName: 'Evidence card' }, at, 'test')
          .kind,
      ).toBe('unavailable');
    }
    const state = getState();
    const ambiguous = {
      ...state,
      accounts: [...state.accounts!, { ...state.accounts![0]!, id: 'savings', name: 'Savings' }],
    };
    expect(
      prepareMeloDebtPaymentReview(ambiguous, { amount: 40, debtName: 'Evidence card' }, at, 'test')
        .kind,
    ).toBe('unavailable');
    expect(
      prepareMeloDebtPaymentReview(
        ambiguous,
        { amount: 40, debtName: 'Evidence card', cashAccountId: 'savings' },
        at,
        'test',
      ).kind,
    ).toBe('ready');
    expect(
      prepareMeloDebtPaymentReview(
        { ...state, debts: [...state.debts!, { ...state.debts![0]!, id: 'duplicate' }] },
        { amount: 40, debtName: 'Evidence card' },
        at,
        'test',
      ).kind,
    ).toBe('unavailable');
    const prepared = review();
    applyMeloTool('log_debt_payment', prepared.input);
    expect(
      prepareMeloDebtPaymentReview(getState(), prepared.input, at, 'chat-payment-test').kind,
    ).toBe('unavailable');
  });

  it('never presents the legacy approximate payment preview as a confirmed consequence', () => {
    const description = describeMeloToolSuggestion('log_debt_payment', {
      amount: 40,
      debtName: 'Evidence card',
      preview: { availableNowMinor: -132500, afterTotalDebtMinor: 28000 },
    });
    expect(description).toContain('Review the cash and debt changes');
    expect(description).not.toContain('1,325');
    expect(description).not.toContain('280');
  });
});
