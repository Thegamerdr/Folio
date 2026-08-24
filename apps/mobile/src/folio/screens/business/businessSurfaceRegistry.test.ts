import { describe, expect, it } from 'vitest';

import {
  BUSINESS_SHARED_SURFACE_IDS,
  BUSINESS_SHELL_SURFACE_IDS,
  BUSINESS_SURFACE_REGISTRY,
  businessSurface,
} from './businessSurfaceRegistry';

describe('Business surface registry', () => {
  it('classifies every operation route exactly once', () => {
    const ids = BUSINESS_SURFACE_REGISTRY.map((surface) => surface.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('business-clients');
    expect(ids).toContain('business-filing-sa');
    expect(ids).toContain('business-filing-payroll');
  });

  it('keeps the shell-level business surfaces explicit', () => {
    expect(BUSINESS_SHELL_SURFACE_IDS).toEqual([
      'today',
      'more',
      'melo',
      'timeline',
      'calendar',
      'plans',
    ]);
    expect(BUSINESS_SHARED_SURFACE_IDS).toEqual(['account', 'intake', 'privacy']);
  });

  it('does not claim personal routes as Business operation surfaces', () => {
    expect(businessSurface('today')).toBeUndefined();
    expect(businessSurface('business-vat')).toMatchObject({ family: 'tax' });
    expect(businessSurface('business-insights')?.label).toBe('Business insights');
  });
});
