import { describe, expect, it } from 'vitest';

import {
  buildLocalMeloTurn,
  isExistingTransactionCorrectionRequest,
  parseLocalMoneySuggestion,
  type LocalMeloAccountSelector,
  type LocalMeloCalculationBuilder,
  type LocalMeloSubscriptionActionResolver,
} from './localMeloTurn';

const snapshot = {
  currency: 'GBP' as const,
  availableNowMinor: 14_200,
  tightestDay: 'Friday 17 Jul',
  tightestBalanceMinor: 8_100,
  protectedItems: ['active bills and subscriptions'],
  pendingReviewCount: 2,
  nextPaydayLabel: '2026-07-25',
  hasMoneyPicture: true,
  subscriptionCount: 3,
  activeSubscriptionMonthlyMinor: 4_299,
  monthlyIncomeMinor: 220_000,
  monthlyOutgoingsMinor: 168_000,
  activeRecurringCount: 3,
  debtCount: 2,
  totalDebtMinor: 480_000,
  monthlyDebtMinimumMinor: 18_000,
  goalCount: 2,
  goalSavedMinor: 75_000,
  goalTargetMinor: 300_000,
  upcomingCalendarCount: 5,
  nextCalendarDate: '2026-07-17',
  unseenChangeCount: 2,
  incomeSourceCount: 2,
  irregularIncomeMode: true,
};

