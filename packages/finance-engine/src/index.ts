import {
  createCurrencyCode,
  createLocalDate,
  type AuthorityState,
  type CurrencyCode,
  type LocalDate,
} from '@folio/domain';

export const financeEngineBoundary = {
  packageName: '@folio/finance-engine',
  deterministic: true,
  importsNativeOrUiRuntime: false,
} as const;

export type ForecastMode = 'known' | 'expected' | 'planning' | 'scenario';
export type ForecastCertainty = AuthorityState;

export type AccountBalanceInput =
  | number
  | Readonly<{ minor: number; currency: string }>
  | Readonly<{ minorUnits: number; currency: string }>;

export type ForecastOccurrence = Readonly<{
  id: string;
  date: string;
  amountMinor: number;
  account?: string;
  currency?: string;
  status?: 'pending' | 'posted' | 'reversed' | 'void';
  certainty?: ForecastCertainty;
  protected?: boolean;
  fulfilled?: boolean;
  transferLink?: string;
  replacedBy?: string;
  replaces?: string;
  fulfils?: string;
  reference?: string;
  reversalOf?: string;
}>;

export type ForecastInput = Readonly<{
  asOf?: string;
  mode?: ForecastMode;
  accounts: Readonly<Record<string, AccountBalanceInput>>;
  occurrences?: readonly ForecastOccurrence[];
  expectations?: readonly ForecastOccurrence[];
  protectedFloorMinor?: number;
  nextIncomeDate?: string;
  baseCurrency?: string;
}>;

export type ForecastPoint = Readonly<{
  date: LocalDate;
  eventId: string;
  amountMinor: number;
  closingMinor: number;
  account?: string;
  certainty: ForecastCertainty;
}>;

export type ForecastResult = Readonly<{
  countedIds: readonly string[];
  excludedIds: readonly string[];
  accountClosing: Readonly<Record<string, number>>;
  consolidatedClosingMinor: number;
  closingMinor: number;
  incomeMinor: number;
  spendingMinor: number;
  spendingNetMinor: number;
  lowestMinor: number;
  points: readonly ForecastPoint[];
  minimumBeforeIncomeMinor?: number;
  availableBeforeNextIncomeMinor?: number;
  closingOnNextIncomeDateMinor?: number;
  closingBeforeIncomeMinor?: number;
  varianceMinor?: number;
  questionType?: 'recurring_amount_variance';
}>;

export type FxRate = Readonly<{
  from: string;
  to: string;
  rate: string;
  rateAt: string;
}>;

export type ConsolidatedPosition =
  | Readonly<{
      consolidated: null;
      reason: 'conversion_required';
      currencies: readonly string[];
    }>
  | Readonly<{
      consolidated: number;
      currency: CurrencyCode;
      rateAt?: string;
    }>;

export type ScenarioOutflowBoundary = Readonly<{
  scenarioSafe: boolean;
  shortfallToFloorMinor: number;
  maximumScenarioOutflowMinor: number;
}>;

export type ScenarioResult = Readonly<{
  actual: ForecastResult;
  scenario: ForecastResult;
  closingDeltaMinor: number;
  domainTransactionCreated: false;
}>;

export type OverdueObligationResult = Readonly<{
  eventState: 'missed';
  effectiveForecastDate: LocalDate;
  availableMinor: number;
  severity: 'important';
}>;

export type DebtScheduleInput = Readonly<{
  principalMinor: number;
  annualRateBps: number;
  monthlyPaymentMinor: number;
  startDate: string;
  currency?: string;
  maxMonths?: number;
}>;

export type DebtScheduleRow = Readonly<{
  period: number;
  dueDate: LocalDate;
  openingPrincipalMinor: number;
  interestMinor: number;
  paymentMinor: number;
  principalPaidMinor: number;
  closingPrincipalMinor: number;
}>;

export type DebtSchedule = Readonly<{
  currency: CurrencyCode;
  rows: readonly DebtScheduleRow[];
  payoffDate: LocalDate | null;
  totalInterestMinor: number;
}>;

type NormalizedAccount = Readonly<{
  id: string;
  minor: number;
  currency: CurrencyCode;
}>;

type CountedOccurrence = ForecastOccurrence &
  Readonly<{
    effectiveDate: LocalDate;
    sourceKind: 'fact' | 'expectation' | 'scenario';
    certainty: ForecastCertainty;
  }>;

