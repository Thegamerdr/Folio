import { buildForecast, type ForecastOccurrence, type ForecastResult } from '@folio/finance-engine';
import {
  addDaysToLocalDate,
  createCurrencyCode,
  createForecastId,
  createInstantString,
  createLocalDate,
  createMoney,
  createProvenanceId,
  localDateFromInstant,
  type CurrencyCode,
  type InstantString,
  type LocalDate,
  type Money,
  type TimeZoneId,
  type TrustedCoreFreshness,
  type TrustedCoreTruthClass,
  type TrustedSafeRangeCause,
  type TrustedSafeRangeEvidenceNote,
  type TrustedSafeRangeIssue,
  type TrustedSafeRangeNextAction,
  type TrustedSafeRangeResult,
  type TrustedSafeRangeSourceBreakdown,
  type TrustedSafeRangeStatus,
  type TrustedSafeRangeUncertaintySource,
  type WorkspaceId,
} from '@folio/domain';

import {
  bankTransactions,
  selectBankBalanceMinor,
  type AppState,
  type CalendarEvent,
  type CurrentBalance,
  type PotLedgerEntry,
  type ReviewItem,
  type Sub,
  type Transaction,
} from '../store';
import { deriveCalendarEvents, type DerivedEvent } from './calendarEvents';
import { nextIncomeDate } from './income';
import { resolvePayday } from './payday';
import { routeFromStore } from './storeRoute';
import { PERSONAL_WORKSPACE_TIME_ZONE } from './workspaceRoot';

const GBP = createCurrencyCode('GBP');
const HORIZON_DAYS = 35;
const BALANCE_AGEING_DAYS = 2;
const BALANCE_STALE_DAYS = 7;
const MATERIAL_DIVERGENCE_MINOR = 500;
const MATERIAL_BILL_FLOOR_MINOR = 10_000;
const VARIABLE_BILL_UNCERTAINTY_RATIO = 0.2;

export type TrustedSafeRangeAdapterOptions = Readonly<{
  now: Date | string;
  previousResult?: TrustedSafeRangeResult | null;
  restoredFromEncryptedBackup?: boolean;
}>;

export type TrustedSafeRangeLegacyComparison = Readonly<{
  legacyTightestMinor: number | null;
  trustedConservativeBoundaryMinor: number | null;
  deltaMinor: number | null;
  material: boolean;
  reason: string;
}>;

type SafeRangeTimelineEvent = DerivedEvent &
  Readonly<{
    factId: string;
    truthClass: TrustedCoreTruthClass;
  }>;

type AdapterContext = Readonly<{
  workspaceId: WorkspaceId;
  currency: CurrencyCode;
  calculatedAt: InstantString;
  todayISO: LocalDate;
  horizonEndISO: LocalDate;
}>;

type RangeMath = Readonly<{
  lowerMinor: number | null;
  upperMinor: number | null;
  conservativeMinor: number | null;
  tightestMinor: number | null;
  tightestDateISO: LocalDate | null;
  currentKnownMinor: number | null;
  committedFloorMinor: number | null;
}>;

type ForecastBundle = Readonly<{
  forecast: ForecastResult | null;
  occurrences: readonly ForecastOccurrence[];
  excludedTransferIds: readonly string[];
}>;

type LegacySafeZoneSnapshot = Readonly<{
  totalMinor: number | null;
  perDayMinor: number | null;
  untilISO: LocalDate | null;
  daysLeft: number;
}>;

function normalizedNow(
  input: Date | string,
  timeZone: TimeZoneId,
): {
  date: Date;
  todayISO: LocalDate;
  instant: InstantString;
} {
  if (input instanceof Date) {
    const date = new Date(input.getTime());
    return {
      date,
      todayISO: localDateFromInstant(date, timeZone),
      instant: createInstantString(date.toISOString()),
    };
  }
  if (typeof input === 'string') {
    const date = input.includes('T') ? new Date(input) : new Date(`${input}T12:00:00.000Z`);
    if (!Number.isFinite(date.getTime())) {
      throw new Error(`trustedSafeRange: invalid now value "${input}"`);
    }
    return {
      date,
      todayISO: input.includes('T') ? localDateFromInstant(date, timeZone) : createLocalDate(input),
      instant: createInstantString(date.toISOString()),
    };
  }
  throw new Error('trustedSafeRange: now must be a Date or ISO string.');
}

function addDaysISO(dateISO: LocalDate, days: number): LocalDate {
  return addDaysToLocalDate(dateISO, days);
}

