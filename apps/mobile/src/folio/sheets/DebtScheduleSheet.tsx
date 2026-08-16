/**
 * @rn-sheet     DebtScheduleSheet
 * @purpose      Show the honest payoff picture for every declared debt:
 *               weighted APR, minimum-only months, snowball vs avalanche
 *               ordering, and an extra-per-month control.
 * @reads        debts
 * @writes       —
 * @copy         Live Lovable source; calm and plain.
 * @tokens       paper · surface · hairline · accent · muted · positive · repair
 * @rn-scope     Port of src/components/folio/sheets/SheetDebtSchedule.tsx.
 */

import { useMemo, useState } from 'react';
import Slider from '@react-native-community/slider';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { useAppStore, type Debt } from '@/folio/store';
import {
  orderAvalanche,
  orderSnowball,
  payoffMonths,
  summarise,
} from '@/folio/lib/modes/debtEngine';

type Strategy = 'avalanche' | 'snowball';

export type DebtScheduleSheetProps = {
  visible: boolean;
  onClose: () => void;
};

function monthsLabel(months: number): string {
  if (!Number.isFinite(months)) return 'never at this rate';
  return months === 1 ? '1 month' : `${months} months`;
}

function money(amount: number): string {
  return `£${Math.round(amount).toLocaleString('en-GB')}`;
}

export function DebtScheduleSheet({ visible, onClose }: DebtScheduleSheetProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const debts = useAppStore((state) => state.debts ?? []);
  const [extra, setExtra] = useState(0);
  const [strategy, setStrategy] = useState<Strategy>('avalanche');

  const summary = useMemo(() => summarise(debts, extra), [debts, extra]);
  const ordered = useMemo(
    () => (strategy === 'avalanche' ? orderAvalanche(debts) : orderSnowball(debts)),
    [debts, strategy],
  );
  const maximumExtra = Math.max(200, Math.round(summary.minSum));

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Debt schedule</Text>
        <Text style={styles.lineCount}>
          {debts.length} {debts.length === 1 ? 'line' : 'lines'}
        </Text>
        <Pressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed ? styles.pressed : undefined]}
        >
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
      </View>

      <Text accessibilityRole="header" style={styles.headline}>
        {'The honest '}
        <Text style={styles.headlineAccent}>payoff</Text>
        {' picture.'}
      </Text>

      {debts.length === 0 ? (
        <View style={styles.empty}>
          <MeloLine mood="calm" text="No debts on file — nothing to schedule." />
        </View>
      ) : (
        <>
          <View style={styles.summary}>
            <SummaryCell label="balance" value={money(summary.total)} styles={styles} />
            <SummaryCell label="min / mo" value={money(summary.minSum)} styles={styles} />
            <SummaryCell
              label="weighted APR"
              value={`${summary.weightedApr.toFixed(1)}%`}
              styles={styles}
            />
          </View>

          <Text style={styles.minimumLine}>
            {'At the minimums, the whole balance clears in '}
            <Text style={styles.minimumValue}>{monthsLabel(summary.monthsAtMin)}</Text>
            {'.'}
            {!Number.isFinite(summary.monthsAtMin) ? (
              <Text style={styles.growing}>
                {" The minimum doesn't cover interest — the balance grows."}
              </Text>
            ) : null}
          </Text>

          <View style={styles.extraCard}>
            <View style={styles.extraHeader}>
              <Text style={styles.eyebrow}>Add on top</Text>
              <Text style={styles.extraValue}>£{extra}/mo</Text>
            </View>
            <Slider
              accessibilityLabel="Extra per month"
              maximumTrackTintColor={t.hairline}
              maximumValue={maximumExtra}
              minimumTrackTintColor={t.calm}
              minimumValue={0}
              onValueChange={(value) => setExtra(Math.round(value / 5) * 5)}
              step={5}
              style={styles.slider}
              thumbTintColor={t.calm}
              value={extra}
            />
            <View style={styles.extraResults}>
              <View style={styles.resultCell}>
                <Text style={styles.resultLabel}>payoff</Text>
                <Text style={styles.resultValue}>{monthsLabel(summary.monthsWithExtra)}</Text>
              </View>
              <View style={styles.resultCell}>
                <Text style={styles.resultLabel}>interest saved</Text>
                <Text style={styles.savedValue}>
                  {Number.isFinite(summary.interestSaved) ? money(summary.interestSaved) : '—'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.strategyRow}>
            <Text style={styles.eyebrow}>Order</Text>
            <View style={styles.strategyButtons}>
              <StrategyButton
                active={strategy === 'avalanche'}
                label="Cheapest interest"
                onPress={() => setStrategy('avalanche')}
                styles={styles}
              />
              <StrategyButton
                active={strategy === 'snowball'}
                label="Fastest wins"
                onPress={() => setStrategy('snowball')}
                styles={styles}
              />
            </View>
          </View>
          <Text style={styles.strategyNote}>
            {strategy === 'avalanche'
              ? 'Highest APR first. Costs less overall.'
              : 'Smallest balance first. Feels lighter, sooner.'}
          </Text>

          <View style={styles.debtList}>
            {ordered.map((debt, index) => (
              <DebtRow
                debt={debt}
                index={index + 1}
                key={debt.id}
                showDivider={index > 0}
                styles={styles}
              />
            ))}
          </View>

          <View style={styles.meloLine}>
            <MeloLine
              mood="calm"
              text="I don't judge the balance. I just show what shifts if you add £5 more."
            />
          </View>
        </>
      )}
    </Sheet>
  );
}

