import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  confirmationStatementDueDate,
  type BusinessFilingKind,
  type BusinessOperationsState,
} from '@folio/business-workspace';

import {
  buildBusinessFilingWorkingCopy,
  shareBusinessFilingPdf,
  type BusinessFilingWorkingCopy,
} from '@/folio/lib/businessFilingExport';
import { gap, serif, useTheme, weightFamily } from '@/folio/theme';
import { updateBusinessOperations } from '@/folio/store';
import type { Nav, ScreenId } from '@/folio/types';
import {
  BusinessCard,
  BusinessChoicePills,
  BusinessField,
  BusinessFormSheet,
  BusinessPrimaryAction,
  BusinessRouteRow,
  BusinessScreenFrame,
  BusinessSecondaryAction,
  BusinessSectionTitle,
  formatBusinessDate,
  formatMinor,
  parseMinor,
} from './BusinessUi';
import { useBusinessOperations } from './useBusinessOperations';

type FilingRoute = Extract<
  ScreenId,
  | 'business-filing-vat'
  | 'business-filing-sa'
  | 'business-filing-ct'
  | 'business-filing-cs'
  | 'business-filing-accounts'
  | 'business-filing-payroll'
>;

export function BusinessFilingsScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const business = useBusinessOperations();
  const entity = business.entity;
  const rows: readonly Readonly<{
    kind: BusinessFilingKind;
    route: FilingRoute;
    label: string;
    hint: string;
    visible: boolean;
  }>[] = [
    {
      kind: 'vat',
      route: 'business-filing-vat',
      label: 'VAT return',
      hint: 'Nine boxes and the current net amount',
      visible: entity?.vat.registered === true,
    },
    {
      kind: 'self-assessment',
      route: 'business-filing-sa',
      label: 'Self-Assessment',
      hint: 'Income Tax, Class 4 NI and student loan',
      visible: entity?.kind === 'sole-trader',
    },
    {
      kind: 'corporation-tax',
      route: 'business-filing-ct',
      label: 'Corporation Tax · CT600',
      hint: 'Profit, effective rate and tax due',
      visible: entity?.kind === 'ltd',
    },
    {
      kind: 'payroll',
      route: 'business-filing-payroll',
      label: 'Payroll',
      hint: 'Gross, net, PAYE, National Insurance and student loans',
      visible: entity?.kind === 'ltd',
    },
    {
      kind: 'confirmation-statement',
      route: 'business-filing-cs',
      label: 'Confirmation Statement · CS01',
      hint: 'Company, directors and shareholders',
      visible: entity?.kind === 'ltd',
    },
    {
      kind: 'annual-accounts',
      route: 'business-filing-accounts',
      label: 'Annual accounts',
      hint: 'Year end, company details and profit',
      visible: entity?.kind === 'ltd',
    },
  ];
  const visible = rows.filter((row) => row.visible);

  if (visible.length === 0) {
    return <BusinessFilingsEmpty nav={nav} />;
  }

  return (
    <BusinessScreenFrame
      eyebrow="Filings"
      headline="Everything to prepare and send."
      intro="Melo calculates and exports working copies locally. An item is only marked submitted after you record a real external submission and reference."
      onBack={nav.back}
    >
      {visible.length === 0 ? (
        <>
          <BusinessCard tone="inset">
            <Text style={[styles.emptyTitle, { color: t.ink }]}>Nothing to prepare yet.</Text>
            <Text style={[styles.emptyBody, { color: t.muted }]}>
              Pick the business type first. VAT appears only when registration is turned on.
            </Text>
          </BusinessCard>
          <BusinessPrimaryAction
            label="Pick a business type"
            onPress={() => nav.go('business-entity-setup')}
          />
        </>
      ) : (
        <View>
          {visible.map((row) => {
            const last = business.filings.find((filing) => filing.kind === row.kind);
            return (
              <BusinessRouteRow
                hint={
                  last
                    ? `${last.status === 'submitted-external' ? 'Submitted externally' : 'Working copy saved'} · ${formatBusinessDate(last.preparedAt.slice(0, 10))}`
                    : row.hint
                }
                key={row.kind}
                label={row.label}
                onPress={() => nav.go(row.route)}
              />
            );
          })}
        </View>
      )}

      {business.filings.length > 0 ? (
        <View style={styles.section}>
          <BusinessSectionTitle title="Filing record" value={String(business.filings.length)} />
          <BusinessCard>
            {business.filings.slice(0, 10).map((filing, index) => (
              <View
                key={filing.id}
                style={[
                  styles.recordRow,
                  index > 0
                    ? { borderTopColor: t.hairline, borderTopWidth: StyleSheet.hairlineWidth }
                    : undefined,
                ]}
              >
                <View style={styles.recordCopy}>
                  <Text style={[styles.recordTitle, { color: t.ink }]}>
                    {filingLabel(filing.kind)}
                  </Text>
                  <Text style={[styles.recordMeta, { color: t.muted }]}>
                    {filing.period} · {filing.status.replace('-', ' ')}
                    {filing.externalReference ? ` · ${filing.externalReference}` : ''}
                  </Text>
                </View>
                {filing.amountMinor !== undefined ? (
                  <Text style={[styles.recordMoney, { color: t.ink }]}>
                    {formatMinor(filing.amountMinor)}
                  </Text>
                ) : null}
              </View>
            ))}
          </BusinessCard>
        </View>
      ) : null}
    </BusinessScreenFrame>
  );
}

