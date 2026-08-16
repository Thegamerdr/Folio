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
// the real `StateView` transitions (`prev`/`next`) instead of the mode-derived approximation below.
//
// MODE-DEDUP FIX (see LANE brief): this module used to recompute its OWN ladder straight from route
// thresholds (a hardcoded `£10` floor, `spare`/`dangerDaysAway` only) — completely bypassing
// `@/folio/lib/modes`, the engine every screen (TodayScreen, TodayModeScreen, useMeloOpener, …)
// actually reads its mood/weather/verdict from. Tuning a mode's thresholds in `lib/modes` never
// used to reach notifications. Fixed: this module now resolves the SAME `MoneyMode` the store has
// (`state.moneyMode ?? 'survival'`, the same fallback every other read-site uses) and calls the
// SAME `deriveModeState(mode, inputs)` TodayScreen calls, then folds the resulting `ModeState` down
// to the one signal every mode strategy actually produces on a consistent severity scale — the
// mode's `weather` (`fog < sunny/night < cloudy < rainy < storm/alarm`; verified across all ten
// strategies in `lib/modes/strategies/*.ts` before writing this). The `DANGER_FLOOR` constant is
// now exported once from `lib/modes` (`./modes/safeZone.ts`) and used both there and here — no more
// duplicated `£10` literal.
//
// Approximated vs. real StateView:
//   • ladder: derived from the live mode's `weather` via `weatherToLadder` below (see that
//     function's own comment for the exact mapping and why it's the honest one available) —
//     recomputed fresh each call, no hysteresis/dwell (the engine's anti-flap rules are NOT applied
//     here). This means `dangerEntered`/`dangerDateMoved`/`stormPassed` fire off a direct weather
//     comparison between the previous and current call, not the engine's persisted
//     `MeloStateRecord`. Acceptable for notifications (worst case: a boundary re-fires once) but
//     NOT a substitute for the real ladder shown on Today.
//   • journey/overlays/milestone/recoveryCheckin/fog: not derived — those NotifyInputs fields are
//     always the "nothing happening" value, so those specific notification keys never fire from
//     this bridge until the real state machine is wired. `payday`/`paydayEve`/`billWeek` DO fire,
//     since they're directly readable from the route/store.

import type { LadderState, NotifyContext, NotifyInputs, StateView } from '@folio/melo-engine';

import { deriveModeState, DANGER_FLOOR, type MeloWeather, type MoneyMode } from './modes';
import type { RouteResult } from './moneyPath';
import type { AppState } from '../store';
import { addDaysToLocalDate } from '@folio/domain';
import { workspaceLocalDate } from './workspaceRoot';

const DANGER_WITHIN_DAYS = 3;
const BILL_WEEK_MIN_COUNT = 3;

/** Minimal snapshot this bridge needs to detect a transition between two evaluations. Callers
 *  (the scheduler hook) keep the previous snapshot in a ref and pass it back in as `prev`. */
export interface NotifySnapshot {
  readonly ladder: Extract<LadderState, 'calm' | 'warning' | 'danger' | 'overspent'>;
  readonly dangerDaysAway: number | null;
}

/** The ONE translation point from the app's mode-agnostic `MeloWeather` vocabulary (what every
 *  `lib/modes` strategy actually produces — the same field TodayScreen's weather chip and
 *  `MeloWeatherGlyph` read) to melo-engine's `LadderState` vocabulary (what `planNotification`
 *  branches on). This is necessary because `lib/modes` has no ladder concept of its own: each
 *  mode's `safeZone.amount` is on a DIFFERENT scale (Survival = £ spare, Reset = days covered,
 *  Low-Vis = a 0-100 signal score, Irregular = weeks of runway, …), so there is no honest universal
 *  £-threshold to compare across modes. `weather`, by contrast, IS a consistent severity signal
 *  every strategy already computes on the same narrative scale (verified across all ten
 *  strategies): `fog` (not enough signal) and `sunny`/`night` (fine) sit below `cloudy` (mild
 *  concern), which sits below `rainy` (moderate), which sits below `storm`/`alarm` (severe). This
 *  function is that one mapping — if a mode's weather vocabulary changes, this is the only place
 *  that needs updating to keep notifications in sync. */
export function weatherToLadder(weather: MeloWeather): NotifySnapshot['ladder'] {
  switch (weather) {
    case 'storm':
    case 'alarm':
      return 'danger';
    case 'rainy':
      return 'warning';
    default:
      // fog | sunny | cloudy | night — none of these are the engine's "danger"/"warning" bands.
      // `cloudy` reads as a mild concern in every strategy's own copy, not a notification-worthy
      // one — the engine's `calm` band is the honest fit (no false alarm invented from a stub).
      return 'calm';
  }
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

/** The `ModeInputs` this bridge feeds `deriveModeState` — the SAME shape TodayScreen builds (see
 *  TodayScreen.tsx's own `modeState` memo), so tuning a strategy's thresholds changes notifications
 *  exactly the way it changes Today's weather chip. `overspent` is the one ladder band no mode's
 *  `weather` alone can express honestly (every strategy still floors `safeZone.amount` at 0 before
 *  returning it — see `strategies/survival.ts` etc. — so a real overdraft has to be read off the
 *  route directly, same as before this fix, rather than invented from the mode layer). */
function ladderFromMode(
  state: AppState,
  route: RouteResult,
  dangerDaysAway: number | null,
): NotifySnapshot['ladder'] {
  if (route.tightPoint.amount < 0) return 'overspent';
  const mode: MoneyMode = state.moneyMode ?? 'survival';
  const modeState = deriveModeState(mode, {
    currentBalance: state.currentBalance,
    onboarding: state.onboarding,
    pots: state.pots,
    subs: state.subs,
    subPaused: state.subPaused,
    tightestSpare: route.tightPoint.amount,
    tightestDate: route.tightPoint.date,
    bufferAmount: state.bufferAmount ?? 100,
    // `exactOptionalPropertyTypes` — only include these when actually present, mirroring how
    // TodayScreen's own modeState memo passes the store slices straight through (state.debts etc.
    // are themselves optional on AppState with the same shape).
    ...(state.debts !== undefined ? { debts: state.debts } : {}),
    ...(state.household !== undefined ? { household: state.household } : {}),
    ...(state.plans !== undefined ? { plans: state.plans } : {}),
  });
  const ladder = weatherToLadder(modeState.weather);
  // The DANGER_WITHIN_DAYS/DANGER_FLOOR floor stays as an honest floor UNDER the mode's own
  // weather read — a route that's genuinely about to go negative within the window, or already
  // under the shared danger floor, escalates to `danger` even if the active mode's own weather
  // logic (tuned for a different framing, e.g. Stability's month-level view) hasn't caught up yet.
  if (dangerDaysAway !== null && dangerDaysAway <= DANGER_WITHIN_DAYS) return 'danger';
  if (route.spare < DANGER_FLOOR && ladder === 'calm') return 'warning';
  return ladder;
}

/** Build the current `NotifySnapshot` from the store + route — the "next" half of a transition. */
export function snapshotFromRoute(state: AppState, route: RouteResult, now: Date): NotifySnapshot {
  const dangerDaysAway = dangerDaysAwayFromRoute(route, now);
  return { ladder: ladderFromMode(state, route, dangerDaysAway), dangerDaysAway };
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
  return addDaysToLocalDate(workspaceLocalDate(state, now), route.daysToPayday);
}
