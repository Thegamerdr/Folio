// storeRoute bridge tests — the shared store→money-path mapping
// (apps/mobile/src/folio/lib/storeRoute.ts).
//
// `routeFromStore` is the pure half (state + an injected `now` → RouteResult);
// it owns the mapping TodayScreen used to inline. It builds the route from the
// SAME engine the Calendar uses — `deriveCalendarEvents` over a 35-day window —
// so the route's curve IS the Calendar's ladder by construction. These tests pin
// the corrected model faithful to the design's single engine
// (`computeSpareAndTightest(groupByDay(deriveCalendarEvents({windowDays:35,…})),
// currentBalance.amount)`, design ScreenToday.tsx):
//   - the path starts from the FULL `currentBalance.amount` (pots are dated
//     −perWeek dip events, NOT a flat earmark subtracted at the start);
//   - the sampled window is the fixed 35 days (the lowest point may fall before
//     OR after payday), so `points.length` is the window samples, not
//     `daysToPayday + 1`, and payday is not necessarily the last/max point;
//   - the route's tight point equals the Calendar ladder's minimum on the SAME
//     day (one number, one day — consistency).
// "Today" is the user's LOCAL calendar day, identical to what
// `deriveCalendarEvents` resolves internally, so `daysToPayday` is right on any
// host timezone (this machine is BST = UTC+1; a naive UTC slice would read 16).
// The reactive `useRoute` hook is a thin useMemo wrapper over this and is
// exercised on-device, not here.
//
// Node-safe: imports the pure bridge + the store singleton (both node-safe, no
// react-native runtime, no DOM), so it is collected by the apps/**/*.test.ts
// vitest runner. Relative imports — the runner has no `@` alias.

import { beforeEach, describe, expect, it } from 'vitest';

import { routeFromStore } from './storeRoute';
import { deriveCalendarEvents, groupByDay, computeSpareAndTightest } from './calendarEvents';
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

// The fixed forward window the route samples (today inclusive) — the SAME 35 the
// Calendar ladder uses, so a dip after payday (next month's start-of-month bills)
// is in both pictures or neither. `routeFromStore` keeps this private; the tests
// assert against the resulting sample count (windowDays + 1, today inclusive).
const ROUTE_WINDOW_DAYS = 35;

