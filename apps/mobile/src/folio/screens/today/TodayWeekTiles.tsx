// TodayWeekTiles — faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/today/TodayWeekTiles.tsx).
//
// @rn-component TodayWeekTiles
// @parent       TodayScreen
// @purpose      Two side-by-side tiles: this-week spend vs last-week, and next subscription charge.
// @reads        transactions (last 14 days), subs, subPaused, pressure (for the tight-point fallback)
// @writes       —
// @opens-sheet  melo-chat (via nav.openMelo) · navigates to subs
// @copy         FROZEN — verbatim from the deck.
// @tokens       surface · hairline · muted · positive · repair (negative)
// @notes        Right tile falls back to a tight-point CTA when there's no upcoming renewal. The web
//               read `nav.pressure`; the RN Nav has no pressure, so it's threaded as a prop and the
//               fallback uses the shared pressureLow map.

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, pressed, radius, serif, useTheme } from '@/folio/theme';
import { useAppStore } from '@/folio/store';
import type { Nav, Pressure } from '@/folio/types';
import { pressureLow } from './pressure';

export function TodayWeekTiles({ nav, pressure }: { nav: Nav; pressure: Pressure }) {
  const t = useTheme();
  const transactions = useAppStore((st) => st.transactions);
  const subs = useAppStore((st) => st.subs);
  const subPaused = useAppStore((st) => st.subPaused);

  const { thisWeek, lastWeek } = useMemo(() => {
    const now = Date.now();
    const day = 86_400_000;
    let a = 0;
    let b = 0;
    for (const tx of transactions) {
      if (tx.amount >= 0) continue;
      const ago = (now - new Date(tx.when).getTime()) / day;
      if (ago < 7) a += Math.abs(tx.amount);
      else if (ago < 14) b += Math.abs(tx.amount);
    }
    return { thisWeek: a, lastWeek: b };
  }, [transactions]);

  const delta = thisWeek - lastWeek;
  const deltaColor = delta <= 0 ? t.positive : t.repair;

  const nextRenewal = useMemo(() => {
    const live = subs.filter((sub) => !subPaused[sub.name]);
    if (live.length === 0) return null;
    return [...live].sort((a, b) => a.nextRenewalDaysAway - b.nextRenewalDaysAway)[0];
  }, [subs, subPaused]);

  return (
    <View style={styles.grid}>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          nav.openMelo({ prefill: 'How does my spending this week compare to last week?' })
        }
        style={({ pressed: isPressed }) => [
          styles.tile,
          { backgroundColor: t.surface, borderColor: t.hairline },
          isPressed ? pressed : undefined,
        ]}
      >
        <Text style={[styles.tileEyebrow, { color: t.muted }]}>This week</Text>
        <Text style={[styles.tileValue, { color: t.ink }]}>£{thisWeek.toFixed(0)}</Text>
        <Text style={[styles.tileMeta, { color: lastWeek === 0 ? t.muted : deltaColor }]}>
          {lastWeek === 0
            ? 'no prior week yet'
            : `${delta <= 0 ? '−' : '+'}£${Math.abs(delta).toFixed(0)} vs last`}
        </Text>
      </Pressable>

      {nextRenewal ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.go('subs')}
          style={({ pressed: isPressed }) => [
            styles.tile,
            { backgroundColor: t.surface, borderColor: t.hairline },
            isPressed ? pressed : undefined,
          ]}
        >
          <Text style={[styles.tileEyebrow, { color: t.muted }]}>Next charge</Text>
          <Text style={[styles.tileValue, { color: t.ink }]}>{nextRenewal.name}</Text>
          <Text style={[styles.tileMeta, { color: t.muted }]}>
            £{nextRenewal.cost.toFixed(2)} ·{' '}
            {nextRenewal.nextRenewalDaysAway <= 0
              ? 'today'
              : `in ${nextRenewal.nextRenewalDaysAway}d`}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            nav.openMelo({
              prefill: `Why does my low point land at £${pressureLow[pressure]} on 7 Jul?`,
            })
          }
          style={({ pressed: isPressed }) => [
            styles.tile,
            { backgroundColor: t.surface, borderColor: t.hairline },
            isPressed ? pressed : undefined,
          ]}
        >
          <Text style={[styles.tileEyebrow, { color: t.muted }]}>Low point</Text>
          <Text style={[styles.tileValue, { color: t.ink }]}>7 Jul · £{pressureLow[pressure]}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    marginHorizontal: gap.lg,
    marginTop: gap.md,
    marginBottom: gap.xxl,
    gap: 10,
  },
  tile: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: 14,
  },
  tileEyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  tileValue: {
    marginTop: 4,
    fontFamily: serif.display,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  tileMeta: {
    fontSize: 10.5,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});
