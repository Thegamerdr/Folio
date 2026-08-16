// resetEssentialsPerDay — pure-logic coverage for the shared essentials-per-day denominator
// (lib/modes/strategies/reset.ts).
//
// Plan 107 Step 2: TodayModeScreen's Reset hero caption used to re-derive its own
// (different) per-day figure (`Math.max(15, monthlyOut / 30)`) instead of the one
// `resetStrategy.derive()` used to compute the "N days of essentials" count
// (`Math.max(5, (monthlyIncome * 0.4) / 30)`), so "N days" × "~£X/day" didn't multiply
// back to anything real. This pins the extracted, shared formula both call sites now use.

import { describe, expect, it } from 'vitest';

import { resetEssentialsPerDay } from './reset';

describe('resetEssentialsPerDay', () => {
  it('is 40% of monthly income, spread over 30 days', () => {
    expect(resetEssentialsPerDay(2250)).toBeCloseTo((2250 * 0.4) / 30, 10);
  });

  it('floors at £5/day for very low or zero income', () => {
    expect(resetEssentialsPerDay(0)).toBe(5);
    expect(resetEssentialsPerDay(100)).toBe(5);
  });
});
