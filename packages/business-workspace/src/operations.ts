/**
 * Local Business workspace model and deterministic UK calculations.
 *
 * The existing package boundary deliberately keeps direct filing disabled. These
 * operations power the records, forecasts, preparation and export surfaces that
 * can be completed locally without claiming an HMRC or Companies House transport.
 *
 * Money is always stored as integer minor units. Rates are held in a versioned
 * policy pack so a tax-year change cannot silently alter historical records.
 */

export type TaxRegion = 'england-ni' | 'scotland' | 'wales';
export type StudentLoanPlan = '1' | '2' | '4' | '5' | 'postgrad';

export type VatScheme =
  | Readonly<{ registered: false }>
  | Readonly<{
      registered: true;
      scheme: 'standard' | 'flat-rate' | 'cash' | 'annual';
      number?: string;
      registeredAt?: string;
      flatRateBasisPoints?: number;
      flatRateSectorId?: string;
      flatRateSectorLabel?: string;
      flatRateSourceVersion?: string;
      limitedCostTrader?: boolean;
    }>;

export type BusinessDirector = Readonly<{
  id: string;
  name: string;
  role?: string;
}>;

export type BusinessShareholder = Readonly<{
  id: string;
  name: string;
  shares: number;
  className?: string;
}>;

export type SoleTraderEntity = Readonly<{
  kind: 'sole-trader';
  tradingName?: string;
  utr?: string;
  taxRegion: TaxRegion;
  studentLoanPlans: readonly StudentLoanPlan[];
  vat: VatScheme;
  createdAt: string;
}>;

export type LtdEntity = Readonly<{
  kind: 'ltd';
  companyName: string;
  companyNumber?: string;
  incorporatedOn?: string;
  yearEnd: string;
  taxRegion: TaxRegion;
  directors: readonly BusinessDirector[];
  shareholders: readonly BusinessShareholder[];
  vat: VatScheme;
  payeRef?: string;
  accountsOfficeRef?: string;
  createdAt: string;
}>;

export type BusinessEntity = SoleTraderEntity | LtdEntity;

export type BusinessClient = Readonly<{
  id: string;
  name: string;
  email?: string;
  phone?: string;
  note?: string;
  createdAt: string;
}>;

export type BusinessInvoiceStatus =
  | 'draft'
  | 'issued'
  | 'part-paid'
  | 'paid'
  | 'overdue'
  | 'void'
  | 'credited';

export type BusinessInvoice = Readonly<{
  id: string;
  clientId: string;
  clientName: string;
  reference?: string;
  issuedOn: string;
  dueOn: string;
  totalMinor: number;
  paidMinor: number;
  paidOn?: string;
  status: BusinessInvoiceStatus;
  recurringTemplateId?: string;
}>;

export type BusinessObligation = Readonly<{
  id: string;
  label: string;
  amountMinor: number;
  cadence: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  nextDue: string;
  category: 'rent' | 'payroll' | 'software' | 'tax' | 'loan' | 'other';
}>;

export type PayrollEmployee = Readonly<{
  id: string;
  name: string;
  grossAnnualMinor: number;
  taxCode?: string;
  niCategory?: 'A';
  studentLoanPlans: readonly StudentLoanPlan[];
}>;

export type PayrollRow = Readonly<{
  employeeId: string;
  grossMinor: number;
  incomeTaxMinor: number;
  employeeNiMinor: number;
  studentLoanMinor: number;
  netMinor: number;
}>;

export type PayrollRun = Readonly<{
  id: string;
  periodEnd: string;
  employees: readonly PayrollRow[];
  employerNiMinor: number;
  employmentAllowanceAppliedMinor: number;
  recordedAt: string;
}>;

export type BusinessDividend = Readonly<{
  id: string;
  shareholderId: string;
  declaredOn: string;
  totalMinor: number;
  amountPerShareMinor: number;
  otherIncomeMinor: number;
}>;

export type DlaMovement = Readonly<{
  id: string;
  date: string;
  amountMinor: number;
  note?: string;
}>;

export type VatReturn = Readonly<{
  id: string;
  periodStart: string;
  periodEnd: string;
  dueOn: string;
  box1OutputVatMinor: number;
  box2AcquisitionsVatMinor?: number;
  box4InputVatMinor: number;
  box6SalesExVatMinor: number;
  box7PurchasesExVatMinor: number;
  box8EuSalesMinor?: number;
  box9EuPurchasesMinor?: number;
  filedExternallyOn?: string;
}>;

export type MileageTrip = Readonly<{
  id: string;
  date: string;
  distanceMilliMiles: number;
  vehicle: 'car' | 'van' | 'motorbike' | 'bicycle';
  purpose: string;
}>;

export type BusinessTaxAdjustment = Readonly<{
  id: string;
  date: string;
  kind: 'home-office' | 'pension' | 'cis-deduction' | 'other';
  amountMinor: number;
  note: string;
}>;

export type HomeOfficeConfig = Readonly<{
  taxYear: string;
  method: 'simplified' | 'full';
  simplified: Readonly<{
    monthlyHours: number;
    months: number;
    directorWeeks: number;
  }>;
  full: Readonly<{
    roomsBusiness: number;
    roomsTotal: number;
    businessHoursPerWeek: number;
    personalHoursPerWeek: number;
    councilMinor: number;
    utilitiesMinor: number;
    rentMinor: number;
    mortgageInterestMinor: number;
    insuranceMinor: number;
    cleaningMinor: number;
  }>;
}>;

export type Ir35Assessment = Readonly<{
  id: string;
  clientName: string;
  assessedOn: string;
  result: 'inside' | 'outside' | 'undetermined';
  note?: string;
}>;

export type RecurringInvoiceTemplate = Readonly<{
  id: string;
  clientId: string;
  clientName: string;
  amountMinor: number;
  reference?: string;
  cadence: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual';
  nextIssueOn: string;
  daysToPay: number;
  active: boolean;
}>;

export type BusinessFilingKind =
  | 'vat'
  | 'self-assessment'
  | 'corporation-tax'
  | 'confirmation-statement'
  | 'annual-accounts'
  | 'payroll';

export type BusinessFilingRecord = Readonly<{
  id: string;
  kind: BusinessFilingKind;
  period: string;
  preparedAt: string;
  policyPackVersion: string;
  amountMinor?: number;
  status: 'prepared' | 'submitted-external';
  submittedExternallyAt?: string;
  externalReference?: string;
}>;

export type BusinessMemoryKind =
  | 'entity-created'
  | 'first-client'
  | 'first-invoice'
  | 'invoice-paid'
  | 'runway-crossed-90'
  | 'monthly-revenue-10k'
  | 'vat-registered'
  | 'vat-prepared'
  | 'tax-set-aside'
  | 'first-employee'
  | 'first-dividend'
  | 'dla-cleared';

export type BusinessMemoryEntry = Readonly<{
  id: string;
  at: string;
  kind: BusinessMemoryKind;
  summary: string;
  reflected: boolean;
}>;

export type BusinessOperationsState = Readonly<{
  entity: BusinessEntity | null;
  clients: readonly BusinessClient[];
  invoices: readonly BusinessInvoice[];
  obligations: readonly BusinessObligation[];
  employees: readonly PayrollEmployee[];
  payrollRuns: readonly PayrollRun[];
  dividends: readonly BusinessDividend[];
  dla: readonly DlaMovement[];
  vatReturns: readonly VatReturn[];
  mileageTrips: readonly MileageTrip[];
  taxAdjustments: readonly BusinessTaxAdjustment[];
  homeOfficeConfigs: readonly HomeOfficeConfig[];
  ir35Assessments: readonly Ir35Assessment[];
  recurringInvoices: readonly RecurringInvoiceTemplate[];
  filings: readonly BusinessFilingRecord[];
  memory: readonly BusinessMemoryEntry[];
  basisPeriodTransition: Readonly<{
    remainingMinor: number;
    yearsLeft: 1 | 2 | 3 | 4;
  }> | null;
  ytdProfitMinor: number;
  ctPotMinor: number;
  vatPotMinor: number;
  employmentAllowanceClaimed: boolean;
  policyPackVersion: string;
  policyVerifiedOn: string;
}>;

