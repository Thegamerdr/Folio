// useMeloOpener — the faithful 1:1 RN port of the web
// (folio-melo/.claude/worktrees/design-main/src/lib/melo/useMeloOpener.ts).
//
// @rn-lib
// One line, per-lens, live from the store. Melo's voice on Today's bottom card used to be a
// hard-coded string per variant. This hook wires the same `pickOpener` engine that powers the
// chat sheet so every lens visibly shifts Melo's opening line without per-screen copy edits. Same
// snapshot inputs as MeloChatSheet, so the two surfaces speak with one voice.
//
// @rn-engine modes (needs @/folio/lib/modes: `pickOpener(mode, snapshot)` — the opener-pool
// engine). Confirmed: no `@/folio/lib/modes` module exists yet in this RN app (grepped before
// writing — this is the parallel modes-port workstream PORT_BIBLE.md flags as still open). Every
// OTHER input this hook reads (`moneyMode`, `subs`, `subPaused`, `pots`, `onboarding`,
// `transactions`, `currentBalance`) already exists on `@/folio/store`'s real `AppState` — this
// hook wires those live, exactly like the web wires `useAppStore`. Only the final `pickOpener`
// call depends on the pending module; if `@/folio/lib/modes` is not yet present, typecheck will
// fail solely on that import (see wiringNeeds).

import { useMemo } from 'react';

import { pickOpener } from '@/folio/lib/modes';
import { useAppStore } from '@/folio/store';
import type { MoneyMode } from '@/folio/store';

const DAY_MS = 86_400_000;
const RECENT_WINDOW_DAYS = 14;
const QUIET_SUB_IDLE_DAYS = 21;
const SOON_RENEWAL_DAYS = 3;

export function useMeloOpener(overrideMode?: MoneyMode): string {
  const activeMode = useAppStore((s) => s.moneyMode);
  // `moneyMode` is optional on AppState (unmigrated installs); default to the shipped Survival
  // lens, matching every other read-site's fallback (`moneyMode ?? 'survival'`).
  const mode = overrideMode ?? activeMode ?? 'survival';
  const subs = useAppStore((s) => s.subs);
  const subPaused = useAppStore((s) => s.subPaused);
  const pots = useAppStore((s) => s.pots);
  const onboarding = useAppStore((s) => s.onboarding);
  const transactions = useAppStore((s) => s.transactions);
  const currentBalance = useAppStore((s) => s.currentBalance);

  return useMemo(() => {
    const liveSubs = subs.filter((s) => !subPaused[s.name]);
    const quiet = liveSubs.find(
      (s) => s.usesPerMonth === 0 || s.lastUsedDaysAgo > QUIET_SUB_IDLE_DAYS,
    );
    const soon = [...liveSubs].sort((a, b) => a.nextRenewalDaysAway - b.nextRenewalDaysAway)[0];
    const totalLeaks = liveSubs
      .filter(
        (s) =>
          s.usesPerMonth === 0 ||
          s.lastUsedDaysAgo > QUIET_SUB_IDLE_DAYS ||
          (s.cost >= 15 && s.usesPerMonth <= 2),
      )
      .reduce((sum, s) => sum + s.cost, 0);
    const potsPace = pots.filter((p) => p.perWeek > 0).reduce((sum, p) => sum + p.perWeek, 0);

    // 14-day spend snapshot — mirrors MeloChatSheet's snapshot inputs.
    const cutoff = Date.now() - RECENT_WINDOW_DAYS * DAY_MS;
    const recent = transactions.filter((t) => t.amount < 0 && new Date(t.when).getTime() >= cutoff);
    const byCategory: Record<string, number> = {};
    let totalSpend14d = 0;
    for (const t of recent) {
      const cat = t.category || 'other';
      byCategory[cat] = (byCategory[cat] ?? 0) + Math.abs(t.amount);
      totalSpend14d += Math.abs(t.amount);
    }
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0];

    // Same Safe-Zone read every other surface uses: current balance minus pot reserves. Openers
    // only use `tightestSpare < 0` as a signal.
    const tightestSpare =
      currentBalance.amount - pots.reduce((sum, p) => sum + Math.max(0, p.saved), 0);

    return pickOpener(mode, {
      name: onboarding.name ? `${onboarding.name}, ` : '',
      liveSubsCount: liveSubs.length,
      quietSubName: quiet?.name,
      quietSubDays: quiet?.lastUsedDaysAgo,
      soonSubName: soon && soon.nextRenewalDaysAway <= SOON_RENEWAL_DAYS ? soon.name : undefined,
      soonSubDays: soon?.nextRenewalDaysAway,
      soonSubCost: soon?.cost,
      totalLeaks,
      potsPace,
      topCategory,
      totalSpend14d,
      tightestSpare,
    });
  }, [mode, subs, subPaused, pots, onboarding, transactions, currentBalance]);
}
