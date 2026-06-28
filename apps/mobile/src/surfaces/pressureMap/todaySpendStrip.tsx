// TodaySpendStrip — a thin horizontal "this week by category" bar + legend.
//
// Faithful RN port of the web TodaySpendStrip (src/components/folio/screens/TodaySpendStrip.tsx):
// a one-line header ("This week · £NNN" + a tap-to-ask-Melo hint), a single rounded bar split into
// category segments by share of spend, and a wrapped legend of the top four categories. The whole
// strip is one tappable target that asks Melo where the week went.
//
// It is computed purely from the `transactions` prop the screen passes (already windowed to the
// week and mapped to a presentation shape — see TodayTransaction). No store access, no engine.

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TodayTransaction } from './todayTypes';
import { gap, paper, pressed, radius } from './kit';

// Category → segment colour. Mirrors the web palette intent (food = accent, bills = coral, etc.)
// mapped onto the paper tokens so the strip never introduces an off-palette hue.
const CATEGORY_COLOR: Readonly<Record<string, string>> = {
  food: paper.calm,
  transport: paper.secondary,
  fun: paper.caution,
  bills: paper.repair,
  shopping: paper.positive,
  other: paper.muted,
};

function colorForCategory(category: string): string {
  return CATEGORY_COLOR[category] ?? CATEGORY_COLOR.other!;
}

function poundsLabel(minor: number): string {
  return `£${Math.round(Math.abs(minor) / 100).toLocaleString('en-GB')}`;
}

export function TodaySpendStrip({
  transactions,
  onAskMelo,
}: {
  /** This week's spends, already windowed to the last 7 days and mapped by the container. */
  transactions: readonly TodayTransaction[];
  onAskMelo: () => void;
}) {
  const entries = useMemo(() => {
    const byCategory: Record<string, number> = {};
    for (const t of transactions) {
      if (t.amountMinor >= 0) continue;
      byCategory[t.category] = (byCategory[t.category] ?? 0) + Math.abs(t.amountMinor);
    }
    return Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <Pressable
      accessibilityHint="Asks Melo where this week's money went."
      accessibilityRole="button"
      onPress={onAskMelo}
      style={({ pressed: isPressed }) => [styles.root, isPressed ? pressed : undefined]}
    >
      <View style={styles.header}>
        <Text style={styles.headerLabel}>This week · {poundsLabel(total)}</Text>
        <Text style={styles.headerHint}>tap to ask Melo →</Text>
      </View>

      <View style={styles.bar}>
        {entries.map(([category, value]) => (
          <View
            key={category}
            style={{
              flexGrow: value / total,
              flexBasis: 0,
              backgroundColor: colorForCategory(category),
            }}
          />
        ))}
      </View>

      <View style={styles.legend}>
        {entries.slice(0, 4).map(([category, value]) => (
          <View key={category} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colorForCategory(category) }]} />
            <Text style={styles.legendText}>
              {category} {poundsLabel(value)}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: gap.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  headerLabel: {
    color: paper.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headerHint: { color: paper.muted, fontSize: 11 },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: paper.sunken,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: gap.md, rowGap: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: paper.muted, fontSize: 11, fontVariant: ['tabular-nums'] },
});