describe('local Melo turn', () => {
  it('hands an existing-transaction correction to the exact-row editor before write parsing', () => {
    const result = buildLocalMeloTurn({
      prompt: 'Change Tesco from £12.50 to £10',
      snapshot,
      tone: 'calm',
    });

    expect(result.suggestions).toEqual([]);
    expect(result.intent).toBe('explain_changes');
    expect(result.reply).toContain('Choose the exact transaction in Timeline');
    expect(result.reply).toContain('Nothing has changed yet');
    expect(result.actions).toEqual([
      expect.objectContaining({
        kind: 'open_timeline',
        label: 'Choose transaction',
        requiresUserReview: true,
      }),
    ]);
    expect(JSON.stringify(result.context)).not.toContain('Tesco');
  });

  it('recognises explicit amount/date corrections but leaves dedicated record domains alone', () => {
    expect(isExistingTransactionCorrectionRequest('Correct the date on that transaction')).toBe(
      true,
    );
    expect(isExistingTransactionCorrectionRequest('Edit the amount for this payment')).toBe(true);
    expect(isExistingTransactionCorrectionRequest('Change my subscription from £10 to £12')).toBe(
      false,
    );
    expect(
      isExistingTransactionCorrectionRequest(
        'Change my debt strategy from highest rate to lowest balance',
      ),
    ).toBe(false);
  });

  it('keeps a genuinely completed spend on the existing confirmation-only proposal path', () => {
    const result = buildLocalMeloTurn({
      prompt: 'I spent £12.50 at Tesco',
      snapshot,
      tone: 'calm',
    });
    expect(result.suggestions).toHaveLength(1);
    expect(result.actions).toEqual([]);
  });

  it('routes a resolved subscription change to review without creating a chat write', () => {
    const resolveSubscriptionAction: LocalMeloSubscriptionActionResolver = () => ({
      state: 'review',
      reply:
        'Spotify is active at £10.99 a month. Pausing it would change your active recurring total from £26.98 to £15.99. Nothing has changed yet.',
      actionLabel: 'Review Spotify pause',
      actionDetail: 'Open Subscriptions to review the reversible pause.',
    });
    const result = buildLocalMeloTurn({
      prompt: 'Pause Spotify',
      snapshot,
      tone: 'calm',
      resolveSubscriptionAction,
      subscriptionState: { subs: [], subPaused: {} },
    });

    expect(result.suggestions).toEqual([]);
    expect(result.intent).toBe('review_subscriptions');
    expect(result.reply).toContain('£26.98 to £15.99');
    expect(result.actions).toEqual([
      expect.objectContaining({
        kind: 'open_subscriptions',
        label: 'Review Spotify pause',
        requiresUserReview: true,
      }),
    ]);
  });

  it('renders explicit subscription choices when the target is ambiguous', () => {
    const resolveSubscriptionAction: LocalMeloSubscriptionActionResolver = () => ({
      state: 'needs-selection',
      reply: 'Which subscription do you want to pause?',
      choices: [{ label: 'Pause Spotify' }, { label: 'Pause Spotify Family' }],
      canOpenSubscriptions: false,
    });
    const result = buildLocalMeloTurn({
      prompt: 'Pause Spotify',
      snapshot,
      tone: 'calm',
      resolveSubscriptionAction,
      subscriptionState: { subs: [], subPaused: {} },
    });

    expect(result.actions).toEqual([]);
    expect(result.followUpChips).toEqual(['Pause Spotify', 'Pause Spotify Family']);
    expect(result.context?.lastIntent).toBe('review_subscriptions');
  });

  it('answers purchase checks from local aggregate context', () => {
    const result = buildLocalMeloTurn({ prompt: 'Can I afford £40?', snapshot, tone: 'calm' });
    expect(result.reply).toContain('£40');
    expect(result.reply).toContain('£102');
    expect(result.suggestions).toEqual([]);
  });

  it('supports subscription and monthly-summary starter questions', () => {
    expect(
      buildLocalMeloTurn({ prompt: 'Review my subscriptions', snapshot, tone: 'calm' }).reply,
    ).toContain('3 active subscriptions');
    expect(
      buildLocalMeloTurn({ prompt: "How's the month going?", snapshot, tone: 'calm' }).reply,
    ).toContain('£2,200 coming in');
  });

  it('covers payday, debt, goal, calendar, changes, bills and irregular income locally', () => {
    expect(
      buildLocalMeloTurn({ prompt: 'When is my next payday?', snapshot, tone: 'calm' }).reply,
    ).toContain('2026-07-25');
    expect(
      buildLocalMeloTurn({ prompt: 'Review my debts', snapshot, tone: 'calm' }).reply,
    ).toContain('£4,800 outstanding');
    expect(
      buildLocalMeloTurn({ prompt: 'Review my savings goals', snapshot, tone: 'calm' }).reply,
    ).toContain('£750 saved toward £3,000');
    expect(
      buildLocalMeloTurn({ prompt: 'What is coming up?', snapshot, tone: 'calm' }).reply,
    ).toContain('5 confirmed money events');
    expect(buildLocalMeloTurn({ prompt: 'What changed?', snapshot, tone: 'calm' }).reply).toContain(
      '2 changes',
    );
    expect(
      buildLocalMeloTurn({ prompt: 'Review my recurring bills', snapshot, tone: 'calm' }).reply,
    ).toContain('3 active recurring payments');
    expect(
      buildLocalMeloTurn({ prompt: 'Review my irregular income', snapshot, tone: 'calm' }).reply,
    ).toContain('irregular-income route is active');
  });

  it('resolves a bounded amount follow-up from typed context without retaining a transcript', () => {
    const first = buildLocalMeloTurn({ prompt: 'Can I afford £40?', snapshot, tone: 'calm' });
    const followUp = buildLocalMeloTurn({
      prompt: 'what about £20?',
      snapshot,
      tone: 'calm',
      context: first.context,
    });

    expect(first.context).toEqual({ lastIntent: 'check_purchase', lastDetectedAmountMinor: 4_000 });
    expect(followUp.reply).toContain('£20');
    expect(followUp.reply).toContain('£122');
    expect(followUp.context).toEqual({
      lastIntent: 'check_purchase',
      lastDetectedAmountMinor: 2_000,
    });
    expect(Object.keys(followUp.context ?? {})).toEqual(['lastIntent', 'lastDetectedAmountMinor']);
  });

  it('keeps a debt overpayment amount in bounded context while the user selects the strategy', () => {
    const requests: Parameters<LocalMeloCalculationBuilder>[0][] = [];
    const calculate: LocalMeloCalculationBuilder = (request) => {
      requests.push(request);
      if (/highest-rate-first/i.test(request.prompt)) {
        return {
          kind: 'debt-projection',
          strategy: 'highest-rate-first',
          debtCount: 2,
          extraMonthlyMinor: request.detectedAmountMinor ?? 0,
          payoffMonths: 30,
          payoffDateLabel: '31 Jan 2029',
          totalInterestMinor: 48_000,
          monthsSavedVsMinimums: 8,
          interestSavedVsMinimumsMinor: 10_000,
          safeZoneAfterExtraMinor: 12_200,
          stalled: false,
        };
      }
      return {
        kind: 'debt-strategy-required',
        extraMonthlyMinor: request.detectedAmountMinor ?? 0,
        safeZoneAfterExtraMinor: 12_200,
      };
    };

    const first = buildLocalMeloTurn({
      prompt: 'Can I overpay 20 on my debts?',
      snapshot,
      tone: 'calm',
      calculate,
    });
    const selected = buildLocalMeloTurn({
      prompt: 'Use highest rate first',
      snapshot,
      tone: 'calm',
      context: first.context,
      calculate,
    });

    expect(first.context).toEqual({
      lastIntent: 'review_debts',
      lastDetectedAmountMinor: 2_000,
    });
    expect(first.followUpChips).toEqual(['Use highest rate first', 'Use lowest balance first']);
    expect(selected.reply).toContain('user-selected highest-rate-first rule');
    expect(requests).toHaveLength(2);
    expect(requests[0]).toEqual({
      intent: 'review_debts',
      prompt: 'Can I overpay 20 on my debts?',
      detectedAmountMinor: 2_000,
    });
    expect(requests[1]).toMatchObject({
      intent: 'review_debts',
      detectedAmountMinor: 2_000,
    });
    expect(Object.keys(first.context ?? {})).toEqual(['lastIntent', 'lastDetectedAmountMinor']);
  });

  it('replaces a bounded amount when the user corrects it', () => {
    const first = buildLocalMeloTurn({ prompt: 'Can I afford £40?', snapshot, tone: 'calm' });
    const corrected = buildLocalMeloTurn({
      prompt: 'Actually £30',
      snapshot,
      tone: 'calm',
      context: first.context,
    });

    expect(corrected.reply).toContain('£30');
    expect(corrected.reply).toContain('£112');
    expect(corrected.context).toEqual({
      lastIntent: 'check_purchase',
      lastDetectedAmountMinor: 3_000,
    });
  });

  it('asks which amount to use instead of guessing between two numbers', () => {
    const result = buildLocalMeloTurn({
      prompt: 'Can I spend £20 or £30?',
      snapshot,
      tone: 'calm',
    });

    expect(result.reply).toContain('£20 and £30');
    expect(result.followUpChips).toEqual(['Check £20', 'Check £30']);
    expect(result.context).toEqual({
      lastIntent: 'check_purchase',
      lastDetectedAmountMinor: null,
    });
  });

  it('cancels the current task without retaining context or proposing a write', () => {
    const result = buildLocalMeloTurn({
      prompt: 'Cancel that',
      snapshot,
      tone: 'calm',
      context: { lastIntent: 'check_purchase', lastDetectedAmountMinor: 4_000 },
    });

    expect(result).toMatchObject({
      reply: 'Cancelled. Nothing changed.',
      suggestions: [],
      context: null,
      control: 'cancel',
    });
  });

  it('requires explicit local account selection and retains only the selected identifier', () => {
    const selectAccount: LocalMeloAccountSelector = (prompt) =>
      /rainy day/i.test(prompt)
        ? { state: 'selected', accountId: 'private-account-id', label: 'Rainy day' }
        : {
            state: 'needs-selection',
            choices: [
              { accountId: 'private-current-id', label: 'Daily current' },
              { accountId: 'private-account-id', label: 'Rainy day' },
            ],
          };
    const calculate: LocalMeloCalculationBuilder = (request) => {
      expect(request.selectedAccountId).toBe('private-account-id');
      return {
        kind: 'account-position',
        accountKind: 'savings',
        balanceMinor: 20_000,
        isLiability: false,
        balanceAsOfLabel: '15 Jul 2026',
      };
    };

    const ambiguous = buildLocalMeloTurn({
      prompt: 'What is my account balance?',
      snapshot,
      tone: 'calm',
      selectAccount,
    });
    const selected = buildLocalMeloTurn({
      prompt: 'Use Rainy day',
      snapshot,
      tone: 'calm',
      context: ambiguous.context,
      selectAccount,
      calculate,
    });

    expect(ambiguous.followUpChips).toEqual(['Use Daily current', 'Use Rainy day']);
    expect(selected.reply).toContain('Rainy day:');
    expect(selected.reply).toContain('£200 available in that account');
    expect(selected.context).toEqual({
      lastIntent: 'review_accounts',
      lastDetectedAmountMinor: null,
      selectedAccountId: 'private-account-id',
    });
    expect(JSON.stringify(selected.context)).not.toContain('Rainy day');
  });

  it('keeps a source follow-up on the prior typed metric instead of falling back to Safe Zone', () => {
    let requestIntent = '';
    const calculate: LocalMeloCalculationBuilder = (request) => {
      requestIntent = request.intent;
      return {
        kind: 'source-explanation',
        values: [
          { label: 'debt balance', amountMinor: 480_000 },
          { label: 'monthly debt minimums', amountMinor: 18_000 },
        ],
        sourceKinds: ['recorded debt details'],
        confirmedRecordCount: 2,
        excludedReviewCount: 0,
      };
    };

    const result = buildLocalMeloTurn({
      prompt: 'Show sources',
      snapshot,
      tone: 'calm',
      context: { lastIntent: 'review_debts', lastDetectedAmountMinor: null },
      calculate,
    });

    expect(requestIntent).toBe('review_debts');
    expect(result.reply).toContain('£4,800 debt balance');
    expect(result.reply).toContain('recorded debt details');
  });

  it('keeps a natural account-source follow-up on the selected account', () => {
    let requestIntent = '';
    let requestPrompt = '';
    let requestAccountId = '';
    const calculate: LocalMeloCalculationBuilder = (request) => {
      requestIntent = request.intent;
      requestPrompt = request.prompt;
      requestAccountId = request.selectedAccountId ?? '';
      return {
        kind: 'source-explanation',
        values: [{ label: 'selected account balance', amountMinor: 32_550 }],
        sourceKinds: ['current balance setting'],
        confirmedRecordCount: 1,
        excludedReviewCount: 0,
      };
    };

    const result = buildLocalMeloTurn({
      prompt: 'Where did that come from?',
      snapshot,
      tone: 'calm',
      context: {
        lastIntent: 'review_accounts',
        lastDetectedAmountMinor: null,
        selectedAccountId: 'private-account-id',
      },
      calculate,
    });

    expect(requestIntent).toBe('review_accounts');
    expect(requestPrompt).toBe('Explain the selected account balance');
    expect(requestAccountId).toBe('private-account-id');
    expect(result.reply).toContain('£325.50 selected account balance');
    expect(result.reply).toContain('current balance setting');
    expect(JSON.stringify(result.context)).not.toContain('account name');
  });

  it('creates a review-only local proposal for a completed spend', () => {
    const result = buildLocalMeloTurn({
      prompt: 'I spent £12.50 at Tesco',
      snapshot,
      tone: 'calm',
    });
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({
      name: 'log_spend',
      args: { amount: 12.5, merchant: 'Tesco', category: 'food' },
    });
  });

  it('never proposes a write for hypothetical wording', () => {
    expect(parseLocalMoneySuggestion('What if I spent £12 at Tesco?')).toBeNull();
    expect(parseLocalMoneySuggestion('Can I transfer £50 from Current to Savings?')).toBeNull();
  });
});
