export type Phase6Source = Readonly<{
  kind: 'synthetic';
  label: 'Synthetic sample';
  description: string;
}>;

export type Phase6MoneyAmount = Readonly<{
  minorUnits: number;
  currency: string;
}>;

export type Phase6GateMetadata = Readonly<{
  phase: 'phase6';
  slice: 'mobile-shell-evidence-adapter';
  owns: readonly ['apps/mobile/src/phase6/**'];
  uiReady: true;
  screenIntegratedByThisSlice: false;
  nativeDependencies: false;
  realData: false;
  deviceNotificationIntegration: false;
  externalCalendarIntegration: false;
  fileOrCaptureIntegration: false;
  dashboardGridAssumption: false;
  evidenceAreas: readonly Phase6EvidenceArea[];
}>;

export type Phase6EvidenceArea =
  | 'today_briefing'
  | 'position_summary'
  | 'event_first_timeline'
  | 'transaction_metadata'
  | 'internal_calendar'
  | 'tasks_reminders'
  | 'notification_policy_copy'
  | 'variance_question'
  | 'search_rows'
  | 'accessible_visuals';

export type Phase6BriefingTone = 'attention' | 'expected' | 'progress';

export type Phase6BriefingItem = Readonly<{
  id: string;
  tone: Phase6BriefingTone;
  title: string;
  body: string;
  reason: string;
  actionLabel: string;
  linkedEventId?: string;
  accessibilityLabel: string;
  source: Phase6Source;
}>;

export type Phase6TodayBriefing = Readonly<{
  title: 'Today';
  asOfLabel: string;
  sourceLabel: 'Synthetic sample';
  presentation: 'briefing_list';
  dashboardGridRequired: false;
  items: readonly Phase6BriefingItem[];
  primaryActionLabel: string;
  screenReaderSummary: string;
}>;

export type Phase6PositionSummary = Readonly<{
  title: string;
  sourceLabel: 'Synthetic sample';
  asOfLabel: string;
  availableNowLabel: string;
  beforeIncomeLabel: string;
  afterIncomeLabel: string;
  nextImportantLabel: string;
  certaintyLabel: string;
  textEquivalent: string;
  dataPoints: readonly Phase6PositionPoint[];
}>;

export type Phase6PositionPoint = Readonly<{
  id: string;
  label: string;
  amountLabel: string;
  statusLabel: 'known' | 'expected' | 'derived';
  source: Phase6Source;
}>;

export type Phase6EventKind =
  | 'actual_transaction'
  | 'expected_transaction'
  | 'planner_task'
  | 'calendar_item'
  | 'reminder'
  | 'variance_question';

export type Phase6EventTiming = 'past' | 'today' | 'future';

export type Phase6EventStatus = 'actual' | 'expected' | 'planned' | 'question';

export type Phase6TimelineEvent = Readonly<{
  id: string;
  title: string;
  localDate: string;
  localTime?: string;
  kind: Phase6EventKind;
  timing: Phase6EventTiming;
  status: Phase6EventStatus;
  amount?: Phase6MoneyAmount;
  accountLabel?: string;
  categoryLabel?: string;
  linkedTransactionId?: string;
  linkedTaskId?: string;
  detailLabel: string;
  source: Phase6Source;
}>;

export type Phase6TimelineRow = Readonly<{
  id: string;
  title: string;
  dateLabel: string;
  timingLabel: string;
  amountLabel: string;
  statusLabel: string;
  metadataLabel: string;
  detailLabel: string;
  accessibilityLabel: string;
  sourceLabel: 'Synthetic sample';
}>;

export type Phase6TransactionKind = 'actual' | 'pending_review';

export type Phase6TransactionRecord = Readonly<{
  id: string;
  title: string;
  postedOn: string;
  amount: Phase6MoneyAmount;
  accountLabel: string;
  kind: Phase6TransactionKind;
  categoryLabel: string;
  eventId: string;
  note: string;
  source: Phase6Source;
}>;

export type Phase6TransactionRow = Readonly<{
  id: string;
  title: string;
  amountLabel: string;
  dateLabel: string;
  accountLabel: string;
  statusLabel: string;
  metadataLabel: string;
  accessibilityLabel: string;
  sourceLabel: 'Synthetic sample';
}>;

export type Phase6MetadataRow = Readonly<{
  label: string;
  value: string;
}>;

export type Phase6TransactionDetail = Readonly<{
  id: string;
  title: string;
  headingLabel: string;
  amountLabel: string;
  metadataRows: readonly Phase6MetadataRow[];
  linkedEventId: string;
  accessibilityLabel: string;
  sourceLabel: 'Synthetic sample';
}>;

export type Phase6TransactionMetadata = Readonly<{
  rows: readonly Phase6TransactionRow[];
  details: readonly Phase6TransactionDetail[];
  emptyStateLabel: string;
  sourceLabel: 'Synthetic sample';
}>;

export type Phase6CalendarViewId = 'today' | 'week' | 'month' | 'timeline';

export type Phase6CalendarItem = Readonly<{
  id: string;
  title: string;
  localDate: string;
  localTime?: string;
  kind: 'money_date' | 'general_event' | 'task_due';
  eventId?: string;
  taskId?: string;
  source: Phase6Source;
}>;

export type Phase6CalendarRow = Readonly<{
  id: string;
  label: string;
  dateLabel: string;
  timeLabel: string;
  kindLabel: string;
  accessibilityLabel: string;
  sourceLabel: 'Synthetic sample';
}>;

