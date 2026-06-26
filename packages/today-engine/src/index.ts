import {
  addDaysToLocalDate,
  createLocalDate,
  createLocalDateTime,
  createLocalTime,
  createMoney,
  reconcileActualWithExpectation,
  type AccountId,
  type CurrencyCode,
  type ExpectationId,
  type FinancialExpectation,
  type FinancialTransaction,
  type InstantString,
  type LocalDate,
  type LocalDateTime,
  type LocalTime,
  type Money,
  type TransactionCertainty,
  type TransactionId,
  type TransactionReviewStatus,
  type TransactionSourceKind,
  type TransactionStatus,
} from '@folio/domain';

export const todayEngineBoundary = {
  packageName: '@folio/today-engine',
  deterministic: true,
  importsNativeOrUiRuntime: false,
  importsDatabaseDriver: false,
  schedulesNotifications: false,
} as const;

export type MoneyLike = Money | Readonly<{ minorUnits: number; currency: string | CurrencyCode }>;

export type BriefingCandidateKind =
  | 'position'
  | 'timeline'
  | 'calendar'
  | 'transaction'
  | 'task'
  | 'reminder'
  | 'plan'
  | 'variance'
  | 'system';

export type BriefingUrgency = 'urgent' | 'nonurgent';

export type BriefingReasonCode =
  | 'user_pinned'
  | 'urgent'
  | 'overdue'
  | 'due_today'
  | 'due_soon'
  | 'expected_actual_variance'
  | 'position_risk'
  | 'review_needed'
  | 'fresh_fact'
  | 'calendar_focus'
  | 'limited_evidence'
  | 'uncertainty_penalty'
  | 'fatigue_penalty';

export type BriefingRankReason = Readonly<{
  code: BriefingReasonCode;
  text: string;
  delta: number;
}>;

export type BriefingCandidateInput = Readonly<{
  id: string;
  kind: BriefingCandidateKind;
  title: string;
  summary: string;
  urgency?: BriefingUrgency;
  importance?: number;
  dueDate?: string | LocalDate;
  eventDate?: string | LocalDate;
  evidenceWeight?: number;
  fatigueKey?: string;
  fatigueCount?: number;
  lastShownOn?: string | LocalDate;
  isPinned?: boolean;
  reasonCodes?: readonly BriefingReasonCode[];
  sourceIds?: readonly string[];
  visualText?: string;
  accessibilityLabel?: string;
}>;

export type BriefingRankingInput = Readonly<{
  asOf: string | LocalDate;
  candidates: readonly BriefingCandidateInput[];
  maxNonurgentItems?: number;
  fatiguePenaltyPerRepeat?: number;
  uncertaintyPenaltyWeight?: number;
}>;

export type RankedBriefingCandidate = Readonly<{
  id: string;
  kind: BriefingCandidateKind;
  title: string;
  summary: string;
  urgency: BriefingUrgency;
  rank: number;
  rankWeight: number;
  evidenceWeight: number;
  penalties: Readonly<{
    uncertaintyPenalty: number;
    fatiguePenalty: number;
  }>;
  reasons: readonly BriefingRankReason[];
  reasonCodes: readonly BriefingReasonCode[];
  sourceIds: readonly string[];
  visualText: string;
  accessibilityText: string;
}>;

export type BriefingRankingResult = Readonly<{
  asOf: LocalDate;
  selected: readonly RankedBriefingCandidate[];
  suppressedNonurgentIds: readonly string[];
  urgentCount: number;
  nonurgentCount: number;
  policy: Readonly<{
    maxNonurgentItems: number;
    tieBreakers: readonly string[];
  }>;
}>;

export type PositionCashflowState = 'actual' | 'expected' | 'inferred' | 'hypothetical';

export type PositionAccountInput = Readonly<{
  id: string;
  label: string;
  balance: MoneyLike;
  included?: boolean;
  sourceId?: string;
  observedOn?: string | LocalDate;
  assumption?: string;
}>;

export type PositionCashflowInput = Readonly<{
  id: string;
  label: string;
  date: string | LocalDate;
  amount: MoneyLike;
  state: PositionCashflowState;
  protected?: boolean;
  sourceId?: string;
  assumption?: string;
}>;

export type PositionSummaryInput = Readonly<{
  asOf: string | LocalDate;
  currency: string | CurrencyCode;
  accounts: readonly PositionAccountInput[];
  cashflows?: readonly PositionCashflowInput[];
  protectedFloorMinor?: number;
  assumptions?: readonly string[];
}>;

export type PositionSummaryLine = Readonly<{
  id: string;
  label: string;
  kind: 'account' | 'cashflow';
  amountMinor: number;
  currency: CurrencyCode;
  state?: PositionCashflowState;
  included: boolean;
}>;

export type PositionSummary = Readonly<{
  asOf: LocalDate;
  currency: CurrencyCode;
  openingBalanceMinor: number;
  actualNetMinor: number;
  expectedNetMinor: number;
  protectedFloorMinor: number;
  projectedClosingMinor: number;
  availableMinor: number;
  inputs: Readonly<{
    accountIds: readonly string[];
    cashflowIds: readonly string[];
    sourceIds: readonly string[];
  }>;
  assumptions: readonly string[];
  lines: readonly PositionSummaryLine[];
  visualText: string;
  accessibilityText: string;
}>;

export type MoneyTimelinePoint = Readonly<{
  id: string;
  localDate: LocalDate;
  label: string;
  amountMinor: number;
  balanceMinor: number;
  currency: CurrencyCode;
  state: PositionCashflowState;
  protected: boolean;
  sourceIds: readonly string[];
}>;

export type MoneyTimelineProjectionInput = Readonly<{
  asOf: string | LocalDate;
  until?: string | LocalDate;
  nextIncomeDate?: string | LocalDate;
  currency: string | CurrencyCode;
  accounts: readonly PositionAccountInput[];
  cashflows: readonly PositionCashflowInput[];
  protectedFloorMinor?: number;
  includeInferredIncome?: boolean;
  includeHypothetical?: boolean;
  assumptions?: readonly string[];
}>;

export type MoneyTimelineProjection = Readonly<{
  asOf: LocalDate;
  until: LocalDate;
  currency: CurrencyCode;
  openingBalanceMinor: number;
  closingMinor: number;
  lowestMinor: number;
  lowestLocalDate: LocalDate;
  protectedFloorMinor: number;
  availableBeforeNextIncomeMinor?: number;
  minimumBeforeNextIncomeMinor?: number;
  closingOnNextIncomeDateMinor?: number;
  riskDetected: boolean;
  countedIds: readonly string[];
  excludedIds: readonly string[];
  points: readonly MoneyTimelinePoint[];
  assumptions: readonly string[];
  visualText: string;
  accessibilityText: string;
}>;

export type TimelineSourceKind =
  | 'transaction'
  | 'expectation'
  | 'calendar'
  | 'task'
  | 'reminder'
  | 'plan'
  | 'system';

export type TimelineEventState = 'actual' | 'expected';
export type TimelinePosition = 'past' | 'today' | 'future';

