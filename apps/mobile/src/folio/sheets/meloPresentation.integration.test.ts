
import { describe, expect, it } from 'vitest';
import { buildLocalMeloTurn } from '../../local/localMeloTurn';
import { resolveMeloSubscriptionRequest } from '../lib/meloSubscriptionRequest';
import { presentMeloReply } from './meloPresentation';

const snapshot = {
  currency: 'GBP' as const, availableNowMinor: 14200, tightestDay: 'Friday 17 Jul',
  tightestBalanceMinor:8100, protectedItems:[], pendingReviewCount:0,
  nextPaydayLabel:'2026-07-25', hasMoneyPicture:true, setupComplete:true,
  subscriptionCount:2, activeSubscriptionMonthlyMinor:2698,
};
const sub = (id:string, name:string) => ({id,name,cost:10.99,nextRenewalDaysAway:4,lastUsedDaysAgo:2,usesPerMonth:12});
function turn(prompt:string, subs:any[], paused:Record<string,boolean> = {}) {
  return buildLocalMeloTurn({prompt,snapshot,tone:'calm',resolveSubscriptionAction:resolveMeloSubscriptionRequest as any,subscriptionState:{subs,subPaused:paused}});
}
describe('controller complete deterministic-to-presentation path', () => {
  it('preserves no-match and ambiguous names through the actual turn constructor', () => {
    for (const [prompt, subs, expected] of [
      ['Pause Disney Plus',[sub('one','Spotify')],'disney plus'],
      ['Pause Spotify',[sub('one','Spotify Premium'),sub('two','Spotify Family')],'spotify'],
    ] as const) {
      const result = turn(prompt,[...subs]);
      expect(result.intent).toBe('review_subscriptions');
      expect(result.suggestions).toEqual([]);
      expect(presentMeloReply(result)).toBe(`I can’t find one clear match for ‘${expected}’. Nothing has changed.`);
    }
  });
  it('uses the C04 subscription action label for a supported review outcome', () => {
    const result = turn('Resume Spotify',[sub('one','Spotify')]);
    expect(presentMeloReply(result)).toBe('Subscriptions are managed in Plan. Nothing has changed.');
    expect(result.actions[0]?.label).toBe('Review subscription');
  });
});