function daysBetweenISO(fromISO: string, toISO: string): number {
  const from = Date.parse(`${fromISO.slice(0, 10)}T00:00:00.000Z`);
  const to = Date.parse(`${toISO.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

function poundsToMinor(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

function minorToPounds(minor: number): number {
  return minor / 100;
}

function moneyMinor(minorUnits: number | null): Money | null {
  if (minorUnits === null) return null;
  return createMoney({ minorUnits, currency: GBP });
}

function moneyPounds(amount: number | null): Money | null {
  if (amount === null) return null;
  return moneyMinor(poundsToMinor(amount));
}

function instantOrNull(value: string | null | undefined): InstantString | null {
  if (value === null || value === undefined) return null;
  try {
    return createInstantString(value.includes('T') ? value : `${value}T00:00:00.000Z`);
  } catch {
    return null;
  }
}

function freshnessForInstant(
  value: string | null | undefined,
  todayISO: LocalDate,
): TrustedCoreFreshness {
  const instant = instantOrNull(value);
  if (instant === null) return 'missing';
  const ageDays = Math.max(0, daysBetweenISO(instant.slice(0, 10), todayISO));
  if (ageDays > BALANCE_STALE_DAYS) return 'stale';
  if (ageDays > BALANCE_AGEING_DAYS) return 'ageing';
  return 'fresh';
}

function balanceTruth(balance: CurrentBalance): TrustedCoreTruthClass {
  switch (balance.source) {
    case 'statement':
      return 'observed';
    case 'pdf-derived':
    case 'ocr-derived':
      return 'inferred';
    case 'corrected':
    case 'user-entered':
      return 'user_confirmed';
    case 'sample':
    default:
      return 'sample_demo';
  }
}

function row(
  factId: string,
  truthClass: TrustedCoreTruthClass,
  label: string,
  capturedAt: string | null | undefined,
  freshness: TrustedCoreFreshness,
): TrustedSafeRangeSourceBreakdown {
  return {
    factId,
    truthClass,
    label,
    capturedAt: instantOrNull(capturedAt),
    freshness,
  };
}

function issue(
  id: string,
  label: string,
  severity: TrustedSafeRangeIssue['severity'],
  sourceFactIds: readonly string[] = [],
): TrustedSafeRangeIssue {
  return { id, label, severity, sourceFactIds };
}

function evidenceNote(
  id: string,
  label: string,
  impact: TrustedSafeRangeEvidenceNote['impact'],
  sourceFactIds: readonly string[] = [],
): TrustedSafeRangeEvidenceNote {
  return { id, label, impact, sourceFactIds };
}

function uncertainty(
  id: string,
  label: string,
  amountMinor: number,
  direction: TrustedSafeRangeUncertaintySource['direction'],
  sourceFactIds: readonly string[],
): TrustedSafeRangeUncertaintySource {
  return {
    id,
    label,
    amount: createMoney({ minorUnits: Math.max(0, Math.round(amountMinor)), currency: GBP }),
    direction,
    sourceFactIds,
  };
}

function activeWorkspaceKind(state: AppState): 'personal' | 'business' | null {
  return (
    state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId)?.kind ?? null
  );
}

function buildContext(state: AppState, options: TrustedSafeRangeAdapterOptions): AdapterContext {
  const workspace = state.workspaces.find((candidate) => candidate.id === state.dataWorkspaceId);
  const now = normalizedNow(options.now, workspace?.timeZone ?? PERSONAL_WORKSPACE_TIME_ZONE);
  return {
    workspaceId: state.activeWorkspaceId,
    currency: GBP,
    calculatedAt: now.instant,
    todayISO: now.todayISO,
    horizonEndISO: addDaysISO(now.todayISO, HORIZON_DAYS),
  };
}

function nextDayOfMonth(fromISO: LocalDate, dayOfMonth: number): LocalDate {
  const yearMonth = fromISO.slice(0, 7);
  const resolved = resolvePayday({ dayOfMonth, weekendRule: 'previous' }, yearMonth);
  if (resolved >= fromISO) return createLocalDate(resolved);
  const year = Number(fromISO.slice(0, 4));
  const month = Number(fromISO.slice(5, 7));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return createLocalDate(
    resolvePayday(
      { dayOfMonth, weekendRule: 'previous' },
      `${nextYear}-${String(nextMonth).padStart(2, '0')}`,
    ),
  );
}

function debtEvents(state: AppState, todayISO: LocalDate): SafeRangeTimelineEvent[] {
  const debts = state.debts ?? [];
  return debts
    .filter((debt) => debt.balance > 0 && debt.minPayment > 0)
    .map((debt) => {
      const date = nextDayOfMonth(todayISO, Math.max(1, Math.min(31, debt.dueDom)));
      return {
        id: `debt-${debt.id}-${date}`,
        date,
        kind: 'out',
        source: 'manual',
        title: `${debt.name} minimum payment`,
        note: 'Debt minimum payment',
        amount: -debt.minPayment,
        recurring: 'monthly',
        factId: `fact_debt_${debt.id}`,
        truthClass: 'user_confirmed',
      } satisfies SafeRangeTimelineEvent;
    });
}

function transferKey(transaction: Transaction): string | null {
  const merchant = transaction.merchant.trim().toLowerCase();
  if (!merchant.includes('transfer')) return null;
  return `${transaction.when.slice(0, 10)}|${Math.abs(poundsToMinor(transaction.amount))}`;
}

function findExcludedTransfers(transactions: readonly Transaction[]): readonly string[] {
  const byKey = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const key = transferKey(transaction);
    if (key === null) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), transaction]);
  }
  const excluded: string[] = [];
  for (const candidates of byKey.values()) {
    const hasPositive = candidates.some((transaction) => transaction.amount > 0);
    const hasNegative = candidates.some((transaction) => transaction.amount < 0);
    if (hasPositive && hasNegative) {
      excluded.push(...candidates.map((transaction) => transaction.id));
    }
  }
  return excluded.sort();
}

function deriveTimeline(state: AppState, todayISO: LocalDate): SafeRangeTimelineEvent[] {
  const events = deriveCalendarEvents({
    subs: state.subs,
    subPaused: state.subPaused,
    subOverrides: state.subOverrides,
    onboarding: state.onboarding,
    manualEvents: state.calendarEvents,
    pots: state.pots,
    incomeSources: state.incomeSources ?? [],
    spendHold: state.spendHold ?? null,
    whatIfHolds: state.whatIfHolds ?? [],
    windowDays: HORIZON_DAYS,
    now: new Date(`${todayISO}T00:00:00.000Z`),
    includeSampleBills: state.currentBalance.source === 'sample',
  }).map((event) => {
    const sourceFact =
      event.source === 'payday'
        ? `fact_income_${event.id}`
        : event.source === 'sub'
          ? `fact_sub_${event.subName ?? event.title}`
          : event.source === 'pot'
            ? `fact_pot_${event.id}`
            : event.source === 'hold'
              ? `fact_hold_${event.id}`
              : event.source === 'bill'
                ? `fact_demo_bill_${event.title}`
                : event.source === 'manual'
                  ? `fact_manual_event_${event.id}`
                  : `fact_calendar_${event.id}`;
    const truthClass: TrustedCoreTruthClass =
      state.currentBalance.source === 'sample' && event.source === 'bill'
        ? 'sample_demo'
        : event.source === 'payday' || event.source === 'manual'
          ? 'user_confirmed'
          : event.source === 'hold'
            ? 'predicted'
            : event.source === 'pot'
              ? 'predicted'
              : event.source === 'sub'
                ? 'observed'
                : 'estimated';
    return {
      ...event,
      factId: sourceFact.replaceAll(' ', '_').replaceAll('·', '_'),
      truthClass,
    } satisfies SafeRangeTimelineEvent;
  });
  return [...events, ...debtEvents(state, todayISO)].sort((left, right) =>
    left.date === right.date
      ? left.id.localeCompare(right.id)
      : left.date.localeCompare(right.date),
  );
}

function buildForecastBundle(
  state: AppState,
  timeline: readonly SafeRangeTimelineEvent[],
  todayISO: LocalDate,
): ForecastBundle {
  const bankBalanceMinor = poundsToMinor(selectBankBalanceMinor(state));
  const potSavedMinor = poundsToMinor(state.pots.reduce((total, pot) => total + pot.saved, 0));
  const openingMinor = bankBalanceMinor - potSavedMinor;
  const occurrences = timeline
    .filter((event) => typeof event.amount === 'number')
    .map(
      (event): ForecastOccurrence => ({
        id: event.id,
        date: event.date,
        amountMinor: poundsToMinor(event.amount ?? 0),
        certainty:
          event.truthClass === 'sample_demo'
            ? 'estimated'
            : event.truthClass === 'predicted'
              ? 'estimated'
              : event.truthClass === 'inferred'
                ? 'inferred'
                : 'user-confirmed',
        protected: event.amount !== undefined && event.amount < 0,
        reference: event.factId,
      }),
    );
  const firstIncome = timeline.find(
    (event) => event.source === 'payday' && typeof event.amount === 'number' && event.amount > 0,
  );
  const forecastInput = {
    asOf: todayISO,
    accounts: {
      account_personal_spendable: { minorUnits: openingMinor, currency: 'GBP' },
    },
    expectations: occurrences,
    protectedFloorMinor: 0,
    baseCurrency: 'GBP',
    ...(firstIncome === undefined ? {} : { nextIncomeDate: firstIncome.date }),
  };
  const forecast = buildForecast(forecastInput);
  return {
    forecast,
    occurrences,
    excludedTransferIds: findExcludedTransfers(bankTransactions(state)),
  };
}

function safeForecastBundle(
  state: AppState,
  timeline: readonly SafeRangeTimelineEvent[],
  todayISO: LocalDate,
): ForecastBundle {
  try {
    return buildForecastBundle(state, timeline, todayISO);
  } catch {
    return { forecast: null, occurrences: [], excludedTransferIds: [] };
  }
}

function dailySpendEstimateMinor(state: AppState, routeOutgoingTotal: number | undefined): number {
  const bankTxns = bankTransactions(state).filter((txn) => txn.amount < 0);
  if (bankTxns.length === 0) return 0;
  const monthly =
    routeOutgoingTotal !== undefined && routeOutgoingTotal > 0 ? routeOutgoingTotal : 0;
  return monthly > 0 ? Math.round(poundsToMinor(monthly) / 30) : 0;
}

function reviewUncertainty(
  reviewQueue: readonly ReviewItem[],
  readerCandidates: readonly unknown[],
) {
  const pendingReviewMinor = reviewQueue.reduce(
    (total, item) => total + (item.amount < 0 ? Math.abs(poundsToMinor(item.amount)) : 0),
    0,
  );
  const pendingIncomeMinor = reviewQueue.reduce(
    (total, item) => total + (item.amount > 0 ? poundsToMinor(item.amount) : 0),
    0,
  );
  return {
    pendingReviewMinor,
    pendingIncomeMinor,
    pendingCount: reviewQueue.length + readerCandidates.length,
  };
}

function openPotBorrowMinor(entries: readonly PotLedgerEntry[]): number {
  let borrowed = 0;
  let repaid = 0;
  for (const entry of entries) {
    if (entry.kind === 'borrow') borrowed += poundsToMinor(entry.amount);
    if (entry.kind === 'repay') repaid += poundsToMinor(entry.amount);
  }
  return Math.max(0, borrowed - repaid);
}

function hasDeclaredOutflows(state: AppState): boolean {
  return (
    state.subs.length > 0 ||
    (state.debts?.length ?? 0) > 0 ||
    state.pots.some((pot) => pot.perWeek > 0 || pot.saved > 0) ||
    state.calendarEvents.some((event) => typeof event.amount === 'number' && event.amount < 0) ||
    bankTransactions(state).some((txn) => txn.amount < 0)
  );
}

function incomeHistoryExists(state: AppState): boolean {
  return bankTransactions(state).some((txn) => txn.amount > 0);
}

function duplicateSubContradictions(subs: readonly Sub[]): TrustedSafeRangeIssue[] {
  const byName = new Map<string, Sub>();
  const out: TrustedSafeRangeIssue[] = [];
  for (const sub of subs) {
    const key = sub.name.trim().toLowerCase();
    const existing = byName.get(key);
    if (existing !== undefined && Math.abs(existing.cost - sub.cost) >= 0.01) {
      out.push(
        issue(
          `contradiction_sub_${key.replace(/[^a-z0-9]+/g, '_')}`,
          `${sub.name} has two different recurring amounts.`,
          'blocker',
          [`fact_sub_${existing.name}`, `fact_sub_${sub.name}`],
        ),
      );
    }
    byName.set(key, sub);
  }
  return out;
}

function balanceContradictions(state: AppState): TrustedSafeRangeIssue[] {
  const accounts = state.accounts ?? [];
  if (accounts.length === 0) return [];
  const bankTotal = selectBankBalanceMinor(state);
  if (Math.abs(bankTotal - state.currentBalance.amount) < 0.01) return [];
  return [
    issue(
      'contradiction_current_balance_accounts',
      'Current balance and account balances disagree.',
      'blocker',
      ['fact_current_balance', 'fact_accounts_bank_total'],
    ),
  ];
}

function migrationIssues(
  state: AppState,
  options: TrustedSafeRangeAdapterOptions,
): TrustedSafeRangeIssue[] {
  const issues: TrustedSafeRangeIssue[] = [];
  if (state.schemaVersion < 16) {
    issues.push(
      issue(
        'old_schema_missing_truth_metadata',
        'This local state predates the full truth metadata shape.',
        'caution',
        ['fact_migration_schema'],
      ),
    );
  }
  if (options.restoredFromEncryptedBackup === true) {
    issues.push(
      issue(
        'restored_encrypted_backup',
        'This answer is based on a restored encrypted backup snapshot.',
        'caution',
        ['fact_restore_snapshot'],
      ),
    );
  }
  return issues;
}

function sourceBreakdown(
  state: AppState,
  timeline: readonly SafeRangeTimelineEvent[],
  todayISO: LocalDate,
): TrustedSafeRangeSourceBreakdown[] {
  const balanceFreshness = freshnessForInstant(state.currentBalance.setAt, todayISO);
  const rows: TrustedSafeRangeSourceBreakdown[] = [
    row(
      'fact_current_balance',
      balanceTruth(state.currentBalance),
      'Current balance',
      state.currentBalance.setAt,
      balanceFreshness,
    ),
    row(
      'fact_accounts_bank_total',
      state.accounts && state.accounts.length > 0 ? 'observed' : balanceTruth(state.currentBalance),
      'Bank-only account total',
      state.accounts?.[0]?.balanceAsOfISO ?? state.currentBalance.setAt,
      freshnessForInstant(
        state.accounts?.[0]?.balanceAsOfISO ?? state.currentBalance.setAt,
        todayISO,
      ),
    ),
  ];

  for (const source of state.incomeSources ?? []) {
    rows.push(
      row(
        `fact_income_source_${source.id}`,
        source.source === 'inferred' ? 'inferred' : 'user_confirmed',
        `${source.label} income`,
        state.currentBalance.setAt,
        balanceFreshness,
      ),
    );
  }
  for (const event of timeline) {
    if (typeof event.amount !== 'number') continue;
    rows.push(
      row(event.factId, event.truthClass, event.title, state.currentBalance.setAt, 'fresh'),
    );
  }
  for (const item of state.reviewQueue ?? []) {
    rows.push(
      row(
        `fact_review_${item.id}`,
        'inferred',
        `Review candidate: ${item.merchant}`,
        item.addedAt,
        freshnessForInstant(item.addedAt, todayISO),
      ),
    );
  }
  return rows;
}

function sourceFreshnessDetail(
  sources: readonly TrustedSafeRangeSourceBreakdown[],
): TrustedSafeRangeResult['freshnessDetail'] {
  const material = sources.filter((source) => source.capturedAt !== null);
  const oldest = material
    .map((source) => source.capturedAt)
    .filter((capturedAt): capturedAt is InstantString => capturedAt !== null)
    .sort()[0];
  const status: TrustedCoreFreshness = sources.some((source) => source.freshness === 'stale')
    ? 'stale'
    : sources.some((source) => source.freshness === 'ageing')
      ? 'ageing'
      : sources.some((source) => source.freshness === 'missing')
        ? 'missing'
        : 'fresh';
  return {
    status,
    oldestMaterialSourceAt: oldest ?? null,
    affectedSourceIds: sources
      .filter((source) => source.freshness === 'stale' || source.freshness === 'missing')
      .map((source) => source.factId),
    summary:
      status === 'fresh'
        ? 'Material sources are fresh.'
        : status === 'ageing'
          ? 'Some material sources are ageing.'
          : status === 'stale'
            ? 'Some material sources are stale.'
            : 'Some material sources are missing.',
  };
}

function missingInputs(
  state: AppState,
  todayISO: LocalDate,
  timeline: readonly SafeRangeTimelineEvent[],
): TrustedSafeRangeIssue[] {
  const missing: TrustedSafeRangeIssue[] = [];
  const userOwnedBalance =
    state.currentBalance.source !== 'sample' &&
    (state.currentBalance.amount !== 0 ||
      (state.statementImports?.length ?? 0) > 0 ||
      bankTransactions(state).length > 0);
  if (!userOwnedBalance && state.currentBalance.source !== 'sample') {
    missing.push(
      issue('missing_balance', 'Current balance is missing or unconfirmed.', 'blocker', [
        'fact_current_balance',
      ]),
    );
  }

  const hasIncomeSources = (state.incomeSources?.length ?? 0) > 0;
  const hasIncome =
    hasIncomeSources || state.onboarding.monthlyIncome > 0 || incomeHistoryExists(state);
  if (!hasIncome) {
    missing.push(
      issue('missing_income', 'Income is missing.', 'blocker', ['fact_income_schedule']),
    );
  }
  if (!hasIncomeSources && state.onboarding.monthlyIncome > 0) {
    if (
      !Number.isInteger(state.onboarding.payday) ||
      state.onboarding.payday < 1 ||
      state.onboarding.payday > 31
    ) {
      missing.push(
        issue('missing_payday', 'Payday is missing.', 'blocker', ['fact_income_schedule']),
      );
    }
  }

  const materialOutflowInWindow = timeline.some(
    (event) => typeof event.amount === 'number' && event.amount < 0,
  );
  if (!hasDeclaredOutflows(state) && !materialOutflowInWindow && state.onboarding.done) {
    missing.push(
      issue(
        'missing_material_bill',
        'No material bills or commitments have been confirmed yet.',
        'caution',
        ['fact_recurring_obligations'],
      ),
    );
  }

  const invalidIncomeSources = (state.incomeSources ?? []).filter((source) => {
    if (source.cadence === 'monthly') {
      const dayOfMonth = source.dayOfMonth;
      return (
        !Number.isInteger(dayOfMonth) ||
        dayOfMonth === undefined ||
        dayOfMonth < 1 ||
        dayOfMonth > 31
      );
    }
    if (
      source.cadence === 'weekly' ||
      source.cadence === 'fortnightly' ||
      source.cadence === 'four-weekly'
    ) {
      return source.anchorISO === undefined;
    }
    return false;
  });
  for (const source of invalidIncomeSources) {
    missing.push(
      issue(
        `missing_income_anchor_${source.id}`,
        `${source.label} is missing the date needed for its income cadence.`,
        'blocker',
        [`fact_income_source_${source.id}`],
      ),
    );
  }

  void todayISO;
  return missing;
}

function uncertaintySources(
  state: AppState,
  routeOutgoingTotal: number | undefined,
  timeline: readonly SafeRangeTimelineEvent[],
  todayISO: LocalDate,
): TrustedSafeRangeUncertaintySource[] {
  const sources: TrustedSafeRangeUncertaintySource[] = [];
  const freshness = freshnessForInstant(state.currentBalance.setAt, todayISO);
  if (freshness === 'stale') {
    const staleDays = Math.max(
      1,
      daysBetweenISO(state.currentBalance.setAt.slice(0, 10), todayISO),
    );
    const dailySpend = dailySpendEstimateMinor(state, routeOutgoingTotal);
    if (dailySpend > 0) {
      sources.push(
        uncertainty(
          'uncertainty_stale_balance',
          `${staleDays} days of usual spend may be missing from the balance.`,
          dailySpend * staleDays,
          'widens_down',
          ['fact_current_balance'],
        ),
      );
    }
  }

  for (const event of timeline) {
    if (typeof event.amount !== 'number' || event.amount >= 0) continue;
    const text = `${event.title} ${event.note ?? ''}`.toLowerCase();
    if (text.includes('variable') || text.includes('estimate') || text.includes('estimated')) {
      sources.push(
        uncertainty(
          `uncertainty_variable_${event.id}`,
          `${event.title} is variable.`,
          Math.round(Math.abs(poundsToMinor(event.amount)) * VARIABLE_BILL_UNCERTAINTY_RATIO),
          'widens_down',
          [event.factId],
        ),
      );
    }
  }

  const review = reviewUncertainty(state.reviewQueue ?? [], state.readerCandidates);
  if (review.pendingReviewMinor > 0) {
    sources.push(
      uncertainty(
        'uncertainty_pending_review_outflows',
        'Pending review outflows are not posted facts yet.',
        review.pendingReviewMinor,
        'widens_down',
        ['fact_review_queue'],
      ),
    );
  }
  if (review.pendingIncomeMinor > 0) {
    sources.push(
      uncertainty(
        'uncertainty_pending_review_income',
        'Pending review income is not posted fact yet.',
        review.pendingIncomeMinor,
        'widens_up',
        ['fact_review_queue'],
      ),
    );
  }

  const refundTotal = state.calendarEvents
    .filter((event) => typeof event.amount === 'number' && event.amount > 0)
    .filter((event) => `${event.title} ${event.note ?? ''}`.toLowerCase().includes('refund'))
    .reduce((sum, event) => sum + poundsToMinor(event.amount ?? 0), 0);
  if (refundTotal > 0) {
    sources.push(
      uncertainty(
        'uncertainty_pending_refund',
        'A pending refund could improve the range if it lands on time.',
        refundTotal,
        'widens_up',
        ['fact_pending_refund'],
      ),
    );
  }

  const openBorrow = openPotBorrowMinor(state.potLedger);
  if (openBorrow > 0) {
    sources.push(
      uncertainty(
        'uncertainty_borrowed_pot_funds',
        'Borrowed pot funds need explicit repayment.',
        openBorrow,
        'widens_down',
        ['fact_pot_borrow'],
      ),
    );
  }

  return sources.filter((source) => source.amount.minorUnits > 0);
}

function rangeMath(
  state: AppState,
  forecast: ForecastResult | null,
  routeTightestMinor: number | null,
  routeTightestDate: string | null,
  uncertainties: readonly TrustedSafeRangeUncertaintySource[],
): RangeMath {
  const currentKnownMinor = poundsToMinor(selectBankBalanceMinor(state));
  const tightestMinor =
    forecast?.lowestMinor ??
    routeTightestMinor ??
    (Number.isFinite(currentKnownMinor) ? currentKnownMinor : null);
  const tightestDateISO =
    forecast?.points.find((point) => point.closingMinor === forecast.lowestMinor)?.date ??
    (routeTightestDate !== null ? createLocalDate(routeTightestDate) : null);

  if (tightestMinor === null) {
    return {
      lowerMinor: null,
      upperMinor: null,
      conservativeMinor: null,
      tightestMinor: null,
      tightestDateISO: null,
      currentKnownMinor,
      committedFloorMinor: null,
    };
  }

  const down = uncertainties
    .filter((source) => source.direction === 'widens_down' || source.direction === 'widens_both')
    .reduce((sum, source) => sum + source.amount.minorUnits, 0);
  const up = uncertainties
    .filter((source) => source.direction === 'widens_up' || source.direction === 'widens_both')
    .reduce((sum, source) => sum + source.amount.minorUnits, 0);
  return {
    lowerMinor: tightestMinor - down,
    upperMinor: tightestMinor + up,
    conservativeMinor: tightestMinor - down,
    tightestMinor,
    tightestDateISO,
    currentKnownMinor,
    committedFloorMinor: tightestMinor,
  };
}

function statusFor(input: {
  workspaceBlocked: boolean;
  missing: readonly TrustedSafeRangeIssue[];
  contradictions: readonly TrustedSafeRangeIssue[];
  freshness: TrustedCoreFreshness;
  truthClass: TrustedCoreTruthClass;
  conservativeMinor: number | null;
  uncertainties: readonly TrustedSafeRangeUncertaintySource[];
}): TrustedSafeRangeStatus {
  if (input.workspaceBlocked) return 'workspace_blocked';
  if (input.missing.some((item) => item.severity === 'blocker')) return 'insufficient_data';
  if (input.contradictions.length > 0) return 'contradicted';
  if (input.conservativeMinor !== null && input.conservativeMinor < 0) return 'shortfall';
  if (input.freshness === 'stale') return 'stale';
  if (input.truthClass === 'sample_demo') return 'sample_demo';
  if (input.uncertainties.length > 0 || input.missing.length > 0) return 'caution';
  return 'ready';
}

function truthFor(
  state: AppState,
  missing: readonly TrustedSafeRangeIssue[],
  contradictions: readonly TrustedSafeRangeIssue[],
  freshness: TrustedCoreFreshness,
): TrustedCoreTruthClass {
  if (contradictions.length > 0) return 'contradicted';
  if (missing.some((item) => item.severity === 'blocker')) return 'missing';
  if (freshness === 'stale') return 'stale';
  return balanceTruth(state.currentBalance);
}

function causes(
  state: AppState,
  timeline: readonly SafeRangeTimelineEvent[],
  tightestDateISO: LocalDate | null,
): TrustedSafeRangeCause[] {
  const outflows = timeline
    .filter((event) => typeof event.amount === 'number' && event.amount < 0)
    .filter((event) => tightestDateISO === null || event.date <= tightestDateISO)
    .sort((left, right) => Math.abs(right.amount ?? 0) - Math.abs(left.amount ?? 0))
    .slice(0, 4)
    .map((event) => {
      const cause: {
        label: string;
        amount: Money;
        dateISO?: LocalDate;
        sourceFactIds: readonly string[];
      } = {
        label: event.title,
        amount: moneyPounds(event.amount ?? 0) ?? createMoney({ minorUnits: 0, currency: GBP }),
        sourceFactIds: [event.factId],
      };
      if (/^\d{4}-\d{2}-\d{2}$/.test(event.date)) cause.dateISO = createLocalDate(event.date);
      return cause satisfies TrustedSafeRangeCause;
    });
  const potSaved = state.pots.reduce((total, pot) => total + pot.saved, 0);
  if (potSaved > 0) {
    outflows.unshift({
      label: 'Money already set aside in pots',
      amount: moneyPounds(-potSaved) ?? createMoney({ minorUnits: 0, currency: GBP }),
      sourceFactIds: ['fact_pots_saved'],
    });
  }
  return outflows.slice(0, 5);
}

function evidenceNotes(
  state: AppState,
  missing: readonly TrustedSafeRangeIssue[],
  contradictions: readonly TrustedSafeRangeIssue[],
  uncertainties: readonly TrustedSafeRangeUncertaintySource[],
  forecast: ForecastResult | null,
  options: TrustedSafeRangeAdapterOptions,
  routeOutgoingTotal: number | undefined,
): TrustedSafeRangeEvidenceNote[] {
  const notes: TrustedSafeRangeEvidenceNote[] = [];
  const balance = state.currentBalance;
  notes.push(
    evidenceNote(
      `evidence_balance_${balance.source}`,
      balance.source === 'sample'
        ? 'The current balance is sample data.'
        : balance.source === 'user-entered'
          ? 'The current balance was entered by the user.'
          : balance.source === 'corrected'
            ? 'The current balance was corrected by the user.'
            : 'The current balance came from a statement or document.',
      balance.source === 'sample' ? 'limits' : 'supports',
      ['fact_current_balance'],
    ),
  );
  if (forecast !== null) {
    notes.push(
      evidenceNote(
        'evidence_finance_engine_forecast',
        'The range is calculated through the finance forecast engine.',
        'supports',
        ['fact_forecast_engine'],
      ),
    );
  }
  const incomeSources = state.incomeSources ?? [];
  if (
    incomeSources.some(
      (source) =>
        source.cadence === 'weekly' ||
        source.cadence === 'fortnightly' ||
        source.cadence === 'four-weekly' ||
        source.cadence === 'last-working-day',
    )
  ) {
    notes.push(
      evidenceNote(
        'evidence_irregular_income_cadence',
        'Income cadence is not a single fixed monthly payday.',
        'limits',
        incomeSources.map((source) => `fact_income_source_${source.id}`),
      ),
    );
  }
  if (incomeSources.length > 1) {
    notes.push(
      evidenceNote(
        'evidence_multiple_paydays',
        'Multiple income sources shape the range.',
        'supports',
        incomeSources.map((source) => `fact_income_source_${source.id}`),
      ),
    );
  }
  if (
    routeOutgoingTotal === undefined ||
    routeOutgoingTotal <= 0 ||
    bankTransactions(state).length === 0
  ) {
    notes.push(
      evidenceNote(
        'evidence_no_daily_spend_history',
        'There is no daily-spend history to quantify stale-balance uncertainty.',
        'limits',
        ['fact_transaction_history'],
      ),
    );
  }
  for (const item of missing) {
    notes.push(
      evidenceNote(
        `evidence_${item.id}`,
        item.label,
        item.severity === 'blocker' ? 'blocks' : 'limits',
        item.sourceFactIds,
      ),
    );
  }
  for (const item of contradictions) {
    notes.push(evidenceNote(`evidence_${item.id}`, item.label, 'blocks', item.sourceFactIds));
  }
  for (const source of uncertainties) {
    notes.push(evidenceNote(`evidence_${source.id}`, source.label, 'limits', source.sourceFactIds));
  }
  if (options.restoredFromEncryptedBackup === true) {
    notes.push(
      evidenceNote(
        'evidence_restored_backup',
        'The current answer uses a restored encrypted backup snapshot.',
        'limits',
        ['fact_restore_snapshot'],
      ),
    );
  }
  return notes;
}

function whyChanged(
  previous: TrustedSafeRangeResult | null | undefined,
  range: RangeMath,
  causesList: readonly TrustedSafeRangeCause[],
  missing: readonly TrustedSafeRangeIssue[],
  contradictions: readonly TrustedSafeRangeIssue[],
): TrustedSafeRangeIssue[] {
  const items: TrustedSafeRangeIssue[] = [];
  if (
    previous?.expectedRange.min?.minorUnits !== undefined &&
    range.lowerMinor !== null &&
    Math.abs(range.lowerMinor - previous.expectedRange.min.minorUnits) >= MATERIAL_DIVERGENCE_MINOR
  ) {
    const delta = range.lowerMinor - previous.expectedRange.min.minorUnits;
    items.push(
      issue(
        'changed_expected_range',
        `Expected range ${delta < 0 ? 'fell' : 'rose'} by £${Math.round(Math.abs(delta) / 100)}.`,
        'info',
        ['fact_previous_safe_range'],
      ),
    );
  }
  for (const causeItem of causesList.slice(0, 2)) {
    items.push(
      issue(
        `changed_${causeItem.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        `${causeItem.label} shapes the tightest point.`,
        'info',
        causeItem.sourceFactIds,
      ),
    );
  }
  for (const item of [...missing, ...contradictions].slice(0, 2)) {
    items.push(item);
  }
  return items;
}

