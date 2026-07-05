// Activity (MELO_BLUEPRINT.md §2): the spend log, grouped by day, newest first — plus the inline
// log-it row that teaches the forecast. Logging a spend IS fresh data, not bookkeeping.

import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatPounds, type SpendEntry } from '@folio/melo-engine';
import { Body, Display, GhostButton, Muted, Surface, useTheme } from '@/surfaces/pressureMap/kit';

import { dayLabel, todayISO } from '../state/derive';
import { useMeloStore } from '../state/meloStore';

type Props = {
  onClose: () => void;
};

interface DayGroup {
  readonly dateISO: string;
  readonly entries: readonly SpendEntry[];
  readonly totalPence: number;
}

function groupByDay(spendLog: readonly SpendEntry[]): readonly DayGroup[] {
  const byDate = new Map<string, SpendEntry[]>();
  for (const entry of spendLog) {
    const bucket = byDate.get(entry.atISO) ?? [];
    bucket.push(entry);
    byDate.set(entry.atISO, bucket);
  }
  return [...byDate.entries()]
    .map(([dateISO, entries]) => ({
      dateISO,
      entries,
      totalPence: entries.reduce((sum, e) => sum + e.amountPence, 0),
    }))
    .sort((a, b) => (a.dateISO < b.dateISO ? 1 : a.dateISO > b.dateISO ? -1 : 0));
}

export function Transactions({ onClose }: Props) {
  const t = useTheme();
  const store = useMeloStore();
  const [amountText, setAmountText] = useState('');

  const groups = useMemo(() => groupByDay(store.state.spendLog), [store.state.spendLog]);

  const logIt = () => {
    const pounds = Number.parseInt(amountText.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(pounds) || pounds <= 0) return;
    store.addSpend(pounds * 100, todayISO());
    store.bump('spendLogged');
    setAmountText('');
  };

  return (
    <View style={[s.root, { backgroundColor: t.canvas }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Display>Activity.</Display>
        <Muted style={s.sub}>Every spend you log sharpens tomorrow’s forecast.</Muted>

        <Surface style={s.addRow} tone="sunken">
          <Text style={[s.pound, { color: t.muted }]}>£</Text>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="number-pad"
            returnKeyType="done"
            placeholder="12"
            placeholderTextColor={t.muted}
            style={[s.field, { color: t.ink }]}
            onSubmitEditing={logIt}
          />
          <GhostButton label="Log it" onPress={logIt} />
        </Surface>

        {groups.length === 0 ? (
          <Surface style={s.empty} tone="sunken">
            <Body style={s.emptyLine}>
              Nothing logged yet — one spend teaches the forecast your pace.
            </Body>
          </Surface>
        ) : (
          groups.map((group) => (
            <View key={group.dateISO} style={s.dayBlock}>
              <View style={s.dayHead}>
                <Muted style={s.dayLabel}>{dayLabel(group.dateISO)}</Muted>
                <Muted style={s.dayTotal}>{formatPounds(group.totalPence)}</Muted>
              </View>
              <Surface style={s.dayCard} tone="sunken">
                {group.entries.map((entry) => (
                  <View key={entry.id} style={s.row}>
                    <Text style={[s.rowNote, { color: t.ink }]} numberOfLines={1}>
                      {entry.note ?? 'Spend'}
                    </Text>
                    <Text style={[s.rowAmount, { color: t.ink }]}>
                      {formatPounds(entry.amountPence)}
                    </Text>
                  </View>
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

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 26, paddingTop: 30, paddingBottom: 40 },
  sub: { marginTop: 6, lineHeight: 20 },
  addRow: { marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pound: { fontSize: 20 },
  field: { flex: 1, fontSize: 22, fontWeight: '600', fontVariant: ['tabular-nums'] },
  empty: { marginTop: 22 },
  emptyLine: { lineHeight: 20 },
  dayBlock: { marginTop: 20 },
  dayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  dayLabel: { fontSize: 11.5, letterSpacing: 0.6 },
  dayTotal: { fontSize: 11.5, fontVariant: ['tabular-nums'] },
  dayCard: { gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowNote: { fontSize: 14.5, flexShrink: 1 },
  rowAmount: { fontSize: 14.5, fontVariant: ['tabular-nums'], fontWeight: '600' },
  cta: { marginTop: 28 },
});
