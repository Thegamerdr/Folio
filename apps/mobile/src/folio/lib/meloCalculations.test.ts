import { beforeEach, describe, expect, it } from 'vitest';
import type { MeloLocalFinancialSnapshot } from '@folio/ai-contracts';

import { getState, resetAll, setPartial } from '../store';
import { buildMeloLocalCalculation } from './meloCalculations';

const NOW = new Date('2026-07-15T12:00:00');
const snapshot: MeloLocalFinancialSnapshot = {
  currency: 'GBP',
  availableNowMinor: 50000,
  tightestDay: 'Friday, 17 Jul',
  tightestBalanceMinor: 30000,
  protectedItems: ['confirmed commitments'],
  pendingReviewCount: 0,
  nextPaydayLabel: 'Friday, 31 Jul',
  hasMoneyPicture: true,
};

beforeEach(() => resetAll());

describe('buildMeloLocalCalculation', () => {
  it('projects recorded debt minimums without exposing debt rows or names', () => {
    setPartial({
      currentBalance: {
        amount: 500,
        source: 'user-entered',
        confidence: 'rough',
        setAt: NOW.toISOString(),
      },
      debts: [
        {
          id: 'private-card-id',
          name: 'Private card name',
          kind: 'card',
          balance: 1000,
          apr: 24,
          minPayment: 50,
          dueDom: 20,
          addedAt: NOW.toISOString(),
        },
        {
          id: 'private-bnpl-id',
          name: 'Private BNPL name',
          kind: 'bnpl',
          balance: 300,
          apr: 0,
          minPayment: 100,
          dueDom: 25,
          addedAt: NOW.toISOString(),
        },
      ],
    });

    const calculation = buildMeloLocalCalculation({
      state: getState(),
      snapshot,
      now: NOW,
      request: { intent: 'review_debts', prompt: 'Review my debts', detectedAmountMinor: null },
    });

    expect(calculation).toMatchObject({
      kind: 'debt-projection',
      strategy: 'contractual-minimums',
      debtCount: 2,
      stalled: false,
    });
    expect(JSON.stringify(calculation)).not.toMatch(/private|card-id|bnpl-id/i);
  });

  it('requires a neutral debt order before modelling an extra, then uses the selected rule', () => {
    setPartial({
      currentBalance: {
        amount: 500,
        source: 'user-entered',
        confidence: 'rough',
        setAt: NOW.toISOString(),
      },
      debts: [
        {
          id: 'card',
          name: 'Card',
          kind: 'card',
          balance: 1000,
          apr: 24,
          minPayment: 50,
          dueDom: 20,
          addedAt: NOW.toISOString(),
        },
        {
          id: 'loan',
          name: 'Loan',
          kind: 'loan',
          balance: 600,
          apr: 8,
          minPayment: 40,
          dueDom: 25,
          addedAt: NOW.toISOString(),
        },
      ],
    });

    const needsStrategy = buildMeloLocalCalculation({
      state: getState(),
      snapshot,
      now: NOW,
      request: {
        intent: 'review_debts',
        prompt: 'Can I overpay 20 on my debts?',
        detectedAmountMinor: 2000,
      },
    });
    expect(needsStrategy).toEqual({
      kind: 'debt-strategy-required',
      extraMonthlyMinor: 2000,
      safeZoneAfterExtraMinor: 48000,
    });

    const selected = buildMeloLocalCalculation({
      state: getState(),
      snapshot,
      now: NOW,
      request: {
        intent: 'review_debts',
        prompt: 'Add 20 extra using highest-rate-first for my debts',
        detectedAmountMinor: 2000,
      },
    });
    expect(selected).toMatchObject({
      kind: 'debt-projection',
      strategy: 'highest-rate-first',
      extraMonthlyMinor: 2000,
      safeZoneAfterExtraMinor: 48000,
      stalled: false,
    });
  });

  it('models dated-plan pace and a hypothetical contribution without moving money', () => {
    setPartial({
      currentBalance: {
        amount: 500,
        source: 'user-entered',
        confidence: 'rough',
        setAt: NOW.toISOString(),
      },
      plans: [
        {
          id: 'private-plan-id',
          name: 'Private plan name',
          target: 1200,
          saved: 400,
          byDate: '2026-10-15',
          perWeek: 40,
          addedAt: NOW.toISOString(),
        },
      ],
    });

    const calculation = buildMeloLocalCalculation({
      state: getState(),
      snapshot,
      now: NOW,
      request: {
        intent: 'review_goals',
        prompt: 'What if I add 100 to my savings goal?',
        detectedAmountMinor: 10000,
      },
    });

    expect(calculation).toMatchObject({
      kind: 'goal-projection',
      datedPlanCount: 1,
      remainingMinor: 80000,
      contributionMinor: 10000,
      remainingAfterContributionMinor: 70000,
      safeZoneAfterContributionMinor: 40000,
    });
    expect(JSON.stringify(calculation)).not.toMatch(/private|plan-id/i);
    expect(getState().plans?.[0]?.saved).toBe(400);
  });

  it('returns a visibly uncertain low/base/high range only after three observed months', () => {
    setPartial({
      currentBalance: {
        amount: 500,
        source: 'user-entered',
        confidence: 'rough',
        setAt: NOW.toISOString(),
      },
      transactions: [
        {
          id: 'income-1',
          when: '2026-03-20T12:00:00.000Z',
          merchant: 'Private client A',
          amount: 1800,
          category: 'income',
          source: 'manual',
        },
        {
          id: 'income-2',
          when: '2026-04-20T12:00:00.000Z',
          merchant: 'Private client B',
          amount: 2400,
          category: 'income',
          source: 'manual',
        },
        {
          id: 'income-3',
          when: '2026-05-20T12:00:00.000Z',
          merchant: 'Private client C',
          amount: 1200,
          category: 'income',
          source: 'manual',
        },
        {
          id: 'income-4',
          when: '2026-06-20T12:00:00.000Z',
          merchant: 'Private client D',
          amount: 3000,
          category: 'income',
          source: 'manual',
        },
      ],
    });

    const calculation = buildMeloLocalCalculation({
      state: getState(),
      snapshot,
      now: NOW,
      request: {
        intent: 'review_irregular_income',
        prompt: 'Show my irregular income range',
        detectedAmountMinor: null,
      },
    });

    expect(calculation).toMatchObject({
      kind: 'irregular-income-range',
      monthsObserved: 4,
      sufficientHistory: true,
    });
    if (calculation?.kind !== 'irregular-income-range') throw new Error('Expected range');
    expect(calculation.lowMonthMinor).toBeLessThan(calculation.baseMonthMinor!);
    expect(calculation.baseMonthMinor).toBeLessThan(calculation.highMonthMinor!);
    expect(JSON.stringify(calculation)).not.toMatch(/client|income-1/i);
  });

  it('returns only an aggregate position for an explicitly selected local account', () => {
    setPartial({
      currentBalance: {
        amount: 500,
        source: 'user-entered',
        confidence: 'rough',
        setAt: NOW.toISOString(),
      },
      accounts: [
        {
          id: 'private-account-id',
          name: 'Private account name',
          kind: 'savings',
          isLiability: false,
          balanceMinor: 325.5,
          balanceAsOfISO: NOW.toISOString(),
          addedAt: NOW.toISOString(),
        },
      ],
    });

    const calculation = buildMeloLocalCalculation({
      state: getState(),
      snapshot,
      now: NOW,
      request: {
        intent: 'review_accounts',
        prompt: 'Use my savings account',
        detectedAmountMinor: null,
        selectedAccountId: 'private-account-id',
      },
    });

    expect(calculation).toEqual({
      kind: 'account-position',
      accountKind: 'savings',
      balanceMinor: 32_550,
      isLiability: false,
      balanceAsOfLabel: '15 Jul 2026',
    });
    expect(JSON.stringify(calculation)).not.toMatch(/private|account-id/i);
  });

  it('explains a selected account balance without exposing its local name or identifier', () => {
    setPartial({
      currentBalance: {
        amount: 500,
        source: 'user-entered',
        confidence: 'rough',
        setAt: NOW.toISOString(),
      },
      accounts: [
        {
          id: 'private-account-id',
          name: 'Private account name',
          kind: 'savings',
          isLiability: false,
          balanceMinor: 325.5,
          balanceAsOfISO: NOW.toISOString(),
          addedAt: NOW.toISOString(),
        },
      ],
    });

    const calculation = buildMeloLocalCalculation({
      state: getState(),
      snapshot,
      now: NOW,
      request: {
        intent: 'review_accounts',
        prompt: 'Explain the selected account balance',
        detectedAmountMinor: null,
        selectedAccountId: 'private-account-id',
      },
    });

    expect(calculation).toEqual({
      kind: 'source-explanation',
      values: [{ label: 'selected account balance', amountMinor: 32_550 }],
      sourceKinds: ['current balance setting'],
      confirmedRecordCount: 1,
      excludedReviewCount: 0,
    });
    expect(JSON.stringify(calculation)).not.toMatch(/private|account-id|account name/i);
  });

  it('explains displayed Safe Zone figures with aggregate source kinds only', () => {
    setPartial({
      currentBalance: {
        amount: 500,
        source: 'user-entered',
        confidence: 'rough',
        setAt: NOW.toISOString(),
      },
      transactions: [
        {
          id: 'private-transaction-id',
          when: '2026-07-10T12:00:00.000Z',
          merchant: 'Private merchant name',
          amount: -20,
          category: 'food',
          source: 'manual',
        },
      ],
    });

    const calculation = buildMeloLocalCalculation({
      state: getState(),
      snapshot,
      now: NOW,
      request: {
        intent: 'explain_position',
        prompt: 'Show the source figures',
        detectedAmountMinor: null,
      },
    });

    expect(calculation).toMatchObject({
      kind: 'source-explanation',
      values: [
        { label: 'available now', amountMinor: 50_000 },
        { label: 'tightest balance', amountMinor: 30_000 },
      ],
      excludedReviewCount: 0,
    });
    expect(JSON.stringify(calculation)).not.toMatch(/private|merchant|transaction-id/i);
  });

  it('counts import duplicate and missing-date proposals without exposing queued rows', () => {
    setPartial({
      currentBalance: {
        amount: 500,
        source: 'user-entered',
        confidence: 'rough',
        setAt: NOW.toISOString(),
      },
      transactions: [
        {
          id: 'private-posted-id',
          when: '2026-07-10T12:00:00.000Z',
          merchant: 'Private posted merchant',
          amount: -12,
          category: 'food',
          source: 'manual',
        },
      ],
      reviewQueue: [
        {
          id: 'private-review-match',
          source: 'pdf',
          merchant: 'PRIVATE POSTED MERCHANT',
          amount: -12,
          date: '2026-07-11',
          addedAt: NOW.toISOString(),
          category: 'food',
          rememberedCategory: true,
        },
        {
          id: 'private-review-no-date',
          source: 'image',
          merchant: 'Private unknown date',
          amount: -5,
          addedAt: NOW.toISOString(),
        },
      ],
      reviewQueueSpillover: [],
    });

    const calculation = buildMeloLocalCalculation({
      state: getState(),
      snapshot: { ...snapshot, pendingReviewCount: 2 },
      now: NOW,
      request: {
        intent: 'review_import',
        prompt: 'Explain my import review',
        detectedAmountMinor: null,
      },
    });

    expect(calculation).toEqual({
      kind: 'import-review-summary',
      pendingCount: 2,
      possibleDuplicateCount: 1,
      changedAmountCount: 0,
      relationshipCount: 0,
      rememberedCategoryCount: 1,
      missingDateCount: 1,
    });
    expect(JSON.stringify(calculation)).not.toMatch(/private|merchant|posted-id|review-match/i);
  });

  it('builds the recorded monthly BNPL schedule without exposing agreement names', () => {
    setPartial({
      currentBalance: {
        amount: 500,
        source: 'user-entered',
        confidence: 'rough',
        setAt: NOW.toISOString(),
      },
      debts: [
        {
          id: 'private-bnpl-id',
          name: 'Private BNPL agreement',
          kind: 'bnpl',
          balance: 320,
          apr: 0,
          minPayment: 80,
          dueDom: 20,
          addedAt: NOW.toISOString(),
        },
      ],
    });

    const calculation = buildMeloLocalCalculation({
      state: getState(),
      snapshot,
      now: NOW,
      request: {
        intent: 'review_debts',
        prompt: 'Show my BNPL schedule',
        detectedAmountMinor: null,
      },
    });

    expect(calculation).toEqual({
      kind: 'bnpl-schedule',
      bnplCount: 1,
      scheduledPaymentCount: 4,
      nextPaymentDateLabel: '20 Jul 2026',
      nextPaymentTotalMinor: 8_000,
      finalPaymentDateLabel: '20 Oct 2026',
      totalRemainingMinor: 32_000,
      totalInterestMinor: 0,
      stalledCount: 0,
    });
    expect(JSON.stringify(calculation)).not.toMatch(/private|bnpl-id|agreement/i);
  });

  it('compares real recovery moves against the same route used by RecoveryScreen', () => {
    setPartial({
      onboarding: { done: true, name: '', payday: 31, monthlyIncome: 0 },
      currentBalance: {
        amount: -100,
        source: 'user-entered',
        confidence: 'rough',
        setAt: NOW.toISOString(),
      },
      accounts: [
        {
          id: 'recovery-current',
          name: 'Private recovery account',
          kind: 'bank',
          isLiability: false,
          balanceMinor: -100,
          balanceAsOfISO: NOW.toISOString(),
          addedAt: NOW.toISOString(),
        },
      ],
      subs: [
        {
          name: 'Private recurring name',
          cost: 80,
          nextRenewalDaysAway: 2,
          lastUsedDaysAgo: 0,
          usesPerMonth: 1,
        },
      ],
      subPaused: {},
      transactions: [
        {
          id: 'private-recovery-spend',
          merchant: 'Private recovery merchant',
          amount: -300,
          when: '2026-07-10T12:00:00.000Z',
          category: 'shopping',
          source: 'manual',
        },
      ],
    });

    const calculation = buildMeloLocalCalculation({
      state: getState(),
      snapshot,
      now: NOW,
      request: {
        intent: 'plan_recovery',
        prompt: 'Preview my recovery route',
        detectedAmountMinor: null,
      },
    });

    expect(calculation).toMatchObject({
      kind: 'recovery-preview',
      hasShortfall: true,
      options: expect.arrayContaining([
        expect.objectContaining({ kind: 'move-bill' }),
        expect.objectContaining({ kind: 'pause-recurring' }),
        expect.objectContaining({ kind: 'hold-discretionary', liftMinor: 3_000 }),
      ]),
    });
    expect(JSON.stringify(calculation)).not.toMatch(/private|merchant|recurring name/i);
  });

  it('refuses deterministic calculations for a workspace that does not own the data partition', () => {
    expect(() =>
      buildMeloLocalCalculation({
        state: getState(),
        snapshot,
        now: NOW,
        workspaceId: 'workspace_business_injected',
        request: {
          intent: 'explain_position',
          prompt: 'Where did that come from?',
          detectedAmountMinor: null,
        },
      }),
    ).toThrow(/unavailable/);
  });
});
