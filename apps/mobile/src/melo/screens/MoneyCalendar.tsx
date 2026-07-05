// The Money Calendar (MELO_BLUEPRINT.md §2): the cycle laid out as a chronological timeline —
// bills landing, bills due, payday, and the one danger day, in the order they actually happen.
// No month grid: a calendar of DAYS THAT MATTER, not a wall of empty squares.

import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { addDays, buildCalendarRows, formatPounds, type CalendarRow } from '@folio/melo-engine';
import { Body, Display, GhostButton, Muted, Surface, useTheme } from '@/surfaces/pressureMap/kit';

import { deriveLive, dayLabel } from '../state/derive';
import { useMeloStore } from '../state/meloStore';

type Props = {
  onClose: () => void;
};

export function MoneyCalendar({ onClose }: Props) {
  const t = useTheme();
  const store = useMeloStore();
  const derived = useMemo(() => deriveLive(store.state), [store.state]);

  const rows: readonly CalendarRow[] = useMemo(() => {
    const dangerISO =
      derived.dangerDayOffset !== null ? addDays(derived.today, derived.dangerDayOffset) : null;
    return buildCalendarRows({
      todayISO: derived.today,
      payday: derived.payday,
      cycleStart: derived.cycleStart,
      bills: derived.shield.bills.map((b) => ({
        name: b.name,
        amountPence: b.amountPence,
        dueDate: b.dueDate,
        landed: b.status === 'landed',
      })),
      dangerISO,
    });
  }, [derived]);

  const grouped = useMemo(() => {
    const byDate = new Map<string, CalendarRow[]>();
    for (const row of rows) {
      const bucket = byDate.get(row.dateISO) ?? [];
      bucket.push(row);
      byDate.set(row.dateISO, bucket);
    }
    return [...byDate.entries()];
  }, [rows]);

  return (
    <View style={[s.root, { backgroundColor: t.canvas }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Display>The month, laid out.</Display>
        <Muted style={s.sub}>Every day that matters between now and payday — nothing else.</Muted>

        {grouped.length === 0 ? (
          <Surface style={s.empty} tone="sunken">
            <Body style={s.emptyLine}>
              Nothing scheduled this cycle — clear water to {derived.paydayLabel}.
            </Body>
          </Surface>
        ) : (
          grouped.map(([dateISO, dayRows]) => (
            <View key={dateISO} style={s.dayBlock}>
              <Muted style={s.dayLabel}>{dayLabel(dateISO)}</Muted>
              <Surface style={s.dayCard} tone="sunken">
                {dayRows.map((row, i) => (
                  <CalendarRowView key={`${row.kind}-${i}`} row={row} />
                ))}
              </Surface>
            </View>
          ))
        )}

        <View style={s.cta}>
          <GhostButton label="back" onPress={onClose} />
        </View>
      </ScrollView>
    </View>
  );
}

function CalendarRowView({ row }: { row: CalendarRow }) {
  const t = useTheme();
  const isPayday = row.kind === 'payday';
  const isDanger = row.kind === 'danger';
  const isToday = row.kind === 'today';

  return (
    <View
      style={[
        s.row,
        isToday ? { backgroundColor: t.inset, borderRadius: 10, paddingHorizontal: 8 } : null,
      ]}
    >
      <Text
        style={[
          s.rowLabel,
          {
            color: isPayday ? t.calmStrong : isDanger ? t.secondary : t.ink,
            fontWeight: isPayday ? '700' : '500',
          },
        ]}
      >
        {row.label}
      </Text>
      {row.amountPence !== null ? (
        <Text style={[s.rowAmount, { color: isPayday ? t.calmStrong : t.ink }]}>
          {formatPounds(row.amountPence)}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 26, paddingTop: 30, paddingBottom: 40 },
  sub: { marginTop: 6, lineHeight: 20 },
  empty: { marginTop: 22 },
  emptyLine: { lineHeight: 20 },
  dayBlock: { marginTop: 20 },
  dayLabel: { fontSize: 11.5, letterSpacing: 0.6, marginBottom: 8 },
  dayCard: { gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: 14.5, flexShrink: 1 },
  rowAmount: { fontSize: 14.5, fontVariant: ['tabular-nums'], fontWeight: '600' },
  cta: { marginTop: 28 },
});
