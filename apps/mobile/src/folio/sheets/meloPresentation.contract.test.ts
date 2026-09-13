import { describe, expect, it } from 'vitest';
import { presentMeloReply } from './meloPresentation';
import { resolveMeloSubscriptionRequest } from '../lib/meloSubscriptionRequest';

describe('MF13 truthful presentation outcomes', () => {
  it('qualifies incomplete source answers without turning unknown values into zeroes', () => {
    expect(
      presentMeloReply({
        reply: 'Your money picture is not complete yet. Add or confirm your balance.',
        intent: 'explain_position', actions: [], suggestions: [], followUpChips: [], context: null, control: 'none',
      } as any),
    ).toBe('I can’t work that out from what’s recorded yet. Add or review the missing amount, then ask again.');
    expect(
      presentMeloReply({
        reply: 'Your next income date is not set up yet. Add an income source or payday.',
        intent: 'check_payday',
        actions: [{ kind: 'open_calendar', label: 'Show dated income', detail: 'Open Calendar.', requiresUserReview: false }],
        suggestions: [], followUpChips: [], context: null, control: 'none',
      } as any),
    ).toBe('This needs to be added in Calendar. I’ll leave your money unchanged.');
    expect(
      presentMeloReply({
        reply: 'Your next income date is not set up yet. Add an income source or payday.',
        intent: 'check_payday',
        actions: [{ kind: 'open_manual_setup', label: 'Add my numbers', detail: 'Open setup.', requiresUserReview: false }],
        suggestions: [], followUpChips: [], context: null, control: 'none',
      } as any),
    ).toBe('This needs to be added in Add my numbers. I’ll leave your money unchanged.');
  });

  it('uses the exact no-unique-match and review-subscription contract', () => {
    const state = { subs: [{ name: 'Spotify', cost: 10.99, nextRenewalDaysAway: 4, lastUsedDaysAgo: 2, usesPerMonth: 12 }], subPaused: {} };
    const missing = resolveMeloSubscriptionRequest('Pause Disney Plus', state);
    const missingReply = 'reply' in missing ? missing.reply : '';
    expect(missingReply).toBe('I can’t find one clear match for ‘disney plus’. Nothing has changed.');
    expect(
      presentMeloReply({
        reply: missingReply,
        intent: 'review_subscriptions',
        actions: [{ kind: 'open_subscriptions', label: 'Open subscriptions', detail: 'Review local subscriptions.', requiresUserReview: false }],
        suggestions: [], followUpChips: [], context: null, control: 'none',
      } as any),
    ).toBe('I can’t find one clear match for ‘disney plus’. Nothing has changed.');
    const ambiguousState = {
      subs: [
        { name: 'Spotify Premium', cost: 10.99, nextRenewalDaysAway: 4, lastUsedDaysAgo: 2, usesPerMonth: 12 },
        { name: 'Spotify Family', cost: 15.99, nextRenewalDaysAway: 8, lastUsedDaysAgo: 2, usesPerMonth: 12 },
      ],
      subPaused: {},
    };
    const ambiguous = resolveMeloSubscriptionRequest('Pause Spotify', ambiguousState);
    expect(ambiguous.state).toBe('needs-selection');
    const ambiguousReply = 'reply' in ambiguous ? ambiguous.reply : '';
    expect(
      presentMeloReply({
        reply: ambiguousReply,
        intent: 'review_subscriptions',
        actions: [{ kind: 'open_subscriptions', label: 'Open subscriptions', detail: 'Review local subscriptions.', requiresUserReview: false }],
        suggestions: [], followUpChips: [], context: null, control: 'none',
      } as any),
    ).toBe('I can’t find one clear match for ‘spotify’. Nothing has changed.');
    const exact = resolveMeloSubscriptionRequest('Pause Spotify', state);
    expect(exact.state === 'review' ? exact.actionLabel : '').toBe('Review subscription');
  });
});