function nextActionFor(input: {
  status: TrustedSafeRangeStatus;
  missing: readonly TrustedSafeRangeIssue[];
  contradictions: readonly TrustedSafeRangeIssue[];
  pendingReviewCount: number;
  shortfallMinor: number | null;
  freshness: TrustedCoreFreshness;
}): TrustedSafeRangeNextAction | null {
  const missingBlocker = input.missing.find((item) => item.severity === 'blocker');
  if (missingBlocker !== undefined) {
    return {
      id: 'complete_money_picture',
      label: 'Complete your money picture',
      route: 'account',
      reason: missingBlocker.label,
      sourceFactIds: missingBlocker.sourceFactIds,
    };
  }
  if (input.contradictions.length > 0) {
    return {
      id: 'resolve_contradictions',
      label: 'Resolve conflicting money facts',
      route: 'review',
      reason: input.contradictions[0]?.label ?? 'Conflicting facts need review.',
      sourceFactIds: input.contradictions.flatMap((item) => item.sourceFactIds),
    };
  }
  if (input.pendingReviewCount > 0) {
    return {
      id: 'review_pending_items',
      label: 'Check waiting items',
      route: 'review',
      reason: `${input.pendingReviewCount} item${input.pendingReviewCount === 1 ? '' : 's'} can change the range.`,
      sourceFactIds: ['fact_review_queue'],
    };
  }
  if (input.shortfallMinor !== null && input.shortfallMinor > 0) {
    return {
      id: 'open_recovery',
      label: 'Open Recovery',
      route: 'recovery',
      reason: `The conservative range is short by £${Math.round(input.shortfallMinor / 100)}.`,
      sourceFactIds: ['fact_safe_range_shortfall'],
    };
  }
  if (input.freshness === 'stale') {
    return {
      id: 'refresh_balance',
      label: 'Refresh your balance',
      route: 'account',
      reason: 'A stale balance can hide recent spend.',
      sourceFactIds: ['fact_current_balance'],
    };
  }
  if (input.status === 'sample_demo') {
    return {
      id: 'replace_sample_data',
      label: 'Replace sample numbers',
      route: 'start',
      reason: 'Sample data cannot be relied on for spending decisions.',
      sourceFactIds: ['fact_current_balance'],
    };
  }
  return null;
}