export type Phase6CalendarView = Readonly<{
  id: Phase6CalendarViewId;
  title: string;
  rangeLabel: string;
  internalOnly: true;
  copy: string;
  rows: readonly Phase6CalendarRow[];
}>;

export type Phase6TaskStatus = 'open' | 'done' | 'waiting';

export type Phase6ReminderMode = 'in_app_only' | 'device_alert_available_later';

export type Phase6Task = Readonly<{
  id: string;
  title: string;
  dueDate: string;
  status: Phase6TaskStatus;
  reminderMode: Phase6ReminderMode;
  reminderCopy: string;
  linkedEventId?: string;
  completionEffectLabel: string;
  source: Phase6Source;
}>;

export type Phase6TaskRow = Readonly<{
  id: string;
  title: string;
  dueLabel: string;
  statusLabel: string;
  reminderLabel: string;
  completionEffectLabel: string;
  accessibilityLabel: string;
  sourceLabel: 'Synthetic sample';
}>;

export type Phase6TaskSummary = Readonly<{
  title: string;
  openCountLabel: string;
  rows: readonly Phase6TaskRow[];
  screenReaderSummary: string;
}>;

export type Phase6NotificationClassKey =
  | 'critical_deadline'
  | 'meaningful_change'
  | 'ritual'
  | 'progress'
  | 'marketing';

export type Phase6NotificationPolicyRow = Readonly<{
  key: Phase6NotificationClassKey;
  title: string;
  defaultLabel: string;
  limitLabel: string;
  exampleLabel: string;
}>;

export type Phase6NotificationPolicyCopy = Readonly<{
  title: string;
  defaultStateLabel: string;
  permissionCopy: string;
  lockScreenCopy: string;
  inAppFallbackCopy: string;
  dedupeCopy: string;
  rows: readonly Phase6NotificationPolicyRow[];
  forbiddenExamples: readonly string[];
}>;

export type Phase6VarianceOptionId =
  | 'one_off_charge'
  | 'new_regular_amount'
  | 'service_fee'
  | 'not_sure';

export type Phase6VarianceOption = Readonly<{
  id: Phase6VarianceOptionId;
  label: string;
  outcomeLabel: string;
  accessibilityLabel: string;
}>;

export type Phase6VarianceQuestion = Readonly<{
  id: string;
  title: string;
  prompt: string;
  expectedLabel: string;
  actualLabel: string;
  varianceLabel: string;
  boundedChoiceLabel: string;
  noDirectWriteCopy: string;
  options: readonly Phase6VarianceOption[];
  sourceLabel: 'Synthetic sample';
}>;

export type Phase6SearchDestination = Readonly<{
  tabLabel: 'Today' | 'Timeline' | 'Money' | 'Calendar' | 'Plans';
  routeKey: 'today' | 'timeline' | 'money' | 'calendar' | 'plans';
  targetId: string;
}>;

export type Phase6SearchRow = Readonly<{
  id: string;
  title: string;
  typeLabel: string;
  subtitle: string;
  matchedText: string;
  destination: Phase6SearchDestination;
  accessibilityLabel: string;
  sourceLabel: 'Synthetic sample';
  keywords: readonly string[];
}>;

export type Phase6VisualProofRow = Readonly<{
  label: string;
  value: string;
  state: 'ready';
}>;

export type Phase6VisualDataRow = Readonly<{
  label: string;
  value: string;
}>;

export type Phase6AccessibleVisual = Readonly<{
  id: string;
  title: string;
  chartKind: 'cash_flow' | 'task_progress';
  textEquivalent: string;
  dataRows: readonly Phase6VisualDataRow[];
  nonColorCues: readonly string[];
  requiresMotion: false;
  sourceLabel: 'Synthetic sample';
}>;

export type Phase6AccessibleVisualProof = Readonly<{
  title: string;
  dashboardGridRequired: false;
  visuals: readonly Phase6AccessibleVisual[];
  proofRows: readonly Phase6VisualProofRow[];
}>;

export type Phase6ShellEvidence = Readonly<{
  gate: Phase6GateMetadata;
  today: Phase6TodayBriefing;
  position: Phase6PositionSummary;
  timeline: readonly Phase6TimelineRow[];
  transactions: Phase6TransactionMetadata;
  calendarViews: readonly Phase6CalendarView[];
  tasks: Phase6TaskSummary;
  notificationPolicy: Phase6NotificationPolicyCopy;
  varianceQuestion: Phase6VarianceQuestion;
  searchRows: readonly Phase6SearchRow[];
  accessibleVisuals: Phase6AccessibleVisualProof;
}>;

export type BuildPhase6ShellEvidenceInput = Readonly<{
  asOf: string;
  position: Readonly<{
    availableNow: Phase6MoneyAmount;
    balanceBeforeIncome: Phase6MoneyAmount;
    balanceAfterIncome: Phase6MoneyAmount;
    nextImportantTitle: string;
    nextImportantDate: string;
    certaintyLabel: string;
  }>;
  events: readonly Phase6TimelineEvent[];
  transactions: readonly Phase6TransactionRecord[];
  calendarItems: readonly Phase6CalendarItem[];
  tasks: readonly Phase6Task[];
  source: Phase6Source;
}>;

const syntheticSource: Phase6Source = {
  kind: 'synthetic',
  label: 'Synthetic sample',
  description: 'Demo-only values for UI proof; not live personal data.',
};

