// TodayNudges — faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/today/TodayNudges.tsx).
//
// @rn-component TodayNudges
// @parent       TodayScreen
// @purpose      Collapsed single-chip nudge banner: top-priority nudge + a "+N" badge counting the
//               rest. Tapping the chip runs the TOP nudge's action (web parity — collapse-to-one,
//               not "up to 2 full banners").
// @reads        subs, subPaused, onboarding, cycles, transactions, tightPointGoal, readerCandidates
//               (+ the screen's computed tightestSpare, passed down so the nudge never disagrees
//               with the headline). shelf via lib/shelf.ts useShelf() (STORE-SEAM DEVIATION, see
//               that file's header — store.ts has no shelf slot and is outside this batch's file list).
// @writes       —
// @opens-sheet  onboarding, shelf, melo-chat (via nav.openMelo)
// @copy         FROZEN — verbatim from the deck.
// @tokens       calm (accent) · calmSoft (accent-soft) · surface · ink · muted · hairline · inset
// @notes        Proactive — collapses to ONE visible chip always (web parity). Order: shortfall >
//               onboarding > review-queue > shelf > melo > ritual > insights. Renders nothing when 0
//               nudges (empty branch).
//
// STORE-SEAM NOTE: RN has no persisted `reviewQueue` field — the web store.ts v8 seam maps onto RN's
// existing `readerCandidates` (store.ts), the staged, review-before-truth queue the Intake reader
// (PDF/photo/CSV/paste) already writes and VisualizerScreen already drains via clearReaderCandidates.
// That is a richer, already-shipped superset of the web queue (multi-select, live totals, per-row
// Fix) and is INTENTIONALLY ephemeral/non-persisted (store.ts `readerCandidates` doc comment) — unlike
// web's persisted reviewQueue. This nudge is the one piece that was genuinely missing: it points at
// the SAME staged queue and routes to 'visualizer' (RN's real multi-candidate review screen), not
// 'review' (RN's separate single-decision manual-entry card, which has no queue-consuming shape).

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, pressed, radius, useTheme, type Palette } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { useAppStore, useReaderCandidates } from '@/folio/store';
import { useShelf } from '@/folio/lib/shelf';
import type { Nav } from '@/folio/types';

const MIN_TAP = 44;

type NudgeTone = 'accent' | 'ink' | 'melo';

type Nudge = {
  key: string;
  tone: NudgeTone;
  label: string;
  cta: string;
  onPress: () => void;
};