describe('routeFromStore — seed state', () => {
  it('yields a tight point with a real date and a positive days-to-payday', () => {
    const route = routeFromStore(seedState(), NOW);

    // The tight point lands on a concrete calendar day (ISO YYYY-MM-DD), not a
    // null/sample placeholder.
    expect(route.tightPoint.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isFinite(route.tightPoint.amount)).toBe(true);

    // Seed payday is the 25th; from the LOCAL 2026-06-10 that's 15 calendar days
    // out. (A naive UTC slice on this BST host would read 16 — the bug this pins.)
    expect(route.daysToPayday).toBe(15);

    // One sampled point per day across the fixed 35-day window, today inclusive —
    // NOT clipped at payday. The window samples (36) are independent of
    // days-to-payday (15): the lowest point may land before or after payday.
    expect(route.points.length).toBe(ROUTE_WINDOW_DAYS + 1);
    expect(route.points.length).toBeGreaterThan(route.daysToPayday + 1);
    expect(route.points[0]!.date).toBe(NOW);
    expect(route.points.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date))).toBe(true);

    // The tight point is genuinely the minimum of the sampled curve.
    const minY = Math.min(...route.points.map((p) => p.y));
    expect(route.tightPoint.amount).toBe(minY);
  });

  it('starts the path from the FULL current balance (pots are dated dips, not a start-of-path earmark)', () => {
    const state = seedState();
    const route = routeFromStore(state, NOW);

    // Faithful to the design's single engine: the curve anchors to the full
    // `currentBalance.amount` (~£720 on seed), NOT balance − Σ pots.saved. Pots
    // appear only as future dated −perWeek dips in the timeline, so day 0 — which
    // has no seed money movement — sits exactly at the raw balance.
    expect(route.points[0]!.y).toBe(state.currentBalance.amount);
    expect(route.points[0]!.y).toBe(720);
  });

  it('seed tight point is a sensible positive figure (~£136) — the design tightest', () => {
    const route = routeFromStore(seedState(), NOW);

    // The lowest point on the seed curve is a real, positive day-of-the-month
    // squeeze before payday, with the four recurring bills included. Rounds to
    // £136 — the same number the design's Today headline shows
    // (Math.max(0, round(tightestSpare))).
    expect(route.tightPoint.amount).toBeGreaterThan(0);
    expect(Math.round(route.tightPoint.amount)).toBe(136);
    expect(Math.max(0, Math.round(route.tightPoint.amount))).toBe(136);

    // It lands before payday (the start-of-month bill cluster lands after), so
    // payday is NOT where the curve bottoms out.
    expect(route.tightPoint.date < '2026-06-25').toBe(true);
  });

  it("route tight point equals the Calendar ladder's minimum on the same day (one number, one day)", () => {
    const state = seedState();
    const route = routeFromStore(state, NOW);

    // Recompute the Calendar ladder exactly as the design's Today does, from the
    // SAME engine over the SAME 35-day window, anchored to the same local day
    // (UTC midnight of NOW). The route's tight point must BE the ladder minimum —
    // same day, same number — not a separate calculation.
    const events = deriveCalendarEvents({
      subs: state.subs,
      subPaused: state.subPaused,
      subOverrides: state.subOverrides,
      onboarding: state.onboarding,
      manualEvents: state.calendarEvents,
      pots: state.pots,
      windowDays: ROUTE_WINDOW_DAYS,
      now: new Date(`${NOW}T00:00:00.000Z`),
    });
    const { tightestDate, tightestSpare } = computeSpareAndTightest(
      groupByDay(events),
      state.currentBalance.amount,
    );

    expect(route.tightPoint.date).toBe(tightestDate);
    expect(route.tightPoint.amount).toBe(tightestSpare);
  });

  it('is pure: same (state, now) → byte-identical RouteResult', () => {
    const state = seedState();
    expect(routeFromStore(state, NOW)).toEqual(routeFromStore(state, NOW));
  });

  it("rolls to next month when today is past this month's payday", () => {
    // 2026-06-26 is after the 25th, so the next payday is 2026-07-25 (the 25th is
    // a Saturday → payday-clamp shifts it to Fri 2026-07-24). The local-day anchor
    // is what makes this roll correctly; a UTC slice on a BST host would read the
    // 25th as still ahead and the roll would not fire.
    const route = routeFromStore(seedState(), '2026-06-26');
    expect(route.daysToPayday).toBeGreaterThan(0);
    // Payday lands next month, and the 35-day window samples past it.
    expect(route.points[route.daysToPayday]!.date >= '2026-07-01').toBe(true);
    expect(route.points[route.points.length - 1]!.date >= '2026-07-01').toBe(true);
  });

  it('payday income lifts the payday point above the pre-payday tight, and spare reads payday', () => {
    // Make onboarding income explicit and clear of any sub/spend noise on payday.
    setOnboarding({ monthlyIncome: 2180 });
    const route = routeFromStore(getState(), NOW);

    // `spare` is the balance ON PAYDAY — the curve read-out at the days-to-payday
    // sample, NOT the last sampled day (the window extends past payday into the
    // following month's bills).
    const paydayPoint = route.points[route.daysToPayday]!;
    expect(route.spare).toBe(paydayPoint.y);

    // Payday income (2180) lands, so the payday point sits well above the
    // pre-payday tight — but it is NOT necessarily the last/max sample, because
    // the curve dips again after payday on next month's start-of-month bills.
    expect(paydayPoint.y).toBeGreaterThan(route.tightPoint.amount);
    const lastPoint = route.points[route.points.length - 1]!;
    expect(lastPoint.date > paydayPoint.date).toBe(true); // window runs past payday
    expect(lastPoint.y).toBeLessThan(paydayPoint.y); // post-payday bills pull it back down
  });
});
