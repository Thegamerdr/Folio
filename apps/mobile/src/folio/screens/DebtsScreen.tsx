import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type DebtStrategy } from '@folio/finance-engine';
import { useAppStore } from '@/folio/store';
import { parseManualMoney } from '@/folio/lib/manualMoney';
import { gap, radius, serif, useTheme, weightFamily } from '@/folio/theme';
import type { Nav } from '@/folio/types';
import {
  buildFinancialPlanFromState,
  type ExtraDebtPaymentCadence,
  type FinancialPlanAdapterOptions,
} from '@/folio/lib/financialPlan';

const STRATEGY_OPTIONS: readonly { value: DebtStrategy; label: string }[] = [
  { value: 'hybrid', label: 'Balanced' },
  { value: 'avalanche', label: 'Highest APR' },
  { value: 'snowball', label: 'Smallest first' },
  { value: 'cash-flow', label: 'Free cash flow' },
  { value: 'priority', label: 'Arrears first' },
  { value: 'promo', label: 'Promo expiry' },
  { value: 'user-selected', label: 'Choose a debt' },
];

const EXTRA_PAYMENT_CADENCES: readonly { value: ExtraDebtPaymentCadence; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function formatMinor(minor: number): string {
  return `£${(Math.abs(minor) / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatSignedMinor(minor: number): string {
  return `${minor < 0 ? '-' : ''}${formatMinor(minor)}`;
}

export function DebtsScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const debts = useAppStore((state) => state.debts) ?? [];
  const appState = useAppStore((state) => state);
  const [strategy, setStrategy] = useState<DebtStrategy>('hybrid');
  const [selectedDebtId, setSelectedDebtId] = useState<string | undefined>(debts[0]?.id);
  const [extraInput, setExtraInput] = useState('');
  const [extraPaymentCadence, setExtraPaymentCadence] =
    useState<ExtraDebtPaymentCadence>('monthly');
  const extraPayment = useMemo(() => {
    if (extraInput.trim() === '') return undefined;
    const parsed = parseManualMoney(extraInput, { allowZero: true });
    return parsed === undefined ? undefined : Math.round(parsed * 100);
  }, [extraInput]);
  const extraInputInvalid = extraInput.trim() !== '' && extraPayment === undefined;
  let planOptions: FinancialPlanAdapterOptions = { strategy };
  if (strategy === 'user-selected' && selectedDebtId !== undefined) {
    planOptions = { ...planOptions, selectedDebtId };
  }
  if (extraPayment !== undefined) {
    planOptions = {
      ...planOptions,
      recurringExtraDebtPaymentMinor: extraPayment,
      extraDebtPaymentCadence: extraPaymentCadence,
    };
  }
  const plan = buildFinancialPlanFromState(appState, planOptions);
  const targetDebt = debts.find((debt) => debt.id === plan.debtRecommendation.targetDebtId);
  const safeToSpendLabel = `${formatMinor(plan.safeToSpendMinor)}${plan.safeToSpendMinor < 0 ? ' short' : ''}`;
  const appliedExtraMinor =
    extraPayment === undefined ? 0 : plan.debtRecommendation.extraPaymentMinor;
  const previewOccurrences = extraPayment === undefined ? 0 : plan.extraPaymentCountBeforeIncome;
  const scheduledPreviewMinor =
    extraPayment === undefined ? 0 : plan.extraPaymentTotalBeforeIncomeMinor;
  const safeAfterExtraMinor = plan.safeToSpendMinor - scheduledPreviewMinor;
  const cadencePaymentLabel =
    extraPaymentCadence === 'once' ? 'one-off payment' : `${extraPaymentCadence} payment`;
  const previewCadenceCopy =
    extraPaymentCadence === 'once'
      ? `${formatMinor(appliedExtraMinor)} once`
      : extraPaymentCadence === 'weekly'
        ? `${formatMinor(appliedExtraMinor)} each week (${previewOccurrences} payments ${plan.nextIncomeDate === null ? 'within this forecast' : 'before income'})`
        : `${formatMinor(appliedExtraMinor)} each month`;
  const previewConsequenceLabel =
    extraPaymentCadence === 'weekly'
      ? `after all preview payments ${plan.nextIncomeDate === null ? 'within this forecast' : 'before income'}`
      : 'after this preview payment';
  const requestedExtraCapped = extraPayment !== undefined && appliedExtraMinor < extraPayment;
  const projectionLead =
    extraPayment === undefined
      ? 'At this pace'
      : extraPaymentCadence === 'once'
        ? 'With this one-off preview'
        : `At this ${extraPaymentCadence} pace`;
  return (
    <View style={[styles.root, { backgroundColor: t.canvas, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: gap.lg, paddingBottom: insets.bottom + gap.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Plan"
          onPress={nav.back}
          style={styles.back}
        >
          <Text style={[styles.backLabel, { color: t.muted }]}>‹ Plan</Text>
        </Pressable>
        <Text style={[styles.eyebrow, { color: t.muted }]}>Plan</Text>
        <Text accessibilityRole="header" style={[styles.heading, { color: t.ink }]}>
          Debts <Text style={{ color: t.calm }}>tracked</Text>.
        </Text>
        <Text style={[styles.subhead, { color: t.muted }]}>
          Balances and repayments you have chosen to keep in view.
        </Text>
        <View style={[styles.planCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Text style={[styles.planLabel, { color: t.muted }]}>Your debt plan</Text>
          <Text style={[styles.planHeadline, { color: t.ink }]}>Keep essentials covered.</Text>
          <Text style={[styles.planCopy, { color: t.muted }]}>
            {targetDebt
              ? `${targetDebt.name} is the next focus. ${plan.debtRecommendation.reason}`
              : plan.debtRecommendation.reason}
          </Text>
          {plan.debtProjection ? (
            <Text style={[styles.planCopy, { color: t.muted }]}>
              {plan.debtProjection.payoffDate
                ? `${projectionLead}, projected debt-free date is ${String(plan.debtProjection.payoffDate)}.`
                : !plan.debtProjection.interestKnown
                  ? 'Add the missing APR or rate after promo to estimate a payoff date.'
                  : plan.debtProjection.stalled
                    ? 'No payoff date yet — add a minimum payment or a safe extra amount.'
                    : 'Payoff is being projected from the payments you entered.'}
              {plan.debtProjection.cascade.length > 0
                ? ` ${plan.debtProjection.cascade.length} payment release${plan.debtProjection.cascade.length === 1 ? '' : 's'} will cascade.`
                : ''}
            </Text>
          ) : null}
          <View style={styles.planStats}>
            <View>
              <Text style={[styles.planStatLabel, { color: t.muted }]}>Safe to spend</Text>
              <Text
                style={[
                  styles.planStatValue,
                  { color: plan.safeToSpendMinor < 0 ? t.repair : t.ink },
                ]}
              >
                {safeToSpendLabel}
              </Text>
            </View>
            <View>
              <Text style={[styles.planStatLabel, { color: t.muted }]}>Extra to debt</Text>
              <Text style={[styles.planStatValue, { color: t.ink }]}>
                {formatMinor(plan.debtRecommendation.extraPaymentMinor)}
              </Text>
            </View>
          </View>
          <Text style={[styles.choiceLabel, { color: t.muted }]}>
            How should extra money focus?
          </Text>
          <View style={styles.choiceGrid}>
            {STRATEGY_OPTIONS.map((option) => {
              const selected = strategy === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setStrategy(option.value)}
                  style={({ pressed }) => [
                    styles.choice,
                    {
                      borderColor: selected ? t.calm : t.hairline,
                      backgroundColor: selected ? t.inset : t.surface,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.choiceText, { color: selected ? t.ink : t.muted }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {strategy === 'user-selected' && debts.length > 0 ? (
            <View style={styles.choiceGrid}>
              {debts.map((debt) => (
                <Pressable
                  key={debt.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedDebtId === debt.id }}
                  onPress={() => setSelectedDebtId(debt.id)}
                  style={({ pressed }) => [
                    styles.debtChoice,
                    { borderColor: selectedDebtId === debt.id ? t.calm : t.hairline },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.choiceText, { color: t.ink }]}>{debt.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <TextInput
            value={extraInput}
            onChangeText={setExtraInput}
            keyboardType="decimal-pad"
            placeholder="Optional extra, e.g. £50"
            placeholderTextColor={t.muted}
            style={[styles.extraInput, { borderColor: t.hairline, color: t.ink }]}
            accessibilityLabel="Optional extra debt payment amount"
          />
          <Text style={[styles.choiceLabel, { color: t.muted }]}>Payment pattern</Text>
          <View style={styles.choiceGrid}>
            {EXTRA_PAYMENT_CADENCES.map((option) => {
              const selected = extraPaymentCadence === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.label} extra debt payment`}
                  accessibilityState={{ selected }}
                  onPress={() => setExtraPaymentCadence(option.value)}
                  style={({ pressed }) => [
                    styles.choice,
                    {
                      borderColor: selected ? t.calm : t.hairline,
                      backgroundColor: selected ? t.inset : t.surface,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.choiceText, { color: selected ? t.ink : t.muted }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {extraInputInvalid ? (
            <Text style={[styles.inputError, { color: t.repair }]}>
              Enter a valid GBP amount, such as £50 or £50.25.
            </Text>
          ) : null}
          {extraPayment !== undefined && !extraInputInvalid ? (
            <Text style={[styles.scenarioNote, { color: t.muted }]}>
              This preview applies {previewCadenceCopy}; {formatSignedMinor(safeAfterExtraMinor)}{' '}
              remains safe to spend {previewConsequenceLabel}.
              {extraPaymentCadence === 'once'
                ? ''
                : ' The forecast assumes this payment remains affordable.'}
            </Text>
          ) : null}
          {requestedExtraCapped && extraPayment !== undefined ? (
            <Text style={[styles.scenarioNote, { color: t.muted }]}>
              Only {formatMinor(appliedExtraMinor)} is available for this {cadencePaymentLabel}; the
              requested amount was capped by protected money.
            </Text>
          ) : null}
          <Text style={[styles.scenarioNote, { color: t.muted }]}>
            This changes the projection only. It does not record a payment.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.go('whatif')}
            style={({ pressed }) => [styles.tryChange, pressed && styles.pressed]}
          >
            <Text style={[styles.tryChangeLabel, { color: t.calmStrong }]}>
              Try a different extra payment
            </Text>
          </Pressable>
        </View>
        <View style={styles.list}>
          {debts.length === 0 ? (
            <Text style={[styles.empty, { color: t.muted }]}>No debts declared yet.</Text>
          ) : (
            debts.map((debt) => (
              <Pressable
                key={debt.id}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${debt.name}`}
                onPress={() => nav.openSheet('declare-debt', { debtId: debt.id })}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: t.hairline },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.rowCopy}>
                  <Text style={[styles.name, { color: t.ink }]}>{debt.name}</Text>
                  <Text
                    style={[styles.meta, { color: t.muted }]}
                  >{`£${debt.balance.toLocaleString('en-GB')} outstanding · ${debt.aprKnown === false ? 'APR not entered' : `${debt.apr}% APR`}`}</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.openSheet('declare-debt')}
          style={({ pressed }) => [
            styles.add,
            { backgroundColor: t.calm },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.addLabel, { color: t.inverse }]}>+ Add a debt</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gap.xl },
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  backLabel: { fontFamily: weightFamily(500), fontSize: 14 },
  eyebrow: {
    fontFamily: weightFamily(400),
    fontSize: 11,
    letterSpacing: 1.54,
    lineHeight: 16,
    marginTop: gap.lg,
    textTransform: 'uppercase',
  },
  heading: { fontFamily: serif.display, fontSize: 28, lineHeight: 32, marginTop: gap.xs },
  subhead: { fontFamily: weightFamily(400), fontSize: 14, lineHeight: 22, marginTop: gap.sm },
  planCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    padding: gap.lg,
  },
  planLabel: {
    fontFamily: weightFamily(400),
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  planHeadline: { fontFamily: serif.display, fontSize: 20, lineHeight: 26, marginTop: gap.xs },
  planCopy: { fontFamily: weightFamily(400), fontSize: 12.5, lineHeight: 19, marginTop: gap.sm },
  planStats: { flexDirection: 'row', gap: gap.xl, marginTop: gap.lg },
  planStatLabel: { fontFamily: weightFamily(400), fontSize: 11, lineHeight: 16 },
  planStatValue: { fontFamily: serif.display, fontSize: 19, lineHeight: 24, marginTop: 2 },
  choiceLabel: { fontFamily: weightFamily(500), fontSize: 12.5, marginTop: gap.lg },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm, marginTop: gap.sm },
  choice: {
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: gap.md,
  },
  debtChoice: {
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: gap.md,
  },
  choiceText: { fontFamily: weightFamily(500), fontSize: 12 },
  extraInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 14,
    marginTop: gap.md,
    minHeight: 46,
    paddingHorizontal: gap.md,
  },
  inputError: { fontFamily: weightFamily(400), fontSize: 11.5, lineHeight: 17, marginTop: gap.xs },
  scenarioNote: {
    fontFamily: weightFamily(400),
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: gap.xs,
  },
  tryChange: { minHeight: 44, justifyContent: 'center', marginTop: gap.sm },
  tryChangeLabel: { fontFamily: weightFamily(500), fontSize: 13 },
  list: { marginTop: gap.xl },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 64,
    justifyContent: 'center',
    paddingVertical: gap.sm,
  },
  rowCopy: { minWidth: 0 },
  name: { fontFamily: weightFamily(500), fontSize: 15, lineHeight: 22 },
  meta: { fontFamily: weightFamily(400), fontSize: 12.5, lineHeight: 19, marginTop: 2 },
  empty: { fontFamily: weightFamily(400), fontSize: 14, lineHeight: 22, paddingVertical: gap.xl },
  add: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 48,
    marginTop: gap.xl,
  },
  addLabel: { fontFamily: weightFamily(500), fontSize: 14 },
  pressed: { opacity: 0.76 },
});