export type TimelineEventInput = Readonly<{
  id: string;
  title: string;
  localDate: string | LocalDate;
  localTime?: string | LocalTime;
  sourceKind: TimelineSourceKind;
  state?: TimelineEventState;
  amount?: MoneyLike;
  detail?: string;
  importance?: number;
  sourceIds?: readonly string[];
  visualText?: string;
  accessibilityLabel?: string;
}>;

export type TimelineRow = Readonly<{
  id: string;
  rowKind: 'event';
  eventState: TimelineEventState;
  timelinePosition: TimelinePosition;
  localDate: LocalDate;
  localTime?: LocalTime;
  sourceKind: TimelineSourceKind;
  title: string;
  detail?: string;
  amountMinor?: number;
  currency?: CurrencyCode;
  sourceIds: readonly string[];
  visualText: string;
  accessibilityText: string;
}>;

export type TimelineRowsInput = Readonly<{
  asOf: string | LocalDate;
  events: readonly TimelineEventInput[];
}>;

export type TransactionProvenanceView = Readonly<{
  sourceKind: TransactionSourceKind;
  sourceLabel: string;
  certainty: TransactionCertainty;
  reviewStatus: TransactionReviewStatus;
  versionRevision: number;
  dataVersion: string;
  reference?: string;
  bookedAt?: InstantString;
}>;

export type TransactionCorrectionPlaceholders = Readonly<{
  placeholder: true;
  canCreateMutation: false;
  correctionDraftId: null;
  replacementTransactionId: TransactionId | null;
  reversalTransactionId: TransactionId | null;
  blockedReason: 'requires_transaction_write_adapter';
}>;

export type TransactionListRow = Readonly<{
  id: TransactionId;
  workspaceId: string;
  accountId: AccountId;
  accountLabel: string;
  localDate: LocalDate;
  status: TransactionStatus;
  amountMinor: number;
  currency: CurrencyCode;
  description: string;
  provenance: TransactionProvenanceView;
  correction: TransactionCorrectionPlaceholders;
  linkedExpectationId?: ExpectationId;
  transferLinkId?: string;
  accessibilityText: string;
  visualText: string;
}>;

export type TransactionListView = Readonly<{
  rows: readonly TransactionListRow[];
  accessibilityText: string;
}>;

export type TransactionDetailView = TransactionListRow &
  Readonly<{
    splits: readonly Readonly<{
      id: string;
      label: string;
      amountMinor: number;
      currency: CurrencyCode;
      categoryId?: string;
    }>[];
    relationships: Readonly<{
      replaces?: TransactionId;
      replacedBy?: TransactionId;
      fulfils?: ExpectationId;
      reversalOf?: TransactionId;
      transferLink?: string;
    }>;
  }>;

export type TransactionViewInput = Readonly<{
  transactions: readonly FinancialTransaction[];
  accountLabels?: Readonly<Record<string, string>>;
  sourceLabels?: Readonly<Record<string, string>>;
}>;

export type CalendarItem = TimelineRow &
  Readonly<{
    durationMinutes?: number;
  }>;

export type CalendarDayView = Readonly<{
  date: LocalDate;
  inCurrentMonth: boolean;
  isToday: boolean;
  items: readonly CalendarItem[];
  accessibilityText: string;
}>;

export type CalendarTodayView = Readonly<{
  date: LocalDate;
  items: readonly CalendarItem[];
  accessibilityText: string;
}>;

export type CalendarWeekView = Readonly<{
  startDate: LocalDate;
  endDate: LocalDate;
  days: readonly CalendarDayView[];
  accessibilityText: string;
}>;

export type CalendarMonthView = Readonly<{
  month: string;
  weeks: readonly (readonly CalendarDayView[])[];
  accessibilityText: string;
}>;

export type InternalCalendarViews = Readonly<{
  asOf: LocalDate;
  today: CalendarTodayView;
  week: CalendarWeekView;
  month: CalendarMonthView;
  timeline: readonly TimelineRow[];
  calendarSystem: 'internal';
  accessibilityText: string;
}>;

export type InternalCalendarInput = Readonly<{
  asOf: string | LocalDate;
  events: readonly (TimelineEventInput & Readonly<{ durationMinutes?: number }>)[];
}>;

export type TaskReminderKind = 'task' | 'reminder';
export type TaskReminderPriority = 'low' | 'normal' | 'important' | 'critical';
export type TaskReminderState = 'completed' | 'overdue' | 'today' | 'upcoming';

export type TaskReminderInput = Readonly<{
  id: string;
  kind: TaskReminderKind;
  title: string;
  dueDate: string | LocalDate;
  dueTime?: string | LocalTime;
  priority?: TaskReminderPriority;
  completed?: boolean;
  reminderOffsetMinutes?: number;
  sourceIds?: readonly string[];
}>;

export type NotificationScheduleRequest = Readonly<{
  itemId: string;
  title: string;
  localDateTime: LocalDateTime;
  blocked: true;
  blockedReason: 'notification_scheduling_blocked_until_runtime_adapter';
}>;

export type PlannedTaskReminder = Readonly<{
  id: string;
  kind: TaskReminderKind;
  title: string;
  dueDate: LocalDate;
  dueTime?: LocalTime;
  priority: TaskReminderPriority;
  state: TaskReminderState;
  sourceIds: readonly string[];
  notificationRequest?: NotificationScheduleRequest;
  visualText: string;
  accessibilityText: string;
}>;

export type TaskReminderPlanningResult = Readonly<{
  asOf: LocalDate;
  items: readonly PlannedTaskReminder[];
  notificationScheduling: Readonly<{
    status: 'blocked';
    blockedBy: readonly ['vault_or_runtime_integration', 'native_notification_adapter'];
    requestedSchedules: readonly NotificationScheduleRequest[];
    scheduleMutationsCreated: false;
  }>;
  accessibilityText: string;
}>;

export type TaskReminderPlanningInput = Readonly<{
  asOf: string | LocalDate;
  items: readonly TaskReminderInput[];
  defaultReminderTime?: string | LocalTime;
}>;

export type ActualVarianceAnswerId =
  | 'accept_actual_once'
  | 'update_future_expectation'
  | 'mark_expected_paid_elsewhere'
  | 'needs_more_review';

export type ActualVarianceQuestion = Readonly<{
  id: string;
  questionType: 'matched' | 'recurring_amount_variance';
  needsQuestion: boolean;
  actualTransactionId: TransactionId;
  expectedExpectationId: ExpectationId;
  expectedMinor: number;
  actualMinor: number;
  variance: Money;
  answerOptions: readonly Readonly<{
    id: ActualVarianceAnswerId;
    label: string;
  }>[];
  provenance: Readonly<{
    actualSourceKind: TransactionSourceKind;
    actualReviewStatus: TransactionReviewStatus;
    expectedReference?: string;
  }>;
  visualText: string;
  accessibilityText: string;
}>;

export type ActualVarianceQuestionInput = Readonly<{
  actual: FinancialTransaction;
  expected: FinancialExpectation;
  toleranceMinor?: number;
}>;

export type AccessibleVisualTextInput = Readonly<{
  label: string;
  valueText: string;
  trend?: 'up' | 'down' | 'flat';
  reviewState?: 'confirmed' | 'needs review' | 'limited evidence';
  risk?: 'low' | 'medium' | 'high';
}>;

