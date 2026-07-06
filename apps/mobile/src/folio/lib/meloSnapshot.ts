// Melo snapshot builder — the pure fn that turns live store state into the compact JSON blob
// MeloChatSheet hands the gateway persona (only when "let Melo see my money" is on).
//
// Extracted out of MeloChatSheet.tsx so the mapping is Node-testable without react-native (mirrors
// `routeFromStore` / `buildWidgetSnapshot`'s own "pure builder + thin React caller" split). Pure and
// deterministic given an injected `now`: no react-native import, no store singleton read, no random.
//
// HONESTY (the fix this module exists for): the chat persona must never quote a STALE number back at
// the user.
//   • `daysToPayday` used to be the frozen web-prototype literal `11`. It is now
//     `routeFromStore(state, now).daysToPayday` — the SAME live cycle/payday derivation the home-screen
//     widget (`widgetSnapshot.ts`) and Today/notifications already read, not a second parallel one.
//   • `monthlyIncome` used to read ONLY the legacy `onboarding.monthlyIncome` lump, even for a user who
//     has since declared cadenced `IncomeSource`s (weekly/fortnightly/four-weekly/last-working-day).
//     It now sums every declared source's MONTHLY-EQUIVALENT amount (via `driftSignals.ts`'s
//     `monthlyEquivalent`, reused rather than re-derived) when `incomeSources` is non-empty, and falls
//     back to `onboarding.monthlyIncome` only when the user has no declared sources yet — byte-identical
//     to the old behaviour in that legacy case.

import { routeFromStore } from './storeRoute';
import { selectMonthlyIncome } from './income';
import type { AppState } from '../store';
import type { Pressure } from '../types';

const FOURTEEN_DAYS_MS = 14 * 86_400_000;

/** The web's tightPoint-by-pressure table (verbatim) — fed into the snapshot only. */
export const PRESSURE_LOW: Record<Pressure, number> = {
  safe: 612,
  calm: 325,
  soft: 184,
  pressured: 42,
  overspent: -86,
};

export type MeloSnapshot = {
  name: string | null;
  pressure: Pressure;
  tightPoint: number;
  tightPointGoal: number | null;
  daysToPayday: number;
  monthlyIncome: number;
  pots: Array<{ name: string; saved: number; goal: number; weeklyPace: number }>;
  subscriptions: Array<{
    name: string;
    monthly: number;
    renewsInDays: number;
    paused: boolean;
  }>;
  recentSpend: {
    totalLast14Days: number;
    byCategory: Record<string, number>;
  };
  lastFewTransactions: Array<{
    when: string;
    merchant: string;
    amount: number;
    category: string;
  }>;
};

/** @deprecated Back-compat alias — the canonical selector is `selectMonthlyIncome` in
 *  `./income.ts` (task: SURFACE SELECTOR PROMOTION). Every NEW caller should import
 *  `selectMonthlyIncome` directly; this re-export exists only so existing call sites don't need to
 *  change their import path. NOTE: `selectMonthlyIncome` extends the original behaviour with one
 *  more fallback rung (a history-derived median when there is no declared income AND no onboarding
 *  lump) — every case this function used to handle is unchanged, byte-identical. */
export const liveMonthlyIncome = selectMonthlyIncome;

/**
 * Build the Melo chat snapshot from the full app state + the caller's "now" and current landing
 * `pressure`. Pure — no store reads, no `Date.now()` unless `now` is omitted (matches
 * `routeFromStore`'s own default-param escape hatch; the reactive caller always injects `now`
 * explicitly). Only the last 14 days of transactions are folded in, so the prompt stays small and
 * "recent" means recent.
 */
export function buildMeloSnapshot(
  state: AppState,
  pressure: Pressure,
  now: Date | string = new Date(),
): MeloSnapshot {
  const daysToPayday = routeFromStore(state, now).daysToPayday;
  const monthlyIncome = liveMonthlyIncome(state);

  const nowMs = typeof now === 'string' ? new Date(`${now}T00:00:00`).getTime() : now.getTime();
  const cutoff = nowMs - FOURTEEN_DAYS_MS;
  const recent = state.transactions.filter((t) => new Date(t.when).getTime() >= cutoff);
  const spendByCategory = recent.reduce<Record<string, number>>((acc, t) => {
    if (t.amount >= 0) return acc;
    acc[t.category] = (acc[t.category] ?? 0) + Math.abs(t.amount);
    return acc;
  }, {});

  return {
    name: state.onboarding.name || null,
    pressure,
    tightPoint: PRESSURE_LOW[pressure],
    tightPointGoal: state.tightPointGoal,
    daysToPayday,
    monthlyIncome,
    pots: state.pots.map((p) => ({
      name: p.name,
      saved: p.saved,
      goal: p.goal,
      weeklyPace: p.perWeek,
    })),
    // Usage fields (lastUsedDaysAgo / usesPerMonth) are intentionally NOT shared with the gateway:
    // bank/seed data proves a charge recurs, not that the product was used
    // (SUBSCRIPTION_SIGNAL_RESEARCH §2/§5), so Melo is never handed a usage signal she could turn into
    // an "unused / you should cancel" claim. Only payment facts (cost, renewal, paused) go.
    subscriptions: state.subs.map((s) => ({
      name: s.name,
      monthly: s.cost,
      renewsInDays: s.nextRenewalDaysAway,
      paused: !!state.subPaused[s.name],
    })),
    recentSpend: {
      totalLast14Days: Number(
        Object.values(spendByCategory)
          .reduce((s, v) => s + v, 0)
          .toFixed(2),
      ),
      byCategory: Object.fromEntries(
        Object.entries(spendByCategory).map(([k, v]) => [k, Number(v.toFixed(2))]),
      ),
    },
    lastFewTransactions: recent.slice(0, 8).map((t) => ({
      when: t.when.slice(0, 10),
      merchant: t.merchant,
      amount: t.amount,
      category: t.category,
    })),
  };
}