export type UkBusinessPolicyPack = Readonly<{
  version: string;
  taxYear: '2026/27';
  verifiedOn: string;
  personalAllowanceMinor: number;
  personalAllowanceTaperStartsMinor: number;
  rUkBasicBandMinor: number;
  rUkHigherCeilingMinor: number;
  dividendAllowanceMinor: number;
  dividendRatesBasisPoints: Readonly<{
    basic: number;
    higher: number;
    additional: number;
  }>;
  employeeNi: Readonly<{
    primaryThresholdMinor: number;
    upperEarningsMinor: number;
    mainBasisPoints: number;
    upperBasisPoints: number;
  }>;
  employerNi: Readonly<{
    secondaryThresholdMinor: number;
    basisPoints: number;
    employmentAllowanceMinor: number;
  }>;
  selfEmployedNi: Readonly<{
    smallProfitsThresholdMinor: number;
    voluntaryClass2WeeklyMinor: number;
    lowerProfitsMinor: number;
    upperProfitsMinor: number;
    mainBasisPoints: number;
    upperBasisPoints: number;
  }>;
  studentLoan: Readonly<
    Record<StudentLoanPlan, Readonly<{ thresholdMinor: number; rateBasisPoints: number }>>
  >;
  corporationTax: Readonly<{
    lowerMinor: number;
    upperMinor: number;
    smallRateBasisPoints: number;
    mainRateBasisPoints: number;
    marginalNumerator: number;
    marginalDenominator: number;
  }>;
  vatRegistrationThresholdMinor: number;
  lateCommercialPayments: Readonly<{
    /** Bank Rate reference used for the current six-month statutory-interest period. */
    bankRateBasisPoints: number;
    bankRateReferenceDate: string;
    statutoryUpliftBasisPoints: number;
  }>;
  mileage: Readonly<{
    carVanFirstMilliPence: number;
    carVanAfterMilliPence: number;
    carVanThresholdMilliMiles: number;
    motorbikeMilliPence: number;
    bicycleMilliPence: number;
  }>;
}>;

/**
 * Official-rate policy pack checked against current GOV.UK tables on 2026-07-18.
 * UI should always expose the version/verified date on prepared tax outputs.
 */
export const UK_BUSINESS_POLICY_2026_27: UkBusinessPolicyPack = {
  version: 'uk-business-2026-27.v1',
  taxYear: '2026/27',
  verifiedOn: '2026-07-18',
  personalAllowanceMinor: 1_257_000,
  personalAllowanceTaperStartsMinor: 10_000_000,
  rUkBasicBandMinor: 3_770_000,
  rUkHigherCeilingMinor: 12_514_000,
  dividendAllowanceMinor: 50_000,
  dividendRatesBasisPoints: {
    basic: 1_075,
    higher: 3_575,
    additional: 3_935,
  },
  employeeNi: {
    primaryThresholdMinor: 1_257_000,
    upperEarningsMinor: 5_027_000,
    mainBasisPoints: 800,
    upperBasisPoints: 200,
  },
  employerNi: {
    secondaryThresholdMinor: 500_000,
    basisPoints: 1_500,
    employmentAllowanceMinor: 1_050_000,
  },
  selfEmployedNi: {
    smallProfitsThresholdMinor: 710_500,
    voluntaryClass2WeeklyMinor: 365,
    lowerProfitsMinor: 1_257_000,
    upperProfitsMinor: 5_027_000,
    mainBasisPoints: 600,
    upperBasisPoints: 200,
  },
  studentLoan: {
    '1': { thresholdMinor: 2_690_000, rateBasisPoints: 900 },
    '2': { thresholdMinor: 2_938_500, rateBasisPoints: 900 },
    '4': { thresholdMinor: 3_379_500, rateBasisPoints: 900 },
    '5': { thresholdMinor: 2_500_000, rateBasisPoints: 900 },
    postgrad: { thresholdMinor: 2_100_000, rateBasisPoints: 600 },
  },
  corporationTax: {
    lowerMinor: 5_000_000,
    upperMinor: 25_000_000,
    smallRateBasisPoints: 1_900,
    mainRateBasisPoints: 2_500,
    marginalNumerator: 3,
    marginalDenominator: 200,
  },
  vatRegistrationThresholdMinor: 9_000_000,
  lateCommercialPayments: {
    bankRateBasisPoints: 375,
    bankRateReferenceDate: '2026-06-30',
    statutoryUpliftBasisPoints: 800,
  },
  mileage: {
    carVanFirstMilliPence: 45_000,
    carVanAfterMilliPence: 25_000,
    carVanThresholdMilliMiles: 10_000_000,
    motorbikeMilliPence: 24_000,
    bicycleMilliPence: 20_000,
  },
};

export function emptyBusinessOperationsState(
  policy: UkBusinessPolicyPack = UK_BUSINESS_POLICY_2026_27,
): BusinessOperationsState {
  return {
    entity: null,
    clients: [],
    invoices: [],
    obligations: [],
    employees: [],
    payrollRuns: [],
    dividends: [],
    dla: [],
    vatReturns: [],
    mileageTrips: [],
    taxAdjustments: [],
    homeOfficeConfigs: [],
    ir35Assessments: [],
    recurringInvoices: [],
    filings: [],
    memory: [],
    basisPeriodTransition: null,
    ytdProfitMinor: 0,
    ctPotMinor: 0,
    vatPotMinor: 0,
    employmentAllowanceClaimed: false,
    policyPackVersion: policy.version,
    policyVerifiedOn: policy.verifiedOn,
  };
}

export function normaliseBusinessOperationsState(
  value: Partial<BusinessOperationsState> | null | undefined,
  policy: UkBusinessPolicyPack = UK_BUSINESS_POLICY_2026_27,
): BusinessOperationsState {
  const empty = emptyBusinessOperationsState(policy);
  if (!value) return empty;
  return {
    entity: value.entity ?? null,
    clients: Array.isArray(value.clients) ? value.clients : [],
    invoices: Array.isArray(value.invoices) ? value.invoices : [],
    obligations: Array.isArray(value.obligations) ? value.obligations : [],
    employees: Array.isArray(value.employees) ? value.employees : [],
    payrollRuns: Array.isArray(value.payrollRuns) ? value.payrollRuns : [],
    dividends: Array.isArray(value.dividends) ? value.dividends : [],
    dla: Array.isArray(value.dla) ? value.dla : [],
    vatReturns: Array.isArray(value.vatReturns) ? value.vatReturns : [],
    mileageTrips: Array.isArray(value.mileageTrips) ? value.mileageTrips : [],
    taxAdjustments: Array.isArray(value.taxAdjustments) ? value.taxAdjustments : [],
    homeOfficeConfigs: Array.isArray(value.homeOfficeConfigs) ? value.homeOfficeConfigs : [],
    ir35Assessments: Array.isArray(value.ir35Assessments) ? value.ir35Assessments : [],
    recurringInvoices: Array.isArray(value.recurringInvoices) ? value.recurringInvoices : [],
    filings: Array.isArray(value.filings) ? value.filings : [],
    memory: Array.isArray(value.memory) ? value.memory.slice(0, 200) : [],
    basisPeriodTransition:
      value.basisPeriodTransition && [1, 2, 3, 4].includes(value.basisPeriodTransition.yearsLeft)
        ? {
            remainingMinor: Math.max(0, safeMinor(value.basisPeriodTransition.remainingMinor)),
            yearsLeft: value.basisPeriodTransition.yearsLeft,
          }
        : null,
    ytdProfitMinor: safeMinor(value.ytdProfitMinor),
    ctPotMinor: safeMinor(value.ctPotMinor),
    vatPotMinor: safeMinor(value.vatPotMinor),
    employmentAllowanceClaimed: value.employmentAllowanceClaimed === true,
    policyPackVersion: value.policyPackVersion ?? empty.policyPackVersion,
    policyVerifiedOn: value.policyVerifiedOn ?? empty.policyVerifiedOn,
  };
}

