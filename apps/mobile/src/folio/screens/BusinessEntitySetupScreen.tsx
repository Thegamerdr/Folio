import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  emptyBusinessOperationsState,
  normaliseBusinessOperationsState,
  type BusinessEntity,
  type StudentLoanPlan,
  type TaxRegion,
  type VatScheme,
} from '@folio/business-workspace';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import { updateBusinessOperations, useAppStore } from '@/folio/store';
import type { Nav } from '@/folio/types';

type EntityKind = 'sole-trader' | 'ltd';
type RegisteredVatScheme = Extract<VatScheme, { registered: true }>['scheme'];

export function BusinessEntitySetupScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const stored = useAppStore((state) => state.business);
  const business = useMemo(
    () => normaliseBusinessOperationsState(stored ?? emptyBusinessOperationsState()),
    [stored],
  );
  const current = business.entity;
  const [kind, setKind] = useState<EntityKind | null>(current?.kind ?? null);
  const [name, setName] = useState(
    current?.kind === 'ltd' ? current.companyName : (current?.tradingName ?? ''),
  );
  const [companyNumber, setCompanyNumber] = useState(
    current?.kind === 'ltd' ? (current.companyNumber ?? '') : '',
  );
  const [yearEnd, setYearEnd] = useState(current?.kind === 'ltd' ? current.yearEnd : nextMarch());
  const [directorName, setDirectorName] = useState(
    current?.kind === 'ltd' ? (current.directors[0]?.name ?? '') : '',
  );
  const [utr, setUtr] = useState(current?.kind === 'sole-trader' ? (current.utr ?? '') : '');
  const [region, setRegion] = useState<TaxRegion>(current?.taxRegion ?? 'england-ni');
  const [vatRegistered, setVatRegistered] = useState(current?.vat.registered ?? false);
  const [vatScheme, setVatScheme] = useState<RegisteredVatScheme>(
    current?.vat.registered ? current.vat.scheme : 'standard',
  );
  const [vatNumber, setVatNumber] = useState(
    current?.vat.registered ? (current.vat.number ?? '') : '',
  );
  const [vatRegisteredAt, setVatRegisteredAt] = useState(
    current?.vat.registered ? (current.vat.registeredAt ?? '') : '',
  );
  const [limitedCostTrader, setLimitedCostTrader] = useState(
    current?.vat.registered ? current.vat.limitedCostTrader === true : false,
  );
  const [flatRatePercent, setFlatRatePercent] = useState(
    current?.vat.registered && current.vat.scheme === 'flat-rate'
      ? ((current.vat.flatRateBasisPoints ?? 0) / 100).toString()
      : '',
  );
  const [studentPlans, setStudentPlans] = useState<readonly StudentLoanPlan[]>(
    current?.kind === 'sole-trader' ? current.studentLoanPlans : [],
  );

  const canSave = kind === 'sole-trader' || (kind === 'ltd' && name.trim().length > 0);

  const save = () => {
    if (!kind || !canSave) return;
    const now = new Date().toISOString();
    const vat = vatRegistered
      ? ({
          registered: true,
          scheme: vatScheme,
          ...(vatNumber.trim() ? { number: vatNumber.trim() } : {}),
          ...(validIsoDay(vatRegisteredAt) ? { registeredAt: vatRegisteredAt } : {}),
          ...(vatScheme === 'flat-rate' ? { limitedCostTrader } : {}),
          ...(vatScheme === 'flat-rate' &&
          !limitedCostTrader &&
          Number.isFinite(Number(flatRatePercent))
            ? { flatRateBasisPoints: Math.max(0, Math.round(Number(flatRatePercent) * 100)) }
            : {}),
        } as const)
      : ({ registered: false } as const);
    const entity: BusinessEntity =
      kind === 'sole-trader'
        ? {
            kind,
            ...(name.trim() ? { tradingName: name.trim() } : {}),
            ...(utr.trim() ? { utr: utr.trim() } : {}),
            taxRegion: region,
            studentLoanPlans: studentPlans,
            vat,
            createdAt: current?.createdAt ?? now,
          }
        : {
            kind,
            companyName: name.trim(),
            ...(companyNumber.trim() ? { companyNumber: companyNumber.trim() } : {}),
            yearEnd: validIsoDay(yearEnd) ? yearEnd : nextMarch(),
            taxRegion: region,
            directors: [
              {
                id:
                  current?.kind === 'ltd'
                    ? (current.directors[0]?.id ?? `director-${Date.now()}`)
                    : `director-${Date.now()}`,
                name: directorName.trim() || 'Director',
                role: 'Director',
              },
            ],
            shareholders: [
              {
                id:
                  current?.kind === 'ltd'
                    ? (current.shareholders[0]?.id ?? `shareholder-${Date.now()}`)
                    : `shareholder-${Date.now()}`,
                name: directorName.trim() || 'Director',
                shares: 100,
              },
            ],
            vat,
            createdAt: current?.createdAt ?? now,
          };
    updateBusinessOperations((state) => ({
      entity,
      memory: current
        ? state.memory
        : [
            {
              id: `business-memory-entity-${Date.now()}`,
              at: now,
              kind: 'entity-created' as const,
              summary:
                entity.kind === 'ltd'
                  ? `${entity.companyName} was set up as a Limited Company.`
                  : `${entity.tradingName ?? 'The business'} was set up as a Sole Trader.`,
              reflected: false,
            },
            ...state.memory,
          ].slice(0, 200),
    }));
    nav.back();
  };

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.sm, paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <BackButton onPress={nav.back} />

        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: t.muted }]}>Business setup</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            What sort of business?
          </Text>
          <Text style={[styles.intro, { color: t.muted }]}>
            This changes the questions, deadlines and tax calculations. It does not mix your
            Personal and Business money.
          </Text>
        </View>

        <View style={styles.kindCards}>
          <KindCard
            label="Sole Trader"
            hint="You and the business are one. Self-Assessment, and VAT if registered."
            selected={kind === 'sole-trader'}
            onPress={() => setKind('sole-trader')}
          />
          <KindCard
            label="Limited Company"
            hint="A separate legal entity. Corporation Tax, payroll, dividends and Companies House."
            selected={kind === 'ltd'}
            onPress={() => setKind('ltd')}
          />
        </View>

        {kind ? (
          <View style={styles.form}>
            <Field
              label={kind === 'ltd' ? 'Company name' : 'Trading name · optional'}
              value={name}
              onChangeText={setName}
              placeholder={kind === 'ltd' ? 'Your company Ltd' : 'Your trading name'}
            />

            {kind === 'ltd' ? (
              <>
                <Field
                  label="Company number · optional"
                  value={companyNumber}
                  onChangeText={setCompanyNumber}
                  placeholder="12345678"
                  keyboardType="number-pad"
                />
                <Field
                  label="Year end · YYYY-MM-DD"
                  value={yearEnd}
                  onChangeText={setYearEnd}
                  placeholder="2027-03-31"
                />
                <Field
                  label="First director"
                  value={directorName}
                  onChangeText={setDirectorName}
                  placeholder="Your name"
                />
              </>
            ) : (
              <Field
                label="UTR · optional"
                value={utr}
                onChangeText={setUtr}
                placeholder="10 digits"
                keyboardType="number-pad"
              />
            )}

            <ChoiceGroup
              title="Tax region"
              options={[
                { id: 'england-ni', label: 'England / NI' },
                { id: 'scotland', label: 'Scotland' },
                { id: 'wales', label: 'Wales' },
              ]}
              value={region}
              onChange={(value) => setRegion(value as TaxRegion)}
            />

            {kind === 'sole-trader' ? (
              <View style={styles.choiceBlock}>
                <Text style={[styles.fieldLabel, { color: t.muted }]}>Student loan plans</Text>
                <View style={styles.wrap}>
                  {(['1', '2', '4', '5', 'postgrad'] as const).map((plan) => {
                    const selected = studentPlans.includes(plan);
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={plan}
                        onPress={() =>
                          setStudentPlans(
                            selected
                              ? studentPlans.filter((item) => item !== plan)
                              : [...studentPlans, plan],
                          )
                        }
                        style={({ pressed }) => [
                          styles.chip,
                          {
                            backgroundColor: selected ? t.calmStrong : t.inset,
                            opacity: pressed ? 0.66 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.chipLabel, { color: selected ? t.inverse : t.ink }]}>
                          {plan === 'postgrad' ? 'Postgrad' : `Plan ${plan}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View
              style={[styles.switchRow, { backgroundColor: t.surface, borderColor: t.hairline }]}
            >
              <View style={styles.switchCopy}>
                <Text style={[styles.switchTitle, { color: t.ink }]}>VAT registered?</Text>
                <Text style={[styles.switchHint, { color: t.muted }]}>
                  Turn this on only when the registration is real.
                </Text>
              </View>
              <Switch
                accessibilityLabel="VAT registered"
                value={vatRegistered}
                onValueChange={setVatRegistered}
                trackColor={{ false: t.inset, true: t.calmStrong }}
              />
            </View>

            {vatRegistered ? (
              <View style={styles.vatDetails}>
                <ChoiceGroup
                  title="VAT scheme"
                  options={[
                    { id: 'standard', label: 'Standard' },
                    { id: 'cash', label: 'Cash' },
                    { id: 'flat-rate', label: 'Flat rate' },
                    { id: 'annual', label: 'Annual' },
                  ]}
                  value={vatScheme}
                  onChange={(value) => setVatScheme(value as RegisteredVatScheme)}
                />
                <Field
                  label="VAT number · optional"
                  onChangeText={setVatNumber}
                  placeholder="GB123456789"
                  value={vatNumber}
                />
                <Field
                  label="Registered from · YYYY-MM-DD"
                  onChangeText={setVatRegisteredAt}
                  placeholder="2026-04-01"
                  value={vatRegisteredAt}
                />
                {vatScheme === 'flat-rate' ? (
                  <>
                    <ChoiceGroup
                      title="Flat Rate basis"
                      options={[
                        { id: 'sector', label: 'Sector rate' },
                        { id: 'limited', label: 'Limited cost · 16.5%' },
                      ]}
                      value={limitedCostTrader ? 'limited' : 'sector'}
                      onChange={(value) => setLimitedCostTrader(value === 'limited')}
                    />
                    {!limitedCostTrader ? (
                      <Field
                        keyboardType="decimal-pad"
                        label="HMRC sector rate · %"
                        onChangeText={setFlatRatePercent}
                        placeholder="12.5"
                        value={flatRatePercent}
                      />
                    ) : null}
                  </>
                ) : null}
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={!canSave}
              onPress={save}
              style={({ pressed }) => [
                styles.save,
                {
                  backgroundColor: t.calmStrong,
                  opacity: !canSave ? 0.38 : pressed ? 0.68 : 1,
                },
              ]}
            >
              <Text style={[styles.saveLabel, { color: t.inverse }]}>
                Save {kind === 'ltd' ? 'Limited Company' : 'Sole Trader'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityLabel="Back"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.back, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[styles.backLabel, { color: t.muted }]}>←</Text>
    </Pressable>
  );
}

function KindCard({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.kindCard,
        {
          backgroundColor: selected ? t.inset : t.surface,
          borderColor: selected ? t.calmStrong : t.hairline,
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      <View style={styles.kindTitleRow}>
        <Text style={[styles.kindTitle, { color: t.ink }]}>{label}</Text>
        {selected ? <Text style={[styles.current, { color: t.calmStrong }]}>Current</Text> : null}
      </View>
      <Text style={[styles.kindHint, { color: t.muted }]}>{hint}</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
}) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: t.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        selectionColor={t.calmStrong}
        style={[styles.input, { backgroundColor: t.inset, color: t.ink }]}
        value={value}
      />
    </View>
  );
}

function ChoiceGroup({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: readonly Readonly<{ id: string; label: string }>[];
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.choiceBlock}>
      <Text style={[styles.fieldLabel, { color: t.muted }]}>{title}</Text>
      <View style={styles.wrap}>
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.id}
              onPress={() => onChange(option.id)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: selected ? t.calmStrong : t.inset,
                  opacity: pressed ? 0.66 : 1,
                },
              ]}
            >
              <Text style={[styles.chipLabel, { color: selected ? t.inverse : t.ink }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function validIsoDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function nextMarch(): string {
  const now = new Date();
  const year = now.getUTCMonth() >= 3 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  return `${year}-03-31`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gap.xl },
  back: {
    alignItems: 'flex-start',
    height: 44,
    justifyContent: 'center',
    marginLeft: -8,
    width: 44,
  },
  backLabel: { fontSize: 22 },
  hero: { marginTop: gap.sm },
  eyebrow: { fontFamily: serif.displayItalic, fontSize: 13 },
  headline: {
    fontFamily: serif.display,
    fontSize: 30,
    letterSpacing: -0.35,
    lineHeight: 36,
    marginTop: gap.xs,
  },
  intro: { fontSize: 13.5, lineHeight: 20, marginTop: gap.md, maxWidth: 520 },
  kindCards: { gap: gap.sm, marginTop: gap.xl },
  kindCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: gap.lg,
  },
  kindTitleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  kindTitle: { fontSize: 15, fontWeight: '700' },
  kindHint: { fontSize: 12.5, lineHeight: 18, marginTop: gap.xs },
  current: { fontSize: 10, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' },
  form: { marginTop: gap.xl },
  field: { marginTop: gap.lg },
  fieldLabel: { fontSize: 11.5, fontWeight: '600', marginBottom: gap.xs },
  input: {
    borderRadius: radius.md,
    fontSize: 14,
    minHeight: 50,
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm,
  },
  choiceBlock: { marginTop: gap.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm },
  chip: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: gap.md,
  },
  chipLabel: { fontSize: 12, fontWeight: '600' },
  switchRow: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: gap.xl,
    padding: gap.lg,
  },
  switchCopy: { flex: 1, paddingRight: gap.lg },
  switchTitle: { fontSize: 14, fontWeight: '700' },
  switchHint: { fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  vatDetails: { marginTop: gap.xs },
  save: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    marginTop: gap.xl,
    minHeight: 52,
    paddingHorizontal: gap.lg,
  },
  saveLabel: { fontSize: 14.5, fontWeight: '700' },
});
