export const firstMinuteBoundary = {
  packageName: '@folio/first-minute',
  deterministic: true,
  importsNativeOrUiRuntime: false,
  ownsNativeVaultLifecycle: false,
} as const;

export const firstMinuteTargetSeconds = 60;

export type MinorMoney = Readonly<{
  minorUnits: number;
  currency: string;
}>;

export type ValidationIssue = Readonly<{
  field: string;
  code: string;
  message: string;
}>;

export type ValidationResult<TValue> =
  | Readonly<{ ok: true; value: TValue }>
  | Readonly<{ ok: false; issues: readonly ValidationIssue[] }>;

export type SyntheticPreviewEventKind =
  | 'available_now'
  | 'income'
  | 'important_outgoing'
  | 'hypothetical_outgoing'
  | 'result';

export type SyntheticPreviewEvent = Readonly<{
  id: string;
  kind: SyntheticPreviewEventKind;
  date: string;
  label: string;
  amount: MinorMoney;
  synthetic: true;
  usesUserData: false;
  consequence: string;
}>;

export type SyntheticPreviewTimeline = Readonly<{
  id: string;
  label: string;
  synthetic: true;
  usesUserData: false;
  targetSeconds: 20;
  scenarioName: string;
  currency: string;
  openingAvailable: MinorMoney;
  events: readonly SyntheticPreviewEvent[];
  result: Readonly<{
    afterObligationsMinor: number;
    afterHypotheticalMinor: number;
    explanation: string;
  }>;
  guardrails: Readonly<{
    noFakePersonalisation: true;
    clearlyLabelledDemo: true;
    neverMixesWithUserVault: true;
  }>;
}>;

export const syntheticPreviewTimeline: SyntheticPreviewTimeline = {
  id: 'first_minute_synthetic_preview',
  label: 'Example - not your finances',
  synthetic: true,
  usesUserData: false,
  targetSeconds: 20,
  scenarioName: 'Fictional payday, rent, and small purchase',
  currency: 'GBP',
  openingAvailable: { minorUnits: 125000, currency: 'GBP' },
  events: [
    {
      id: 'preview_available_now',
      kind: 'available_now',
      date: '2026-07-01',
      label: 'Available now',
      amount: { minorUnits: 125000, currency: 'GBP' },
      synthetic: true,
      usesUserData: false,
      consequence: 'The starting point is a fictional current balance.',
    },
    {
      id: 'preview_weekend_purchase',
      kind: 'hypothetical_outgoing',
      date: '2026-07-03',
      label: 'Try a small purchase',
      amount: { minorUnits: -1800, currency: 'GBP' },
      synthetic: true,
      usesUserData: false,
      consequence: 'Folio shows how a choice changes the position before payday.',
    },
    {
      id: 'preview_payday',
      kind: 'income',
      date: '2026-07-05',
      label: 'Fictional payday',
      amount: { minorUnits: 185000, currency: 'GBP' },
      synthetic: true,
      usesUserData: false,
      consequence: 'Expected income is shown as a future event, not as money already available.',
    },
    {
      id: 'preview_rent',
      kind: 'important_outgoing',
      date: '2026-07-06',
      label: 'Fictional rent',
      amount: { minorUnits: -83500, currency: 'GBP' },
      synthetic: true,
      usesUserData: false,
      consequence: 'The obligation remains visible so the timeline explains what is covered.',
    },
    {
      id: 'preview_after_rent',
      kind: 'result',
      date: '2026-07-06',
      label: 'Position after rent',
      amount: { minorUnits: 226500, currency: 'GBP' },
      synthetic: true,
      usesUserData: false,
      consequence: 'The result is derived from the labelled demo events only.',
    },
  ],
  result: {
    afterObligationsMinor: 226500,
    afterHypotheticalMinor: 224700,
    explanation: 'The preview demonstrates consequence, not personal advice or personalisation.',
  },
  guardrails: {
    noFakePersonalisation: true,
    clearlyLabelledDemo: true,
    neverMixesWithUserVault: true,
  },
};