export type AccessibleVisualTextEquivalent = Readonly<{
  visualText: string;
  accessibilityText: string;
}>;

type BriefingRankingDraft = Readonly<{
  id: string;
  kind: BriefingCandidateKind;
  title: string;
  summary: string;
  urgency: BriefingUrgency;
  rankWeight: number;
  evidenceWeight: number;
  penalties: Readonly<{
    uncertaintyPenalty: number;
    fatiguePenalty: number;
  }>;
  reasons: readonly BriefingRankReason[];
  reasonCodes: readonly BriefingReasonCode[];
  sourceIds: readonly string[];
  visualText: string;
  accessibilityText: string;
  sortDate: string;
}>;

export function rankBriefingCandidates(input: BriefingRankingInput): BriefingRankingResult {
  const asOf = normalizeLocalDate(input.asOf);
  const maxNonurgentItems = input.maxNonurgentItems ?? 3;
  if (!Number.isSafeInteger(maxNonurgentItems) || maxNonurgentItems < 0) {
    throw new Error('maxNonurgentItems must be a non-negative safe integer.');
  }

  const rankedDrafts = input.candidates
    .map((candidate) => rankBriefingCandidate(candidate, asOf, input))
    .sort(compareBriefingRankingDrafts);

  const selected: RankedBriefingCandidate[] = [];
  const suppressedNonurgentIds: string[] = [];
  let nonurgentCount = 0;
  let urgentCount = 0;

  for (const candidate of rankedDrafts) {
    if (candidate.urgency === 'urgent') {
      urgentCount += 1;
      selected.push(toRankedBriefingCandidate(candidate, selected.length + 1));
      continue;
    }

    if (nonurgentCount < maxNonurgentItems) {
      nonurgentCount += 1;
      selected.push(toRankedBriefingCandidate(candidate, selected.length + 1));
    } else {
      suppressedNonurgentIds.push(candidate.id);
    }
  }

  return {
    asOf,
    selected,
    suppressedNonurgentIds,
    urgentCount,
    nonurgentCount,
    policy: {
      maxNonurgentItems,
      tieBreakers: ['urgency', 'rank_weight_desc', 'date_asc', 'kind_asc', 'id_asc'],
    },
  };
}

export function buildPositionSummary(input: PositionSummaryInput): PositionSummary {
  const asOf = normalizeLocalDate(input.asOf);
  const currency =
    typeof input.currency === 'string'
      ? createMoney({ minorUnits: 0, currency: input.currency }).currency
      : input.currency;
  const protectedFloorMinor = input.protectedFloorMinor ?? 0;
  assertSafeInteger(protectedFloorMinor, 'Protected floor');

  const lines: PositionSummaryLine[] = [];
  const accountIds: string[] = [];
  const cashflowIds: string[] = [];
  const sourceIds: string[] = [];
  const assumptions = [
    'Account balances are treated as current for the summary date.',
    'Expected, inferred and hypothetical cashflows are planning inputs, not posted facts.',
    'No currency conversion is performed inside the Today model.',
    ...(input.assumptions ?? []),
  ];

  let openingBalanceMinor = 0;
  for (const account of input.accounts) {
    const money = normalizeMoney(account.balance);
    assertCurrency(money.currency, currency, `Account ${account.id}`);
    const included = account.included !== false;
    accountIds.push(account.id);
    if (account.sourceId !== undefined) sourceIds.push(account.sourceId);
    if (account.assumption !== undefined) assumptions.push(account.assumption);
    if (included) {
      openingBalanceMinor += money.minorUnits;
      assertSafeInteger(openingBalanceMinor, 'Opening balance');
    }
    lines.push({
      id: account.id,
      label: account.label,
      kind: 'account',
      amountMinor: money.minorUnits,
      currency: money.currency,
      included,
    });
  }

  let actualNetMinor = 0;
  let expectedNetMinor = 0;
  for (const cashflow of input.cashflows ?? []) {
    const money = normalizeMoney(cashflow.amount);
    assertCurrency(money.currency, currency, `Cashflow ${cashflow.id}`);
    const date = normalizeLocalDate(cashflow.date);
    const included = date >= asOf;
    cashflowIds.push(cashflow.id);
    if (cashflow.sourceId !== undefined) sourceIds.push(cashflow.sourceId);
    if (cashflow.assumption !== undefined) assumptions.push(cashflow.assumption);
    if (included) {
      if (cashflow.state === 'actual') {
        actualNetMinor += money.minorUnits;
        assertSafeInteger(actualNetMinor, 'Actual net movement');
      } else {
        expectedNetMinor += money.minorUnits;
        assertSafeInteger(expectedNetMinor, 'Expected net movement');
      }
    }

    lines.push({
      id: cashflow.id,
      label: cashflow.label,
      kind: 'cashflow',
      amountMinor: money.minorUnits,
      currency: money.currency,
      state: cashflow.state,
      included,
    });
  }

  const projectedClosingMinor = openingBalanceMinor + actualNetMinor + expectedNetMinor;
  assertSafeInteger(projectedClosingMinor, 'Projected closing balance');
  const availableMinor = Math.max(0, projectedClosingMinor - protectedFloorMinor);
  const visualText = `${formatMinor(projectedClosingMinor, currency)} projected closing; ${formatMinor(
    availableMinor,
    currency,
  )} available above floor.`;

  return {
    asOf,
    currency,
    openingBalanceMinor,
    actualNetMinor,
    expectedNetMinor,
    protectedFloorMinor,
    projectedClosingMinor,
    availableMinor,
    inputs: {
      accountIds,
      cashflowIds,
      sourceIds: unique(sourceIds),
    },
    assumptions: unique(assumptions),
    lines,
    visualText,
    accessibilityText: `Position summary for ${asOf}. Opening ${formatMinor(
      openingBalanceMinor,
      currency,
    )}. Actual movement ${formatMinor(actualNetMinor, currency)}. Expected movement ${formatMinor(
      expectedNetMinor,
      currency,
    )}. Available above protected floor ${formatMinor(availableMinor, currency)}.`,
  };
}