export function hasBusinessOperationsData(state: BusinessOperationsState): boolean {
  return (
    state.entity !== null ||
    state.clients.length > 0 ||
    state.invoices.length > 0 ||
    state.obligations.length > 0 ||
    state.employees.length > 0 ||
    state.payrollRuns.length > 0 ||
    state.dividends.length > 0 ||
    state.dla.length > 0 ||
    state.vatReturns.length > 0 ||
    state.mileageTrips.length > 0 ||
    state.taxAdjustments.length > 0 ||
    state.homeOfficeConfigs.length > 0 ||
    state.ir35Assessments.length > 0 ||
    state.recurringInvoices.length > 0 ||
    state.filings.length > 0 ||
    state.memory.length > 0 ||
    state.basisPeriodTransition !== null ||
    state.ytdProfitMinor !== 0 ||
    state.ctPotMinor !== 0 ||
    state.vatPotMinor !== 0
  );
}

export type CashAccountInput = Readonly<{
  balanceMinor: number;
  isLiability: boolean;
  closed?: boolean;
}>;

export type BusinessRunway = Readonly<{
  cashMinor: number;
  incoming30Minor: number;
  outgoing30Minor: number;
  dailyBurnMinor: number;
  daysLeft: number | null;
  runsOutOn: string | null;
  forecast: readonly Readonly<{ date: string; balanceMinor: number; deltaMinor: number }>[];
}>;

export function calculateBusinessRunway(
  state: BusinessOperationsState,
  accounts: readonly CashAccountInput[],
  now = new Date(),
  days = 90,
): BusinessRunway {
  const cashMinor = accounts
    .filter((account) => !account.isLiability && account.closed !== true)
    .reduce((sum, account) => sum + safeMinor(account.balanceMinor), 0);
  const start = utcDay(now);
  const horizon30 = start.getTime() + 30 * DAY_MS;
  const incoming30Minor = state.invoices
    .filter((invoice) => outstandingInvoiceMinor(invoice) > 0)
    .filter((invoice) => dateMs(invoice.dueOn) >= start.getTime())
    .filter((invoice) => dateMs(invoice.dueOn) < horizon30)
    .reduce((sum, invoice) => sum + forecastInvoiceMinor(invoice), 0);
  const outgoing30Minor = expandObligations(state.obligations, start, 30).reduce(
    (sum, occurrence) => sum + occurrence.amountMinor,
    0,
  );
  const dailyBurnMinor = Math.max(0, Math.round((outgoing30Minor - incoming30Minor) / 30));
  const daysLeft = dailyBurnMinor > 0 ? Math.max(0, Math.floor(cashMinor / dailyBurnMinor)) : null;
  const runsOutOn =
    daysLeft === null
      ? null
      : new Date(start.getTime() + daysLeft * DAY_MS).toISOString().slice(0, 10);

  const deltas = new Map<string, number>();
  const bump = (date: string, amountMinor: number) =>
    deltas.set(date, (deltas.get(date) ?? 0) + amountMinor);
  const horizon = start.getTime() + days * DAY_MS;
  for (const invoice of state.invoices) {
    const due = dateMs(invoice.dueOn);
    if (due < start.getTime() || due >= horizon) continue;
    const forecastAmount = forecastInvoiceMinor(invoice);
    if (forecastAmount > 0) bump(invoice.dueOn, forecastAmount);
  }
  for (const occurrence of expandObligations(state.obligations, start, days)) {
    bump(occurrence.date, -occurrence.amountMinor);
  }
  const forecast: Array<{ date: string; balanceMinor: number; deltaMinor: number }> = [];
  let balanceMinor = cashMinor;
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start.getTime() + index * DAY_MS).toISOString().slice(0, 10);
    const deltaMinor = deltas.get(date) ?? 0;
    balanceMinor += deltaMinor;
    forecast.push({ date, balanceMinor, deltaMinor });
  }
  return {
    cashMinor,
    incoming30Minor,
    outgoing30Minor,
    dailyBurnMinor,
    daysLeft,
    runsOutOn,
    forecast,
  };
}

function forecastInvoiceMinor(invoice: BusinessInvoice): number {
  const outstanding = outstandingInvoiceMinor(invoice);
  return invoice.status === 'draft' && invoice.recurringTemplateId
    ? Math.round(outstanding * 0.7)
    : outstanding;
}

export type InvoiceAgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+';

export function invoiceAgingBucket(invoice: BusinessInvoice, now = new Date()): InvoiceAgingBucket {
  const overdueDays = Math.floor((utcDay(now).getTime() - dateMs(invoice.dueOn)) / DAY_MS);
  if (overdueDays <= 0) return 'current';
  if (overdueDays <= 30) return '1-30';
  if (overdueDays <= 60) return '31-60';
  if (overdueDays <= 90) return '61-90';
  return '90+';
}

export function outstandingInvoiceMinor(invoice: BusinessInvoice): number {
  if (invoice.status === 'void' || invoice.status === 'credited') return 0;
  return Math.max(0, safeMinor(invoice.totalMinor) - safeMinor(invoice.paidMinor));
}

export function totalOutstandingInvoicesMinor(state: BusinessOperationsState): number {
  return state.invoices.reduce((sum, invoice) => sum + outstandingInvoiceMinor(invoice), 0);
}

/** Current-year slice of a saved basis-period transition balance. */
export function basisPeriodTransitionSliceMinor(state: BusinessOperationsState): number {
  const transition = state.basisPeriodTransition;
  if (!transition || transition.remainingMinor <= 0) return 0;
  return Math.round(transition.remainingMinor / transition.yearsLeft);
}

export type SelfAssessmentSummary = Readonly<{
  recordedProfitMinor: number;
  transitionProfitMinor: number;
  assessedProfitMinor: number;
  incomeTaxMinor: number;
  class4NiMinor: number;
  studentLoanMinor: number;
  cisDeductedMinor: number;
  amountDueMinor: number;
  paymentOnAccountEachMinor: number;
}>;