export const phase6GateMetadata: Phase6GateMetadata = {
  phase: 'phase6',
  slice: 'mobile-shell-evidence-adapter',
  owns: ['apps/mobile/src/phase6/**'],
  uiReady: true,
  screenIntegratedByThisSlice: false,
  nativeDependencies: false,
  realData: false,
  deviceNotificationIntegration: false,
  externalCalendarIntegration: false,
  fileOrCaptureIntegration: false,
  dashboardGridAssumption: false,
  evidenceAreas: [
    'today_briefing',
    'position_summary',
    'event_first_timeline',
    'transaction_metadata',
    'internal_calendar',
    'tasks_reminders',
    'notification_policy_copy',
    'variance_question',
    'search_rows',
    'accessible_visuals',
  ],
};

export const phase6SyntheticPosition = {
  availableNow: { minorUnits: 72000, currency: 'GBP' },
  balanceBeforeIncome: { minorUnits: -10000, currency: 'GBP' },
  balanceAfterIncome: { minorUnits: 175000, currency: 'GBP' },
  nextImportantTitle: 'Rent before income',
  nextImportantDate: '2026-06-25',
  certaintyLabel: 'Expected items only',
} as const;

export const phase6SyntheticEvents: readonly Phase6TimelineEvent[] = [
  {
    id: 'synthetic_event_grocer_actual',
    title: 'Grocer posted',
    localDate: '2026-06-18',
    kind: 'actual_transaction',
    timing: 'past',
    status: 'actual',
    amount: { minorUnits: -3210, currency: 'GBP' },
    accountLabel: 'Current account',
    categoryLabel: 'Food',
    linkedTransactionId: 'synthetic_transaction_grocer',
    detailLabel: 'Actual sample transaction linked to the money list.',
    source: syntheticSource,
  },
  {
    id: 'synthetic_event_today_review',
    title: 'Review rent sequence',
    localDate: '2026-06-21',
    localTime: '09:00',
    kind: 'planner_task',
    timing: 'today',
    status: 'planned',
    linkedTaskId: 'synthetic_task_review_rent',
    detailLabel: 'Planner task asking the user to review the expected rent timing.',
    source: syntheticSource,
  },
  {
    id: 'synthetic_event_rent_expected',
    title: 'Rent expected',
    localDate: '2026-06-25',
    kind: 'expected_transaction',
    timing: 'future',
    status: 'expected',
    amount: { minorUnits: -82000, currency: 'GBP' },
    accountLabel: 'Current account',
    categoryLabel: 'Bills',
    detailLabel: 'Expected outgoing remains separate from actual transactions.',
    source: syntheticSource,
  },
  {
    id: 'synthetic_event_income_expected',
    title: 'Income expected',
    localDate: '2026-06-28',
    kind: 'expected_transaction',
    timing: 'future',
    status: 'expected',
    amount: { minorUnits: 185000, currency: 'GBP' },
    accountLabel: 'Current account',
    categoryLabel: 'Income',
    detailLabel: 'Expected income used only for the synthetic projection.',
    source: syntheticSource,
  },
  {
    id: 'synthetic_event_rent_variance',
    title: 'Rent amount changed',
    localDate: '2026-06-28',
    localTime: '18:00',
    kind: 'variance_question',
    timing: 'future',
    status: 'question',
    amount: { minorUnits: -3000, currency: 'GBP' },
    detailLabel: 'Bounded question explains a difference without changing future rules directly.',
    source: syntheticSource,
  },
];

export const phase6SyntheticTransactions: readonly Phase6TransactionRecord[] = [
  {
    id: 'synthetic_transaction_grocer',
    title: 'Grocer',
    postedOn: '2026-06-18',
    amount: { minorUnits: -3210, currency: 'GBP' },
    accountLabel: 'Current account',
    kind: 'actual',
    categoryLabel: 'Food',
    eventId: 'synthetic_event_grocer_actual',
    note: 'Actual sample row for list and detail metadata.',
    source: syntheticSource,
  },
  {
    id: 'synthetic_transaction_coffee_review',
    title: 'Coffee shop',
    postedOn: '2026-06-20',
    amount: { minorUnits: -425, currency: 'GBP' },
    accountLabel: 'Current account',
    kind: 'pending_review',
    categoryLabel: 'To confirm',
    eventId: 'synthetic_event_today_review',
    note: 'Pending-review sample row with a visible metadata state.',
    source: syntheticSource,
  },
];

export const phase6SyntheticCalendarItems: readonly Phase6CalendarItem[] = [
  {
    id: 'synthetic_calendar_today_review',
    title: 'Review rent sequence',
    localDate: '2026-06-21',
    localTime: '09:00',
    kind: 'task_due',
    eventId: 'synthetic_event_today_review',
    taskId: 'synthetic_task_review_rent',
    source: syntheticSource,
  },
  {
    id: 'synthetic_calendar_rent',
    title: 'Rent expected',
    localDate: '2026-06-25',
    kind: 'money_date',
    eventId: 'synthetic_event_rent_expected',
    source: syntheticSource,
  },
  {
    id: 'synthetic_calendar_income',
    title: 'Income expected',
    localDate: '2026-06-28',
    kind: 'money_date',
    eventId: 'synthetic_event_income_expected',
    source: syntheticSource,
  },
  {
    id: 'synthetic_calendar_call',
    title: 'Call housing office',
    localDate: '2026-06-29',
    localTime: '11:30',
    kind: 'general_event',
    source: syntheticSource,
  },
];