export function buildForecast(input: ForecastInput): ForecastResult {
  const mode = input.mode ?? 'expected';
  const accounts = normalizeAccounts(input.accounts, input.baseCurrency ?? 'GBP');
  const baseCurrency = accounts[0]?.currency ?? createCurrencyCode(input.baseCurrency ?? 'GBP');
  const singleAccountId = accounts.length === 1 ? accounts[0]?.id : undefined;
  const accountClosing = Object.fromEntries(accounts.map((account) => [account.id, account.minor]));
  let consolidated = accounts.reduce((total, account) => total + account.minor, 0);
  assertSafeInteger(consolidated, 'Consolidated opening balance');

  const reconciliation = reconcileOccurrences(input, mode);
  const counted = reconciliation.counted;
  let lowest = consolidated;
  let minimumBeforeIncome = consolidated;
  let closingBeforeIncome = consolidated;
  let closingOnNextIncome = consolidated;
  let incomeMinor = 0;
  let spendingMinor = 0;
  let spendingNetMinor = 0;
  const points: ForecastPoint[] = [];
  const neutralTransferLinks = findNeutralTransferLinks(counted);

  for (const occurrence of counted) {
    const accountId = occurrence.account ?? singleAccountId;
    if (accountId !== undefined && accountClosing[accountId] !== undefined) {
      accountClosing[accountId] += occurrence.amountMinor;
      assertSafeInteger(accountClosing[accountId], `Closing balance for ${accountId}`);
    }

    consolidated += occurrence.amountMinor;
    assertSafeInteger(consolidated, 'Consolidated closing balance');
    if (consolidated < lowest) lowest = consolidated;

    if (!isNeutralTransfer(occurrence, neutralTransferLinks)) {
      if (occurrence.amountMinor > 0) incomeMinor += occurrence.amountMinor;
      if (occurrence.amountMinor < 0) spendingMinor += Math.abs(occurrence.amountMinor);
      spendingNetMinor += occurrence.amountMinor;
    }

    const point: {
      date: LocalDate;
      eventId: string;
      amountMinor: number;
      closingMinor: number;
      account?: string;
      certainty: ForecastCertainty;
    } = {
      date: occurrence.effectiveDate,
      eventId: occurrence.id,
      amountMinor: occurrence.amountMinor,
      closingMinor: consolidated,
      certainty: occurrence.certainty,
    };
    if (accountId !== undefined) point.account = accountId;
    points.push(point);

    if (input.nextIncomeDate !== undefined) {
      const nextIncomeDate = createLocalDate(input.nextIncomeDate);
      if (occurrence.effectiveDate < nextIncomeDate) {
        minimumBeforeIncome = Math.min(minimumBeforeIncome, consolidated);
        closingBeforeIncome = consolidated;
      }
      if (occurrence.effectiveDate <= nextIncomeDate) {
        closingOnNextIncome = consolidated;
      }
    }
  }

  assertSafeInteger(incomeMinor, 'Forecast income total');
  assertSafeInteger(spendingMinor, 'Forecast spending total');
  assertSafeInteger(spendingNetMinor, 'Forecast net spending total');

  const result: {
    countedIds: readonly string[];
    excludedIds: readonly string[];
    accountClosing: Readonly<Record<string, number>>;
    consolidatedClosingMinor: number;
    closingMinor: number;
    incomeMinor: number;
    spendingMinor: number;
    spendingNetMinor: number;
    lowestMinor: number;
    points: readonly ForecastPoint[];
    minimumBeforeIncomeMinor?: number;
    availableBeforeNextIncomeMinor?: number;
    closingOnNextIncomeDateMinor?: number;
    closingBeforeIncomeMinor?: number;
    varianceMinor?: number;
    questionType?: 'recurring_amount_variance';
  } = {
    countedIds: counted.map((occurrence) => occurrence.id),
    excludedIds: reconciliation.excludedIds,
    accountClosing,
    consolidatedClosingMinor: consolidated,
    closingMinor: consolidated,
    incomeMinor,
    spendingMinor,
    spendingNetMinor,
    lowestMinor: lowest,
    points,
  };

  if (input.nextIncomeDate !== undefined) {
    const floor = input.protectedFloorMinor ?? 0;
    result.minimumBeforeIncomeMinor = minimumBeforeIncome;
    result.availableBeforeNextIncomeMinor = Math.max(0, minimumBeforeIncome - floor);
    result.closingOnNextIncomeDateMinor = closingOnNextIncome;
    result.closingBeforeIncomeMinor = closingBeforeIncome;
  }
  if (reconciliation.varianceMinor !== undefined) {
    result.varianceMinor = reconciliation.varianceMinor;
    if (reconciliation.varianceMinor !== 0) {
      result.questionType = 'recurring_amount_variance';
    }
  }

  void baseCurrency;
  return result;
}

