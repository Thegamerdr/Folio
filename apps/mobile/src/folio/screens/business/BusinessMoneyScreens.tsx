import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import {
  UK_BUSINESS_POLICY_2026_27,
  analyseVatSchemes,
  businessMonthlyRevenue,
  businessPeriodPnl,
  businessSeasonality,
  businessTaxYearStory,
  businessTopClients,
  businessTopCosts,
  calculateBusinessRunway,
  calculateVatBoxes,
  directorHomeWorkingMinor,
  distributableReservesMinor,
  dlaBalanceMinor,
  homeOfficeConfigMinor,
  homeOfficeFullMinor,
  homeOfficeSimplifiedMinor,
  invoiceAgingBucket,
  mileageAllowanceMinor,
  outstandingInvoiceMinor,
  totalOutstandingInvoicesMinor,
  currentBusinessTaxYear,
  type BusinessInsightsPeriod,
  type BusinessInvoice,
  type BusinessMonthPoint,
  type BusinessObligation,
  type HomeOfficeConfig,
  type MileageTrip,
  type VatScheme,
} from '@folio/business-workspace';
import { addDaysToLocalDate, createLocalDate } from '@folio/domain';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import { currentFinancialDate, updateBusinessOperations, useAppStore } from '@/folio/store';
import { recordPersistedOwnerTransfer, type PersistedOwnerTransferKind } from '@/folio/lib/persist';
import type { Nav } from '@/folio/types';
import {
  BusinessCard,
  BusinessChoicePills,
  BusinessField,
  BusinessFormSheet,
  BusinessMetric,
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

/** Primary Business Money hub from the current product IA. */
export function BusinessMoneyHubScreen({ nav }: { nav: Nav }) {
  const business = useBusinessOperations();
  const accounts = useAppStore((state) => state.accounts ?? []);
  const runway = useMemo(
    () =>
      calculateBusinessRunway(
        business,
        accounts.map((account) => ({
          ...account,
          // Legacy Account.balanceMinor is major-unit data; Business engines use minor units.
          balanceMinor: Math.round(account.balanceMinor * 100),
        })),
      ),
    [accounts, business],
  );
  const outstanding = totalOutstandingInvoicesMinor(business);
  const openVatReturn = business.vatReturns
    .filter((item) => !item.filedExternallyOn)
    .sort((left, right) => left.dueOn.localeCompare(right.dueOn))[0];
  const vatLiability = openVatReturn ? calculateVatBoxes(openVatReturn).box5Minor : null;
  const nextObligation = [...business.obligations].sort((left, right) =>
    left.nextDue.localeCompare(right.nextDue),
  )[0];
  const runwayLabel =
    accounts.length === 0
      ? 'add cash'
      : runway.daysLeft === null
        ? 'steady'
        : runway.daysLeft === 1
          ? '1 day'
          : `${runway.daysLeft} days`;
  const vatLabel =
    business.entity?.vat.registered !== true
      ? 'not registered'
      : vatLiability === null
        ? 'no open return'
        : formatMinor(vatLiability);

  return (
    <BusinessScreenFrame
      eyebrow="Business money"
      headline="The money side of the business."
      intro="Runway, invoices, VAT and recurring outgoings — one tap each."
    >
      <BusinessCard>
        <BusinessRouteRow
          hint="days of runway on current burn"
          label="Cash runway"
          onPress={() => nav.go('business-runway')}
          value={runwayLabel}
        />
        <BusinessRouteRow
          hint="who owes you, and how late"
          label="Invoices"
          onPress={() => nav.go('business-invoices')}
          value={formatMinor(outstanding)}
        />
        <BusinessRouteRow
          hint="pot, boxes 1–9, next due"
          label="VAT return"
          onPress={() => nav.go('business-vat')}
          value={vatLabel}
        />
        <BusinessRouteRow
          hint={
            nextObligation
              ? `Next: ${nextObligation.label} · ${formatBusinessDate(nextObligation.nextDue)}`
              : 'rent, payroll, software and loans'
          }
          label="Recurring money out"
          onPress={() => nav.go('business-obligations')}
        />
        <BusinessRouteRow
          hint="revenue, top clients and tax-year story"
          label="Insights"
          onPress={() => nav.go('business-insights')}
        />
      </BusinessCard>
    </BusinessScreenFrame>
  );
}

export function BusinessRunwayScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const business = useBusinessOperations();
  const accounts = useAppStore((state) => state.accounts ?? []);
  const [movingOwnerMoney, setMovingOwnerMoney] = useState(false);
  const [ownerAmount, setOwnerAmount] = useState('');
  const [ownerKind, setOwnerKind] = useState<PersistedOwnerTransferKind>(
    business.entity?.kind === 'ltd' ? 'dividend' : 'draw',
  );
  const [ownerNote, setOwnerNote] = useState('');
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [ownerError, setOwnerError] = useState('');
  const runway = useMemo(
    () =>
      calculateBusinessRunway(
        business,
        accounts.map((account) => ({
          ...account,
          // Legacy Account.balanceMinor is major-unit data; Business engines are true minor units.
          balanceMinor: Math.round(account.balanceMinor * 100),
        })),
      ),
    [accounts, business],
  );
  const headline =
    accounts.length === 0
      ? 'Add cash to see the runway.'
      : runway.daysLeft === null
        ? 'The cash is steady.'
        : `The cash lasts ${runway.daysLeft === 1 ? '1 day' : `${runway.daysLeft} days`}.`;
  const ownerKinds: readonly Readonly<{ id: PersistedOwnerTransferKind; label: string }>[] =
    business.entity?.kind === 'ltd'
      ? [
          { id: 'salary', label: 'Net salary' },
          { id: 'dividend', label: 'Dividend' },
          { id: 'loan-repayment', label: 'Company repays director' },
          { id: 'capital-contribution', label: 'Capital in' },
        ]
      : [
          { id: 'draw', label: 'Drawing' },
          { id: 'capital-contribution', label: 'Capital in' },
        ];

  const moveOwnerMoney = async () => {
    const amountMinor = parseMinor(ownerAmount);
    if (amountMinor === null || amountMinor <= 0) return;
    setOwnerError('');
    if (ownerKind === 'dividend' && amountMinor > distributableReservesMinor(business)) {
      setOwnerError(
        `You do not have ${formatMinor(amountMinor)} in retained profit yet. Take a smaller amount or run payroll instead.`,
      );
      return;
    }
    if (
      ownerKind === 'dividend' &&
      business.entity?.kind === 'ltd' &&
      business.entity.shareholders.length === 0
    ) {
      setOwnerError('Add a shareholder in Business type before declaring a dividend.');
      return;
    }
    const latestPayroll = [...business.payrollRuns].sort((left, right) =>
      right.periodEnd.localeCompare(left.periodEnd),
    )[0];
    const latestPayrollNet =
      latestPayroll?.employees.reduce((sum, employee) => sum + employee.netMinor, 0) ?? 0;
    if (ownerKind === 'salary' && (latestPayroll === undefined || amountMinor > latestPayrollNet)) {
      setOwnerError(
        latestPayroll === undefined
          ? 'Run payroll first, then move the calculated net salary.'
          : `The latest calculated net payroll is ${formatMinor(latestPayrollNet)}.`,
      );
      return;
    }
    const loanBalance = dlaBalanceMinor(business);
    if (
      ownerKind === 'loan-repayment' &&
      (loanBalance >= 0 || amountMinor > Math.abs(loanBalance))
    ) {
      setOwnerError(
        loanBalance >= 0
          ? 'The company does not currently owe the director.'
          : `The company currently owes the director ${formatMinor(Math.abs(loanBalance))}.`,
      );
      return;
    }
    setOwnerBusy(true);
    try {
      await recordPersistedOwnerTransfer({
        direction:
          ownerKind === 'capital-contribution' ? 'personal-to-business' : 'business-to-personal',
        amount: amountMinor / 100,
        kind: ownerKind,
        ...(ownerNote.trim() ? { note: ownerNote.trim() } : {}),
      });
      const now = new Date().toISOString();
      if (ownerKind === 'dividend') {
        const shareholder =
          business.entity?.kind === 'ltd' ? business.entity.shareholders[0] : undefined;
        if (shareholder) {
          updateBusinessOperations((state) => ({
            dividends: [
              ...state.dividends,
              {
                id: `dividend-owner-transfer-${Date.now()}`,
                shareholderId: shareholder.id,
                declaredOn: now.slice(0, 10),
                totalMinor: amountMinor,
                amountPerShareMinor: Math.round(amountMinor / Math.max(1, shareholder.shares)),
                otherIncomeMinor: 0,
              },
            ],
          }));
        }
      }
      if (ownerKind === 'loan-repayment') {
        updateBusinessOperations((state) => ({
          dla: [
            ...state.dla,
            {
              id: `dla-owner-transfer-${Date.now()}`,
              date: now.slice(0, 10),
              amountMinor,
              note: 'Company repaid director',
            },
          ],
        }));
      }
      setOwnerAmount('');
      setOwnerNote('');
      setMovingOwnerMoney(false);
    } catch (reason: unknown) {
      setOwnerError(reason instanceof Error ? reason.message : 'The move could not be completed.');
    } finally {
      setOwnerBusy(false);
    }
  };

  return (
    <>
      <BusinessScreenFrame
        eyebrow="Cash runway"
        headline={headline}
        intro={`Based on ${formatMinor(runway.cashMinor)} across accounts, ${formatMinor(runway.incoming30Minor)} due in and ${formatMinor(runway.outgoing30Minor)} due out over the next 30 days.`}
        onBack={nav.back}
      >
        <View style={styles.stack}>
          <BusinessCard>
            <View style={styles.cardHeading}>
              <Text style={[styles.cardTitle, { color: t.muted }]}>Cash in hand</Text>
              <Text style={[styles.largeMoney, { color: t.ink }]}>
                {formatMinor(runway.cashMinor)}
              </Text>
            </View>
            <View style={styles.accountList}>
              {accounts.length === 0 ? (
                <Text style={[styles.emptyBody, { color: t.muted }]}>No accounts added yet.</Text>
              ) : (
                accounts.map((account) => (
                  <View key={account.id} style={styles.accountRow}>
                    <Text style={[styles.accountName, { color: t.ink }]}>{account.name}</Text>
                    <Text style={[styles.accountAmount, { color: t.muted }]}>
                      {formatMinor(Math.round(account.balanceMinor * 100))}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </BusinessCard>

          <BusinessCard>
            <BusinessSectionTitle title="30-day picture" value="est." />
            <View style={styles.metrics}>
              <BusinessMetric label="Money in" value={formatMinor(runway.incoming30Minor)} />
              <BusinessMetric label="Money out" value={formatMinor(runway.outgoing30Minor)} />
            </View>
            <Text style={[styles.runwayNote, { color: t.muted }]}>
              {runway.runsOutOn
                ? `At this burn, cash runs out around ${formatBusinessDate(runway.runsOutOn)}.`
                : "Nothing is burning cash faster than it's coming in."}
            </Text>
          </BusinessCard>
        </View>

        <View style={styles.section}>
          <BusinessSectionTitle title="90-day path" value="Projected" />
          <BusinessCard>
            {accounts.length === 0 ? (
              <Text style={[styles.emptyBody, { color: t.muted }]}>
                No cash yet. When money moves, the runway shows here.
              </Text>
            ) : (
              <BusinessForecastPath points={runway.forecast} zeroDate={runway.runsOutOn} />
            )}
            {runway.runsOutOn ? (
              <View style={[styles.warning, { backgroundColor: t.repairSoft }]}>
                <Text style={[styles.warningText, { color: t.repairInk }]}>
                  On the current burn, the balance reaches zero around{' '}
                  {formatBusinessDate(runway.runsOutOn)}.
                </Text>
              </View>
            ) : null}
          </BusinessCard>
        </View>

        <View style={styles.routes}>
          <BusinessRouteRow
            label="See who owes you"
            onPress={() => nav.go('business-invoices')}
            value={formatMinor(totalOutstandingInvoicesMinor(business))}
          />
          <BusinessRouteRow
            label="See what's due out"
            onPress={() => nav.go('business-obligations')}
            value={formatMinor(
              business.obligations.reduce((sum, item) => sum + item.amountMinor, 0),
            )}
          />
        </View>
        {accounts.length === 0 ? (
          <BusinessPrimaryAction label="Add a business account" onPress={() => nav.go('account')} />
        ) : null}
      </BusinessScreenFrame>
      <BusinessFormSheet
        onClose={() => setMovingOwnerMoney(false)}
        onPrimary={() => void moveOwnerMoney()}
        primaryDisabled={ownerBusy || (parseMinor(ownerAmount) ?? 0) <= 0}
        primaryLabel={ownerBusy ? 'Moving…' : 'Confirm both sides'}
        title="Own your work"
        visible={movingOwnerMoney}
      >
        <BusinessChoicePills
          label="Kind"
          onChange={setOwnerKind}
          options={ownerKinds}
          value={ownerKind}
        />
        <BusinessField
          keyboardType="decimal-pad"
          label="Amount"
          onChangeText={setOwnerAmount}
          placeholder="0.00"
          value={ownerAmount}
        />
        <BusinessField
          label="Note · optional"
          onChangeText={setOwnerNote}
          placeholder="What this move was for"
          value={ownerNote}
        />
        {ownerError ? (
          <View style={[styles.warning, { backgroundColor: t.repairSoft }]}>
            <Text style={[styles.warningText, { color: t.repairInk }]}>{ownerError}</Text>
          </View>
        ) : null}
      </BusinessFormSheet>
    </>
  );
}

export function BusinessClientsScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const business = useBusinessOperations();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');

  const summaries = useMemo(
    () =>
      business.clients.map((client) => {
        const invoices = business.invoices.filter((invoice) => invoice.clientId === client.id);
        return {
          client,
          invoiceCount: invoices.length,
          outstandingMinor: invoices.reduce(
            (sum, invoice) => sum + outstandingInvoiceMinor(invoice),
            0,
          ),
          lifetimeMinor: invoices.reduce((sum, invoice) => sum + invoice.totalMinor, 0),
        };
      }),
    [business.clients, business.invoices],
  );

  const save = () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    const client = {
      id: `client-${Date.now()}`,
      name: name.trim(),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      createdAt: now,
    };
    updateBusinessOperations((state) => ({
      clients: [...state.clients, client],
      memory:
        state.clients.length === 0
          ? [
              {
                id: `business-memory-client-${Date.now()}`,
                at: now,
                kind: 'first-client' as const,
                summary: `${client.name} became the first saved client.`,
                reflected: false,
              },
              ...state.memory,
            ].slice(0, 200)
          : state.memory,
    }));
    setName('');
    setEmail('');
    setPhone('');
    setNote('');
    setAdding(false);
  };

  return (
    <>
      <BusinessScreenFrame
        eyebrow="Clients"
        headline={
          summaries.length === 0
            ? 'No clients yet.'
            : `${summaries.length} client${summaries.length === 1 ? '' : 's'}.`
        }
        intro="Names and contact details stay anchored to invoices, so there is one balance per client."
        onBack={nav.back}
      >
        <View style={styles.stack}>
          {summaries.length === 0 ? (
            <BusinessCard tone="inset">
              <Text style={[styles.emptyTitle, { color: t.ink }]}>
                They can arrive with the first invoice.
              </Text>
              <Text style={[styles.emptyBody, { color: t.muted }]}>
                Or add someone now if you already know who you are billing.
              </Text>
            </BusinessCard>
          ) : (
            summaries.map((summary) => (
              <BusinessCard key={summary.client.id}>
                <View style={styles.cardHeading}>
                  <View style={styles.cardHeadingCopy}>
                    <Text style={[styles.cardTitle, { color: t.ink }]}>{summary.client.name}</Text>
                    <Text style={[styles.cardMeta, { color: t.muted }]}>
                      {summary.invoiceCount} invoice{summary.invoiceCount === 1 ? '' : 's'} ·{' '}
                      {formatMinor(summary.lifetimeMinor)} lifetime
                    </Text>
                  </View>
                  <Text style={[styles.cardMoney, { color: t.ink }]}>
                    {formatMinor(summary.outstandingMinor)}
                  </Text>
                </View>
                {summary.client.note ? (
                  <Text style={[styles.note, { color: t.muted }]}>{summary.client.note}</Text>
                ) : null}
              </BusinessCard>
            ))
          )}
        </View>
        <BusinessPrimaryAction label="Add a client" onPress={() => setAdding(true)} />
      </BusinessScreenFrame>
      <BusinessFormSheet
        onClose={() => setAdding(false)}
        onPrimary={save}
        primaryDisabled={!name.trim()}
        primaryLabel="Save client"
        title="New client"
        visible={adding}
      >
        <BusinessField label="Name" onChangeText={setName} placeholder="Client name" value={name} />
        <BusinessField
          keyboardType="email-address"
          label="Email · optional"
          onChangeText={setEmail}
          placeholder="name@business.co.uk"
          value={email}
        />
        <BusinessField
          keyboardType="phone-pad"
          label="Phone · optional"
          onChangeText={setPhone}
          placeholder="Phone number"
          value={phone}
        />
        <BusinessField
          label="Note · optional"
          multiline
          onChangeText={setNote}
          placeholder="How they prefer to be contacted"
          value={note}
        />
      </BusinessFormSheet>
    </>
  );
}

export function BusinessInvoicesScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const business = useBusinessOperations();
  const [adding, setAdding] = useState(false);
  const [clientName, setClientName] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [issuedOn, setIssuedOn] = useState(todayIso());
  const [dueOn, setDueOn] = useState(addDaysIso(30));

  const open = business.invoices.filter((invoice) => outstandingInvoiceMinor(invoice) > 0);
  const buckets = (['current', '1-30', '31-60', '61-90', '90+'] as const)
    .map((bucket) => ({
      bucket,
      invoices: open.filter((invoice) => invoiceAgingBucket(invoice) === bucket),
    }))
    .filter((row) => row.invoices.length > 0);
  const outstanding = totalOutstandingInvoicesMinor(business);

  const save = () => {
    const totalMinor = parseMinor(amount);
    if (!clientName.trim() || totalMinor === null || totalMinor <= 0) return;
    const now = new Date().toISOString();
    const existingClient = business.clients.find(
      (client) => client.name.toLocaleLowerCase() === clientName.trim().toLocaleLowerCase(),
    );
    const client =
      existingClient ??
      ({
        id: `client-${Date.now()}`,
        name: clientName.trim(),
        createdAt: now,
      } as const);
    const invoice: BusinessInvoice = {
      id: `invoice-${Date.now()}`,
      clientId: client.id,
      clientName: client.name,
      ...(reference.trim() ? { reference: reference.trim() } : {}),
      issuedOn: validIso(issuedOn) ? issuedOn : todayIso(),
      dueOn: validIso(dueOn) ? dueOn : addDaysIso(30),
      totalMinor,
      paidMinor: 0,
      status: 'issued',
    };
    updateBusinessOperations((state) => ({
      clients: existingClient ? state.clients : [...state.clients, client],
      invoices: [...state.invoices, invoice],
      memory:
        state.invoices.length === 0
          ? [
              {
                id: `business-memory-invoice-${Date.now()}`,
                at: now,
                kind: 'first-invoice' as const,
                summary: `The first invoice was issued to ${client.name}.`,
                reflected: false,
              },
              ...state.memory,
            ].slice(0, 200)
          : state.memory,
    }));
    setClientName('');
    setAmount('');
    setReference('');
    setIssuedOn(todayIso());
    setDueOn(addDaysIso(30));
    setAdding(false);
  };

  const markPaid = (invoice: BusinessInvoice) => {
    const now = new Date().toISOString();
    updateBusinessOperations((state) => ({
      invoices: state.invoices.map((item) =>
        item.id === invoice.id
          ? {
              ...item,
              paidMinor: item.totalMinor,
              paidOn: todayIso(),
              status: 'paid' as const,
            }
          : item,
      ),
      memory: [
        {
          id: `business-memory-paid-${invoice.id}`,
          at: now,
          kind: 'invoice-paid' as const,
          summary: `${invoice.clientName} paid ${formatMinor(invoice.totalMinor)}.`,
          reflected: false,
        },
        ...state.memory.filter((entry) => entry.id !== `business-memory-paid-${invoice.id}`),
      ].slice(0, 200),
    }));
  };

  return (
    <>
      <BusinessScreenFrame
        eyebrow="Invoices"
        headline={
          outstanding > 0 ? `${formatMinor(outstanding)} owed to you.` : 'Nothing outstanding.'
        }
        intro="Sorted by age. The older it gets, the harder it gets to collect."
        onBack={nav.back}
      >
        <View style={styles.section}>
          {buckets.length === 0 ? (
            <BusinessCard>
              <Text style={[styles.emptyBody, { color: t.muted }]}>
                When you add an invoice, it'll appear here and start aging from its due date.
              </Text>
            </BusinessCard>
          ) : (
            buckets.map((row) => (
              <View key={row.bucket} style={styles.bucket}>
                <BusinessSectionTitle
                  title={agingLabel(row.bucket)}
                  value={formatMinor(
                    row.invoices.reduce(
                      (sum, invoice) => sum + outstandingInvoiceMinor(invoice),
                      0,
                    ),
                  )}
                />
                <BusinessCard>
                  {row.invoices.map((invoice, index) => (
                    <View
                      key={invoice.id}
                      style={[
                        styles.invoiceRow,
                        index > 0
                          ? {
                              borderTopColor: t.hairline,
                              borderTopWidth: StyleSheet.hairlineWidth,
                            }
                          : undefined,
                      ]}
                    >
                      <View style={styles.invoiceCopy}>
                        <Text numberOfLines={1} style={[styles.invoiceClient, { color: t.ink }]}>
                          {invoice.clientName}
                        </Text>
                        <Text style={[styles.invoiceMeta, { color: t.muted }]}>
                          Due {formatBusinessDate(invoice.dueOn)}
                          {invoice.reference ? ` · ${invoice.reference}` : ''}
                        </Text>
                      </View>
                      <View style={styles.invoiceEnd}>
                        <Text style={[styles.invoiceAmount, { color: t.ink }]}>
                          {formatMinor(outstandingInvoiceMinor(invoice))}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => markPaid(invoice)}
                          style={({ pressed }) => [
                            styles.smallAction,
                            { backgroundColor: t.calmSoft, opacity: pressed ? 0.65 : 1 },
                          ]}
                        >
                          <Text style={[styles.smallActionLabel, { color: t.calmStrong }]}>
                            Mark paid
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </BusinessCard>
              </View>
            ))
          )}
        </View>

        <BusinessPrimaryAction label="Add an invoice" onPress={() => setAdding(true)} />
      </BusinessScreenFrame>
      <BusinessFormSheet
        onClose={() => setAdding(false)}
        onPrimary={save}
        primaryDisabled={!clientName.trim() || (parseMinor(amount) ?? 0) <= 0}
        primaryLabel="Save invoice"
        title="New invoice"
        visible={adding}
      >
        <BusinessField
          label="Client"
          onChangeText={setClientName}
          placeholder="Client name"
          value={clientName}
        />
        <BusinessField
          keyboardType="decimal-pad"
          label="Amount"
          onChangeText={setAmount}
          placeholder="0.00"
          value={amount}
        />
        <BusinessField
          label="Reference · optional"
          onChangeText={setReference}
          placeholder="INV-001"
          value={reference}
        />
        <BusinessField
          label="Issued · YYYY-MM-DD"
          onChangeText={setIssuedOn}
          placeholder="2026-07-18"
          value={issuedOn}
        />
        <BusinessField
          label="Due · YYYY-MM-DD"
          onChangeText={setDueOn}
          placeholder="2026-08-17"
          value={dueOn}
        />
      </BusinessFormSheet>
    </>
  );
}

export function BusinessObligationsScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const business = useBusinessOperations();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [nextDue, setNextDue] = useState(addDaysIso(30));
  const [cadence, setCadence] = useState<BusinessObligation['cadence']>('monthly');
  const [category, setCategory] = useState<BusinessObligation['category']>('software');
  const sorted = [...business.obligations].sort((a, b) => a.nextDue.localeCompare(b.nextDue));

  const save = () => {
    const amountMinor = parseMinor(amount);
    if (!label.trim() || amountMinor === null || amountMinor <= 0) return;
    updateBusinessOperations((state) => ({
      obligations: [
        ...state.obligations,
        {
          id: `obligation-${Date.now()}`,
          label: label.trim(),
          amountMinor,
          cadence,
          nextDue: validIso(nextDue) ? nextDue : addDaysIso(30),
          category,
        },
      ],
    }));
    setLabel('');
    setAmount('');
    setNextDue(addDaysIso(30));
    setCadence('monthly');
    setCategory('software');
    setAdding(false);
  };

  return (
    <>
      <BusinessScreenFrame
        eyebrow="Recurring money out"
        headline="What the business owes, on repeat."
        intro="Rent, payroll, software, tax pots, loans. Everything Melo needs to know so the runway is honest."
        onBack={nav.back}
      >
        <View style={styles.stack}>
          {sorted.length === 0 ? (
            <BusinessCard tone="inset">
              <Text style={[styles.emptyTitle, { color: t.ink }]}>Nothing recurring yet.</Text>
              <Text style={[styles.emptyBody, { color: t.muted }]}>
                Nothing on the calendar yet. Add rent, payroll, software — anything that leaves
                regularly.
              </Text>
            </BusinessCard>
          ) : (
            sorted.map((obligation) => (
              <BusinessCard key={obligation.id}>
                <View style={styles.cardHeading}>
                  <View style={styles.cardHeadingCopy}>
                    <Text style={[styles.cardTitle, { color: t.ink }]}>{obligation.label}</Text>
                    <Text style={[styles.cardMeta, { color: t.muted }]}>
                      {obligation.cadence} · next {formatBusinessDate(obligation.nextDue)}
                    </Text>
                  </View>
                  <Text style={[styles.cardMoney, { color: t.ink }]}>
                    {formatMinor(obligation.amountMinor)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    updateBusinessOperations((state) => ({
                      obligations: state.obligations.filter((item) => item.id !== obligation.id),
                    }))
                  }
                  style={({ pressed }) => [styles.removeAction, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[styles.removeLabel, { color: t.muted }]}>Remove</Text>
                </Pressable>
              </BusinessCard>
            ))
          )}
        </View>
        <BusinessPrimaryAction label="Add an obligation" onPress={() => setAdding(true)} />
      </BusinessScreenFrame>
      <BusinessFormSheet
        onClose={() => setAdding(false)}
        onPrimary={save}
        primaryDisabled={!label.trim() || (parseMinor(amount) ?? 0) <= 0}
        primaryLabel="Save"
        title="Add an obligation"
        visible={adding}
      >
        <BusinessField
          label="Label"
          onChangeText={setLabel}
          placeholder="Office rent"
          value={label}
        />
        <BusinessField
          keyboardType="decimal-pad"
          label="Amount"
          onChangeText={setAmount}
          placeholder="0.00"
          value={amount}
        />
        <BusinessField
          label="Next due · YYYY-MM-DD"
          onChangeText={setNextDue}
          placeholder="2026-08-01"
          value={nextDue}
        />
        <BusinessChoicePills
          label="Cadence"
          onChange={setCadence}
          options={[
            { id: 'weekly', label: 'Weekly' },
            { id: 'monthly', label: 'Monthly' },
            { id: 'quarterly', label: 'Quarterly' },
            { id: 'annual', label: 'Annual' },
          ]}
          value={cadence}
        />
        <BusinessChoicePills
          label="Kind"
          onChange={setCategory}
          options={[
            { id: 'rent', label: 'Rent' },
            { id: 'payroll', label: 'Payroll' },
            { id: 'software', label: 'Software' },
            { id: 'tax', label: 'Tax' },
            { id: 'loan', label: 'Loan' },
            { id: 'other', label: 'Other' },
          ]}
          value={category}
        />
      </BusinessFormSheet>
    </>
  );
}

export function BusinessVatScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const business = useBusinessOperations();
  const [adding, setAdding] = useState(false);
  const [schemeOpen, setSchemeOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState(currentQuarter().start);
  const [periodEnd, setPeriodEnd] = useState(currentQuarter().end);
  const [dueOn, setDueOn] = useState(addDaysIso(30));
  const [box1, setBox1] = useState('');
  const [box4, setBox4] = useState('');
  const [box6, setBox6] = useState('');
  const [box7, setBox7] = useState('');
  const currentVat = business.entity?.vat.registered ? business.entity.vat : null;
  const [schemeChoice, setSchemeChoice] = useState<
    Extract<VatScheme, { registered: true }>['scheme']
  >(currentVat?.scheme ?? 'standard');
  const [unpaidSalesVat, setUnpaidSalesVat] = useState('');
  const [unpaidPurchasesVat, setUnpaidPurchasesVat] = useState('');
  const registered = business.entity?.vat.registered === true;
  const openReturn = business.vatReturns
    .filter((item) => !item.filedExternallyOn)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
  const boxes = openReturn ? calculateVatBoxes(openReturn) : null;
  const liability = boxes?.box5Minor ?? 0;
  const daysToDue = openReturn
    ? Math.floor(
        (Date.parse(`${openReturn.dueOn}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`)) /
          86_400_000,
      )
    : null;
  const recentReturns = useMemo(() => {
    // Resolve the workspace day first; UTC below is only leap-safe date-only year arithmetic.
    const cutoff = new Date(`${todayIso()}T00:00:00.000Z`);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    return business.vatReturns.filter((item) => item.periodEnd >= cutoffIso);
  }, [business.vatReturns]);
  const schemeAnalysis = useMemo(() => {
    if (recentReturns.length === 0 || currentVat === null) return null;
    const totals = recentReturns.reduce(
      (sum, item) => {
        const itemBoxes = calculateVatBoxes(item);
        return {
          netSalesMinor: sum.netSalesMinor + itemBoxes.box6Minor,
          outputVatMinor: sum.outputVatMinor + itemBoxes.box1Minor + itemBoxes.box2Minor,
          inputVatMinor: sum.inputVatMinor + itemBoxes.box4Minor,
        };
      },
      { netSalesMinor: 0, outputVatMinor: 0, inputVatMinor: 0 },
    );
    return analyseVatSchemes({
      annualNetSalesMinor: totals.netSalesMinor,
      annualOutputVatMinor: totals.outputVatMinor,
      annualInputVatMinor: totals.inputVatMinor,
      ...(currentVat.flatRateBasisPoints !== undefined
        ? { flatRateBasisPoints: currentVat.flatRateBasisPoints }
        : {}),
      limitedCostTrader: currentVat.limitedCostTrader === true,
      firstYear: isInsideFirstVatYear(currentVat.registeredAt),
      unpaidSalesOutputVatMinor: parseMinor(unpaidSalesVat) ?? 0,
      unpaidPurchasesInputVatMinor: parseMinor(unpaidPurchasesVat) ?? 0,
    });
  }, [currentVat, recentReturns, unpaidPurchasesVat, unpaidSalesVat]);

  if (!registered) {
    return (
      <BusinessScreenFrame
        eyebrow="VAT"
        headline="You're not VAT-registered yet."
        intro="Once turnover crosses £90,000 in any rolling 12 months you must register. Flip it on in Business type when you do."
        onBack={nav.back}
      >
        <BusinessPrimaryAction
          label="Open Business type"
          onPress={() => nav.go('business-entity-setup')}
        />
      </BusinessScreenFrame>
    );
  }

  const saveReturn = () => {
    const output = parseMinor(box1);
    const input = parseMinor(box4);
    const sales = parseMinor(box6);
    const purchases = parseMinor(box7);
    if ([output, input, sales, purchases].some((value) => value === null)) return;
    updateBusinessOperations((state) => ({
      vatReturns: [
        ...state.vatReturns,
        {
          id: `vat-${Date.now()}`,
          periodStart: validIso(periodStart) ? periodStart : currentQuarter().start,
          periodEnd: validIso(periodEnd) ? periodEnd : currentQuarter().end,
          dueOn: validIso(dueOn) ? dueOn : addDaysIso(30),
          box1OutputVatMinor: output!,
          box4InputVatMinor: input!,
          box6SalesExVatMinor: sales!,
          box7PurchasesExVatMinor: purchases!,
        },
      ],
    }));
    setAdding(false);
    setBox1('');
    setBox4('');
    setBox6('');
    setBox7('');
  };

  const addToPot = (amountMinor: number) => {
    updateBusinessOperations((state) => ({ vatPotMinor: state.vatPotMinor + amountMinor }));
  };

  const recordVatScheme = () => {
    if (schemeChoice === 'flat-rate' && schemeAnalysis?.flatRate.appliedRateBasisPoints === null) {
      return;
    }
    updateBusinessOperations((state) => {
      if (!state.entity?.vat.registered) return {};
      return {
        entity: {
          ...state.entity,
          vat: {
            ...state.entity.vat,
            scheme: schemeChoice,
          },
        },
      };
    });
    setSchemeOpen(false);
  };

  return (
    <>
      <BusinessScreenFrame
        eyebrow="VAT return"
        headline={
          liability > 0 ? `You owe about ${formatMinor(liability)}.` : 'Nothing to pay this period.'
        }
        intro={
          daysToDue === null
            ? 'No open return yet — start one when the period ends.'
            : `Return due in ${daysToDue} days.`
        }
        onBack={nav.back}
      >
        <BusinessCard>
          <View style={styles.cardHeading}>
            <View style={styles.cardHeadingCopy}>
              <Text style={[styles.cardTitle, { color: t.ink }]}>VAT pot</Text>
              <Text style={[styles.cardMeta, { color: t.muted }]}>
                {liability > business.vatPotMinor
                  ? `Suggested top-up: ${formatMinor(liability - business.vatPotMinor)} to cover the estimated bill.`
                  : 'The pot covers the bill.'}
              </Text>
            </View>
            <Text style={[styles.largeMoney, { color: t.ink }]}>
              {formatMinor(business.vatPotMinor)}
            </Text>
          </View>
          <View style={styles.vatTopUps}>
            {[10_000, 25_000, 50_000].map((amountMinor) => (
              <Pressable
                accessibilityLabel={`Add ${formatMinor(amountMinor)} to the VAT pot`}
                accessibilityRole="button"
                key={amountMinor}
                onPress={() => addToPot(amountMinor)}
                style={({ pressed }) => [
                  styles.vatTopUp,
                  { backgroundColor: t.inset, opacity: pressed ? 0.62 : 1 },
                ]}
              >
                <Text style={[styles.vatTopUpLabel, { color: t.ink }]}>
                  +{formatMinor(amountMinor)}
                </Text>
              </Pressable>
            ))}
          </View>
        </BusinessCard>

        <View style={styles.section}>
          {openReturn && boxes ? (
            <>
              <BusinessSectionTitle title="Return in progress" value="9 boxes" />
              <BusinessCard>
                {(
                  [
                    ['1', 'Output VAT on sales', boxes.box1Minor],
                    ['2', 'VAT on EU acquisitions (NI)', boxes.box2Minor],
                    ['3', 'Total VAT due (1 + 2)', boxes.box3Minor],
                    ['4', 'VAT reclaimed on purchases', boxes.box4Minor],
                    ['5', 'Net VAT to pay (3 − 4)', boxes.box5Minor],
                    ['6', 'Total sales', boxes.box6Minor],
                    ['7', 'Total purchases', boxes.box7Minor],
                    ['8', 'EU goods sales (NI)', boxes.box8Minor],
                    ['9', 'EU goods purchases (NI)', boxes.box9Minor],
                  ] as const
                ).map(([number, label, value], index) => (
                  <View
                    key={number}
                    style={[
                      styles.vatRow,
                      index > 0
                        ? {
                            borderTopColor: t.hairline,
                            borderTopWidth: StyleSheet.hairlineWidth,
                          }
                        : undefined,
                    ]}
                  >
                    <Text style={[styles.vatNumber, { color: t.muted }]}>{number}</Text>
                    <Text style={[styles.vatLabel, { color: number === '5' ? t.ink : t.muted }]}>
                      {label}
                    </Text>
                    <Text
                      style={[styles.vatValue, { color: number === '5' ? t.calmStrong : t.ink }]}
                    >
                      {formatMinor(value)}
                    </Text>
                  </View>
                ))}
                <Text style={[styles.vatFootnote, { color: t.muted }]}>
                  Filing wires up in the app (Making Tax Digital). Boxes 3 and 5 are calculated.
                  Boxes 2, 8, 9 only apply under the NI protocol.
                </Text>
              </BusinessCard>
              <BusinessPrimaryAction
                label="File this return →"
                onPress={() => nav.go('business-filing-vat')}
              />
            </>
          ) : (
            <BusinessCard>
              <Text style={[styles.emptyTitle, { color: t.ink }]}>No open return</Text>
              <Text style={[styles.emptyBody, { color: t.muted }]}>
                A new return will open at the start of the next VAT quarter.
              </Text>
            </BusinessCard>
          )}
        </View>
      </BusinessScreenFrame>
      <BusinessFormSheet
        onClose={() => setSchemeOpen(false)}
        onPrimary={recordVatScheme}
        primaryDisabled={
          schemeChoice === 'flat-rate' && schemeAnalysis?.flatRate.appliedRateBasisPoints === null
        }
        primaryLabel="Record this scheme"
        title="Which scheme fits?"
        visible={schemeOpen}
      >
        {schemeAnalysis ? (
          <>
            <Text style={[styles.sheetIntro, { color: t.muted }]}>
              Based on {recentReturns.length} recorded return
              {recentReturns.length === 1 ? '' : 's'} in the last 12 months.
            </Text>
            <BusinessCard>
              <SchemeComparisonRow
                label="Standard"
                meta={`${formatBasisPoints(
                  schemeAnalysis.standard.effectiveRateBasisPoints,
                )} effective`}
                value={formatMinor(schemeAnalysis.standard.annualVatDueMinor)}
              />
              <SchemeComparisonRow
                label="Flat Rate"
                meta={
                  !schemeAnalysis.flatRate.eligible
                    ? 'Turnover is over the entry limit'
                    : schemeAnalysis.flatRate.appliedRateBasisPoints === null
                      ? 'Add the HMRC sector rate in Business type'
                      : `${formatBasisPoints(
                          schemeAnalysis.flatRate.appliedRateBasisPoints,
                        )}${schemeAnalysis.flatRate.limitedCostTrader ? ' · limited cost' : ''}`
                }
                value={
                  schemeAnalysis.flatRate.annualVatDueMinor === null
                    ? 'Not set'
                    : formatMinor(schemeAnalysis.flatRate.annualVatDueMinor)
                }
              />
              <SchemeComparisonRow
                label="Cash"
                meta={
                  schemeAnalysis.cash.eligible
                    ? `${formatMinor(
                        Math.abs(schemeAnalysis.cash.cashflowLiftMinor),
                      )} ${schemeAnalysis.cash.cashflowLiftMinor >= 0 ? 'held longer' : 'paid sooner'}`
                    : 'Turnover is over the entry limit'
                }
                value={formatMinor(schemeAnalysis.cash.annualVatDueMinor)}
              />
              <SchemeComparisonRow
                label="Annual"
                meta={schemeAnalysis.annual.eligible ? '9 interim payments' : 'Not eligible'}
                value={`${formatMinor(schemeAnalysis.annual.monthlyInstalmentMinor)}/mo`}
                last
              />
            </BusinessCard>
            <Text style={[styles.schemeReason, { color: t.muted }]}>
              Melo suggests {schemeLabel(schemeAnalysis.recommendation)}. {schemeAnalysis.reason}
            </Text>
          </>
        ) : (
          <Text style={[styles.sheetIntro, { color: t.muted }]}>
            Add a real VAT return first. The comparison will use its reviewed boxes rather than
            estimate VAT from unlabeled bank transactions.
          </Text>
        )}
        <BusinessField
          keyboardType="decimal-pad"
          label="Output VAT on unpaid sales · optional"
          onChangeText={setUnpaidSalesVat}
          placeholder="0.00"
          value={unpaidSalesVat}
        />
        <BusinessField
          keyboardType="decimal-pad"
          label="Input VAT on unpaid purchases · optional"
          onChangeText={setUnpaidPurchasesVat}
          placeholder="0.00"
          value={unpaidPurchasesVat}
        />
        <BusinessChoicePills
          label="Record as current"
          onChange={setSchemeChoice}
          options={[
            { id: 'standard', label: 'Standard' },
            { id: 'cash', label: 'Cash' },
            { id: 'flat-rate', label: 'Flat Rate' },
            { id: 'annual', label: 'Annual' },
          ]}
          value={schemeChoice}
        />
        {schemeChoice === 'flat-rate' &&
        schemeAnalysis?.flatRate.appliedRateBasisPoints === null ? (
          <Text style={[styles.formError, { color: t.repair }]}>
            Add the sector rate in Business type before recording Flat Rate.
          </Text>
        ) : null}
        <Text style={[styles.sheetFootnote, { color: t.muted }]}>
          Recording a choice does not change it with HMRC.
        </Text>
      </BusinessFormSheet>
      <BusinessFormSheet
        onClose={() => setAdding(false)}
        onPrimary={saveReturn}
        primaryDisabled={[box1, box4, box6, box7].some((value) => parseMinor(value) === null)}
        primaryLabel="Save return"
        title="VAT boxes"
        visible={adding}
      >
        <BusinessField
          label="Period starts · YYYY-MM-DD"
          onChangeText={setPeriodStart}
          placeholder="2026-04-01"
          value={periodStart}
        />
        <BusinessField
          label="Period ends · YYYY-MM-DD"
          onChangeText={setPeriodEnd}
          placeholder="2026-06-30"
          value={periodEnd}
        />
        <BusinessField
          label="Due · YYYY-MM-DD"
          onChangeText={setDueOn}
          placeholder="2026-08-07"
          value={dueOn}
        />
        <BusinessField
          keyboardType="decimal-pad"
          label="Box 1 · Output VAT"
          onChangeText={setBox1}
          placeholder="0.00"
          value={box1}
        />
        <BusinessField
          keyboardType="decimal-pad"
          label="Box 4 · Input VAT"
          onChangeText={setBox4}
          placeholder="0.00"
          value={box4}
        />
        <BusinessField
          keyboardType="decimal-pad"
          label="Box 6 · Sales excluding VAT"
          onChangeText={setBox6}
          placeholder="0.00"
          value={box6}
        />
        <BusinessField
          keyboardType="decimal-pad"
          label="Box 7 · Purchases excluding VAT"
          onChangeText={setBox7}
          placeholder="0.00"
          value={box7}
        />
      </BusinessFormSheet>
    </>
  );
}

type BusinessInsightsRange = '90d' | 'tax-year' | 'last-year';

function businessLast90Days(now = new Date()): BusinessInsightsPeriod {
  const end = currentFinancialDate(now);
  return {
    start: addDaysToLocalDate(end, -90),
    end,
    label: 'Last 90 days',
  };
}

function businessLastFullYear(now = new Date()): BusinessInsightsPeriod {
  const year = Number(currentFinancialDate(now).slice(0, 4)) - 1;
  return { start: `${year}-01-01`, end: `${year}-12-31`, label: String(year) };
}

export function BusinessInsightsScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const business = useBusinessOperations();
  const [range, setRange] = useState<BusinessInsightsRange>('tax-year');
  const period = useMemo(() => {
    if (range === '90d') return businessLast90Days();
    if (range === 'last-year') return businessLastFullYear();
    return currentBusinessTaxYear();
  }, [range]);
  const pnl = useMemo(() => businessPeriodPnl(business, period), [business, period]);
  const clients = useMemo(() => businessTopClients(business, 5), [business]);
  const months = useMemo(() => businessMonthlyRevenue(business, 12), [business]);
  const season = useMemo(() => businessSeasonality(months), [months]);
  const taxYear = useMemo(() => businessTaxYearStory(business), [business]);
  const costs = useMemo(() => businessTopCosts(business, 5), [business]);
  const hasInvoices = business.invoices.length > 0;
  const trend =
    season.trend === 'up' ? 'trending up' : season.trend === 'down' ? 'cooling off' : 'steady';

  return (
    <BusinessScreenFrame
      eyebrow="Insights"
      headline={hasInvoices ? `Revenue is ${trend}.` : 'Add an invoice to see the story.'}
      intro="A calm look at what you earned, who you earned it from, and how the year is shaping up."
      onBack={nav.back}
    >
      <View accessibilityRole="tablist" style={styles.insightRange}>
        {(
          [
            { id: 'tax-year', label: 'Tax year' },
            { id: '90d', label: '90 days' },
            { id: 'last-year', label: 'Last year' },
          ] as const
        ).map((option) => {
          const selected = range === option.id;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={option.id}
              onPress={() => setRange(option.id)}
              style={({ pressed }) => [
                styles.insightRangeButton,
                {
                  backgroundColor: selected ? t.ink : t.inset,
                  opacity: pressed ? 0.68 : 1,
                },
              ]}
            >
              <Text style={[styles.insightRangeLabel, { color: selected ? t.canvas : t.muted }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <BusinessCard>
        <BusinessSectionTitle title={period.label} value={`${pnl.paidInvoiceCount} paid`} />
        <View style={[styles.metrics, styles.insightMetrics]}>
          <BusinessMetric label="In" value={formatMinor(pnl.revenueMinor)} />
          <BusinessMetric label="Out" value={formatMinor(pnl.expensesMinor)} />
          <BusinessMetric
            accent={pnl.netMinor >= 0}
            label="Net"
            value={formatMinor(pnl.netMinor)}
          />
        </View>
        {pnl.paidInvoiceCount > 0 ? (
          <Text style={[styles.insightNote, { color: t.muted }]}>
            Average invoice{' '}
            <Text style={{ color: t.ink, fontWeight: '700' }}>
              {formatMinor(pnl.averageInvoiceMinor)}
            </Text>
            .
          </Text>
        ) : null}
      </BusinessCard>

      <BusinessCard>
        <BusinessSectionTitle
          title="Last 12 months"
          {...(season.bestMonth && season.bestMonth.revenueMinor > 0
            ? { value: `Best · ${season.bestMonth.label}` }
            : {})}
        />
        <BusinessRevenueBars points={months} />
        <Text style={[styles.insightNote, { color: t.muted }]}>
          {season.quietMonth &&
          season.quietMonth.revenueMinor > 0 &&
          season.bestMonth &&
          season.bestMonth.key !== season.quietMonth.key
            ? `Quietest month was ${season.quietMonth.label}. Something to plan around.`
            : 'Bars show revenue landed each month.'}
        </Text>
      </BusinessCard>

      <BusinessCard>
        <BusinessSectionTitle title="Top clients" value="by total billed" />
        {clients.length === 0 ? (
          <Text style={[styles.emptyBody, { color: t.muted }]}>
            Send an invoice and clients start showing up here.
          </Text>
        ) : (
          clients.map((client, index) => (
            <View
              key={client.client}
              style={[
                styles.insightRow,
                index > 0
                  ? { borderTopColor: t.hairline, borderTopWidth: StyleSheet.hairlineWidth }
                  : undefined,
              ]}
            >
              <View style={styles.simpleCopy}>
                <Text style={[styles.simpleTitle, { color: t.ink }]}>{client.client}</Text>
                <Text style={[styles.simpleMeta, { color: t.muted }]}>
                  {client.invoiceCount} invoice{client.invoiceCount === 1 ? '' : 's'}
                  {client.outstandingMinor > 0
                    ? ` · ${formatMinor(client.outstandingMinor)} outstanding`
                    : ''}
                </Text>
              </View>
              <Text style={[styles.insightMoney, { color: t.ink }]}>
                {formatMinor(client.paidMinor + client.outstandingMinor)}
              </Text>
            </View>
          ))
        )}
      </BusinessCard>

      <BusinessCard>
        <BusinessSectionTitle
          title={`Tax year ${taxYear.period.label}`}
          value={`${taxYear.progressPct}%`}
        />
        <View style={[styles.insightProgressTrack, { backgroundColor: t.inset }]}>
          <View
            style={[
              styles.insightProgressFill,
              { backgroundColor: t.calm, width: `${taxYear.progressPct}%` },
            ]}
          />
        </View>
        <View style={[styles.metrics, styles.insightMetrics]}>
          <BusinessMetric label="Earned so far" value={formatMinor(taxYear.pnl.revenueMinor)} />
          <BusinessMetric label="On this pace" value={formatMinor(taxYear.projectedRevenueMinor)} />
        </View>
        <Text style={[styles.insightNote, { color: t.muted }]}>
          {taxYear.daysElapsed} of {taxYear.daysTotal} days into the year.
        </Text>
      </BusinessCard>

      <BusinessCard>
        <BusinessSectionTitle title="Where money goes" value="per month · est." />
        {costs.length === 0 ? (
          <Text style={[styles.emptyBody, { color: t.muted }]}>
            Add an obligation and the biggest costs show up here.
          </Text>
        ) : (
          costs.map((cost, index) => (
            <View
              key={cost.category}
              style={[
                styles.insightRow,
                index > 0
                  ? { borderTopColor: t.hairline, borderTopWidth: StyleSheet.hairlineWidth }
                  : undefined,
              ]}
            >
              <View style={styles.simpleCopy}>
                <Text style={[styles.simpleTitle, { color: t.ink }]}>{cost.category}</Text>
                <Text style={[styles.simpleMeta, { color: t.muted }]}>
                  {cost.count} item{cost.count === 1 ? '' : 's'} · {formatMinor(cost.annualMinor)} a
                  year
                </Text>
              </View>
              <Text style={[styles.insightMoney, { color: t.ink }]}>
                {formatMinor(cost.monthlyMinor)}
              </Text>
            </View>
          ))
        )}
      </BusinessCard>

      <BusinessRouteRow label="File a return" onPress={() => nav.go('business-filings')} />
    </BusinessScreenFrame>
  );
}

function BusinessRevenueBars({ points }: { points: readonly BusinessMonthPoint[] }) {
  const t = useTheme();
  const maximum = Math.max(1, ...points.map((point) => point.revenueMinor));
  return (
    <View
      accessibilityLabel="Revenue landed across the last twelve months."
      accessibilityRole="image"
      style={styles.revenueBars}
    >
      {points.map((point) => (
        <View key={point.key} style={styles.revenueBarColumn}>
          <View
            style={[
              styles.revenueBar,
              {
                backgroundColor: point.revenueMinor > 0 ? t.calm : t.inset,
                height: Math.max(4, Math.round((point.revenueMinor / maximum) * 60)),
              },
            ]}
          />
          <Text style={[styles.revenueBarLabel, { color: t.muted }]}>{point.label}</Text>
        </View>
      ))}
    </View>
  );
}

type DeductionKind = 'pension' | 'cis-deduction' | 'other';

export function BusinessDeductionsScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const business = useBusinessOperations();
  const currentHomeOffice = business.homeOfficeConfigs.find(
    (item) => item.taxYear === UK_BUSINESS_POLICY_2026_27.taxYear,
  );
  const [tripOpen, setTripOpen] = useState(false);
  const [homeOfficeOpen, setHomeOfficeOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [ir35Open, setIr35Open] = useState(false);
  const [miles, setMiles] = useState('');
  const [purpose, setPurpose] = useState('');
  const [vehicle, setVehicle] = useState<MileageTrip['vehicle']>('car');
  const [homeOfficeMethod, setHomeOfficeMethod] = useState<'simplified' | 'full'>(
    currentHomeOffice?.method ?? 'simplified',
  );
  const [homeMonthlyHours, setHomeMonthlyHours] = useState(
    String(currentHomeOffice?.simplified.monthlyHours ?? 101),
  );
  const [homeMonths, setHomeMonths] = useState(String(currentHomeOffice?.simplified.months ?? 12));
  const [homeDirectorWeeks, setHomeDirectorWeeks] = useState(
    String(currentHomeOffice?.simplified.directorWeeks ?? 52),
  );
  const [homeRoomsBusiness, setHomeRoomsBusiness] = useState(
    String(currentHomeOffice?.full.roomsBusiness ?? 1),
  );
  const [homeRoomsTotal, setHomeRoomsTotal] = useState(
    String(currentHomeOffice?.full.roomsTotal ?? 4),
  );
  const [homeBusinessHours, setHomeBusinessHours] = useState(
    String(currentHomeOffice?.full.businessHoursPerWeek ?? 20),
  );
  const [homePersonalHours, setHomePersonalHours] = useState(
    String(currentHomeOffice?.full.personalHoursPerWeek ?? 20),
  );
  const [homeCouncil, setHomeCouncil] = useState(minorInput(currentHomeOffice?.full.councilMinor));
  const [homeUtilities, setHomeUtilities] = useState(
    minorInput(currentHomeOffice?.full.utilitiesMinor),
  );
  const [homeRent, setHomeRent] = useState(minorInput(currentHomeOffice?.full.rentMinor));
  const [homeMortgage, setHomeMortgage] = useState(
    minorInput(currentHomeOffice?.full.mortgageInterestMinor),
  );
  const [homeInsurance, setHomeInsurance] = useState(
    minorInput(currentHomeOffice?.full.insuranceMinor),
  );
  const [homeCleaning, setHomeCleaning] = useState(
    minorInput(currentHomeOffice?.full.cleaningMinor),
  );
  const [claimKind, setClaimKind] = useState<DeductionKind>('pension');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimNote, setClaimNote] = useState('');
  const [ir35Client, setIr35Client] = useState('');
  const [ir35Result, setIr35Result] = useState<'inside' | 'outside' | 'undetermined'>(
    'undetermined',
  );
  const [ir35Note, setIr35Note] = useState('');
  const mileage = mileageAllowanceMinor(business.mileageTrips);
  const adjustments = business.taxAdjustments.reduce((sum, item) => sum + item.amountMinor, 0);
  const homeOfficeRecorded =
    business.taxAdjustments.find(
      (item) => item.id === `home-office-${UK_BUSINESS_POLICY_2026_27.taxYear}`,
    )?.amountMinor ?? 0;
  const otherAdjustments = adjustments - homeOfficeRecorded;
  const homeOfficeFull = {
    roomsBusiness: Number(homeRoomsBusiness),
    roomsTotal: Number(homeRoomsTotal),
    businessHoursPerWeek: Number(homeBusinessHours),
    personalHoursPerWeek: Number(homePersonalHours),
    councilMinor: parseMinor(homeCouncil) ?? 0,
    utilitiesMinor: parseMinor(homeUtilities) ?? 0,
    rentMinor: parseMinor(homeRent) ?? 0,
    mortgageInterestMinor: parseMinor(homeMortgage) ?? 0,
    insuranceMinor: parseMinor(homeInsurance) ?? 0,
    cleaningMinor: parseMinor(homeCleaning) ?? 0,
  } satisfies HomeOfficeConfig['full'];
  const simplifiedHomeOfficeMinor =
    business.entity?.kind === 'ltd'
      ? directorHomeWorkingMinor(Number(homeDirectorWeeks))
      : homeOfficeSimplifiedMinor(Number(homeMonthlyHours), Number(homeMonths));
  const fullHomeOfficeMinor = homeOfficeFullMinor(homeOfficeFull);
  const selectedHomeOfficeMinor =
    homeOfficeMethod === 'full' ? fullHomeOfficeMinor : simplifiedHomeOfficeMinor;

  const saveTrip = () => {
    const distance = Number(miles);
    if (!Number.isFinite(distance) || distance <= 0 || !purpose.trim()) return;
    updateBusinessOperations((state) => ({
      mileageTrips: [
        ...state.mileageTrips,
        {
          id: `mileage-${Date.now()}`,
          date: todayIso(),
          distanceMilliMiles: Math.round(distance * 1000),
          vehicle,
          purpose: purpose.trim(),
        },
      ],
    }));
    setMiles('');
    setPurpose('');
    setTripOpen(false);
  };

  const saveClaim = () => {
    const amountMinor = parseMinor(claimAmount);
    if (amountMinor === null || amountMinor <= 0 || !claimNote.trim()) return;
    updateBusinessOperations((state) => ({
      taxAdjustments: [
        ...state.taxAdjustments,
        {
          id: `adjustment-${Date.now()}`,
          date: todayIso(),
          kind: claimKind,
          amountMinor,
          note: claimNote.trim(),
        },
      ],
    }));
    setClaimAmount('');
    setClaimNote('');
    setClaimOpen(false);
  };

  const saveHomeOffice = () => {
    if (selectedHomeOfficeMinor <= 0 || business.entity === null) return;
    const config: HomeOfficeConfig = {
      taxYear: UK_BUSINESS_POLICY_2026_27.taxYear,
      method: homeOfficeMethod,
      simplified: {
        monthlyHours: Math.max(0, Math.round(Number(homeMonthlyHours) || 0)),
        months: Math.max(0, Math.round(Number(homeMonths) || 0)),
        directorWeeks: Math.max(0, Math.round(Number(homeDirectorWeeks) || 0)),
      },
      full: homeOfficeFull,
    };
    const adjustmentId = `home-office-${config.taxYear}`;
    updateBusinessOperations((state) => ({
      homeOfficeConfigs: [
        ...state.homeOfficeConfigs.filter((item) => item.taxYear !== config.taxYear),
        config,
      ],
      taxAdjustments: [
        ...state.taxAdjustments.filter((item) => item.id !== adjustmentId),
        {
          id: adjustmentId,
          date: todayIso(),
          kind: 'home-office' as const,
          amountMinor: homeOfficeConfigMinor(config, business.entity!.kind),
          note: `${config.taxYear} home-office ${
            config.method === 'full'
              ? 'actual costs'
              : business.entity!.kind === 'ltd'
                ? 'director flat rate'
                : 'simplified expense'
          }`,
        },
      ],
    }));
    setHomeOfficeOpen(false);
  };

  const saveIr35 = () => {
    if (!ir35Client.trim()) return;
    updateBusinessOperations((state) => ({
      ir35Assessments: [
        ...state.ir35Assessments,
        {
          id: `ir35-${Date.now()}`,
          clientName: ir35Client.trim(),
          assessedOn: todayIso(),
          result: ir35Result,
          ...(ir35Note.trim() ? { note: ir35Note.trim() } : {}),
        },
      ],
    }));
    setIr35Client('');
    setIr35Result('undetermined');
    setIr35Note('');
    setIr35Open(false);
  };

  return (
    <>
      <BusinessScreenFrame
        eyebrow="Business deductions"
        headline={`${formatMinor(mileage + adjustments)} recorded.`}
        intro="Mileage and tax adjustments stay itemised, dated and exportable. No location tracking runs in the background."
        onBack={nav.back}
      >
        <BusinessCard tone="inset">
          <View style={styles.metrics}>
            <BusinessMetric label="Mileage allowance" value={formatMinor(mileage)} />
            <BusinessMetric label="Home office" value={formatMinor(homeOfficeRecorded)} />
            <BusinessMetric label="Other adjustments" value={formatMinor(otherAdjustments)} />
          </View>
        </BusinessCard>

        <View style={styles.section}>
          <BusinessSectionTitle
            title="Mileage"
            value={`${business.mileageTrips.length} trip${business.mileageTrips.length === 1 ? '' : 's'}`}
          />
          <BusinessCard>
            {business.mileageTrips.length === 0 ? (
              <Text style={[styles.emptyBody, { color: t.muted }]}>
                Trips are manual and require a business purpose.
              </Text>
            ) : (
              business.mileageTrips.map((trip, index) => (
                <View
                  key={trip.id}
                  style={[
                    styles.simpleRow,
                    index > 0
                      ? {
                          borderTopColor: t.hairline,
                          borderTopWidth: StyleSheet.hairlineWidth,
                        }
                      : undefined,
                  ]}
                >
                  <View style={styles.simpleCopy}>
                    <Text style={[styles.simpleTitle, { color: t.ink }]}>{trip.purpose}</Text>
                    <Text style={[styles.simpleMeta, { color: t.muted }]}>
                      {(trip.distanceMilliMiles / 1000).toLocaleString('en-GB')} miles ·{' '}
                      {trip.vehicle}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </BusinessCard>
          <BusinessSecondaryAction label="Add a trip" onPress={() => setTripOpen(true)} />
        </View>

        <View style={styles.section}>
          <BusinessSectionTitle
            title="Home office"
            {...(currentHomeOffice
              ? { value: `${currentHomeOffice.method} · ${currentHomeOffice.taxYear}` }
              : {})}
          />
          <BusinessCard>
            {currentHomeOffice ? (
              <View style={styles.cardHeading}>
                <View style={styles.cardHeadingCopy}>
                  <Text style={[styles.cardTitle, { color: t.ink }]}>
                    {currentHomeOffice.method === 'full' ? 'Actual household costs' : 'Simplified'}
                  </Text>
                  <Text style={[styles.cardMeta, { color: t.muted }]}>
                    The method stays fixed until you choose to review it.
                  </Text>
                </View>
                <Text style={[styles.largeMoney, { color: t.ink }]}>
                  {formatMinor(homeOfficeRecorded)}
                </Text>
              </View>
            ) : (
              <>
                <Text style={[styles.emptyTitle, { color: t.ink }]}>No hours logged.</Text>
                <Text style={[styles.emptyBody, { color: t.muted }]}>
                  Pick simplified or actual once.
                </Text>
              </>
            )}
          </BusinessCard>
          <BusinessSecondaryAction
            label={currentHomeOffice ? 'Review method' : 'Set method'}
            onPress={() => setHomeOfficeOpen(true)}
          />
        </View>

        <View style={styles.section}>
          <BusinessSectionTitle
            title="Adjustments"
            value={String(business.taxAdjustments.length)}
          />
          <BusinessCard>
            {business.taxAdjustments.length === 0 ? (
              <Text style={[styles.emptyBody, { color: t.muted }]}>
                Pension, CIS and other reviewed amounts appear here after you record them.
              </Text>
            ) : (
              business.taxAdjustments.map((claim, index) => (
                <View
                  key={claim.id}
                  style={[
                    styles.simpleRow,
                    index > 0
                      ? {
                          borderTopColor: t.hairline,
                          borderTopWidth: StyleSheet.hairlineWidth,
                        }
                      : undefined,
                  ]}
                >
                  <View style={styles.simpleCopy}>
                    <Text style={[styles.simpleTitle, { color: t.ink }]}>{claim.note}</Text>
                    <Text style={[styles.simpleMeta, { color: t.muted }]}>
                      {claim.kind.replace('-', ' ')} · {formatBusinessDate(claim.date)}
                    </Text>
                  </View>
                  <Text style={[styles.simpleMoney, { color: t.ink }]}>
                    {formatMinor(claim.amountMinor)}
                  </Text>
                </View>
              ))
            )}
          </BusinessCard>
          <BusinessSecondaryAction label="Add an adjustment" onPress={() => setClaimOpen(true)} />
        </View>

        <View style={styles.section}>
          <BusinessSectionTitle
            title="IR35 engagements"
            value={String(business.ir35Assessments.length)}
          />
          <BusinessCard>
            {business.ir35Assessments.length === 0 ? (
              <Text style={[styles.emptyBody, { color: t.muted }]}>
                Record the result of each real status assessment; Melo does not decide it for you.
              </Text>
            ) : (
              business.ir35Assessments.map((assessment, index) => (
                <View
                  key={assessment.id}
                  style={[
                    styles.simpleRow,
                    index > 0
                      ? {
                          borderTopColor: t.hairline,
                          borderTopWidth: StyleSheet.hairlineWidth,
                        }
                      : undefined,
                  ]}
                >
                  <View style={styles.simpleCopy}>
                    <Text style={[styles.simpleTitle, { color: t.ink }]}>
                      {assessment.clientName}
                    </Text>
                    <Text style={[styles.simpleMeta, { color: t.muted }]}>
                      {assessment.result} · {formatBusinessDate(assessment.assessedOn)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </BusinessCard>
          <BusinessSecondaryAction
            label="Record an IR35 result"
            onPress={() => setIr35Open(true)}
          />
        </View>
      </BusinessScreenFrame>

      <BusinessFormSheet
        onClose={() => setTripOpen(false)}
        onPrimary={saveTrip}
        primaryDisabled={!purpose.trim() || Number(miles) <= 0}
        primaryLabel="Save trip"
        title="Business mileage"
        visible={tripOpen}
      >
        <BusinessField
          keyboardType="decimal-pad"
          label="Miles"
          onChangeText={setMiles}
          placeholder="0"
          value={miles}
        />
        <BusinessField
          label="Business purpose"
          onChangeText={setPurpose}
          placeholder="Client site visit"
          value={purpose}
        />
        <BusinessChoicePills
          label="Vehicle"
          onChange={setVehicle}
          options={[
            { id: 'car', label: 'Car' },
            { id: 'van', label: 'Van' },
            { id: 'motorbike', label: 'Motorbike' },
            { id: 'bicycle', label: 'Bicycle' },
          ]}
          value={vehicle}
        />
      </BusinessFormSheet>

      <BusinessFormSheet
        onClose={() => setHomeOfficeOpen(false)}
        onPrimary={saveHomeOffice}
        primaryDisabled={selectedHomeOfficeMinor <= 0 || business.entity === null}
        primaryLabel="Save annual method"
        title={`Home office · ${UK_BUSINESS_POLICY_2026_27.taxYear}`}
        visible={homeOfficeOpen}
      >
        {business.entity === null ? (
          <Text style={[styles.sheetIntro, { color: t.muted }]}>
            Set the Business type first so the right home-working method is used.
          </Text>
        ) : (
          <>
            <BusinessChoicePills
              label="Method"
              onChange={setHomeOfficeMethod}
              options={[
                {
                  id: 'simplified',
                  label: business.entity.kind === 'ltd' ? 'Director flat rate' : 'Simplified',
                },
                { id: 'full', label: 'Actual costs' },
              ]}
              value={homeOfficeMethod}
            />
            <BusinessCard tone="inset">
              <SchemeComparisonRow
                label={business.entity.kind === 'ltd' ? 'Director flat rate' : 'Simplified'}
                meta={
                  business.entity.kind === 'ltd'
                    ? '£6 for each eligible week'
                    : 'Monthly HMRC hours band'
                }
                value={formatMinor(simplifiedHomeOfficeMinor)}
              />
              <SchemeComparisonRow
                label="Actual costs"
                meta="Rooms × business-use time"
                value={formatMinor(fullHomeOfficeMinor)}
                last
              />
            </BusinessCard>
            {fullHomeOfficeMinor - simplifiedHomeOfficeMinor > 10_000 ? (
              <Text style={[styles.schemeReason, { color: t.calmStrong }]}>
                Melo noticed actual costs are more than £100 higher for the year. The choice stays
                with you.
              </Text>
            ) : null}
            {homeOfficeMethod === 'simplified' ? (
              business.entity.kind === 'ltd' ? (
                <BusinessField
                  keyboardType="number-pad"
                  label="Eligible weeks"
                  onChangeText={setHomeDirectorWeeks}
                  placeholder="52"
                  value={homeDirectorWeeks}
                />
              ) : (
                <>
                  <BusinessField
                    keyboardType="number-pad"
                    label="Business hours per month"
                    onChangeText={setHomeMonthlyHours}
                    placeholder="101"
                    value={homeMonthlyHours}
                  />
                  <BusinessField
                    keyboardType="number-pad"
                    label="Months in the tax year"
                    onChangeText={setHomeMonths}
                    placeholder="12"
                    value={homeMonths}
                  />
                </>
              )
            ) : (
              <>
                <BusinessField
                  keyboardType="number-pad"
                  label="Rooms used for work"
                  onChangeText={setHomeRoomsBusiness}
                  placeholder="1"
                  value={homeRoomsBusiness}
                />
                <BusinessField
                  keyboardType="number-pad"
                  label="Eligible rooms in the home"
                  onChangeText={setHomeRoomsTotal}
                  placeholder="4"
                  value={homeRoomsTotal}
                />
                <BusinessField
                  keyboardType="decimal-pad"
                  label="Business hours per week in that room"
                  onChangeText={setHomeBusinessHours}
                  placeholder="20"
                  value={homeBusinessHours}
                />
                <BusinessField
                  keyboardType="decimal-pad"
                  label="Personal hours per week in that room"
                  onChangeText={setHomePersonalHours}
                  placeholder="20"
                  value={homePersonalHours}
                />
                <Text style={[styles.fieldGroupLabel, { color: t.muted }]}>
                  Annual household costs
                </Text>
                <BusinessField
                  keyboardType="decimal-pad"
                  label="Council tax"
                  onChangeText={setHomeCouncil}
                  placeholder="0.00"
                  value={homeCouncil}
                />
                <BusinessField
                  keyboardType="decimal-pad"
                  label="Utilities"
                  onChangeText={setHomeUtilities}
                  placeholder="0.00"
                  value={homeUtilities}
                />
                <BusinessField
                  keyboardType="decimal-pad"
                  label="Rent"
                  onChangeText={setHomeRent}
                  placeholder="0.00"
                  value={homeRent}
                />
                <BusinessField
                  keyboardType="decimal-pad"
                  label="Mortgage interest · not capital"
                  onChangeText={setHomeMortgage}
                  placeholder="0.00"
                  value={homeMortgage}
                />
                <BusinessField
                  keyboardType="decimal-pad"
                  label="Home insurance"
                  onChangeText={setHomeInsurance}
                  placeholder="0.00"
                  value={homeInsurance}
                />
                <BusinessField
                  keyboardType="decimal-pad"
                  label="Cleaning"
                  onChangeText={setHomeCleaning}
                  placeholder="0.00"
                  value={homeCleaning}
                />
              </>
            )}
            <Text style={[styles.sheetFootnote, { color: t.muted }]}>
              Kitchens, bathrooms and hallways do not count as rooms. Melo never switches the method
              automatically.
            </Text>
          </>
        )}
      </BusinessFormSheet>

      <BusinessFormSheet
        onClose={() => setClaimOpen(false)}
        onPrimary={saveClaim}
        primaryDisabled={(parseMinor(claimAmount) ?? 0) <= 0 || !claimNote.trim()}
        primaryLabel="Save adjustment"
        title="Tax adjustment"
        visible={claimOpen}
      >
        <BusinessChoicePills
          label="Kind"
          onChange={setClaimKind}
          options={[
            { id: 'pension', label: 'Pension' },
            { id: 'cis-deduction', label: 'CIS deducted' },
            { id: 'other', label: 'Other' },
          ]}
          value={claimKind}
        />
        <BusinessField
          keyboardType="decimal-pad"
          label="Amount"
          onChangeText={setClaimAmount}
          placeholder="0.00"
          value={claimAmount}
        />
        <BusinessField
          label="What this covers"
          onChangeText={setClaimNote}
          placeholder="Employer pension contribution"
          value={claimNote}
        />
      </BusinessFormSheet>

      <BusinessFormSheet
        onClose={() => setIr35Open(false)}
        onPrimary={saveIr35}
        primaryDisabled={!ir35Client.trim()}
        primaryLabel="Save result"
        title="IR35 status"
        visible={ir35Open}
      >
        <BusinessField
          label="Client or engagement"
          onChangeText={setIr35Client}
          placeholder="Client name"
          value={ir35Client}
        />
        <BusinessChoicePills
          label="Recorded result"
          onChange={setIr35Result}
          options={[
            { id: 'undetermined', label: 'Undetermined' },
            { id: 'outside', label: 'Outside' },
            { id: 'inside', label: 'Inside' },
          ]}
          value={ir35Result}
        />
        <BusinessField
          label="Note · optional"
          multiline
          onChangeText={setIr35Note}
          placeholder="Where the result came from"
          value={ir35Note}
        />
      </BusinessFormSheet>
    </>
  );
}

function SchemeComparisonRow({
  label,
  meta,
  value,
  last = false,
}: {
  label: string;
  meta: string;
  value: string;
  last?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.schemeRow,
        last
          ? undefined
          : {
              borderBottomColor: t.hairline,
              borderBottomWidth: StyleSheet.hairlineWidth,
            },
      ]}
    >
      <View style={styles.schemeCopy}>
        <Text style={[styles.simpleTitle, { color: t.ink }]}>{label}</Text>
        <Text style={[styles.simpleMeta, { color: t.muted }]}>{meta}</Text>
      </View>
      <Text style={[styles.simpleMoney, { color: t.ink }]}>{value}</Text>
    </View>
  );
}

function BusinessForecastPath({
  points,
  zeroDate,
}: {
  points: readonly Readonly<{ date: string; balanceMinor: number }>[];
  zeroDate: string | null;
}) {
  const t = useTheme();
  if (points.length === 0) return null;
  const width = 300;
  const height = 60;
  const minimum = Math.min(0, ...points.map((point) => point.balanceMinor));
  const maximum = Math.max(1, ...points.map((point) => point.balanceMinor));
  const range = maximum - minimum || 1;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const y = (value: number) => height - ((value - minimum) / range) * height;
  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${(index * step).toFixed(1)} ${y(point.balanceMinor).toFixed(1)}`,
    )
    .join(' ');
  const zeroY = y(0);
  const zeroIndex = zeroDate ? points.findIndex((point) => point.date === zeroDate) : -1;
  const stroke = zeroDate ? t.repair : t.calm;

  return (
    <Svg
      accessibilityLabel={
        zeroDate
          ? `Projected balance reaches zero around ${formatBusinessDate(zeroDate)}.`
          : 'Projected balance stays above zero across the next 90 days.'
      }
      accessibilityRole="image"
      height={height}
      style={styles.forecast}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
    >
      <Line
        stroke={t.muted}
        strokeDasharray="3 3"
        strokeOpacity={0.25}
        strokeWidth={1}
        x1={0}
        x2={width}
        y1={zeroY}
        y2={zeroY}
      />
      <Path
        d={path}
        fill="none"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
      {zeroIndex >= 0 ? (
        <Circle
          cx={zeroIndex * step}
          cy={y(points[zeroIndex]!.balanceMinor)}
          fill={t.repair}
          r={2.5}
        />
      ) : null}
    </Svg>
  );
}

function schemeLabel(
  scheme: Extract<VatScheme, { registered: true }>['scheme'] | undefined,
): string {
  if (scheme === 'flat-rate') return 'Flat Rate';
  if (scheme === 'cash') return 'Cash';
  if (scheme === 'annual') return 'Annual';
  return 'Standard';
}

function formatBasisPoints(basisPoints: number): string {
  return `${(basisPoints / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

function isInsideFirstVatYear(registeredAt: string | undefined): boolean {
  if (!registeredAt || !validIso(registeredAt)) return false;
  const started = Date.parse(`${registeredAt}T00:00:00Z`);
  const now = Date.now();
  return started <= now && now < started + 365 * 86_400_000;
}

function minorInput(valueMinor: number | undefined): string {
  return valueMinor && valueMinor > 0 ? String(valueMinor / 100) : '';
}

function agingLabel(bucket: ReturnType<typeof invoiceAgingBucket>): string {
  if (bucket === 'current') return 'Not yet due';
  if (bucket === '1-30') return '1–30 days late';
  if (bucket === '31-60') return '31–60 days late';
  if (bucket === '61-90') return '61–90 days late';
  return 'Over 90 days';
}

function validIso(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function todayIso(): string {
  return currentFinancialDate();
}

function addDaysIso(days: number): string {
  return addDaysToLocalDate(todayIso(), days);
}

function currentQuarter(): { start: string; end: string } {
  const today = createLocalDate(todayIso());
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const quarterStartMonth = Math.floor((month - 1) / 3) * 3;
  // These UTC Dates are deliberate date-only arithmetic after the workspace day is resolved.
  const start = new Date(Date.UTC(year, quarterStartMonth, 1));
  const end = new Date(Date.UTC(year, quarterStartMonth + 3, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const styles = StyleSheet.create({
  section: { marginTop: gap.xl },
  routes: { marginTop: gap.xl },
  stack: { gap: gap.sm },
  metrics: { flexDirection: 'row', gap: gap.md },
  insightRange: { flexDirection: 'row', gap: gap.sm },
  insightRangeButton: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: gap.sm,
  },
  insightRangeLabel: { fontSize: 11.5, fontWeight: '700' },
  insightMetrics: { marginTop: gap.md },
  insightNote: { fontSize: 12, lineHeight: 18, marginTop: gap.md },
  insightRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 58,
    paddingVertical: gap.sm,
  },
  insightMoney: {
    fontFamily: serif.medium,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  insightProgressTrack: {
    borderRadius: 999,
    height: 6,
    marginTop: gap.md,
    overflow: 'hidden',
  },
  insightProgressFill: { borderRadius: 999, height: 6 },
  revenueBars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
    height: 86,
    marginTop: gap.md,
  },
  revenueBarColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    justifyContent: 'flex-end',
  },
  revenueBar: { borderTopLeftRadius: 3, borderTopRightRadius: 3, width: '100%' },
  revenueBarLabel: { fontSize: 9.5 },
  accountList: { gap: gap.xs, marginTop: gap.md },
  accountRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  accountName: { fontSize: 12.5 },
  accountAmount: { fontSize: 12.5, fontVariant: ['tabular-nums'] },
  runwayNote: { fontSize: 12, lineHeight: 18, marginTop: gap.md },
  forecast: { height: 60, marginVertical: gap.md, width: '100%' },
  warning: { borderRadius: radius.md, marginTop: gap.md, padding: gap.md },
  warningText: { fontSize: 12, lineHeight: 18 },
  emptyTitle: { fontFamily: serif.medium, fontSize: 18, lineHeight: 23 },
  emptyBody: { fontSize: 12.5, lineHeight: 18, marginTop: gap.xs },
  cardHeading: { alignItems: 'flex-start', flexDirection: 'row' },
  cardHeadingCopy: { flex: 1, paddingRight: gap.md },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardMeta: { fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  cardMoney: { fontFamily: serif.medium, fontSize: 18, fontVariant: ['tabular-nums'] },
  largeMoney: { fontFamily: serif.medium, fontSize: 23, fontVariant: ['tabular-nums'] },
  note: { fontSize: 12, lineHeight: 18, marginTop: gap.md },
  bucket: { marginBottom: gap.xl },
  invoiceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 66,
    paddingVertical: gap.sm,
  },
  invoiceCopy: { flex: 1, paddingRight: gap.md },
  invoiceClient: { fontSize: 13.5, fontWeight: '600' },
  invoiceMeta: { fontSize: 11, marginTop: 2 },
  invoiceEnd: { alignItems: 'flex-end' },
  invoiceAmount: { fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '600' },
  smallAction: {
    borderRadius: radius.sm,
    marginTop: gap.xs,
    minHeight: 30,
    paddingHorizontal: gap.sm,
    paddingVertical: 6,
  },
  smallActionLabel: { fontSize: 10.5, fontWeight: '700' },
  simpleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 54,
    paddingVertical: gap.sm,
  },
  simpleCopy: { flex: 1, paddingRight: gap.md },
  simpleTitle: { flex: 1, fontSize: 13.5, fontWeight: '600' },
  simpleMeta: { fontSize: 11, marginTop: 2 },
  simpleMoney: { fontSize: 13.5, fontVariant: ['tabular-nums'], fontWeight: '600' },
  removeAction: {
    alignSelf: 'flex-start',
    marginTop: gap.sm,
    minHeight: 36,
    paddingVertical: gap.sm,
  },
  removeLabel: { fontSize: 11.5, fontWeight: '600' },
  inlineForm: { alignItems: 'flex-end', flexDirection: 'row', gap: gap.sm, marginTop: gap.md },
  inlineInput: { flex: 1 },
  inlineAction: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    marginBottom: gap.md,
    minHeight: 48,
    paddingHorizontal: gap.lg,
  },
  inlineActionLabel: { fontSize: 13, fontWeight: '700' },
  vatTopUps: { flexDirection: 'row', gap: gap.sm, marginTop: gap.md },
  vatTopUp: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: gap.sm,
  },
  vatTopUpLabel: { fontSize: 12, fontWeight: '700' },
  vatRow: { alignItems: 'center', flexDirection: 'row', minHeight: 48, paddingVertical: gap.xs },
  vatNumber: { fontSize: 11, width: 24 },
  vatLabel: { flex: 1, fontSize: 12, paddingRight: gap.sm },
  vatValue: { fontSize: 12.5, fontVariant: ['tabular-nums'], fontWeight: '600' },
  vatFootnote: { fontSize: 11, lineHeight: 17, marginTop: gap.md },
  schemeTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.75,
    textTransform: 'uppercase',
  },
  schemeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 58,
    paddingVertical: gap.sm,
  },
  schemeCopy: { flex: 1, paddingRight: gap.md },
  schemeReason: { fontSize: 12.5, lineHeight: 18, marginBottom: gap.lg, marginTop: gap.md },
  sheetIntro: { fontSize: 12.5, lineHeight: 18, marginBottom: gap.md },
  sheetFootnote: { fontSize: 11.5, lineHeight: 17, marginBottom: gap.md },
  formError: { fontSize: 11.5, lineHeight: 17, marginBottom: gap.md },
  fieldGroupLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: gap.sm,
    marginTop: gap.sm,
    textTransform: 'uppercase',
  },
});