export function buildMoneyTimelineProjection(
  input: MoneyTimelineProjectionInput,
): MoneyTimelineProjection {
  const asOf = normalizeLocalDate(input.asOf);
  const nextIncomeDate =
    input.nextIncomeDate === undefined ? undefined : normalizeLocalDate(input.nextIncomeDate);
  const explicitUntil = input.until === undefined ? undefined : normalizeLocalDate(input.until);
  const currency =
    typeof input.currency === 'string'
      ? createMoney({ minorUnits: 0, currency: input.currency }).currency
      : input.currency;
  const protectedFloorMinor = input.protectedFloorMinor ?? 0;
  assertSafeInteger(protectedFloorMinor, 'Protected floor');

  let openingBalanceMinor = 0;
  const assumptions = [
    'Projection uses signed integer minor units only.',
    'Same-day protected outflows are applied before other outflows and inflows.',
    'Inferred income is excluded unless explicitly included.',
    'Hypothetical changes are excluded unless explicitly included.',
    ...(input.assumptions ?? []),
  ];

  for (const account of input.accounts) {
    const money = normalizeMoney(account.balance);
    assertCurrency(money.currency, currency, `Account ${account.id}`);
    if (account.included === false) continue;
    openingBalanceMinor += money.minorUnits;
    assertSafeInteger(openingBalanceMinor, 'Opening balance');
  }

  const excludedIds: string[] = [];
  const candidateCashflows = input.cashflows.filter((cashflow) => {
    const money = normalizeMoney(cashflow.amount);
    assertCurrency(money.currency, currency, `Cashflow ${cashflow.id}`);
    const localDate = normalizeLocalDate(cashflow.date);
    const includeByDate =
      localDate >= asOf && (explicitUntil === undefined || localDate <= explicitUntil);
    const isInferredIncome =
      cashflow.state === 'inferred' && money.minorUnits > 0 && input.includeInferredIncome !== true;
    const isHypothetical = cashflow.state === 'hypothetical' && input.includeHypothetical !== true;
    if (!includeByDate || isInferredIncome || isHypothetical) {
      excludedIds.push(cashflow.id);
      return false;
    }
    return true;
  });
  const until =
    explicitUntil ??
    nextIncomeDate ??
    candidateCashflows
      .map((cashflow) => normalizeLocalDate(cashflow.date))
      .sort((left, right) => right.localeCompare(left))[0] ??
    asOf;

  let balanceMinor = openingBalanceMinor;
  let lowestMinor = openingBalanceMinor;
  let lowestLocalDate = asOf;
  let minimumBeforeNextIncomeMinor = openingBalanceMinor;
  let closingOnNextIncomeDateMinor: number | undefined;
  const countedIds: string[] = [];
  const points: MoneyTimelinePoint[] = [];

  for (const cashflow of [...candidateCashflows].sort(compareProjectionCashflows)) {
    const money = normalizeMoney(cashflow.amount);
    const isReserved = cashflow.protected === true && money.minorUnits < 0;
    balanceMinor += isReserved ? 0 : money.minorUnits;
    assertSafeInteger(balanceMinor, `Projected balance after ${cashflow.id}`);
    const localDate = normalizeLocalDate(cashflow.date);
    countedIds.push(cashflow.id);
    if (balanceMinor < lowestMinor) {
      lowestMinor = balanceMinor;
      lowestLocalDate = localDate;
    }
    if (
      nextIncomeDate !== undefined &&
      isBeforeNextIncomeBoundary(localDate, money.minorUnits, nextIncomeDate)
    ) {
      minimumBeforeNextIncomeMinor = Math.min(minimumBeforeNextIncomeMinor, balanceMinor);
    }
    if (nextIncomeDate !== undefined && localDate <= nextIncomeDate) {
      closingOnNextIncomeDateMinor = balanceMinor;
    }
    points.push({
      id: cashflow.id,
      localDate,
      label: cashflow.label,
      amountMinor: money.minorUnits,
      balanceMinor,
      currency,
      state: cashflow.state,
      protected: cashflow.protected === true,
      sourceIds: cashflow.sourceId === undefined ? [] : [cashflow.sourceId],
    });
  }

  const availableBeforeNextIncomeMinor =
    nextIncomeDate === undefined
      ? undefined
      : Math.max(0, minimumBeforeNextIncomeMinor - protectedFloorMinor);
  const riskDetected = lowestMinor < protectedFloorMinor;

  return {
    asOf,
    until,
    currency,
    openingBalanceMinor,
    closingMinor: balanceMinor,
    lowestMinor,
    lowestLocalDate,
    protectedFloorMinor,
    ...(availableBeforeNextIncomeMinor === undefined ? {} : { availableBeforeNextIncomeMinor }),
    ...(nextIncomeDate === undefined ? {} : { minimumBeforeNextIncomeMinor }),
    ...(closingOnNextIncomeDateMinor === undefined ? {} : { closingOnNextIncomeDateMinor }),
    riskDetected,
    countedIds,
    excludedIds,
    points,
    assumptions: unique(assumptions),
    visualText: `${formatMinor(lowestMinor, currency)} lowest projection on ${lowestLocalDate}; ${formatMinor(
      balanceMinor,
      currency,
    )} closing.`,
    accessibilityText: `Money timeline from ${asOf} to ${until}. Opening ${formatMinor(
      openingBalanceMinor,
      currency,
    )}. Lowest ${formatMinor(lowestMinor, currency)} on ${lowestLocalDate}. Closing ${formatMinor(
      balanceMinor,
      currency,
    )}.`,
  };
}

export function buildTimelineRows(input: TimelineRowsInput): readonly TimelineRow[] {
  const asOf = normalizeLocalDate(input.asOf);
  return input.events.map((event) => buildTimelineRow(event, asOf)).sort(compareTimelineRows);
}

export function buildTransactionListView(input: TransactionViewInput): TransactionListView {
  const rows = input.transactions.map((transaction) => buildTransactionRow(transaction, input));
  rows.sort((left, right) => {
    const dateComparison = right.localDate.localeCompare(left.localDate);
    if (dateComparison !== 0) return dateComparison;
    return String(left.id).localeCompare(String(right.id));
  });

  return {
    rows,
    accessibilityText:
      rows.length === 0
        ? 'No transactions in this view.'
        : `${rows.length} transaction rows. ${rows
            .map((row) => `${row.description}, ${formatMinor(row.amountMinor, row.currency)}`)
            .join('; ')}.`,
  };
}

export function buildTransactionDetailView(input: {
  transaction: FinancialTransaction;
  accountLabels?: Readonly<Record<string, string>>;
  sourceLabels?: Readonly<Record<string, string>>;
}): TransactionDetailView {
  const rowInput: {
    transactions: readonly FinancialTransaction[];
    accountLabels?: Readonly<Record<string, string>>;
    sourceLabels?: Readonly<Record<string, string>>;
  } = {
    transactions: [input.transaction],
  };
  if (input.accountLabels !== undefined) rowInput.accountLabels = input.accountLabels;
  if (input.sourceLabels !== undefined) rowInput.sourceLabels = input.sourceLabels;
  const row = buildTransactionRow(input.transaction, rowInput);
  const splits = input.transaction.splits.map((split) => {
    const detail: {
      id: string;
      label: string;
      amountMinor: number;
      currency: CurrencyCode;
      categoryId?: string;
    } = {
      id: String(split.id),
      label: split.label,
      amountMinor: split.amount.minorUnits,
      currency: split.amount.currency,
    };
    if (split.categoryId !== undefined) detail.categoryId = split.categoryId;
    return detail;
  });

  const relationships: {
    replaces?: TransactionId;
    replacedBy?: TransactionId;
    fulfils?: ExpectationId;
    reversalOf?: TransactionId;
    transferLink?: string;
  } = {};
  if (input.transaction.replaces !== undefined) relationships.replaces = input.transaction.replaces;
  if (input.transaction.replacedBy !== undefined) {
    relationships.replacedBy = input.transaction.replacedBy;
  }
  if (input.transaction.fulfils !== undefined) relationships.fulfils = input.transaction.fulfils;
  if (input.transaction.reversalOf !== undefined) {
    relationships.reversalOf = input.transaction.reversalOf;
  }
  if (input.transaction.transferLink !== undefined) {
    relationships.transferLink = String(input.transaction.transferLink);
  }

  return {
    ...row,
    splits,
    relationships,
  };
}

