import { describe, expect, it } from 'vitest';

import {
  buildLocalRouteSummary,
  createEmptyLocalLedgerState,
  setTightPointGoal,
  type LocalLedgerState,
} from './localLedger.js';
import { setTightPointGoalThroughCanonicalRepository } from './canonicalLedgerMutations.js';
import { deriveGoalSignal } from './localTodayPathAdapter.js';

// The tight-point goal is the user's "Melo-set floor" — a real per-user scalar (minor units, or
// null). These tests prove: it sets and clears immutably and persists across the canonical boundary,
// and that breachesGoal flips true/false correctly once projected onto the route.

function baseLedger(): LocalLedgerState {
  return { ...createEmptyLocalLedgerState('2026-06-28'), cashOnHandMinor: 50_000 };
}

describe('setTightPointGoal mutator', () => {
  it('defaults to null on a fresh ledger', () => {
    expect(baseLedger().tightPointGoalMinor).toBeNull();
  });

  it('sets the goal as a whole minor amount and records history', () => {
    const next = setTightPointGoal(baseLedger(), 40_000);
    expect(next.tightPointGoalMinor).toBe(40_000);
    expect(next.history[0]?.kind).toBe('tight_point_goal_set');
  });

  it('clears the goal back to null', () => {
    const withGoal = setTightPointGoal(baseLedger(), 40_000);
    const cleared = setTightPointGoal(withGoal, null);
    expect(cleared.tightPointGoalMinor).toBeNull();
  });

  it('does not mutate the input state', () => {
    const base = baseLedger();
    setTightPointGoal(base, 40_000);
    expect(base.tightPointGoalMinor).toBeNull();
  });

  it('rejects a negative goal', () => {
    expect(() => setTightPointGoal(baseLedger(), -100)).toThrow();
  });

  it('persists set then clear through the canonical boundary', () => {
    const set = setTightPointGoalThroughCanonicalRepository(baseLedger(), 25_000);
    expect(set.tightPointGoalMinor).toBe(25_000);
    const cleared = setTightPointGoalThroughCanonicalRepository(set, null);
    expect(cleared.tightPointGoalMinor).toBeNull();
  });
});

describe('breachesGoal across the route boundary', () => {
  it('is false when no goal is set', () => {
    const ledger = baseLedger();
    const route = buildLocalRouteSummary(ledger);
    const signal = deriveGoalSignal(ledger, route);
    expect(signal.tightPointGoalMinor).toBeNull();
    expect(signal.breachesGoal).toBe(false);
  });

  it('is false when the tightest balance stays at or above the goal', () => {
    // Floor below the tightest balance (cash 50,000, no future outflows) → no breach.
    const ledger = setTightPointGoal(baseLedger(), 10_000);
    const route = buildLocalRouteSummary(ledger);
    expect(route.tightestBalanceMinor).toBeGreaterThanOrEqual(10_000);
    expect(deriveGoalSignal(ledger, route).breachesGoal).toBe(false);
  });

  it('is true when the tightest balance falls below the goal', () => {
    // Floor above the tightest balance → breach.
    const ledger = setTightPointGoal(baseLedger(), 80_000);
    const route = buildLocalRouteSummary(ledger);
    expect(route.tightestBalanceMinor).toBeLessThan(80_000);
    expect(deriveGoalSignal(ledger, route).breachesGoal).toBe(true);
  });
});
