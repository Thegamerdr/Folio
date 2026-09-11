import { describe, expect, it } from 'vitest';
import { shouldTuckMelo, visibleMeloFraction } from './scrollOwner';
describe('companion scroll ownership', () => {
  it('keeps the same owner through the 40–80% band in either direction', () => {
    expect([1, 0.7, 0.41].reduce((state, fraction) => shouldTuckMelo(state, fraction), false)).toBe(
      false,
    );
    expect(shouldTuckMelo(false, 0.4)).toBe(true);
    expect(
      [0.41, 0.6, 0.79].reduce((state, fraction) => shouldTuckMelo(state, fraction), true),
    ).toBe(true);
    expect(shouldTuckMelo(true, 0.8)).toBe(false);
  });
  it('accounts for both horizontal and vertical clipping after resize', () => {
    const slot = { x: 0, y: 0, width: 100, height: 100 };
    expect(visibleMeloFraction(slot, { x: 50, y: 20, width: 200, height: 200 })).toBe(0.4);
    expect(visibleMeloFraction(slot, { x: 0, y: 101, width: 200, height: 200 })).toBe(0);
    expect(visibleMeloFraction(slot, { x: -10, y: -10, width: 200, height: 200 })).toBe(1);
  });
});