export function calculateAvailableBeforeNextIncome(input: ForecastInput): ForecastResult {
  if (input.nextIncomeDate === undefined) {
    throw new Error('nextIncomeDate is required for boundary calculations.');
  }
  return buildForecast(input);
}

export function calculateScenarioOutflowBoundary(
  input: ForecastInput & Readonly<{ scenario: { date: string; amountMinor: number } }>,
): ScenarioOutflowBoundary {
  const proposedOutflow = Math.abs(input.scenario.amountMinor);
  const floor = input.protectedFloorMinor ?? 0;
  const accounts = normalizeAccounts(input.accounts, input.baseCurrency ?? 'GBP');
  const high = Math.max(
    0,
    accounts.reduce((total, account) => total + account.minor, 0),
  );

  let low = 0;
  let upper = high;
  while (low <= upper) {
    const mid = Math.floor((low + upper) / 2);
    if (isScenarioOutflowSafe(input, mid, floor)) {
      low = mid + 1;
    } else {
      upper = mid - 1;
    }
  }

  const maximumScenarioOutflowMinor = Math.max(0, upper);
  return {
    scenarioSafe: proposedOutflow <= maximumScenarioOutflowMinor,
    shortfallToFloorMinor: Math.max(0, proposedOutflow - maximumScenarioOutflowMinor),
    maximumScenarioOutflowMinor,
  };
}

export function runScenario(input: {
  base: ForecastInput;
  changes: readonly ForecastOccurrence[];
}): ScenarioResult {
  const actual = buildForecast(input.base);
  const scenarioOccurrences = [
    ...(input.base.occurrences ?? []),
    ...input.changes.map((change) => ({ ...change, certainty: 'hypothetical' as const })),
  ];
  const scenario = buildForecast({
    ...input.base,
    mode: 'scenario',
    occurrences: scenarioOccurrences,
  });

  return {
    actual,
    scenario,
    closingDeltaMinor: scenario.closingMinor - actual.closingMinor,
    domainTransactionCreated: false,
  };
}

export function consolidateAccounts(input: {
  accounts: Readonly<Record<string, AccountBalanceInput>>;
  baseCurrency?: string;
  rates?: readonly FxRate[];
}): ConsolidatedPosition {
  const accounts = normalizeAccounts(input.accounts, input.baseCurrency ?? 'GBP');
  const baseCurrency = createCurrencyCode(input.baseCurrency ?? accounts[0]?.currency ?? 'GBP');
  const currencies = [...new Set(accounts.map((account) => account.currency))];

  if (currencies.length === 1 && currencies[0] === baseCurrency) {
    return {
      consolidated: accounts.reduce((total, account) => total + account.minor, 0),
      currency: baseCurrency,
    };
  }

  let total = 0;
  let rateAt: string | undefined;
  for (const account of accounts) {
    if (account.currency === baseCurrency) {
      total += account.minor;
      continue;
    }

    const rate = input.rates?.find(
      (candidate) =>
        createCurrencyCode(candidate.from) === account.currency &&
        createCurrencyCode(candidate.to) === baseCurrency,
    );
    if (rate === undefined) {
      return { consolidated: null, reason: 'conversion_required', currencies };
    }
    total += multiplyMinorByDecimal(account.minor, rate.rate);
    rateAt = rate.rateAt;
  }

  assertSafeInteger(total, 'Converted consolidated balance');
  const converted: {
    consolidated: number;
    currency: CurrencyCode;
    rateAt?: string;
  } = { consolidated: total, currency: baseCurrency };
  if (rateAt !== undefined) converted.rateAt = rateAt;
  return converted;
}

