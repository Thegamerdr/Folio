import { beforeEach, describe, expect, it } from 'vitest';
import {
  getState,
  resetToEmpty,
  setPartial,
  togglePaused,
  repayToPot,
  subscriptionWithPause,
} from '../store';
import { MODE_LABEL } from './modes/types';
import {
  ritualOptionalSteps,
  ritualPausePresentation,
  ritualStatText,
  ritualStepFrames,
} from './ritualStepPresentation';

beforeEach(() => resetToEmpty());
describe('ritual step meaning and continuity', () => {
  it('names the actual pot contribution and forecast controls in every money mode', () => {
    for (const mode of Object.keys(MODE_LABEL) as Array<keyof typeof MODE_LABEL>) {
      const frames = ritualStepFrames(mode, 12.34);
      expect(frames.review.cta).toBe('Review pot amounts');
      expect(frames.pots.statValue).toBe(12.34);
      expect(frames.pots.statLabel).toBe('Recorded pot contributions');
      expect(
        frames.pots.headlineLead + frames.pots.headlineAccent + frames.pots.headlineTrail,
      ).toBe('Any money to set aside?');
      expect(
        frames.forecast.headlineLead +
          frames.forecast.headlineAccent +
          frames.forecast.headlineTrail,
      ).toBe('Check the forecast before payday.');
      expect(JSON.stringify(frames)).not.toMatch(/repayment|bills cleared|balance down/i);
    }
  });
  it('distinguishes a count of choices from money without losing pennies or grouping', () => {
    expect(ritualStatText(2, 'count')).toBe('2');
    expect(ritualStatText(1250, 'count')).toBe('1,250');
    expect(ritualStatText(-1250.34)).toBe('−£1,250.34');
  });
  it('names the next optional pause step before the final note', () => {
    expect(ritualStepFrames('debt', 0, true).forecast.cta).toBe('Review forecast pauses');
    expect(ritualStepFrames('debt', 0, false).forecast.cta).toBe('Leave a note for next-you');
  });
  it('does not infer a provider pause or a usage reason from the forecast setting', () => {
    expect(
      ritualPausePresentation({ cost: 12.34, renewalPeriodDays: 7, pausedUntil: '2026-09-13' }),
    ).toEqual({
      amount: '£12.34 · repeats weekly',
      date: 'Paused in your forecast until 13 Sept 2026',
      detail:
        'Melo has not paused payments with the provider. Check their payment schedule before relying on this date.',
    });
  });
  it('does not present an automatically inferred pause reason as the user’s reason', () => {
    const paused = subscriptionWithPause(
      {
        name: 'Evidence streaming',
        cost: 20,
        nextRenewalDaysAway: 2,
        nextRenewalISO: '2026-09-12',
        usesPerMonth: 0,
        lastUsedDaysAgo: 0,
      },
      true,
      '2026-09-10',
    );
    expect(paused.pauseReason).toBe("you hadn't used it");
    const presentation = ritualPausePresentation(paused);
    expect(presentation.date).toBe('Paused in your forecast until 13 Sept 2026');
    expect(presentation.detail).toContain('Melo has not paused payments with the provider.');
    expect(JSON.stringify(presentation)).not.toMatch(/because|hadn.t used|resumes/);
    expect(ritualPausePresentation({ cost: 20 }).date).toBe('Paused in your forecast');
  });
  it('keeps optional steps stable after their existing repayment and resume mutations run', () => {
    setPartial({
      pots: [{ id: 'buffer', name: 'Buffer', saved: 20, goal: 100, perWeek: 0, accent: false }],
      potLedger: [
        {
          id: 'borrow',
          potId: 'buffer',
          kind: 'borrow',
          amount: 10,
          source: 'manual',
          at: '2026-09-10T12:00:00Z',
        },
      ],
      subs: [
        {
          name: 'Streaming',
          cost: 20,
          nextRenewalDaysAway: 3,
          usesPerMonth: 0,
          lastUsedDaysAgo: 0,
          pausedUntil: '2026-09-13',
          autoResume: 'prompt',
        },
      ],
      subPaused: { Streaming: true },
    });
    const stepsAtOpen = ritualOptionalSteps(getState());
    expect(stepsAtOpen.includeRepay).toBe(true);
    expect(stepsAtOpen.resumePrompts).toHaveLength(1);
    repayToPot('buffer', 10, 'ritual-repay');
    togglePaused('Streaming', false);
    expect(ritualOptionalSteps(getState())).toEqual({ includeRepay: false, resumePrompts: [] });
    expect(stepsAtOpen.includeRepay).toBe(true);
    expect(stepsAtOpen.resumePrompts).toHaveLength(1);
    expect(getState().pots[0]?.saved).toBe(20);
  });
});