export function validateSyntheticPreviewTimeline(
  preview: SyntheticPreviewTimeline,
): ValidationResult<SyntheticPreviewTimeline> {
  const issues: ValidationIssue[] = [];
  if (!preview.synthetic || preview.usesUserData) {
    issues.push({
      field: 'synthetic',
      code: 'preview_must_be_synthetic',
      message: 'The first-minute preview must be synthetic and must not use user data.',
    });
  }
  if (!preview.label.toLowerCase().includes('not your finances')) {
    issues.push({
      field: 'label',
      code: 'missing_demo_label',
      message: 'The preview label must make clear that this is not the user finances.',
    });
  }
  if (preview.targetSeconds > 20) {
    issues.push({
      field: 'targetSeconds',
      code: 'preview_too_slow',
      message: 'The labelled preview must complete within the 20 second target.',
    });
  }
  if (!preview.guardrails.clearlyLabelledDemo || !preview.guardrails.neverMixesWithUserVault) {
    issues.push({
      field: 'guardrails',
      code: 'unsafe_preview_guardrail',
      message: 'Demo data must be clearly labelled and isolated from the user vault.',
    });
  }
  if (preview.events.length === 0) {
    issues.push({
      field: 'events',
      code: 'preview_requires_events',
      message: 'The preview needs at least one event to demonstrate the mechanism.',
    });
  }
  for (const event of preview.events) {
    if (!event.synthetic || event.usesUserData) {
      issues.push({
        field: `events.${event.id}`,
        code: 'preview_event_must_be_synthetic',
        message: 'Every preview event must be synthetic and user-data free.',
      });
    }
    if (event.amount.currency !== preview.currency) {
      issues.push({
        field: `events.${event.id}.amount.currency`,
        code: 'preview_currency_mismatch',
        message: 'Preview events must use the preview currency.',
      });
    }
    collectMoneyIssues(`events.${event.id}.amount`, event.amount, issues);
    collectLocalDateIssues(`events.${event.id}.date`, event.date, issues);
  }

  return issues.length === 0 ? { ok: true, value: preview } : { ok: false, issues };
}

export type QuickStartMissingContext =
  | 'other_accounts'
  | 'uncaptured_transactions'
  | 'recurring_rules'
  | 'pending_items';

export type QuickStartInput = Readonly<{
  asOf: string;
  availableNow: MinorMoney;
  nextIncome: Readonly<{
    date: string;
    amount: MinorMoney;
    label?: string;
  }>;
  nextImportantOutgoing: Readonly<{
    date: string;
    amount: MinorMoney;
    label: string;
  }>;
  protectedFloor?: MinorMoney;
}>;

export type ValidatedQuickStartInput = Readonly<{
  asOf: string;
  availableNow: MinorMoney;
  nextIncome: Readonly<{
    date: string;
    amount: MinorMoney;
    label: string;
  }>;
  nextImportantOutgoing: Readonly<{
    date: string;
    amount: MinorMoney;
    label: string;
  }>;
  protectedFloor: MinorMoney;
}>;

export type QuickStartCalculationStep = Readonly<{
  id: string;
  label: string;
  date: string;
  deltaMinor: number;
  balanceMinor: number;
}>;

export type QuickStartProjection = Readonly<{
  kind: 'first_minute_quick_start_projection';
  source: 'three_fact_quick_start';
  completeness: 'incomplete_but_useful';
  label: 'Temporary projection';
  accountRequired: false;
  permissionsRequested: readonly [];
  currency: string;
  asOf: string;
  availableNow: MinorMoney;
  nextIncome: Readonly<{
    date: string;
    amount: MinorMoney;
    label: string;
  }>;
  nextImportantOutgoing: Readonly<{
    date: string;
    amount: MinorMoney;
    label: string;
  }>;
  protectedFloor: MinorMoney;
  nextImportantDate: string;
  balanceBeforeIncomeMinor: number;
  balanceOnIncomeDateMinor: number;
  availableBeforeIncomeMinor: number;
  coveredBeforeIncome: boolean;
  shortfallBeforeIncomeMinor: number;
  missingContext: readonly QuickStartMissingContext[];
  calculation: readonly QuickStartCalculationStep[];
}>;

