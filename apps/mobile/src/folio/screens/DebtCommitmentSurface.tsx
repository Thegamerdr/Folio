import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Debt } from '@/folio/store';
import * as debtEngine from '@/folio/lib/modes/debtEngine';
import { gap, radius, serif, type Palette } from '@/folio/theme';

/**
 * The native Debt commitment surface. This component is intentionally presentational around the
 * existing debt engine: balance, required payment, interest consequence, next payment, payoff
 * trajectory, and the live money-path low point all come from supplied native authorities.
 *
 * The controller should mount this in the existing Debt HERO block in TodayModeScreen and pass the
 * same `debts`, route tight point, and sheet callbacks already used there. No debt math is recreated
 * in the screen and no usage, value, or shame judgement is inferred.
 */
export function DebtCommitmentSurface({
  debts,
  today,
  tightestSpare,
  t,
  onAddDebt,
  onLogPayment,
}: {
  debts: readonly Debt[];
  today: Date;
  tightestSpare: number;
  t: Palette;
  onAddDebt: () => void;
  onLogPayment: () => void;
}) {
  const list = debts.filter((debt) => debt.balance > 0);
  const summary = debtEngine.summarise(list, 0, today);

  if (list.length === 0) {
    return (
      <View style={styles.block}>
        <View style={[styles.noticeBox, { borderColor: t.hairline }]}>
          <Text style={[styles.noticeText, { color: t.muted }]}>
            No debts declared yet. Add one and Melo will hold the payoff, minimums, and next due
            date together.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onAddDebt}
            style={[
              styles.secondaryCta,
              styles.secondaryCtaSpaced,
              { backgroundColor: t.surface, borderColor: t.hairline },
            ]}
          >
            <Text style={[styles.secondaryCtaLabel, { color: t.ink }]}>+ Add a debt</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const maxApr = Math.max(...list.map((debt) => debt.apr));
  const interestAtMinimums = debtEngine.totalInterest(summary.total, maxApr, summary.minSum);
  const monthsAtMin = Number.isFinite(summary.monthsAtMin)
    ? `${summary.monthsAtMin} mo`
    : 'minimums do not clear interest';
  const nextDueLabel =
    summary.daysToNextDue === null
      ? 'not scheduled'
      : summary.daysToNextDue === 0
        ? 'today'
        : summary.daysToNextDue === 1
          ? 'tomorrow'
          : `in ${summary.daysToNextDue} d`;

  return (
    <View style={styles.block}>
      <View style={styles.rowLabel}>
        <Text style={[styles.rowLabelLeft, { color: t.muted }]}>Outstanding</Text>
        <Text style={[styles.rowLabelRight, { color: t.muted }]}>{formatGBP(summary.total)}</Text>
      </View>
      <View style={[styles.tripleRow, { borderColor: t.hairline }]}>
        <Stat label="Required / mo" value={formatGBP(summary.minSum)} t={t} />
        <Stat label="Payoff at minimums" value={monthsAtMin} t={t} divided />
        <Stat label="Next payment" value={nextDueLabel} t={t} divided />
      </View>
      <View style={[styles.detailBox, { borderColor: t.hairline }]}>
        <Text style={[styles.detailText, { color: t.muted }]}>At the current pace</Text>
        <Text style={[styles.detailValue, { color: t.ink }]}>
          {Number.isFinite(interestAtMinimums)
            ? `About ${formatGBP(interestAtMinimums)} interest before the balance clears.`
            : 'The current minimums do not clear the interest.'}
        </Text>
        <Text style={[styles.detailText, styles.pathDetail, { color: t.muted }]}>
          After every commitment
        </Text>
        <Text style={[styles.detailValue, { color: tightestSpare < 0 ? t.repair : t.ink }]}>
          {`${formatGBP(tightestSpare)} is the lowest point on your money path.`}
        </Text>
      </View>
      {summary.nextDue ? (
        <Text style={[styles.nextLine, { color: t.muted }]}>
          {`${summary.nextDue.name} · ${formatGBP(summary.nextDue.minPayment)} on the ${ordinal(summary.nextDue.dueDom)}`}
        </Text>
      ) : null}
      <View style={styles.ctaRow}>
        <Pressable
          accessibilityRole="button"
          onPress={onLogPayment}
          style={[styles.primaryCta, { backgroundColor: t.calm }]}
        >
          <Text style={[styles.primaryCtaLabel, { color: t.inverse }]}>+ Log a payment</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onAddDebt}
          style={[styles.secondaryCta, { backgroundColor: t.surface, borderColor: t.hairline }]}
        >
          <Text style={[styles.secondaryCtaLabel, { color: t.ink }]}>+ Add a debt</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  t,
  divided = false,
}: {
  label: string;
  value: string;
  t: Palette;
  divided?: boolean;
}) {
  return (
    <View style={[styles.stat, divided && styles.statDivided, { borderColor: t.hairline }]}>
      <Text style={[styles.statLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: t.ink }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function formatGBP(amount: number): string {
  if (!Number.isFinite(amount)) return 'not available';
  const rounded = Math.round(amount);
  return `${rounded < 0 ? '−' : ''}£${Math.abs(rounded).toLocaleString('en-GB')}`;
}

function ordinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  const mod10 = day % 10;
  return `${day}${mod10 === 1 ? 'st' : mod10 === 2 ? 'nd' : mod10 === 3 ? 'rd' : 'th'}`;
}

const styles = StyleSheet.create({
  block: { marginTop: gap.lg },
  rowLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabelLeft: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  rowLabelRight: { fontSize: 10, fontVariant: ['tabular-nums'] },
  tripleRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: gap.md,
    paddingVertical: gap.md,
  },
  stat: { flex: 1, minHeight: 58, paddingHorizontal: gap.sm },
  statDivided: { borderLeftWidth: StyleSheet.hairlineWidth },
  statLabel: { fontSize: 9.5, letterSpacing: 0.7, textTransform: 'uppercase' },
  statValue: {
    fontFamily: serif.display,
    fontSize: 14,
    marginTop: 5,
    fontVariant: ['tabular-nums'],
  },
  detailBox: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: gap.lg,
    paddingBottom: gap.md,
  },
  detailText: { fontSize: 10.5, marginTop: 2 },
  detailValue: {
    fontFamily: serif.display,
    fontSize: 14,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  pathDetail: { marginTop: gap.md },
  nextLine: { fontFamily: serif.displayItalic, fontSize: 12.5, marginTop: gap.sm },
  noticeBox: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: gap.lg },
  noticeText: { fontSize: 11.5, lineHeight: 16 },
  ctaRow: { flexDirection: 'row', justifyContent: 'center', gap: gap.sm, marginTop: gap.md },
  primaryCta: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: gap.md,
  },
  primaryCtaLabel: { fontSize: 12, fontWeight: '500' },
  secondaryCta: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: gap.md,
  },
  secondaryCtaSpaced: { marginTop: gap.md },
  secondaryCtaLabel: { fontSize: 12, fontWeight: '500' },
});
