import { describe, expect, it } from 'vitest';

import { derivePressure } from './pressure.js';

describe('derivePressure', () => {
  it.each([
    [-1, 'overspent'],
    [0, 'pressured'],
    [183, 'pressured'],
    [184, 'soft'],
    [324, 'soft'],
    [325, 'calm'],
    [611, 'calm'],
    [612, 'safe'],
  ] as const)('maps a tightest projected spare of %s to %s', (tightSpare, pressure) => {
    expect(derivePressure(tightSpare)).toBe(pressure);
  });
});