export function validateQuickStartInput(
  input: QuickStartInput,
): ValidationResult<ValidatedQuickStartInput> {
  const issues: ValidationIssue[] = [];
  collectLocalDateIssues('asOf', input.asOf, issues);
  collectLocalDateIssues('nextIncome.date', input.nextIncome.date, issues);
  collectLocalDateIssues('nextImportantOutgoing.date', input.nextImportantOutgoing.date, issues);
  collectMoneyIssues('availableNow', input.availableNow, issues);
  collectMoneyIssues('nextIncome.amount', input.nextIncome.amount, issues);
  collectMoneyIssues('nextImportantOutgoing.amount', input.nextImportantOutgoing.amount, issues);

  const normalizedAvailable = normalizeMoney(input.availableNow);
  const normalizedIncome = normalizeMoney(input.nextIncome.amount);
  const normalizedOutgoing = normalizeMoney(input.nextImportantOutgoing.amount);
  const normalizedFloor = normalizeMoney(
    input.protectedFloor ?? { minorUnits: 0, currency: input.availableNow.currency },
  );

  if (normalizedIncome !== undefined && normalizedIncome.minorUnits <= 0) {
    issues.push({
      field: 'nextIncome.amount.minorUnits',
      code: 'income_must_be_positive',
      message: 'The next income amount must be a positive money movement.',
    });
  }
  if (normalizedOutgoing !== undefined && normalizedOutgoing.minorUnits >= 0) {
    issues.push({
      field: 'nextImportantOutgoing.amount.minorUnits',
      code: 'outgoing_must_be_negative',
      message: 'The next important outgoing must be recorded as a negative money movement.',
    });
  }
  if (normalizedFloor !== undefined && normalizedFloor.minorUnits < 0) {
    issues.push({
      field: 'protectedFloor.minorUnits',
      code: 'floor_must_not_be_negative',
      message: 'The protected floor must be zero or a positive amount.',
    });
  }
  if (normalizedAvailable !== undefined && normalizedIncome !== undefined) {
    collectSameCurrencyIssue(
      'nextIncome.amount.currency',
      normalizedAvailable,
      normalizedIncome,
      issues,
    );
  }
  if (normalizedAvailable !== undefined && normalizedOutgoing !== undefined) {
    collectSameCurrencyIssue(
      'nextImportantOutgoing.amount.currency',
      normalizedAvailable,
      normalizedOutgoing,
      issues,
    );
  }
  if (normalizedAvailable !== undefined && normalizedFloor !== undefined) {
    collectSameCurrencyIssue(
      'protectedFloor.currency',
      normalizedAvailable,
      normalizedFloor,
      issues,
    );
  }
  if (isValidLocalDate(input.asOf)) {
    if (isValidLocalDate(input.nextIncome.date) && input.nextIncome.date < input.asOf) {
      issues.push({
        field: 'nextIncome.date',
        code: 'income_before_as_of',
        message: 'The next income date cannot be before the quick-start date.',
      });
    }
    if (
      isValidLocalDate(input.nextImportantOutgoing.date) &&
      input.nextImportantOutgoing.date < input.asOf
    ) {
      issues.push({
        field: 'nextImportantOutgoing.date',
        code: 'outgoing_before_as_of',
        message: 'The next important outgoing date cannot be before the quick-start date.',
      });
    }
  }

  const incomeLabel = input.nextIncome.label?.trim() ?? 'Next income';
  const outgoingLabel = input.nextImportantOutgoing.label.trim();
  if (incomeLabel.length === 0 || incomeLabel.length > 80) {
    issues.push({
      field: 'nextIncome.label',
      code: 'invalid_income_label',
      message: 'The income label must be between 1 and 80 characters.',
    });
  }
  if (outgoingLabel.length === 0 || outgoingLabel.length > 80) {
    issues.push({
      field: 'nextImportantOutgoing.label',
      code: 'invalid_outgoing_label',
      message: 'The outgoing label must be between 1 and 80 characters.',
    });
  }

  if (
    issues.length > 0 ||
    normalizedAvailable === undefined ||
    normalizedIncome === undefined ||
    normalizedOutgoing === undefined ||
    normalizedFloor === undefined
  ) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      asOf: input.asOf,
      availableNow: normalizedAvailable,
      nextIncome: {
        date: input.nextIncome.date,
        amount: normalizedIncome,
        label: incomeLabel,
      },
      nextImportantOutgoing: {
        date: input.nextImportantOutgoing.date,
        amount: normalizedOutgoing,
        label: outgoingLabel,
      },
      protectedFloor: normalizedFloor,
    },
  };
}