function firstIncomeDate(timeline: readonly SafeRangeTimelineEvent[]): string | null {
  return (
    timeline.find(
      (event) => event.source === 'payday' && typeof event.amount === 'number' && event.amount > 0,
    )?.date ?? null
  );
}

function relianceFor(status: TrustedSafeRangeStatus, blockingIds: readonly string[]) {
  if (status === 'ready') {
    return {
      reliance: 'safe_to_rely' as const,
      canUserRelyOnAnswer: true,
      detail: {
        safeToRelyOn: true,
        label: 'Safe to rely on for day-to-day spending decisions.',
        blockedBy: [],
      },
    };
  }
  if (status === 'caution' || status === 'shortfall' || status === 'stale') {
    return {
      reliance: 'use_caution' as const,
      canUserRelyOnAnswer: false,
      detail: {
        safeToRelyOn: false,
        label: 'Use caution before relying on this answer.',
        blockedBy: blockingIds,
      },
    };
  }
  if (status === 'sample_demo') {
    return {
      reliance: 'provisional' as const,
      canUserRelyOnAnswer: false,
      detail: {
        safeToRelyOn: false,
        label: 'This is provisional because it is based on sample data.',
        blockedBy: blockingIds,
      },
    };
  }
  return {
    reliance: 'blocked' as const,
    canUserRelyOnAnswer: false,
    detail: {
      safeToRelyOn: false,
      label: 'Do not rely on this answer until blockers are resolved.',
      blockedBy: blockingIds,
    },
  };
}

