import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { currentFinancialDate, updateBusinessOperations } from '@/folio/store';
import type { Nav } from '@/folio/types';
import {
  BusinessCard,
  BusinessChoicePills,
  BusinessField,
  BusinessFormSheet,
  BusinessMetric,
  BusinessPrimaryAction,
  BusinessScreenFrame,
  BusinessSecondaryAction,
  BusinessSectionTitle,
  formatBusinessDate,
  formatMinor,
  parseMinor,
} from './BusinessUi';
import { useBusinessOperations } from './useBusinessOperations';

function LtdGuard({ nav, children }: { nav: Nav; children: (entity: LtdEntity) => ReactNode }) {
  const t = useTheme();
  const business = useBusinessOperations();
  if (business.entity?.kind === 'ltd') return <>{children(business.entity)}</>;
  return (
    <BusinessScreenFrame
      eyebrow="Limited Company only"
      headline="Set up the company first."
      intro="Corporation Tax, payroll, dividends and Companies House deadlines need the company shape before they can show anything real."
      onBack={nav.back}
    >
      <BusinessCard tone="inset">
        <Text style={[styles.emptyBody, { color: t.muted }]}>
          A Sole Trader workspace keeps these tools out of the way.
        </Text>
      </BusinessCard>
      <BusinessPrimaryAction
        label="Pick a business type"
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
    <BusinessScreenFrame eyebrow={entity.companyName} headline="The tax pot." onBack={nav.back}>
      <BusinessCard>
        <Text style={[styles.kicker, { color: t.muted }]}>Suggested set-aside</Text>
        <Text style={[styles.heroMoney, { color: t.ink }]}>{formatMinor(tax)}</Text>
        <Text style={[styles.heroMeta, { color: t.muted }]}>
          {Math.round(rate)}% of profit so far · pay by{' '}
          {formatBusinessDate(corporationTaxDueDate(entity))}
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
          label="Amount set aside for CT"
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
  const [previewOpen, setPreviewOpen] = useState(false);
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
    setPreviewOpen(false);
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
          <BusinessSectionTitle
            title="Employees & directors on payroll"
            value={String(business.employees.length)}
          />
          <BusinessCard>
            {business.employees.length === 0 ? (
              <Text style={[styles.emptyBody, { color: t.muted }]}>No one on payroll yet.</Text>
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

        <View style={styles.section}>
          <BusinessSectionTitle title="Next payroll run" value={formatBusinessDate(periodEnd)} />
          {!previewOpen ? (
            <BusinessPrimaryAction
              disabled={business.employees.length === 0}
              label="Preview this month's run"
              onPress={() => setPreviewOpen(true)}
            />
          ) : (
            <>
              <BusinessCard>
                <View style={styles.metrics}>
                  <BusinessMetric label="Gross" value={formatMinor(totals.grossMinor)} />
                  <BusinessMetric label="Net paid" value={formatMinor(totals.netMinor)} />
                  <BusinessMetric label="Owed to HMRC" value={formatMinor(totals.payeMinor)} />
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
                            ? {
                                borderTopColor: t.hairline,
                                borderTopWidth: StyleSheet.hairlineWidth,
                              }
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
              <BusinessSecondaryAction label="Cancel" onPress={() => setPreviewOpen(false)} />
              <BusinessPrimaryAction label="Record run" onPress={recordRun} />
            </>
          )}
        </View>

        {business.payrollRuns.length > 0 ? (
          <View style={styles.section}>
            <BusinessSectionTitle title="Last run" />
            <BusinessCard>
              <View style={styles.listRow}>
                <View style={styles.listCopy}>
                  <Text style={[styles.listTitle, { color: t.ink }]}>
                    Period ending {formatBusinessDate(business.payrollRuns[0]!.periodEnd)}
                  </Text>
                  <Text style={[styles.listMeta, { color: t.muted }]}>
                    {business.payrollRuns[0]!.employees.length} paid
                  </Text>
                </View>
                <Text style={[styles.listMoney, { color: t.ink }]}>
                  {formatMinor(payrollTotals(business.payrollRuns[0]!).netMinor)}
                </Text>
              </View>
            </BusinessCard>
          </View>
        ) : null}
        <Text style={[styles.policyNote, { color: t.muted }]}>
          RTI submissions (FPS/EPS) to HMRC are not sent from this preview. This screen shows and
          records what the run would look like.
        </Text>
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
  const [mode, setMode] = useState<'pro-rata' | 'single'>(
    entity.shareholders.length > 1 ? 'pro-rata' : 'single',
  );
  const [shareholderId, setShareholderId] = useState(entity.shareholders[0]?.id ?? '');
  const reserves = distributableReservesMinor(business);
  const requested = parseMinor(amount) ?? 0;
  const other = parseMinor(otherIncome) ?? 0;
  const totalShares = Math.max(
    1,
    entity.shareholders.reduce((sum, shareholder) => sum + shareholder.shares, 0),
  );
  const previewShareholder =
    mode === 'single'
      ? entity.shareholders.find((shareholder) => shareholder.id === shareholderId)
      : [...entity.shareholders].sort((left, right) => right.shares - left.shares)[0];
  const previewAmount =
    mode === 'single' || !previewShareholder
      ? requested
      : Math.round((requested * previewShareholder.shares) / totalShares);
  const tax = dividendTaxMinor(previewAmount, other);
  const splitPreview = entity.shareholders.map((shareholder, index, all) => {
    const prior = all
      .slice(0, index)
      .reduce((sum, item) => sum + Math.round((requested * item.shares) / totalShares), 0);
    const totalMinor =
      index === all.length - 1
        ? Math.max(0, requested - prior)
        : Math.round((requested * shareholder.shares) / totalShares);
    return { shareholder, totalMinor };
  });

  const save = () => {
    if (requested <= 0 || requested > reserves || entity.shareholders.length === 0) return;
    const declaredOn = currentFinancialDate();
    const dividends: readonly BusinessDividend[] =
      mode === 'pro-rata'
        ? splitPreview.map(({ shareholder, totalMinor }, index) => ({
            id: `dividend-${Date.now()}-${index}`,
            shareholderId: shareholder.id,
            declaredOn,
            totalMinor,
            amountPerShareMinor: Math.round(totalMinor / Math.max(1, shareholder.shares)),
            otherIncomeMinor: other,
          }))
        : (() => {
            const shareholder = entity.shareholders.find((item) => item.id === shareholderId);
            if (!shareholder) return [];
            return [
              {
                id: `dividend-${Date.now()}`,
                shareholderId,
                declaredOn,
                totalMinor: requested,
                amountPerShareMinor: Math.round(requested / Math.max(1, shareholder.shares)),
                otherIncomeMinor: other,
              },
            ];
          })();
    if (dividends.length === 0) return;
    const now = new Date().toISOString();
    updateBusinessOperations((state) => ({
      dividends: [...state.dividends, ...dividends],
      memory:
        state.dividends.length === 0
          ? [
              {
                id: `business-memory-dividend-${Date.now()}`,
                at: now,
                kind: 'first-dividend' as const,
                summary:
                  mode === 'pro-rata'
                    ? `${formatMinor(requested)} was declared pro-rata.`
                    : `${formatMinor(requested)} was declared for ${
                        entity.shareholders.find((item) => item.id === shareholderId)?.name ??
                        'a shareholder'
                      }.`,
                reflected: false,
              },
              ...state.memory,
            ].slice(0, 200)
          : state.memory,
    }));
    setAmount('');
    setOtherIncome('');
    setMode(entity.shareholders.length > 1 ? 'pro-rata' : 'single');
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
        <BusinessCard>
          <View style={styles.metrics}>
            <BusinessMetric label="Distributable" value={formatMinor(reserves)} />
            <BusinessMetric
              label="Paid this year"
              value={formatMinor(
                business.dividends.reduce((sum, item) => sum + item.totalMinor, 0),
              )}
            />
          </View>
          <View style={[styles.breakdown, { backgroundColor: t.inset }]}>
            <Text style={[styles.kicker, { color: t.muted }]}>How we got here</Text>
            <BreakdownRow
              label="+ Profit year to date"
              value={formatMinor(business.ytdProfitMinor)}
            />
            <BreakdownRow
              label="− Corporation Tax reserved"
              value={formatMinor(corporationTaxMinor(business.ytdProfitMinor))}
            />
            <BreakdownRow
              label="− Dividends paid this year"
              value={formatMinor(
                business.dividends.reduce((sum, item) => sum + item.totalMinor, 0),
              )}
            />
            <View style={[styles.breakdownTotal, { borderTopColor: t.hairline }]}>
              <Text style={[styles.breakdownTotalLabel, { color: t.ink }]}>= Distributable</Text>
              <Text style={[styles.breakdownTotalValue, { color: t.ink }]}>
                {formatMinor(reserves)}
              </Text>
            </View>
          </View>
          <Text style={[styles.heroMeta, { color: t.muted }]}>
            You can only declare from what's here.
          </Text>
        </BusinessCard>

        <BusinessPrimaryAction label="Declare a dividend" onPress={() => setAdding(true)} />
        <View style={styles.section}>
          <BusinessSectionTitle title="Vouchers" value={String(business.dividends.length)} />
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
      </BusinessScreenFrame>

      <BusinessFormSheet
        onClose={() => setAdding(false)}
        onPrimary={save}
        primaryDisabled={
          requested <= 0 ||
          requested > reserves ||
          (mode === 'single' && !shareholderId) ||
          entity.shareholders.length === 0
        }
        primaryLabel={
          requested > reserves
            ? 'Not enough in reserves'
            : mode === 'pro-rata'
              ? `Declare ${formatMinor(requested)} pro-rata`
              : 'Declare dividend'
        }
        title="Declare dividend"
        visible={adding}
      >
        {entity.shareholders.length > 1 ? (
          <BusinessChoicePills
            label="Distribution"
            onChange={setMode}
            options={[
              { id: 'pro-rata', label: 'Pro-rata · all' },
              { id: 'single', label: 'One shareholder' },
            ]}
            value={mode}
          />
        ) : null}
        {mode === 'single' ? (
          <BusinessChoicePills
            label="To"
            onChange={setShareholderId}
            options={entity.shareholders.map((shareholder) => ({
              id: shareholder.id,
              label: shareholder.name,
            }))}
            value={shareholderId}
          />
        ) : null}
        <BusinessField
          keyboardType="decimal-pad"
          label={mode === 'pro-rata' ? 'Total distribution' : 'Amount'}
          onChangeText={setAmount}
          placeholder="0.00"
          value={amount}
        />
        {mode === 'pro-rata' && requested > 0 ? (
          <BusinessCard tone="inset">
            <Text style={[styles.kicker, { color: t.muted }]}>Split</Text>
            {splitPreview.map(({ shareholder, totalMinor }) => (
              <BreakdownRow
                key={shareholder.id}
                label={`${shareholder.name} · ${Math.round(
                  (shareholder.shares / totalShares) * 100,
                )}%`}
                value={formatMinor(totalMinor)}
              />
            ))}
          </BusinessCard>
        ) : null}
        <BusinessField
          keyboardType="decimal-pad"
          label={
            mode === 'pro-rata'
              ? "Largest shareholder's other income (for tax band)"
              : "Recipient's other income (for tax band)"
          }
          onChangeText={setOtherIncome}
          placeholder="0.00"
          value={otherIncome}
        />
        {requested > 0 ? (
          <BusinessCard tone="inset">
            <Text style={[styles.kicker, { color: t.muted }]}>
              {mode === 'pro-rata' && previewShareholder
                ? `Personal tax · ${previewShareholder.name} (est.)`
                : 'Personal dividend tax (est.)'}
            </Text>
            <Text style={[styles.previewMoney, { color: t.ink }]}>{formatMinor(tax)}</Text>
            <Text style={[styles.heroMeta, { color: t.muted }]}>
              On {formatMinor(previewAmount)} after the £500 allowance.
            </Text>
          </BusinessCard>
        ) : null}
      </BusinessFormSheet>
    </>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={styles.breakdownRow}>
      <Text style={[styles.breakdownLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.breakdownValue, { color: t.ink }]}>{value}</Text>
    </View>
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
      date: currentFinancialDate(),
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
        <BusinessCard>
          <Text style={[styles.kicker, { color: t.muted }]}>Current balance</Text>
          <Text style={[styles.heroMoney, { color: balance > 0 ? t.repair : t.ink }]}>
            {formatMinor(balance)}
          </Text>
          <Text style={[styles.heroMeta, { color: t.muted }]}>
            {balance > 0
              ? 'Overdrawn — the director owes the company.'
              : balance < 0
                ? 'In credit — the company owes the director.'
                : 'Clear balance — nothing owed either way.'}
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
                      {movement.amountMinor >= 0 ? 'Taken' : 'Repaid'}
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
            { id: 'take', label: 'Director takes' },
            { id: 'repay', label: 'Director repays' },
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
    <LtdGuard nav={nav}>{(entity) => <CompaniesHouseBody entity={entity} nav={nav} />}</LtdGuard>
  );
}

function CompaniesHouseBody({ nav, entity }: { nav: Nav; entity: LtdEntity }) {
  const t = useTheme();
  const deadlines = [
    {
      label: 'Confirmation Statement',
      hint: 'Annual filing to Companies House.',
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
      hint: 'Payment due to HMRC (return within 12 months).',
      date: corporationTaxDueDate(entity),
      route: 'business-filing-ct' as const,
    },
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <BusinessScreenFrame
      eyebrow={entity.companyName}
      headline="What the company owes and by when."
      onBack={nav.back}
    >
      <View style={styles.stack}>
        {deadlines.map((deadline) => {
          const days = daysUntil(deadline.date);
          return (
            <BusinessCard key={deadline.label}>
              <View style={styles.cardHeading}>
                <View style={styles.cardHeadingCopy}>
                  <Text style={[styles.cardTitle, { color: t.ink }]}>{deadline.label}</Text>
                  <Text style={[styles.cardMeta, { color: t.muted }]}>{deadline.hint}</Text>
                </View>
                <View style={[styles.dayBadge, { backgroundColor: days < 60 ? t.calm : t.inset }]}>
                  <Text
                    style={[styles.dayBadgeLabel, { color: days < 60 ? t.accentInk : t.muted }]}
                  >
                    {days}d
                  </Text>
                </View>
              </View>
              <Text style={[styles.deadline, { color: t.ink }]}>
                {formatBusinessDate(deadline.date)}
              </Text>
            </BusinessCard>
          );
        })}
      </View>
      <BusinessSecondaryAction
        label="Prepare Confirmation Statement →"
        onPress={() => nav.go('business-filing-cs')}
      />
      <BusinessSecondaryAction
        label="Prepare annual accounts →"
        onPress={() => nav.go('business-filing-accounts')}
      />
      <BusinessPrimaryAction label="Prepare CT600 →" onPress={() => nav.go('business-filing-ct')} />
      <Text style={[styles.policyNote, { color: t.muted }]}>
        Melo brings the numbers. You confirm them, then submit through the official service.
      </Text>
    </BusinessScreenFrame>
  );
}

function endOfCurrentMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

function daysUntil(date: string): number {
  const today = new Date();
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.ceil((Date.parse(`${date}T00:00:00Z`) - start) / 86_400_000);
}

const styles = StyleSheet.create({
  section: { marginTop: gap.xl },
  stack: { gap: gap.sm },
  formSection: { marginTop: gap.xl },
  metrics: { flexDirection: 'row', gap: gap.md },
  breakdown: { borderRadius: radius.md, marginTop: gap.lg, padding: gap.md },
  breakdownRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 26,
  },
  breakdownLabel: { flex: 1, fontSize: 12, paddingRight: gap.md },
  breakdownValue: { fontSize: 12, fontVariant: ['tabular-nums'] },
  breakdownTotal: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: gap.xs,
    paddingTop: gap.sm,
  },
  breakdownTotalLabel: { fontSize: 12.5, fontWeight: '700' },
  breakdownTotalValue: {
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
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
  dayBadge: { borderRadius: 999, paddingHorizontal: gap.sm, paddingVertical: 4 },
  dayBadgeLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  deadline: {
    fontFamily: serif.medium,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    marginTop: gap.md,
  },
});
