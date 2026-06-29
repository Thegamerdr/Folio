// TodayNudges — faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/today/TodayNudges.tsx).
//
// @rn-component TodayNudges
// @parent       TodayScreen
// @purpose      Up to 2 actionable banners: onboarding nudge, proactive Melo line, closed-cycle prompt.
// @reads        subs, subPaused, onboarding, cycles, transactions, tightPointGoal (+ the screen's
//               computed tightestSpare, passed down so the nudge never disagrees with the headline).
// @writes       —
// @opens-sheet  onboarding, melo-chat (via nav.openMelo)
// @copy         FROZEN — verbatim from the deck.
// @tokens       calm (accent) · calmSoft (accent-soft) · surface · ink · muted · hairline
// @notes        Proactive — never shows more than 2. Order: onboarding > melo > cycles. Renders
//               nothing when 0 nudges (empty branch). The Melo nudge hardcodes mood="soft" on the
//               web; the kit Melo has no "soft" mood, so we map it to the documented "curious".

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, pressed, radius, useTheme, type Palette } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { useAppStore } from '@/folio/store';
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

  const nextSub = subs
    .filter(
      (sub) => !subPaused[sub.name] && sub.nextRenewalDaysAway >= 0 && sub.nextRenewalDaysAway <= 7,
    )
    .sort((a, b) => a.nextRenewalDaysAway - b.nextRenewalDaysAway)[0];

  const sevenDayCutoff = Date.now() - 7 * 86_400_000;
  const recentSpend = transactions
    .filter((tx) => tx.amount < 0 && new Date(tx.when).getTime() >= sevenDayCutoff)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const nudges: Nudge[] = [];

  if (!onboarding.done) {
    nudges.push({
      key: 'onboard',
      tone: 'accent',
      label: 'Tell Folio your rhythm — 30 seconds, then numbers feel like yours.',
      cta: 'Begin',
      onPress: () => nav.openSheet('onboarding'),
    });
  }

  if (nextSub) {
    nudges.push({
      key: 'melo-sub',
      tone: 'melo',
      label: `${nextSub.name} renews in ${nextSub.nextRenewalDaysAway} ${nextSub.nextRenewalDaysAway === 1 ? 'day' : 'days'} · £${nextSub.cost.toFixed(2)}. Pause for a month?`,
      cta: 'Pause →',
      onPress: () => nav.openMelo({ prefill: `Yes — pause ${nextSub.name} for a month.` }),
    });
  } else if (tightPointGoal && tightestSpare !== null && tightestSpare < tightPointGoal) {
    const gapToFind = tightPointGoal - tightestSpare;
    nudges.push({
      key: 'melo-tight',
      tone: 'melo',
      label: `Low point £${tightestSpare}, your goal is £${tightPointGoal}. £${gapToFind} to find.`,
      cta: 'Talk it through →',
      onPress: () => nav.openMelo({ prefill: `Help me find £${gapToFind} before the low point.` }),
    });
  } else if (recentSpend > 0) {
    nudges.push({
      key: 'melo-spend',
      tone: 'melo',
      label: `£${recentSpend.toFixed(0)} out the door in the last 7 days. Want to look at where?`,
      cta: 'Open →',
      onPress: () => nav.openMelo({ prefill: 'Where did my money go this week?' }),
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

  return (
    <View style={styles.list}>
      {nudges.slice(0, 2).map((n) => (
        <Pressable
          key={n.key}
          accessibilityRole="button"
          onPress={n.onPress}
          style={({ pressed: isPressed }) => [
            styles.banner,
            n.tone === 'accent' ? s.bannerAccent : n.tone === 'melo' ? s.bannerMelo : s.bannerInk,
            isPressed ? pressed : undefined,
          ]}
        >
          {n.tone === 'melo' ? (
            <Melo size={20} mood="curious" />
          ) : (
            <View style={[styles.dot, n.tone === 'accent' ? s.dotAccent : s.dotMuted]} />
          )}
          <Text style={[styles.label, { color: t.ink }]}>{n.label}</Text>
          <Text
            style={[
              styles.cta,
              n.tone === 'accent' ? s.ctaAccent : n.tone === 'melo' ? s.ctaInk : s.ctaMuted,
            ]}
          >
            {n.cta}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: gap.lg,
    marginTop: gap.md,
    gap: gap.sm,
  },
  banner: {
    minHeight: MIN_TAP,
    borderRadius: radius.xl,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
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
