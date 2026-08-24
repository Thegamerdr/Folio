import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BusinessFilingKind } from '@folio/business-workspace';

import {
  buildBusinessFilingWorkingCopy,
  shareBusinessFilingPdf,
} from '@/folio/lib/businessFilingExport';
import { gap, useTheme } from '@/folio/theme';
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
  const [profit, setProfit] = useState((business.ytdProfitMinor / 100).toString());
  const [transitionRemaining, setTransitionRemaining] = useState(
    business.basisPeriodTransition
      ? (business.basisPeriodTransition.remainingMinor / 100).toString()
      : '',
  );
  const [transitionYears, setTransitionYears] = useState<'1' | '2' | '3' | '4'>(
    String(business.basisPeriodTransition?.yearsLeft ?? 4) as '1' | '2' | '3' | '4',
  );

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

  return (
    <>
      <BusinessScreenFrame
        eyebrow={`${copy.title} · ${copy.period}`}
        headline={`Ready to check for ${copy.authority}.`}
        intro="This is a local working copy. Review the source figures, share the PDF, then record an external reference only after a real submission."
        onBack={nav.back}
      >
        <BusinessCard>
          <Text style={[styles.copyFlag, { color: t.repair }]}>Working copy · not lodged</Text>
          <Text style={[styles.copyEntity, { color: t.ink }]}>{copy.entityName}</Text>
          <View style={styles.copyRows}>
            {copy.rows.map((row, index) => (
              <View
                key={row.label}
                style={[
                  styles.copyRow,
                  index > 0
                    ? { borderTopColor: t.hairline, borderTopWidth: StyleSheet.hairlineWidth }
                    : undefined,
                ]}
              >
                <Text style={[styles.copyLabel, { color: t.muted }]}>{row.label}</Text>
                <Text style={[styles.copyValue, { color: t.ink }]}>{row.value}</Text>
              </View>
            ))}
          </View>
          {copy.amountMinor !== undefined ? (
            <View style={[styles.copyAmount, { backgroundColor: t.inset }]}>
              <Text style={[styles.copyAmountLabel, { color: t.muted }]}>Calculated amount</Text>
              <Text style={[styles.copyAmountValue, { color: t.ink }]}>
                {formatMinor(copy.amountMinor, { pence: true })}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.policy, { color: t.muted }]}>
            Policy {copy.policyPackVersion} · verified {copy.policyVerifiedOn}
          </Text>
        </BusinessCard>

        {shareError ? (
          <View style={[styles.error, { backgroundColor: t.repairSoft }]}>
            <Text style={[styles.errorText, { color: t.repairInk }]}>{shareError}</Text>
          </View>
        ) : null}

        <BusinessPrimaryAction
          disabled={sharing}
          label={sharing ? 'Creating PDF…' : 'Save and share PDF'}
          onPress={() => void share()}
        />
        {copy.kind === 'self-assessment' ? (
          <BusinessSecondaryAction
            label="Edit profit and transition basis"
            onPress={() => setSelfAssessmentOpen(true)}
          />
        ) : null}
        <BusinessSecondaryAction
          label="Record a real external submission"
          onPress={() => setExternalOpen(true)}
        />
      </BusinessScreenFrame>

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

function kindForRoute(route: FilingRoute): BusinessFilingKind {
  if (route === 'business-filing-vat') return 'vat';
  if (route === 'business-filing-sa') return 'self-assessment';
  if (route === 'business-filing-ct') return 'corporation-tax';
  if (route === 'business-filing-payroll') return 'payroll';
  if (route === 'business-filing-cs') return 'confirmation-statement';
  return 'annual-accounts';
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
  copyFlag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  copyEntity: { fontSize: 17, fontWeight: '700', marginTop: gap.sm },
  copyRows: { marginTop: gap.lg },
  copyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 48,
    paddingVertical: gap.xs,
  },
  copyLabel: { flex: 1, fontSize: 12, lineHeight: 17, paddingRight: gap.md },
  copyValue: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    maxWidth: '45%',
    textAlign: 'right',
  },
  copyAmount: { borderRadius: 12, marginTop: gap.lg, padding: gap.md },
  copyAmountLabel: { fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase' },
  copyAmountValue: {
    fontSize: 23,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    marginTop: gap.xs,
  },
  policy: { fontSize: 10.5, lineHeight: 16, marginTop: gap.lg },
  error: { borderRadius: 12, marginTop: gap.md, padding: gap.md },
  errorText: { fontSize: 12, lineHeight: 17 },
});
