// Stability-strategy tests — pure-logic coverage for
// apps/mobile/src/folio/lib/modes/strategies/stability.ts, focused on the storm
// verdict split. Regression for a live defect (owner's phone, 2026-07-11): a
// buffer breach with ZERO near-term bills rendered "Bill collision this week"
// (balance £0, 0 bills scheduled, buffer £100 → storm → hardcoded collision
// copy). Storm names its true cause now, and the formula caption's buffer claim
// comes from the same accounting instead of a hardcoded "protected" suffix.
//
// Node-safe: touches only engine modules (no react-native runtime, no DOM),
// collected by the apps/**/*.test.ts runner via relative imports.

import { describe, expect, it } from 'vitest';

import { stabilityStrategy } from './stability';
import type { ModeInputs } from '../types';
import type { CurrentBalance, Onboarding, Sub } from '../../../store';

function balance(amount: number): CurrentBalance {
  return {
    amount,
    source: 'statement',
    confidence: 'statement-derived',
    setAt: '2026-04-01T00:00:00Z',
  };
}

const ONBOARDING: Onboarding = { done: true, name: 'Test', payday: 25, monthlyIncome: 0 };

function sub(name: string, cost: number, nextRenewalDaysAway: number): Sub {
  return { name, cost, nextRenewalDaysAway, lastUsedDaysAgo: 0, usesPerMonth: 4 };
}

function baseInputs(overrides: Partial<ModeInputs> = {}): ModeInputs {
  return {
    currentBalance: balance(1000),
    onboarding: ONBOARDING,
    pots: [],
    subs: [],
    subPaused: {},
    bufferAmount: 100,
    tightestSpare: 0,
    tightestDate: null,
    ...overrides,
  };
}

describe('stabilityStrategy — storm verdict names its true cause', () => {
  it('buffer breach with zero bills does NOT claim a bill collision (live regression)', () => {
    // The owner's exact phone state: balance £0, no subs, buffer £100.
    const state = stabilityStrategy.derive(baseInputs({ currentBalance: balance(0) }));
    expect(state.weather).toBe('storm');
    expect(state.verdict).toBe('Buffer not covered right now. The month needs a look.');
    expect(state.verdict).not.toContain('collision');
    expect(state.safeZone.amount).toBe(0); // hero stays floored at £0 by design
    expect(state.safeZone.formula).toBe('safe to spend this month · buffer £100 not fully covered');
  });

  it('a real bill collision keeps the collision verdict', () => {
    // Two active bills 2 days apart inside the 7-day window; balance high enough
    // that the buffer is intact, so storm can ONLY have come from the collision.
    const state = stabilityStrategy.derive(
      baseInputs({ subs: [sub('Rent', 500, 2), sub('Energy', 80, 4)] }),
    );
    expect(state.weather).toBe('storm');
    expect(state.verdict).toBe('Bill collision this week. One small move covers it.');
  });

  it('breach + collision together lead with the collision (the actionable one)', () => {
    const state = stabilityStrategy.derive(
      baseInputs({ currentBalance: balance(0), subs: [sub('Rent', 500, 2), sub('Energy', 80, 4)] }),
    );
    expect(state.weather).toBe('storm');
    expect(state.verdict).toBe('Bill collision this week. One small move covers it.');
  });
});

describe('stabilityStrategy — formula caption matches the accounting', () => {
  it('claims the buffer is protected only when the month-safe amount holds', () => {
    const state = stabilityStrategy.derive(baseInputs());
    expect(state.safeZone.formula).toBe('safe to spend this month · buffer £100 protected');
    expect(state.verdict).toBe('Bills covered. The month holds.');
    expect(state.weather).toBe('sunny');
  });

  it('cloudy (thin but intact buffer) keeps the thin-buffer verdict', () => {
    // monthSafeAmount = 130 − 100 = 30, which is ≥ 0 but < buffer × 0.5.
    const state = stabilityStrategy.derive(baseInputs({ currentBalance: balance(130) }));
    expect(state.weather).toBe('cloudy');
    expect(state.verdict).toBe("Bills covered. Buffer's a little thin.");
    expect(state.safeZone.formula).toBe('safe to spend this month · buffer £100 protected');
  });
});
