import { describe, expect, it } from 'vitest';

import { shellCompanionPlacement } from './shellCompanion';

describe('pinned shell companion perches', () => {
  it('owns the canonical Plan and Review anchors', () => {
    expect(shellCompanionPlacement('plan', 'auto')).toEqual({
      top: 485,
      bubbleLeft: 30,
      birdLeft: 260,
    });
    expect(shellCompanionPlacement('review', 'right')).toEqual({
      top: 243,
      bubbleLeft: 30,
      birdLeft: 260,
    });
  });

  it('mirrors the composition for an explicit left-side preference', () => {
    expect(shellCompanionPlacement('plan', 'left')).toEqual({
      top: 485,
      bubbleLeft: 110,
      birdLeft: 36,
    });
  });

  it('owns the pinned personal header-perch family', () => {
    for (const screen of [
      'plans',
      'whatif',
      'account',
      'connections',
      'privacy',
      'timeline',
      'visualizer',
    ] as const) {
      expect(shellCompanionPlacement(screen, 'auto', 'personal')).toEqual({
        top: 68,
        bubbleLeft: 44,
        birdLeft: 260,
      });
    }
    expect(shellCompanionPlacement('today-after', 'auto', 'personal')).toEqual({
      top: 68,
      bubbleLeft: 68,
      birdLeft: 284,
    });
  });

  it('mirrors personal header perches without leaking them into Business', () => {
    expect(shellCompanionPlacement('plans', 'left', 'personal')).toEqual({
      top: 68,
      bubbleLeft: 96,
      birdLeft: 36,
    });
    expect(shellCompanionPlacement('timeline', 'auto', 'business')).toBeNull();
    expect(shellCompanionPlacement('plans', 'auto', 'business')).toBeNull();
    expect(shellCompanionPlacement('plan', 'auto', 'business')).toEqual({
      top: 485,
      bubbleLeft: 30,
      birdLeft: 260,
    });
  });

  it('refuses screens with no pinned source perch', () => {
    expect(shellCompanionPlacement('more', 'auto')).toBeNull();
    expect(shellCompanionPlacement('today', 'auto')).toBeNull();
    expect(shellCompanionPlacement('paywall', 'auto')).toBeNull();
  });
});
