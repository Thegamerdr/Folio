import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  emptyBusinessOperationsState,
  findFlatRateSector,
  HMRC_FRS_SECTOR_SOURCE,
  normaliseBusinessOperationsState,
  searchFlatRateSectors,
  type BusinessEntity,
  type FlatRateSector,
  type StudentLoanPlan,
  type TaxRegion,
  type VatScheme,
} from '@folio/business-workspace';

import { gap, radius, serif, useTheme, weightFamily } from '@/folio/theme';
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
  const [kind, setKind] = useState<EntityKind | null>(null);
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
  const [flatRateSectorId, setFlatRateSectorId] = useState<string | undefined>(
    current?.vat.registered && current.vat.scheme === 'flat-rate'
      ? current.vat.flatRateSectorId
      : undefined,
  );
  const flatRateSector = useMemo(() => findFlatRateSector(flatRateSectorId), [flatRateSectorId]);
  const [studentPlans, setStudentPlans] = useState<readonly StudentLoanPlan[]>(
    current?.kind === 'sole-trader' ? current.studentLoanPlans : [],
  );

  const entityReady = kind === 'sole-trader' || (kind === 'ltd' && name.trim().length > 0);
  const flatRateReady =
    !vatRegistered ||
    vatScheme !== 'flat-rate' ||
    limitedCostTrader ||
    flatRateSector !== undefined;
  const canSave = entityReady && flatRateReady;

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
          ...(vatScheme === 'flat-rate' && flatRateSector !== undefined
            ? {
                flatRateBasisPoints: flatRateSector.rateBasisPoints,
                flatRateSectorId: flatRateSector.id,
                flatRateSectorLabel: flatRateSector.label,
                flatRateSourceVersion: HMRC_FRS_SECTOR_SOURCE.id,
              }
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
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <BackButton onPress={nav.back} />

        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: t.muted }]}>
            {kind === null
              ? 'Business setup · step 1 of 2'
              : kind === 'ltd'
                ? 'Step 2 of 2 · a company'
                : 'Step 2 of 2 · just me'}
          </Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {kind === null ? (
              current ? (
                <>
                  Set up as a{' '}
                  <Text style={{ color: t.calm }}>
                    {current.kind === 'ltd' ? 'limited company' : 'sole trader'}
                  </Text>
                  .
                </>
              ) : (
                <>
                  Two <Text style={{ color: t.calm }}>questions</Text>, then the cash picture.
                </>
              )
            ) : kind === 'ltd' ? (
              <>
                The <Text style={{ color: t.calm }}>company</Text> basics.
              </>
            ) : (
              <>
                A few <Text style={{ color: t.calm }}>details</Text>.
              </>
            )}
          </Text>
          {kind === null ? (
            <Text style={[styles.intro, { color: t.muted }]}>
              {current
                ? "Change it whenever the business changes. Nothing you've added is lost."
                : "How the business is set up decides what counts as due. That's the only reason it's asked."}
            </Text>
          ) : null}
        </View>

        {kind === null ? (
          <>
            <View style={styles.kindCards}>
              <KindCard
                label="Just me"
                legal="Sole trader"
                hint="Self-Assessment each year, and VAT once you go over the threshold."
                selected={current?.kind === 'sole-trader'}
                onPress={() => setKind('sole-trader')}
              />
              <KindCard
                label="A company"
                legal="Limited company"
                hint="Corporation Tax, payroll, dividends and Companies House dates."
                selected={current?.kind === 'ltd'}
                onPress={() => setKind('ltd')}
              />
            </View>
            <Text style={[styles.kindNote, { color: t.muted }]}>
              Not sure yet? Pick the closest — it's changeable in Business → Account.
            </Text>
          </>
        ) : null}

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
                  Turn on if you're over the £90k threshold or voluntarily registered.
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
                      <FlatRateSectorPicker
                        onChange={setFlatRateSectorId}
                        selected={flatRateSector}
                      />
                    ) : (
                      <Text style={[styles.flatRateNote, { color: t.muted }]}>
                        The 16.5% limited-cost rate overrides the normal sector rate for the period.
                      </Text>
                    )}
                  </>
                ) : null}
              </View>
            ) : null}

            <View style={styles.formActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setKind(null)}
                style={({ pressed }) => [
                  styles.formBack,
                  { backgroundColor: t.inset, opacity: pressed ? 0.68 : 1 },
                ]}
              >
                <Text style={[styles.formBackLabel, { color: t.ink }]}>Back</Text>
              </Pressable>
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
                <Text style={[styles.saveLabel, { color: t.inverse }]}>Save and see the cash picture</Text>
              </Pressable>
            </View>
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
  legal,
  hint,
  selected,
  onPress,
}: {
  label: string;
  legal: string;
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
          borderColor: t.hairline,
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      <View style={styles.kindCopy}>
        <Text style={[styles.kindTitle, { color: t.ink }]}>{label}</Text>
        <Text style={[styles.kindHint, { color: t.muted }]}>
          {legal} · {hint}
        </Text>
      </View>
      <Text
        style={[
          styles.kindAction,
          selected ? styles.kindCurrent : styles.kindArrow,
          { color: t.calmStrong },
        ]}
      >
        {selected ? 'Current' : '→'}
      </Text>
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

function FlatRateSectorPicker({
  selected,
  onChange,
}: {
  selected: FlatRateSector | undefined;
  onChange: (id: string) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchFlatRateSectors(query), [query]);

  return (
    <View style={styles.choiceBlock}>
      <Text style={[styles.fieldLabel, { color: t.muted }]}>HMRC business sector</Text>
      <Pressable
        accessibilityHint="Opens the official Flat Rate Scheme sector list"
        accessibilityLabel={
          selected === undefined
            ? 'Choose HMRC business sector'
            : `${selected.label}, ${formatFlatRate(selected.rateBasisPoints)}`
        }
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.sectorButton,
          {
            backgroundColor: t.inset,
            borderColor: selected === undefined ? t.repairInk : t.hairline,
            opacity: pressed ? 0.68 : 1,
          },
        ]}
      >
        <View style={styles.sectorButtonCopy}>
          <Text
            numberOfLines={2}
            style={[styles.sectorButtonTitle, { color: selected === undefined ? t.muted : t.ink }]}
          >
            {selected?.label ?? 'Choose the closest sector'}
          </Text>
          <Text style={[styles.sectorButtonHint, { color: t.muted }]}>
            {selected === undefined
              ? 'Search by trade or activity'
              : `HMRC rate · ${formatFlatRate(selected.rateBasisPoints)}`}
          </Text>
        </View>
        <Text accessibilityElementsHidden style={[styles.sectorChevron, { color: t.muted }]}>
          ›
        </Text>
      </Pressable>
      {selected === undefined ? (
        <Text style={[styles.flatRateValidation, { color: t.repairInk }]}>
          Choose a sector before saving this Flat Rate setup.
        </Text>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        presentationStyle="pageSheet"
        visible={open}
      >
        <View
          style={[
            styles.sectorModal,
            {
              backgroundColor: t.canvas,
              paddingTop: insets.top + gap.md,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <View style={styles.sectorModalHeader}>
            <View style={styles.sectorModalTitleCopy}>
              <Text accessibilityRole="header" style={[styles.sectorModalTitle, { color: t.ink }]}>
                Flat Rate sector
              </Text>
              <Text style={[styles.sectorModalSubtitle, { color: t.muted }]}>
                {HMRC_FRS_SECTOR_SOURCE.sectorCount} official sectors · checked 19 July 2026
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close sector list"
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              style={({ pressed }) => [
                styles.sectorClose,
                { backgroundColor: t.inset, opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Text style={[styles.sectorCloseLabel, { color: t.ink }]}>Done</Text>
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel="Search Flat Rate sectors"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Try plumber, taxi or bookkeeping"
            placeholderTextColor={t.muted}
            returnKeyType="search"
            selectionColor={t.calmStrong}
            style={[styles.sectorSearch, { backgroundColor: t.inset, color: t.ink }]}
            value={query}
          />
          <FlatList
            contentContainerStyle={styles.sectorList}
            data={results}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(sector) => sector.id}
            ListEmptyComponent={
              <Text style={[styles.sectorEmpty, { color: t.muted }]}>
                No official sector matches that search. Try the work the business actually does.
              </Text>
            }
            renderItem={({ item }) => {
              const isSelected = selected?.id === item.id;
              return (
                <Pressable
                  accessibilityLabel={`${item.label}, ${formatFlatRate(item.rateBasisPoints)}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    onChange(item.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  style={({ pressed }) => [
                    styles.sectorRow,
                    {
                      backgroundColor: isSelected ? t.inset : t.canvas,
                      borderColor: isSelected ? t.calmStrong : t.hairline,
                      opacity: pressed ? 0.64 : 1,
                    },
                  ]}
                >
                  <View style={styles.sectorRowCopy}>
                    <Text style={[styles.sectorRowTitle, { color: t.ink }]}>{item.label}</Text>
                    <Text numberOfLines={2} style={[styles.sectorExamples, { color: t.muted }]}>
                      {item.examples.slice(0, 3).join(' · ')}
                    </Text>
                  </View>
                  <Text style={[styles.sectorRate, { color: t.calmStrong }]}>
                    {formatFlatRate(item.rateBasisPoints)}
                  </Text>
                </Pressable>
              );
            }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>
    </View>
  );
}

function formatFlatRate(rateBasisPoints: number): string {
  return `${(rateBasisPoints / 100).toFixed(rateBasisPoints % 100 === 0 ? 0 : 1)}%`;
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
  content: { paddingHorizontal: 24 },
  back: {
    alignItems: 'flex-start',
    height: 44,
    justifyContent: 'center',
    marginLeft: -8,
    width: 44,
  },
  backLabel: { fontSize: 22 },
  hero: { marginTop: 28 },
  eyebrow: {
    fontFamily: weightFamily(400),
    fontSize: 11,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: serif.display,
    fontSize: 28,
    lineHeight: 36,
    marginTop: gap.sm,
  },
  intro: {
    fontFamily: weightFamily(400),
    fontSize: 14,
    lineHeight: 20,
    marginTop: gap.lg,
    maxWidth: 520,
  },
  kindCards: { marginTop: 32 },
  kindCard: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 64,
    paddingVertical: gap.lg,
  },
  kindCopy: { flex: 1, paddingRight: gap.md },
  kindTitle: { fontFamily: weightFamily(600), fontSize: 16 },
  kindHint: {
    fontFamily: weightFamily(400),
    fontSize: 12.5,
    lineHeight: 16,
    marginTop: 2,
  },
  kindAction: { marginLeft: gap.md },
  kindArrow: { fontFamily: weightFamily(400), fontSize: 16 },
  kindCurrent: {
    fontFamily: weightFamily(600),
    fontSize: 11,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
  },
  kindNote: {
    fontFamily: weightFamily(400),
    fontSize: 11,
    lineHeight: 16,
    marginTop: gap.xl,
  },
  form: { marginTop: 0 },
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
  flatRateNote: { fontSize: 12, lineHeight: 18, marginTop: gap.md },
  flatRateValidation: { fontSize: 11.5, lineHeight: 17, marginTop: gap.xs },
  sectorButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 62,
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm,
  },
  sectorButtonCopy: { flex: 1, paddingRight: gap.sm },
  sectorButtonTitle: { fontSize: 13.5, fontWeight: '700', lineHeight: 19 },
  sectorButtonHint: { fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  sectorChevron: { fontSize: 24, lineHeight: 28 },
  sectorModal: { flex: 1, paddingHorizontal: gap.xl },
  sectorModalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectorModalTitleCopy: { flex: 1, paddingRight: gap.md },
  sectorModalTitle: { fontFamily: serif.display, fontSize: 27, letterSpacing: -0.3 },
  sectorModalSubtitle: { fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  sectorClose: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: gap.md,
  },
  sectorCloseLabel: { fontSize: 12.5, fontWeight: '700' },
  sectorSearch: {
    borderRadius: radius.md,
    fontSize: 14,
    marginTop: gap.lg,
    minHeight: 48,
    paddingHorizontal: gap.md,
  },
  sectorList: { paddingBottom: gap.xxxl, paddingTop: gap.md },
  sectorEmpty: { fontSize: 13, lineHeight: 20, paddingVertical: gap.xl, textAlign: 'center' },
  sectorRow: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginBottom: gap.sm,
    minHeight: 74,
    padding: gap.md,
  },
  sectorRowCopy: { flex: 1, paddingRight: gap.md },
  sectorRowTitle: { fontSize: 13.5, fontWeight: '700', lineHeight: 19 },
  sectorExamples: { fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  sectorRate: { fontSize: 14, fontWeight: '800' },
  formActions: { flexDirection: 'row', gap: gap.sm, marginTop: gap.xl },
  formBack: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: gap.md,
  },
  formBackLabel: { fontFamily: weightFamily(600), fontSize: 14 },
  save: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 2,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: gap.md,
  },
  saveLabel: { fontFamily: weightFamily(600), fontSize: 14, textAlign: 'center' },
});