export function buildInternalCalendarViews(input: InternalCalendarInput): InternalCalendarViews {
  const asOf = normalizeLocalDate(input.asOf);
  const durationById = new Map<string, number>();
  for (const event of input.events) {
    if (event.durationMinutes !== undefined) {
      assertSafeInteger(event.durationMinutes, `Duration for ${event.id}`);
      if (event.durationMinutes < 0) throw new Error('Calendar duration must be non-negative.');
      durationById.set(event.id, event.durationMinutes);
    }
  }

  const timeline = buildTimelineRows({ asOf, events: input.events });
  const calendarItems = timeline.map((row) => toCalendarItem(row, durationById.get(row.id)));
  const todayItems = calendarItems.filter((item) => item.localDate === asOf);
  const weekStart = startOfWeekMonday(asOf);
  const weekDays = buildDayRange(weekStart, addDaysToLocalDate(weekStart, 6), asOf, calendarItems);
  const month = asOf.slice(0, 7);
  const monthWeeks = buildMonthWeeks(asOf, calendarItems);

  const today: CalendarTodayView = {
    date: asOf,
    items: todayItems,
    accessibilityText: describeCalendarDay(asOf, todayItems, true),
  };
  const week: CalendarWeekView = {
    startDate: weekStart,
    endDate: addDaysToLocalDate(weekStart, 6),
    days: weekDays,
    accessibilityText: `Week ${weekStart} to ${addDaysToLocalDate(weekStart, 6)} has ${
      weekDays.flatMap((day) => day.items).length
    } internal calendar items.`,
  };
  const monthView: CalendarMonthView = {
    month,
    weeks: monthWeeks,
    accessibilityText: `Month ${month} has ${
      monthWeeks.flatMap((weekRow) => weekRow.flatMap((day) => day.items)).length
    } internal calendar items.`,
  };

  return {
    asOf,
    today,
    week,
    month: monthView,
    timeline,
    calendarSystem: 'internal',
    accessibilityText: `Internal calendar for ${asOf}: ${today.items.length} today, ${week.days.length} days in week view, ${monthWeeks.length} week rows in month view.`,
  };
}

export function planTasksAndReminders(
  input: TaskReminderPlanningInput,
): TaskReminderPlanningResult {
  const asOf = normalizeLocalDate(input.asOf);
  const defaultReminderTime = normalizeLocalTime(input.defaultReminderTime ?? '09:00:00');
  const requests: NotificationScheduleRequest[] = [];
  const items = input.items
    .map((item) => {
      const planned = buildPlannedTaskReminder(item, asOf, defaultReminderTime);
      if (planned.notificationRequest !== undefined) requests.push(planned.notificationRequest);
      return planned;
    })
    .sort(comparePlannedItems);

  return {
    asOf,
    items,
    notificationScheduling: {
      status: 'blocked',
      blockedBy: ['vault_or_runtime_integration', 'native_notification_adapter'],
      requestedSchedules: requests,
      scheduleMutationsCreated: false,
    },
    accessibilityText:
      items.length === 0
        ? 'No task or reminder items.'
        : `${items.length} task and reminder items. Notification scheduling is blocked in the pure model.`,
  };
}

export function buildActualVarianceQuestion(
  input: ActualVarianceQuestionInput,
): ActualVarianceQuestion {
  const reconciliation = reconcileActualWithExpectation(input.actual, input.expected);
  const toleranceMinor = input.toleranceMinor ?? 0;
  assertSafeInteger(toleranceMinor, 'Variance tolerance');
  const needsQuestion = Math.abs(reconciliation.variance.minorUnits) > toleranceMinor;
  const questionType = needsQuestion ? reconciliation.questionType : 'matched';
  const id = `variance_question_${String(input.actual.id)}_${String(input.expected.id)}`;
  const visualText = needsQuestion
    ? `Actual differs by ${formatMinor(
        reconciliation.variance.minorUnits,
        reconciliation.variance.currency,
      )}.`
    : 'Actual matches the expected amount within tolerance.';
  const provenance: {
    actualSourceKind: TransactionSourceKind;
    actualReviewStatus: TransactionReviewStatus;
    expectedReference?: string;
  } = {
    actualSourceKind: input.actual.sourceKind,
    actualReviewStatus: input.actual.reviewStatus,
  };
  if (input.expected.reference !== undefined)
    provenance.expectedReference = input.expected.reference;

  return {
    id,
    questionType,
    needsQuestion,
    actualTransactionId: input.actual.id,
    expectedExpectationId: input.expected.id,
    expectedMinor: input.expected.amount.minorUnits,
    actualMinor: input.actual.amount.minorUnits,
    variance: reconciliation.variance,
    answerOptions: [
      { id: 'accept_actual_once', label: 'Use the actual amount this time' },
      { id: 'update_future_expectation', label: 'Update future expected amounts' },
      { id: 'mark_expected_paid_elsewhere', label: 'Mark the expected item handled elsewhere' },
      { id: 'needs_more_review', label: 'Review this later' },
    ],
    provenance,
    visualText,
    accessibilityText: `${visualText} Expected ${formatMinor(
      input.expected.amount.minorUnits,
      input.expected.amount.currency,
    )}; actual ${formatMinor(input.actual.amount.minorUnits, input.actual.amount.currency)}.`,
  };
}

export function buildAccessibleVisualText(
  input: AccessibleVisualTextInput,
): AccessibleVisualTextEquivalent {
  const parts = [`${input.label}: ${input.valueText}`];
  if (input.trend !== undefined) parts.push(`trend ${input.trend}`);
  if (input.reviewState !== undefined) parts.push(`review state ${input.reviewState}`);
  if (input.risk !== undefined) parts.push(`risk ${input.risk}`);
  const text = `${parts.join(', ')}.`;
  return {
    visualText: text,
    accessibilityText: text,
  };
}

