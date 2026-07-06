import { describe, expect, it } from 'vitest';

import { formatMinorAmount } from './money.js';

// Pins the exact display contract this kit depends on across every live money surface
// (Today, Insights, Pots preview via MoneyPath, etc.) — extracted 1:1 from the legacy
// `local/localLedger.ts` implementation per CONSOLIDATION.md's kit-wrinkle finding.

describe('formatMinorAmount', () => {
  it('formats a whole-pound positive amount with no pence part', () => {
    expect(formatMinorAmount(4200)).toBe('£42');
  });

  it('formats zero as a bare whole-pound amount', () => {
    expect(formatMinorAmount(0)).toBe('£0');
  });

  it('formats pence, zero-padding single-digit pence', () => {
    expect(formatMinorAmount(105)).toBe('£1.05');
  });

  it('formats pence with two digits when not requiring padding', () => {
    expect(formatMinorAmount(4250)).toBe('£42.50');
  });

  it('puts the negative sign before the currency symbol, not after', () => {
    expect(formatMinorAmount(-4200)).toBe('-£42');
  });

  it('formats a negative amount with pence, sign before the symbol', () => {
    expect(formatMinorAmount(-105)).toBe('-£1.05');
  });

  it('adds thousands separators for amounts at and above 1,000 pounds', () => {
    expect(formatMinorAmount(120000)).toBe('£1,200');
  });

  it('adds thousands separators together with a pence part', () => {
    expect(formatMinorAmount(123456)).toBe('£1,234.56');
  });

  it('adds multiple thousands separators for large amounts', () => {
    expect(formatMinorAmount(123456789)).toBe('£1,234,567.89');
  });

  it('formats a negative amount with thousands separators', () => {
    expect(formatMinorAmount(-120050)).toBe('-£1,200.50');
  });

  it('treats 99 pence as pence-only, no whole pound', () => {
    expect(formatMinorAmount(99)).toBe('£0.99');
  });

  it('rolls 100 pence over into a whole pound with no pence part', () => {
    expect(formatMinorAmount(100)).toBe('£1');
  });
});