function legacySafeZoneSnapshot(
  state: AppState,
  routeTightestMinor: number | null,
  routeTightestDate: string | null,
  todayISO: LocalDate,
): LegacySafeZoneSnapshot {
  if (routeTightestMinor === null) {
    return { totalMinor: null, perDayMinor: null, untilISO: null, daysLeft: 0 };
  }
  const balanceMinor = poundsToMinor(selectBankBalanceMinor(state));
  const shieldMinor = state.subs.reduce((sum, sub) => {
    if (state.subPaused[sub.name]) return sum;
    if (routeTightestDate === null) return sum;
    const daysToTight = Math.max(0, daysBetweenISO(todayISO, routeTightestDate));
    if (sub.nextRenewalDaysAway < 0 || sub.nextRenewalDaysAway > daysToTight) return sum;
    return sum + poundsToMinor(sub.cost);
  }, 0);
  const bufferMinor = poundsToMinor(Math.max(0, state.bufferAmount ?? 100));
  const totalMinor = Math.floor((balanceMinor - shieldMinor - bufferMinor) / 100) * 100;
  const daysLeft =
    routeTightestDate === null ? 0 : Math.max(1, daysBetweenISO(todayISO, routeTightestDate));
  return {
    totalMinor,
    perDayMinor:
      daysLeft > 0 ? Math.floor(Math.max(0, totalMinor) / daysLeft / 100) * 100 : totalMinor,
    untilISO: routeTightestDate === null ? null : createLocalDate(routeTightestDate),
    daysLeft,
  };
}