function SummaryCell({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.summaryCell}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={styles.summaryValue}
      >
        {value}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function StrategyButton({
  active,
  label,
  onPress,
  styles,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.strategyButton,
        active ? styles.strategyButtonActive : undefined,
        pressed ? styles.pressed : undefined,
      ]}
    >
      <Text style={active ? styles.strategyButtonLabelActive : styles.strategyButtonLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

function DebtRow({
  debt,
  index,
  showDivider,
  styles,
}: {
  debt: Debt;
  index: number;
  showDivider: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  const months = payoffMonths(debt.balance, debt.apr, debt.minPayment);
  const growing = !Number.isFinite(months);

  return (
    <View style={[styles.debtRow, showDivider ? styles.debtDivider : undefined]}>
      <Text style={styles.debtIndex}>{index}.</Text>
      <View style={styles.debtCopy}>
        <Text numberOfLines={1} style={styles.debtName}>
          {debt.name}
        </Text>
        <Text numberOfLines={1} style={styles.debtMeta}>
          £{debt.balance.toLocaleString('en-GB')} · {debt.apr}% · min £{debt.minPayment}
        </Text>
      </View>
      <View style={styles.debtEnd}>
        <Text style={growing ? styles.debtMonthsGrowing : styles.debtMonths}>
          {growing ? 'grows' : months === 1 ? '1 mo' : `${months} mo`}
        </Text>
        <Text style={styles.debtAtMin}>at min</Text>
      </View>
    </View>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      minHeight: 44,
    },
    eyebrow: {
      color: t.muted,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1.54,
      textTransform: 'uppercase',
    },
    lineCount: {
      color: t.muted,
      flex: 1,
      fontSize: 10.5,
      fontVariant: ['tabular-nums'],
      marginLeft: gap.sm,
      textAlign: 'right',
    },
    close: {
      alignItems: 'center',
      height: 44,
      justifyContent: 'center',
      marginLeft: gap.sm,
      width: 44,
    },
    closeGlyph: { color: t.muted, fontSize: 20 },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 24,
      lineHeight: 29,
      marginTop: gap.xs,
    },
    headlineAccent: { color: t.calm, fontFamily: serif.display, fontStyle: 'normal' },
    empty: { marginTop: gap.xl },
    summary: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xl,
      borderWidth: 1,
      flexDirection: 'row',
      gap: gap.md,
      marginTop: gap.xl,
      padding: gap.lg,
    },
    summaryCell: { flex: 1, minWidth: 0 },
    summaryValue: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 17,
      fontVariant: ['tabular-nums'],
      lineHeight: 19,
    },
    summaryLabel: {
      color: t.muted,
      fontSize: 10,
      letterSpacing: 1.4,
      marginTop: 6,
      textTransform: 'uppercase',
    },
    minimumLine: {
      color: t.muted,
      fontSize: 12.5,
      lineHeight: 18,
      marginTop: gap.md,
    },
    minimumValue: { color: t.ink, fontVariant: ['tabular-nums'] },
    growing: { color: t.repairInk },
    extraCard: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xl,
      borderWidth: 1,
      marginTop: gap.xl,
      padding: gap.lg,
    },
    extraHeader: {
      alignItems: 'baseline',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    extraValue: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 18,
      fontVariant: ['tabular-nums'],
    },
    slider: { height: 44, marginTop: gap.xs, width: '100%' },
    extraResults: { flexDirection: 'row', gap: gap.md, marginTop: gap.xs },
    resultCell: { flex: 1 },
    resultLabel: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: 1.47,
      textTransform: 'uppercase',
    },
    resultValue: {
      color: t.ink,
      fontSize: 12,
      fontVariant: ['tabular-nums'],
      marginTop: 2,
    },
    savedValue: {
      color: t.positiveInk,
      fontSize: 12,
      fontVariant: ['tabular-nums'],
      marginTop: 2,
    },
    strategyRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: gap.sm,
      marginTop: gap.xl,
    },
    strategyButtons: { flex: 1, flexDirection: 'row', gap: 6 },
    strategyButton: {
      alignItems: 'center',
      borderColor: t.hairline,
      borderRadius: radius.pill,
      borderWidth: 1,
      flex: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: gap.sm,
    },
    strategyButtonActive: { backgroundColor: t.ink, borderColor: t.ink },
    strategyButtonLabel: {
      color: t.muted,
      fontSize: 11.5,
      letterSpacing: 0.2,
      textAlign: 'center',
    },
    strategyButtonLabelActive: {
      color: t.canvas,
      fontSize: 11.5,
      letterSpacing: 0.2,
      textAlign: 'center',
    },
    strategyNote: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 11.5,
      lineHeight: 16,
      marginTop: gap.sm,
    },
    debtList: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xl,
      borderWidth: 1,
      marginTop: gap.lg,
      overflow: 'hidden',
    },
    debtRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: gap.md,
      minHeight: 58,
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
    },
    debtDivider: { borderTopColor: t.hairline, borderTopWidth: 1 },
    debtIndex: {
      color: t.muted,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
      width: 24,
    },
    debtCopy: { flex: 1, minWidth: 0 },
    debtName: { color: t.ink, fontSize: 13.5, fontWeight: '500' },
    debtMeta: {
      color: t.muted,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
      marginTop: 2,
    },
    debtEnd: { alignItems: 'flex-end', flexShrink: 0 },
    debtMonths: { color: t.ink, fontSize: 12, fontVariant: ['tabular-nums'] },
    debtMonthsGrowing: { color: t.repairInk, fontSize: 12, fontVariant: ['tabular-nums'] },
    debtAtMin: {
      color: t.muted,
      fontSize: 10,
      letterSpacing: 1.4,
      marginTop: 2,
      textTransform: 'uppercase',
    },
    meloLine: { marginBottom: gap.sm, marginTop: gap.xl },
    pressed: { opacity: 0.6, transform: [{ scale: 0.97 }] },
  });
}
