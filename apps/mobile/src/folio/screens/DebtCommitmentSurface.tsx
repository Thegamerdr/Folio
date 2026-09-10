import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { shouldStackTextRows } from '@/folio/lib/readableLayout';

import { formatFinancialDate, formatMoney } from '@/folio/lib/financialPresentation';
import type { Debt, TimelineEvent, Transaction } from '@/folio/store';
import { selectDebtTrackingPresentation } from '@/folio/lib/debtTrackingPresentation';
import { selectDebtMinimumPresentation } from '@/folio/lib/debtMinimumPresentation';
import type { FinancialPlanResult } from '@folio/finance-engine';
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
  transactions = [],
  timelineEvents = [],
  today,
  tightestSpare,
  canonicalPlan,
  t,
  onAddDebt,
  onLogPayment,
  onViewDebts,
}: {
  debts: readonly Debt[];
  transactions?: readonly Transaction[];
  timelineEvents?: readonly TimelineEvent[];
  today: Date;
  tightestSpare: number;
  canonicalPlan?: FinancialPlanResult | null | undefined;
  t: Palette;
  onAddDebt: () => void;
  onLogPayment: () => void;
  onViewDebts?: (() => void) | undefined;
}) {
  const [showWorking, setShowWorking] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const stackTotal = shouldStackTextRows(width, fontScale, 72);
  const tracking = selectDebtTrackingPresentation({ debts, transactions, timelineEvents });
  const list = tracking.active;
  const summary = debtEngine.summarise(list, 0, today);

  if (list.length === 0) {
    return (
      <View style={styles.block}>
        <View style={[styles.noticeBox, { borderColor: t.hairline }]}>
          <Text style={[styles.noticeText, { color: t.muted }]}>
            {tracking.title}. {tracking.detail}
          </Text>
          {tracking.status !== 'never' && onViewDebts ? (
            <Pressable accessibilityRole="button" onPress={onViewDebts} style={styles.secondaryCta}>
              <Text style={[styles.secondaryCtaLabel, { color: t.calmStrong }]}>
                {tracking.status === 'cleared'
                  ? 'View cleared debts and history'
                  : 'View tracking and payment history'}
              </Text>
            </Pressable>
          ) : null}
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
  const unknownApr = list.some((debt) => debt.aprKnown === false);
  const projection = canonicalPlan?.debtProjection;
  const interestAtMinimums = projection
    ? projection.interestKnown &&
      projection.payoffMonths !== null &&
      projection.totalInterestMinor !== null
      ? projection.totalInterestMinor / 100
      : null
    : unknownApr
      ? null
      : debtEngine.totalInterest(summary.total, maxApr, summary.minSum);
  const interestUnknown = projection ? !projection.interestKnown : unknownApr;
  const monthsAtMin = projection
    ? !projection.interestKnown
      ? 'Interest rate needed'
      : projection.payoffMonths !== null
        ? `${projection.payoffMonths} mo`
        : 'Beyond this forecast'
    : unknownApr
      ? 'Interest rate needed'
      : Number.isFinite(summary.monthsAtMin)
        ? `${summary.monthsAtMin} mo`
        : 'minimums do not clear interest';
  const nextMinimum = selectDebtMinimumPresentation(canonicalPlan);
  const nextDueLabel =
    nextMinimum?.dueLabel ?? (canonicalPlan ? 'None in this forecast' : 'Not available');

  return (
    <View style={styles.block}>
      <View style={[styles.rowLabel, stackTotal && styles.rowLabelStacked]}>
        <Text style={[styles.rowLabelLeft, { color: t.muted }]}>Outstanding debt</Text>
        <Text style={[styles.rowLabelRight, { color: t.muted }]}>{formatGBP(summary.total)}</Text>
      </View>
      <View style={[styles.tripleRow, { borderColor: t.hairline }]}>
        <Stat label="Required / mo" value={formatGBP(summary.minSum)} t={t} />
        <Stat label="Payoff at minimums" value={monthsAtMin} t={t} divided />
        <Stat label="Next minimum" value={nextDueLabel} t={t} divided />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showWorking }}
        onPress={() => setShowWorking((value) => !value)}
        style={styles.secondaryCta}
      >
        <Text style={[styles.secondaryCtaLabel, { color: t.calmStrong }]}>
          How this estimate works
        </Text>
      </Pressable>
      {showWorking ? (
        <View style={[styles.detailBox, { borderColor: t.hairline }]}>
          <Text style={[styles.detailText, { color: t.muted }]}>
            Assumes the recorded balances, minimums and interest rates stay the same, with no new
            borrowing. It is an estimate, not a payment.{' '}
            {projection?.payoffDate
              ? `Projected payoff: ${formatFinancialDate(String(projection.payoffDate))}.`
              : ''}
          </Text>
          <Text style={[styles.detailValue, { color: t.ink }]}>
            {interestAtMinimums !== null && Number.isFinite(interestAtMinimums)
              ? `About ${formatGBP(interestAtMinimums)} interest before the balance clears.`
              : interestUnknown
                ? 'Enter missing interest rates to estimate the payoff.'
                : 'No payoff within the forecast horizon at the current minimums.'}
          </Text>
          <Text style={[styles.detailText, styles.pathDetail, { color: t.muted }]}>
            After every commitment
          </Text>
          <Text style={[styles.detailValue, { color: tightestSpare < 0 ? t.repair : t.ink }]}>
            {`${formatGBP(tightestSpare)} is the lowest point on your money path.`}
          </Text>
        </View>
      ) : null}
      {nextMinimum ? (
        <Text style={[styles.nextLine, { color: nextMinimum.overdue ? t.repair : t.muted }]}>
          {`${nextMinimum.label} · ${nextMinimum.amountLabel}`}
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
      <Text style={[styles.statValue, { color: t.ink }]}>{value}</Text>
    </View>
  );
}

function formatGBP(amount: number): string {
  return formatMoney(amount);
}

const styles = StyleSheet.create({
  block: { marginTop: gap.lg },
  rowLabel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: gap.sm,
  },
  rowLabelStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  rowLabelLeft: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  rowLabelRight: { fontFamily: serif.display, fontSize: 22, fontVariant: ['tabular-nums'] },
  tripleRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: gap.sm,
    marginTop: gap.md,
    paddingVertical: gap.md,
  },
  stat: { minHeight: 48, paddingVertical: gap.xs },
  statDivided: { borderTopWidth: StyleSheet.hairlineWidth },
  statLabel: { fontSize: 12, lineHeight: 17 },
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
  detailText: { fontSize: 12, lineHeight: 17, marginTop: 2 },
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
  ctaRow: { justifyContent: 'center', gap: gap.sm, marginTop: gap.md },
  primaryCta: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: gap.md,
  },
  primaryCtaLabel: { fontSize: 12, fontWeight: '500' },
  secondaryCta: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: gap.md,
  },
  secondaryCtaSpaced: { marginTop: gap.md },
  secondaryCtaLabel: { fontSize: 12, fontWeight: '500' },
});
