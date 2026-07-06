/**
 * Store → money-path bridge — the ONE place that maps the data spine onto the
 * pure route engine, so every screen computes the same curve from the same store.
 *
 * `computeRoute` (./moneyPath) is pure and store-agnostic by contract: it takes
 * `now`/`payday` ISO strings and dated-amount buckets and never reads the store
 * singleton or `Date.now()`. This module owns the mapping that used to live
 * inline in TodayScreen — `currentBalance.amount − Σ pots.saved` as the starting
 * balance (already-saved pot cash is earmarked OUT of visible spare per the
 * product rule "saved amount lowers Today's spare and bends the path"), monthly
 * income on the resolved next payday, active (non-paused) subs dated
 * `now + nextRenewalDaysAway + override`, transactions as dated spend (sign
 * flipped: stored "negative = spend" → engine outflow magnitude), and the future
 * dated −perWeek pot top-up dips (from `deriveCalendarEvents`) — and returns
 * `computeRoute(...)`. Extracting it keeps Today, and any future surface,
 * byte-identical instead of each re-deriving it.
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
import { deriveCalendarEvents } from './calendarEvents';
import { resolvePayday } from './payday';
import { nextIncomeDate, selectMonthlyIncome } from './income';
import { monthlySpendBaseline } from './historyStats';
import { useAppStore, selectBankBalanceMinor, bankTransactions, type AppState } from '../store';
import { derivePressure } from '../screens/today/pressure';

/** Fallback day-of-month payday when onboarding hasn't set one. Matches the
 *  literal TodayScreen used inline (`onboarding.payday || 25`). */
const DEFAULT_PAYDAY_DOM = 25;

/** The forward window the route samples, in days. Identical to the Calendar
 *  ladder's `deriveCalendarEvents({ windowDays: 35 })` so the route's tight point
 *  and the Calendar's ladder minimum are ONE number on ONE day — a dip that lands
 *  after payday (next month's start-of-month bills) is in BOTH or neither. */
const ROUTE_WINDOW_DAYS = 35;

// --- Date helpers ----------------------------------------------------------------------------
// "Today" must be the user's LOCAL calendar day. The design's Today reads `new Date()` (a local
// instant) and feeds it to `deriveCalendarEvents`, which keys "today" and every event date off
// `now.toISOString().slice(0,10)` — the UTC slice (calendarEvents `isoDay`). On a UTC host those
// coincide; on a non-UTC host (e.g. BST = UTC+1) the UTC slice of a local-midnight Date is the
// PREVIOUS day, so slicing the route's "today" straight off `toISOString()` drifts a day early
// (daysToPayday 16 not 15; the next-month roll reads 0). The fix is two-part and keeps the route and
// the Calendar ladder on ONE shared day:
//   (1) derive the route's `todayIso` from the LOCAL calendar fields (`isoDayLocal`), so it is the
//       day the user is actually living; and
//   (2) feed `deriveCalendarEvents` a `now` reconstructed at UTC midnight of that SAME local day
//       (`utcMidnightOf`), so the slice it takes internally (`isoDay`) equals `todayIso` exactly —
//       route day-indices and calendar event days then line up by construction on any host timezone.
// `resolvePayday` (for the fallback payday) takes a "YYYY-MM" sliced from the same local `todayIso`.
/** A Date → LOCAL-calendar ISO day "YYYY-MM-DD" (the day the user is in, host-tz aware). */
function isoDayLocal(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return `${year}-${pad2(month)}-${pad2(day)}`;
}
/** UTC-midnight Date for a "YYYY-MM-DD" — its `toISOString().slice(0,10)` is that exact day, so the
 *  `now` we hand `deriveCalendarEvents` slices to the same local day the route uses for indexing. */