export function compareTrustedSafeRangeWithLegacy(
  result: TrustedSafeRangeResult,
  legacy: LegacySafeZoneSnapshot,
): TrustedSafeRangeLegacyComparison {
  const trusted = result.conservativeBoundary?.minorUnits ?? null;
  const legacyMinor = legacy.totalMinor;
  if (trusted === null || legacyMinor === null) {
    return {
      legacyTightestMinor: legacyMinor,
      trustedConservativeBoundaryMinor: trusted,
      deltaMinor: null,
      material: false,
      reason: 'comparison unavailable because one side did not produce a number',
    };
  }
  const delta = trusted - legacyMinor;
  return {
    legacyTightestMinor: legacyMinor,
    trustedConservativeBoundaryMinor: trusted,
    deltaMinor: delta,
    material: Math.abs(delta) >= MATERIAL_DIVERGENCE_MINOR,
    reason:
      Math.abs(delta) >= MATERIAL_DIVERGENCE_MINOR
        ? 'trusted Safe Range materially diverges from legacy Safe Zone'
        : 'trusted Safe Range is within the temporary legacy tolerance',
  };
}

function buildBlockedResult(
  ctx: AdapterContext,
  status: TrustedSafeRangeStatus,
  truthClass: TrustedCoreTruthClass,
  missing: readonly TrustedSafeRangeIssue[],
  contradictions: readonly TrustedSafeRangeIssue[],
  sourceRows: readonly TrustedSafeRangeSourceBreakdown[],
): TrustedSafeRangeResult {
  const freshnessDetail = sourceFreshnessDetail(sourceRows);
  const reliance = relianceFor(
    status,
    [...missing, ...contradictions].map((item) => item.id),
  );
  return {
    workspaceId: ctx.workspaceId,
    currency: ctx.currency,
    calculatedAt: ctx.calculatedAt,
    horizonStartISO: ctx.todayISO,
    horizonEndISO: ctx.horizonEndISO,
    status,
    truthClass,
    currentPosition: {
      amount: null,
      truthClass,
      label: 'Current position unavailable',
      sourceFactIds: ['fact_current_balance'],
      observedAt: null,
    },
    committedFloor: {
      amount: null,
      truthClass,
      label: 'Committed floor unavailable',
      sourceFactIds: [],
      observedAt: null,
    },
    expectedRange: {
      min: null,
      max: null,
      basis: 'unavailable',
      uncertaintySources: [],
    },
    tightestPoint: { dateISO: null, amount: null, sourceFactIds: [] },
    shortfall: null,
    evidenceNotes: [
      ...missing.map((item) =>
        evidenceNote(
          `evidence_${item.id}`,
          item.label,
          item.severity === 'blocker' ? 'blocks' : 'limits',
          item.sourceFactIds,
        ),
      ),
      ...contradictions.map((item) =>
        evidenceNote(`evidence_${item.id}`, item.label, 'blocks', item.sourceFactIds),
      ),
    ],
    freshnessDetail,
    missingInputs: missing,
    contradictions,
    relianceDetail: reliance.detail,
    whyChanged: [...missing, ...contradictions],
    nextAction: nextActionFor({
      status,
      missing,
      contradictions,
      pendingReviewCount: 0,
      shortfallMinor: null,
      freshness: freshnessDetail.status,
    }),
    currentKnownPosition: null,
    knownCommittedFloor: null,
    expectedSafeMin: null,
    expectedSafeMax: null,
    conservativeBoundary: null,
    reliance: reliance.reliance,
    freshness: freshnessDetail.status,
    missingMaterialInfo: [...missing, ...contradictions].map((item) => item.label),
    assumptions: [],
    mainCauses: [],
    wouldChangeIf: [...missing, ...contradictions].map((item) => item.label),
    sourceBreakdown: sourceRows,
    forecastVersionId: createForecastId('forecast_safe_range_v1'),
    provenanceId: createProvenanceId('provenance_safe_range_v1'),
    canUserRelyOnAnswer: reliance.canUserRelyOnAnswer,
  };
}

