// Weekly review (MELO_BLUEPRINT.md §14 item 13) — lightweight on purpose: one honest headline
// from the engine, the week's shape in four quiet rows, wins noticed, and what's coming. Reads
// in under thirty seconds; never a lecture. All copy comes from the engine's linted builder.

import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { WIN_LINES, formatPounds, type WeekReview } from '@folio/melo-engine';
import { Body, Display, GhostButton, Muted, Surface, useTheme } from '@/surfaces/pressureMap/kit';

import { dayLabel } from '../state/derive';

type Props = {
  review: WeekReview;
  onClose: () => void;
};

export function MeloReview({ review, onClose }: Props) {
  const t = useTheme();
  const underPlan = review.deltaPence >= 0;
  const winLines = review.newWinIds
    .map((id) => (WIN_LINES as Record<string, string | undefined>)[id])
    .filter((line): line is string => typeof line === 'string');

  return (
    <View style={[s.root, { backgroundColor: t.canvas }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Muted style={s.tag}>THE WEEK</Muted>
        <Display style={s.headline}>{review.headline}</Display>
        <Body style={s.subline}>{review.subline}</Body>

        <Surface style={s.list} tone="sunken">
          <StatRow
            label="Spent"
            value={formatPounds(review.spentPence)}
            detail={`plan was ${formatPounds(review.plannedPence)}`}
          />
          {/* No green medal for an empty log — with nothing recorded, "under plan" is fog,
              not victory. The headline already tells that story honestly. */}
          {review.loggedDays > 0 ? (
            <StatRow
              label={underPlan ? 'Under plan' : 'Past the plan'}
              value={formatPounds(Math.abs(review.deltaPence))}
              valueColor={underPlan ? t.positive : t.calmStrong}
            />
          ) : null}
          {review.biggestDay ? (
            <StatRow
              label="Biggest day"
              value={formatPounds(review.biggestDay.amountPence)}
              detail={dayLabel(review.biggestDay.atISO)}
            />
          ) : null}
          <StatRow
            label="Checks before buying"
            value={String(review.checksCount)}
            detail={review.quietDays > 0 ? `${review.quietDays} quiet days` : 'logged every day'}
          />
        </Surface>

        {winLines.length > 0 ? (
          <>
            <Muted style={s.sectionTag}>NOTICED THIS WEEK</Muted>
            <Surface style={s.list} tone="sunken">
              {winLines.map((line) => (
                <View key={line} style={s.winRow}>
                  <Text style={[s.winSpark, { color: t.positive }]}>✦</Text>
                  <Body style={s.winLine}>{line}</Body>
                </View>
              ))}
            </Surface>
          </>
        ) : null}

        {review.billsDueNextWeek.length > 0 ? (
          <>
            <Muted style={s.sectionTag}>NEXT WEEK</Muted>
            <Surface style={s.list} tone="sunken">
              {review.billsDueNextWeek.map((b) => (
                <View key={`${b.name}-${b.dueDate}`} style={s.billRow}>
                  <Text style={[s.billName, { color: t.secondary }]}>
                    {b.name} · {dayLabel(b.dueDate)}
                  </Text>
                  <Text style={[s.billAmount, { color: t.ink }]}>
                    {formatPounds(b.amountPence)}
                  </Text>
                </View>
              ))}
              <Muted style={s.billNote}>Already shielded — nothing to do.</Muted>
            </Surface>
          </>
        ) : null}

        <View style={s.cta}>
          <GhostButton label="back" onPress={onClose} />
        </View>
      </ScrollView>
    </View>
  );
}

function StatRow({
  label,
  value,
  detail,
  valueColor,
}: {
  label: string;
  value: string;
  detail?: string;
  valueColor?: string;
}) {
  const t = useTheme();
  return (
    <View style={s.statRow}>
      <View style={s.statLeft}>
        <Text style={[s.statLabel, { color: t.secondary }]}>{label}</Text>
        {detail ? <Text style={[s.statDetail, { color: t.muted }]}>{detail}</Text> : null}
      </View>
      <Text style={[s.statValue, { color: valueColor ?? t.ink }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 26, paddingTop: 30, paddingBottom: 40 },
  tag: { fontSize: 11.5, letterSpacing: 0.8, marginBottom: 10 },
  headline: { lineHeight: 34 },
  subline: { marginTop: 8, lineHeight: 21 },
  list: { marginTop: 18, gap: 12 },
  sectionTag: { marginTop: 22, marginBottom: 0, fontSize: 11.5, letterSpacing: 0.8 },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statLeft: { flexShrink: 1, gap: 2 },
  statLabel: { fontSize: 14 },
  statDetail: { fontSize: 12 },
  statValue: { fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '600' },
  winRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  winSpark: { fontSize: 13, marginTop: 2 },
  winLine: { flex: 1, lineHeight: 20 },
  billRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  billName: { fontSize: 14, flexShrink: 1 },
  billAmount: { fontSize: 14, fontVariant: ['tabular-nums'], fontWeight: '600' },
  billNote: { fontSize: 12, marginTop: 2 },
  cta: { marginTop: 28 },
});