function BusinessFilingsEmpty({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.filingsEmptyRoot, { backgroundColor: t.canvas }]}>
      <View
        style={[
          styles.filingsEmptyHeader,
          {
            backgroundColor: t.surface,
            height: insets.top + 72,
            paddingTop: insets.top,
          },
        ]}
      >
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          onPress={nav.back}
          style={({ pressed }) => [styles.filingsEmptyBack, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.filingsEmptyBackLabel, { color: t.muted }]}>←</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[styles.filingsEmptyScreenTitle, { color: t.ink }]}>
          Filings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.filingsEmptyContent,
          { paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.filingsEmptyHero}>
          <Text style={[styles.filingsEmptyEyebrow, { color: t.muted }]}>Filings</Text>
          <Text accessibilityRole="header" style={[styles.filingsEmptyHeadline, { color: t.ink }]}>
            Nothing to <Text style={{ color: t.calm }}>get ready</Text> yet.
          </Text>
          <Text style={[styles.filingsEmptyWhy, { color: t.muted }]}>
            Nothing has been chosen on the business side yet, so no return applies.
          </Text>
        </View>

        <View style={[styles.filingsEmptyPanel, { backgroundColor: t.inset }]}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.filingsEmptyPerch}
          />
          <Text style={[styles.filingsEmptyPanelTitle, { color: t.ink }]}>
            Nothing to get ready <Text style={{ color: t.calmStrong }}>yet</Text>.
          </Text>
          <Text style={[styles.filingsEmptyPanelBody, { color: t.muted }]}>
            Pick the business type and this becomes the one place for VAT, Self-Assessment or
            Corporation Tax, the Confirmation Statement, and annual accounts.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.go('business-entity-setup')}
            style={({ pressed }) => [
              styles.filingsEmptyAction,
              { backgroundColor: t.ink, opacity: pressed ? 0.68 : 1 },
            ]}
          >
            <Text style={[styles.filingsEmptyActionLabel, { color: t.canvas }]}>
              Pick business type
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

type FilingPresentation = Readonly<{
  screenTitle: string;
  period: string;
  headlineBefore: string;
  headlineAccent: string;
  headlineAfter: string;
  intro: string;
  figures: readonly Readonly<{ label: string; value: string }>[];
  amount?: Readonly<{ label: string; valueMinor: number; caption: string }> | undefined;
}>;