export function buildTrustedSafeRangeFromAppState(
  state: AppState,
  options: TrustedSafeRangeAdapterOptions,
): TrustedSafeRangeResult {
  const ctx = buildContext(state, options);
  const kind = activeWorkspaceKind(state);
  if (kind !== 'personal' || state.dataWorkspaceId !== state.activeWorkspaceId) {
    return buildBlockedResult(
      ctx,
      'workspace_blocked',
      'missing',
      [
        issue(
          'personal_workspace_required',
          'Trusted Safe Range only reads the active Personal workspace.',
          'blocker',
          ['fact_workspace_boundary'],
        ),
      ],
      state.dataWorkspaceId === state.activeWorkspaceId
        ? []
        : [
            issue(
              'workspace_data_owner_mismatch',
              'Visible workspace and data workspace do not match.',
              'blocker',
              ['fact_workspace_boundary'],
            ),
          ],
      [],
    );
  }

  let route: ReturnType<typeof routeFromStore> | null = null;
  let timeline: SafeRangeTimelineEvent[] = [];
  let routeError: TrustedSafeRangeIssue | null = null;
  try {
    route = routeFromStore(state, ctx.todayISO);
    timeline = deriveTimeline(state, ctx.todayISO);
  } catch (error) {
    routeError = issue(
      'forecast_input_invalid',
      error instanceof Error ? error.message : 'Forecast inputs are invalid.',
      'blocker',
      ['fact_forecast_input'],
    );
  }

  const sourceRows = sourceBreakdown(state, timeline, ctx.todayISO);
  const freshnessDetail = sourceFreshnessDetail(sourceRows);
  const missing = [
    ...missingInputs(state, ctx.todayISO, timeline),
    ...migrationIssues(state, options),
    ...(routeError === null ? [] : [routeError]),
  ];
  const contradictions = [
    ...balanceContradictions(state),
    ...duplicateSubContradictions(state.subs),
  ];
  const uncertainties = uncertaintySources(state, route?.outgoingTotal, timeline, ctx.todayISO);
  const forecastBundle =
    routeError === null ? safeForecastBundle(state, timeline, ctx.todayISO) : null;
  const routeTightestMinor = route === null ? null : poundsToMinor(route.tightPoint.amount);
  const range = rangeMath(
    state,
    forecastBundle?.forecast ?? null,
    routeTightestMinor,
    route?.tightPoint.date ?? null,
    uncertainties,
  );
  const truthClass = truthFor(state, missing, contradictions, freshnessDetail.status);
  const status = statusFor({
    workspaceBlocked: false,
    missing,
    contradictions,
    freshness: freshnessDetail.status,
    truthClass,
    conservativeMinor: range.conservativeMinor,
    uncertainties,
  });
  const causesList = causes(state, timeline, range.tightestDateISO);
  const pendingReviewCount = (state.reviewQueue?.length ?? 0) + state.readerCandidates.length;
  const shortfallMinor =
    range.conservativeMinor !== null && range.conservativeMinor < 0
      ? Math.abs(range.conservativeMinor)
      : null;
  const evidenceNoteList = evidenceNotes(
    state,
    missing,
    contradictions,
    uncertainties,
    forecastBundle?.forecast ?? null,
    options,
    route?.outgoingTotal,
  );
  const reliance = relianceFor(
    status,
    [...missing, ...contradictions].map((item) => item.id),
  );
  const rangeBlocked = status === 'insufficient_data' || status === 'workspace_blocked';
  const rangeBasis =
    rangeBlocked || range.lowerMinor === null || range.upperMinor === null
      ? 'unavailable'
      : uncertainties.length > 0
        ? 'explicit_uncertainty'
        : 'exact_known_path';
  const expectedLowerMinor = rangeBlocked ? null : range.lowerMinor;
  const expectedUpperMinor = rangeBlocked ? null : range.upperMinor;
  const conservativeMinor = rangeBlocked ? null : range.conservativeMinor;
  const shortfallForResult = rangeBlocked ? null : shortfallMinor;
  const assumptions = [
    ...(state.currentBalance.source === 'sample'
      ? ['sample figures are not the user’s money']
      : []),
    ...(forecastBundle?.excludedTransferIds.length
      ? ['matched transfer pairs are excluded from spend/income totals']
      : []),
    ...uncertainties.map((source) => source.label),
  ];
  const wouldChangeIf = [
    ...missing.map((item) => item.label),
    ...contradictions.map((item) => item.label),
    ...uncertainties.map((source) => source.label),
    ...(range.tightestDateISO !== null &&
    ((state.incomeSources ?? []).length > 0
      ? nextIncomeDate(state.incomeSources ?? [], ctx.todayISO)
      : firstIncomeDate(timeline)) !== null &&
    ((state.incomeSources ?? []).length > 0
      ? nextIncomeDate(state.incomeSources ?? [], ctx.todayISO)
      : firstIncomeDate(timeline))! > range.tightestDateISO
      ? ['income lands after the current tight point']
      : []),
  ];
  const currentPositionAmount = moneyMinor(range.currentKnownMinor);
  const committedFloorAmount = moneyMinor(range.committedFloorMinor);
  const result: TrustedSafeRangeResult = {
    workspaceId: ctx.workspaceId,
    currency: ctx.currency,
    calculatedAt: ctx.calculatedAt,
    horizonStartISO: ctx.todayISO,
    horizonEndISO: ctx.horizonEndISO,
    status,
    truthClass,
    currentPosition: {
      amount: currentPositionAmount,
      truthClass: balanceTruth(state.currentBalance),
      label: 'Current bank position',
      sourceFactIds: ['fact_current_balance', 'fact_accounts_bank_total'],
      observedAt: instantOrNull(state.currentBalance.setAt),
    },
    committedFloor: {
      amount: committedFloorAmount,
      truthClass: range.committedFloorMinor === null ? 'missing' : 'predicted',
      label: 'Known committed floor',
      sourceFactIds: causesList.flatMap((causeItem) => causeItem.sourceFactIds),
      observedAt: ctx.calculatedAt,
    },
    expectedRange: {
      min: moneyMinor(expectedLowerMinor),
      max: moneyMinor(expectedUpperMinor),
      basis: rangeBasis,
      uncertaintySources: rangeBlocked ? [] : uncertainties,
    },
    tightestPoint: {
      dateISO: range.tightestDateISO,
      amount: moneyMinor(range.tightestMinor),
      sourceFactIds: causesList.flatMap((causeItem) => causeItem.sourceFactIds),
    },
    shortfall: moneyMinor(shortfallForResult),
    evidenceNotes: evidenceNoteList,
    freshnessDetail,
    missingInputs: missing,
    contradictions,
    relianceDetail: reliance.detail,
    whyChanged: whyChanged(options.previousResult, range, causesList, missing, contradictions),
    nextAction: nextActionFor({
      status,
      missing,
      contradictions,
      pendingReviewCount,
      shortfallMinor: shortfallForResult,
      freshness: freshnessDetail.status,
    }),
    currentKnownPosition: currentPositionAmount,
    knownCommittedFloor: committedFloorAmount,
    expectedSafeMin: moneyMinor(expectedLowerMinor),
    expectedSafeMax: moneyMinor(expectedUpperMinor),
    conservativeBoundary: moneyMinor(conservativeMinor),
    reliance: reliance.reliance,
    freshness: freshnessDetail.status,
    missingMaterialInfo: [...missing, ...contradictions].map((item) => item.label),
    assumptions,
    mainCauses: causesList,
    wouldChangeIf,
    sourceBreakdown: sourceRows,
    forecastVersionId: createForecastId('forecast_safe_range_v1'),
    provenanceId: createProvenanceId('provenance_safe_range_v1'),
    canUserRelyOnAnswer: reliance.canUserRelyOnAnswer,
  };
  return result;
}