export function TodayNudges({
  nav,
  tightestSpare,
}: {
  nav: Nav;
  /** The Today headline's computed tight point. `null` until the screen has mounted (the gate).
   *  Threaded down so the gap nudge and the hero number never disagree. */
  tightestSpare: number | null;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const subs = useAppStore((st) => st.subs);
  const subPaused = useAppStore((st) => st.subPaused);
  const onboarding = useAppStore((st) => st.onboarding);
  const cycles = useAppStore((st) => st.cycles);
  const transactions = useAppStore((st) => st.transactions);
  const tightPointGoal = useAppStore((st) => st.tightPointGoal);
  const readerCandidates = useReaderCandidates();
  const shelf = useShelf();

  const nextSub = subs
    .filter(
      (sub) => !subPaused[sub.name] && sub.nextRenewalDaysAway >= 0 && sub.nextRenewalDaysAway <= 7,
    )
    .sort((a, b) => a.nextRenewalDaysAway - b.nextRenewalDaysAway)[0];

  const sevenDayCutoff = Date.now() - 7 * 86_400_000;
  const recentSpend = transactions
    .filter((tx) => tx.amount < 0 && new Date(tx.when).getTime() >= sevenDayCutoff)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  // 24-Hour Shelf — items whose 24h wait has elapsed are waiting for the user to decide
  // (keep / let go). They belong on Today, not buried in a sheet you have to know to open.
  const ripeShelf = shelf.filter(
    (it) => it.status === 'pending' && new Date(it.dueAt).getTime() <= Date.now(),
  );

  const nudges: Nudge[] = [];

  // If Today is showing the "overspent" pressure band, Shortfall is the single most important
  // door. Web gates on nav.pressure === 'overspent'; RN derives the identical band from the
  // threaded tightestSpare (pressure.ts: tightSpare < 0 → 'overspent') so the nudge and the
  // hero number can never disagree.
  if (tightestSpare !== null && tightestSpare < 0) {
    nudges.push({
      key: 'shortfall',
      tone: 'accent',
      label: "You won't make it to payday as things stand. Let's look at three calm moves.",
      cta: 'Open →',
      onPress: () => nav.go('shortfall'),
    });
  }

  if (!onboarding.done) {
    nudges.push({
      key: 'onboard',
      tone: 'accent',
      label: 'Tell Folio your rhythm — 30 seconds, then numbers feel like yours.',
      cta: 'Begin',
      onPress: () => nav.openSheet('onboarding'),
    });
  }

  // Unreviewed intake candidates — the "waiting to be checked" chip. Sits above shelf so a fresh
  // statement/paste is the first thing you see when you land back on Today (web parity: TodayNudges.tsx
  // review-queue nudge, priority slot after onboarding + before shelf). Routes to 'visualizer' — RN's
  // real multi-candidate review screen for the staged `readerCandidates` queue (see STORE-SEAM NOTE
  // above); NOT 'review', which is the separate single-decision manual-entry card.
  if (readerCandidates.length > 0) {
    const [firstCandidate] = readerCandidates;
    // RN's CandidateSource union is 'csv' | 'paste' | 'pdf' | 'photo' (importSheet.ts) — mirrors the
    // web source label mapping (pdf→statement, image→photo, paste→paste) onto RN's actual source set.
    const sourceLabel =
      firstCandidate?.source === 'paste'
        ? 'paste'
        : firstCandidate?.source === 'photo'
          ? 'photo'
          : 'statement';
    nudges.push({
      key: 'review-queue',
      tone: 'accent',
      label:
        readerCandidates.length === 1
          ? `1 thing waiting to be checked — from your ${sourceLabel}.`
          : `${readerCandidates.length} things waiting to be checked.`,
      cta: 'Check →',
      onPress: () => nav.go('visualizer'),
    });
  }

  if (ripeShelf.length > 0) {
    const first = ripeShelf[0]!;
    nudges.push({
      key: 'shelf',
      tone: 'melo',
      label:
        ripeShelf.length === 1
          ? `You parked ${first.label} · £${first.amount} a day ago. Still want it?`
          : `${ripeShelf.length} things you parked yesterday — still want them?`,
      cta: 'Look →',
      onPress: () => nav.openSheet('shelf'),
    });
  }

  if (nextSub) {
    nudges.push({
      key: 'melo-sub',
      tone: 'melo',
      label: `Melo caught ${nextSub.name} · renews in ${nextSub.nextRenewalDaysAway} ${nextSub.nextRenewalDaysAway === 1 ? 'day' : 'days'} for £${nextSub.cost.toFixed(2)}. Pause for a month?`,
      cta: 'Pause →',
      onPress: () => nav.openMelo({ prefill: `Yes — pause ${nextSub.name} for a month.` }),
    });
  } else if (tightPointGoal && tightestSpare !== null && tightestSpare < tightPointGoal) {
    const gapToFind = tightPointGoal - tightestSpare;
    nudges.push({
      key: 'melo-tight',
      tone: 'melo',
      label: `Melo sees £${gapToFind} between your low point and your goal. Want to talk it through?`,
      cta: 'Talk it through →',
      onPress: () => nav.openMelo({ prefill: `Help me find £${gapToFind} before the low point.` }),
    });
  } else if (recentSpend > 0) {
    nudges.push({
      key: 'melo-spend',
      tone: 'melo',
      label: `Melo tracked £${recentSpend.toFixed(0)} out the door in the last 7 days. Want to look at where?`,
      cta: 'Open →',
      onPress: () => nav.openMelo({ prefill: 'Where did my money go this week?' }),
    });
  }

  // Payday ritual — if payday is within 2 days or already past today without a close, surface
  // the ritual so it stops being a hidden More link.
  const now = useMemo(() => new Date(), []);
  const daysToPayday = useMemo(() => {
    if (!onboarding.done) return null;
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = onboarding.payday;
    let next = new Date(y, m, d);
    if (next.getTime() < now.getTime()) next = new Date(y, m + 1, d);
    return Math.round((next.getTime() - now.getTime()) / 86_400_000);
  }, [now, onboarding.done, onboarding.payday]);
  const lastClosedAt = cycles[0]?.closedAt ?? null;
  const cycleClosedRecently = useMemo(() => {
    if (!lastClosedAt) return false;
    return now.getTime() - new Date(lastClosedAt + 'T00:00:00').getTime() < 3 * 86_400_000;
  }, [lastClosedAt, now]);
  if (onboarding.done && daysToPayday !== null && daysToPayday <= 2 && !cycleClosedRecently) {
    nudges.push({
      key: 'ritual',
      tone: 'melo',
      label:
        daysToPayday === 0
          ? "Payday's here. Ready to wrap the month up?"
          : `Payday in ${daysToPayday} ${daysToPayday === 1 ? 'day' : 'days'} — the review takes four steps.`,
      cta: 'Start →',
      onPress: () => nav.go('ritual'),
    });
  }

  if (cycles.length >= 1 && onboarding.done) {
    nudges.push({
      key: 'insights',
      tone: 'ink',
      label: `${cycles.length} ${cycles.length === 1 ? 'month' : 'months'} done · see how they've looked`,
      cta: 'Open',
      onPress: () => nav.go('insights'),
    });
  }

  if (nudges.length === 0) return null;

  // Collapsed: one chip, always. Single nudge → shows its label + CTA. Multiple → shows a "+N"
  // badge, tap runs the top-priority action so the user goes straight to the thing that matters most.
  const top = nudges[0]!;
  const extra = nudges.length - 1;
  const accessibilityLabel = extra > 0 ? `${nudges.length} things to check` : top.label;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={top.onPress}
        style={({ pressed: isPressed }) => [
          styles.banner,
          top.tone === 'accent' ? s.bannerAccent : top.tone === 'melo' ? s.bannerMelo : s.bannerInk,
          isPressed ? pressed : undefined,
        ]}
      >
        {top.tone === 'melo' ? (
          <Melo size={20} mood="curious" />
        ) : (
          <View style={[styles.dot, top.tone === 'accent' ? s.dotAccent : s.dotMuted]} />
        )}
        <Text style={[styles.label, { color: t.ink }]} numberOfLines={1}>
          {top.label}
        </Text>
        {extra > 0 && (
          <View style={[styles.badge, { backgroundColor: t.inset }]}>
            <Text style={[styles.badgeText, { color: t.muted }]}>+{extra}</Text>
          </View>
        )}
        <Text
          style={[
            styles.cta,
            top.tone === 'accent' ? s.ctaAccent : top.tone === 'melo' ? s.ctaInk : s.ctaMuted,
          ]}
        >
          {top.cta}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: gap.lg,
    marginTop: gap.md,
  },
  banner: {
    minHeight: MIN_TAP,
    borderRadius: radius.xl,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md - 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
  badge: {
    borderRadius: radius.xl,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  cta: {
    fontSize: 11.5,
    fontWeight: '500',
  },
});

function makeStyles(t: Palette) {
  return StyleSheet.create({
    bannerAccent: {
      backgroundColor: t.calmSoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.calm,
    },
    bannerMelo: {
      backgroundColor: t.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
    },
    bannerInk: {
      backgroundColor: t.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
    },
    dotAccent: { backgroundColor: t.calm },
    dotMuted: { backgroundColor: t.muted },
    ctaAccent: { color: t.calm },
    ctaInk: { color: t.ink },
    ctaMuted: { color: t.muted },
  });
}
