import { describe, expect, it } from 'vitest';

import { assessAffordImpact, type AffordImpactInputs } from './affordImpact.js';
import { checkAfford } from './safeZone.js';

// Matches the dangerDate.test fixtures: 12 days to payday, £15/day observed run-rate.
const base: AffordImpactInputs = {
  safeZonePence: 18_400,
  amountPence: 2_000,
  runRatePence: 1_500,
  todayISO: '2026-06-30',
  payday: '2026-07-12',
};

describe('assessAffordImpact — verdict parity with checkAfford', () => {
  it('matches checkAfford verdict and leftAfter for a safe amount', () => {
    const r = assessAffordImpact({ ...base, safeZonePence: 20_000, amountPence: 5_000 });
    const parity = checkAfford(20_000, 5_000);
    expect(r.verdict).toBe(parity.verdict);
    expect(r.verdict).toBe('safe');
    expect(r.leftAfterPence).toBe(parity.leftAfterPence);
    expect(r.leftAfterPence).toBe(15_000);
  });

  it('matches checkAfford at the exact safe/tight boundary (0.45 × zone)', () => {
    const r = assessAffordImpact({ ...base, safeZonePence: 20_000, amountPence: 9_000 });
    expect(r.verdict).toBe(checkAfford(20_000, 9_000).verdict);
    expect(r.verdict).toBe('safe');
    const just = assessAffordImpact({ ...base, safeZonePence: 20_000, amountPence: 9_001 });
    expect(just.verdict).toBe(checkAfford(20_000, 9_001).verdict);
    expect(just.verdict).toBe('tight');
  });

  it('matches checkAfford at the exact tight/notNow boundary (amount = zone)', () => {
    const atZone = assessAffordImpact({ ...base, safeZonePence: 20_000, amountPence: 20_000 });
    expect(atZone.verdict).toBe(checkAfford(20_000, 20_000).verdict);
    expect(atZone.verdict).toBe('tight');
    expect(atZone.leftAfterPence).toBe(0);
    const over = assessAffordImpact({ ...base, safeZonePence: 20_000, amountPence: 20_001 });
    expect(over.verdict).toBe(checkAfford(20_000, 20_001).verdict);
    expect(over.verdict).toBe('notNow');
    expect(over.leftAfterPence).toBe(-1);
  });
});

describe('assessAffordImpact — danger date recomputation', () => {
  it('leaves the forecast untouched when the purchase is small enough', () => {
    // 18_400 − 400 = 18_000 → 18_000 / 1_500 = 12 days ≥ 12 to payday: still no danger.
    const r = assessAffordImpact({ ...base, amountPence: 400 });
    expect(r.dangerBefore).toBeNull();
    expect(r.dangerAfter).toBeNull();
    expect(r.dangerCreated).toBe(false);
    expect(r.dangerMovedDays).toBe(0);
  });

  it('detects a CREATED danger date — even for a "safe" verdict purchase', () => {
    // Before: 18_400 / 1_500 → 12 days, outlasts the cycle → null.
    // After £20: 16_400 / 1_500 → 10 days → 2026-07-10. The drift-audit case: the verdict
    // says safe, and the recomputed forecast is what tells the user the true cost.
    const r = assessAffordImpact(base);
    expect(r.verdict).toBe('safe');
    expect(r.dangerBefore).toBeNull();
    expect(r.dangerAfter).toBe('2026-07-10');
    expect(r.dangerCreated).toBe(true);
    expect(r.dangerMovedDays).toBe(0);
  });

  it('measures exactly how many days earlier an existing danger date moves', () => {
    // Before: 9_000 / 1_500 → 6 days → 2026-07-06. After 3_000: 6_000 / 1_500 → 4 days
    // → 2026-07-04. Moved 2 days earlier; nothing was "created", it was already coming.
    const r = assessAffordImpact({ ...base, safeZonePence: 9_000, amountPence: 3_000 });
    expect(r.dangerBefore).toBe('2026-07-06');
    expect(r.dangerAfter).toBe('2026-07-04');
    expect(r.dangerCreated).toBe(false);
    expect(r.dangerMovedDays).toBe(2);
  });

  it('reports zero movement when danger is already today on both sides', () => {
    const r = assessAffordImpact({ ...base, safeZonePence: -100, amountPence: 500 });
    expect(r.dangerBefore).toBe('2026-06-30');
    expect(r.dangerAfter).toBe('2026-06-30');
    expect(r.dangerCreated).toBe(false);
    expect(r.dangerMovedDays).toBe(0);
  });
});

describe('assessAffordImpact — safeOnISO', () => {
  it('is null for a safe verdict — waiting is not needed', () => {
    const r = assessAffordImpact({ ...base, safeZonePence: 20_000, amountPence: 5_000 });
    expect(r.safeOnISO).toBeNull();
  });

  it('is null for a tight verdict — waiting is not needed', () => {
    const r = assessAffordImpact({ ...base, amountPence: 10_000 });
    expect(checkAfford(18_400, 10_000).verdict).toBe('tight');
    expect(r.safeOnISO).toBeNull();
  });

  it('falls back to payday when the zone only shrinks at a positive run-rate', () => {
    const r = assessAffordImpact({ ...base, amountPence: 20_000 });
    expect(r.verdict).toBe('notNow');
    expect(r.safeOnISO).toBe('2026-07-12');
  });

  it('falls back to payday when the run-rate is zero (flat zone never turns safe)', () => {
    const r = assessAffordImpact({ ...base, runRatePence: 0, amountPence: 20_000 });
    expect(r.verdict).toBe('notNow');
    expect(r.safeOnISO).toBe('2026-07-12');
  });

  it('finds the exact earlier date when a negative run-rate grows the zone daily', () => {
    // zone(t) = 10_000 + 2_000·t; safe needs 12_000 ≤ 0.45 · zone(t) → zone(t) ≥ 26_667
    // → t = 9 (zone 28_000, 0.45× = 12_600) is the first day that clears; t = 8 gives
    // 0.45 × 26_000 = 11_700 which does not.
    const r = assessAffordImpact({
      ...base,
      safeZonePence: 10_000,
      runRatePence: -2_000,
      amountPence: 12_000,
    });
    expect(r.verdict).toBe('notNow');
    expect(r.safeOnISO).toBe('2026-07-09');
  });

  it('returns payday itself when today already is payday', () => {
    const r = assessAffordImpact({
      ...base,
      safeZonePence: 100,
      amountPence: 20_000,
      todayISO: '2026-07-12',
    });
    expect(r.verdict).toBe('notNow');
    expect(r.safeOnISO).toBe('2026-07-12');
  });
});

describe('assessAffordImpact — input guards', () => {
  it('rejects a zero amount (checkAfford owns the guard)', () => {
    expect(() => assessAffordImpact({ ...base, amountPence: 0 })).toThrow(/must be positive/);
  });

  it('rejects fractional-pence amounts', () => {
    expect(() => assessAffordImpact({ ...base, amountPence: 99.5 })).toThrow(/integer pence/);
  });

  it('rejects a fractional-pence safe zone', () => {
    expect(() => assessAffordImpact({ ...base, safeZonePence: 18_400.25 })).toThrow(
      /integer pence/,
    );
  });

  it('rejects a fractional-pence run-rate', () => {
    expect(() => assessAffordImpact({ ...base, runRatePence: 1_500.5 })).toThrow(/integer pence/);
  });
});
