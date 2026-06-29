// storeRoute bridge tests — the shared store→money-path mapping
// (apps/mobile/src/folio/lib/storeRoute.ts).
//
// `routeFromStore` is the pure half (state + an injected `now` → RouteResult);
// it owns the mapping TodayScreen used to inline, so these tests pin that the
// seed state yields an honest tight point (a real date) and a positive
// days-to-payday, and that the mapping wires the right store fields onto the
// engine. The reactive `useRoute` hook is a thin useMemo wrapper over this and
// is exercised on-device, not here.
//
// Node-safe: imports the pure bridge + the store singleton (both node-safe, no
// react-native runtime, no DOM), so it is collected by the apps/**/*.test.ts
// vitest runner. Relative imports — the runner has no `@` alias.

import { beforeEach, describe, expect, it } from 'vitest';

import { routeFromStore } from './storeRoute';
import { getState, resetAll, setOnboarding, type AppState } from '../store';

// The store is a module-level singleton; reset to its known seed before each test
// so `getState()` is the deterministic seed (default subs/pots/onboarding/balance).
beforeEach(() => {
  resetAll();
});

/** The seed AppState — exactly what a first-run device loads. */
function seedState(): AppState {
  return getState();
}

// A fixed mid-month "today" well before the seed payday (25th) so the next
// payday is this month's 25th and days-to-payday is unambiguously positive.
const NOW = '2026-06-10';

describe('routeFromStore — seed state', () => {
  it('yields a tight point with a real date and a positive days-to-payday', () => {
    const route = routeFromStore(seedState(), NOW);

    // The tight point lands on a concrete calendar day (ISO YYYY-MM-DD), not a
    // null/sample placeholder.
    expect(route.tightPoint.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isFinite(route.tightPoint.amount)).toBe(true);

    // Seed payday is the 25th; from 2026-06-10 that's 15 calendar days out.
    expect(route.daysToPayday).toBe(15);

    // One sampled point per day, today → payday inclusive, all dated.
    expect(route.points.length).toBe(route.daysToPayday + 1);
    expect(route.points[0]!.date).toBe(NOW);
    expect(route.points.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date))).toBe(true);

    // The tight point is genuinely the minimum of the sampled curve.
    const minY = Math.min(...route.points.map((p) => p.y));
    expect(route.tightPoint.amount).toBe(minY);
  });

  it('starts the path from the seed balance, lowered by earmarked pots', () => {
    const state = seedState();
    const route = routeFromStore(state, NOW);

    // The first sampled day is the starting balance minus Σ pots.saved (the flat
    // earmark) plus whatever money moves on day 0 — never above the raw balance.
    const potsTotal = state.pots.reduce((sum, p) => sum + p.saved, 0);
    expect(route.points[0]!.y).toBeLessThanOrEqual(state.currentBalance.amount - potsTotal);
  });

  it('is pure: same (state, now) → byte-identical RouteResult', () => {
    const state = seedState();
    expect(routeFromStore(state, NOW)).toEqual(routeFromStore(state, NOW));
  });

  it('rolls to next month when today is past this month\'s payday', () => {
    // 2026-06-26 is after the 25th, so the next payday is 2026-07-25 (the 25th
    // is a Saturday → payday-clamp shifts it to Fri 2026-07-24).
    const route = routeFromStore(seedState(), '2026-06-26');
    expect(route.daysToPayday).toBeGreaterThan(0);
    expect(route.points[route.points.length - 1]!.date >= '2026-07-01').toBe(true);
  });

  it('income lifts the payday point above the pre-payday plateau', () => {
    // Make onboarding income explicit and clear of any sub/spend noise on payday.
    setOnboarding({ monthlyIncome: 2180 });
    const route = routeFromStore(getState(), NOW);
    const payday = route.points[route.points.length - 1]!;
    // The seed income (2180) lands on payday, so the final day is the curve's max.
    const maxY = Math.max(...route.points.map((p) => p.y));
    expect(payday.y).toBe(maxY);
  });
});
