import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'motion.ts'), 'utf8');

describe('frozen native motion contract', () => {
  it('pins the named design-source timings and press response', () => {
    for (const fragment of [
      "routeDraw: { durationMs: 2200, easing: 'ease-out' }",
      "countUp: { durationMs: 700, easing: 'cubic-out' }",
      "sheetRise: { durationMs: 480, easing: 'cubic-bezier(.16,1,.3,1)' }",
      "verdictStamp: { durationMs: 600, easing: 'cubic-bezier(.34,1.56,.64,1)' }",
      "press: { durationMs: 120, scale: 0.97, easing: 'ease' }",
    ]) {
      expect(source).toContain(fragment);
    }
  });

  it('subscribes to the native reduced-motion preference', () => {
    expect(source).toContain('AccessibilityInfo.isReduceMotionEnabled()');
    expect(source).toContain("AccessibilityInfo.addEventListener('reduceMotionChanged'");
  });
});
