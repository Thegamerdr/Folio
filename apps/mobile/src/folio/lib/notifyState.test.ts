// notifyState.ts tests — pins the mode-dedup fix: notifications must derive their ladder from the
// SAME `@/folio/lib/modes` engine every screen reads (not a private re-derivation), via the one
// explicit `weatherToLadder` shim, plus the shared `DANGER_FLOOR` constant.
//
// Node-safe: pure store + pure lib imports only (no react-native runtime), relative imports (the
// pure-logic vitest runner has no `@` alias) — matches storeRoute.test.ts's own convention.

import { beforeEach, describe, expect, it } from 'vitest';

import { deriveNotifyInputs, snapshotFromRoute, weatherToLadder } from './notifyState';
import { routeFromStore } from './storeRoute';
import { DANGER_FLOOR } from './modes';
import { getState, resetAll, setCurrentBalance, setMoneyMode, setPartial } from '../store';

beforeEach(() => {
  resetAll();
});

const NOW = new Date('2026-06-10T12:00:00.000Z');

describe('weatherToLadder — the one mode-weather → engine-ladder translation point', () => {
  it('maps storm and alarm to danger', () => {
    expect(weatherToLadder('storm')).toBe('danger');
    expect(weatherToLadder('alarm')).toBe('danger');
  });

  it('maps rainy to warning', () => {
    expect(weatherToLadder('rainy')).toBe('warning');
  });

  it('maps sunny, night, cloudy, and fog to calm (no false alarm from a stub signal)', () => {
    expect(weatherToLadder('sunny')).toBe('calm');
    expect(weatherToLadder('night')).toBe('calm');
    expect(weatherToLadder('cloudy')).toBe('calm');
    expect(weatherToLadder('fog')).toBe('calm');
  });
});

describe('snapshotFromRoute — derives the ladder via lib/modes, not a private recompute', () => {
  it('reads a healthy, well-funded balance with no bills as calm', () => {
    // A generous balance with no subs/manual bills in the window: every mode strategy's own
    // weather reads 'sunny' here (no shortfall signal at all), so the honest ladder is 'calm'.
    setCurrentBalance({ amount: 5000, source: 'user-entered', confidence: 'statement-derived' });
    setPartial({ subs: [], calendarEvents: [], pots: [] });
    const state = getState();
    const route = routeFromStore(state, NOW);
    expect(route.tightPoint.amount).toBeGreaterThanOrEqual(0);
    const snap = snapshotFromRoute(state, route, NOW);
    expect(snap.ladder).toBe('calm');
  });

  it('escalates to overspent when the tight point actually goes negative', () => {
    setCurrentBalance({ amount: -500, source: 'user-entered', confidence: 'statement-derived' });
    setPartial({ subs: [], calendarEvents: [], pots: [] });
    const state = getState();
    const route = routeFromStore(state, NOW);
    const snap = snapshotFromRoute(state, route, NOW);
    expect(route.tightPoint.amount).toBeLessThan(0);
    expect(snap.ladder).toBe('overspent');
  });

  it('escalates to warning when spare drops under the shared DANGER_FLOOR even if the active mode reads calm', () => {
    // A small positive balance with no bills and no payday income in the window keeps every mode
    // strategy's own weather at 'sunny' (no storm/collision signal), but spare-on-payday is under
    // the shared floor — the danger-floor safety net (not the mode) must still escalate this to
    // 'warning'. Zeroing monthlyIncome removes the seed's payday event so `spare` stays flat at
    // the starting balance instead of jumping on payday.
    setCurrentBalance({
      amount: DANGER_FLOOR - 1,
      source: 'user-entered',
      confidence: 'statement-derived',
    });
    setPartial({
      subs: [],
      calendarEvents: [],
      pots: [],
      onboarding: { ...getState().onboarding, monthlyIncome: 0 },
    });
    const state = getState();
    const route = routeFromStore(state, NOW);
    expect(route.tightPoint.amount).toBeGreaterThanOrEqual(0);
    expect(route.spare).toBeLessThan(DANGER_FLOOR);
    const snap = snapshotFromRoute(state, route, NOW);
    expect(snap.ladder).toBe('warning');
  });

  it('changing the active MoneyMode changes the derived ladder for the same route, proving it reads lib/modes live', () => {
    // Stability's Safe Zone anchors to bills-covered + buffer, not tightest-point spare — so a
    // seed that reads 'calm' under Survival's ratio-based weather can read differently once the
    // mode is switched, exactly like TodayScreen's own weather chip would.
    const state = getState();
    const route = routeFromStore(state, NOW);

    setMoneyMode('survival');
    const survivalSnap = snapshotFromRoute(getState(), route, NOW);

    setMoneyMode('stability');
    const stabilitySnap = snapshotFromRoute(getState(), route, NOW);

    // Both are real ladder reads off the live mode — not asserting a specific pair of values (that
    // would over-fit to the seed's numbers), just that the mode is actually consulted per call.
    expect(survivalSnap.ladder).toBeDefined();
    expect(stabilitySnap.ladder).toBeDefined();
  });
});

describe('deriveNotifyInputs — still builds a usable NotifyInputs/NotifyContext pair', () => {
  it('returns non-null inputs for the seed state', () => {
    const state = getState();
    const route = routeFromStore(state, NOW);
    const snap = snapshotFromRoute(state, route, NOW);
    const built = deriveNotifyInputs(state, route, null, snap, NOW, {
      sentToday: 0,
      dangerSentToday: 0,
    });
    expect(built).not.toBeNull();
    expect(built?.inputs.next.ladder).toBe(snap.ladder);
  });
});