export const phase6SyntheticTasks: readonly Phase6Task[] = [
  {
    id: 'synthetic_task_review_rent',
    title: 'Review rent sequence',
    dueDate: '2026-06-21',
    status: 'open',
    reminderMode: 'in_app_only',
    reminderCopy: 'In-app reminder only in this shell.',
    linkedEventId: 'synthetic_event_today_review',
    completionEffectLabel: 'Marks the linked planner task complete.',
    source: syntheticSource,
  },
  {
    id: 'synthetic_task_confirm_coffee',
    title: 'Confirm coffee label',
    dueDate: '2026-06-22',
    status: 'waiting',
    reminderMode: 'in_app_only',
    reminderCopy: 'Visible in the task list without a device alert.',
    completionEffectLabel: 'Updates the review state for the sample transaction.',
    source: syntheticSource,
  },
  {
    id: 'synthetic_task_payday_review',
    title: 'Payday review',
    dueDate: '2026-06-28',
    status: 'done',
    reminderMode: 'device_alert_available_later',
    reminderCopy: 'Device alert copy is modelled, not connected by this shell.',
    linkedEventId: 'synthetic_event_income_expected',
    completionEffectLabel: 'Keeps the completed task visible in progress summaries.',
    source: syntheticSource,
  },
];

export const defaultPhase6ShellEvidence: Phase6ShellEvidence = buildPhase6ShellEvidence({
  asOf: '2026-06-21',
  position: phase6SyntheticPosition,
  events: phase6SyntheticEvents,
  transactions: phase6SyntheticTransactions,
  calendarItems: phase6SyntheticCalendarItems,
  tasks: phase6SyntheticTasks,
  source: syntheticSource,
});

export function buildPhase6ShellEvidence(
  input: BuildPhase6ShellEvidenceInput,
): Phase6ShellEvidence {
  const timeline = buildTimelineRows(input.events);
  const transactionMetadata = buildTransactionMetadata(input.transactions);
  const tasks = buildTaskSummary(input.tasks);

  return {
    gate: phase6GateMetadata,
    today: buildTodayBriefing(input.asOf, input.events, input.tasks, input.source),
    position: buildPositionSummary(input.asOf, input.position, input.source),
    timeline,
    transactions: transactionMetadata,
    calendarViews: buildCalendarViews(input.asOf, input.calendarItems),
    tasks,
    notificationPolicy: buildNotificationPolicyCopy(),
    varianceQuestion: buildVarianceQuestion(),
    searchRows: buildSearchRows({
      events: input.events,
      transactions: input.transactions,
      tasks: input.tasks,
      calendarItems: input.calendarItems,
    }),
    accessibleVisuals: buildAccessibleVisualProof(input.position, tasks.rows),
  };
}

export function buildTodayBriefing(
  asOf: string,
  events: readonly Phase6TimelineEvent[],
  tasks: readonly Phase6Task[],
  source: Phase6Source,
): Phase6TodayBriefing {
  const expectedRent = events.find((event) => event.id === 'synthetic_event_rent_expected');
  const expectedIncome = events.find((event) => event.id === 'synthetic_event_income_expected');
  const pendingTask = tasks.find((task) => task.status !== 'done');
  const items: Phase6BriefingItem[] = [
    {
      id: 'synthetic_briefing_rent_before_income',
      tone: 'attention',
      title: 'Rent comes before income',
      body: [
        expectedRent?.title ?? 'Expected outgoing',
        expectedRent === undefined ? undefined : formatShortDate(expectedRent.localDate),
        expectedIncome === undefined
          ? undefined
          : `income ${formatShortDate(expectedIncome.localDate)}`,
      ]
        .filter(isDefined)
        .join(' | '),
      reason: 'Expected and actual items stay separate, so this is a sequence to review.',
      actionLabel: 'Review timeline',
      accessibilityLabel: 'Attention. Rent comes before income. Review timeline.',
      source,
      ...(expectedRent === undefined ? {} : { linkedEventId: expectedRent.id }),
    },
    {
      id: 'synthetic_briefing_income_expected',
      tone: 'expected',
      title: 'Income expected this week',
      body:
        expectedIncome?.amount === undefined
          ? 'Expected income is on the timeline.'
          : `${formatMoney(expectedIncome.amount.minorUnits, expectedIncome.amount.currency)} on ${
              expectedIncome === undefined
                ? 'the timeline'
                : formatShortDate(expectedIncome.localDate)
            }.`,
      reason: 'Shown as an expected item, not counted as a posted transaction.',
      actionLabel: 'Open expected item',
      accessibilityLabel: 'Expected. Income expected this week. Open expected item.',
      source,
      ...(expectedIncome === undefined ? {} : { linkedEventId: expectedIncome.id }),
    },
    {
      id: 'synthetic_briefing_pending_task',
      tone: 'progress',
      title: pendingTask?.title ?? 'Next task',
      body:
        pendingTask === undefined
          ? 'No open synthetic task.'
          : `${formatShortDate(pendingTask.dueDate)} | ${taskStatusLabel(pendingTask.status)}.`,
      reason: 'Task rows can be shown in the briefing without a dashboard grid.',
      actionLabel: 'Open task',
      accessibilityLabel: `Progress. ${pendingTask?.title ?? 'Next task'}. Open task.`,
      source,
      ...(pendingTask?.linkedEventId === undefined
        ? {}
        : { linkedEventId: pendingTask.linkedEventId }),
    },
  ];

  return {
    title: 'Today',
    asOfLabel: formatIsoDateLabel(asOf),
    sourceLabel: source.label,
    presentation: 'briefing_list',
    dashboardGridRequired: false,
    items,
    primaryActionLabel: 'Open timeline',
    screenReaderSummary: `Today, ${formatIsoDateLabel(asOf)}. ${items
      .map((item) => item.accessibilityLabel)
      .join(' ')}`,
  };
}

