import { describe, expect, it } from 'vitest';
import { perchTargets, resolvePerchDrop } from './perch';

describe('Melo reserved-lane movement', () => {
  it('allows left/right movement and places the semantic default at the trailing edge', () => {
    expect(resolvePerchDrop(312, 3, 0, 'auto')).toBe('left');
    expect(perchTargets(312).auto).toBe(perchTargets(312).right);
    expect(resolvePerchDrop(312, 110, 2, 'left')).toBe('left');
    expect(resolvePerchDrop(312, 220, 0, 'auto')).toBe('right');
  });
  it('rejects a drop over text above or below the reserved lane', () => {
    expect(resolvePerchDrop(312, 0, -90, 'right')).toBe('right');
    expect(resolvePerchDrop(312, 224, 91, 'left')).toBe('left');
  });
  it('returns to the origin for a drop outside the authored targets', () => {
    expect(resolvePerchDrop(500, 100, 0, 'right')).toBe('right');
    expect(resolvePerchDrop(312, 600, 0, 'left')).toBe('left');
  });
  it('recomputes side preferences after resize rather than keeping a raw coordinate', () => {
    expect(perchTargets(312).right).toBe(224);
    expect(perchTargets(220).right).toBe(132);
    expect(perchTargets(88).right).toBe(0);
  });
  it('does not invent a position when no complete 88dp target fits', () => {
    expect(resolvePerchDrop(72, 0, 0, 'right')).toBe('right');
  });
});
