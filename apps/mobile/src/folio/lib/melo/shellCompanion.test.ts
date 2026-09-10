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

  it('uses the existing inline owner instead of a second bird over financial titles', () => {
    for (const screen of ['plans', 'whatif', 'privacy', 'timeline', 'visualizer'] as const) {
      expect(shellCompanionPlacement(screen, 'auto', 'personal')).toBeNull();
      expect(shellCompanionPlacement(screen, 'left', 'personal')).toBeNull();
      expect(shellCompanionPlacement(screen, 'right', 'personal')).toBeNull();
    }
    expect(shellCompanionPlacement('today-after', 'auto', 'personal')).toBeNull();
  });

  it('keeps personal header perches on their authored safe side without leaking into Business', () => {
    expect(shellCompanionPlacement('plans', 'left', 'personal')).toBeNull();
    expect(shellCompanionPlacement('connections', 'left', 'personal')).toBeNull();
    expect(shellCompanionPlacement('timeline', 'auto', 'business')).toBeNull();
    expect(shellCompanionPlacement('plans', 'auto', 'business')).toBeNull();
    expect(shellCompanionPlacement('plan', 'auto', 'business')).toEqual({
      top: 485,
      bubbleLeft: 30,
      birdLeft: 260,
    });
  });

  it('refuses screens with no pinned source perch', () => {
    expect(shellCompanionPlacement('account', 'auto')).toBeNull();
    expect(shellCompanionPlacement('more', 'auto')).toBeNull();
    expect(shellCompanionPlacement('today', 'auto')).toBeNull();
    expect(shellCompanionPlacement('connections', 'auto')).toBeNull();
    expect(shellCompanionPlacement('paywall', 'auto')).toBeNull();
  });
});
