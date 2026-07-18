import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import {
  UK_BUSINESS_POLICY_2026_27,
  annualAccountsDueDate,
  confirmationStatementDueDate,
  corporationTaxDueDate,
  corporationTaxMinor,
  distributableReservesMinor,
  dividendTaxMinor,
  dlaBalanceMinor,
  effectiveCorporationTaxBasisPoints,
  payrollTotals,
  previewPayrollRun,
  s455EstimateMinor,
  type BusinessDividend,
  type DlaMovement,
  type LtdEntity,
  type PayrollRun,
  type StudentLoanPlan,
} from '@folio/business-workspace';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import { updateBusinessOperations } from '@/folio/store';
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

function LtdGuard({
  nav,
  children,
}: {
  nav: Nav;
  children: (entity: LtdEntity) => ReactNode;
}) {
  const t = useTheme();
  const business = useBusinessOperations();
  if (business.entity?.kind === 'ltd') return <>{children(business.entity)}</>;
  return (
    <BusinessScreenFrame
      eyebrow="Limited Company"
      headline="Set up the company first."
      intro="Corporation Tax, payroll, dividends and Companies House need the legal entity before they can calculate anything real."
      onBack={nav.back}
    >
      <BusinessCard tone="inset">
        <Text style={[styles.emptyBody, { color: t.muted }]}>
          A Sole Trader workspace keeps these tools out of the way.
        </Text>
      </BusinessCard>
      <BusinessPrimaryAction
        label="Open Business type"
        onPress={() => nav.go('business-entity-setup')}
      />
    </BusinessScreenFrame>
  );
}

export function BusinessCorpTaxScreen({ nav }: { nav: Nav }) {
  return <LtdGuard nav={nav}>{(entity) => <CorpTaxBody entity={entity} nav={nav} />}</LtdGuard>;
}

function CorpTaxBody({ nav, entity }: { nav: Nav; entity: LtdEntity }) {
  const t = useTheme();
  const business = useBusinessOperations();
  const [profit, setProfit] = useState((business.ytdProfitMinor / 100).toString());
  const [pot, setPot] = useState((business.ctPotMinor / 100).toString());
  const tax = corporationTaxMinor(business.ytdProfitMinor);
  const rate = effectiveCorporationTaxBasisPoints(business.ytdProfitMinor) / 100;
  const gapMinor = Math.max(0, tax - business.ctPotMinor);
  const save = () => {
    const ytdProfitMinor = parseMinor(profit);
    const ctPotMinor = parseMinor(pot);
    if (ytdProfitMinor === null || ctPotMinor === null) return;
    updateBusinessOperations({
      ytdProfitMinor: Math.max(0, ytdProfitMinor),
      ctPotMinor: Math.max(0, ctPotMinor),
    });
  };

  return (
    <BusinessScreenFrame
      eyebrow={entity.companyName}
      headline="The Corporation Tax pot."
      intro={`Policy ${UK_BUSINESS_POLICY_2026_27.taxYear} · verified ${UK_BUSINESS_POLICY_2026_27.verifiedOn}. The estimate remains tied to this version.`}
      onBack={nav.back}
    >
      <BusinessCard tone="inset">
        <Text style={[styles.kicker, { color: t.muted }]}>Suggested set-aside</Text>
        <Text style={[styles.heroMoney, { color: t.ink }]}>{formatMinor(tax)}</Text>
        <Text style={[styles.heroMeta, { color: t.muted }]}>
          {rate.toFixed(1)}% effective rate · due {formatBusinessDate(corporationTaxDueDate(entity))}
        </Text>
        <View style={[styles.progressTrack, { backgroundColor: t.surface }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: t.calmStrong,
                width: `${Math.min(100, Math.round((business.ctPotMinor / Math.max(1, tax)) * 100))}%`,
              },
            ]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={[styles.progressLabel, { color: t.muted }]}>
            {formatMinor(business.ctPotMinor)} set aside
          </Text>
          <Text style={[styles.progressLabel, { color: t.muted }]}>
            {gapMinor > 0 ? `${formatMinor(gapMinor)} to go` : 'On track'}
          </Text>
        </View>
      </BusinessCard>

      <View style={styles.formSection}>
        <BusinessField
          keyboardType="decimal-pad"
          label="Trading profit year to date"
          onChangeText={setProfit}
          placeholder="0.00"
          value={profit}
        />
        <BusinessField
          keyboardType="decimal-pad"
          label="Amount set aside"
          onChangeText={setPot}
          placeholder="0.00"
          value={pot}
        />
        <BusinessPrimaryAction
          disabled={parseMinor(profit) === null || parseMinor(pot) === null}
          label="Save the current figures"
          onPress={save}
        />
      </View>
      <Text style={[styles.policyNote, { color: t.muted }]}>
        The calculation uses the 19% small-profits rate, 25% main rate and marginal relief between
        £50,000 and £250,000. Associated-company adjustments are not inferred.
      </Text>
      <BusinessSecondaryAction
        label="Prepare CT600 working copy"
        onPress={() => nav.go('business-filing-ct')}
      />
    </BusinessScreenFrame>
  );
}

