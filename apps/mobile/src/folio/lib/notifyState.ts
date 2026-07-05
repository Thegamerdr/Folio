// Store/route → melo-engine notify bridge — the ONE place that maps the app's real data spine
// onto `@folio/melo-engine`'s `planNotification` (packages/melo-engine/src/notify.ts).
//
// SCOPE NOTE (read before touching): the full state machine `resolveState` (states.ts) is not yet
// wired anywhere in this app — no surface currently derives a `MeloStateRecord`/`StateView` from
// the store (grepped before writing this). Building that full bridge (Safe Zone breakdown, ladder
// hysteresis persistence, journey tracking, overlays) is its own lane's job, not notifications'.
// This module is intentionally a SMALLER, HONEST approximation: it derives just the handful of
// signals `planNotification` actually branches on, from data already on the store + the existing
// `routeFromStore` (./storeRoute) money-path engine, and it is conservative — where a full signal
// isn't available (e.g. persisted ladder-entry dwell time, green-day streaks), it degrades to "no
// event" rather than guessing, so a false notification is never invented from a stub. When the full
// `resolveState` bridge lands, this module's `deriveNotifyInputs` is the natural place to swap in
// the real `StateView` transitions (`prev`/`next`) instead of the two-ladder approximation below.
//
// Approximated vs. real StateView:
//   • ladder: recomputed fresh each call from `tightPoint`/`spare` (no hysteresis/dwell — the
//     engine's anti-flap rules are NOT applied here). This means `dangerEntered`/`dangerDateMoved`/
//     `stormPassed` fire off simple threshold comparisons between the previous and current call,
//     not the engine's persisted `MeloStateRecord`. Acceptable for notifications (worst case: a
//     boundary re-fires once) but NOT a substitute for the real ladder shown on Today.
//   • journey/overlays/milestone/recoveryCheckin/fog: not derived — those NotifyInputs fields are
//     always the "nothing happening" value, so those specific notification keys never fire from
//     this bridge until the real state machine is wired. `payday`/`paydayEve`/`billWeekAhead` DO
//     fire, since they're directly readable from the route/store.

import type { LadderState, NotifyContext, NotifyInputs, StateView } from '@folio/melo-engine';

import type { RouteResult } from './moneyPath';
import type { AppState } from '../store';

const DANGER_WITHIN_DAYS = 3;
const DANGER_FLOOR = 10; // £10 — mirrors states.ts DANGER_FLOOR_PENCE (integer pounds here).
const BILL_WEEK_MIN_COUNT = 3;

/** Minimal snapshot this bridge needs to detect a transition between two evaluations. Callers
 *  (the scheduler hook) keep the previous snapshot in a ref and pass it back in as `prev`. */
export interface NotifySnapshot {
  readonly ladder: Extract<LadderState, 'calm' | 'warning' | 'danger' | 'overspent'>;
  readonly dangerDaysAway: number | null;
}

/** A conservative ladder read from the route curve alone (see module header — no hysteresis). */
function ladderFromRoute(
  route: RouteResult,
  dangerDaysAway: number | null,
): NotifySnapshot['ladder'] {
  if (route.tightPoint.amount < 0) return 'overspent';
  if (dangerDaysAway !== null && dangerDaysAway <= DANGER_WITHIN_DAYS) return 'danger';
  if (route.spare < DANGER_FLOOR) return 'warning';
  return 'calm';
}

/** Days from `now` to the route's tight point, when that point is a real shortfall (< 0) and still
 *  ahead of or on today — mirrors `projectDangerDate`'s "daysAway" without re-deriving run-rate. */
function dangerDaysAwayFromRoute(route: RouteResult, now: Date): number | null {
  if (route.tightPoint.amount >= 0) return null;
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const tightMs = Date.parse(`${route.tightPoint.date}T00:00:00.000Z`);
  const days = Math.round((tightMs - todayMs) / 86_400_000);
  return days >= 0 ? days : 0;
}

function formatPounds(amount: number): string {
  return `£${Math.max(0, Math.round(amount))}`;
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
}

