import { beforeEach, describe, expect, it } from 'vitest';

import { getState, resetAll, setMelo, type MeloTone } from '../store';

import {
  canSurfaceProactiveMoneySuggestion,
  describeMeloTone,
  selectMeloTodayMoneyNudge,
} from './meloToneGuidance';

describe('Melo tone-gated guidance', () => {
  beforeEach(() => {
    resetAll();
  });

  it.each<MeloTone>(['calm', 'honest', 'dry'])(
    'keeps proactive money suggestions off Today in %s mode',
    (tone) => {
      expect(canSurfaceProactiveMoneySuggestion(tone)).toBe(false);
    },
  );

  it('allows proactive money suggestions only in Coachy mode', () => {
    expect(canSurfaceProactiveMoneySuggestion('coachy')).toBe(true);
  });

  it('defaults missing legacy preferences to Calm rather than Coachy', () => {
    expect(canSurfaceProactiveMoneySuggestion(undefined)).toBe(false);
    expect(describeMeloTone(undefined)).toContain('Proactive money suggestions stay off Today');
  });

  it('stores the selected global tone without changing other Melo preferences', () => {
    setMelo({ quietMode: true, wardrobe: ['scarf'] });
    setMelo({ tone: 'coachy' });

    expect(getState().melo).toEqual({
      quietMode: true,
      wardrobe: ['scarf'],
      tone: 'coachy',
    });
    expect(canSurfaceProactiveMoneySuggestion(getState().melo?.tone)).toBe(true);
  });

  it('describes each mode without changing the underlying mode value', () => {
    const modes: readonly MeloTone[] = ['calm', 'honest', 'dry', 'coachy'];
    expect(modes.map((tone) => describeMeloTone(tone))).toEqual([
      'Gentle answers. Proactive money suggestions stay off Today.',
      'Plain answers. Proactive money suggestions stay off Today.',
      'Terse answers. Proactive money suggestions stay off Today.',
      'Useful questions, plus optional moves based on your money.',
    ]);
  });

  it.each<MeloTone>(['calm', 'honest', 'dry'])(
    'omits proactive Today money moves but retains factual spend review in %s mode',
    (tone) => {
      expect(
        selectMeloTodayMoneyNudge({
          tone,
          hasUpcomingSubscription: true,
          tightPointGoal: 200,
          tightestSpare: 80,
          recentSpend: 145,
        }),
      ).toBe('spending-review');
    },
  );

  it('prioritises the subscription and low-point suggestions in Coachy mode', () => {
    expect(
      selectMeloTodayMoneyNudge({
        tone: 'coachy',
        hasUpcomingSubscription: true,
        tightPointGoal: 200,
        tightestSpare: 80,
        recentSpend: 145,
      }),
    ).toBe('subscription-pause');
    expect(
      selectMeloTodayMoneyNudge({
        tone: 'coachy',
        hasUpcomingSubscription: false,
        tightPointGoal: 200,
        tightestSpare: 80,
        recentSpend: 145,
      }),
    ).toBe('tight-point');
  });

  it('does not manufacture a Today nudge when non-Coachy mode has no factual update', () => {
    expect(
      selectMeloTodayMoneyNudge({
        tone: 'calm',
        hasUpcomingSubscription: true,
        tightPointGoal: 200,
        tightestSpare: 80,
        recentSpend: 0,
      }),
    ).toBeNull();
  });
});
