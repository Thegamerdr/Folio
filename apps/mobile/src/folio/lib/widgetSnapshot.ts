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
import { addDaysToLocalDate, createLocalDate, type WorkspaceId } from '@folio/domain';
import { workspaceLocalDate } from './workspaceRoot';

export type SafeZoneWidgetSnapshot = {
  /** Owner of this active-workspace projection; required before any native write. */
  workspaceId: WorkspaceId;
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

function toPence(pounds: number): number {
  return Math.round(pounds * PENCE_PER_POUND);
}

/** `RouteResult` carries `daysToPayday` (a day COUNT) but not the resolved payday date
 *  itself — `routeFromStore` keeps that internal. Reconstruct the ISO date the same way
 *  its own "today" is defined (the LOCAL calendar day) plus that day count, so this
 *  never drifts from the date the route/Calendar/Today all already agree on. */
function paydayIsoFrom(state: AppState, now: Date | string, daysToPayday: number): string {
  const todayIso = typeof now === 'string' ? createLocalDate(now) : workspaceLocalDate(state, now);
  return addDaysToLocalDate(todayIso, daysToPayday);
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
  const paydayISO = paydayIsoFrom(state, now, route.daysToPayday);

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
    workspaceId: state.activeWorkspaceId,
    safeZonePence: toPence(safeZone.total),
    perDayPence: toPence(safeZone.perDay),
    paydayISO: state.currentBalance.source === 'sample' ? null : paydayISO,
    weather: modeState.weather,
    isSample: state.currentBalance.source === 'sample',
  };
}
