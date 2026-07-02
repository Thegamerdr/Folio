// The Bills Shield (MELO_BLUEPRINT.md §2 P9, §14 item 10): every bill's place in the current
// cycle — landed, due today, or still ahead and shielded — plus an honest coverage bar. The
// shield never claims more than the balance can hold: coverage is computed, not asserted.

import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatPounds } from '@folio/melo-engine';
import { Body, Display, GhostButton, Muted, Surface, useTheme } from '@/surfaces/pressureMap/kit';

import type { ShieldView } from '../state/derive';

type Props = {
  shield: ShieldView;
  paydayLabel: string;
  onClose: () => void;
};

export function BillsShield({ shield, paydayLabel, onClose }: Props) {
  const t = useTheme();
  const fillRatio =
    shield.shieldedPence > 0 ? Math.min(1, shield.coveredPence / shield.shieldedPence) : 1;
  const landed = shield.bills.filter((b) => b.status === 'landed');
  const ahead = shield.bills.filter((b) => b.status !== 'landed');

  return (
    <View style={[s.root, { backgroundColor: t.canvas }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Display>The Bills Shield.</Display>
        <Muted style={s.sub}>
          Bill money is set aside before anything else — the Safe Zone is what’s left after.
        </Muted>

        <Surface style={s.coverage} tone="sunken">
          <View style={s.coverageHead}>
            <Body style={s.coverageLabel}>
              {shield.shieldedPence > 0 ? 'Still to land this cycle' : 'Nothing left to land'}
            </Body>
            <Body style={s.coverageLabel}>{formatPounds(shield.shieldedPence)}</Body>
          </View>
          <View style={[s.barTrack, { backgroundColor: t.inset }]}>
            <View
              style={[
                s.barFill,
                {
                  backgroundColor: shield.covered ? t.positive : t.calmStrong,
                  width: `${Math.round(fillRatio * 100)}%`,
                },
              ]}
            />
          </View>
          <Muted style={s.coverageSub}>
            {shield.shieldedPence === 0
              ? `Every bill this cycle has landed. Clear water to ${paydayLabel}.`
              : shield.covered
                ? `Covered — ${formatPounds(shield.shieldedPence)} is held and ready.`
                : `${formatPounds(shield.coveredPence)} of ${formatPounds(shield.shieldedPence)} covered. Honest numbers — the plan starts there.`}
          </Muted>
        </Surface>

        {ahead.length > 0 ? (
          <>
            <Muted style={s.sectionTag}>AHEAD — SHIELDED</Muted>
            <Surface style={s.list} tone="sunken">
              {ahead.map((b) => (
                <View key={`${b.name}-${b.dueDate}`} style={s.row}>
                  <View style={s.rowLeft}>
                    <Text style={[s.rowName, { color: t.ink }]}>{b.name}</Text>
                    <Text style={[s.rowDue, { color: t.muted }]}>
                      {b.status === 'dueToday' ? 'due today' : b.dueLabel}
                    </Text>
                  </View>
                  <View style={s.rowRight}>
                    <Text style={[s.rowAmount, { color: t.ink }]}>
                      {formatPounds(b.amountPence)}
                    </Text>
                    <Text
                      style={[
                        s.rowState,
                        { color: b.status === 'dueToday' ? t.calmStrong : t.positive },
                      ]}
                    >
                      {b.status === 'dueToday' ? 'today' : 'shielded ✓'}
                    </Text>
                  </View>
                </View>
              ))}
            </Surface>
          </>
        ) : null}

        {landed.length > 0 ? (
          <>
            <Muted style={s.sectionTag}>LANDED THIS CYCLE</Muted>
            <Surface style={s.list} tone="sunken">
              {landed.map((b) => (
                <View key={`${b.name}-${b.dueDate}`} style={s.row}>
                  <View style={s.rowLeft}>
                    <Text style={[s.rowName, { color: t.secondary }]}>{b.name}</Text>
                    <Text style={[s.rowDue, { color: t.muted }]}>{b.dueLabel}</Text>
                  </View>
                  <View style={s.rowRight}>
                    <Text style={[s.rowAmount, { color: t.secondary }]}>
                      {formatPounds(b.amountPence)}
                    </Text>
                    <Text style={[s.rowState, { color: t.muted }]}>landed ✓</Text>
                  </View>
                </View>
              ))}
            </Surface>
          </>
        ) : null}

        {shield.bills.length === 0 ? (
          <Surface style={s.list} tone="sunken">
            <Body style={s.emptyLine}>
              No bills on the shield yet. Add them in settings and they’re protected first, every
              cycle.
            </Body>
          </Surface>
        ) : null}

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
  coverage: { marginTop: 22, gap: 10 },
  coverageHead: { flexDirection: 'row', justifyContent: 'space-between' },
  coverageLabel: { fontWeight: '600' },
  barTrack: { height: 10, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  coverageSub: { lineHeight: 19 },
  sectionTag: { marginTop: 22, marginBottom: 10, fontSize: 11.5, letterSpacing: 0.8 },
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { flexShrink: 1, gap: 2 },
  rowName: { fontSize: 14.5, fontWeight: '500' },
  rowDue: { fontSize: 12 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowAmount: { fontSize: 14.5, fontVariant: ['tabular-nums'], fontWeight: '600' },
  rowState: { fontSize: 11.5, fontWeight: '600' },
  emptyLine: { lineHeight: 20 },
  cta: { marginTop: 28 },
});