function utcMidnightOf(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
/** The "YYYY-MM" one calendar month after a "YYYY-MM-DD" (or "YYYY-MM") ISO string. */
function nextYearMonthOf(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const month = m === 12 ? 1 : m + 1;
  const year = m === 12 ? y + 1 : y;
  return `${year}-${month < 10 ? `0${month}` : month}`;
}

/**
 * Build the `computeRoute` inputs from the store and return the route.
 *
 * Pure: same `(state, now)` → byte-identical `RouteResult`.
 *
 * The buckets are derived from the SAME engine the Calendar uses
 * (`deriveCalendarEvents`, over the SAME 35-day window) so the route's curve is
 * the Calendar's ladder by construction — recurring bills (Rent / Council Tax /
 * Octopus / BT), sub renewals, payday income, manual events, and pot top-ups are
 * all present once, from one place, never re-listed here. Pots produce TWO
 * DISTINCT effects on the curve, and both apply with NO double-count:
 *   1. the already-SAVED cash (`Σ pots.saved`) is earmarked OUT of the start, so
 *      the path begins at `currentBalance.amount − Σ pots.saved`
 *      (`computeSpareAndTightest(groups, currentBalance.amount − Σ saved)`) — the
 *      "saved amount lowers Today's spare" half of the product rule; and
 *   2. the FUTURE weekly contributions enter the curve as their DATED `−perWeek`
 *      top-up dips (already in `spend` via `deriveCalendarEvents`) — the "bends
 *      the path" half.
 * (1) is past cash already set aside; (2) is future cash about to be — different
 * money, so subtracting Σ saved at the start AND keeping the dated dips is correct,
 * not a double-count. We still pass `pots: []` to `computeRoute` (NO flat internal
 * `pots` plateau) and do NOT re-add the dated dips to the start. The double-count
 * Lovable warned about is folding the dated weekly dips into the start (or stacking
 * the internal flat plateau on top of those dips) — this mapping avoids it by
 * keeping the earmark and the dips separate.
 *
 * The previous mapping dropped bills entirely, modelled pots as a flat plateau,
 * and clamped the window at payday — so the tight point disagreed with the
 * Calendar (and with the design's Today, which computes the tightest the same
 * way). It also folded `state.transactions` in as spend; the design's tight
 * point is derived purely from the calendar timeline, so logged transactions are
 * no longer part of this curve (they were past-dated and out-of-window on seed
 * data anyway). `daysToPayday` / `spare` still describe payday itself, while the
 * sampled 35-day window finds the lowest point wherever it lands (before OR after
 * payday) — the two are distinct and never conflated.
 *
 * @param state The full app state (the slices read: currentBalance, onboarding,
 *   subs, subPaused, subOverrides, calendarEvents, pots).
 * @param now   "Today" — a Date or its local ISO day. Defaults to `new Date()`
 *   only when omitted; the reactive hook always injects the mount-gated date so
 *   nothing reads the clock during render.
 */
export function routeFromStore(state: AppState, now: Date | string = new Date()): RouteResult {
  const nowDate = typeof now === 'string' ? new Date(`${now}T00:00:00`) : now;
  // The route's "today" is the user's LOCAL calendar day (see the helper note above) — not the UTC
  // slice, which drifts a day early on a non-UTC host. `daysToPayday` and the day indices are all
  // measured from this.
  const todayIso = isoDayLocal(nowDate);
  const paydayDom = state.onboarding.payday || DEFAULT_PAYDAY_DOM;

  // The Calendar's timeline — the single derivation that owns bills, subs, payday, pot top-ups, and
  // manual events. Same inputs + same 35-day window the Calendar screen feeds, so the curve below IS
  // the Calendar's ladder. Anchored to UTC midnight of `todayIso` so `deriveCalendarEvents`' own UTC
  // slice resolves to the SAME local day — event dates then land on the indices `computeRoute` uses.
  const incomeSources = state.incomeSources ?? [];
  const events = deriveCalendarEvents({
    subs: state.subs,
    subPaused: state.subPaused,
    subOverrides: state.subOverrides,
    onboarding: state.onboarding,
    manualEvents: state.calendarEvents,
    pots: state.pots,
    incomeSources,
    windowDays: ROUTE_WINDOW_DAYS,
    now: utcMidnightOf(todayIso),
    // Sample/demo bills only while the seed is untouched (currentBalance still 'sample'). A cleared or
    // real user's money path must reflect ONLY their own outflows — never the hardcoded example bills.
    includeSampleBills: state.currentBalance.source === 'sample',
  });

  // Split the derived timeline into the engine's buckets by sign: positive = income (payday),
  // negative = an outflow magnitude (bills, sub renewals, pot top-ups, manual out). Reviews and
  // deadlines carry no amount and fall through. One pass, no per-source re-derivation.
  const income: DatedAmount[] = [];
  const spend: DatedAmount[] = [];
  for (const e of events) {
    if (typeof e.amount !== 'number') continue;
    if (e.amount >= 0) income.push({ date: e.date, amount: e.amount });
    else spend.push({ date: e.date, amount: -e.amount });
  }

  // The route's `payday` — it bounds `daysToPayday` and where `spare` is read, NOT the sampled
  // window (that is the 35-day picture above). Take the FIRST payday the timeline itself resolved
  // (its in-window `payday`-source event), so payday is the same concrete day the Calendar shows.
  // When income is 0 (no payday event in the sampled window — only possible with a payday further out
  // than the window), fall back to the income-cadence engine directly when sources exist (so a
  // weekly/fortnightly/etc. earner's `daysToPayday` is still correctly cadenced), else the legacy
  // day-of-month resolution: this month's resolved payday if still ahead of today, else next month's.
  const firstPaydayEvent = events.find((e) => e.source === 'payday');
  const thisMonthPayday = resolvePayday({ dayOfMonth: paydayDom }, todayIso.slice(0, 7));
  const legacyPaydayIso =
    thisMonthPayday >= todayIso
      ? thisMonthPayday
      : resolvePayday({ dayOfMonth: paydayDom }, nextYearMonthOf(todayIso));
  const paydayIso =
    firstPaydayEvent?.date ??
    (incomeSources.length > 0 ? nextIncomeDate(incomeSources, todayIso) : null) ??
    legacyPaydayIso;

  // Earmark the already-SAVED pot cash OUT of the start: the path begins at
  // `bankBalance − Σ pots.saved`, not the full balance — the "saved amount lowers Today's spare" half
  // of the product rule. This is PAST cash already set aside, a one-off start offset. It does NOT
  // double-count the pots' FUTURE −perWeek top-up dips: those are different money (cash about to be
  // saved), already present in `spend` via deriveCalendarEvents, and they "bend the path" as dated
  // dips. So earmark-at-start AND dated-dips both apply, distinctly. We still pass `pots: []` (NO flat
  // internal plateau on top of the dips). The double-count to avoid is folding those dated dips into
  // the start; we don't.
  //
  // ACCOUNTS_MODEL.md §2.4 — the route's starting balance is BANK-ONLY money (`selectBankBalanceMinor`:
  // sum of non-liability bank/savings/cash account balances), never a credit card's balance. On a
  // single-account (migrated) install this is byte-identical to the old `currentBalance.amount` scalar
  // — pinned by storeRoute.test.ts.
  const sigmaSaved = state.pots.reduce((acc, p) => acc + p.saved, 0);
  const bankBalance = selectBankBalanceMinor(state);
  const result = computeRoute({
    now: todayIso,
    payday: paydayIso,
    windowDays: ROUTE_WINDOW_DAYS,
    balance: bankBalance - sigmaSaved,
    income,
    bills: [],
    subs: [],
    spend,
    holds: [],
    pots: [],
    openBorrows: 0,
  });
  // Window income/outflow totals for the Today summary ("Coming in" / "Going out").
  //
  // REALIZED-OVER-PROJECTED (task: ROUTE READS ACTUALS): when the user has actual transaction
  // history, the summary must reflect what has REALLY happened, not just the forward-projected
  // calendar (which reports £0 outgoing for anyone without declared subs/bills, even when their own
  // ledger clearly shows spend). `incomingTotal` is the canonical monthly income figure
  // (`selectMonthlyIncome` — cadence-correct declared income, or a history-derived median when
  // nothing is declared); `outgoingTotal` is the median realized monthly spend
  // (`monthlySpendBaseline`) when the ledger has any history, else the forward-projected bills/subs
  // sum from the SAME derived events the curve uses (the pre-existing behaviour, kept for a
  // brand-new/empty ledger where there is nothing realized to report yet).
  //
  // This intentionally diverges the Today summary trio's "in/out" figures from the forward
  // `spend`/`income` buckets that feed `computeRoute` above — the tight-point CURVE stays the
  // Calendar's forward-looking ladder (payday shape), while the headline "Coming in / Going out"
  // numbers become an honest realized-vs-projected picture. Surfaces that render both together
  // should label them accordingly (projected curve vs realized summary) — this module only computes
  // the numbers, not the copy.
  // Bank-only (ACCOUNTS_MODEL.md §2.4): a credit-card statement's spend is borrowing, not a bank
  // outflow, so it must never feed the realized "Going out" figure. `bankTransactions` is a no-op
  // filter on a single-account (migrated) install.
  const bankTxns = bankTransactions(state);
  const projectedOutgoing = spend.reduce((acc, d) => acc + d.amount, 0);
  const hasHistory = bankTxns.length > 0;
  const incomingTotal = selectMonthlyIncome(state);
  const outgoingTotal = hasHistory
    ? monthlySpendBaseline(bankTxns, todayIso).medianMonthlySpend
    : projectedOutgoing;
  return { ...result, incomingTotal, outgoingTotal };
}

/**
 * QUIET-MOMENT GATE (task: never-pressure-during-danger spirit) — whether the CURRENT landing state is
 * `overspent`, the one band where the app's own tone (Melo's mood, the verdict line) already reads
 * "something has to move" (see `screens/today/pressure.ts` pressureLine.overspent). Reuses the EXACT
 * same derivation FolioShell.tsx uses for its app-wide `activePressure` band — `routeFromStore`'s
 * tightest projected spare through `derivePressure` — gated by the SAME honest `hasMoneyPicture` check
 * (a balance the user actually set, or logged activity) so a fresh/unconfigured £0 app never reads as
 * "overspent" the way an actually-negative tightest spare does.
 *
 * Pure (state + injected `now`), so it is unit-testable and callable from a plain event handler (not
 * just a render) — the two landing call sites (`ReviewScreen.onAdd`, `VisualizerScreen.commit`) run
 * this right before deciding whether to open a proposal sheet, and skip every caught-* sheet when it
 * returns true. A suppressed proposal is deferred, not lost: the SAME caught-* checks already
 * re-evaluate fresh on the next landing (see those call sites' own "deferred, not lost" ordering
 * comments), so nothing here needs to remember what it skipped.
 */
export function isOverspentLanding(state: AppState, now: Date | string = new Date()): boolean {
  const hasMoneyPicture = state.transactions.length > 0 || state.currentBalance.amount > 0;
  if (!hasMoneyPicture) return false;
  const route = routeFromStore(state, now);
  return derivePressure(Math.round(route.tightPoint.amount)) === 'overspent';
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
    // `incomeSources` (feeds selectMonthlyIncome + the payday/pot-anchor timeline) and
    // `calendarEvents` (manual events folded into the same derived timeline) were previously
    // missing from this list — a write to either silently served a stale memoised route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state.currentBalance,
      state.onboarding,
      state.subs,
      state.subPaused,
      state.subOverrides,
      state.transactions,
      state.pots,
      state.incomeSources,
      state.calendarEvents,
      nowKey,
    ],
  );
}