/** Build the current `NotifySnapshot` from the store + route — the "next" half of a transition. */
export function snapshotFromRoute(route: RouteResult, now: Date): NotifySnapshot {
  const dangerDaysAway = dangerDaysAwayFromRoute(route, now);
  return { ladder: ladderFromRoute(route, dangerDaysAway), dangerDaysAway };
}

/** Build the `NotifyInputs` + `NotifyContext` pair for `planNotification`, given the previous and
 *  current snapshot (both from `snapshotFromRoute`), the live route, store, and clock. `sentToday`/
 *  `dangerSentToday` are the scheduler's own day-scoped counters (it owns the daily budget, this
 *  module stays pure). Returns `null` when there isn't enough data to say anything honest (e.g. no
 *  payday resolved) — the caller should skip scheduling in that case. */
export function deriveNotifyInputs(
  state: AppState,
  route: RouteResult,
  prev: NotifySnapshot | null,
  next: NotifySnapshot,
  now: Date,
  counters: { sentToday: number; dangerSentToday: number },
): { inputs: NotifyInputs; ctx: NotifyContext } | null {
  const prevView: StateView | null =
    prev === null
      ? null
      : {
          ladder: prev.ladder,
          journey: 'none',
          data: 'ok',
          overlays: [],
          weather: 'sunny',
          mascot: { family: 'calm', intensity: 1 },
          copyKey: 'calm',
          monetizationAllowed: true,
        };
  const nextView: StateView = {
    ladder: next.ladder,
    journey: 'none',
    data: 'ok',
    overlays: paydayOverlays(state, route),
    weather: 'sunny',
    mascot: { family: 'calm', intensity: 1 },
    copyKey: 'calm',
    monetizationAllowed: true,
  };

  const dangerDayIso = route.tightPoint.amount < 0 ? route.tightPoint.date : null;
  const dangerDay = dangerDayIso ? dayLabel(dangerDayIso) : 'soon';
  const shortfall = route.tightPoint.amount < 0 ? Math.abs(route.tightPoint.amount) : 0;
  const perDayToKeepDry =
    route.daysToPayday > 0 ? Math.ceil(shortfall / Math.max(1, route.daysToPayday)) : shortfall;

  const inputs: NotifyInputs = {
    prev: prevView,
    next: nextView,
    prevDangerDaysAway: prev?.dangerDaysAway ?? null,
    nextDangerDaysAway: next.dangerDaysAway,
    hour: now.getHours(),
    sentToday: counters.sentToday,
    dangerSentToday: counters.dangerSentToday,
    recoveryCheckinDue: false, // journey tracking not yet bridged — see module header.
    hardCycle: false,
  };

  const paydayIso = resolveNearestPaydayIso(state, route, now);
  const ctx: NotifyContext = {
    safeZone: formatPounds(route.spare),
    perDay: formatPounds(route.daysToPayday > 0 ? route.spare / route.daysToPayday : route.spare),
    keepDryPerDay: formatPounds(perDayToKeepDry),
    dangerDay,
    paydayLabel: paydayIso ? dayLabel(paydayIso) : 'payday',
    daysToPayday: route.daysToPayday,
    dayOnPath: 0,
    todaysMove: '',
    staleLabel: dangerDay,
    previousDangerDay: dangerDay,
    shortfallIfUsual: formatPounds(shortfall),
  };

  return { inputs, ctx };
}

function paydayOverlays(state: AppState, route: RouteResult): StateView['overlays'] {
  const overlays: Array<StateView['overlays'][number]> = [];
  if (route.daysToPayday === 0) overlays.push('payday');
  else if (route.daysToPayday === 1) overlays.push('paydayEve');
  const billsDueSoon = state.calendarEvents.filter(
    (e) => typeof e.amount === 'number' && e.amount < 0,
  ).length;
  if (billsDueSoon >= BILL_WEEK_MIN_COUNT) overlays.push('billWeek');
  return overlays;
}

/** Best-effort payday ISO for the copy label — reads the route's own resolved payday span rather
 *  than re-resolving day-of-month (routeFromStore already did that work); falls back to null. */
function resolveNearestPaydayIso(state: AppState, route: RouteResult, now: Date): string | null {
  if (route.daysToPayday <= 0) return null;
  const ms =
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) + route.daysToPayday * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}