export function evaluateOverdueObligation(input: ForecastInput): OverdueObligationResult {
  const asOf = createLocalDate(input.asOf ?? new Date().toISOString().slice(0, 10));
  const overdue = (input.expectations ?? []).find(
    (expectation) =>
      createLocalDate(expectation.date) < asOf &&
      expectation.fulfilled !== true &&
      expectation.amountMinor < 0,
  );
  if (overdue === undefined) {
    throw new Error('No overdue obligation found.');
  }

  const forecast = buildForecast({ ...input, mode: 'expected' });
  const availableMinor = Math.max(0, forecast.closingMinor - (input.protectedFloorMinor ?? 0));
  return {
    eventState: 'missed',
    effectiveForecastDate: asOf,
    availableMinor,
    severity: 'important',
  };
}

export function getWorkspacePosition(input: {
  workspaces: Readonly<Record<string, { accounts: Readonly<Record<string, AccountBalanceInput>> }>>;
  workspaceId: string;
}): number {
  const workspace = input.workspaces[input.workspaceId];
  if (workspace === undefined) {
    throw new Error(`Unknown workspace: ${input.workspaceId}`);
  }
  const accounts = normalizeAccounts(workspace.accounts, 'GBP');
  return accounts.reduce((total, account) => total + account.minor, 0);
}

export function getAllWorkspacesPositionByDefault(): {
  available: false;
  reason: 'workspace_scope_required';
} {
  return { available: false, reason: 'workspace_scope_required' };
}

export function projectDebtSchedule(input: DebtScheduleInput): DebtSchedule {
  assertSafeInteger(input.principalMinor, 'Debt principal');
  assertSafeInteger(input.annualRateBps, 'Debt annual rate');
  assertSafeInteger(input.monthlyPaymentMinor, 'Debt monthly payment');
  if (input.principalMinor < 0 || input.annualRateBps < 0 || input.monthlyPaymentMinor <= 0) {
    throw new Error('Debt schedule inputs must be non-negative with a positive payment.');
  }

  const currency = createCurrencyCode(input.currency ?? 'GBP');
  const maxMonths = input.maxMonths ?? 600;
  if (!Number.isSafeInteger(maxMonths) || maxMonths < 1 || maxMonths > 600) {
    throw new Error('Debt schedule maxMonths must be between 1 and 600.');
  }

  const startDate = createLocalDate(input.startDate);
  const anchorDay = Number(startDate.slice(8, 10));
  let principal = input.principalMinor;
  let totalInterestMinor = 0;
  const rows: DebtScheduleRow[] = [];

  for (let period = 1; period <= maxMonths && principal > 0; period += 1) {
    const interestMinor = roundRatio(principal * input.annualRateBps, 120_000);
    if (input.monthlyPaymentMinor <= interestMinor) {
      throw new Error('Debt payment does not cover modelled monthly interest.');
    }

    const paymentMinor = Math.min(input.monthlyPaymentMinor, principal + interestMinor);
    const principalPaidMinor = paymentMinor - interestMinor;
    const closingPrincipalMinor = principal - principalPaidMinor;
    const row: DebtScheduleRow = {
      period,
      dueDate: addMonthsToLocalDate(startDate, period - 1, anchorDay),
      openingPrincipalMinor: principal,
      interestMinor,
      paymentMinor,
      principalPaidMinor,
      closingPrincipalMinor,
    };
    rows.push(row);
    totalInterestMinor += interestMinor;
    principal = closingPrincipalMinor;
  }

  const payoffDate =
    rows.at(-1)?.closingPrincipalMinor === 0 ? (rows.at(-1)?.dueDate ?? null) : null;
  return { currency, rows, payoffDate, totalInterestMinor };
}

