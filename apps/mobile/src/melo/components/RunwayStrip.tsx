// The runway strip: today → payday as a row of day dots — bill markers on their days, a storm
// cell on the danger day, the payday flag at the end (MELO_BLUEPRINT.md §5.2 screen 8).

import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/surfaces/pressureMap/kit';

const SLATE = '#46505A';
const MAX_CELLS = 14;

export type RunwayBill = { day: number; label: string };

type Props = {
  daysToPayday: number;
  bills: readonly RunwayBill[];
  /** Day offset of the projected storm cell; null = no danger this cycle. */
  dangerDay: number | null;
  paydayLabel: string;
};

export function RunwayStrip({ daysToPayday, bills, dangerDay, paydayLabel }: Props) {
  const t = useTheme();
  const count = Math.max(2, Math.min(daysToPayday, MAX_CELLS));
  // Long cycles compress: day offsets map proportionally onto the available cells, so a bill on
  // day 18 of a 26-day cycle still shows (instead of falling off the 14-cell strip).
  const scale = (day: number) =>
    daysToPayday <= count ? day : Math.round((day * (count - 1)) / daysToPayday);
  const billByCell = new Map<number, string>();
  for (const b of bills) {
    const cell = scale(b.day);
    if (cell > 0 && cell < count - 1 && !billByCell.has(cell)) billByCell.set(cell, b.label);
  }
  const stormCell = dangerDay !== null ? Math.min(Math.max(scale(dangerDay), 1), count - 2) : null;
  // At high densities the per-cell words turn to confetti ("tod…") — the caption row below
  // already carries today/payday, so cells go quiet except the storm, which must stay named.
  const showWordLabels = count <= 10;

  const cells = Array.from({ length: count }, (_, cell) => {
    const isToday = cell === 0;
    const isPayday = cell === count - 1;
    const isStorm = stormCell !== null && cell === stormCell;
    const billLabel = billByCell.get(cell);

    let dotStyle = [s.dot, { backgroundColor: t.hairlineStrong }];
    let label = '';
    if (isToday) {
      dotStyle = [s.dotToday, { backgroundColor: t.calm }];
      label = showWordLabels ? 'today' : '';
    } else if (isPayday) {
      dotStyle = [s.dotToday, { backgroundColor: t.payday }];
      label = showWordLabels ? 'payday' : '';
    } else if (isStorm) {
      dotStyle = [s.dotStorm, { backgroundColor: SLATE }];
      label = 'storm';
    } else if (billLabel !== undefined) {
      dotStyle = [s.dotBill, { backgroundColor: t.muted }];
      label = showWordLabels ? billLabel : '';
    }

    return (
      <View key={cell} style={s.cell}>
        <View style={dotStyle} />
        <Text numberOfLines={1} style={[s.label, { color: t.muted }]}>
          {label}
        </Text>
      </View>
    );
  });

  return (
    <View>
      <View style={s.track}>{cells}</View>
      <View style={s.caption}>
        <Text style={[s.captionText, { color: t.muted }]}>{daysToPayday} days</Text>
        <Text style={[s.captionText, { color: t.muted }]}>{paydayLabel} ⚑</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  track: { flexDirection: 'row', alignItems: 'flex-start' },
  cell: { flex: 1, alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotToday: { width: 9, height: 9, borderRadius: 5 },
  dotBill: { width: 7, height: 7, borderRadius: 2.5 },
  dotStorm: { width: 16, height: 10, borderRadius: 5 },
  label: { fontSize: 9, height: 12 },
  caption: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  captionText: { fontSize: 11 },
});