export function buildQuickStartProjection(input: QuickStartInput): QuickStartProjection {
  const validation = validateQuickStartInput(input);
  if (!validation.ok) {
    throw new Error(formatValidationError('Invalid quick-start input', validation.issues));
  }

  const value = validation.value;
  const outgoingBeforeOrOnIncome = value.nextImportantOutgoing.date <= value.nextIncome.date;
  const balanceBeforeIncomeMinor =
    value.availableNow.minorUnits +
    (outgoingBeforeOrOnIncome ? value.nextImportantOutgoing.amount.minorUnits : 0);
  const balanceOnIncomeDateMinor = balanceBeforeIncomeMinor + value.nextIncome.amount.minorUnits;
  const availableBeforeIncomeMinor = balanceBeforeIncomeMinor - value.protectedFloor.minorUnits;
  const shortfallBeforeIncomeMinor = Math.max(
    0,
    value.protectedFloor.minorUnits - balanceBeforeIncomeMinor,
  );
  const calculation: QuickStartCalculationStep[] = [
    {
      id: 'available_now',
      label: 'Available now',
      date: value.asOf,
      deltaMinor: value.availableNow.minorUnits,
      balanceMinor: value.availableNow.minorUnits,
    },
  ];

  if (outgoingBeforeOrOnIncome) {
    calculation.push({
      id: 'next_important_outgoing',
      label: value.nextImportantOutgoing.label,
      date: value.nextImportantOutgoing.date,
      deltaMinor: value.nextImportantOutgoing.amount.minorUnits,
      balanceMinor: balanceBeforeIncomeMinor,
    });
  }
  calculation.push({
    id: 'next_income',
    label: value.nextIncome.label,
    date: value.nextIncome.date,
    deltaMinor: value.nextIncome.amount.minorUnits,
    balanceMinor: balanceOnIncomeDateMinor,
  });

  return {
    kind: 'first_minute_quick_start_projection',
    source: 'three_fact_quick_start',
    completeness: 'incomplete_but_useful',
    label: 'Temporary projection',
    accountRequired: false,
    permissionsRequested: [],
    currency: value.availableNow.currency,
    asOf: value.asOf,
    availableNow: value.availableNow,
    nextIncome: value.nextIncome,
    nextImportantOutgoing: value.nextImportantOutgoing,
    protectedFloor: value.protectedFloor,
    nextImportantDate:
      value.nextImportantOutgoing.date < value.nextIncome.date
        ? value.nextImportantOutgoing.date
        : value.nextIncome.date,
    balanceBeforeIncomeMinor,
    balanceOnIncomeDateMinor,
    availableBeforeIncomeMinor,
    coveredBeforeIncome: balanceBeforeIncomeMinor >= value.protectedFloor.minorUnits,
    shortfallBeforeIncomeMinor,
    missingContext: [
      'other_accounts',
      'uncaptured_transactions',
      'recurring_rules',
      'pending_items',
    ],
    calculation,
  };
}

export function validateQuickStartProjection(
  projection: QuickStartProjection,
): ValidationResult<QuickStartProjection> {
  const issues: ValidationIssue[] = [];
  const inputValidation = validateQuickStartInput({
    asOf: projection.asOf,
    availableNow: projection.availableNow,
    nextIncome: projection.nextIncome,
    nextImportantOutgoing: projection.nextImportantOutgoing,
    protectedFloor: projection.protectedFloor,
  });
  if (!inputValidation.ok) {
    issues.push(...inputValidation.issues);
  }
  if (projection.accountRequired || projection.permissionsRequested.length !== 0) {
    issues.push({
      field: 'accountRequired',
      code: 'quick_start_must_not_request_account_or_permission',
      message: 'The quick-start projection must not require an account or upfront permission.',
    });
  }
  if (projection.completeness !== 'incomplete_but_useful') {
    issues.push({
      field: 'completeness',
      code: 'quick_start_must_stay_incomplete',
      message: 'The quick-start result must remain clearly marked incomplete.',
    });
  }
  if (inputValidation.ok) {
    const expected = buildQuickStartProjection(inputValidation.value);
    if (
      projection.balanceBeforeIncomeMinor !== expected.balanceBeforeIncomeMinor ||
      projection.balanceOnIncomeDateMinor !== expected.balanceOnIncomeDateMinor ||
      projection.availableBeforeIncomeMinor !== expected.availableBeforeIncomeMinor ||
      projection.shortfallBeforeIncomeMinor !== expected.shortfallBeforeIncomeMinor
    ) {
      issues.push({
        field: 'calculation',
        code: 'quick_start_result_mismatch',
        message: 'The quick-start result no longer matches the three input facts.',
      });
    }
  }

  return issues.length === 0 ? { ok: true, value: projection } : { ok: false, issues };
}