export function BusinessPayrollScreen({ nav }: { nav: Nav }) {
  return <LtdGuard nav={nav}>{(entity) => <PayrollBody entity={entity} nav={nav} />}</LtdGuard>;
}

function PayrollBody({ nav, entity }: { nav: Nav; entity: LtdEntity }) {
  const t = useTheme();
  const business = useBusinessOperations();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [gross, setGross] = useState('');
  const [plan, setPlan] = useState<StudentLoanPlan | 'none'>('none');
  const periodEnd = endOfCurrentMonth();
  const preview = useMemo(
    () =>
      previewPayrollRun(business.employees, periodEnd, {
        region: entity.taxRegion,
        employmentAllowanceClaimed: business.employmentAllowanceClaimed,
        allowanceUsedYearToDateMinor: business.payrollRuns.reduce(
          (sum, run) => sum + run.employmentAllowanceAppliedMinor,
          0,
        ),
        id: `payroll-${Date.now()}`,
      }),
    [
      business.employees,
      business.employmentAllowanceClaimed,
      business.payrollRuns,
      entity.taxRegion,
      periodEnd,
    ],
  );
  const totals = payrollTotals(preview);

  const addEmployee = () => {
    const grossAnnualMinor = parseMinor(gross);
    if (!name.trim() || grossAnnualMinor === null || grossAnnualMinor <= 0) return;
    const now = new Date().toISOString();
    updateBusinessOperations((state) => ({
      employees: [
        ...state.employees,
        {
          id: `employee-${Date.now()}`,
          name: name.trim(),
          grossAnnualMinor,
          niCategory: 'A',
          studentLoanPlans: plan === 'none' ? [] : [plan],
        },
      ],
      memory:
        state.employees.length === 0
          ? [
              {
                id: `business-memory-employee-${Date.now()}`,
                at: now,
                kind: 'first-employee' as const,
                summary: `${name.trim()} was added to payroll.`,
                reflected: false,
              },
              ...state.memory,
            ].slice(0, 200)
          : state.memory,
    }));
    setName('');
    setGross('');
    setPlan('none');
    setAdding(false);
  };

  const recordRun = () => {
    if (business.employees.length === 0) return;
    const run: PayrollRun = {
      ...preview,
      id: `payroll-${Date.now()}`,
      recordedAt: new Date().toISOString(),
    };
    updateBusinessOperations((state) => ({ payrollRuns: [run, ...state.payrollRuns] }));
  };

  return (
    <>
      <BusinessScreenFrame
        eyebrow={entity.companyName}
        headline="Payroll, month by month."
        intro="A local preview and record of the run. It does not claim an FPS or EPS was sent."
        onBack={nav.back}
      >
        <View style={styles.section}>
          <BusinessSectionTitle title="Employees and directors" value={String(business.employees.length)} />
          <BusinessCard>
            {business.employees.length === 0 ? (
              <Text style={[styles.emptyBody, { color: t.muted }]}>
                No employees on the books yet.
              </Text>
            ) : (
              business.employees.map((employee, index) => (
                <View
                  key={employee.id}
                  style={[
                    styles.listRow,
                    index > 0
                      ? { borderTopColor: t.hairline, borderTopWidth: StyleSheet.hairlineWidth }
                      : undefined,
                  ]}
                >
                  <View style={styles.listCopy}>
                    <Text style={[styles.listTitle, { color: t.ink }]}>{employee.name}</Text>
                    <Text style={[styles.listMeta, { color: t.muted }]}>
                      {formatMinor(employee.grossAnnualMinor)} annual gross
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      updateBusinessOperations((state) => ({
                        employees: state.employees.filter((item) => item.id !== employee.id),
                      }))
                    }
                    style={({ pressed }) => [styles.textAction, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Text style={[styles.textActionLabel, { color: t.muted }]}>Remove</Text>
                  </Pressable>
                </View>
              ))
            )}
          </BusinessCard>
          <BusinessSecondaryAction label="Add someone" onPress={() => setAdding(true)} />
        </View>

        <View
          style={[styles.switchRow, { backgroundColor: t.surface, borderColor: t.hairline }]}
        >
          <View style={styles.switchCopy}>
            <Text style={[styles.switchTitle, { color: t.ink }]}>
              Claim Employment Allowance
            </Text>
            <Text style={[styles.switchHint, { color: t.muted }]}>
              This is never assumed. Turn it on only if the company is eligible and has chosen to
              claim it.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Claim Employment Allowance"
            onValueChange={(value) =>
              updateBusinessOperations({ employmentAllowanceClaimed: value })
            }
            trackColor={{ false: t.inset, true: t.calmStrong }}
            value={business.employmentAllowanceClaimed}
          />
        </View>

        <View style={styles.section}>
          <BusinessSectionTitle
            title={`Run ending ${formatBusinessDate(periodEnd)}`}
            value="Preview"
          />
          <BusinessCard tone="inset">
            <View style={styles.metrics}>
              <BusinessMetric label="Gross" value={formatMinor(totals.grossMinor)} />
              <BusinessMetric label="Net paid" value={formatMinor(totals.netMinor)} />
              <BusinessMetric label="PAYE / NI / loans" value={formatMinor(totals.payeMinor)} />
            </View>
          </BusinessCard>
          {preview.employees.length > 0 ? (
            <BusinessCard>
              {preview.employees.map((row, index) => {
                const employee = business.employees.find((item) => item.id === row.employeeId);
                return (
                  <View
                    key={row.employeeId}
                    style={[
                      styles.payrollRow,
                      index > 0
                        ? { borderTopColor: t.hairline, borderTopWidth: StyleSheet.hairlineWidth }
                        : undefined,
                    ]}
                  >
                    <Text style={[styles.listTitle, { color: t.ink }]}>
                      {employee?.name ?? 'Employee'}
                    </Text>
                    <View style={styles.payrollMetrics}>
                      <Text style={[styles.payrollMeta, { color: t.muted }]}>
                        Tax {formatMinor(row.incomeTaxMinor, { pence: true })}
                      </Text>
                      <Text style={[styles.payrollMeta, { color: t.muted }]}>
                        NI {formatMinor(row.employeeNiMinor, { pence: true })}
                      </Text>
                      <Text style={[styles.payrollNet, { color: t.ink }]}>
                        Net {formatMinor(row.netMinor, { pence: true })}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </BusinessCard>
          ) : null}
          <BusinessPrimaryAction
            disabled={business.employees.length === 0}
            label="Record this run"
            onPress={recordRun}
          />
        </View>

        {business.payrollRuns.length > 0 ? (
          <View style={styles.section}>
            <BusinessSectionTitle title="Recorded runs" value={String(business.payrollRuns.length)} />
            <BusinessCard>
              {business.payrollRuns.slice(0, 6).map((run, index) => (
                <View
                  key={run.id}
                  style={[
                    styles.listRow,
                    index > 0
                      ? { borderTopColor: t.hairline, borderTopWidth: StyleSheet.hairlineWidth }
                      : undefined,
                  ]}
                >
                  <View style={styles.listCopy}>
                    <Text style={[styles.listTitle, { color: t.ink }]}>
                      {formatBusinessDate(run.periodEnd)}
                    </Text>
                    <Text style={[styles.listMeta, { color: t.muted }]}>
                      {run.employees.length} paid
                    </Text>
                  </View>
                  <Text style={[styles.listMoney, { color: t.ink }]}>
                    {formatMinor(payrollTotals(run).netMinor)}
                  </Text>
                </View>
              ))}
            </BusinessCard>
          </View>
        ) : null}
      </BusinessScreenFrame>

      <BusinessFormSheet
        onClose={() => setAdding(false)}
        onPrimary={addEmployee}
        primaryDisabled={!name.trim() || (parseMinor(gross) ?? 0) <= 0}
        primaryLabel="Add to payroll"
        title="Payroll person"
        visible={adding}
      >
        <BusinessField label="Name" onChangeText={setName} placeholder="Name" value={name} />
        <BusinessField
          keyboardType="decimal-pad"
          label="Annual gross"
          onChangeText={setGross}
          placeholder="0.00"
          value={gross}
        />
        <BusinessChoicePills
          label="Student loan"
          onChange={setPlan}
          options={[
            { id: 'none', label: 'None' },
            { id: '1', label: 'Plan 1' },
            { id: '2', label: 'Plan 2' },
            { id: '4', label: 'Plan 4' },
            { id: '5', label: 'Plan 5' },
            { id: 'postgrad', label: 'Postgrad' },
          ]}
          value={plan}
        />
      </BusinessFormSheet>
    </>
  );
}

export function BusinessDividendsScreen({ nav }: { nav: Nav }) {
  return <LtdGuard nav={nav}>{(entity) => <DividendsBody entity={entity} nav={nav} />}</LtdGuard>;
}

function DividendsBody({ nav, entity }: { nav: Nav; entity: LtdEntity }) {
  const t = useTheme();
  const business = useBusinessOperations();
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [otherIncome, setOtherIncome] = useState('');
  const [shareholderId, setShareholderId] = useState(entity.shareholders[0]?.id ?? '');
  const reserves = distributableReservesMinor(business);
  const requested = parseMinor(amount) ?? 0;
  const other = parseMinor(otherIncome) ?? 0;
  const tax = dividendTaxMinor(requested, other);

  const save = () => {
    if (requested <= 0 || requested > reserves || !shareholderId) return;
    const shareholder = entity.shareholders.find((item) => item.id === shareholderId);
    if (!shareholder) return;
    const dividend: BusinessDividend = {
      id: `dividend-${Date.now()}`,
      shareholderId,
      declaredOn: new Date().toISOString().slice(0, 10),
      totalMinor: requested,
      amountPerShareMinor: Math.round(requested / Math.max(1, shareholder.shares)),
      otherIncomeMinor: other,
    };
    const now = new Date().toISOString();
    updateBusinessOperations((state) => ({
      dividends: [...state.dividends, dividend],
      memory:
        state.dividends.length === 0
          ? [
              {
                id: `business-memory-dividend-${Date.now()}`,
                at: now,
                kind: 'first-dividend' as const,
                summary: `${formatMinor(requested)} was declared for ${shareholder.name}.`,
                reflected: false,
              },
              ...state.memory,
            ].slice(0, 200)
          : state.memory,
    }));
    setAmount('');
    setOtherIncome('');
    setAdding(false);
  };

  return (
    <>
      <BusinessScreenFrame
        eyebrow={entity.companyName}
        headline="Dividends, honestly."
        intro="A dividend can only come from distributable profit after Corporation Tax and earlier dividends."
        onBack={nav.back}
      >
        <BusinessCard tone="inset">
          <View style={styles.metrics}>
            <BusinessMetric label="Distributable" value={formatMinor(reserves)} />
            <BusinessMetric
              label="Paid this period"
              value={formatMinor(
                business.dividends.reduce((sum, item) => sum + item.totalMinor, 0),
              )}
            />
          </View>
        </BusinessCard>

        <View style={styles.section}>
          <BusinessSectionTitle title="Dividend vouchers" value={String(business.dividends.length)} />
          <BusinessCard>
            {business.dividends.length === 0 ? (
              <Text style={[styles.emptyBody, { color: t.muted }]}>No dividends declared.</Text>
            ) : (
              business.dividends.map((dividend, index) => {
                const shareholder = entity.shareholders.find(
                  (item) => item.id === dividend.shareholderId,
                );
                return (
                  <View
                    key={dividend.id}
                    style={[
                      styles.listRow,
                      index > 0
                        ? { borderTopColor: t.hairline, borderTopWidth: StyleSheet.hairlineWidth }
                        : undefined,
                    ]}
                  >
                    <View style={styles.listCopy}>
                      <Text style={[styles.listTitle, { color: t.ink }]}>
                        {shareholder?.name ?? 'Shareholder'}
                      </Text>
                      <Text style={[styles.listMeta, { color: t.muted }]}>
                        {formatBusinessDate(dividend.declaredOn)} ·{' '}
                        {formatMinor(dividend.amountPerShareMinor, { pence: true })}/share
                      </Text>
                    </View>
                    <Text style={[styles.listMoney, { color: t.ink }]}>
                      {formatMinor(dividend.totalMinor)}
                    </Text>
                  </View>
                );
              })
            )}
          </BusinessCard>
        </View>
        <BusinessPrimaryAction label="Declare a dividend" onPress={() => setAdding(true)} />
      </BusinessScreenFrame>

      <BusinessFormSheet
        onClose={() => setAdding(false)}
        onPrimary={save}
        primaryDisabled={requested <= 0 || requested > reserves || !shareholderId}
        primaryLabel={requested > reserves ? 'Not enough in reserves' : 'Record dividend'}
        title="Declare dividend"
        visible={adding}
      >
        <BusinessChoicePills
          label="Shareholder"
          onChange={setShareholderId}
          options={entity.shareholders.map((shareholder) => ({
            id: shareholder.id,
            label: shareholder.name,
          }))}
          value={shareholderId}
        />
        <BusinessField
          keyboardType="decimal-pad"
          label="Amount"
          onChangeText={setAmount}
          placeholder="0.00"
          value={amount}
        />
        <BusinessField
          keyboardType="decimal-pad"
          label="Recipient's other income"
          onChangeText={setOtherIncome}
          placeholder="0.00"
          value={otherIncome}
        />
        {requested > 0 ? (
          <BusinessCard tone="inset">
            <Text style={[styles.kicker, { color: t.muted }]}>Personal dividend tax estimate</Text>
            <Text style={[styles.previewMoney, { color: t.ink }]}>{formatMinor(tax)}</Text>
            <Text style={[styles.heroMeta, { color: t.muted }]}>
              Uses the £500 allowance and 2026/27 dividend rates.
            </Text>
          </BusinessCard>
        ) : null}
      </BusinessFormSheet>
    </>
  );
}

export function BusinessDlaScreen({ nav }: { nav: Nav }) {
  return <LtdGuard nav={nav}>{(entity) => <DlaBody entity={entity} nav={nav} />}</LtdGuard>;
}

function DlaBody({ nav, entity }: { nav: Nav; entity: LtdEntity }) {
  const t = useTheme();
  const business = useBusinessOperations();
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [direction, setDirection] = useState<'take' | 'repay'>('take');
  const balance = dlaBalanceMinor(business);
  const s455 = s455EstimateMinor(business);

  const save = () => {
    const unsigned = parseMinor(amount);
    if (unsigned === null || unsigned <= 0) return;
    const movement: DlaMovement = {
      id: `dla-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      amountMinor: direction === 'take' ? unsigned : -unsigned,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    updateBusinessOperations((state) => ({ dla: [...state.dla, movement] }));
    setAmount('');
    setNote('');
    setDirection('take');
    setAdding(false);
  };

  return (
    <>
      <BusinessScreenFrame
        eyebrow={entity.companyName}
        headline="Director's loan account."
        intro="Positive means the director owes the company. Negative means the company owes the director."
        onBack={nav.back}
      >
        <BusinessCard tone="inset">
          <Text style={[styles.kicker, { color: t.muted }]}>Current balance</Text>
          <Text style={[styles.heroMoney, { color: balance > 0 ? t.repair : t.ink }]}>
            {formatMinor(balance)}
          </Text>
          <Text style={[styles.heroMeta, { color: t.muted }]}>
            {balance > 0
              ? 'Overdrawn · director owes the company'
              : balance < 0
                ? 'In credit · company owes the director'
                : 'Clear balance · nothing owed either way'}
          </Text>
          {balance > 1_000_000 ? (
            <View style={[styles.warning, { backgroundColor: t.repairSoft }]}>
              <Text style={[styles.warningText, { color: t.repairInk }]}>
                Over £10,000. A benefit-in-kind check is needed.
              </Text>
            </View>
          ) : null}
          {balance > 0 ? (
            <Text style={[styles.policyNote, { color: t.muted }]}>
              s455 estimate if still outstanding after the deadline: {formatMinor(s455)}.
            </Text>
          ) : null}
        </BusinessCard>

        <View style={styles.section}>
          <BusinessSectionTitle title="Movements" value={String(business.dla.length)} />
          <BusinessCard>
            {business.dla.length === 0 ? (
              <Text style={[styles.emptyBody, { color: t.muted }]}>
                No money has moved through the loan account.
              </Text>
            ) : (
              [...business.dla].reverse().map((movement, index) => (
                <View
                  key={movement.id}
                  style={[
                    styles.listRow,
                    index > 0
                      ? { borderTopColor: t.hairline, borderTopWidth: StyleSheet.hairlineWidth }
                      : undefined,
                  ]}
                >
                  <View style={styles.listCopy}>
                    <Text style={[styles.listTitle, { color: t.ink }]}>
                      {movement.amountMinor >= 0 ? 'Director took' : 'Director repaid'}
                    </Text>
                    <Text style={[styles.listMeta, { color: t.muted }]}>
                      {formatBusinessDate(movement.date)}
                      {movement.note ? ` · ${movement.note}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.listMoney, { color: t.ink }]}>
                    {formatMinor(movement.amountMinor, { signed: true })}
                  </Text>
                </View>
              ))
            )}
          </BusinessCard>
        </View>
        <BusinessPrimaryAction label="Record a movement" onPress={() => setAdding(true)} />
      </BusinessScreenFrame>

      <BusinessFormSheet
        onClose={() => setAdding(false)}
        onPrimary={save}
        primaryDisabled={(parseMinor(amount) ?? 0) <= 0}
        primaryLabel="Record movement"
        title="Director's loan"
        visible={adding}
      >
        <BusinessChoicePills
          label="Direction"
          onChange={setDirection}
          options={[
            { id: 'take', label: 'Director took' },
            { id: 'repay', label: 'Director repaid' },
          ]}
          value={direction}
        />
        <BusinessField
          keyboardType="decimal-pad"
          label="Amount"
          onChangeText={setAmount}
          placeholder="0.00"
          value={amount}
        />
        <BusinessField
          label="Note · optional"
          onChangeText={setNote}
          placeholder="What the movement was for"
          value={note}
        />
      </BusinessFormSheet>
    </>
  );
}