export function calculateSelfAssessmentSummary(
  state: BusinessOperationsState,
  entity: SoleTraderEntity,
  policy: UkBusinessPolicyPack = UK_BUSINESS_POLICY_2026_27,
): SelfAssessmentSummary {
  const transitionProfitMinor = basisPeriodTransitionSliceMinor(state);
  const assessedProfitMinor = Math.max(0, state.ytdProfitMinor + transitionProfitMinor);
  const incomeTaxMinor = selfAssessmentIncomeTaxMinor(
    assessedProfitMinor,
    entity.taxRegion,
    policy,
  );
  const class4NiMinor = selfEmployedNiMinor(assessedProfitMinor, policy);
  const studentLoanMinor = studentLoanRepaymentMinor(
    assessedProfitMinor,
    entity.studentLoanPlans,
    policy,
  );
  const cisDeductedMinor = state.taxAdjustments
    .filter((adjustment) => adjustment.kind === 'cis-deduction')
    .reduce((sum, adjustment) => sum + Math.max(0, adjustment.amountMinor), 0);
  const grossDue = incomeTaxMinor + class4NiMinor + studentLoanMinor;
  const amountDueMinor = Math.max(0, grossDue - cisDeductedMinor);
  const paymentOnAccountBaseMinor = Math.max(0, incomeTaxMinor + class4NiMinor - cisDeductedMinor);
  const mostlyCollectedAtSource =
    incomeTaxMinor + class4NiMinor > 0 &&
    cisDeductedMinor * 5 >= (incomeTaxMinor + class4NiMinor) * 4;
  const paymentOnAccountEachMinor =
    paymentOnAccountBaseMinor > 100_000 && !mostlyCollectedAtSource
      ? Math.round(paymentOnAccountBaseMinor / 2)
      : 0;
  return {
    recordedProfitMinor: state.ytdProfitMinor,
    transitionProfitMinor,
    assessedProfitMinor,
    incomeTaxMinor,
    class4NiMinor,
    studentLoanMinor,
    cisDeductedMinor,
    amountDueMinor,
    paymentOnAccountEachMinor,
  };
}

