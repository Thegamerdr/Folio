import { describe, expect, it } from 'vitest';
import { shouldTuckMelo, visibleMeloFraction } from './scrollOwner';
describe('companion scroll ownership', () => {
  it('tucks before a partial body is left at either viewport edge', () => {
    expect(shouldTuckMelo(false, 1)).toBe(false);
    for (const clipped of [0, 0.4, 0.8, 0.99]) {
      expect(shouldTuckMelo(false, clipped)).toBe(true);
      expect(shouldTuckMelo(true, clipped)).toBe(true);
    }
    expect(shouldTuckMelo(true, 1)).toBe(false);
  });
  it('accounts for both horizontal and vertical clipping after resize', () => {
    const slot = { x: 0, y: 0, width: 100, height: 100 };
    expect(visibleMeloFraction(slot, { x: 50, y: 20, width: 200, height: 200 })).toBe(0.4);
    expect(visibleMeloFraction(slot, { x: 0, y: 101, width: 200, height: 200 })).toBe(0);
    expect(visibleMeloFraction(slot, { x: -10, y: -10, width: 200, height: 200 })).toBe(1);
  });
});