function SourceAlignedFilingWorkingCopy({
  confirmed,
  copy,
  nav,
  onConfirmedChange,
  onEditSelfAssessment,
  onExternal,
  onShare,
  presentation,
  shareError,
  sharing,
}: {
  confirmed: boolean;
  copy: BusinessFilingWorkingCopy;
  nav: Nav;
  onConfirmedChange: (confirmed: boolean) => void;
  onEditSelfAssessment?: () => void;
  onExternal: () => void;
  onShare: () => void;
  presentation: FilingPresentation;
  shareError: string | null;
  sharing: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.annualRoot, { backgroundColor: t.canvas }]}>
      <View
        style={[
          styles.annualHeader,
          {
            backgroundColor: t.surface,
            height: insets.top + 72,
            paddingTop: insets.top,
          },
        ]}
      >
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          onPress={nav.back}
          style={({ pressed }) => [styles.annualBack, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.annualBackLabel, { color: t.muted }]}>←</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[styles.annualScreenTitle, { color: t.ink }]}>
          {presentation.screenTitle}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.annualContent, { paddingBottom: insets.bottom + gap.xxxl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.annualEyebrow, { color: t.muted }]}>
          {presentation.screenTitle} · {presentation.period}
        </Text>
        <Text accessibilityRole="header" style={[styles.annualHeadline, { color: t.ink }]}>
          {presentation.headlineBefore}
          <Text style={{ color: t.calm }}>{presentation.headlineAccent}</Text>
          {presentation.headlineAfter}
        </Text>
        <Text style={[styles.annualIntro, { color: t.muted }]}>{presentation.intro}</Text>

        {presentation.amount ? (
          <View style={styles.filingAmount}>
            <Text style={[styles.annualEyebrow, { color: t.muted }]}>
              {presentation.amount.label}
            </Text>
            <Text style={[styles.filingAmountValue, { color: t.ink }]}>
              {formatMinor(presentation.amount.valueMinor)}
            </Text>
            <Text style={[styles.filingAmountCaption, { color: t.muted }]}>
              {presentation.amount.caption}
            </Text>
          </View>
        ) : null}

        <View style={styles.annualSection}>
          <Text style={[styles.annualEyebrow, { color: t.muted }]}>The figures</Text>
          <Text style={[styles.annualSectionTitle, { color: t.ink }]}>
            What Melo has worked out
          </Text>
          <View
            accessibilityLabel="Figures for this filing"
            style={[styles.annualFigures, { backgroundColor: t.surface, borderColor: t.hairline }]}
          >
            {presentation.figures.map((row, index) => (
              <View
                key={row.label}
                style={[
                  styles.annualFigureRow,
                  index > 0
                    ? { borderTopColor: t.hairline, borderTopWidth: StyleSheet.hairlineWidth }
                    : undefined,
                ]}
              >
                <Text style={[styles.annualFigureLabel, { color: t.ink }]}>{row.label}</Text>
                <Text style={[styles.annualFigureValue, { color: t.ink }]}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.annualActions}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: confirmed }}
            onPress={() => onConfirmedChange(!confirmed)}
            style={({ pressed }) => [
              styles.annualConfirmation,
              { backgroundColor: t.inset, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View
              style={[
                styles.annualCheckbox,
                {
                  backgroundColor: confirmed ? t.calm : 'transparent',
                  borderColor: confirmed ? t.calm : t.muted,
                },
              ]}
            >
              {confirmed ? <Text style={[styles.annualCheck, { color: t.surface }]}>✓</Text> : null}
            </View>
            <Text style={[styles.annualConfirmationLabel, { color: t.ink }]}>
              I've checked the numbers and they look right. Melo will pack them for {copy.authority}
              {' — '}I'll send them myself.
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!confirmed || sharing}
            onPress={onShare}
            style={({ pressed }) => [
              styles.annualPrimary,
              {
                backgroundColor: t.calmStrong,
                opacity: !confirmed || sharing ? 0.4 : pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[styles.annualPrimaryLabel, { color: t.surface }]}>
              {sharing ? 'Creating PDF…' : `Prepare the ${copy.authority} pack`}
            </Text>
          </Pressable>
          <Text style={[styles.annualDisclaimer, { color: t.muted }]}>
            Melo has no connection to {copy.authority}. This prepares and keeps the figures so you
            can send them in recognised software, on the {copy.authority} service, or through your
            accountant.
          </Text>
          {shareError ? (
            <View style={[styles.error, { backgroundColor: t.repairSoft }]}>
              <Text style={[styles.errorText, { color: t.repairInk }]}>{shareError}</Text>
            </View>
          ) : null}
          <BusinessSecondaryAction label="Record a real external submission" onPress={onExternal} />
          {onEditSelfAssessment ? (
            <BusinessSecondaryAction
              label="Edit profit and transition basis"
              onPress={onEditSelfAssessment}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

export function BusinessFilingWorkingCopyScreen({ nav, route }: { nav: Nav; route: FilingRoute }) {
  const t = useTheme();
  const business = useBusinessOperations();
  const kind = kindForRoute(route);
  const copy = useMemo(() => buildBusinessFilingWorkingCopy(kind, business), [business, kind]);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [externalOpen, setExternalOpen] = useState(false);
  const [reference, setReference] = useState('');
  const [submittedOn, setSubmittedOn] = useState(new Date().toISOString().slice(0, 10));
  const [selfAssessmentOpen, setSelfAssessmentOpen] = useState(false);
  const [filingConfirmed, setFilingConfirmed] = useState(false);
  const [profit, setProfit] = useState((business.ytdProfitMinor / 100).toString());
  const [transitionRemaining, setTransitionRemaining] = useState(
    business.basisPeriodTransition
      ? (business.basisPeriodTransition.remainingMinor / 100).toString()
      : '',
  );
  const [transitionYears, setTransitionYears] = useState<'1' | '2' | '3' | '4'>(
    String(business.basisPeriodTransition?.yearsLeft ?? 4) as '1' | '2' | '3' | '4',
  );

  // The pinned source treats an unavailable filing as a useful member of the same filing family,
  // not as a generic empty state. Keep the exact limited-company Self-Assessment explanation and
  // its three relevant exits so direct routing, the filings hub and capture all converge on the
  // same contract.
  if (!copy && kind === 'self-assessment' && business.entity?.kind === 'ltd') {
    return (
      <BusinessScreenFrame
        title="Self-Assessment"
        eyebrow="Self-Assessment"
        headline={
          <>
            Self-Assessment is a{' '}
            <Text style={{ color: t.calmStrong }}>sole trader&apos;s</Text> return.
          </>
        }
        intro="You're set up as a limited company, so the company pays Corporation Tax and the personal return (the SA100) doesn't apply. If you also take a salary or dividends, that personal return is filed separately from Melo."
        onBack={nav.back}
      >
        <BusinessCard>
          <BusinessRouteRow
            label="Corporation Tax"
            hint="Worked out from the trading profit Melo holds"
            onPress={() => nav.go('business-filing-ct')}
          />
          <BusinessRouteRow
            label="VAT return"
            hint="Four boxes, ready when the quarter closes"
            onPress={() => nav.go('business-filing-vat')}
          />
          <BusinessRouteRow
            label="Salary vs dividends"
            hint="See what taking money out costs you"
            onPress={() => nav.go('business-dividends')}
          />
        </BusinessCard>
      </BusinessScreenFrame>
    );
  }

  if (!copy) {
    return (
      <BusinessScreenFrame
        eyebrow={filingLabel(kind)}
        headline="Nothing ready to prepare."
        intro={missingCopyReason(kind, business.entity?.kind ?? null)}
        onBack={nav.back}
      >
        <BusinessCard tone="inset">
          <Text style={[styles.emptyBody, { color: t.muted }]}>
            A working copy is built only from saved business figures. No boxes or references are
            invented.
          </Text>
        </BusinessCard>
        <BusinessPrimaryAction
          label={kind === 'vat' ? 'Open VAT' : 'Open Business type'}
          onPress={() => nav.go(kind === 'vat' ? 'business-vat' : 'business-entity-setup')}
        />
      </BusinessScreenFrame>
    );
  }

  const savePreparedRecord = () => {
    const existing = business.filings.find(
      (item) => item.kind === copy.kind && item.period === copy.period,
    );
    if (existing) return existing.id;
    const id = `filing-${copy.kind}-${Date.now()}`;
    updateBusinessOperations((state) => ({
      filings: [
        {
          id,
          kind: copy.kind,
          period: copy.period,
          preparedAt: copy.generatedAt,
          policyPackVersion: copy.policyPackVersion,
          ...(copy.amountMinor !== undefined ? { amountMinor: copy.amountMinor } : {}),
          status: 'prepared',
        },
        ...state.filings,
      ],
    }));
    return id;
  };

  const share = async () => {
    setSharing(true);
    setShareError(null);
    try {
      savePreparedRecord();
      const result = await shareBusinessFilingPdf(copy);
      if (result === 'unavailable') {
        setShareError('This device has no share destination available.');
      }
    } catch {
      setShareError('The PDF could not be created. The saved figures were not changed.');
    } finally {
      setSharing(false);
    }
  };

  const recordExternalSubmission = () => {
    if (!reference.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(submittedOn)) return;
    const preparedId = savePreparedRecord();
    updateBusinessOperations((state) => ({
      filings: state.filings.some((item) => item.id === preparedId)
        ? state.filings.map((item) =>
            item.id === preparedId
              ? {
                  ...item,
                  status: 'submitted-external' as const,
                  submittedExternallyAt: `${submittedOn}T12:00:00.000Z`,
                  externalReference: reference.trim(),
                }
              : item,
          )
        : [
            {
              id: preparedId,
              kind: copy.kind,
              period: copy.period,
              preparedAt: copy.generatedAt,
              policyPackVersion: copy.policyPackVersion,
              ...(copy.amountMinor !== undefined ? { amountMinor: copy.amountMinor } : {}),
              status: 'submitted-external' as const,
              submittedExternallyAt: `${submittedOn}T12:00:00.000Z`,
              externalReference: reference.trim(),
            },
            ...state.filings,
          ],
      vatReturns:
        copy.kind === 'vat'
          ? state.vatReturns.map((item) =>
              !item.filedExternallyOn ? { ...item, filedExternallyOn: submittedOn } : item,
            )
          : state.vatReturns,
    }));
    setReference('');
    setExternalOpen(false);
  };

  const saveSelfAssessmentBasis = () => {
    const ytdProfitMinor = parseMinor(profit);
    const transitionMinor = transitionRemaining.trim() ? parseMinor(transitionRemaining) : 0;
    if (ytdProfitMinor === null || ytdProfitMinor < 0 || transitionMinor === null) return;
    updateBusinessOperations({
      ytdProfitMinor,
      basisPeriodTransition:
        transitionMinor > 0
          ? {
              remainingMinor: transitionMinor,
              yearsLeft: Number(transitionYears) as 1 | 2 | 3 | 4,
            }
          : null,
    });
    setSelfAssessmentOpen(false);
  };

  const presentation = buildFilingPresentation(copy, business);

  return (
    <>
      <SourceAlignedFilingWorkingCopy
        confirmed={filingConfirmed}
        copy={copy}
        nav={nav}
        onConfirmedChange={setFilingConfirmed}
        {...(copy.kind === 'self-assessment'
          ? { onEditSelfAssessment: () => setSelfAssessmentOpen(true) }
          : {})}
        onExternal={() => setExternalOpen(true)}
        onShare={() => void share()}
        presentation={presentation}
        shareError={shareError}
        sharing={sharing}
      />

      <BusinessFormSheet
        onClose={() => setExternalOpen(false)}
        onPrimary={recordExternalSubmission}
        primaryDisabled={!reference.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(submittedOn)}
        primaryLabel="Record submission"
        title={`Submitted to ${copy.authority}`}
        visible={externalOpen}
      >
        <BusinessField
          label="Official reference"
          onChangeText={setReference}
          placeholder="Reference from the authority"
          value={reference}
        />
        <BusinessField
          label="Submitted · YYYY-MM-DD"
          onChangeText={setSubmittedOn}
          placeholder="2026-07-18"
          value={submittedOn}
        />
      </BusinessFormSheet>
      <BusinessFormSheet
        onClose={() => setSelfAssessmentOpen(false)}
        onPrimary={saveSelfAssessmentBasis}
        primaryDisabled={(parseMinor(profit) ?? -1) < 0}
        primaryLabel="Save figures"
        title="Self-Assessment basis"
        visible={selfAssessmentOpen}
      >
        <BusinessField
          keyboardType="decimal-pad"
          label="Profit so far"
          onChangeText={setProfit}
          placeholder="0.00"
          value={profit}
        />
        <BusinessField
          keyboardType="decimal-pad"
          label="Transition profit remaining · optional"
          onChangeText={setTransitionRemaining}
          placeholder="0.00"
          value={transitionRemaining}
        />
        <BusinessChoicePills
          label="Years left to spread"
          onChange={setTransitionYears}
          options={[
            { id: '1', label: '1' },
            { id: '2', label: '2' },
            { id: '3', label: '3' },
            { id: '4', label: '4' },
          ]}
          value={transitionYears}
        />
      </BusinessFormSheet>
    </>
  );
}

function buildFilingPresentation(
  copy: BusinessFilingWorkingCopy,
  business: BusinessOperationsState,
): FilingPresentation {
  const row = (label: string, fallback = 'Not recorded') =>
    copy.rows.find((item) => item.label === label)?.value ?? fallback;
  const estimatedAmount = (label: string, period: string) =>
    copy.amountMinor === undefined
      ? undefined
      : {
          label,
          valueMinor: copy.amountMinor,
          caption: `Worked out from the figures Melo has for ${period}, so treat it as a close guess.`,
        };

  if (copy.kind === 'vat') {
    const [periodStart = copy.period, periodEnd = copy.period] = copy.period.split(' to ');
    const period = humanBusinessPeriod(periodStart, periodEnd);
    const activeReturn = business.vatReturns.find(
      (item) => item.periodStart === periodStart && item.periodEnd === periodEnd,
    );
    return {
      screenTitle: 'VAT return',
      period,
      headlineBefore: 'Get the ',
      headlineAccent: period,
      headlineAfter: ' VAT return ready.',
      intro: `Melo has the four boxes ready.${activeReturn ? ` Due ${formatLongBusinessDate(activeReturn.dueOn)}.` : ''}`,
      figures: [
        { label: 'Box 1 — Output VAT', value: row('Box 1 · Output VAT') },
        { label: 'Box 4 — Input VAT', value: row('Box 4 · Input VAT') },
        { label: 'Box 6 — Sales ex VAT', value: row('Box 6 · Sales excluding VAT') },
        { label: 'Box 7 — Purchases ex VAT', value: row('Box 7 · Purchases excluding VAT') },
      ],
      amount: estimatedAmount('Net VAT owed', period),
    };
  }

  if (copy.kind === 'self-assessment') {
    const period = copy.period;
    return {
      screenTitle: 'Self-Assessment',
      period,
      headlineBefore: 'Get your ',
      headlineAccent: period,
      headlineAfter: ' Self-Assessment ready.',
      intro: 'Based on the trading profit Melo has for you this tax year.',
      figures: [
        { label: 'Trading profit', value: row('Recorded trading profit') },
        { label: 'Income Tax', value: row('Income Tax') },
        { label: 'Class 4 NI', value: row('Class 4 National Insurance') },
        { label: 'Tax reference (UTR)', value: row('UTR') },
      ],
      amount: estimatedAmount('Total tax owed', period),
    };
  }

  if (copy.kind === 'corporation-tax') {
    const yearEnd = copy.period.replace(/^Year ending /, '');
    const period = `YE ${formatLongBusinessDate(yearEnd)}`;
    const paymentDue = row('Payment due', '');
    return {
      screenTitle: 'Corporation Tax',
      period,
      headlineBefore: 'Get ',
      headlineAccent: 'Corporation Tax',
      headlineAfter: ` ready for ${period}.`,
      intro: `${paymentDue ? `Payment due ${formatLongBusinessDate(paymentDue)}. ` : ''}The return itself (the CT600) is due within 12 months of year end.`,
      figures: [
        { label: 'Trading profit', value: row('Trading profit') },
        { label: 'Effective CT rate', value: row('Effective Corporation Tax rate') },
        { label: 'Company', value: copy.entityName },
        { label: 'Number', value: row('Company number') },
      ],
      amount: estimatedAmount('Corporation Tax owed', period),
    };
  }

  if (copy.kind === 'confirmation-statement') {
    const period = copy.period;
    const due =
      business.entity?.kind === 'ltd'
        ? confirmationStatementDueDate(business.entity, new Date(copy.generatedAt))
        : '';
    return {
      screenTitle: 'Confirmation Statement',
      period,
      headlineBefore: 'Get the ',
      headlineAccent: period,
      headlineAfter: ' Confirmation Statement ready.',
      intro: `${due ? `Due ${formatLongBusinessDate(due)}. ` : ''}£50 fee to Companies House when you file online.`,
      figures: [
        { label: 'Company', value: row('Company', copy.entityName) },
        { label: 'Number', value: row('Company number') },
        { label: 'Directors', value: row('Directors') },
        { label: 'Shareholders', value: row('Shareholders') },
      ],
      amount: {
        label: 'Filing fee',
        valueMinor: 5_000,
        caption: `From the figures Melo has for ${period}.`,
      },
    };
  }

  if (copy.kind === 'annual-accounts') {
    const yearEnd = copy.period.replace(/^Year ending /, '');
    const period = `YE ${formatLongBusinessDate(yearEnd)}`;
    const due = row('Accounts due', yearEnd);
    return {
      screenTitle: 'Annual accounts',
      period,
      headlineBefore: 'Get annual accounts ready for ',
      headlineAccent: period,
      headlineAfter: '.',
      intro: `Due ${formatLongBusinessDate(due)}. Micro-entity accounts to Companies House.`,
      figures: [
        { label: 'Company', value: copy.entityName },
        { label: 'Number', value: row('Company number') },
        { label: 'Year end', value: formatLongBusinessDate(yearEnd) },
        { label: 'Trading profit', value: formatMinor(business.ytdProfitMinor) },
      ],
    };
  }

  const periodEnd = copy.period.replace(/^Period ending /, '');
  const period = `Period ending ${formatLongBusinessDate(periodEnd)}`;
  return {
    screenTitle: 'Payroll',
    period,
    headlineBefore: 'Get ',
    headlineAccent: 'payroll',
    headlineAfter: ` ready for ${formatLongBusinessDate(periodEnd)}.`,
    intro: 'Based on the latest saved payroll run.',
    figures: copy.rows,
    amount: estimatedAmount('PAYE, NI and student loans', period),
  };
}

function humanBusinessPeriod(startIso: string, endIso: string): string {
  const start = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${endIso}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()))
    return `${startIso}—${endIso}`;
  const month = (date: Date) =>
    date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  return start.getUTCFullYear() === end.getUTCFullYear()
    ? `${month(start)}—${month(end)} ${end.getUTCFullYear()}`
    : `${month(start)} ${start.getUTCFullYear()}—${month(end)} ${end.getUTCFullYear()}`;
}

function kindForRoute(route: FilingRoute): BusinessFilingKind {
  if (route === 'business-filing-vat') return 'vat';
  if (route === 'business-filing-sa') return 'self-assessment';
  if (route === 'business-filing-ct') return 'corporation-tax';
  if (route === 'business-filing-payroll') return 'payroll';
  if (route === 'business-filing-cs') return 'confirmation-statement';
  return 'annual-accounts';
}

function formatLongBusinessDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
        year: 'numeric',
      })
    : iso;
}

function filingLabel(kind: BusinessFilingKind): string {
  if (kind === 'vat') return 'VAT return';
  if (kind === 'self-assessment') return 'Self-Assessment';
  if (kind === 'corporation-tax') return 'Corporation Tax';
  if (kind === 'confirmation-statement') return 'Confirmation Statement';
  if (kind === 'annual-accounts') return 'Annual accounts';
  return 'Payroll';
}

function missingCopyReason(
  kind: BusinessFilingKind,
  entityKind: 'sole-trader' | 'ltd' | null,
): string {
  if (kind === 'vat') return 'VAT registration and an open return are required first.';
  if (!entityKind) return 'The business type is required first.';
  if (kind === 'self-assessment' && entityKind !== 'sole-trader') {
    return 'Self-Assessment is shown for a Sole Trader workspace.';
  }
  if (
    ['corporation-tax', 'confirmation-statement', 'annual-accounts'].includes(kind) &&
    entityKind !== 'ltd'
  ) {
    return 'This working copy belongs to a Limited Company workspace.';
  }
  return 'The saved business figures are not complete yet.';
}

const styles = StyleSheet.create({
  annualRoot: { flex: 1 },
  annualHeader: { alignItems: 'center', flexDirection: 'row' },
  annualBack: {
    alignItems: 'flex-start',
    bottom: 14,
    height: 44,
    justifyContent: 'center',
    left: 16,
    position: 'absolute',
    width: 44,
  },
  annualBackLabel: { fontFamily: weightFamily(400), fontSize: 22 },
  annualScreenTitle: { fontFamily: weightFamily(600), fontSize: 16, marginLeft: 76 },
  annualContent: { paddingHorizontal: gap.xl, paddingTop: gap.xs },
  annualEyebrow: {
    fontFamily: weightFamily(400),
    fontSize: 11,
    letterSpacing: 1.54,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  annualHeadline: {
    fontFamily: serif.display,
    fontSize: 20,
    letterSpacing: -0.4,
    lineHeight: 25,
    marginTop: gap.sm,
  },
  annualIntro: {
    fontFamily: weightFamily(400),
    fontSize: 14,
    lineHeight: 21,
    marginTop: 22,
  },
  filingAmount: { marginTop: 30 },
  filingAmountValue: {
    fontFamily: serif.display,
    fontSize: 40,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
    lineHeight: 46,
    marginTop: 4,
  },
  filingAmountCaption: {
    fontFamily: weightFamily(400),
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  annualSection: { marginTop: 22 },
  annualSectionTitle: {
    fontFamily: weightFamily(600),
    fontSize: 16,
    lineHeight: 22,
    marginTop: 5,
  },
  annualFigures: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 15,
    paddingHorizontal: gap.lg,
  },
  annualFigureRow: { alignItems: 'center', flexDirection: 'row', minHeight: 46.5 },
  annualFigureLabel: {
    flex: 1,
    fontFamily: weightFamily(400),
    fontSize: 14,
    lineHeight: 20,
    paddingRight: gap.md,
    transform: [{ translateY: -2 }],
  },
  annualFigureValue: {
    fontFamily: weightFamily(400),
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    lineHeight: 20,
    maxWidth: '64%',
    textAlign: 'right',
    transform: [{ translateY: -2 }],
  },
  annualActions: { marginTop: 42 },
  annualConfirmation: {
    alignItems: 'flex-start',
    borderRadius: 18,
    flexDirection: 'row',
    padding: gap.lg,
  },
  annualCheckbox: {
    alignItems: 'center',
    borderRadius: 2,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    marginTop: 2,
    width: 20,
  },
  annualCheck: { fontFamily: weightFamily(600), fontSize: 13 },
  annualConfirmationLabel: {
    flex: 1,
    fontFamily: weightFamily(400),
    fontSize: 14,
    lineHeight: 20,
    marginLeft: gap.md,
  },
  annualPrimary: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: gap.md,
    minHeight: 48,
    paddingHorizontal: gap.lg,
  },
  annualPrimaryLabel: { fontFamily: weightFamily(600), fontSize: 14 },
  annualDisclaimer: {
    fontFamily: weightFamily(400),
    fontSize: 11,
    lineHeight: 17,
    marginTop: gap.md,
  },
  filingsEmptyRoot: { flex: 1 },
  filingsEmptyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  filingsEmptyBack: {
    alignItems: 'flex-start',
    bottom: 14,
    height: 44,
    justifyContent: 'center',
    left: 16,
    position: 'absolute',
    width: 44,
  },
  filingsEmptyBackLabel: { fontFamily: weightFamily(400), fontSize: 24 },
  filingsEmptyScreenTitle: { fontFamily: weightFamily(600), fontSize: 16 },
  filingsEmptyContent: { paddingHorizontal: gap.xl, paddingTop: gap.xs },
  filingsEmptyHero: { marginTop: 0 },
  filingsEmptyEyebrow: {
    fontFamily: weightFamily(400),
    fontSize: 11,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
  },
  filingsEmptyHeadline: {
    fontFamily: serif.display,
    fontSize: 28,
    letterSpacing: -0.56,
    lineHeight: 32,
    marginTop: gap.sm,
  },
  filingsEmptyWhy: {
    fontFamily: weightFamily(400),
    fontSize: 14,
    lineHeight: 20,
    marginTop: gap.md,
  },
  filingsEmptyPanel: {
    borderRadius: 18,
    marginTop: gap.xl,
    paddingHorizontal: 20,
    paddingVertical: gap.xl,
  },
  filingsEmptyPerch: { height: 112, marginBottom: gap.xs, width: 112 },
  filingsEmptyPanelTitle: {
    fontFamily: serif.display,
    fontSize: 20,
    letterSpacing: -0.4,
    lineHeight: 25,
    maxWidth: 280,
  },
  filingsEmptyPanelBody: {
    fontFamily: weightFamily(400),
    fontSize: 14,
    lineHeight: 23,
    marginTop: gap.sm,
    maxWidth: 300,
  },
  filingsEmptyAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    marginTop: gap.lg,
    paddingHorizontal: gap.lg,
  },
  filingsEmptyActionLabel: { fontFamily: weightFamily(500), fontSize: 14 },
  section: { marginTop: gap.xl },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBody: { fontSize: 12.5, lineHeight: 18, marginTop: gap.xs },
  recordRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 58,
    paddingVertical: gap.sm,
  },
  recordCopy: { flex: 1, paddingRight: gap.md },
  recordTitle: { fontSize: 13.5, fontWeight: '600' },
  recordMeta: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  recordMoney: { fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '600' },
  error: { borderRadius: 12, marginTop: gap.md, padding: gap.md },
  errorText: { fontSize: 12, lineHeight: 17 },
});
