// Growth & Debt (MELO_BLUEPRINT.md — mode-aware surfaces, growth + debt registers): props-free —
// self-derives from the store like the other screens, so the orchestrator can drop it in without
// threading numbers through. GROWTH shows the quiet, boring-miracle read of savings this cycle and
// the milestone ladder; DEBT lists debt-kind bills honestly and signposts that full payoff
// tracking isn't built yet — free, no upsell, ever.

import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatPounds } from '@folio/melo-engine';
import { Body, Display, GhostButton, Muted, Surface, useTheme } from '@/surfaces/pressureMap/kit';

import { deriveLive } from '../state/derive';
import { useMeloStore } from '../state/meloStore';

type Props = {
  onClose: () => void;
};

const MILESTONES_PENCE: readonly number[] = [10_000, 25_000, 50_000, 100_000];

function milestoneLabel(pence: number): string {
  return formatPounds(pence);
}

export function GrowthDebt({ onClose }: Props) {
  const t = useTheme();
  const store = useMeloStore();
  const live = deriveLive(store.state);

  const savingsThisCyclePence = live.savingsThisCyclePence;
  const bufferPence = store.state.setup.bufferPence;
  const positiveStreak = countTrailingPositive(store.state.cycleHistory);
  const reached = store.state.reachedMilestoneIds;

  const debtBills = store.state.setup.bills.filter((b) => b.kind === 'debt');
  const debtTotalPence = debtBills.reduce((sum, b) => sum + b.amountPence, 0);

  return (
    <View style={[s.root, { backgroundColor: t.canvas }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Display>Growth & debt.</Display>
        <Muted style={s.sub}>The boring miracle — quiet numbers that add up over time.</Muted>

        <Muted style={s.sectionTag}>GROWTH</Muted>
        <Surface style={s.list} tone="sunken">
          <View style={s.row}>
            <Body style={s.rowLabel}>Saved this cycle</Body>
            <Body style={s.rowValue}>{formatPounds(savingsThisCyclePence)}</Body>
          </View>
          <View style={s.row}>
            <Body style={s.rowLabel}>Buffer held</Body>
            <Body style={s.rowValue}>{formatPounds(bufferPence)}</Body>
          </View>
          <View style={s.row}>
            <Body style={s.rowLabel}>Cycles ended in the black</Body>
            <Body style={s.rowValue}>{positiveStreak}</Body>
          </View>
          <Muted style={s.growthNote}>
            No windfalls, no shortcuts — the boring miracle is doing this quietly, cycle after
            cycle, until the numbers speak for themselves.
          </Muted>
        </Surface>

        <Muted style={s.sectionTag}>MILESTONES — BUFFER</Muted>
        <Surface style={s.list} tone="sunken">
          {MILESTONES_PENCE.map((pence) => {
            const isReached = bufferPence >= pence || reached.includes(`buffer-${pence}`);
            return (
              <View key={pence} style={s.row}>
                <Text style={[s.milestoneName, { color: isReached ? t.ink : t.muted }]}>
                  {milestoneLabel(pence)} buffer
                </Text>
                <Text style={[s.milestoneState, { color: isReached ? t.positive : t.muted }]}>
                  {isReached ? 'reached ✓' : 'ahead'}
                </Text>
              </View>
            );
          })}
        </Surface>

        <Muted style={s.sectionTag}>DEBT</Muted>
        {debtBills.length > 0 ? (
          <Surface style={s.list} tone="sunken">
            {debtBills.map((b) => (
              <View key={b.id} style={s.row}>
                <Text style={[s.rowLabel, { color: t.secondary }]}>{b.name}</Text>
                <Text style={[s.rowValue, { color: t.ink }]}>{formatPounds(b.amountPence)}</Text>
              </View>
            ))}
            <View style={[s.debtTotal, { borderTopColor: t.hairline }]}>
              <Body style={s.totalLabel}>Held on the Shield</Body>
              <Body style={s.totalLabel}>{formatPounds(debtTotalPence)}</Body>
            </View>
          </Surface>
        ) : (
          <Surface style={s.list} tone="sunken">
            <Body style={s.emptyLine}>No debt bills on the Shield yet.</Body>
          </Surface>
        )}

        <Muted style={s.debtNote}>
          Debt payments sit inside the Shield today — payoff tracking is on the way. If a plan would
          help, StepChange and Citizens Advice both offer free, no-judgement debt advice.
        </Muted>

        <View style={s.cta}>
          <GhostButton label="back" onPress={onClose} />
        </View>
      </ScrollView>
    </View>
  );
}

function countTrailingPositive(history: readonly { readonly endedPositive: boolean }[]): number {
  let n = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.endedPositive) n++;
    else break;
  }
  return n;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 26, paddingTop: 30, paddingBottom: 40 },
  sub: { marginTop: 6, lineHeight: 20 },
  sectionTag: { marginTop: 22, marginBottom: 10, fontSize: 11.5, letterSpacing: 0.8 },
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 14.5, flexShrink: 1 },
  rowValue: { fontSize: 14.5, fontVariant: ['tabular-nums'], fontWeight: '600' },
  growthNote: { marginTop: 4, lineHeight: 18 },
  milestoneName: { fontSize: 14, fontWeight: '500' },
  milestoneState: { fontSize: 12, fontWeight: '600' },
  debtTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  totalLabel: { fontWeight: '600' },
  emptyLine: { lineHeight: 20 },
  debtNote: { marginTop: 16, lineHeight: 18 },
  cta: { marginTop: 28 },
});
