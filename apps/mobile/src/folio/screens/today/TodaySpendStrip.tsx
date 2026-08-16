// TodaySpendStrip — faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/today/TodaySpendStrip.tsx).
//
// @rn-component TodaySpendStrip
// @parent       TodayScreen
// @purpose      Stacked-bar of last-7-day spend by category. Tap → ask Melo where the money went.
// @reads        transactions (last 7 days, amount < 0)
// @writes       —
// @opens-sheet  melo-chat (via nav.openMelo)
// @copy         FROZEN — verbatim from the deck.
// @tokens       calm (accent) · ink · caution · repair (negative) · positive · muted · inset
// @notes        Hidden when no spend in window (empty branch → null). Palette keyed by category enum;
//               the web's Tailwind `/60`–`/70` opacities are mirrored with matching token opacities.

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, pressed, useTheme, type Palette } from '@/folio/theme';
import { useAppStore } from '@/folio/store';
import type { Nav } from '@/folio/types';

type Swatch = { color: string; opacity: number };

function categorySwatch(t: Palette, category: string): Swatch {
  switch (category) {
    case 'food':
      return { color: t.calmStrong, opacity: 1 };
    case 'transport':
      return { color: t.ink, opacity: 0.7 };
    case 'fun':
      return { color: t.caution, opacity: 1 };
    case 'bills':
      return { color: t.repair, opacity: 0.6 };
    case 'shopping':
      return { color: t.positive, opacity: 0.6 };
    default:
      return { color: t.muted, opacity: 0.6 };
  }
}

export function TodaySpendStrip({ nav }: { nav: Nav }) {
  const t = useTheme();
  const transactions = useAppStore((st) => st.transactions);
  const cutoff = Date.now() - 7 * 86_400_000;

  const byCategory = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.amount >= 0) continue;
      if (new Date(tx.when).getTime() < cutoff) continue;
      acc[tx.category] = (acc[tx.category] ?? 0) + Math.abs(tx.amount);
    }
    return acc;
  }, [transactions, cutoff]);

  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="This week’s spending by category — tap to ask Melo"
      onPress={() => nav.openMelo({ prefill: 'Where did my money go this week?' })}
      style={({ pressed: isPressed }) => [styles.wrap, isPressed ? pressed : undefined]}
    >
      <View style={styles.headRow}>
        <Text style={[styles.headEyebrow, { color: t.muted }]}>
          This week · £{total.toFixed(0)}
        </Text>
        <Text style={[styles.headHint, { color: t.muted }]}>tap to ask Melo →</Text>
      </View>

      <View style={[styles.bar, { backgroundColor: t.inset }]}>
        {entries.map(([cat, v]) => {
          const sw = categorySwatch(t, cat);
          return (
            <View
              key={cat}
              style={{
                width: `${(v / total) * 100}%`,
                backgroundColor: sw.color,
                opacity: sw.opacity,
              }}
            />
          );
        })}
      </View>

      <View style={styles.legend}>
        {entries.slice(0, 4).map(([cat, v]) => {
          const sw = categorySwatch(t, cat);
          return (
            <View key={cat} style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: sw.color, opacity: sw.opacity }]}
              />
              <Text style={[styles.legendText, { color: t.muted }]}>
                {cat} £{v.toFixed(0)}
              </Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: gap.md,
    marginHorizontal: gap.lg,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gap.xxs,
    marginBottom: gap.xs + 2,
  },
  headEyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontVariant: ['tabular-nums'],
  },
  headHint: {
    fontSize: 10.5,
  },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: gap.sm,
    columnGap: gap.md,
    rowGap: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});