function rankBriefingCandidate(
  candidate: BriefingCandidateInput,
  asOf: LocalDate,
  input: BriefingRankingInput,
): BriefingRankingDraft {
  const title = normalizeNonEmptyText(candidate.title, `Briefing candidate ${candidate.id} title`);
  const summary = normalizeNonEmptyText(
    candidate.summary,
    `Briefing candidate ${candidate.id} summary`,
  );
  const evidenceWeight = candidate.evidenceWeight ?? 1;
  assertProbability(evidenceWeight, `Briefing candidate ${candidate.id} evidenceWeight`);
  const importance = candidate.importance ?? 50;
  assertBoundedInteger(importance, 0, 100, `Briefing candidate ${candidate.id} importance`);

  const date = candidate.dueDate ?? candidate.eventDate;
  const normalizedDate = date === undefined ? undefined : normalizeLocalDate(date);
  const daysUntil = normalizedDate === undefined ? undefined : diffLocalDays(asOf, normalizedDate);
  const reasons: BriefingRankReason[] = [];
  let rankWeight = importance;

  if (candidate.isPinned === true) {
    reasons.push({ code: 'user_pinned', text: 'Pinned by the user.', delta: 25 });
    rankWeight += 25;
  }

  const reasonCodes = new Set(candidate.reasonCodes ?? []);
  if (candidate.urgency === 'urgent' || reasonCodes.has('urgent')) {
    reasons.push({ code: 'urgent', text: 'Marked urgent.', delta: 100 });
    rankWeight += 100;
  }

  if (daysUntil !== undefined) {
    if (daysUntil < 0) {
      reasons.push({ code: 'overdue', text: 'Past its expected date.', delta: 45 });
      rankWeight += 45;
      reasonCodes.add('urgent');
    } else if (daysUntil === 0) {
      reasons.push({ code: 'due_today', text: 'Due today.', delta: 35 });
      rankWeight += 35;
    } else if (daysUntil <= 3) {
      reasons.push({ code: 'due_soon', text: 'Due in the next three days.', delta: 20 });
      rankWeight += 20;
    }
  }

  for (const code of reasonCodes) {
    const existing = reasons.some((reason) => reason.code === code);
    if (!existing) {
      const reason = briefingReasonFromCode(code);
      reasons.push(reason);
      rankWeight += reason.delta;
    }
  }

  const uncertaintyPenalty = Math.round(
    (1 - evidenceWeight) * (input.uncertaintyPenaltyWeight ?? 25),
  );
  if (uncertaintyPenalty > 0) {
    reasons.push({
      code: evidenceWeight < 0.5 ? 'limited_evidence' : 'uncertainty_penalty',
      text: 'Limited evidence means this appears after clearer items.',
      delta: -uncertaintyPenalty,
    });
    rankWeight -= uncertaintyPenalty;
  }

  const fatiguePenalty = calculateFatiguePenalty(
    candidate,
    asOf,
    input.fatiguePenaltyPerRepeat ?? 8,
  );
  if (fatiguePenalty > 0) {
    reasons.push({
      code: 'fatigue_penalty',
      text: 'Recently repeated briefing reduced the rank.',
      delta: -fatiguePenalty,
    });
    rankWeight -= fatiguePenalty;
  }

  const urgency =
    candidate.urgency ??
    (reasonCodes.has('urgent') || reasons.some((reason) => reason.code === 'overdue')
      ? 'urgent'
      : 'nonurgent');
  const visualText = candidate.visualText ?? `${title}: ${summary}`;
  const accessibilityText =
    candidate.accessibilityLabel ??
    `${visualText}. ${reasons.map((reason) => reason.text).join(' ')}`;

  return {
    id: normalizeNonEmptyText(candidate.id, 'Briefing candidate id'),
    kind: candidate.kind,
    title,
    summary,
    urgency,
    rankWeight,
    evidenceWeight,
    penalties: { uncertaintyPenalty, fatiguePenalty },
    reasons,
    reasonCodes: unique(reasons.map((reason) => reason.code)),
    sourceIds: [...(candidate.sourceIds ?? [])],
    visualText,
    accessibilityText,
    sortDate: normalizedDate ?? '9999-12-31',
  };
}

function toRankedBriefingCandidate(
  candidate: BriefingRankingDraft,
  rank: number,
): RankedBriefingCandidate {
  return {
    id: candidate.id,
    kind: candidate.kind,
    title: candidate.title,
    summary: candidate.summary,
    urgency: candidate.urgency,
    rank,
    rankWeight: candidate.rankWeight,
    evidenceWeight: candidate.evidenceWeight,
    penalties: candidate.penalties,
    reasons: candidate.reasons,
    reasonCodes: candidate.reasonCodes,
    sourceIds: candidate.sourceIds,
    visualText: candidate.visualText,
    accessibilityText: candidate.accessibilityText,
  };
}

function compareProjectionCashflows(
  left: PositionCashflowInput,
  right: PositionCashflowInput,
): number {
  const dateComparison = normalizeLocalDate(left.date).localeCompare(
    normalizeLocalDate(right.date),
  );
  if (dateComparison !== 0) return dateComparison;
  const weightComparison = projectionCashflowWeight(left) - projectionCashflowWeight(right);
  if (weightComparison !== 0) return weightComparison;
  return left.id.localeCompare(right.id);
}

function projectionCashflowWeight(cashflow: PositionCashflowInput): number {
  const money = normalizeMoney(cashflow.amount);
  if (cashflow.state === 'actual') return 0;
  if (cashflow.protected === true && money.minorUnits < 0) return 1;
  if (money.minorUnits < 0) return 2;
  if (money.minorUnits > 0) return 3;
  if (cashflow.state === 'inferred') return 4;
  return 5;
}

function isBeforeNextIncomeBoundary(
  localDate: LocalDate,
  amountMinor: number,
  nextIncomeDate: LocalDate,
): boolean {
  return localDate < nextIncomeDate || (localDate === nextIncomeDate && amountMinor < 0);
}

function compareBriefingRankingDrafts(
  left: BriefingRankingDraft,
  right: BriefingRankingDraft,
): number {
  const urgencyComparison = urgencyWeight(right.urgency) - urgencyWeight(left.urgency);
  if (urgencyComparison !== 0) return urgencyComparison;
  const rankComparison = right.rankWeight - left.rankWeight;
  if (rankComparison !== 0) return rankComparison;
  const dateComparison = left.sortDate.localeCompare(right.sortDate);
  if (dateComparison !== 0) return dateComparison;
  const kindComparison = left.kind.localeCompare(right.kind);
  if (kindComparison !== 0) return kindComparison;
  return left.id.localeCompare(right.id);
}

function urgencyWeight(urgency: BriefingUrgency): number {
  return urgency === 'urgent' ? 1 : 0;
}

function briefingReasonFromCode(code: BriefingReasonCode): BriefingRankReason {
  if (code === 'expected_actual_variance') {
    return { code, text: 'Actual amount differs from the expected amount.', delta: 30 };
  }
  if (code === 'position_risk') {
    return { code, text: 'Position is close to a protected boundary.', delta: 25 };
  }
  if (code === 'review_needed') {
    return { code, text: 'Needs user review.', delta: 22 };
  }
  if (code === 'fresh_fact') {
    return { code, text: 'Newly confirmed fact.', delta: 12 };
  }
  if (code === 'calendar_focus') {
    return { code, text: "Relevant to today's calendar.", delta: 10 };
  }
  if (code === 'urgent') return { code, text: 'Marked urgent.', delta: 100 };
  if (code === 'overdue') return { code, text: 'Past its expected date.', delta: 45 };
  if (code === 'due_today') return { code, text: 'Due today.', delta: 35 };
  if (code === 'due_soon') return { code, text: 'Due in the next three days.', delta: 20 };
  if (code === 'user_pinned') return { code, text: 'Pinned by the user.', delta: 25 };
  if (code === 'limited_evidence') return { code, text: 'Limited evidence.', delta: -15 };
  if (code === 'uncertainty_penalty') {
    return { code, text: 'Limited evidence means this appears after clearer items.', delta: -5 };
  }
  return { code, text: 'Recently repeated briefing reduced the rank.', delta: -8 };
}

