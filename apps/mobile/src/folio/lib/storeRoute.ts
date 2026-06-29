/**
 * Store → money-path bridge — the ONE place that maps the data spine onto the
 * pure route engine, so every screen computes the same curve from the same store.
 *
 * `computeRoute` (./moneyPath) is pure and store-agnostic by contract: it takes
 * `now`/`payday` ISO strings and dated-amount buckets and never reads the store
 * singleton or `Date.now()`. This module owns the mapping that used to live
 * inline in TodayScreen — currentBalance.amount as the starting balance, monthly
 * income on the resolved next payday, active (non-paused) subs dated
 * `now + nextRenewalDaysAway + override`, transactions as dated spend (sign
 * flipped: stored "negative = spend" → engine outflow magnitude), and pots.saved
 * as the flat earmark — and returns `computeRoute(...)`. Extracting it keeps
 * Today, and any future surface, byte-identical instead of each re-deriving it.
 *
 * `routeFromStore` is pure (state + an injected `now`) so it is unit-testable
 * without React. `useRoute` is the thin reactive wrapper: a `useAppStore`
 * selector over the slices the route depends on + a `useMemo`, returning the
 * same `RouteResult`.
 *
 * Types come from the data spine `@/folio/store` (alias `@/*` -> `src/*`),
 * imported relatively as `../store` so the pure-logic test runner (no `@` alias)
 * resolves it.
 */

import { useMemo } from 'react';

import { computeRoute, type DatedAmount, type RouteResult } from './moneyPath';
import { resolvePayday } from './payday';
import { useAppStore, type AppState } from '../store';

const DAY_MS = 86_400_000;
/** Fallback day-of-month payday when onboarding hasn't set one. Matches the
 *  literal TodayScreen used inline (`onboarding.payday || 25`). */
const DEFAULT_PAYDAY_DOM = 25;

// --- Local-calendar date helpers (lifted verbatim from TodayScreen) ----------------------------
// The engine takes ISO "YYYY-MM-DD" strings and parses them as calendar days. We build those
// strings from the runtime's LOCAL date parts so "today" is the user's local day — consistent with
// the rest of Today, which parses the same ISO at local midnight. Pure string math, no
// timezone-offset surprises.
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
/** A Date → local-calendar ISO day "YYYY-MM-DD". */
function toIsoDay(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
/** A Date → local-calendar "YYYY-MM" (the month resolvePayday expects). */
function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}
/** A Date shifted by whole days (local clock), for dating sub renewals N days out. */
function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * DAY_MS);
}
/** A Date shifted by whole months, for rolling to next month's payday. */
function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, date.getDate());
}

/**
 * Build the `computeRoute` inputs from the store and return the route.
 *
 * Pure: same `(state, now)` → byte-identical `RouteResult`. The mapping mirrors
 * what TodayScreen did inline, so any screen that calls this gets the identical
 * curve, tight point, and days-to-payday.
 *
 * @param state The full app state (the slices read: currentBalance, onboarding,
 *   subs, subPaused, subOverrides, transactions, pots).
 * @param now   "Today" — a Date or its local ISO day. Defaults to `new Date()`
 *   only when omitted; the reactive hook always injects the mount-gated date so
 *   nothing reads the clock during render.
 */
export function routeFromStore(state: AppState, now: Date | string = new Date()): RouteResult {
  const nowDate = typeof now === 'string' ? new Date(`${now}T00:00:00`) : now;
  const todayIso = toIsoDay(nowDate);
  const paydayDom = state.onboarding.payday || DEFAULT_PAYDAY_DOM;

  // Resolve the next payday: this month's resolved payday if it's still ahead, else next month's.
  const thisMonthPayday = resolvePayday({ dayOfMonth: paydayDom }, toYearMonth(nowDate));
  const paydayIso =
    thisMonthPayday >= todayIso
      ? thisMonthPayday
      : resolvePayday({ dayOfMonth: paydayDom }, toYearMonth(addMonths(nowDate, 1)));

  // Sub renewals → dated outflows. Skip paused; apply the stored day-nudge (same as the Calendar).
  const subEvents: DatedAmount[] = state.subs
    .filter((s) => !state.subPaused[s.name])
    .map((s) => ({
      date: toIsoDay(addDays(nowDate, s.nextRenewalDaysAway + (state.subOverrides[s.name] ?? 0))),
      amount: s.cost,
    }));

  // Transactions → spend. Stored sign is "negative = spend, positive = inflow"; the engine reads
  // spend as outflow magnitude, so flip the sign once.
  const spendEvents: DatedAmount[] = state.transactions.map((tx) => ({
    date: toIsoDay(new Date(tx.when)),
    amount: -tx.amount,
  }));

  // Monthly income lands on payday.
  const incomeEvents: DatedAmount[] =
    state.onboarding.monthlyIncome > 0
      ? [{ date: paydayIso, amount: state.onboarding.monthlyIncome }]
      : [];

  return computeRoute({
    now: todayIso,
    payday: paydayIso,
    balance: state.currentBalance.amount,
    income: incomeEvents,
    bills: [],
    subs: subEvents,
    spend: spendEvents,
    holds: [],
    pots: state.pots.map((p) => ({ saved: p.saved })),
    openBorrows: 0,
  });
}

/**
 * Reactive route — the thin hook every screen uses. Selects the whole state
 * (the store's `useSyncExternalStore` snapshot has a stable identity between
 * writes) and memoises `routeFromStore` against the slices the route actually
 * depends on + `now`, so an unrelated store write doesn't recompute it. Returns
 * the same `RouteResult` as the pure function. `now` is injected by the caller
 * (the mount-gated runtime date), never read from the clock here.
 */
export function useRoute(now: Date | string): RouteResult {
  const state = useAppStore((s) => s);
  const nowKey = typeof now === 'string' ? now : now.getTime();
  return useMemo(
    () => routeFromStore(state, now),
    // The route's real reactive inputs are these slices + `now` (keyed via
    // `nowKey` so a fresh Date at the same instant doesn't churn the memo).
    // Depending on the slices, not the whole `state`, keeps unrelated writes
    // (e.g. cycles, calendar focus) from recomputing the curve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state.currentBalance,
      state.onboarding,
      state.subs,
      state.subPaused,
      state.subOverrides,
      state.transactions,
      state.pots,
      nowKey,
    ],
  );
}