function reconcileOccurrences(
  input: ForecastInput,
  mode: ForecastMode,
): {
  counted: readonly CountedOccurrence[];
  excludedIds: readonly string[];
  varianceMinor?: number;
} {
  const asOf = input.asOf === undefined ? undefined : createLocalDate(input.asOf);
  const expectations = (input.expectations ?? []).map((expectation) =>
    normalizeOccurrence(expectation, 'expectation', asOf),
  );
  const facts = (input.occurrences ?? []).map((occurrence) =>
    normalizeOccurrence(
      occurrence,
      occurrence.certainty === 'hypothetical' ? 'scenario' : 'fact',
      asOf,
    ),
  );
  const all = [...expectations, ...facts];
  const expectationById = new Map(expectations.map((expectation) => [expectation.id, expectation]));
  const replacedIds = new Set<string>();
  const fulfilledExpectationIds = new Set<string>();
  let varianceMinor: number | undefined;

  for (const occurrence of all) {
    if (occurrence.replacedBy !== undefined) replacedIds.add(occurrence.id);
    if (occurrence.replaces !== undefined) replacedIds.add(occurrence.replaces);
    if (occurrence.fulfils !== undefined) {
      fulfilledExpectationIds.add(occurrence.fulfils);
      const expectation = expectationById.get(occurrence.fulfils);
      if (expectation !== undefined) {
        varianceMinor = occurrence.amountMinor - expectation.amountMinor;
      }
    }
  }

  const counted: CountedOccurrence[] = [];
  const excludedIds: string[] = [];
  for (const occurrence of all) {
    const excluded =
      occurrence.status === 'void' ||
      replacedIds.has(occurrence.id) ||
      (occurrence.sourceKind === 'expectation' &&
        (occurrence.fulfilled === true || fulfilledExpectationIds.has(occurrence.id))) ||
      !isIncludedForMode(occurrence, mode);

    if (excluded) {
      excludedIds.push(occurrence.id);
    } else {
      counted.push(occurrence);
    }
  }

  counted.sort(compareOccurrences);
  const result: {
    counted: readonly CountedOccurrence[];
    excludedIds: readonly string[];
    varianceMinor?: number;
  } = { counted, excludedIds };
  if (varianceMinor !== undefined) result.varianceMinor = varianceMinor;
  return result;
}

function normalizeOccurrence(
  occurrence: ForecastOccurrence,
  sourceKind: 'fact' | 'expectation' | 'scenario',
  asOf: LocalDate | undefined,
): CountedOccurrence {
  assertSafeInteger(occurrence.amountMinor, `Occurrence ${occurrence.id} amount`);
  const certainty = occurrence.certainty ?? defaultCertaintyFor(sourceKind, occurrence.status);
  const originalDate = createLocalDate(occurrence.date);
  const effectiveDate =
    sourceKind === 'expectation' &&
    asOf !== undefined &&
    originalDate < asOf &&
    occurrence.fulfilled !== true
      ? asOf
      : originalDate;

  return {
    ...occurrence,
    date: originalDate,
    effectiveDate,
    sourceKind,
    certainty,
  };
}

function defaultCertaintyFor(
  sourceKind: 'fact' | 'expectation' | 'scenario',
  status: ForecastOccurrence['status'],
): ForecastCertainty {
  if (sourceKind === 'scenario') return 'hypothetical';
  if (sourceKind === 'expectation') return 'user-confirmed';
  return status === 'pending' ? 'provider-reported' : 'confirmed';
}

function isIncludedForMode(occurrence: CountedOccurrence, mode: ForecastMode): boolean {
  if (occurrence.certainty === 'hypothetical') return mode === 'scenario';
  if (mode === 'known') {
    return (
      occurrence.certainty === 'confirmed' ||
      occurrence.certainty === 'user-confirmed' ||
      occurrence.certainty === 'provider-reported'
    );
  }
  if (mode === 'expected' || mode === 'planning') {
    return (
      occurrence.certainty !== 'inferred' &&
      occurrence.certainty !== 'superseded' &&
      occurrence.certainty !== 'reversed'
    );
  }
  return true;
}

function compareOccurrences(left: CountedOccurrence, right: CountedOccurrence): number {
  const dateComparison = left.effectiveDate.localeCompare(right.effectiveDate);
  if (dateComparison !== 0) return dateComparison;
  const priorityComparison = occurrencePriority(left) - occurrencePriority(right);
  if (priorityComparison !== 0) return priorityComparison;
  return left.id.localeCompare(right.id);
}

function occurrencePriority(occurrence: CountedOccurrence): number {
  if (occurrence.status === 'posted' && occurrence.certainty === 'confirmed') return 0;
  if (occurrence.protected === true && occurrence.amountMinor < 0) return 2;
  if (occurrence.amountMinor < 0) return 3;
  if (occurrence.amountMinor > 0) return 4;
  if (occurrence.certainty === 'inferred') return 5;
  return 6;
}

