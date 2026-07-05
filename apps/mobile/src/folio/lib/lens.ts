/**
 * @rn-lib
 * Lens system — user-facing framing of the Money Modes engine.
 *
 * RN port of folio-melo (design-main) `src/lib/lens/index.ts`, verbatim
 * engine logic. Three tiers:
 *   Free  — Survival + Stability. Always yours.
 *   Plus  — Growth, Reset, Optimizer, Planning. Everyday clarity.
 *   Pro   — Low visibility, Irregular income, Debt/BNPL, Household.
 *           Advanced forecasting + shared money.
 *
 * `proUnlocked` implies Plus is also unlocked (Pro is a superset). A single
 * one-cycle trial unlocks every paid lens across both tiers — no separate
 * Pro trial to avoid two upsell surfaces during the same week.
 *
 * Rules (see `./lens/paywall.ts`):
 *   - Every upsell / paid lock / trial CTA MUST gate on `canShowUpsell`.
 *   - The trial is one cycle. `lens.trialCycleId` is cleared at cycle close.
 *   - `canAccess(lens)` = true for free lenses, for the tier the user paid
 *     for, and for every paid lens during an active trial cycle.
 *
 * Platform adaptation: the design source computed `trialDaysLeft` via a
 * `nextPayday(from, dayOfMonth) -> Date` helper in its web-only
 * `lib/calendar-events.ts`. RN's payday engine (`./payday.ts`) instead
 * exposes `resolvePayday(rule, yearMonth) -> ISO string` (month-overflow +
 * weekend-aware). `nextPaydayDate` below is a small local adapter over that
 * existing engine — not a new date-math implementation — so this file
 * doesn't duplicate payday logic RN already owns.
 *
 * Multi-cadence note: `nextPaydayDate` only resolves the legacy monthly
 * day-of-month rule, which is wrong for weekly/fortnightly/four-weekly/
 * last-working-day earners. `trialDaysLeft` now prefers the income-cadence
 * engine (`./income.ts`'s `nextIncomeDate`) when the user has `incomeSources`
 * configured, falling back to `nextPaydayDate` only for users still on the
 * legacy single-payday-DOM shape (no sources yet) — same fallback order
 * `storeRoute.ts`'s `routeFromStore` already uses, so trial-cycle-end and the
 * Route's own `daysToPayday` never disagree.
 *
 * 21-day trial floor: the paywall promise is roughly "try it for a month".
 * For a monthly earner the next income date already lands ~a month out, so
 * this floor is a no-op. For a weekly/fortnightly/four-weekly earner, the
 * NEXT income date alone would end the trial in as little as 0-6 days (a
 * weekly earner's "one cycle" is one week) — nowhere near the promised
 * month. `trialEndDate` therefore walks the income-cadence engine's
 * occurrences forward and picks the FIRST one that is at least 21 days after
 * the trial's start, so a weekly earner gets roughly 4 pay cycles (~21-27
 * days, approx. one month) instead of one. Monthly/last-working-day earners
 * are unaffected — their very first occurrence already clears 21 days in
 * nearly every case, and on the rare short month it still only pushes the
 * trial out to the FOLLOWING occurrence (never shortens it).
 */
import { useAppStore, startLensTrial, acknowledgeTrialEnd } from '../store';
import type { MoneyMode } from './modes/types';
import { MODE_LABEL } from './modes/types';
import { resolvePayday } from './payday';
import { projectIncomeEvents } from './income';
import type { IncomeSource } from '../store';

export type LensTier = 'free' | 'plus' | 'pro';

/** The trial promise is roughly a month; see the file header's "21-day trial
 *  floor" note for why this exists and why 21 (≈3 weeks — clears a weekly
 *  earner's cadence at least twice over before the trial can end). */
const TRIAL_MIN_DAYS = 21;
/** Wide enough to guarantee at least one income occurrence >= TRIAL_MIN_DAYS
 *  out even for the slowest cadence this engine models (four-weekly, 28-day
 *  step): 21 + 28 + a week of slack comfortably covers every cadence. */
const TRIAL_SEARCH_WINDOW_DAYS = 63;

/**
 * The first income date at least `TRIAL_MIN_DAYS` days after `startIso`,
 * across every source. `null` when there are no sources (caller falls back
 * to the legacy `nextPaydayDate` adapter) or — defensively — if the search
 * window somehow finds no occurrence that far out (should not happen for any
 * real cadence; the window is sized generously above).
 */
export function trialEndDate(sources: readonly IncomeSource[], startIso: string): string | null {
  if (sources.length === 0) return null;
  const events = projectIncomeEvents(sources, startIso, TRIAL_SEARCH_WINDOW_DAYS);
  const startMs = new Date(`${startIso}T00:00:00`).getTime();
  for (const event of events) {
    const eventMs = new Date(`${event.date}T00:00:00`).getTime();
    const daysOut = Math.round((eventMs - startMs) / (1000 * 60 * 60 * 24));
    if (daysOut >= TRIAL_MIN_DAYS) return event.date;
  }
  return null;
}

// Stable empty fallback for the optional store slot — never mint a fresh [] per
// call (useAppStore/useSyncExternalStore snapshot stability).
const EMPTY_INCOME_SOURCES: IncomeSource[] = [];

// The two baselines Folio answers for everyone.
export const FREE_LENSES: readonly MoneyMode[] = ['survival', 'stability'] as const;
// Everyday clarity lenses — the £4.99 tier.
export const PLUS_LENSES: readonly MoneyMode[] = [
  'growth',
  'reset',
  'optimizer',
  'planning',
] as const;
// Advanced / shared / structural lenses — the £8.99 tier.
export const PRO_LENSES: readonly MoneyMode[] = [
  'lowVis',
  'irregular',
  'debt',
  'household',
] as const;

