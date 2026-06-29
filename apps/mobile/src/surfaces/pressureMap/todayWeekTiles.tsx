// TodayWeekTiles — Today's two closing info tiles.
//
// Faithful RN port of the web TodayWeekTiles (src/components/folio/screens/TodayWeekTiles.tsx): a
// 2-up grid. The left tile is a real weekly spend figure with a "+/-£NN vs last" delta (or "no prior
// week yet"); the right tile is either the next charge (name · £cost · in Nd) or, when there is no
// upcoming charge, the low-point fallback (date · £spare).
//
// Presentation-only: the container computes thisWeek/lastWeek (from the transactions prop) and the
// nextCharge/lowPoint data, and hands them down already-shaped. Each tile is a tappable target.

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { elevation, gap, pressed, radius, useTheme, type Palette } from './kit';

export type TodayNextCharge = Readonly<{
  name: string;
  costMinor: number;
  daysAway: number;
}>;

export type TodayTightPoint = Readonly<{
  dayLabel: string;
  spareMinor: number;
}>;

function pounds(minor: number): string {
  return `£${Math.round(Math.abs(minor) / 100).toLocaleString('en-GB')}`;
}

function poundsAndPence(minor: number): string {
  return `£${(Math.abs(minor) / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function TodayWeekTiles({
  thisWeekMinor,
  lastWeekMinor,
  nextCharge,
  tightPoint,
  onCompareWeeks,
  onOpenNextCharge,
  onAskTightPoint,
}: {
  thisWeekMinor: number;
  /** Last week's spend; 0 means "no prior week yet" (mirrors the web copy). */
  lastWeekMinor: number;
  /** The next live charge, if any. When absent the right tile falls back to the tight point. */
  nextCharge?: TodayNextCharge | undefined;
  tightPoint: TodayTightPoint;
  onCompareWeeks: () => void;
  onOpenNextCharge: () => void;
  onAskTightPoint: () => void;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const deltaMinor = thisWeekMinor - lastWeekMinor;
  const noPrior = lastWeekMinor === 0;
  const deltaDown = deltaMinor <= 0;

  return (
    <View style={layout.grid}>
      <Pressable
        accessibilityHint="Compares this week's spending with last week."
        accessibilityRole="button"
        onPress={onCompareWeeks}
        style={({ pressed: isPressed }) => [s.tile, isPressed ? pressed : undefined]}
      >
        <Text style={s.tileLabel}>This week</Text>
        <Text style={s.tileValue}>{pounds(thisWeekMinor)}</Text>
        <Text
          style={[
            layout.tileMeta,
            noPrior ? s.tileMetaMuted : deltaDown ? s.tileMetaDown : s.tileMetaUp,
          ]}
        >
          {noPrior ? 'no prior week yet' : `${deltaDown ? '−' : '+'}${pounds(deltaMinor)} vs last`}
        </Text>
      </Pressable>

      {nextCharge ? (
        <Pressable
          accessibilityHint="Opens your charges."
          accessibilityRole="button"
          onPress={onOpenNextCharge}
          style={({ pressed: isPressed }) => [s.tile, isPressed ? pressed : undefined]}
        >
          <Text style={s.tileLabel}>Next charge</Text>
          <Text numberOfLines={1} style={s.tileValue}>
            {nextCharge.name}
          </Text>
          <Text style={s.tileMetaMuted}>
            {poundsAndPence(nextCharge.costMinor)} ·{' '}
            {nextCharge.daysAway <= 0 ? 'today' : `in ${nextCharge.daysAway}d`}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityHint="Asks Melo why the low point lands where it does."
          accessibilityRole="button"
          onPress={onAskTightPoint}
          style={({ pressed: isPressed }) => [s.tile, isPressed ? pressed : undefined]}
        >
          <Text style={s.tileLabel}>Low point</Text>
          <Text numberOfLines={1} style={s.tileValue}>
            {tightPoint.dayLabel} · {pounds(tightPoint.spareMinor)}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// Colour-free styles — shared across light and dark.
const layout = StyleSheet.create({
  grid: { flexDirection: 'row', gap: gap.sm },
  tileMeta: { fontSize: 11, fontVariant: ['tabular-nums'], marginTop: 1 },
});

// Colour-bearing styles, resolved against the active palette.
function makeStyles(t: Palette) {
  return StyleSheet.create({
    tile: {
      flex: 1,
      backgroundColor: t.surface,
      borderRadius: radius.lg,
      padding: 14,
      gap: 2,
      ...elevation.card,
    },
    tileLabel: {
      color: t.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    tileValue: {
      color: t.ink,
      fontSize: 18,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      marginTop: 2,
    },
    tileMetaMuted: { color: t.muted, fontSize: 11, fontVariant: ['tabular-nums'], marginTop: 1 },
    tileMetaDown: { color: t.positiveInk },
    tileMetaUp: { color: t.repairInk },
  });
}