function findNeutralTransferLinks(occurrences: readonly CountedOccurrence[]): ReadonlySet<string> {
  const totals = new Map<string, number>();
  for (const occurrence of occurrences) {
    if (occurrence.transferLink === undefined) continue;
    totals.set(
      occurrence.transferLink,
      (totals.get(occurrence.transferLink) ?? 0) + occurrence.amountMinor,
    );
  }

  return new Set(
    [...totals.entries()].filter(([, total]) => total === 0).map(([transferLink]) => transferLink),
  );
}

function isNeutralTransfer(
  occurrence: CountedOccurrence,
  neutralTransferLinks: ReadonlySet<string>,
): boolean {
  return occurrence.transferLink !== undefined && neutralTransferLinks.has(occurrence.transferLink);
}

function isScenarioOutflowSafe(input: ForecastInput, outflowMinor: number, floor: number): boolean {
  const forecast = buildForecast({
    ...input,
    mode: 'scenario',
    occurrences: [
      ...(input.occurrences ?? []),
      {
        id: '__scenario_outflow__',
        date: (input as ForecastInput & { scenario: { date: string } }).scenario.date,
        amountMinor: -outflowMinor,
        certainty: 'hypothetical',
      },
    ],
  });

  const minimum =
    forecast.minimumBeforeIncomeMinor ?? forecast.lowestMinor ?? forecast.consolidatedClosingMinor;
  return minimum >= floor;
}

function normalizeAccounts(
  input: Readonly<Record<string, AccountBalanceInput>>,
  fallbackCurrency: string,
): readonly NormalizedAccount[] {
  return Object.entries(input).map(([id, value]) => {
    const normalized = normalizeAccountBalance(value, fallbackCurrency);
    return {
      id,
      minor: normalized.minor,
      currency: normalized.currency,
    };
  });
}

function normalizeAccountBalance(
  input: AccountBalanceInput,
  fallbackCurrency: string,
): { minor: number; currency: CurrencyCode } {
  if (typeof input === 'number') {
    assertSafeInteger(input, 'Account balance');
    return { minor: input, currency: createCurrencyCode(fallbackCurrency) };
  }

  const minor = 'minor' in input ? input.minor : input.minorUnits;
  assertSafeInteger(minor, 'Account balance');
  return { minor, currency: createCurrencyCode(input.currency) };
}

function multiplyMinorByDecimal(minor: number, rate: string): number {
  assertSafeInteger(minor, 'FX source amount');
  const { numerator, denominator } = parseDecimal(rate);
  const sign = minor < 0 ? -1n : 1n;
  const raw = BigInt(Math.abs(minor)) * numerator;
  const rounded = (raw + denominator / 2n) / denominator;
  return toSafeNumber(sign * rounded, 'Converted FX amount');
}

function parseDecimal(input: string): { numerator: bigint; denominator: bigint } {
  const match = /^(\d+)(?:\.(\d{1,12}))?$/.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid decimal rate: ${input}`);
  }

  const whole = match[1] ?? '0';
  const fraction = match[2] ?? '';
  return {
    numerator: BigInt(`${whole}${fraction}`),
    denominator: 10n ** BigInt(fraction.length),
  };
}

function roundRatio(numerator: number, denominator: number): number {
  assertSafeInteger(numerator, 'Ratio numerator');
  assertSafeInteger(denominator, 'Ratio denominator');
  if (denominator <= 0) throw new Error('Ratio denominator must be positive.');

  const value = (BigInt(numerator) + BigInt(Math.floor(denominator / 2))) / BigInt(denominator);
  return toSafeNumber(value, 'Rounded ratio');
}

function addMonthsToLocalDate(date: LocalDate, months: number, anchorDay: number): LocalDate {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1 + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return createLocalDate(
    `${String(targetYear).padStart(4, '0')}-${String(targetMonth + 1).padStart(2, '0')}-${String(
      Math.min(anchorDay, daysInMonth),
    ).padStart(2, '0')}`,
  );
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer.`);
  }
}

function toSafeNumber(value: bigint, label: string): number {
  const asNumber = Number(value);
  assertSafeInteger(asNumber, label);
  return asNumber;
}