export type FirstLaunchDataPathId = 'import_statement' | 'quick_start_three_facts' | 'explore_demo';

export type FirstLaunchDataPath = Readonly<{
  id: FirstLaunchDataPathId;
  label: string;
  valuePromise: string;
  upfrontPermissions: readonly string[];
  accountRequired: false;
  reversible: true;
  startsGoalQuestionnaire: false;
  maxQuestions?: number;
}>;

export const firstLaunchDataPaths: readonly FirstLaunchDataPath[] = [
  {
    id: 'import_statement',
    label: 'Bring in a statement',
    valuePromise: 'Detect account, period, currency, rows and first reliable facts locally.',
    upfrontPermissions: [],
    accountRequired: false,
    reversible: true,
    startsGoalQuestionnaire: false,
  },
  {
    id: 'quick_start_three_facts',
    label: 'Quick start with three facts',
    valuePromise:
      'Use available now, next income and next important outgoing for a temporary projection.',
    upfrontPermissions: [],
    accountRequired: false,
    reversible: true,
    startsGoalQuestionnaire: false,
    maxQuestions: 3,
  },
  {
    id: 'explore_demo',
    label: 'See a 20-second example',
    valuePromise: 'Use labelled fictional data to show the mechanism before personal data exists.',
    upfrontPermissions: [],
    accountRequired: false,
    reversible: true,
    startsGoalQuestionnaire: false,
  },
];

export function getFirstLaunchDataPath(id: FirstLaunchDataPathId): FirstLaunchDataPath {
  const choice = firstLaunchDataPaths.find((path) => path.id === id);
  if (choice === undefined) {
    throw new Error(`Unknown first-launch data path: ${id}`);
  }
  return choice;
}

export function validateFirstLaunchDataPathChoice(
  id: FirstLaunchDataPathId,
): ValidationResult<FirstLaunchDataPath> {
  const choice = getFirstLaunchDataPath(id);
  const issues: ValidationIssue[] = [];
  if (choice.accountRequired) {
    issues.push({
      field: 'accountRequired',
      code: 'account_prompt_not_allowed',
      message: 'First launch data choices must not require an account.',
    });
  }
  if (choice.upfrontPermissions.length > 0) {
    issues.push({
      field: 'upfrontPermissions',
      code: 'permission_wall_not_allowed',
      message:
        'First launch data choices must not ask for permissions before the user chooses a path.',
    });
  }
  if (choice.startsGoalQuestionnaire) {
    issues.push({
      field: 'startsGoalQuestionnaire',
      code: 'goal_questionnaire_not_allowed',
      message: 'First launch data choices are paths, not identity or goal segmentation.',
    });
  }

  return issues.length === 0 ? { ok: true, value: choice } : { ok: false, issues };
}

export type PrivacyRouteId =
  | 'local_device_vault'
  | 'statement_file_picker'
  | 'camera_scan'
  | 'microphone_voice'
  | 'notifications'
  | 'calendar_write'
  | 'calendar_read'
  | 'open_banking'
  | 'optional_cloud_account';

export type PrivacyRouteState = 'active_by_default' | 'available_when_chosen' | 'off_until_chosen';

export type PrivacyRoute = Readonly<{
  id: PrivacyRouteId;
  label: string;
  state: PrivacyRouteState;
  leavesDevice: boolean;
  requestedWhen: string;
  fallback: string;
}>;

export type LocalFirstPrivacyRouteSummary = Readonly<{
  headline: string;
  dataLocationIndicator: Readonly<{
    label: string;
    routeId: PrivacyRouteId;
    cloudRoute: 'not_active';
  }>;
  accountRequiredAtLaunch: false;
  permissionsRequestedAtLaunch: readonly [];
  routes: readonly PrivacyRoute[];
}>;

