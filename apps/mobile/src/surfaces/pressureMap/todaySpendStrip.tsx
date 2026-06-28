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
import { gap, pressed, radius, useTheme, type Palette } from './kit';

// Category → segment colour. Mirrors the web palette intent (food = accent, bills = coral, etc.)
// mapped onto the active palette tokens so the strip never introduces an off-palette hue and
// follows the theme. These are inline View fills, so they read the palette directly (not a
// StyleSheet).
function categoryColors(t: Palette): Readonly<Record<string, string>> {
  return {
    food: t.calm,
    transport: t.secondary,
    fun: t.caution,
    bills: t.repair,
    shopping: t.positive,
    other: t.muted,
  };
}

function colorForCategory(colors: Readonly<Record<string, string>>, category: string): string {
  return colors[category] ?? colors.other!;
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
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const colors = useMemo(() => categoryColors(t), [t]);
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
      style={({ pressed: isPressed }) => [layout.root, isPressed ? pressed : undefined]}
    >
      <View style={layout.header}>
        <Text style={s.headerLabel}>This week · {poundsLabel(total)}</Text>
        <Text style={s.headerHint}>tap to ask Melo →</Text>
      </View>

      <View style={s.bar}>
        {entries.map(([category, value]) => (
          <View
            key={category}
            style={{
              flexGrow: value / total,
              flexBasis: 0,
              backgroundColor: colorForCategory(colors, category),
            }}
          />
        ))}
      </View>

      <View style={layout.legend}>
        {entries.slice(0, 4).map(([category, value]) => (
          <View key={category} style={layout.legendItem}>
            <View
              style={[layout.legendDot, { backgroundColor: colorForCategory(colors, category) }]}
            />
            <Text style={s.legendText}>
              {category} {poundsLabel(value)}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

// Colour-free styles — shared across light and dark.
const layout = StyleSheet.create({
  root: { gap: gap.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: gap.md, rowGap: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
});

// Colour-bearing styles, resolved against the active palette.
function makeStyles(t: Palette) {
  return StyleSheet.create({
    headerLabel: {
      color: t.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    headerHint: { color: t.muted, fontSize: 11 },
    bar: {
      flexDirection: 'row',
      height: 8,
      borderRadius: radius.pill,
      overflow: 'hidden',
      backgroundColor: t.sunken,
    },
    legendText: { color: t.muted, fontSize: 11, fontVariant: ['tabular-nums'] },
  });
}