function calculateFatiguePenalty(
  candidate: BriefingCandidateInput,
  asOf: LocalDate,
  penaltyPerRepeat: number,
): number {
  assertSafeInteger(penaltyPerRepeat, 'Fatigue penalty per repeat');
  const repeatPenalty = (candidate.fatigueCount ?? 0) * penaltyPerRepeat;
  assertSafeInteger(repeatPenalty, 'Repeat fatigue penalty');
  if (candidate.lastShownOn === undefined) return repeatPenalty;

  const daysSinceShown = diffLocalDays(normalizeLocalDate(candidate.lastShownOn), asOf);
  if (daysSinceShown <= 0) return repeatPenalty + 12;
  if (daysSinceShown === 1) return repeatPenalty + 6;
  if (daysSinceShown <= 3) return repeatPenalty + 3;
  return repeatPenalty;
}

function buildTimelineRow(event: TimelineEventInput, asOf: LocalDate): TimelineRow {
  const localDate = normalizeLocalDate(event.localDate);
  const localTime = event.localTime === undefined ? undefined : normalizeLocalTime(event.localTime);
  const state = event.state ?? defaultTimelineState(event.sourceKind);
  const amount = event.amount === undefined ? undefined : normalizeMoney(event.amount);
  const position = localDate < asOf ? 'past' : localDate === asOf ? 'today' : 'future';
  const visualText =
    event.visualText ??
    `${event.title}${amount === undefined ? '' : `, ${formatMinor(amount.minorUnits, amount.currency)}`}`;
  const row: {
    id: string;
    rowKind: 'event';
    eventState: TimelineEventState;
    timelinePosition: TimelinePosition;
    localDate: LocalDate;
    localTime?: LocalTime;
    sourceKind: TimelineSourceKind;
    title: string;
    detail?: string;
    amountMinor?: number;
    currency?: CurrencyCode;
    sourceIds: readonly string[];
    visualText: string;
    accessibilityText: string;
  } = {
    id: normalizeNonEmptyText(event.id, 'Timeline event id'),
    rowKind: 'event',
    eventState: state,
    timelinePosition: position,
    localDate,
    sourceKind: event.sourceKind,
    title: normalizeNonEmptyText(event.title, `Timeline event ${event.id} title`),
    sourceIds: [...(event.sourceIds ?? [])],
    visualText,
    accessibilityText:
      event.accessibilityLabel ??
      `${state} ${event.sourceKind} on ${localDate}${localTime === undefined ? '' : ` at ${localTime}`}: ${visualText}.`,
  };
  if (localTime !== undefined) row.localTime = localTime;
  if (event.detail !== undefined) row.detail = event.detail;
  if (amount !== undefined) {
    row.amountMinor = amount.minorUnits;
    row.currency = amount.currency;
  }
  return row;
}

function compareTimelineRows(left: TimelineRow, right: TimelineRow): number {
  const dateComparison = left.localDate.localeCompare(right.localDate);
  if (dateComparison !== 0) return dateComparison;
  const timeComparison = (left.localTime ?? '00:00:00').localeCompare(
    right.localTime ?? '00:00:00',
  );
  if (timeComparison !== 0) return timeComparison;
  const stateComparison =
    timelineStateWeight(left.eventState) - timelineStateWeight(right.eventState);
  if (stateComparison !== 0) return stateComparison;
  return left.id.localeCompare(right.id);
}

function timelineStateWeight(state: TimelineEventState): number {
  return state === 'actual' ? 0 : 1;
}

function defaultTimelineState(sourceKind: TimelineSourceKind): TimelineEventState {
  return sourceKind === 'transaction' || sourceKind === 'system' ? 'actual' : 'expected';
}

function buildTransactionRow(
  transaction: FinancialTransaction,
  input: TransactionViewInput,
): TransactionListRow {
  const sourceLabel =
    input.sourceLabels?.[transaction.sourceKind] ?? transaction.sourceKind.replaceAll('_', ' ');
  const description = transaction.description ?? transaction.reference ?? 'Untitled transaction';
  const provenance: {
    sourceKind: TransactionSourceKind;
    sourceLabel: string;
    certainty: TransactionCertainty;
    reviewStatus: TransactionReviewStatus;
    versionRevision: number;
    dataVersion: string;
    reference?: string;
    bookedAt?: InstantString;
  } = {
    sourceKind: transaction.sourceKind,
    sourceLabel,
    certainty: transaction.certainty,
    reviewStatus: transaction.reviewStatus,
    versionRevision: transaction.version.revision,
    dataVersion: transaction.version.dataVersion,
  };
  if (transaction.reference !== undefined) provenance.reference = transaction.reference;
  if (transaction.bookedAt !== undefined) provenance.bookedAt = transaction.bookedAt;

  const correction: TransactionCorrectionPlaceholders = {
    placeholder: true,
    canCreateMutation: false,
    correctionDraftId: null,
    replacementTransactionId: transaction.replacedBy ?? null,
    reversalTransactionId: transaction.reversalOf ?? null,
    blockedReason: 'requires_transaction_write_adapter',
  };

  const accountLabel =
    input.accountLabels?.[String(transaction.accountId)] ?? String(transaction.accountId);
  const row: {
    id: TransactionId;
    workspaceId: string;
    accountId: AccountId;
    accountLabel: string;
    localDate: LocalDate;
    status: TransactionStatus;
    amountMinor: number;
    currency: CurrencyCode;
    description: string;
    provenance: TransactionProvenanceView;
    correction: TransactionCorrectionPlaceholders;
    linkedExpectationId?: ExpectationId;
    transferLinkId?: string;
    accessibilityText: string;
    visualText: string;
  } = {
    id: transaction.id,
    workspaceId: String(transaction.workspaceId),
    accountId: transaction.accountId,
    accountLabel,
    localDate: transaction.localDate,
    status: transaction.status,
    amountMinor: transaction.amount.minorUnits,
    currency: transaction.amount.currency,
    description,
    provenance,
    correction,
    accessibilityText: `${description}, ${formatMinor(
      transaction.amount.minorUnits,
      transaction.amount.currency,
    )}, ${transaction.status}, from ${sourceLabel}.`,
    visualText: `${description} ${formatMinor(transaction.amount.minorUnits, transaction.amount.currency)}`,
  };
  if (transaction.fulfils !== undefined) row.linkedExpectationId = transaction.fulfils;
  if (transaction.transferLink !== undefined) row.transferLinkId = String(transaction.transferLink);
  return row;
}

function toCalendarItem(row: TimelineRow, durationMinutes: number | undefined): CalendarItem {
  if (durationMinutes === undefined) return row;
  return {
    ...row,
    durationMinutes,
  };
}

function buildDayRange(
  start: LocalDate,
  end: LocalDate,
  asOf: LocalDate,
  items: readonly CalendarItem[],
  currentMonth?: string,
): readonly CalendarDayView[] {
  const days: CalendarDayView[] = [];
  for (let date = start; date <= end; date = addDaysToLocalDate(date, 1)) {
    const dayItems = items.filter((item) => item.localDate === date);
    const inCurrentMonth = currentMonth === undefined || date.startsWith(currentMonth);
    days.push({
      date,
      inCurrentMonth,
      isToday: date === asOf,
      items: dayItems,
      accessibilityText: describeCalendarDay(date, dayItems, date === asOf),
    });
  }
  return days;
}

