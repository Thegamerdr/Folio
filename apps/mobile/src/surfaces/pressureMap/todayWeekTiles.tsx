// TodayWeekTiles — Today's two closing info tiles.
//
// Faithful RN port of the web TodayWeekTiles (src/components/folio/screens/TodayWeekTiles.tsx): a
// 2-up grid. The left tile is a real weekly spend figure with a "+/-£NN vs last" delta (or "no prior
// week yet"); the right tile is either the next charge (name · £cost · in Nd) or, when there is no
// upcoming charge, the tight-point fallback (date · £spare).
//
// Presentation-only: the container computes thisWeek/lastWeek (from the transactions prop) and the
// nextCharge/tightPoint data, and hands them down already-shaped. Each tile is a tappable target.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { elevation, gap, paper, pressed, radius } from './kit';

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
  const deltaMinor = thisWeekMinor - lastWeekMinor;
  const noPrior = lastWeekMinor === 0;
  const deltaDown = deltaMinor <= 0;

  return (
    <View style={styles.grid}>
      <Pressable
        accessibilityHint="Compares this week's spending with last week."
        accessibilityRole="button"
        onPress={onCompareWeeks}
        style={({ pressed: isPressed }) => [styles.tile, isPressed ? pressed : undefined]}
      >
        <Text style={styles.tileLabel}>This week</Text>
        <Text style={styles.tileValue}>{pounds(thisWeekMinor)}</Text>
        <Text
          style={[
            styles.tileMeta,
            noPrior ? styles.tileMetaMuted : deltaDown ? styles.tileMetaDown : styles.tileMetaUp,
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
          style={({ pressed: isPressed }) => [styles.tile, isPressed ? pressed : undefined]}
        >
          <Text style={styles.tileLabel}>Next charge</Text>
          <Text numberOfLines={1} style={styles.tileValue}>
            {nextCharge.name}
          </Text>
          <Text style={styles.tileMetaMuted}>
            {poundsAndPence(nextCharge.costMinor)} ·{' '}
            {nextCharge.daysAway <= 0 ? 'today' : `in ${nextCharge.daysAway}d`}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityHint="Asks Melo why the tight point lands where it does."
          accessibilityRole="button"
          onPress={onAskTightPoint}
          style={({ pressed: isPressed }) => [styles.tile, isPressed ? pressed : undefined]}
        >
          <Text style={styles.tileLabel}>Tight point</Text>
          <Text numberOfLines={1} style={styles.tileValue}>
            {tightPoint.dayLabel} · {pounds(tightPoint.spareMinor)}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: gap.sm },
  tile: {
    flex: 1,
    backgroundColor: paper.surface,
    borderRadius: radius.lg,
    padding: 14,
    gap: 2,
    ...elevation.card,
  },
  tileLabel: {
    color: paper.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  tileValue: {
    color: paper.ink,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  tileMeta: { fontSize: 11, fontVariant: ['tabular-nums'], marginTop: 1 },
  tileMetaMuted: { color: paper.muted, fontSize: 11, fontVariant: ['tabular-nums'], marginTop: 1 },
  tileMetaDown: { color: paper.positiveInk },
  tileMetaUp: { color: paper.repairInk },
});