export function buildTrustedSafeRangeLegacyComparison(
  state: AppState,
  options: TrustedSafeRangeAdapterOptions,
): TrustedSafeRangeLegacyComparison {
  const ctx = buildContext(state, options);
  const result = buildTrustedSafeRangeFromAppState(state, options);
  let route: ReturnType<typeof routeFromStore> | null = null;
  try {
    route = routeFromStore(state, ctx.todayISO);
  } catch {
    route = null;
  }
  const legacy = legacySafeZoneSnapshot(
    state,
    route === null ? null : poundsToMinor(route.tightPoint.amount),
    route?.tightPoint.date ?? null,
    ctx.todayISO,
  );
  return compareTrustedSafeRangeWithLegacy(result, legacy);
}

export function formatTrustedSafeRangePounds(money: Money | null): string {
  if (money === null) return 'unknown';
  const pounds = Math.round(minorToPounds(money.minorUnits));
  const sign = pounds < 0 ? '−' : '';
  return `${sign}£${Math.abs(pounds).toLocaleString('en-GB')}`;
}

export function trustedSafeRangeHeadline(result: TrustedSafeRangeResult): string {
  switch (result.status) {
    case 'ready':
      return 'Safe Range ready';
    case 'caution':
      return 'Safe Range needs caution';
    case 'shortfall':
      return 'Shortfall ahead';
    case 'insufficient_data':
      return 'Safe Range needs more truth';
    case 'stale':
      return 'Safe Range needs a fresh balance';
    case 'contradicted':
      return 'Safe Range has conflicting facts';
    case 'sample_demo':
      return 'Sample Safe Range';
    case 'workspace_blocked':
      return 'Personal Safe Range unavailable';
  }
}

export function trustedSafeRangeSummaryLine(result: TrustedSafeRangeResult): string {
  const min = formatTrustedSafeRangePounds(result.expectedRange.min);
  const max = formatTrustedSafeRangePounds(result.expectedRange.max);
  if (result.expectedRange.min === null || result.expectedRange.max === null) {
    return 'Add the missing money facts before relying on this.';
  }
  if (result.expectedRange.min.minorUnits === result.expectedRange.max.minorUnits) {
    return `${min} expected at the tightest point.`;
  }
  return `${min} to ${max} expected at the tightest point.`;
}