function buildMonthWeeks(
  asOf: LocalDate,
  items: readonly CalendarItem[],
): readonly (readonly CalendarDayView[])[] {
  const month = asOf.slice(0, 7);
  const first = createLocalDate(`${month}-01`);
  const last = endOfMonth(asOf);
  const gridStart = startOfWeekMonday(first);
  const gridEnd = addDaysToLocalDate(startOfWeekMonday(last), 6);
  const weeks: CalendarDayView[][] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    const weekEnd = addDaysToLocalDate(cursor, 6);
    weeks.push([...buildDayRange(cursor, weekEnd, asOf, items, month)]);
    cursor = addDaysToLocalDate(cursor, 7);
  }
  return weeks;
}

function describeCalendarDay(
  date: LocalDate,
  items: readonly CalendarItem[],
  isToday: boolean,
): string {
  const prefix = isToday ? `Today ${date}` : `Date ${date}`;
  if (items.length === 0) return `${prefix}: no internal calendar items.`;
  return `${prefix}: ${items.length} item${items.length === 1 ? '' : 's'}; ${items
    .map((item) => `${item.eventState} ${item.title}`)
    .join('; ')}.`;
}

function buildPlannedTaskReminder(
  item: TaskReminderInput,
  asOf: LocalDate,
  defaultReminderTime: LocalTime,
): PlannedTaskReminder {
  const dueDate = normalizeLocalDate(item.dueDate);
  const dueTime = item.dueTime === undefined ? undefined : normalizeLocalTime(item.dueTime);
  const state = taskReminderState(item.completed === true, dueDate, asOf);
  const priority = item.priority ?? 'normal';
  const title = normalizeNonEmptyText(item.title, `Task reminder ${item.id} title`);
  const notificationRequest =
    item.completed === true || item.reminderOffsetMinutes === undefined
      ? undefined
      : buildNotificationRequest(item, title, dueDate, dueTime ?? defaultReminderTime);
  const visualText = `${title}, ${state}, due ${dueDate}${dueTime === undefined ? '' : ` ${dueTime}`}.`;
  const planned: {
    id: string;
    kind: TaskReminderKind;
    title: string;
    dueDate: LocalDate;
    dueTime?: LocalTime;
    priority: TaskReminderPriority;
    state: TaskReminderState;
    sourceIds: readonly string[];
    notificationRequest?: NotificationScheduleRequest;
    visualText: string;
    accessibilityText: string;
  } = {
    id: normalizeNonEmptyText(item.id, 'Task reminder id'),
    kind: item.kind,
    title,
    dueDate,
    priority,
    state,
    sourceIds: [...(item.sourceIds ?? [])],
    visualText,
    accessibilityText: `${item.kind} ${title}. ${state}. Priority ${priority}. Notification scheduling is blocked in the pure model.`,
  };
  if (dueTime !== undefined) planned.dueTime = dueTime;
  if (notificationRequest !== undefined) planned.notificationRequest = notificationRequest;
  return planned;
}

function buildNotificationRequest(
  item: TaskReminderInput,
  title: string,
  dueDate: LocalDate,
  dueTime: LocalTime,
): NotificationScheduleRequest {
  const offset = item.reminderOffsetMinutes ?? 0;
  assertSafeInteger(offset, `Reminder offset for ${item.id}`);
  if (offset < 0) throw new Error('Reminder offset must be non-negative.');
  return {
    itemId: item.id,
    title,
    localDateTime: addMinutesToLocalDateTime(createLocalDateTime(`${dueDate}T${dueTime}`), -offset),
    blocked: true,
    blockedReason: 'notification_scheduling_blocked_until_runtime_adapter',
  };
}

function comparePlannedItems(left: PlannedTaskReminder, right: PlannedTaskReminder): number {
  const dateComparison = left.dueDate.localeCompare(right.dueDate);
  if (dateComparison !== 0) return dateComparison;
  const timeComparison = (left.dueTime ?? '23:59:59').localeCompare(right.dueTime ?? '23:59:59');
  if (timeComparison !== 0) return timeComparison;
  const priorityComparison = priorityWeight(right.priority) - priorityWeight(left.priority);
  if (priorityComparison !== 0) return priorityComparison;
  return left.id.localeCompare(right.id);
}

function taskReminderState(
  completed: boolean,
  dueDate: LocalDate,
  asOf: LocalDate,
): TaskReminderState {
  if (completed) return 'completed';
  if (dueDate < asOf) return 'overdue';
  if (dueDate === asOf) return 'today';
  return 'upcoming';
}

function priorityWeight(priority: TaskReminderPriority): number {
  if (priority === 'critical') return 4;
  if (priority === 'important') return 3;
  if (priority === 'normal') return 2;
  return 1;
}

function normalizeMoney(input: MoneyLike): Money {
  return createMoney(input);
}

function assertCurrency(actual: CurrencyCode, expected: CurrencyCode, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label} uses ${actual}, expected ${expected}.`);
  }
}

function normalizeLocalDate(input: string | LocalDate): LocalDate {
  return createLocalDate(String(input));
}

function normalizeLocalTime(input: string | LocalTime): LocalTime {
  return createLocalTime(String(input));
}

function diffLocalDays(left: LocalDate, right: LocalDate): number {
  return Math.round((localDateToUtcMs(right) - localDateToUtcMs(left)) / 86_400_000);
}

function localDateToUtcMs(date: LocalDate): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  return Date.UTC(year, month - 1, day);
}

function startOfWeekMonday(date: LocalDate): LocalDate {
  const day = new Date(localDateToUtcMs(date)).getUTCDay();
  const offset = (day + 6) % 7;
  return addDaysToLocalDate(date, -offset);
}

function endOfMonth(date: LocalDate): LocalDate {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return createLocalDate(`${date.slice(0, 8)}${String(daysInMonth).padStart(2, '0')}`);
}

function addMinutesToLocalDateTime(local: LocalDateTime, minutes: number): LocalDateTime {
  assertSafeInteger(minutes, 'Minute offset');
  const year = Number(local.slice(0, 4));
  const month = Number(local.slice(5, 7));
  const day = Number(local.slice(8, 10));
  const hour = Number(local.slice(11, 13));
  const minute = Number(local.slice(14, 16));
  const second = Number(local.slice(17, 19));
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes, second));
  return createLocalDateTime(date.toISOString().slice(0, 19));
}

function formatMinor(minorUnits: number, currency: CurrencyCode): string {
  assertSafeInteger(minorUnits, 'Formatted money amount');
  const sign = minorUnits < 0 ? '-' : '';
  const absolute = Math.abs(minorUnits);
  const major = Math.floor(absolute / 100);
  const minor = absolute % 100;
  return `${currency} ${sign}${major}.${String(minor).padStart(2, '0')}`;
}

function normalizeNonEmptyText(input: string, label: string): string {
  const normalized = input.trim();
  if (normalized.length === 0) throw new Error(`${label} is required.`);
  return normalized;
}

function assertProbability(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be between 0 and 1.`);
  }
}

function assertBoundedInteger(value: number, min: number, max: number, label: string): void {
  assertSafeInteger(value, label);
  if (value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer.`);
  }
}

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}