/** Same string values as MODE_LABEL — a lens-vocabulary alias. */
export const LENS_LABEL = MODE_LABEL;

export function isPlusLens(m: MoneyMode): boolean {
  return PLUS_LENSES.includes(m);
}

export function isProLens(m: MoneyMode): boolean {
  return PRO_LENSES.includes(m);
}

export function isFreeLens(m: MoneyMode): boolean {
  return FREE_LENSES.includes(m);
}

export function tierOf(m: MoneyMode): LensTier {
  if (isFreeLens(m)) return 'free';
  if (isProLens(m)) return 'pro';
  return 'plus';
}

/** Yield the pad-2 string form of a 1-based month/day for a "YYYY-MM"
 *  / ISO-date key. Small local helper — `resolvePayday` wants "YYYY-MM". */
function yearMonthOf(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${m < 10 ? `0${m}` : m}`;
}

/** Adapter over `resolvePayday` (`./payday.ts`) matching the design
 *  source's `nextPayday(from, dayOfMonth) -> Date` shape: the next
 *  occurrence of `dayOfMonth` on/after `from`, rolling into next month
 *  when this month's occurrence has already passed. Uses the default
 *  weekend rule (`previous`), matching RN's existing payday engine
 *  default — the source's web-only helper had no weekend awareness at
 *  all, so this is a strict improvement, not a behaviour change callers
 *  need to know about (it only ever moves the date earlier by a day or
 *  two, same as the rest of the app's payday handling). */
function nextPaydayDate(from: Date, dayOfMonth: number): Date {
  const thisMonthIso = resolvePayday({ dayOfMonth }, yearMonthOf(from));
  const thisMonth = new Date(`${thisMonthIso}T00:00:00`);
  if (thisMonth.getTime() >= from.getTime()) return thisMonth;
  const nextMonthDate = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  const nextMonthIso = resolvePayday({ dayOfMonth }, yearMonthOf(nextMonthDate));
  return new Date(`${nextMonthIso}T00:00:00`);
}

/** Reactive lens hook — a small ergonomic wrapper the UI layer reads. */
export function useLens() {
  const active = useAppStore((s) => s.moneyMode ?? 'survival');
  const plusUnlocked = useAppStore((s) => s.lens?.plusUnlocked ?? false);
  const proUnlocked = useAppStore((s) => s.lens?.proUnlocked ?? false);
  const trialCycleId = useAppStore((s) => s.lens?.trialCycleId ?? null);
  const trialEndedCycleId = useAppStore((s) => s.lens?.trialEndedCycleId ?? null);
  const trialEndAcknowledged = useAppStore((s) => s.lens?.trialEndAcknowledged ?? true);
  const paydayDom = useAppStore((s) => s.onboarding.payday);
  const incomeSources = useAppStore((s) => s.incomeSources ?? EMPTY_INCOME_SOURCES);

  const canAccess = (lens: MoneyMode): boolean => {
    const t = tierOf(lens);
    if (t === 'free') return true;
    if (trialCycleId) return true;
    if (proUnlocked) return true;
    if (t === 'plus') return plusUnlocked;
    return false; // Pro-tier lens without Pro / trial
  };

  /** Which tier does a given lens sit in — for badge rendering. */
  const tierFor = tierOf;

  /** Highest tier the user currently has access to (ignoring trial). */
  const paidTier: LensTier = proUnlocked ? 'pro' : plusUnlocked ? 'plus' : 'free';

  /** Start a one-cycle trial using the user's payday DOM to anchor the
   *  cycle id. No-op if a trial is already active. */
  const startTrial = () => {
    if (trialCycleId) return;
    const today = new Date();
    startLensTrial(today.toISOString().slice(0, 10));
  };

  /** Days remaining in the active trial — computed against the next
   *  payday (which is when the cycle closes and the trial ends). Returns
   *  null when no trial is active. Never negative. */
  const trialDaysLeft: number | null = (() => {
    if (!trialCycleId) return null;
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    // Prefer the multi-cadence income engine when sources exist — correct for
    // weekly/fortnightly/four-weekly/last-working-day earners, not just monthly
    // day-of-month. Falls back to the legacy DOM-only adapter for users who
    // haven't been migrated onto `incomeSources` yet. `trialEndDate` applies the
    // 21-day floor (see file header) so a weekly earner's trial reads as ~a
    // month, not ~a week.
    const endIso = trialEndDate(incomeSources, todayIso);
    if (endIso !== null) {
      const end = new Date(`${endIso}T00:00:00`);
      const ms = end.getTime() - today.getTime();
      return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }
    const end = nextPaydayDate(today, paydayDom || 25);
    const ms = end.getTime() - today.getTime();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  })();

  /** True when a trial just closed and the user hasn't dismissed the
   *  soft "trial ended" surface yet. Consumers should still gate on
   *  `canShowUpsell` before rendering the prompt. */
  const trialEndPending =
    Boolean(trialEndedCycleId) && !trialEndAcknowledged && !plusUnlocked && !proUnlocked;

  /** Convenience: user is on the free tier AND has never trialed. Used
   *  to gate the first-time inline "Try free for one cycle" CTA. */
  const canOfferTrial = !plusUnlocked && !proUnlocked && !trialCycleId && !trialEndedCycleId;

  return {
    active,
    isPlus: isPlusLens(active),
    isPro: isProLens(active),
    tier: tierOf(active),
    paidTier,
    plusUnlocked,
    proUnlocked,
    trialCycleId,
    trialEndedCycleId,
    trialDaysLeft,
    trialEndPending,
    canOfferTrial,
    acknowledgeTrialEnd,
    canAccess,
    tierFor,
    startTrial,
  };
}