export const localFirstPrivacyRouteSummary: LocalFirstPrivacyRouteSummary = {
  headline: 'Your information stays on this device unless you choose otherwise.',
  dataLocationIndicator: {
    label: 'On this device',
    routeId: 'local_device_vault',
    cloudRoute: 'not_active',
  },
  accountRequiredAtLaunch: false,
  permissionsRequestedAtLaunch: [],
  routes: [
    {
      id: 'local_device_vault',
      label: 'Local encrypted vault',
      state: 'active_by_default',
      leavesDevice: false,
      requestedWhen: 'available immediately for local core use',
      fallback: 'local-only mode continues without account, bank connection or cloud sync',
    },
    {
      id: 'statement_file_picker',
      label: 'Statement file picker',
      state: 'available_when_chosen',
      leavesDevice: false,
      requestedWhen: 'only after the user chooses import statement',
      fallback: 'quick start and demo remain available',
    },
    {
      id: 'camera_scan',
      label: 'Camera scan',
      state: 'off_until_chosen',
      leavesDevice: false,
      requestedWhen: 'only after the user chooses scan',
      fallback: 'file import or manual quick start',
    },
    {
      id: 'microphone_voice',
      label: 'Voice input',
      state: 'off_until_chosen',
      leavesDevice: false,
      requestedWhen: 'only after the user taps voice input',
      fallback: 'typed quick-start input',
    },
    {
      id: 'notifications',
      label: 'Local notifications',
      state: 'off_until_chosen',
      leavesDevice: false,
      requestedWhen: 'after the user creates or accepts a reminder',
      fallback: 'in-app reminders remain visible',
    },
    {
      id: 'calendar_write',
      label: 'Calendar write',
      state: 'off_until_chosen',
      leavesDevice: false,
      requestedWhen: 'when adding an item to the system calendar',
      fallback: 'keep the item inside Folio',
    },
    {
      id: 'calendar_read',
      label: 'Calendar read',
      state: 'off_until_chosen',
      leavesDevice: false,
      requestedWhen: 'after explicit calendar import or sync selection',
      fallback: 'manual dates and Folio-only calendar',
    },
    {
      id: 'open_banking',
      label: 'Open Banking',
      state: 'off_until_chosen',
      leavesDevice: true,
      requestedWhen: 'after the user selects a live bank connection',
      fallback: 'statement import and manual quick start',
    },
    {
      id: 'optional_cloud_account',
      label: 'Optional account, backup or sync',
      state: 'off_until_chosen',
      leavesDevice: true,
      requestedWhen: 'after sync, backup, recovery or paid cloud functionality is selected',
      fallback: 'local core remains available without sign-in',
    },
  ],
};

export type BottomNavDestinationId = 'today' | 'timeline' | 'money' | 'plans' | 'calendar';
export type SecondaryDestinationId = 'search' | 'transactions' | 'settings';

export type BottomNavDestination = Readonly<{
  id: BottomNavDestinationId;
  label: string;
  purpose: string;
  oneHandPriority: number;
}>;

export type SecondaryDestination = Readonly<{
  id: SecondaryDestinationId;
  label: string;
  reachedFrom: readonly BottomNavDestinationId[];
}>;

export const bottomNavDestinations: readonly BottomNavDestination[] = [
  {
    id: 'today',
    label: 'Today',
    purpose: 'Melo briefing, current position, important item and next action gateways.',
    oneHandPriority: 1,
  },
  {
    id: 'timeline',
    label: 'Timeline',
    purpose: 'Past, present and future financial events with actual and expected items separated.',
    oneHandPriority: 2,
  },
  {
    id: 'money',
    label: 'Money',
    purpose: 'Accounts, transactions, bills, budgets, debt and documents with evidence first.',
    oneHandPriority: 3,
  },
  {
    id: 'plans',
    label: 'Plans',
    purpose:
      'Optional plan progress, forecast changes and scenario comparison without advice claims.',
    oneHandPriority: 4,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    purpose: 'Medium-scope planner for money dates, reminders and relevant general events.',
    oneHandPriority: 5,
  },
];

export const secondaryDestinations: readonly SecondaryDestination[] = [
  { id: 'search', label: 'Search', reachedFrom: ['today', 'timeline'] },
  { id: 'transactions', label: 'Transactions', reachedFrom: ['today', 'timeline', 'money'] },
  { id: 'settings', label: 'Settings', reachedFrom: ['today', 'plans', 'calendar'] },
];

