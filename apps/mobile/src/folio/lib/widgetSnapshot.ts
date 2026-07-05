/**
 * Widget snapshot builder — the pure fn that turns live store state into the tiny
 * JSON blob the Android home-screen widget renders. Deliberately store-agnostic and
 * side-effect-free (mirrors `routeFromStore` / `safeZoneMath`'s own contract) so it is
 * unit-testable in Node and reusable from both the app-side writer and any future
 * caller without dragging React or native modules into the import graph.
 *
 * Numbers are carried in PENCE (integers) — the widget's own Java/Kotlin RemoteViews
 * layer and any native bridge code should never juggle floats for money. The app-side
 * store keeps pounds as floats (see `store.ts` CurrentBalance.amount), so this module
 * does the one conversion at the boundary.
 *
 * Feeds `widgetTaskHandler.ts` (which reads the persisted snapshot and renders
 * `SafeZoneWidget`) and `widgetSnapshotWriter.ts` (the app-side subscriber that
 * recomputes + persists it on every store change).
 */
import { safeZoneMath } from './modes/safeZone';
import { routeFromStore } from './storeRoute';
import { deriveModeState, type MeloWeather } from './modes';
import type { AppState } from '../store';

export type SafeZoneWidgetSnapshot = {
  /** Safe Zone amount, signed, in PENCE. Matches `safeZoneMath(...).total` (floored to
   *  whole pounds by that engine) × 100 — never re-derives its own rounding. */
  safeZonePence: number;
  /** Safe Zone spend-per-day, in PENCE. `safeZoneMath(...).perDay` × 100. */
  perDayPence: number;
  /** ISO date (YYYY-MM-DD) of the resolved next payday, or `null` when the store has
   *  no honest date yet (matches the app's own "no data" honesty rule — never guess). */
  paydayISO: string | null;
  /** Mode-derived weather word (`sunny` / `rainy` / ...). Same vocabulary + derivation
   *  Today's lens+weather chip uses (`deriveModeState('survival', ...).weather`). */
  weather: MeloWeather;
  /** True when the store has never had a real balance set (`currentBalance.source ===
   *  'sample'`) — the widget's empty/honest-preview state ("Open Folio to set up"). */
  isSample: boolean;
};

const PENCE_PER_POUND = 100;
const MS_PER_DAY = 86_400_000;

function toPence(pounds: number): number {
  return Math.round(pounds * PENCE_PER_POUND);
}

/** A Date → LOCAL-calendar ISO day "YYYY-MM-DD" (host-tz aware). Mirrors
 *  `storeRoute.ts`'s private `isoDayLocal` — duplicated rather than imported since that
 *  helper isn't exported and this module must stay a leaf the store bridge can't
 *  depend back on. */
function isoDayLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** `RouteResult` carries `daysToPayday` (a day COUNT) but not the resolved payday date
 *  itself — `routeFromStore` keeps that internal. Reconstruct the ISO date the same way
 *  its own "today" is defined (the LOCAL calendar day) plus that day count, so this
 *  never drifts from the date the route/Calendar/Today all already agree on. */
function paydayIsoFrom(now: Date | string, daysToPayday: number): string {
  const nowDate = typeof now === 'string' ? new Date(`${now}T00:00:00`) : now;
  const todayIso = isoDayLocal(nowDate);
  const todayLocalMidnight = new Date(`${todayIso}T00:00:00`);
  const paydayMs = todayLocalMidnight.getTime() + daysToPayday * MS_PER_DAY;
  return isoDayLocal(new Date(paydayMs));
}

/**
 * Build the widget snapshot from a full `AppState` + the caller's "now". Pure — no
 * store reads, no `Date.now()` unless `now` is omitted (matches `routeFromStore`'s own
 * default-param escape hatch, kept for parity; every real caller should pass `now`
 * explicitly).
 */
export function buildWidgetSnapshot(
  state: AppState,
  now: Date | string = new Date(),
): SafeZoneWidgetSnapshot {
  const route = routeFromStore(state, now);
  const bufferAmount = state.bufferAmount ?? 100;
  const paydayISO = paydayIsoFrom(now, route.daysToPayday);

  const safeZone = safeZoneMath({
    currentBalance: state.currentBalance,
    onboarding: state.onboarding,
    pots: state.pots,
    subs: state.subs,
    subPaused: state.subPaused,
    tightestSpare: route.tightPoint.amount,
    tightestDate: paydayISO,
    bufferAmount,
  });

  const modeState = deriveModeState('survival', {
    currentBalance: state.currentBalance,
    onboarding: state.onboarding,
    pots: state.pots,
    subs: state.subs,
    subPaused: state.subPaused,
    tightestSpare: route.tightPoint.amount,
    tightestDate: paydayISO,
    bufferAmount,
  });

  return {
    safeZonePence: toPence(safeZone.total),
    perDayPence: toPence(safeZone.perDay),
    paydayISO: state.currentBalance.source === 'sample' ? null : paydayISO,
    weather: modeState.weather,
    isSample: state.currentBalance.source === 'sample',
  };
}
