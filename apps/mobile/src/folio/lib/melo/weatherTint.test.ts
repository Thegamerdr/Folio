import { describe, expect, it } from 'vitest';

import { weatherTintCanvas } from './weatherTint';

describe('weatherTintCanvas', () => {
  it('composites the live Lovable tint into the paper background', () => {
    expect(weatherTintCanvas('#F7F6F1', 'storm')).toBe('rgb(241, 234, 228)');
  });

  it('is neutral in Quiet Mode and never invents a fallback for an unknown canvas format', () => {
    expect(weatherTintCanvas('#F7F6F1', 'sunny', { quiet: true })).toBe('#F7F6F1');
    expect(weatherTintCanvas('paper', 'sunny')).toBe('paper');
  });
});