export function BusinessCompaniesHouseScreen({ nav }: { nav: Nav }) {
  return (
    <LtdGuard nav={nav}>
      {(entity) => <CompaniesHouseBody entity={entity} nav={nav} />}
    </LtdGuard>
  );
}

function CompaniesHouseBody({ nav, entity }: { nav: Nav; entity: LtdEntity }) {
  const t = useTheme();
  const deadlines = [
    {
      label: 'Confirmation Statement',
      hint: 'Annual company-details check',
      date: confirmationStatementDueDate(entity),
      route: 'business-filing-cs' as const,
    },
    {
      label: 'Annual accounts',
      hint: 'Nine months after year end',
      date: annualAccountsDueDate(entity),
      route: 'business-filing-accounts' as const,
    },
    {
      label: 'Corporation Tax',
      hint: 'Payment date',
      date: corporationTaxDueDate(entity),
      route: 'business-filing-ct' as const,
    },
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <BusinessScreenFrame
      eyebrow={entity.companyName}
      headline="What the company owes, and by when."
      intro="Dates are calculated from the saved company year end and incorporation date."
      onBack={nav.back}
    >
      <View style={styles.stack}>
        {deadlines.map((deadline) => (
          <BusinessCard key={deadline.label}>
            <View style={styles.cardHeading}>
              <View style={styles.cardHeadingCopy}>
                <Text style={[styles.cardTitle, { color: t.ink }]}>{deadline.label}</Text>
                <Text style={[styles.cardMeta, { color: t.muted }]}>{deadline.hint}</Text>
              </View>
              <Text style={[styles.deadline, { color: t.ink }]}>
                {formatBusinessDate(deadline.date)}
              </Text>
            </View>
            <BusinessSecondaryAction
              label="Open working copy"
              onPress={() => nav.go(deadline.route)}
            />
          </BusinessCard>
        ))}
      </View>
    </BusinessScreenFrame>
  );
}

function endOfCurrentMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

const styles = StyleSheet.create({
  section: { marginTop: gap.xl },
  stack: { gap: gap.sm },
  formSection: { marginTop: gap.xl },
  metrics: { flexDirection: 'row', gap: gap.md },
  kicker: { fontSize: 10.5, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  heroMoney: {
    fontFamily: serif.display,
    fontSize: 38,
    fontVariant: ['tabular-nums'],
    lineHeight: 44,
    marginTop: gap.xs,
  },
  previewMoney: {
    fontFamily: serif.medium,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    marginTop: gap.xs,
  },
  heroMeta: { fontSize: 11.5, lineHeight: 17, marginTop: gap.xs },
  progressTrack: { borderRadius: 999, height: 7, marginTop: gap.lg, overflow: 'hidden' },
  progressFill: { borderRadius: 999, height: 7 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: gap.sm },
  progressLabel: { fontSize: 10.5 },
  policyNote: { fontSize: 11, lineHeight: 17, marginTop: gap.lg },
  emptyBody: { fontSize: 12.5, lineHeight: 18 },
  listRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 58,
    paddingVertical: gap.sm,
  },
  listCopy: { flex: 1, paddingRight: gap.md },
  listTitle: { fontSize: 13.5, fontWeight: '600' },
  listMeta: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  listMoney: { fontSize: 13.5, fontVariant: ['tabular-nums'], fontWeight: '600' },
  textAction: { minHeight: 36, paddingVertical: gap.sm },
  textActionLabel: { fontSize: 11.5, fontWeight: '600' },
  switchRow: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: gap.xl,
    padding: gap.lg,
  },
  switchCopy: { flex: 1, paddingRight: gap.lg },
  switchTitle: { fontSize: 13.5, fontWeight: '700' },
  switchHint: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  payrollRow: { minHeight: 72, paddingVertical: gap.sm },
  payrollMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm, marginTop: gap.xs },
  payrollMeta: { fontSize: 10.5 },
  payrollNet: { fontSize: 10.5, fontWeight: '700' },
  warning: { borderRadius: radius.md, marginTop: gap.md, padding: gap.md },
  warningText: { fontSize: 11.5, lineHeight: 17 },
  cardHeading: { alignItems: 'flex-start', flexDirection: 'row' },
  cardHeadingCopy: { flex: 1, paddingRight: gap.md },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardMeta: { fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  deadline: {
    fontFamily: serif.medium,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    maxWidth: 110,
    textAlign: 'right',
  },
});