function recurringCadenceDate(value: string, cadence: RecurringInvoiceTemplate['cadence']): string {
  const date = utcDay(new Date(value));
  if (cadence === 'weekly') date.setUTCDate(date.getUTCDate() + 7);
  else if (cadence === 'fortnightly') date.setUTCDate(date.getUTCDate() + 14);
  else if (cadence === 'monthly') date.setUTCMonth(date.getUTCMonth() + 1);
  else if (cadence === 'quarterly') date.setUTCMonth(date.getUTCMonth() + 3);
  else date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Materialise due recurring templates as local draft invoices. Re-running on the same day is
 * idempotent because each draft key is template id + issue date.
 */
export function generateDueRecurringInvoices(
  state: BusinessOperationsState,
  asOf = new Date(),
): BusinessOperationsState {
  const today = utcDay(asOf).toISOString().slice(0, 10);
  const generated: BusinessInvoice[] = [];
  const templates = state.recurringInvoices.map((template) => {
    if (!template.active) return template;
    let issueOn = template.nextIssueOn;
    let guard = 0;
    while (issueOn <= today && guard < 120) {
      const id = `recurring:${template.id}:${issueOn}`;
      if (!state.invoices.some((invoice) => invoice.id === id)) {
        const due = utcDay(new Date(issueOn));
        due.setUTCDate(due.getUTCDate() + Math.max(0, template.daysToPay));
        generated.push({
          id,
          clientId: template.clientId,
          clientName: template.clientName,
          ...(template.reference ? { reference: template.reference } : {}),
          issuedOn: issueOn,
          dueOn: due.toISOString().slice(0, 10),
          totalMinor: Math.max(0, safeMinor(template.amountMinor)),
          paidMinor: 0,
          status: 'draft',
          recurringTemplateId: template.id,
        });
      }
      issueOn = recurringCadenceDate(issueOn, template.cadence);
      guard += 1;
    }
    return issueOn === template.nextIssueOn ? template : { ...template, nextIssueOn: issueOn };
  });
  return generated.length === 0 &&
    templates.every((item, index) => item === state.recurringInvoices[index])
    ? state
    : { ...state, invoices: [...state.invoices, ...generated], recurringInvoices: templates };
}

export type LateCommercialPaymentClaim = Readonly<{
  eligibleBalanceMinor: number;
  daysLate: number;
  annualRateBasisPoints: number;
  interestMinor: number;
  fixedCompensationMinor: number;
  totalClaimMinor: number;
  bankRateReferenceDate: string;
}>;

/**
 * Calculate a UK statutory B2B late-payment working figure from a saved invoice.
 *
 * Eligibility still depends on a qualifying business-to-business commercial payment with no
 * different contractual interest rate. This is a calculation only: it does not mutate the
 * invoice or claim the amount has been charged.
 */
export function calculateLateCommercialPaymentClaim(
  invoice: BusinessInvoice,
  now = new Date(),
  policy: UkBusinessPolicyPack = UK_BUSINESS_POLICY_2026_27,
): LateCommercialPaymentClaim {
  const eligibleBalanceMinor = outstandingInvoiceMinor(invoice);
  const daysLate = Math.max(
    0,
    Math.floor((utcDay(now).getTime() - dateMs(invoice.dueOn)) / DAY_MS),
  );
  const annualRateBasisPoints =
    policy.lateCommercialPayments.bankRateBasisPoints +
    policy.lateCommercialPayments.statutoryUpliftBasisPoints;
  const interestMinor =
    eligibleBalanceMinor > 0 && daysLate > 0
      ? Math.round((eligibleBalanceMinor * annualRateBasisPoints * daysLate) / (10_000 * 365))
      : 0;
  const fixedCompensationMinor =
    eligibleBalanceMinor <= 0 || daysLate <= 0
      ? 0
      : eligibleBalanceMinor < 100_000
        ? 4_000
        : eligibleBalanceMinor < 1_000_000
          ? 7_000
          : 10_000;
  return {
    eligibleBalanceMinor,
    daysLate,
    annualRateBasisPoints,
    interestMinor,
    fixedCompensationMinor,
    totalClaimMinor: interestMinor + fixedCompensationMinor,
    bankRateReferenceDate: policy.lateCommercialPayments.bankRateReferenceDate,
  };
}

export type BusinessOneMove = Readonly<{
  kind: 'runway' | 'vat' | 'invoice' | 'obligation' | 'calm';
  headline: string;
  body: string;
  action?: Readonly<{
    label: string;
    target: 'account' | 'runway' | 'vat' | 'invoices' | 'obligations';
  }>;
}>;

/** Return the single highest-value Business companion move. The ranking is intentionally narrow:
 * Melo must not turn a pressured business picture into a dashboard of recommendations. */
export function selectBusinessOneMove(
  state: BusinessOperationsState,
  accounts: readonly CashAccountInput[],
  now = new Date(),
): BusinessOneMove {
  if (accounts.filter((account) => account.closed !== true).length === 0) {
    return {
      kind: 'calm',
      headline: 'Nothing to read yet.',
      body: 'Add a real account or record first. Melo will wait rather than make up a business picture.',
      action: { label: 'Add an account', target: 'account' },
    };
  }

  const runway = calculateBusinessRunway(state, accounts, now);
  if (runway.daysLeft !== null && runway.daysLeft < 21) {
    return {
      kind: 'runway',
      headline: `Cash lasts ${runway.daysLeft === 1 ? '1 day' : `${runway.daysLeft} days`}.`,
      body: `${formatBusinessMinor(runway.outgoing30Minor)} due out against ${formatBusinessMinor(runway.cashMinor + runway.incoming30Minor)} available. Chase the biggest late invoice or pause a non-essential cost.`,
      action: { label: 'Open runway', target: 'runway' },
    };
  }

  const openVat = state.vatReturns
    .filter((item) => item.filedExternallyOn === undefined)
    .sort((left, right) => left.dueOn.localeCompare(right.dueOn))[0];
  if (state.entity?.vat.registered === true && openVat !== undefined) {
    const daysToDue = Math.floor((dateMs(openVat.dueOn) - utcDay(now).getTime()) / DAY_MS);
    const estimatedMinor = calculateVatBoxes(openVat).box5Minor;
    const shortMinor = Math.max(0, estimatedMinor - state.vatPotMinor);
    if (daysToDue >= 0 && daysToDue <= 21 && shortMinor > 0) {
      return {
        kind: 'vat',
        headline: `VAT due in ${daysToDue === 0 ? 'today' : `${daysToDue} days`}.`,
        body: `The pot has ${formatBusinessMinor(state.vatPotMinor)} and the current return is ${formatBusinessMinor(estimatedMinor)}. Top up ${formatBusinessMinor(shortMinor)} before it lands.`,
        action: { label: 'Open VAT', target: 'vat' },
      };
    }
  }

  const outstandingByAge = state.invoices
    .filter((invoice) => outstandingInvoiceMinor(invoice) > 0)
    .map((invoice) => ({
      amountMinor: outstandingInvoiceMinor(invoice),
      bucket: invoiceAgingBucket(invoice, now),
    }));
  const over30Minor = outstandingByAge
    .filter((item) => item.bucket === '31-60' || item.bucket === '61-90' || item.bucket === '90+')
    .reduce((sum, item) => sum + item.amountMinor, 0);
  if (over30Minor > 0) {
    return {
      kind: 'invoice',
      headline: `${formatBusinessMinor(over30Minor)} over a month late.`,
      body: 'The older it gets, the harder it gets. One chase note today usually moves it.',
      action: { label: 'Open invoices', target: 'invoices' },
    };
  }
  const newlyLateMinor = outstandingByAge
    .filter((item) => item.bucket === '1-30')
    .reduce((sum, item) => sum + item.amountMinor, 0);
  if (newlyLateMinor > 0) {
    return {
      kind: 'invoice',
      headline: `${formatBusinessMinor(newlyLateMinor)} slipping late.`,
      body: 'A short nudge now keeps it from ageing into the harder bucket.',
      action: { label: 'Open invoices', target: 'invoices' },
    };
  }

  const today = utcDay(now).getTime();
  const soon = today + 14 * DAY_MS;
  const largeObligation = state.obligations
    .filter((item) => dateMs(item.nextDue) >= today)
    .filter((item) => dateMs(item.nextDue) <= soon)
    .filter((item) => item.amountMinor > runway.cashMinor * 0.4)
    .sort((left, right) => right.amountMinor - left.amountMinor)[0];
  if (largeObligation !== undefined) {
    return {
      kind: 'obligation',
      headline: `${largeObligation.label} lands soon.`,
      body: `${formatBusinessMinor(largeObligation.amountMinor)} out on ${largeObligation.nextDue}. Make sure the pot or account holds it.`,
      action: { label: 'See recurring money out', target: 'obligations' },
    };
  }

  return {
    kind: 'calm',
    headline: 'Nothing urgent.',
    body:
      runway.daysLeft === null
        ? 'Runway looks steady. Good time to send an invoice or tidy a recurring cost.'
        : `Runway looks steady — about ${runway.daysLeft} days. Good time to send an invoice or tidy a recurring cost.`,
    action: { label: 'Open runway', target: 'runway' },
  };
}

export type VatBoxes = Readonly<{
  box1Minor: number;
  box2Minor: number;
  box3Minor: number;
  box4Minor: number;
  box5Minor: number;
  box6Minor: number;
  box7Minor: number;
  box8Minor: number;
  box9Minor: number;
}>;

export function calculateVatBoxes(value: VatReturn): VatBoxes {
  const box1Minor = safeMinor(value.box1OutputVatMinor);
  const box2Minor = safeMinor(value.box2AcquisitionsVatMinor);
  const box3Minor = box1Minor + box2Minor;
  const box4Minor = safeMinor(value.box4InputVatMinor);
  return {
    box1Minor,
    box2Minor,
    box3Minor,
    box4Minor,
    box5Minor: box3Minor - box4Minor,
    box6Minor: safeMinor(value.box6SalesExVatMinor),
    box7Minor: safeMinor(value.box7PurchasesExVatMinor),
    box8Minor: safeMinor(value.box8EuSalesMinor),
    box9Minor: safeMinor(value.box9EuPurchasesMinor),
  };
}

export type VatSchemeAnalysisInput = Readonly<{
  annualNetSalesMinor: number;
  annualOutputVatMinor: number;
  annualInputVatMinor: number;
  flatRateBasisPoints?: number;
  limitedCostTrader: boolean;
  firstYear: boolean;
  unpaidSalesOutputVatMinor: number;
  unpaidPurchasesInputVatMinor: number;
}>;

export type VatSchemeAnalysis = Readonly<{
  standard: Readonly<{
    annualVatDueMinor: number;
    effectiveRateBasisPoints: number;
  }>;
  flatRate: Readonly<{
    annualVatDueMinor: number | null;
    appliedRateBasisPoints: number | null;
    limitedCostTrader: boolean;
    eligible: boolean;
  }>;
  cash: Readonly<{
    annualVatDueMinor: number;
    cashflowLiftMinor: number;
    eligible: boolean;
  }>;
  annual: Readonly<{
    monthlyInstalmentMinor: number;
    eligible: boolean;
  }>;
  recommendation: 'standard' | 'flat-rate' | 'cash' | 'annual';
  reason: string;
}>;

/**
 * Compares VAT accounting methods from reviewed VAT figures. It never changes the stored scheme.
 *
 * Cash-accounting timing is only as complete as the unpaid output/input VAT passed by the caller;
 * the engine does not infer VAT from raw bank transactions or unlabeled invoice totals.
 */
export function analyseVatSchemes(input: VatSchemeAnalysisInput): VatSchemeAnalysis {
  const netSalesMinor = Math.max(0, safeMinor(input.annualNetSalesMinor));
  const outputVatMinor = Math.max(0, safeMinor(input.annualOutputVatMinor));
  const inputVatMinor = Math.max(0, safeMinor(input.annualInputVatMinor));
  const standardDueMinor = outputVatMinor - inputVatMinor;
  const effectiveRateBasisPoints =
    netSalesMinor > 0 ? Math.round((standardDueMinor * 10_000) / netSalesMinor) : 0;
  const flatEligible = netSalesMinor <= 15_000_000;
  const cashEligible = netSalesMinor <= 135_000_000;
  const annualEligible = netSalesMinor <= 135_000_000;
  const suppliedFlatRate = input.limitedCostTrader
    ? 1_650
    : input.flatRateBasisPoints === undefined
      ? null
      : Math.max(0, Math.round(input.flatRateBasisPoints));
  const appliedFlatRate =
    suppliedFlatRate === null ? null : Math.max(0, suppliedFlatRate - (input.firstYear ? 100 : 0));
  const flatDueMinor =
    appliedFlatRate === null ? null : basisPoints(netSalesMinor + outputVatMinor, appliedFlatRate);
  const cashDueMinor =
    standardDueMinor -
    Math.max(0, safeMinor(input.unpaidSalesOutputVatMinor)) +
    Math.max(0, safeMinor(input.unpaidPurchasesInputVatMinor));
  const cashflowLiftMinor = standardDueMinor - cashDueMinor;

  let recommendation: VatSchemeAnalysis['recommendation'] = 'standard';
  let reason = 'Standard keeps the reviewed sales and purchase VAT in one direct calculation.';
  if (
    flatEligible &&
    flatDueMinor !== null &&
    standardDueMinor > 0 &&
    flatDueMinor < standardDueMinor
  ) {
    recommendation = 'flat-rate';
    reason = 'Flat Rate leaves the lower working amount on the reviewed figures.';
  } else if (cashEligible && cashflowLiftMinor > 0) {
    recommendation = 'cash';
    reason = 'Cash accounting would hold back output VAT until the recorded invoices are paid.';
  }

  return {
    standard: {
      annualVatDueMinor: standardDueMinor,
      effectiveRateBasisPoints,
    },
    flatRate: {
      annualVatDueMinor: flatDueMinor,
      appliedRateBasisPoints: appliedFlatRate,
      limitedCostTrader: input.limitedCostTrader,
      eligible: flatEligible,
    },
    cash: {
      annualVatDueMinor: cashDueMinor,
      cashflowLiftMinor,
      eligible: cashEligible,
    },
    annual: {
      monthlyInstalmentMinor: Math.round(Math.max(0, standardDueMinor) / 9),
      eligible: annualEligible,
    },
    recommendation,
    reason,
  };
}

export function corporationTaxMinor(
  profitMinor: number,
  policy: UkBusinessPolicyPack = UK_BUSINESS_POLICY_2026_27,
): number {
  const profit = Math.max(0, safeMinor(profitMinor));
  const tax = policy.corporationTax;
  if (profit <= tax.lowerMinor) return basisPoints(profit, tax.smallRateBasisPoints);
  const main = basisPoints(profit, tax.mainRateBasisPoints);
  if (profit >= tax.upperMinor) return main;
  const relief = Math.round(
    ((tax.upperMinor - profit) * tax.marginalNumerator) / tax.marginalDenominator,
  );
  return Math.max(0, main - relief);
}

export function effectiveCorporationTaxBasisPoints(
  profitMinor: number,
  policy: UkBusinessPolicyPack = UK_BUSINESS_POLICY_2026_27,
): number {
  const profit = Math.max(0, safeMinor(profitMinor));
  if (profit === 0) return policy.corporationTax.smallRateBasisPoints;
  return Math.round((corporationTaxMinor(profit, policy) * 10_000) / profit);
}

export function personalAllowanceMinor(
  adjustedNetIncomeMinor: number,
  policy: UkBusinessPolicyPack = UK_BUSINESS_POLICY_2026_27,
): number {
  const over = Math.max(
    0,
    safeMinor(adjustedNetIncomeMinor) - policy.personalAllowanceTaperStartsMinor,
  );
  return Math.max(0, policy.personalAllowanceMinor - Math.floor(over / 2));
}

export function selfAssessmentIncomeTaxMinor(
  profitMinor: number,
  region: TaxRegion,
  policy: UkBusinessPolicyPack = UK_BUSINESS_POLICY_2026_27,
): number {
  const profit = Math.max(0, safeMinor(profitMinor));
  const allowance = personalAllowanceMinor(profit, policy);
  const taxable = Math.max(0, profit - allowance);
  if (region !== 'scotland') {
    const basic = Math.min(taxable, policy.rUkBasicBandMinor);
    const higher = Math.min(
      Math.max(0, taxable - policy.rUkBasicBandMinor),
      Math.max(0, policy.rUkHigherCeilingMinor - allowance - policy.rUkBasicBandMinor),
    );
    const additional = Math.max(0, taxable - basic - higher);
    return basisPoints(basic, 2_000) + basisPoints(higher, 4_000) + basisPoints(additional, 4_500);
  }
  const bands: readonly Readonly<{ ceilingMinor: number; rateBasisPoints: number }>[] = [
    { ceilingMinor: 396_700, rateBasisPoints: 1_900 },
    { ceilingMinor: 1_695_600, rateBasisPoints: 2_000 },
    { ceilingMinor: 3_109_200, rateBasisPoints: 2_100 },
    { ceilingMinor: 6_243_000, rateBasisPoints: 4_200 },
    { ceilingMinor: 12_514_000, rateBasisPoints: 4_500 },
    { ceilingMinor: Number.POSITIVE_INFINITY, rateBasisPoints: 4_800 },
  ];
  let previous = 0;
  let total = 0;
  for (const band of bands) {
    const slice = Math.max(0, Math.min(taxable, band.ceilingMinor) - previous);
    total += basisPoints(slice, band.rateBasisPoints);
    previous = band.ceilingMinor;
    if (taxable <= band.ceilingMinor) break;
  }
  return total;
}

export function selfEmployedNiMinor(
  profitMinor: number,
  policy: UkBusinessPolicyPack = UK_BUSINESS_POLICY_2026_27,
): number {
  const profit = Math.max(0, safeMinor(profitMinor));
  const ni = policy.selfEmployedNi;
  const main = Math.max(0, Math.min(profit, ni.upperProfitsMinor) - ni.lowerProfitsMinor);
  const upper = Math.max(0, profit - ni.upperProfitsMinor);
  return basisPoints(main, ni.mainBasisPoints) + basisPoints(upper, ni.upperBasisPoints);
}

export function voluntaryClass2Minor(
  profitMinor: number,
  weeks = 52,
  policy: UkBusinessPolicyPack = UK_BUSINESS_POLICY_2026_27,
): number {
  if (safeMinor(profitMinor) >= policy.selfEmployedNi.smallProfitsThresholdMinor) return 0;
  return Math.max(0, Math.round(weeks)) * policy.selfEmployedNi.voluntaryClass2WeeklyMinor;
}

export function studentLoanRepaymentMinor(
  incomeMinor: number,
  plans: readonly StudentLoanPlan[],
  policy: UkBusinessPolicyPack = UK_BUSINESS_POLICY_2026_27,
): number {
  const unique = [...new Set(plans)];
  const ordinary = unique.filter((plan) => plan !== 'postgrad');
  const ordinaryThreshold =
    ordinary.length > 0
      ? Math.min(...ordinary.map((plan) => policy.studentLoan[plan].thresholdMinor))
      : null;
  const ordinaryDue =
    ordinaryThreshold === null
      ? 0
      : basisPoints(
          Math.max(0, safeMinor(incomeMinor) - ordinaryThreshold),
          policy.studentLoan[ordinary[0]!].rateBasisPoints,
        );
  const postgradDue = unique.includes('postgrad')
    ? basisPoints(
        Math.max(0, safeMinor(incomeMinor) - policy.studentLoan.postgrad.thresholdMinor),
        policy.studentLoan.postgrad.rateBasisPoints,
      )
    : 0;
  return ordinaryDue + postgradDue;
}

export function previewPayrollRun(
  employees: readonly PayrollEmployee[],
  periodEnd: string,
  options: Readonly<{
    region: TaxRegion;
    employmentAllowanceClaimed: boolean;
    allowanceUsedYearToDateMinor?: number;
    id?: string;
    recordedAt?: string;
    policy?: UkBusinessPolicyPack;
  }>,
): PayrollRun {
  const policy = options.policy ?? UK_BUSINESS_POLICY_2026_27;
  const rows = employees.map((employee): PayrollRow => {
    const annualGross = Math.max(0, safeMinor(employee.grossAnnualMinor));
    const grossMinor = Math.round(annualGross / 12);
    const incomeTaxMinor = Math.round(
      selfAssessmentIncomeTaxMinor(annualGross, options.region, policy) / 12,
    );
    const employeeNiMinor = Math.round(employeeNiAnnualMinor(annualGross, policy) / 12);
    const studentLoanMinor = Math.round(
      studentLoanRepaymentMinor(annualGross, employee.studentLoanPlans, policy) / 12,
    );
    return {
      employeeId: employee.id,
      grossMinor,
      incomeTaxMinor,
      employeeNiMinor,
      studentLoanMinor,
      netMinor: Math.max(0, grossMinor - incomeTaxMinor - employeeNiMinor - studentLoanMinor),
    };
  });
  const rawEmployerNiMinor = Math.round(
    employees.reduce(
      (sum, employee) => sum + employerNiAnnualMinor(employee.grossAnnualMinor, policy),
      0,
    ) / 12,
  );
  const allowanceRemaining = Math.max(
    0,
    policy.employerNi.employmentAllowanceMinor - safeMinor(options.allowanceUsedYearToDateMinor),
  );
  const employmentAllowanceAppliedMinor = options.employmentAllowanceClaimed
    ? Math.min(rawEmployerNiMinor, allowanceRemaining)
    : 0;
  return {
    id: options.id ?? `payroll-${periodEnd}`,
    periodEnd,
    employees: rows,
    employerNiMinor: Math.max(0, rawEmployerNiMinor - employmentAllowanceAppliedMinor),
    employmentAllowanceAppliedMinor,
    recordedAt: options.recordedAt ?? new Date().toISOString(),
  };
}

export function payrollTotals(run: PayrollRun): Readonly<{
  grossMinor: number;
  netMinor: number;
  payeMinor: number;
}> {
  return {
    grossMinor: run.employees.reduce((sum, row) => sum + row.grossMinor, 0),
    netMinor: run.employees.reduce((sum, row) => sum + row.netMinor, 0),
    payeMinor:
      run.employees.reduce(
        (sum, row) => sum + row.incomeTaxMinor + row.employeeNiMinor + row.studentLoanMinor,
        0,
      ) + run.employerNiMinor,
  };
}

export function distributableReservesMinor(
  state: BusinessOperationsState,
  policy: UkBusinessPolicyPack = UK_BUSINESS_POLICY_2026_27,
): number {
  const paid = state.dividends.reduce((sum, dividend) => sum + dividend.totalMinor, 0);
  return Math.max(
    0,
    state.ytdProfitMinor - corporationTaxMinor(state.ytdProfitMinor, policy) - paid,
  );
}

export function dividendTaxMinor(
  dividendMinor: number,
  otherIncomeMinor: number,
  policy: UkBusinessPolicyPack = UK_BUSINESS_POLICY_2026_27,
): number {
  const taxable = Math.max(0, safeMinor(dividendMinor) - policy.dividendAllowanceMinor);
  if (taxable === 0) return 0;
  const allowance = personalAllowanceMinor(otherIncomeMinor + dividendMinor, policy);
  const otherTaxable = Math.max(0, safeMinor(otherIncomeMinor) - allowance);
  const basicRoom = Math.max(0, policy.rUkBasicBandMinor - otherTaxable);
  const higherCeilingTaxable = Math.max(0, policy.rUkHigherCeilingMinor - allowance);
  const higherRoom = Math.max(
    0,
    higherCeilingTaxable - Math.max(otherTaxable, policy.rUkBasicBandMinor),
  );
  const basic = Math.min(taxable, basicRoom);
  const higher = Math.min(Math.max(0, taxable - basic), higherRoom);
  const additional = Math.max(0, taxable - basic - higher);
  return (
    basisPoints(basic, policy.dividendRatesBasisPoints.basic) +
    basisPoints(higher, policy.dividendRatesBasisPoints.higher) +
    basisPoints(additional, policy.dividendRatesBasisPoints.additional)
  );
}

export function dlaBalanceMinor(state: BusinessOperationsState): number {
  return state.dla.reduce((sum, movement) => sum + safeMinor(movement.amountMinor), 0);
}

export function s455EstimateMinor(state: BusinessOperationsState): number {
  return basisPoints(Math.max(0, dlaBalanceMinor(state)), 3_375);
}

export function mileageAllowanceMinor(
  trips: readonly MileageTrip[],
  policy: UkBusinessPolicyPack = UK_BUSINESS_POLICY_2026_27,
): number {
  const perVehicle: Record<MileageTrip['vehicle'], number> = {
    car: 0,
    van: 0,
    motorbike: 0,
    bicycle: 0,
  };
  for (const trip of trips) {
    perVehicle[trip.vehicle] += Math.max(0, Math.round(trip.distanceMilliMiles));
  }
  const carVan = (distance: number) => {
    const first = Math.min(distance, policy.mileage.carVanThresholdMilliMiles);
    const after = Math.max(0, distance - policy.mileage.carVanThresholdMilliMiles);
    return (
      milliMilesTimesMilliPence(first, policy.mileage.carVanFirstMilliPence) +
      milliMilesTimesMilliPence(after, policy.mileage.carVanAfterMilliPence)
    );
  };
  return (
    carVan(perVehicle.car) +
    carVan(perVehicle.van) +
    milliMilesTimesMilliPence(perVehicle.motorbike, policy.mileage.motorbikeMilliPence) +
    milliMilesTimesMilliPence(perVehicle.bicycle, policy.mileage.bicycleMilliPence)
  );
}

export function homeOfficeSimplifiedMinor(hoursPerMonth: number, months: number): number {
  const monthlyPounds =
    hoursPerMonth >= 101 ? 26 : hoursPerMonth >= 51 ? 18 : hoursPerMonth >= 25 ? 10 : 0;
  return Math.max(0, Math.round(months)) * monthlyPounds * 100;
}

export function directorHomeWorkingMinor(weeks: number): number {
  return Math.max(0, Math.round(weeks)) * 600;
}

export function homeOfficeFullMinor(input: HomeOfficeConfig['full']): number {
  const roomsTotal = Math.max(0, input.roomsTotal);
  const roomsBusiness = Math.min(roomsTotal, Math.max(0, input.roomsBusiness));
  const businessHours = Math.max(0, input.businessHoursPerWeek);
  const personalHours = Math.max(0, input.personalHoursPerWeek);
  const usedHours = businessHours + personalHours;
  if (roomsTotal === 0 || roomsBusiness === 0 || usedHours === 0) return 0;
  const annualCostsMinor = [
    input.councilMinor,
    input.utilitiesMinor,
    input.rentMinor,
    input.mortgageInterestMinor,
    input.insuranceMinor,
    input.cleaningMinor,
  ].reduce((sum, value) => sum + Math.max(0, safeMinor(value)), 0);
  const roomShare = roomsBusiness / roomsTotal;
  const timeShare = Math.min(1, businessHours / usedHours);
  return Math.round(annualCostsMinor * roomShare * timeShare);
}

export function homeOfficeConfigMinor(
  config: HomeOfficeConfig,
  entityKind: BusinessEntity['kind'],
): number {
  if (config.method === 'full') return homeOfficeFullMinor(config.full);
  return entityKind === 'ltd'
    ? directorHomeWorkingMinor(config.simplified.directorWeeks)
    : homeOfficeSimplifiedMinor(config.simplified.monthlyHours, config.simplified.months);
}

export function corporationTaxDueDate(entity: LtdEntity): string {
  return addMonthsAndDays(entity.yearEnd, 9, 1);
}

export function annualAccountsDueDate(entity: LtdEntity): string {
  return addMonthsAndDays(entity.yearEnd, 9, 0);
}

export function confirmationStatementDueDate(entity: LtdEntity, now = new Date()): string {
  const base = utcDay(new Date(entity.incorporatedOn ?? entity.createdAt));
  const next = new Date(base);
  while (next.getTime() < utcDay(now).getTime()) {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  }
  return next.toISOString().slice(0, 10);
}

export type BusinessDeadlineKind =
  | 'invoice'
  | 'obligation'
  | 'vat'
  | 'self-assessment'
  | 'corporation-tax'
  | 'confirmation-statement'
  | 'annual-accounts';

export type BusinessDeadline = Readonly<{
  id: string;
  kind: BusinessDeadlineKind;
  label: string;
  date: string;
  direction: 'in' | 'out';
  amountMinor?: number;
  done: boolean;
  target:
    | 'invoices'
    | 'obligations'
    | 'vat'
    | 'self-assessment'
    | 'corporation-tax'
    | 'confirmation-statement'
    | 'annual-accounts';
}>;

/** One deterministic forward calendar for Business. Dates come from saved invoices, recurring
 * obligations, VAT periods and the legal entity; no manual calendar row or fictional deadline is
 * introduced by the presentation layer. */
export function businessDeadlines(
  state: BusinessOperationsState,
  options: Readonly<{ now?: Date; withinDays?: number }> = {},
): readonly BusinessDeadline[] {
  const now = options.now ?? new Date();
  const withinDays = options.withinDays ?? 60;
  const today = utcDay(now);
  const out: BusinessDeadline[] = [];

  for (const invoice of state.invoices) {
    const outstanding = outstandingInvoiceMinor(invoice);
    if (outstanding <= 0) continue;
    out.push({
      id: `invoice:${invoice.id}`,
      kind: 'invoice',
      label: `${invoice.clientName}${invoice.reference ? ` · ${invoice.reference}` : ''}`,
      date: invoice.dueOn,
      direction: 'in',
      amountMinor: outstanding,
      done: false,
      target: 'invoices',
    });
  }

  for (const obligation of state.obligations) {
    let cursor = utcDay(new Date(obligation.nextDue));
    let guard = 0;
    while (cursor.getTime() < today.getTime() && guard < 500) {
      cursor = advanceCadence(cursor, obligation.cadence);
      guard += 1;
    }
    while (cursor.getTime() <= today.getTime() + withinDays * DAY_MS && guard < 500) {
      const date = cursor.toISOString().slice(0, 10);
      out.push({
        id: `obligation:${obligation.id}:${date}`,
        kind: 'obligation',
        label: obligation.label,
        date,
        direction: 'out',
        amountMinor: Math.max(0, safeMinor(obligation.amountMinor)),
        done: false,
        target: 'obligations',
      });
      cursor = advanceCadence(cursor, obligation.cadence);
      guard += 1;
    }
  }

  for (const vatReturn of state.vatReturns) {
    const amountMinor = calculateVatBoxes(vatReturn).box5Minor;
    out.push({
      id: `vat:${vatReturn.id}`,
      kind: 'vat',
      label: amountMinor < 0 ? 'VAT reclaim' : 'VAT return',
      date: vatReturn.dueOn,
      direction: amountMinor < 0 ? 'in' : 'out',
      amountMinor: Math.abs(amountMinor),
      done: vatReturn.filedExternallyOn !== undefined,
      target: 'vat',
    });
  }

  if (state.entity?.kind === 'sole-trader') {
    out.push({
      id: 'self-assessment:2026-27',
      kind: 'self-assessment',
      label: 'Self-Assessment',
      date: '2028-01-31',
      direction: 'out',
      amountMinor: calculateSelfAssessmentSummary(state, state.entity).amountDueMinor,
      done: state.filings.some(
        (item) => item.kind === 'self-assessment' && item.status === 'submitted-external',
      ),
      target: 'self-assessment',
    });
  }

  if (state.entity?.kind === 'ltd') {
    out.push(
      {
        id: 'corporation-tax:current',
        kind: 'corporation-tax',
        label: 'Corporation Tax',
        date: corporationTaxDueDate(state.entity),
        direction: 'out',
        amountMinor: corporationTaxMinor(state.ytdProfitMinor),
        done: state.filings.some(
          (item) => item.kind === 'corporation-tax' && item.status === 'submitted-external',
        ),
        target: 'corporation-tax',
      },
      {
        id: 'confirmation-statement:current',
        kind: 'confirmation-statement',
        label: 'Confirmation Statement',
        date: confirmationStatementDueDate(state.entity, now),
        direction: 'out',
        done: state.filings.some(
          (item) => item.kind === 'confirmation-statement' && item.status === 'submitted-external',
        ),
        target: 'confirmation-statement',
      },
      {
        id: 'annual-accounts:current',
        kind: 'annual-accounts',
        label: 'Annual accounts',
        date: annualAccountsDueDate(state.entity),
        direction: 'out',
        done: state.filings.some(
          (item) => item.kind === 'annual-accounts' && item.status === 'submitted-external',
        ),
        target: 'annual-accounts',
      },
    );
  }

  const max = today.getTime() + withinDays * DAY_MS;
  return out
    .filter((item) => !item.done)
    .filter((item) => dateMs(item.date) <= max)
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}

export function appendBusinessMemory(
  state: BusinessOperationsState,
  entry: BusinessMemoryEntry,
): BusinessOperationsState {
  if (
    state.memory.some(
      (existing) => existing.kind === entry.kind && existing.summary === entry.summary,
    )
  ) {
    return state;
  }
  return { ...state, memory: [entry, ...state.memory].slice(0, 200) };
}

function employeeNiAnnualMinor(annualGrossMinor: number, policy: UkBusinessPolicyPack): number {
  const main = Math.max(
    0,
    Math.min(annualGrossMinor, policy.employeeNi.upperEarningsMinor) -
      policy.employeeNi.primaryThresholdMinor,
  );
  const upper = Math.max(0, annualGrossMinor - policy.employeeNi.upperEarningsMinor);
  return (
    basisPoints(main, policy.employeeNi.mainBasisPoints) +
    basisPoints(upper, policy.employeeNi.upperBasisPoints)
  );
}

function employerNiAnnualMinor(annualGrossMinor: number, policy: UkBusinessPolicyPack): number {
  return basisPoints(
    Math.max(0, safeMinor(annualGrossMinor) - policy.employerNi.secondaryThresholdMinor),
    policy.employerNi.basisPoints,
  );
}

function expandObligations(
  obligations: readonly BusinessObligation[],
  start: Date,
  days: number,
): readonly Readonly<{ date: string; amountMinor: number }>[] {
  const horizon = start.getTime() + days * DAY_MS;
  const out: Array<{ date: string; amountMinor: number }> = [];
  for (const obligation of obligations) {
    let cursor = utcDay(new Date(obligation.nextDue));
    let guard = 0;
    while (cursor.getTime() < horizon && guard < 500) {
      if (cursor.getTime() >= start.getTime()) {
        out.push({
          date: cursor.toISOString().slice(0, 10),
          amountMinor: Math.max(0, safeMinor(obligation.amountMinor)),
        });
      }
      cursor = advanceCadence(cursor, obligation.cadence);
      guard += 1;
    }
  }
  return out;
}

function advanceCadence(value: Date, cadence: BusinessObligation['cadence']): Date {
  const next = new Date(value);
  if (cadence === 'weekly') next.setUTCDate(next.getUTCDate() + 7);
  else if (cadence === 'monthly') next.setUTCMonth(next.getUTCMonth() + 1);
  else if (cadence === 'quarterly') next.setUTCMonth(next.getUTCMonth() + 3);
  else next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

function addMonthsAndDays(iso: string, months: number, days: number): string {
  const date = utcDay(new Date(iso));
  date.setUTCMonth(date.getUTCMonth() + months);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function safeMinor(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
}

function basisPoints(amountMinor: number, rateBasisPoints: number): number {
  return Math.round((safeMinor(amountMinor) * rateBasisPoints) / 10_000);
}

function formatBusinessMinor(valueMinor: number): string {
  const pounds = Math.abs(safeMinor(valueMinor)) / 100;
  const value = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: Number.isInteger(pounds) ? 0 : 2,
  }).format(pounds);
  return valueMinor < 0 ? `−${value}` : value;
}

function milliMilesTimesMilliPence(distanceMilliMiles: number, rateMilliPence: number): number {
  // 1 mile = 1,000 milli-miles; 1 penny = 1,000 milli-pence.
  return Math.round((distanceMilliMiles * rateMilliPence) / 1_000_000);
}

function dateMs(iso: string): number {
  const value = Date.parse(`${iso}T00:00:00.000Z`);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function utcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

const DAY_MS = 86_400_000;