export function buildPositionSummary(
  asOf: string,
  position: BuildPhase6ShellEvidenceInput['position'],
  source: Phase6Source,
): Phase6PositionSummary {
  const availableNowLabel = formatMoney(
    position.availableNow.minorUnits,
    position.availableNow.currency,
  );
  const beforeIncomeLabel = formatMoney(
    position.balanceBeforeIncome.minorUnits,
    position.balanceBeforeIncome.currency,
  );
  const afterIncomeLabel = formatMoney(
    position.balanceAfterIncome.minorUnits,
    position.balanceAfterIncome.currency,
  );

  return {
    title: 'Position summary',
    sourceLabel: source.label,
    asOfLabel: formatIsoDateLabel(asOf),
    availableNowLabel,
    beforeIncomeLabel,
    afterIncomeLabel,
    nextImportantLabel: `${position.nextImportantTitle}, ${formatShortDate(position.nextImportantDate)}`,
    certaintyLabel: position.certaintyLabel,
    textEquivalent: `Position chart. ${availableNowLabel} available now. ${beforeIncomeLabel} before income. ${afterIncomeLabel} after income. ${position.certaintyLabel}.`,
    dataPoints: [
      {
        id: 'synthetic_position_available',
        label: 'Available now',
        amountLabel: availableNowLabel,
        statusLabel: 'known',
        source,
      },
      {
        id: 'synthetic_position_before_income',
        label: 'Before income',
        amountLabel: beforeIncomeLabel,
        statusLabel: 'derived',
        source,
      },
      {
        id: 'synthetic_position_after_income',
        label: 'After income',
        amountLabel: afterIncomeLabel,
        statusLabel: 'expected',
        source,
      },
    ],
  };
}

export function buildTimelineRows(
  events: readonly Phase6TimelineEvent[],
): readonly Phase6TimelineRow[] {
  return [...events]
    .sort((left, right) => compareEventOrder(left, right))
    .map((event) => {
      const amountLabel =
        event.amount === undefined
          ? 'No amount'
          : formatMoney(event.amount.minorUnits, event.amount.currency);
      const statusLabel = eventStatusLabel(event.status);
      const metadataLabel = [eventKindLabel(event.kind), event.accountLabel, event.categoryLabel]
        .filter(isDefined)
        .join(' | ');

      return {
        id: event.id,
        title: event.title,
        dateLabel: formatIsoDateLabel(event.localDate),
        timingLabel: eventTimingLabel(event.timing),
        amountLabel,
        statusLabel,
        metadataLabel,
        detailLabel: event.detailLabel,
        accessibilityLabel: [
          event.title,
          statusLabel,
          eventTimingLabel(event.timing),
          formatIsoDateLabel(event.localDate),
          amountLabel,
          metadataLabel,
          event.detailLabel,
        ].join('. '),
        sourceLabel: event.source.label,
      };
    });
}

export function buildTransactionMetadata(
  transactions: readonly Phase6TransactionRecord[],
): Phase6TransactionMetadata {
  const rows = transactions.map(buildTransactionRow);
  const details = transactions.map(buildTransactionDetail);

  return {
    rows,
    details,
    emptyStateLabel: 'No synthetic transactions match this view.',
    sourceLabel: 'Synthetic sample',
  };
}

export function buildTransactionRow(transaction: Phase6TransactionRecord): Phase6TransactionRow {
  const amountLabel = formatMoney(transaction.amount.minorUnits, transaction.amount.currency);
  const statusLabel =
    transaction.kind === 'actual' ? 'Actual transaction' : 'Pending review metadata';
  const metadataLabel = `${transaction.accountLabel} | ${transaction.categoryLabel}`;

  return {
    id: transaction.id,
    title: transaction.title,
    amountLabel,
    dateLabel: formatIsoDateLabel(transaction.postedOn),
    accountLabel: transaction.accountLabel,
    statusLabel,
    metadataLabel,
    accessibilityLabel: [
      transaction.title,
      amountLabel,
      formatIsoDateLabel(transaction.postedOn),
      statusLabel,
      metadataLabel,
      transaction.source.label,
    ].join('. '),
    sourceLabel: transaction.source.label,
  };
}

export function buildTransactionDetail(
  transaction: Phase6TransactionRecord,
): Phase6TransactionDetail {
  const amountLabel = formatMoney(transaction.amount.minorUnits, transaction.amount.currency);
  const statusLabel =
    transaction.kind === 'actual' ? 'Actual transaction' : 'Pending review metadata';
  const metadataRows: readonly Phase6MetadataRow[] = [
    { label: 'Source', value: transaction.source.label },
    { label: 'Record type', value: statusLabel },
    { label: 'Posted', value: formatIsoDateLabel(transaction.postedOn) },
    { label: 'Account', value: transaction.accountLabel },
    { label: 'Category', value: transaction.categoryLabel },
    { label: 'Timeline link', value: transaction.eventId },
    { label: 'Note', value: transaction.note },
  ];

  return {
    id: transaction.id,
    title: transaction.title,
    headingLabel: `${transaction.title} detail`,
    amountLabel,
    metadataRows,
    linkedEventId: transaction.eventId,
    accessibilityLabel: `${transaction.title} detail. ${amountLabel}. ${metadataRows
      .map((row) => `${row.label}: ${row.value}`)
      .join('. ')}`,
    sourceLabel: transaction.source.label,
  };
}