export const mobileInformationArchitecture = {
  bottomNavDestinations,
  secondaryDestinations,
  workspaceIdentityVisible: true,
  oneHandCommonPaths: true,
} as const;

export type Phase4TaskId =
  | 'T060'
  | 'T061'
  | 'T062'
  | 'T063'
  | 'T064'
  | 'T065'
  | 'T066'
  | 'T067'
  | 'T068'
  | 'T069'
  | 'T070';

export type Phase4TaskState =
  | 'external_runtime_task'
  | 'blocked_by_native_key'
  | 'waiting_on_dependencies'
  | 'metadata_modelled'
  | 'research_planned';

export type NativeKeyRequirement = Readonly<{
  code: 'native_key_required';
  requiredTaskIds: readonly string[];
  summary: string;
}>;

export type Phase4TaskStatus = Readonly<{
  id: Phase4TaskId;
  phase: 4;
  area: string;
  title: string;
  priority: 'P0' | 'P1' | 'P2';
  dependencies: readonly string[];
  acceptance: string;
  state: Phase4TaskState;
  modelCoverage: readonly string[];
  nativeKeyRequirement?: NativeKeyRequirement;
}>;

export const phase4TaskStatuses: readonly Phase4TaskStatus[] = [
  {
    id: 'T060',
    phase: 4,
    area: 'mobile',
    title: 'Create Expo mobile shell',
    priority: 'P0',
    dependencies: ['T024', 'T057'],
    acceptance: 'Launches locked/unlocked with network disabled.',
    state: 'external_runtime_task',
    modelCoverage: ['first-minute package declares no native or UI runtime ownership'],
  },
  {
    id: 'T061',
    phase: 4,
    area: 'vault',
    title: 'Implement first-run vault creation',
    priority: 'P0',
    dependencies: ['T016', 'T017', 'T058'],
    acceptance: 'No account/permission requested.',
    state: 'blocked_by_native_key',
    modelCoverage: ['blocked metadata only; vault creation must live in native/runtime ownership'],
    nativeKeyRequirement: {
      code: 'native_key_required',
      requiredTaskIds: ['T016'],
      summary:
        'Requires proven Keychain/Keystore key wrapping before first-run vault creation can generate, wrap or persist a vault key.',
    },
  },
  {
    id: 'T062',
    phase: 4,
    area: 'vault',
    title: 'Implement vault unlock/app lock',
    priority: 'P0',
    dependencies: ['T016', 'T058', 'T059'],
    acceptance: 'Lock/unlock/relaunch/re-enrolment tests pass.',
    state: 'blocked_by_native_key',
    modelCoverage: ['blocked metadata only; app lock must live in native/runtime ownership'],
    nativeKeyRequirement: {
      code: 'native_key_required',
      requiredTaskIds: ['T016'],
      summary:
        'Requires native Keychain/Keystore-backed unlock, timeout and safe fallback behaviour before app-lock claims are valid.',
    },
  },
  {
    id: 'T063',
    phase: 4,
    area: 'ui',
    title: 'Build accessible design primitives',
    priority: 'P0',
    dependencies: ['T023', 'T058'],
    acceptance: 'Large text/screen reader/reduced motion pass.',
    state: 'waiting_on_dependencies',
    modelCoverage: [
      'navigation destinations expose accessibility-relevant structure but not UI primitives',
    ],
  },
  {
    id: 'T064',
    phase: 4,
    area: 'experience',
    title: 'Build Today skeleton',
    priority: 'P0',
    dependencies: ['T060', 'T061'],
    acceptance: 'No dashboard card-grid dependence.',
    state: 'waiting_on_dependencies',
    modelCoverage: ['Today destination and first-minute entry state are modelled'],
  },
  {
    id: 'T065',
    phase: 4,
    area: 'first-minute',
    title: 'Build labelled interactive preview',
    priority: 'P1',
    dependencies: ['T061', 'T062'],
    acceptance: 'No fake personalisation; complete in <20 seconds.',
    state: 'metadata_modelled',
    modelCoverage: ['syntheticPreviewTimeline', 'validateSyntheticPreviewTimeline'],
  },
  {
    id: 'T066',
    phase: 4,
    area: 'first-minute',
    title: 'Build quick three-fact path',
    priority: 'P0',
    dependencies: ['T051', 'T062'],
    acceptance: 'Produces truthful projection in under 60 seconds.',
    state: 'metadata_modelled',
    modelCoverage: [
      'validateQuickStartInput',
      'buildQuickStartProjection',
      'validateQuickStartProjection',
    ],
  },
  {
    id: 'T067',
    phase: 4,
    area: 'first-minute',
    title: 'Build data-path chooser',
    priority: 'P0',
    dependencies: ['T062', 'T063', 'T064'],
    acceptance: 'Choice is reversible and no permission upfront.',
    state: 'metadata_modelled',
    modelCoverage: ['firstLaunchDataPaths', 'validateFirstLaunchDataPathChoice'],
  },
  {
    id: 'T068',
    phase: 4,
    area: 'privacy',
    title: 'Build local-first explanation',
    priority: 'P1',
    dependencies: ['T062'],
    acceptance: 'User can inspect current cloud/data routes.',
    state: 'metadata_modelled',
    modelCoverage: ['localFirstPrivacyRouteSummary'],
  },
  {
    id: 'T069',
    phase: 4,
    area: 'navigation',
    title: 'Build mobile information architecture',
    priority: 'P0',
    dependencies: ['T062'],
    acceptance: 'One-hand common paths and clear workspace identity.',
    state: 'metadata_modelled',
    modelCoverage: [
      'bottomNavDestinations',
      'secondaryDestinations',
      'mobileInformationArchitecture',
    ],
  },
  {
    id: 'T070',
    phase: 4,
    area: 'quality',
    title: 'Usability test first minute',
    priority: 'P0',
    dependencies: ['T063', 'T064', 'T065', 'T066', 'T067'],
    acceptance: 'Most participants reach value/import intention; issues documented.',
    state: 'research_planned',
    modelCoverage: ['metadata exposes the target behaviours to test'],
  },
];

