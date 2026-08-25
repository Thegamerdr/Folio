import { describe, expect, it } from 'vitest';

import { shellCompanionPlacement } from './shellCompanion';

describe('pinned shell companion perches', () => {
  it('owns the canonical Plan and Review anchors', () => {
    expect(shellCompanionPlacement('plan', 'auto')).toEqual({
      top: 459,
      bubbleLeft: 30,
      birdLeft: 260,
    });
    expect(shellCompanionPlacement('review', 'right')).toEqual({
      top: 212,
      bubbleLeft: 30,
      birdLeft: 260,
    });
  });

  it('mirrors the composition for an explicit left-side preference', () => {
    expect(shellCompanionPlacement('plan', 'left')).toEqual({
      top: 459,
      bubbleLeft: 110,
      birdLeft: 36,
    });
  });

  it('refuses screens with no pinned source perch', () => {
    expect(shellCompanionPlacement('more', 'auto')).toBeNull();
    expect(shellCompanionPlacement('today', 'auto')).toBeNull();
  });
});