export function buildCalendarViews(
  asOf: string,
  items: readonly Phase6CalendarItem[],
): readonly Phase6CalendarView[] {
  const rows = [...items].sort(compareCalendarItemOrder).map(buildCalendarRow);
  const todayRows = rows.filter((row) => row.dateLabel === formatIsoDateLabel(asOf));
  const weekRows = rows.filter((row) => isWithinDays(row.dateLabel, asOf, 7));
  const monthRows = rows.filter((row) => row.dateLabel.startsWith(asOf.slice(0, 7)));

  return [
    {
      id: 'today',
      title: 'Today',
      rangeLabel: formatIsoDateLabel(asOf),
      internalOnly: true,
      copy: 'Folio-only calendar rows from synthetic sample data.',
      rows: todayRows,
    },
    {
      id: 'week',
      title: 'Week',
      rangeLabel: `${formatIsoDateLabel(asOf)} to ${formatIsoDateLabel(addDays(asOf, 6))}`,
      internalOnly: true,
      copy: 'Internal week view; external calendars are not connected by this shell.',
      rows: weekRows,
    },
    {
      id: 'month',
      title: 'Month',
      rangeLabel: monthLabel(asOf),
      internalOnly: true,
      copy: 'Internal month view with money dates and general events together.',
      rows: monthRows,
    },
    {
      id: 'timeline',
      title: 'Timeline',
      rangeLabel: 'Ordered internal dates',
      internalOnly: true,
      copy: 'Calendar timeline mirrors event-first ordering without external calendar access.',
      rows,
    },
  ];
}

export function buildTaskSummary(tasks: readonly Phase6Task[]): Phase6TaskSummary {
  const rows = [...tasks].sort(compareTaskOrder).map(buildTaskRow);
  const openCount = rows.filter((row) => row.statusLabel !== 'Done').length;

  return {
    title: 'Tasks and reminders',
    openCountLabel: `${openCount} open`,
    rows,
    screenReaderSummary: `Tasks and reminders. ${openCount} open. ${rows
      .map((row) => row.accessibilityLabel)
      .join(' ')}`,
  };
}

export function buildTaskRow(task: Phase6Task): Phase6TaskRow {
  const statusLabel = taskStatusLabel(task.status);

  return {
    id: task.id,
    title: task.title,
    dueLabel: formatIsoDateLabel(task.dueDate),
    statusLabel,
    reminderLabel:
      task.reminderMode === 'in_app_only' ? 'In-app reminder' : 'Device alert copy available later',
    completionEffectLabel: task.completionEffectLabel,
    accessibilityLabel: [
      task.title,
      `Due ${formatIsoDateLabel(task.dueDate)}`,
      statusLabel,
      task.reminderCopy,
      task.completionEffectLabel,
    ].join('. '),
    sourceLabel: task.source.label,
  };
}

export function buildNotificationPolicyCopy(): Phase6NotificationPolicyCopy {
  return {
    title: 'Reminder policy',
    defaultStateLabel: 'Quiet by default',
    permissionCopy: 'Ask only after a useful reminder is enabled.',
    lockScreenCopy: 'Lock-screen text stays hidden or generic by default.',
    inAppFallbackCopy: 'In-app reminders remain visible when device alerts are off.',
    dedupeCopy: 'Repeat prompts are held back for the same underlying event.',
    rows: [
      {
        key: 'critical_deadline',
        title: 'Critical deadline',
        defaultLabel: 'On when enabled by the user',
        limitLabel: 'Maximum 3 per day',
        exampleLabel: 'Essential bill reminder',
      },
      {
        key: 'meaningful_change',
        title: 'Meaningful change',
        defaultLabel: 'On when enabled by the user',
        limitLabel: 'Maximum 1 per day',
        exampleLabel: 'Expected income missing',
      },
      {
        key: 'ritual',
        title: 'Ritual',
        defaultLabel: 'Off by default',
        limitLabel: 'Maximum 3 per week',
        exampleLabel: 'Payday review',
      },
      {
        key: 'progress',
        title: 'Progress',
        defaultLabel: 'On when enabled by the user',
        limitLabel: 'Maximum 1 per day',
        exampleLabel: 'Milestone reached',
      },
      {
        key: 'marketing',
        title: 'Marketing',
        defaultLabel: 'Off by default',
        limitLabel: 'Never mixed with critical deadlines',
        exampleLabel: 'Product update',
      },
    ],
    forbiddenExamples: [
      'Your streak is dying',
      'Open now or lose progress',
      'You failed your budget',
    ],
  };
}