export function getPhase4TaskStatus(id: Phase4TaskId): Phase4TaskStatus {
  const task = phase4TaskStatuses.find((item) => item.id === id);
  if (task === undefined) {
    throw new Error(`Unknown Phase 4 task: ${id}`);
  }
  return task;
}

export function getNativeKeyBlockedPhase4Tasks(): readonly Phase4TaskStatus[] {
  return phase4TaskStatuses.filter((task) => task.state === 'blocked_by_native_key');
}

function collectMoneyIssues(field: string, money: MinorMoney, issues: ValidationIssue[]): void {
  if (!Number.isSafeInteger(money.minorUnits)) {
    issues.push({
      field: `${field}.minorUnits`,
      code: 'unsafe_minor_units',
      message: 'Money amounts must use safe integer minor units.',
    });
  }
  if (normalizeCurrency(money.currency) === undefined) {
    issues.push({
      field: `${field}.currency`,
      code: 'invalid_currency',
      message: 'Currency must be a three-letter ISO-style code.',
    });
  }
}

function collectLocalDateIssues(field: string, input: string, issues: ValidationIssue[]): void {
  if (!isValidLocalDate(input)) {
    issues.push({
      field,
      code: 'invalid_local_date',
      message: 'Dates must be valid local dates in YYYY-MM-DD format.',
    });
  }
}

function collectSameCurrencyIssue(
  field: string,
  expected: MinorMoney,
  actual: MinorMoney,
  issues: ValidationIssue[],
): void {
  if (expected.currency !== actual.currency) {
    issues.push({
      field,
      code: 'currency_mismatch',
      message: `Expected ${expected.currency}, received ${actual.currency}.`,
    });
  }
}

function normalizeMoney(input: MinorMoney): MinorMoney | undefined {
  const currency = normalizeCurrency(input.currency);
  if (!Number.isSafeInteger(input.minorUnits) || currency === undefined) {
    return undefined;
  }
  return { minorUnits: input.minorUnits, currency };
}

function normalizeCurrency(input: string): string | undefined {
  const normalized = input.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : undefined;
}

function isValidLocalDate(input: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (match === null) return false;
  const yearText = match[1];
  const monthText = match[2];
  const dayText = match[3];
  if (yearText === undefined || monthText === undefined || dayText === undefined) return false;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1 || month < 1 || month > 12) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

function formatValidationError(label: string, issues: readonly ValidationIssue[]): string {
  const details = issues.map((issue) => `${issue.field}: ${issue.code}`).join(', ');
  return `${label}: ${details}`;
}
