import { describe, expect, it } from 'vitest';
import {
  classifyMeloLocalIntent,
  draftMeloLocalAiResponse,
  type MeloLocalFinancialSnapshot,
} from '../src/index.js';

const snapshot: MeloLocalFinancialSnapshot = {
  currency: 'GBP',
  availableNowMinor: 24500,
  tightestBalanceMinor: 44500,
  tightestDay: '8 Oct 2026',
  protectedItems: ['bills', 'essentials', 'debt minimums', 'buffer'],
  pendingReviewCount: 0,
  nextPaydayLabel: '9 Oct 2026',
  hasMoneyPicture: true,
  setupComplete: true,
  debtCount: 1,
  totalDebtMinor: 28000,
  monthlyDebtMinimumMinor: 4000,
};

const answer = (prompt: string) =>
  draftMeloLocalAiResponse({
    prompt,
    snapshot,
    cloudAiEnabled: false,
    cloudConsentGranted: false,
    source: 'typed_prompt',
  });

describe('payment instructions preserve the already-paid boundary', () => {
  it.each(['Pay 40 to Final card', 'Please send £40 to Final card', 'Pay £40 off Klarna'])(
    'clarifies %s instead of answering an unrelated recovery question',
    (prompt) => {
      const draft = answer(prompt);
      expect(draft.intent).toBe('review_debts');
      expect(draft.answer).toContain('Melo cannot send money');
      expect(draft.answer).toContain('Has this payment already happened?');
      expect(draft.answer).toContain('for your review before saving');
      expect(draft.answer).not.toMatch(/shortfall to recover|Payment recorded/);
      expect(draft.canWriteRecords).toBe(false);
      expect(draft.requiresUserReview).toBe(true);
      expect(draft.actions.some((action) => action.kind === 'build_recovery_route')).toBe(false);
    },
  );

  it.each(['Final card', 'postcard', 'discard this', 'carpet', 'shortcut'])(
    'does not treat the substring car in %s as a recovery request',
    (prompt) => {
      expect(classifyMeloLocalIntent(prompt.toLowerCase())).not.toBe('plan_recovery');
    },
  );

  it.each([
    'My car needs help',
    'A car repair emergency',
    'I am short this month',
    'Help with a shortfall',
    'Help with repeated shortfalls',
    'Help with repairs',
    'Both cars need repairs',
    'Unexpected emergencies this month',
  ])('preserves the explicit recovery request %s', (prompt) => {
    expect(classifyMeloLocalIntent(prompt.toLowerCase())).toBe('plan_recovery');
  });

  it('keeps a hypothetical purchase as a preview using the current245 amount', () => {
    const draft = answer('Can I spend 40 today?');
    expect(draft.intent).toBe('check_purchase');
    expect(draft.answer).toContain('£205 safe to spend until payday');
    expect(draft.answer).toContain('your current plan');
    expect(draft.answer).toContain('nothing has changed');
    expect(draft.answer).not.toMatch(/local route|Safe Zone/);
    expect(draft.canWriteRecords).toBe(false);
  });

  it('labels an unaffordable proposal as the gap after recorded costs and buffer', () => {
    const draft = answer('Can I spend 300 today?');
    expect(draft.answer).toContain('£55 gap after recorded costs and buffer');
    expect(draft.answer).not.toMatch(/Safe Zone|safe to spend/);
  });
});