export function buildVarianceQuestion(): Phase6VarianceQuestion {
  return {
    id: 'synthetic_variance_rent_question',
    title: 'Rent amount changed',
    prompt: 'Synthetic rent was GBP 30.00 higher than expected. What changed?',
    expectedLabel: 'Expected -GBP 820.00',
    actualLabel: 'Actual -GBP 850.00',
    varianceLabel: 'Difference -GBP 30.00',
    boundedChoiceLabel: 'Choose one answer; you can review before anything is saved.',
    noDirectWriteCopy: 'This creates a proposal for the linked rent expectation only.',
    options: [
      {
        id: 'one_off_charge',
        label: 'One-off charge',
        outcomeLabel: 'Keep the future rent expectation unchanged.',
        accessibilityLabel: 'One-off charge. Keep the future rent expectation unchanged.',
      },
      {
        id: 'new_regular_amount',
        label: 'New regular amount',
        outcomeLabel: 'Prepare a proposal to update future rent to GBP 850.00.',
        accessibilityLabel: 'New regular amount. Prepare a proposal for future rent.',
      },
      {
        id: 'service_fee',
        label: 'Separate fee',
        outcomeLabel: 'Keep rent at GBP 820.00 and tag GBP 30.00 separately.',
        accessibilityLabel: 'Separate fee. Keep rent and tag the difference separately.',
      },
      {
        id: 'not_sure',
        label: 'Not sure',
        outcomeLabel: 'Leave the question open for later review.',
        accessibilityLabel: 'Not sure. Leave the question open for later review.',
      },
    ],
    sourceLabel: 'Synthetic sample',
  };
}

export function buildSearchRows(input: {
  events: readonly Phase6TimelineEvent[];
  transactions: readonly Phase6TransactionRecord[];
  tasks: readonly Phase6Task[];
  calendarItems: readonly Phase6CalendarItem[];
}): readonly Phase6SearchRow[] {
  const eventRows = input.events.map((event) => ({
    id: `search_${event.id}`,
    title: event.title,
    typeLabel: eventKindLabel(event.kind),
    subtitle: `${formatIsoDateLabel(event.localDate)} | ${eventStatusLabel(event.status)}`,
    matchedText: event.detailLabel,
    destination: {
      tabLabel: 'Timeline',
      routeKey: 'timeline',
      targetId: event.id,
    } as const,
    accessibilityLabel: `${event.title}. Timeline result. ${event.detailLabel}. Synthetic sample.`,
    sourceLabel: event.source.label,
    keywords: [
      event.title,
      event.detailLabel,
      eventStatusLabel(event.status),
      eventKindLabel(event.kind),
    ],
  }));
  const transactionRows = input.transactions.map((transaction) => ({
    id: `search_${transaction.id}`,
    title: transaction.title,
    typeLabel: 'Transaction',
    subtitle: `${formatIsoDateLabel(transaction.postedOn)} | ${formatMoney(
      transaction.amount.minorUnits,
      transaction.amount.currency,
    )}`,
    matchedText: transaction.note,
    destination: {
      tabLabel: 'Money',
      routeKey: 'money',
      targetId: transaction.id,
    } as const,
    accessibilityLabel: `${transaction.title}. Money result. ${transaction.note}. Synthetic sample.`,
    sourceLabel: transaction.source.label,
    keywords: [
      transaction.title,
      transaction.note,
      transaction.categoryLabel,
      transaction.accountLabel,
    ],
  }));
  const taskRows = input.tasks.map((task) => ({
    id: `search_${task.id}`,
    title: task.title,
    typeLabel: 'Task',
    subtitle: `${formatIsoDateLabel(task.dueDate)} | ${taskStatusLabel(task.status)}`,
    matchedText: task.completionEffectLabel,
    destination: {
      tabLabel: 'Plans',
      routeKey: 'plans',
      targetId: task.id,
    } as const,
    accessibilityLabel: `${task.title}. Plans result. ${task.completionEffectLabel}. Synthetic sample.`,
    sourceLabel: task.source.label,
    keywords: [
      task.title,
      task.reminderCopy,
      task.completionEffectLabel,
      taskStatusLabel(task.status),
    ],
  }));
  const calendarRows = input.calendarItems.map((item) => ({
    id: `search_${item.id}`,
    title: item.title,
    typeLabel: 'Calendar',
    subtitle: `${formatIsoDateLabel(item.localDate)} | ${calendarKindLabel(item.kind)}`,
    matchedText: 'Internal calendar row from synthetic sample data.',
    destination: {
      tabLabel: 'Calendar',
      routeKey: 'calendar',
      targetId: item.id,
    } as const,
    accessibilityLabel: `${item.title}. Calendar result. Internal calendar row. Synthetic sample.`,
    sourceLabel: item.source.label,
    keywords: [item.title, calendarKindLabel(item.kind), item.localDate],
  }));

  return [...eventRows, ...transactionRows, ...taskRows, ...calendarRows];
}

export function searchPhase6Rows(
  query: string,
  rows: readonly Phase6SearchRow[] = defaultPhase6ShellEvidence.searchRows,
): readonly Phase6SearchRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return rows;
  }

  return rows.filter((row) =>
    [row.title, row.typeLabel, row.subtitle, row.matchedText, ...row.keywords]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery),
  );
}

