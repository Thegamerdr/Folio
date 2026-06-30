// storeRoute bridge tests — the shared store→money-path mapping
// (apps/mobile/src/folio/lib/storeRoute.ts).
//
// `routeFromStore` is the pure half (state + an injected `now` → RouteResult);
// it owns the mapping TodayScreen used to inline. It builds the route from the
// SAME engine the Calendar uses — `deriveCalendarEvents` over a 35-day window —
// so the route's curve IS the Calendar's ladder by construction. These tests pin
// the earmark model
// (`computeSpareAndTightest(groupByDay(deriveCalendarEvents({windowDays:35,…})),
// currentBalance.amount − Σ pots.saved)`):
//   - the path starts from `currentBalance.amount − Σ pots.saved` — the
//     already-saved pot cash is earmarked OUT of visible spare (the "saved amount
//     lowers Today's spare" rule). The pots' FUTURE −perWeek contributions enter
//     as DATED dip events ("bends the path") — two DISTINCT effects, no
//     double-count (Σ saved = past cash already set aside; the dips = future
//     contributions). `pots: []` is passed to computeRoute (no flat plateau);
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

  it('earmarks saved pot cash OUT of the start: path begins at balance − Σ pots.saved', () => {
    const state = seedState();
    const route = routeFromStore(state, NOW);

    // The already-SAVED pot cash is set aside, so it lowers Today's spare: the
    // curve anchors to `currentBalance.amount − Σ pots.saved`, NOT the full
    // balance. The pots' FUTURE −perWeek contributions are separate dated dips in
    // the timeline ("bends the path"), so day 0 — which has no seed money movement
    // — sits exactly at the earmarked start (£720 balance − £620 saved = £100), a
    // DISTINCT effect from the dips (no double-count).
    const sigmaSaved = state.pots.reduce((acc, p) => acc + p.saved, 0);
    expect(sigmaSaved).toBe(620); // 420 + 140 + 60
    expect(route.points[0]!.y).toBe(state.currentBalance.amount - sigmaSaved);
    expect(route.points[0]!.y).toBe(100);
  });

  it('does NOT double-count pots: earmark is a single flat start offset, the dated dips are separate', () => {
    const state = seedState();
    const route = routeFromStore(state, NOW);
    const sigmaSaved = state.pots.reduce((acc, p) => acc + p.saved, 0);

    // The earmark must be EXACTLY Σ saved once — the whole curve sits Σ saved below
    // the full-balance model on every day, no more (folding the future −perWeek
    // dips into the start would push it lower than −Σ saved). Recompute the
    // full-balance ladder and confirm the gap is precisely Σ saved on the start
    // point AND on the tight point — i.e. a single flat offset, the dated dips
    // untouched.
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
    const full = computeSpareAndTightest(groupByDay(events), state.currentBalance.amount);

    // Start: full balance − the SAME Σ saved (no extra dip subtracted at day 0).
    expect(route.points[0]!.y).toBeCloseTo(state.currentBalance.amount - sigmaSaved, 10);
    // Tight point: exactly Σ saved below the full-balance tightest, same day —
    // proving the future weekly dips are still counted once (in the events), not
    // again at the start.
    expect(route.tightPoint.date).toBe(full.tightestDate);
    expect(full.tightestSpare - route.tightPoint.amount).toBeCloseTo(sigmaSaved, 10);
  });

  it('seed tight point goes negative once pots are earmarked; Today clamps the hero to £0', () => {
    const route = routeFromStore(seedState(), NOW);

    // Earmarking £620 of saved pot cash drops the lowest point £620 below the old
    // full-balance figure (£136.03 → −£483.97), the honest "tight before payday"
    // signal: this person's spendable money runs out before payday once the pots
    // are set aside. The raw curve is allowed negative — it is the truth.
    expect(route.tightPoint.amount).toBeLessThan(0);
    expect(Math.round(route.tightPoint.amount)).toBe(-484);

    // The Today hero applies the existing floor `Math.max(0, round(tightestSpare))`
    // (TodayScreen.tsx) — so the headline reads £0, not a negative number, while
    // the underlying route stays honest.
    expect(Math.max(0, Math.round(route.tightPoint.amount))).toBe(0);

    // It still lands before payday (the start-of-month bill cluster lands after),
    // so payday is NOT where the curve bottoms out. The earmark is a flat offset,
    // so the tight DAY is unchanged from the full-balance model.
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
    // Anchor the ladder to the SAME earmarked start the route uses
    // (`currentBalance.amount − Σ pots.saved`) so the two agree by construction.
    const sigmaSaved = state.pots.reduce((acc, p) => acc + p.saved, 0);
    const { tightestDate, tightestSpare } = computeSpareAndTightest(
      groupByDay(events),
      state.currentBalance.amount - sigmaSaved,
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
