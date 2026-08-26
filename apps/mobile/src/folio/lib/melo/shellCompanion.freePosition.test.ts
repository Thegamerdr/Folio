import { describe, expect, it } from 'vitest';

import {
  correctCompanionForScreen,
  denormalizeCompanionPosition,
  normalizeCompanionPosition,
} from './shellCompanion';

describe('free shell companion position', () => {
  it('round-trips normalized coordinates across the S9 shell bounds', () => {
    const bounds = { width: 360, height: 720 };
    const normalized = { x: 0.37, y: 0.64 };
    const pixels = denormalizeCompanionPosition(normalized, bounds);
    const roundTrip = normalizeCompanionPosition(pixels, bounds);
    expect(roundTrip.x).toBeCloseTo(normalized.x, 5);
    expect(roundTrip.y).toBeCloseTo(normalized.y, 5);
  });

  it('preserves a safe free drop exactly and only minimally corrects a leading header collision', () => {
    const bounds = { width: 360, height: 720 };
    expect(correctCompanionForScreen('timeline', { x: 280, y: 320 }, bounds)).toEqual({
      x: 280,
      y: 320,
    });
    expect(correctCompanionForScreen('timeline', { x: 80, y: 80 }, bounds)).toEqual({
      x: 252,
      y: 80,
    });
  });

  it('keeps every position outside the bottom navigation exclusion', () => {
    expect(
      correctCompanionForScreen('review', { x: 999, y: 999 }, { width: 360, height: 720 }),
    ).toEqual({ x: 288, y: 552 });
  });
});