export function buildAccessibleVisualProof(
  position: BuildPhase6ShellEvidenceInput['position'],
  taskRows: readonly Phase6TaskRow[],
): Phase6AccessibleVisualProof {
  const doneTasks = taskRows.filter((row) => row.statusLabel === 'Done').length;
  const totalTasks = taskRows.length;

  return {
    title: 'Accessible visual proof',
    dashboardGridRequired: false,
    visuals: [
      {
        id: 'synthetic_visual_cash_flow',
        title: 'Cash-flow path',
        chartKind: 'cash_flow',
        textEquivalent: `Cash-flow chart. Starts at ${formatMoney(
          position.availableNow.minorUnits,
          position.availableNow.currency,
        )}, reaches ${formatMoney(
          position.balanceBeforeIncome.minorUnits,
          position.balanceBeforeIncome.currency,
        )} before income, and ends at ${formatMoney(
          position.balanceAfterIncome.minorUnits,
          position.balanceAfterIncome.currency,
        )} after income.`,
        dataRows: [
          {
            label: 'Available now',
            value: formatMoney(position.availableNow.minorUnits, position.availableNow.currency),
          },
          {
            label: 'Before income',
            value: formatMoney(
              position.balanceBeforeIncome.minorUnits,
              position.balanceBeforeIncome.currency,
            ),
          },
          {
            label: 'After income',
            value: formatMoney(
              position.balanceAfterIncome.minorUnits,
              position.balanceAfterIncome.currency,
            ),
          },
        ],
        nonColorCues: ['known label', 'expected label', 'signed amount text'],
        requiresMotion: false,
        sourceLabel: 'Synthetic sample',
      },
      {
        id: 'synthetic_visual_task_progress',
        title: 'Task progress',
        chartKind: 'task_progress',
        textEquivalent: `Task progress chart. ${doneTasks} of ${totalTasks} synthetic tasks complete.`,
        dataRows: [
          { label: 'Done', value: String(doneTasks) },
          { label: 'Not done', value: String(totalTasks - doneTasks) },
        ],
        nonColorCues: ['status text', 'count labels', 'list fallback'],
        requiresMotion: false,
        sourceLabel: 'Synthetic sample',
      },
    ],
    proofRows: [
      {
        label: 'Text equivalent',
        value: 'Each visual has a sentence summary and a data table.',
        state: 'ready',
      },
      {
        label: 'Colour independence',
        value: 'Status is carried by text labels, counts and signed amounts.',
        state: 'ready',
      },
      {
        label: 'Motion independence',
        value: 'No visual requires animation to understand the state.',
        state: 'ready',
      },
      {
        label: 'Layout independence',
        value: 'Briefing, timeline and visuals can render as linear sections.',
        state: 'ready',
      },
    ],
  };
}

export function formatMoney(minorUnits: number, currency: string): string {
  const normalizedCurrency = currency.trim().toUpperCase();
  const sign = minorUnits < 0 ? '-' : '';
  const absolute = Math.abs(minorUnits);
  const major = Math.floor(absolute / 100);
  const minor = String(absolute % 100).padStart(2, '0');
  return `${sign}${normalizedCurrency} ${major.toLocaleString('en-GB')}.${minor}`;
}

function buildCalendarRow(item: Phase6CalendarItem): Phase6CalendarRow {
  const timeLabel = item.localTime ?? 'All day';
  const kindLabel = calendarKindLabel(item.kind);

  return {
    id: item.id,
    label: item.title,
    dateLabel: formatIsoDateLabel(item.localDate),
    timeLabel,
    kindLabel,
    accessibilityLabel: [item.title, formatIsoDateLabel(item.localDate), timeLabel, kindLabel].join(
      '. ',
    ),
    sourceLabel: item.source.label,
  };
}

function formatIsoDateLabel(value: string): string {
  return value;
}

function formatShortDate(value: string): string {
  const [, month = '', day = ''] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) ?? [];
  if (month.length === 0 || day.length === 0) {
    return value;
  }
  return `${day}/${month}`;
}

function monthLabel(value: string): string {
  const [year = value, month = ''] = value.split('-');
  return month.length === 0 ? value : `${year}-${month}`;
}

function eventStatusLabel(status: Phase6EventStatus): string {
  switch (status) {
    case 'actual':
      return 'Actual';
    case 'expected':
      return 'Expected';
    case 'planned':
      return 'Planned';
    case 'question':
      return 'Question';
  }
}

function eventTimingLabel(timing: Phase6EventTiming): string {
  switch (timing) {
    case 'past':
      return 'Past';
    case 'today':
      return 'Today';
    case 'future':
      return 'Future';
  }
}

function eventKindLabel(kind: Phase6EventKind): string {
  switch (kind) {
    case 'actual_transaction':
      return 'Actual transaction';
    case 'expected_transaction':
      return 'Expected transaction';
    case 'planner_task':
      return 'Planner task';
    case 'calendar_item':
      return 'Calendar item';
    case 'reminder':
      return 'Reminder';
    case 'variance_question':
      return 'Variance question';
  }
}

function calendarKindLabel(kind: Phase6CalendarItem['kind']): string {
  switch (kind) {
    case 'money_date':
      return 'Money date';
    case 'general_event':
      return 'General event';
    case 'task_due':
      return 'Task due';
  }
}

function taskStatusLabel(status: Phase6TaskStatus): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'done':
      return 'Done';
    case 'waiting':
      return 'Waiting';
  }
}

function compareEventOrder(left: Phase6TimelineEvent, right: Phase6TimelineEvent): number {
  const leftKey = `${left.localDate}T${left.localTime ?? '00:00'}`;
  const rightKey = `${right.localDate}T${right.localTime ?? '00:00'}`;
  return leftKey.localeCompare(rightKey);
}

function compareCalendarItemOrder(left: Phase6CalendarItem, right: Phase6CalendarItem): number {
  const leftKey = `${left.localDate}T${left.localTime ?? '00:00'}`;
  const rightKey = `${right.localDate}T${right.localTime ?? '00:00'}`;
  return leftKey.localeCompare(rightKey);
}

function compareTaskOrder(left: Phase6Task, right: Phase6Task): number {
  return left.dueDate.localeCompare(right.dueDate) || left.title.localeCompare(right.title);
}

function isWithinDays(dateLabel: string, startDate: string, days: number): boolean {
  return dateLabel >= startDate && dateLabel <= addDays(startDate, days - 1);
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
