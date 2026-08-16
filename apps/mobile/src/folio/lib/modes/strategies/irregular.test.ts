// Irregular-strategy tests — pure-logic coverage for
// apps/mobile/src/folio/lib/modes/strategies/irregular.ts, focused on the
// DATA_INTELLIGENCE.md phase ⑥ history-fed income floor. Pre-existing
// runway/mood/weather behaviour (unaffected by this change when no history
// is supplied) is pinned once as a baseline; the bulk of the coverage is the
// new floor engaging at 3 months and staying off below it.
//
// Node-safe: touches only engine modules (no react-native runtime, no DOM),
// collected by the apps/**/*.test.ts runner via relative imports.

import { describe, expect, it } from 'vitest';

import { irregularStrategy } from './irregular';
import type { ModeInputs } from '../types';
import type { CurrentBalance, Onboarding, Transaction } from '../../../store';

function balance(amount: number): CurrentBalance {
  return {
    amount,
    source: 'statement',
    confidence: 'statement-derived',
    setAt: '2026-04-01T00:00:00Z',
  };
}

const ONBOARDING: Onboarding = { done: true, name: 'Test', payday: 25, monthlyIncome: 0 };

function baseInputs(overrides: Partial<ModeInputs> = {}): ModeInputs {
  return {
    currentBalance: balance(1000),
    onboarding: ONBOARDING,
    pots: [],
    subs: [],
    subPaused: {},
    tightestSpare: 0,
    tightestDate: null,
    ...overrides,
  };
}

function credit(when: string, amount: number): Transaction {
  return {
    id: `t-${when}-${amount}`,
    when,
    merchant: 'Client Payment',
    amount,
    category: 'income',
    source: 'manual',
  };
}

// ---------------------------------------------------------------------------
// Baseline (unchanged) behaviour — no transactions/todayISO supplied.
// ---------------------------------------------------------------------------
describe('irregularStrategy — baseline (no history supplied)', () => {
  it('uses the legacy £20 weekly floor when no bills are upcoming', () => {
    // available = 1000, weeklyBills = max(20, 0/4.33) = 20 -> runway = 50
    const state = irregularStrategy.derive(baseInputs());
    expect(state.safeZone.amount).toBe(50);
    expect(state.safeZone.formula).toBe('weeks of bills covered');
    expect(state.safeZone.confidence).toBe('high');
  });

  it('still uses the legacy floor when transactions are supplied but todayISO is not', () => {
    const transactions = [
      credit('2026-01-05', 2000),
      credit('2026-02-05', 2000),
      credit('2026-03-05', 2000),
    ];
    const state = irregularStrategy.derive(baseInputs({ transactions }));
    expect(state.safeZone.formula).toBe('weeks of bills covered');
  });

  it('still uses the legacy floor when todayISO is supplied but transactions are empty', () => {
    const state = irregularStrategy.derive(
      baseInputs({ transactions: [], todayISO: '2026-04-01' }),
    );
    expect(state.safeZone.formula).toBe('weeks of bills covered');
  });
});

// ---------------------------------------------------------------------------
// History-fed floor — engages at >= 3 full past months, unchanged below.
// ---------------------------------------------------------------------------
describe('irregularStrategy — history-fed income floor', () => {
  it('below 3 full months of income history, the floor is UNCHANGED (legacy £20)', () => {
    // Only 2 full past months (Jan, Feb) before todayISO in March.
    const transactions = [credit('2026-01-10', 400), credit('2026-02-10', 400)];
    const state = irregularStrategy.derive(
      baseInputs({ currentBalance: balance(400), transactions, todayISO: '2026-03-15' }),
    );
    // weeklyBills = max(20, 0) = 20 -> runway = floor(400/20) = 20
    expect(state.safeZone.amount).toBe(20);
    expect(state.safeZone.formula).toBe('weeks of bills covered');
    expect(state.safeZone.confidence).toBe('high');
  });

  it('at exactly 3 full months of history, the p20 floor engages', () => {
    // 3 full past months (Jan, Feb, Mar) before todayISO in April, all equal
    // -> p20 of [400,400,400] = 400 -> weeklyBills = 400/4.33 ≈ 92.4
    const transactions = [
      credit('2026-01-10', 400),
      credit('2026-02-10', 400),
      credit('2026-03-10', 400),
    ];
    const state = irregularStrategy.derive(
      baseInputs({ currentBalance: balance(1000), transactions, todayISO: '2026-04-15' }),
    );
    expect(state.safeZone.formula).toBe('weeks of bills covered, estimated from recent income');
    expect(state.safeZone.confidence).toBe('estimating');
    // runway = floor(1000 / (400/4.33)) = floor(1000/92.379...) = 10
    expect(state.safeZone.amount).toBe(10);
  });

  it('the p20 floor is a conservative lower percentile, not the mean, across an uneven series', () => {
    // Income varies: a low month of 200 pulls p20 well below the mean.
    const transactions = [
      credit('2026-01-10', 200),
      credit('2026-02-10', 1000),
      credit('2026-03-10', 1000),
    ];
    const state = irregularStrategy.derive(
      baseInputs({ currentBalance: balance(1000), transactions, todayISO: '2026-04-15' }),
    );
    // p20([200,1000,1000]) via linear interpolation: sorted [200,1000,1000],
    // rank = 0.2*2 = 0.4 -> 200 + 0.4*(1000-200) = 520 -> weeklyBills ≈ 120.09
    // runway = floor(1000/120.09) = 8
    expect(state.safeZone.amount).toBe(8);
  });

  it('the history floor never LOWERS runway below what upcoming bills alone would require', () => {
    // A thin p20 (e.g. 43.3/wk) must not override a heavier real upcoming-bills load.
    const transactions = [
      credit('2026-01-10', 100),
      credit('2026-02-10', 100),
      credit('2026-03-10', 100),
    ];
    const heavySub = {
      name: 'Rent',
      cost: 866, // 866/4.33 = 200/wk, far above p20(100)/4.33 ≈ 23.09
      nextRenewalDaysAway: 10,
      lastUsedDaysAgo: 0,
      usesPerMonth: 1,
    };
    const state = irregularStrategy.derive(
      baseInputs({
        currentBalance: balance(1000),
        subs: [heavySub],
        transactions,
        todayISO: '2026-04-15',
      }),
    );
    // weeklyBills = max(23.09, 200) = 200 -> runway = floor(1000/200) = 5
    expect(state.safeZone.amount).toBe(5);
  });

  it('copy reflects estimate-ness whenever the history floor changed the number', () => {
    const transactions = [
      credit('2026-01-10', 400),
      credit('2026-02-10', 400),
      credit('2026-03-10', 400),
    ];
    const state = irregularStrategy.derive(
      baseInputs({ currentBalance: balance(2000), transactions, todayISO: '2026-04-15' }),
    );
    // runway well above 4 (sunny/cloudy band) — verdict should say "estimating".
    expect(state.verdict.toLowerCase()).toContain('estimating');
  });
});
