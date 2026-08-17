import { describe, expect, it } from 'vitest';

import {
  folioTokens,
  getMotionPreferenceTokens,
  getSemanticStatusTokens,
  meetsNativeHitTarget,
  type SemanticStatus,
} from '../src/index.js';

describe('@folio/ui tokens', () => {
  it('uses the frozen native 44dp minimum hit target policy', () => {
    expect(folioTokens.size.touchTarget).toBe(44);
    expect(folioTokens.hitTarget.minimumDp).toBe(44);
    expect(meetsNativeHitTarget(43)).toBe(false);
    expect(meetsNativeHitTarget(44)).toBe(true);
  });

  it('zeroes transform motion for reduced motion', () => {
    expect(folioTokens.motion.reducedMotionDurationMs).toBe(0);
    expect(getMotionPreferenceTokens('reduce')).toMatchObject({
      durationMs: 0,
      transformAllowed: false,
      decorativeLoopAllowed: false,
    });
  });

  it('requires non-color affordances for every semantic status', () => {
    const statuses = Object.keys(folioTokens.status) as SemanticStatus[];

    for (const status of statuses) {
      const token = getSemanticStatusTokens(status);

      expect(token.affordance.iconName.length).toBeGreaterThan(0);
      expect(token.affordance.label.length).toBeGreaterThan(0);
      expect(token.affordance.shape.length).toBeGreaterThan(0);
      expect(token.affordance.screenReaderPrefix.length).toBeGreaterThan(0);
    }
  });

  it('keeps money text stable and integer-minor-unit aligned', () => {
    expect(folioTokens.typography.role.money.fontVariantNumeric).toContain('tabular-nums');
    expect(folioTokens.money.text.whiteSpace).toBe('nowrap');
    expect(folioTokens.money.rendering.useIntegerMinorUnits).toBe(true);
    expect(folioTokens.money.rendering.neverUseBinaryFloat).toBe(true);
    expect(folioTokens.money.rendering.deriveFractionDigitsFromCurrency).toBe(true);
  });

  it('freezes the accepted product type and radius scales', () => {
    expect(Object.values(folioTokens.typography.scale)).toEqual([11, 12.5, 14, 16, 20, 28, 40, 56]);
    expect(folioTokens.radius).toEqual({
      row: 12,
      field: 12,
      card: 18,
      sheet: 18,
      hero: 24,
      pill: 999,
    });
  });
});
