export const aiContractBoundary = {
  packageName: '@folio/ai-contracts',
  optional: true,
  modelRequired: false,
  networkRequired: false,
  writesDirectlyToStorage: false,
  authoritativeCalculator: false,
  importsCloudSdk: false,
  importsNativeModules: false,
  receivesDatabaseCredential: false,
} as const;

export type AiReadinessState = 'implemented' | 'passed' | 'needs_review' | 'blocked';

export type EvidenceRow = Readonly<{
  label: string;
  value: string;
  state: AiReadinessState;
}>;

export type Phase11TaskId =
  | 'T149'
  | 'T150'
  | 'T151'
  | 'T152'
  | 'T153'
  | 'T154'
  | 'T155'
  | 'T156'
  | 'T157'
  | 'T158'
  | 'T159';

export type Phase11CoverageRow = Readonly<{
  taskId: Phase11TaskId;
  label: string;
  state: AiReadinessState;
  evidence: string;
  blocker?: string;
}>;

export type AiTaskKind =
  | 'parse_intent'
  | 'explain_calculation'
  | 'transaction_classification'
  | 'csv_mapping'
  | 'monthly_summary'
  | 'natural_language_parse'
  | 'classification'
  | 'explanation'
  | 'tone_rewrite'
  | 'document_extraction'
  | 'document_summary'
  | 'grounded_search'
  | 'regulated_advice'
  | 'authoritative_write';

export type AiRouteKind = 'deterministic' | 'on_device' | 'cloud_small' | 'cloud_strong' | 'manual';

export type ModelLifecycleState = 'candidate' | 'active' | 'deprecated' | 'retired';

export type JsonFieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export type AiSchemaField = Readonly<{
  name: string;
  type: JsonFieldType;
  required: boolean;
}>;

export type AiOutputSchema = Readonly<{
  name: string;
  version: number;
  fields: readonly AiSchemaField[];
}>;

export type AiTaskSchema = Readonly<{
  kind: AiTaskKind;
  version: number;
  label: string;
  outputSchema: AiOutputSchema;
  allowedRoutes: readonly AiRouteKind[];
  maxClarifyingQuestions: number;
  requiresExplicitConsent: boolean;
  mayWriteDomainRecords: boolean;
  authoritativeFinancialCalculation: boolean;
}>;

export type TypedModelOutputValidation = Readonly<{
  accepted: boolean;
  reasons: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type AiProviderDataUse = Readonly<{
  trainsOnUserFinancialDataByDefault: boolean;
  retention: 'none' | 'limited' | 'unknown';
  dataUseReviewPassed: boolean;
}>;

export type AiProviderDescriptor = Readonly<{
  providerId: string;
  label: string;
  routeKind: Exclude<AiRouteKind, 'deterministic' | 'manual'>;
  modelId: string;
  lifecycle: ModelLifecycleState;
  pricing: Readonly<{
    inputUnitCost: number;
    outputUnitCost: number;
    currency: 'configured';
  }>;
  dataUse: AiProviderDataUse;
  supportedTaskKinds: readonly AiTaskKind[];
  serverSideOnly: boolean;
  strongModel: boolean;
}>;

export type AiRouteConfig = Readonly<{
  routeId: string;
  routeKind: AiRouteKind;
  providerId: string | null;
  taskKinds: readonly AiTaskKind[];
  weightedUnitMultiplier: number;
  requiresExplicitConsent: boolean;
}>;

export type AiProviderRegistryInput = Readonly<{
  registryVersion: number;
  providers: readonly AiProviderDescriptor[];
  activeRoutes: readonly AiRouteConfig[];
  serverConfigurable: boolean;
  mobileBundlePinsProvider: boolean;
  tasks: readonly AiTaskSchema[];
}>;

export type AiProviderRegistryState = Readonly<{
  registryVersion: number;
  providerCount: number;
  routeCount: number;
  serverConfigurable: boolean;
  canChangeProviderWithoutMobileRelease: boolean;
  lifecycleMetadataComplete: boolean;
  pricingMetadataComplete: boolean;
  dataUseMetadataComplete: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
  activeRoutes: readonly AiRouteConfig[];
  providers: readonly AiProviderDescriptor[];
  tasks: readonly AiTaskSchema[];
}>;

export type AiGatewayInput = Readonly<{
  providerKeyPresentInApp: boolean;
  authRequired: boolean;
  quotaAttached: boolean;
  redactionRequired: boolean;
  cloudRequestsServerSide: boolean;
  databaseCredentialAccessible: boolean;
  acceptsArbitraryToolExecution: boolean;
  invalidOutputRejected: boolean;
  routes: readonly AiRouteConfig[];
}>;

export type AiGatewayState = Readonly<{
  noProviderKeyInApp: boolean;
  noDatabaseCredential: boolean;
  typedValidationEnforced: boolean;
  narrowRoutesOnly: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type ContextRecord = Readonly<{
  id: string;
  workspaceId: string;
  kind: string;
  dateIso: string;
  fields: Readonly<Record<string, JsonValue>>;
}>;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | Readonly<{ [key: string]: JsonValue }>;

export type MinimalContextRecord = Readonly<{
  recordAlias: string;
  kind: string;
  dateIso: string;
  fields: Readonly<Record<string, JsonValue>>;
}>;

export type MinimalContextInput = Readonly<{
  workspaceId: string;
  taskKind: AiTaskKind;
  records: readonly ContextRecord[];
  allowedKinds: readonly string[];
  allowedFieldNames: readonly string[];
  maxRecords: number;
  includeFullDatabaseRoute: boolean;
  includeRawIdentifiers: boolean;
}>;

export type MinimalContextState = Readonly<{
  workspaceId: string;
  taskKind: AiTaskKind;
  selectedRecordCount: number;
  redactedIdentifierCount: number;
  fullDatabaseRouteAvailable: boolean;
  records: readonly MinimalContextRecord[];
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type OnDeviceModelCapabilityInput = Readonly<{
  platform: 'ios' | 'android';
  platformModelAvailable: boolean;
  userPermitted: boolean;
  modelDownloaded: boolean;
  taskSupported: boolean;
  fallbackRouteAvailable: boolean;
}>;

export type OnDeviceModelCapabilityState = Readonly<{
  platform: 'ios' | 'android';
  capabilityChecked: boolean;
  available: boolean;
  fallbackWorks: boolean;
  selectedRoute: 'on_device' | 'fallback';
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type RouteSelectionInput = Readonly<{
  task: AiTaskSchema;
  registry: AiProviderRegistryState;
  onDevice: OnDeviceModelCapabilityState;
  aiEnabled: boolean;
  cloudConsentGranted: boolean;
  strongRouteRequested: boolean;
  quotaRemainingUnits: number;
  deterministicFallbackAvailable: boolean;
}>;

export type RouteSelectionState = Readonly<{
  routeKind: AiRouteKind;
  providerId: string | null;
  modelId: string | null;
  manualFallbackOffered: boolean;
  aiOffComplete: boolean;
  cloudRequestAllowed: boolean;
  strongRouteExplicit: boolean;
  regulatedOrWriteTaskRejected: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type AiQuotaEntry = Readonly<{
  id: string;
  taskKind: AiTaskKind;
  routeKind: AiRouteKind;
  status: 'accepted' | 'system_failure_retry' | 'user_retry' | 'rejected';
  inputUnits: number;
  outputUnits: number;
  weight: number;
}>;

export type AiQuotaLedgerInput = Readonly<{
  capUnits: number;
  entries: readonly AiQuotaEntry[];
  systemFailureRetryFree: boolean;
  cloudConvenienceOnly: boolean;
  visibleBeforeUse: boolean;
}>;

export type AiQuotaLedgerState = Readonly<{
  capUnits: number;
  usedUnits: number;
  remainingUnits: number;
  overCap: boolean;
  cloudConvenienceOnly: boolean;
  visibleBeforeUse: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type AiOperatorCostScenarioInput = Readonly<{
  userCount: number;
  callsPerUser: number;
  averageInputUnits: number;
  averageOutputUnits: number;
  inputUnitCost: number;
  outputUnitCost: number;
  headroomRatio: number;
}>;

export type AiOperatorCostScenario = Readonly<{
  userCount: number;
  monthlyInputUnits: number;
  monthlyOutputUnits: number;
  configuredCostUnits: number;
  configuredCostWithHeadroom: number;
  operatorOnly: true;
  notUserFinanceDashboard: true;
  rows: readonly EvidenceRow[];
}>;

export type AiEvaluationCase = Readonly<{
  id: string;
  schemaValid: boolean;
  intentCorrect: boolean;
  faithfulToSuppliedFigures: boolean;
  inventedAmountOrDate: boolean;
  containsPersonalRecommendation: boolean;
  uncertaintyCorrect: boolean;
  toneSafe: boolean;
  workspaceLeakage: boolean;
  promptInjectionResisted: boolean;
  questionsWithinLimit: boolean;
}>;

export type AiEvaluationGateInput = Readonly<{
  promptVersion: string;
  modelRouteId: string;
  cases: readonly AiEvaluationCase[];
  minimumIntentAccuracy: number;
  requireEveryCaseSafe: boolean;
}>;

export type AiEvaluationGateState = Readonly<{
  promptVersion: string;
  modelRouteId: string;
  caseCount: number;
  schemaValidityRate: number;
  intentAccuracy: number;
  deployable: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type MeloAiIntegrationInput = Readonly<{
  aiEnabled: boolean;
  deterministicFallbackAvailable: boolean;
  deterministicFinancialConclusion: string;
  aiDraftFinancialConclusion: string;
  aiWritesDomainRecords: boolean;
  proposalRequiresUserReview: boolean;
  wordingOnly: boolean;
}>;

export type MeloAiIntegrationState = Readonly<{
  aiOffSameFinancialConclusion: boolean;
  modelCannotWriteRecords: boolean;
  wordingOnly: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type FirstCloudAiConsentInput = Readonly<{
  taskKind: AiTaskKind;
  explanationVisible: boolean;
  dataMinimised: boolean;
  quotaDisplayedBeforeUse: boolean;
  providerDataUseShown: boolean;
  consentGranted: boolean;
  denialUsesLocalManualPath: boolean;
}>;

export type FirstCloudAiConsentState = Readonly<{
  cloudAllowed: boolean;
  denialUsesLocalManualPath: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type AiBetaGateInput = Readonly<{
  registry: AiProviderRegistryState;
  gateway: AiGatewayState;
  context: MinimalContextState;
  quota: AiQuotaLedgerState;
  evaluation: AiEvaluationGateState;
  consent: FirstCloudAiConsentState;
  melo: MeloAiIntegrationState;
  supportRunbookReady: boolean;
  monitoringReady: boolean;
  rollbackReady: boolean;
  budgetCapEnforced: boolean;
}>;

export type AiBetaGateState = Readonly<{
  ready: boolean;
  releaseTrack: 'not_started' | 'internal_synthetic' | 'strict_beta';
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type Phase11CoverageInput = Readonly<{
  registry: AiProviderRegistryState;
  gateway: AiGatewayState;
  context: MinimalContextState;
  onDevice: OnDeviceModelCapabilityState;
  smallRoute: RouteSelectionState;
  strongRoute: RouteSelectionState;
  quota: AiQuotaLedgerState;
  operatorScenario: AiOperatorCostScenario;
  evaluation: AiEvaluationGateState;
  melo: MeloAiIntegrationState;
  consent: FirstCloudAiConsentState;
  beta: AiBetaGateState;
}>;

export type MeloLocalIntent =
  | 'check_purchase'
  | 'explain_position'
  | 'review_subscriptions'
  | 'review_recurring'
  | 'summarise_month'
  | 'review_import'
  | 'plan_recovery'
  | 'check_payday'
  | 'review_debts'
  | 'review_goals'
  | 'review_calendar'
  | 'explain_changes'
  | 'review_irregular_income'
  | 'review_accounts'
  | 'clarify';

export type MeloLocalFinancialSnapshot = Readonly<{
  currency: 'GBP';
  workspaceKind?: 'personal' | 'business' | undefined;
  availableNowMinor: number;
  tightestDay: string;
  tightestBalanceMinor: number;
  protectedItems: readonly string[];
  pendingReviewCount: number;
  nextPaydayLabel: string;
  /** Aggregate-only local context. No names, merchants, account identifiers or transaction rows. */
  hasMoneyPicture?: boolean | undefined;
  subscriptionCount?: number | undefined;
  activeSubscriptionMonthlyMinor?: number | undefined;
  monthlyIncomeMinor?: number | undefined;
  monthlyOutgoingsMinor?: number | undefined;
  activeRecurringCount?: number | undefined;
  debtCount?: number | undefined;
  totalDebtMinor?: number | undefined;
  monthlyDebtMinimumMinor?: number | undefined;
  goalCount?: number | undefined;
  goalSavedMinor?: number | undefined;
  goalTargetMinor?: number | undefined;
  upcomingCalendarCount?: number | undefined;
  nextCalendarDate?: string | undefined;
  unseenChangeCount?: number | undefined;
  incomeSourceCount?: number | undefined;
  irregularIncomeMode?: boolean | undefined;
  accountCount?: number | undefined;
  liabilityAccountCount?: number | undefined;
  /** Business-only aggregate context. No company, account, merchant or document identifiers. */
  businessCashBalanceMinor?: number | undefined;
  businessLiabilityBalanceMinor?: number | undefined;
  businessNetPositionMinor?: number | undefined;
  businessProjectedCashMinor?: number | undefined;
  businessUpcomingIncomeMinor?: number | undefined;
  businessUpcomingCommitmentsMinor?: number | undefined;
  businessConfirmedIncome30DaysMinor?: number | undefined;
  businessConfirmedExpense30DaysMinor?: number | undefined;
  businessRunwayDays?: number | null | undefined;
  businessRunwayHistoryDays?: number | undefined;
  businessNextCommitmentDate?: string | undefined;
}>;

export type MeloDebtProjectionStrategy =
  | 'contractual-minimums'
  | 'highest-rate-first'
  | 'lowest-balance-first';

export type MeloLocalCalculation =
  | Readonly<{
      kind: 'debt-projection';
      strategy: MeloDebtProjectionStrategy;
      debtCount: number;
      extraMonthlyMinor: number;
      payoffMonths: number | null;
      payoffDateLabel: string | null;
      totalInterestMinor: number;
      monthsSavedVsMinimums: number | null;
      interestSavedVsMinimumsMinor: number;
      safeZoneAfterExtraMinor: number;
      stalled: boolean;
    }>
  | Readonly<{
      kind: 'debt-strategy-required';
      extraMonthlyMinor: number;
      safeZoneAfterExtraMinor: number;
    }>
  | Readonly<{
      kind: 'goal-projection';
      datedPlanCount: number;
      remainingMinor: number;
      currentPerWeekMinor: number;
      requiredPerWeekMinor: number | null;
      weeksAvailable: number;
      weeksAtPace: number | null;
      onTrack: boolean;
      targetDateLabel: string;
      contributionMinor: number;
      remainingAfterContributionMinor: number;
      requiredPerWeekAfterContributionMinor: number | null;
      onTrackAfterContribution: boolean;
      safeZoneAfterContributionMinor: number;
    }>
  | Readonly<{
      kind: 'irregular-income-range';
      monthsObserved: number;
      sufficientHistory: boolean;
      lowMonthMinor: number | null;
      baseMonthMinor: number | null;
      highMonthMinor: number | null;
    }>
  | Readonly<{
      kind: 'account-position';
      accountKind: 'bank' | 'credit-card' | 'savings' | 'cash';
      balanceMinor: number;
      isLiability: boolean;
      balanceAsOfLabel: string;
    }>
  | Readonly<{
      kind: 'source-explanation';
      values: readonly Readonly<{
        label:
          | 'available now'
          | 'tightest balance'
          | 'monthly income'
          | 'monthly outgoings'
          | 'debt balance'
          | 'monthly debt minimums'
          | 'goal saved'
          | 'goal target'
          | 'selected account balance';
        amountMinor: number;
      }>[];
      sourceKinds: readonly (
        | 'current balance setting'
        | 'forecast engine'
        | 'income sources and posted income'
        | 'recurring rules and posted outgoings'
        | 'recorded debt details'
        | 'recorded goal details'
        | 'confirmed calendar events'
      )[];
      confirmedRecordCount: number;
      excludedReviewCount: number;
    }>
  | Readonly<{
      kind: 'import-review-summary';
      pendingCount: number;
      possibleDuplicateCount: number;
      changedAmountCount: number;
      relationshipCount: number;
      rememberedCategoryCount: number;
      missingDateCount: number;
    }>
  | Readonly<{
      kind: 'recovery-preview';
      hasShortfall: boolean;
      shortfallMinor: number;
      structuralPressure: boolean;
      options: readonly Readonly<{
        kind: 'move-bill' | 'pause-recurring' | 'hold-discretionary';
        liftMinor: number;
        afterMinor: number;
      }>[];
    }>
  | Readonly<{
      kind: 'bnpl-schedule';
      bnplCount: number;
      scheduledPaymentCount: number;
      nextPaymentDateLabel: string | null;
      nextPaymentTotalMinor: number;
      finalPaymentDateLabel: string | null;
      totalRemainingMinor: number;
      totalInterestMinor: number;
      stalledCount: number;
    }>;

export type MeloLocalAiRequest = Readonly<{
  prompt: string;
  snapshot: MeloLocalFinancialSnapshot;
  calculation?: MeloLocalCalculation | null | undefined;
  resolvedIntent?: MeloLocalIntent | undefined;
  cloudAiEnabled: boolean;
  cloudConsentGranted: boolean;
  source: 'typed_prompt' | 'quick_action';
}>;

export type MeloLocalAiActionKind =
  | 'open_what_if'
  | 'review_imports'
  | 'explain_sources'
  | 'build_recovery_route'
  | 'open_payday_ritual'
  | 'open_subscriptions'
  | 'open_goals'
  | 'open_calendar'
  | 'open_timeline'
  | 'open_account'
  | 'open_free_debt_help'
  | 'open_uk_emergency_help'
  | 'ask_clarifying_question';

export type MeloLocalAiAction = Readonly<{
  kind: MeloLocalAiActionKind;
  label: string;
  detail: string;
  requiresUserReview: boolean;
}>;

export type MeloLocalAiDraft = Readonly<{
  routeKind: 'deterministic_local';
  intent: MeloLocalIntent;
  prompt: string;
  answer: string;
  financialConclusion: string;
  uncertainty: 'none' | 'needs-context' | 'review-required';
  uncertaintyReason: string;
  requiresUserReview: boolean;
  canWriteRecords: false;
  usedCloud: false;
  detectedAmountMinor: number | null;
  followUpChips: readonly string[];
  actions: readonly MeloLocalAiAction[];
  dataUsed: readonly string[];
  guardrails: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export function draftMeloLocalAiResponse(input: MeloLocalAiRequest): MeloLocalAiDraft {
  const prompt = input.prompt.trim();
  const normalized = prompt.toLowerCase();
  const amountCandidatesMinor = extractMeloLocalAmountCandidatesMinor(normalized);
  const detectedAmountMinor =
    amountCandidatesMinor.length === 1 ? (amountCandidatesMinor[0] ?? null) : null;
  const intent = input.resolvedIntent ?? classifyMeloLocalIntent(normalized);
  const injectionConcern = hasPromptInjectionLanguage(normalized);
  const amountText = detectedAmountMinor === null ? null : formatMinorAmount(detectedAmountMinor);
  const availableText = formatMinorAmount(input.snapshot.availableNowMinor);
  const tightestText = formatMinorAmount(input.snapshot.tightestBalanceMinor);
  const protectedItems = input.snapshot.protectedItems.join(', ');
  const routeGuardrail =
    input.cloudAiEnabled && !input.cloudConsentGranted
      ? 'Melo stayed on the local route for this answer.'
      : 'Melo used the same local route shown on Today.';
  const guardrails = compact([
    routeGuardrail,
    'Nothing changes until you choose a review action.',
    'Calculations come from supplied local figures only.',
    injectionConcern ? 'Instruction-changing or data-exfiltration wording was ignored.' : '',
  ]);
  const answer = buildMeloLocalAnswer({
    amountText,
    amountCandidatesMinor,
    calculation: input.calculation ?? null,
    detectedAmountMinor,
    intent,
    snapshot: input.snapshot,
  });
  const financialConclusion = buildFinancialConclusion({
    detectedAmountMinor,
    intent,
    snapshot: input.snapshot,
  });
  const uncertainty = uncertaintyForIntent(
    intent,
    detectedAmountMinor,
    injectionConcern,
    input.calculation ?? null,
    amountCandidatesMinor.length > 1,
  );
  const requiresUserReview =
    intent === 'review_import' ||
    intent === 'plan_recovery' ||
    detectedAmountMinor !== null ||
    injectionConcern;
  const actions = actionsForDraft({
    detectedAmountMinor,
    intent,
    snapshot: input.snapshot,
  });
  const businessWorkspace = input.snapshot.workspaceKind === 'business';
  const businessCashText = formatMinorAmount(input.snapshot.businessCashBalanceMinor ?? 0);
  const businessProjectedText = formatMinorAmount(input.snapshot.businessProjectedCashMinor ?? 0);
  const businessCommitmentsText = formatMinorAmount(
    input.snapshot.businessUpcomingCommitmentsMinor ?? 0,
  );
  const dataUsed = businessWorkspace
    ? [
        `${businessCashText} confirmed Business cash`,
        `${businessProjectedText} confirmed dated position`,
        `${businessCommitmentsText} dated commitments`,
        `${input.snapshot.pendingReviewCount} unconfirmed review item${
          input.snapshot.pendingReviewCount === 1 ? '' : 's'
        } excluded`,
      ]
    : [
        `${availableText} available now`,
        `${input.snapshot.tightestDay} tightest point at ${tightestText}`,
        `${input.snapshot.pendingReviewCount} review item${
          input.snapshot.pendingReviewCount === 1 ? '' : 's'
        }`,
        `protected first: ${protectedItems}`,
      ];

  return {
    routeKind: 'deterministic_local',
    intent,
    prompt,
    answer,
    financialConclusion,
    uncertainty: uncertainty.state,
    uncertaintyReason: uncertainty.reason,
    requiresUserReview,
    canWriteRecords: false,
    usedCloud: false,
    detectedAmountMinor,
    followUpChips:
      amountCandidatesMinor.length > 1
        ? amountCandidatesMinor.slice(0, 3).map((amount) => `Check ${formatMinorAmount(amount)}`)
        : input.calculation?.kind === 'debt-strategy-required'
          ? ['Use highest rate first', 'Use lowest balance first']
          : chipsForIntent(intent, input.snapshot.workspaceKind),
    actions,
    dataUsed,
    guardrails,
    rows: [
      row('Route', 'deterministic local', 'implemented'),
      row('Model route', 'local route', 'implemented'),
      row('Detected intent', intent, intent === 'clarify' ? 'needs_review' : 'implemented'),
      row(
        'Detected amount',
        amountText ?? 'none',
        detectedAmountMinor ? 'implemented' : 'needs_review',
      ),
      ...(businessWorkspace
        ? [
            row('Business cash', businessCashText, 'implemented'),
            row('Dated position', businessProjectedText, 'implemented'),
            row('Dated commitments', businessCommitmentsText, 'implemented'),
          ]
        : [
            row('Available now', availableText, 'implemented'),
            row('Tightest point', `${input.snapshot.tightestDay}: ${tightestText}`, 'implemented'),
            row('Protected first', protectedItems, 'implemented'),
          ]),
      row('User review', boolText(requiresUserReview), 'implemented'),
      row('Record changes', 'review action required', 'implemented'),
    ],
  };
}

export function defineAiTaskSchema(input: AiTaskSchema): AiTaskSchema {
  if (input.version < 1) {
    throw new Error('AI task schemas must be versioned from 1.');
  }

  if (input.maxClarifyingQuestions > 3) {
    throw new Error('AI tasks may ask at most three clarification questions.');
  }

  return input;
}

export function validateTypedModelOutput(
  schema: AiOutputSchema,
  output: unknown,
): TypedModelOutputValidation {
  const reasons: string[] = [];
  if (!isRecord(output)) {
    reasons.push('output is not an object');
  } else {
    const allowedFields = new Set(schema.fields.map((field) => field.name));
    for (const field of schema.fields) {
      const value = output[field.name];
      if (field.required && value === undefined) {
        reasons.push(`missing required field ${field.name}`);
        continue;
      }
      if (value !== undefined && !matchesFieldType(value, field.type)) {
        reasons.push(`field ${field.name} is not ${field.type}`);
      }
    }
    for (const key of Object.keys(output)) {
      if (!allowedFields.has(key)) {
        reasons.push(`unknown field ${key}`);
      }
    }
  }

  return {
    accepted: reasons.length === 0,
    reasons,
    rows: [
      row('Schema', `${schema.name}@${schema.version}`, 'implemented'),
      row(
        'Typed validation',
        reasons.length === 0 ? 'accepted' : reasons.join('; '),
        stateFor(reasons.length === 0),
      ),
    ],
  };
}

export function buildProviderRegistry(input: AiProviderRegistryInput): AiProviderRegistryState {
  const providerIds = new Set(input.providers.map((provider) => provider.providerId));
  const duplicateProviderIds = providerIds.size !== input.providers.length;
  const activeProviderIds = input.activeRoutes
    .map((routeConfig) => routeConfig.providerId)
    .filter((providerId): providerId is string => providerId !== null);
  const missingProviderIds = activeProviderIds.filter((providerId) => !providerIds.has(providerId));
  const activeProviders = input.providers.filter((provider) =>
    activeProviderIds.includes(provider.providerId),
  );
  const taskKinds = new Set(input.tasks.map((task) => task.kind));
  const routeTaskKinds = input.activeRoutes.flatMap((routeConfig) => routeConfig.taskKinds);
  const unsupportedRouteKinds = routeTaskKinds.filter((taskKind) => !taskKinds.has(taskKind));
  const lifecycleMetadataComplete = input.providers.every(
    (provider) => provider.lifecycle !== 'retired' && provider.modelId.length > 0,
  );
  const pricingMetadataComplete = input.providers.every(
    (provider) => provider.pricing.currency === 'configured',
  );
  const dataUseMetadataComplete = input.providers.every(
    (provider) =>
      !provider.dataUse.trainsOnUserFinancialDataByDefault &&
      provider.dataUse.retention !== 'unknown' &&
      provider.dataUse.dataUseReviewPassed,
  );
  const routesServerSide = activeProviders.every((provider) => provider.serverSideOnly);
  const canChangeProviderWithoutMobileRelease =
    input.serverConfigurable && !input.mobileBundlePinsProvider && routesServerSide;
  const blockers = compact([
    input.registryVersion >= 1 ? '' : 'registry must be versioned',
    duplicateProviderIds ? 'provider IDs must be unique' : '',
    missingProviderIds.length === 0
      ? ''
      : `active routes reference missing providers: ${missingProviderIds.join(', ')}`,
    unsupportedRouteKinds.length === 0
      ? ''
      : `routes reference unknown tasks: ${unsupportedRouteKinds.join(', ')}`,
    lifecycleMetadataComplete ? '' : 'provider lifecycle/model metadata is incomplete',
    pricingMetadataComplete ? '' : 'provider pricing metadata is incomplete',
    dataUseMetadataComplete ? '' : 'provider data-use metadata is incomplete or unsafe',
    canChangeProviderWithoutMobileRelease
      ? ''
      : 'provider change requires server-configurable routes without mobile provider pinning',
  ]);

  return {
    registryVersion: input.registryVersion,
    providerCount: input.providers.length,
    routeCount: input.activeRoutes.length,
    serverConfigurable: input.serverConfigurable,
    canChangeProviderWithoutMobileRelease,
    lifecycleMetadataComplete,
    pricingMetadataComplete,
    dataUseMetadataComplete,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Registry version', String(input.registryVersion), stateFor(input.registryVersion >= 1)),
      row(
        'Provider change',
        canChangeProviderWithoutMobileRelease ? 'server-configurable' : 'mobile-pinned',
        stateFor(canChangeProviderWithoutMobileRelease),
      ),
      row(
        'Lifecycle metadata',
        boolText(lifecycleMetadataComplete),
        stateFor(lifecycleMetadataComplete),
      ),
      row('Pricing metadata', boolText(pricingMetadataComplete), stateFor(pricingMetadataComplete)),
      row(
        'Data-use metadata',
        boolText(dataUseMetadataComplete),
        stateFor(dataUseMetadataComplete),
      ),
    ],
    activeRoutes: input.activeRoutes,
    providers: input.providers,
    tasks: input.tasks,
  };
}

export function evaluateAiGateway(input: AiGatewayInput): AiGatewayState {
  const noProviderKeyInApp = !input.providerKeyPresentInApp;
  const noDatabaseCredential = !input.databaseCredentialAccessible;
  const typedValidationEnforced = input.invalidOutputRejected;
  const narrowRoutesOnly =
    input.routes.length > 0 &&
    input.routes.every(
      (routeConfig) => routeConfig.taskKinds.length > 0 && routeConfig.weightedUnitMultiplier > 0,
    ) &&
    !input.acceptsArbitraryToolExecution;
  const blockers = compact([
    noProviderKeyInApp ? '' : 'provider key is present in the app bundle',
    input.authRequired ? '' : 'gateway auth is not required',
    input.quotaAttached ? '' : 'gateway quota ledger is not attached',
    input.redactionRequired ? '' : 'redaction is not required before cloud routing',
    input.cloudRequestsServerSide ? '' : 'cloud request is not server-side only',
    noDatabaseCredential ? '' : 'gateway can access a database credential',
    narrowRoutesOnly ? '' : 'gateway accepts arbitrary tool execution or empty route scopes',
    typedValidationEnforced ? '' : 'invalid model output is not rejected',
  ]);

  return {
    noProviderKeyInApp,
    noDatabaseCredential,
    typedValidationEnforced,
    narrowRoutesOnly,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Provider key in app', noProviderKeyInApp ? 'no' : 'yes', stateFor(noProviderKeyInApp)),
      row('Authenticated gateway', boolText(input.authRequired), stateFor(input.authRequired)),
      row('Quota attached', boolText(input.quotaAttached), stateFor(input.quotaAttached)),
      row(
        'Redaction required',
        boolText(input.redactionRequired),
        stateFor(input.redactionRequired),
      ),
      row('Typed validation', boolText(typedValidationEnforced), stateFor(typedValidationEnforced)),
      row(
        'Database credential',
        noDatabaseCredential ? 'not accessible' : 'accessible',
        stateFor(noDatabaseCredential),
      ),
    ],
  };
}

export function buildMinimalContext(input: MinimalContextInput): MinimalContextState {
  const allowedKinds = new Set(input.allowedKinds);
  const allowedFieldNames = new Set(input.allowedFieldNames);
  const aliases = new Map<string, string>();
  let redactedIdentifierCount = 0;

  const records = input.records
    .filter((recordItem) => recordItem.workspaceId === input.workspaceId)
    .filter((recordItem) => allowedKinds.has(recordItem.kind))
    .slice(0, input.maxRecords)
    .map((recordItem, index) => {
      const fields: Record<string, JsonValue> = {};
      for (const [fieldName, fieldValue] of Object.entries(recordItem.fields)) {
        if (!allowedFieldNames.has(fieldName)) continue;

        if (identifierFieldNames.has(fieldName)) {
          if (input.includeRawIdentifiers) {
            fields[fieldName] = fieldValue;
          } else {
            fields[fieldName] = aliasFor(String(fieldValue), aliases);
            redactedIdentifierCount += 1;
          }
          continue;
        }

        fields[fieldName] = fieldValue;
      }

      return {
        recordAlias: `ctx_${index + 1}`,
        kind: recordItem.kind,
        dateIso: recordItem.dateIso,
        fields,
      };
    });
  const fullDatabaseRouteAvailable = input.includeFullDatabaseRoute;
  const blockers = compact([
    fullDatabaseRouteAvailable ? 'full database route is available' : '',
    input.includeRawIdentifiers ? 'raw identifiers are included in model context' : '',
    input.maxRecords > 0 ? '' : 'context cannot select any records',
    records.length <= input.maxRecords ? '' : 'context exceeds record limit',
  ]);

  return {
    workspaceId: input.workspaceId,
    taskKind: input.taskKind,
    selectedRecordCount: records.length,
    redactedIdentifierCount,
    fullDatabaseRouteAvailable,
    records,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Workspace scope', input.workspaceId, 'implemented'),
      row('Selected records', String(records.length), stateFor(records.length <= input.maxRecords)),
      row(
        'Identifier redaction',
        String(redactedIdentifierCount),
        stateFor(!input.includeRawIdentifiers),
      ),
      row(
        'Full database route',
        fullDatabaseRouteAvailable ? 'available' : 'impossible by default',
        stateFor(!fullDatabaseRouteAvailable),
      ),
    ],
  };
}

export function evaluateOnDeviceModelCapability(
  input: OnDeviceModelCapabilityInput,
): OnDeviceModelCapabilityState {
  const available =
    input.platformModelAvailable &&
    input.userPermitted &&
    input.modelDownloaded &&
    input.taskSupported;
  const fallbackWorks = available || input.fallbackRouteAvailable;
  const blockers = compact([
    fallbackWorks ? '' : 'neither on-device model nor fallback route is available',
  ]);

  return {
    platform: input.platform,
    capabilityChecked: true,
    available,
    fallbackWorks,
    selectedRoute: available ? 'on_device' : 'fallback',
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Platform', input.platform, 'implemented'),
      row('Capability checked', 'yes', 'implemented'),
      row('On-device available', boolText(available), available ? 'implemented' : 'needs_review'),
      row(
        'Fallback route',
        boolText(input.fallbackRouteAvailable),
        stateFor(input.fallbackRouteAvailable),
      ),
    ],
  };
}

export function selectAiRoute(input: RouteSelectionInput): RouteSelectionState {
  if (!input.aiEnabled) {
    return routeSelection({
      routeKind: input.deterministicFallbackAvailable ? 'deterministic' : 'manual',
      providerId: null,
      modelId: null,
      manualFallbackOffered: true,
      aiOffComplete: input.deterministicFallbackAvailable,
      cloudRequestAllowed: false,
      strongRouteExplicit: false,
      regulatedOrWriteTaskRejected: false,
      blockers: input.deterministicFallbackAvailable
        ? []
        : ['AI off path lacks deterministic fallback'],
    });
  }

  const regulatedOrWriteTask =
    input.task.kind === 'regulated_advice' ||
    input.task.kind === 'authoritative_write' ||
    input.task.mayWriteDomainRecords ||
    input.task.authoritativeFinancialCalculation;

  if (regulatedOrWriteTask) {
    return routeSelection({
      routeKind: input.deterministicFallbackAvailable ? 'deterministic' : 'manual',
      providerId: null,
      modelId: null,
      manualFallbackOffered: true,
      aiOffComplete: input.deterministicFallbackAvailable,
      cloudRequestAllowed: false,
      strongRouteExplicit: false,
      regulatedOrWriteTaskRejected: true,
      blockers: [],
    });
  }

  if (input.onDevice.available && input.task.allowedRoutes.includes('on_device')) {
    return routeSelection({
      routeKind: 'on_device',
      providerId: null,
      modelId: null,
      manualFallbackOffered: false,
      aiOffComplete: input.deterministicFallbackAvailable,
      cloudRequestAllowed: false,
      strongRouteExplicit: false,
      regulatedOrWriteTaskRejected: false,
      blockers: [],
    });
  }

  if (input.strongRouteRequested) {
    const strongRoute = findRoute(input.registry, input.task.kind, 'cloud_strong');
    const strongProvider = strongRoute ? providerForRoute(input.registry, strongRoute) : null;
    const blockers = compact([
      input.cloudConsentGranted ? '' : 'explicit consent is required for strong cloud route',
      input.quotaRemainingUnits > 0 ? '' : 'quota is exhausted',
      input.task.allowedRoutes.includes('cloud_strong') ? '' : 'task does not allow strong route',
      strongRoute ? '' : 'no active strong cloud route supports this task',
      strongProvider?.strongModel ? '' : 'strong route provider is not marked strong',
    ]);

    return routeSelection({
      routeKind: blockers.length === 0 ? 'cloud_strong' : 'manual',
      providerId: blockers.length === 0 ? (strongRoute?.providerId ?? null) : null,
      modelId: blockers.length === 0 ? (strongProvider?.modelId ?? null) : null,
      manualFallbackOffered: blockers.length > 0,
      aiOffComplete: input.deterministicFallbackAvailable,
      cloudRequestAllowed: blockers.length === 0,
      strongRouteExplicit: input.strongRouteRequested && blockers.length === 0,
      regulatedOrWriteTaskRejected: false,
      blockers,
    });
  }

  const smallRoute = findRoute(input.registry, input.task.kind, 'cloud_small');
  const smallProvider = smallRoute ? providerForRoute(input.registry, smallRoute) : null;
  const blockers = compact([
    input.cloudConsentGranted ? '' : 'cloud consent is required',
    input.quotaRemainingUnits > 0 ? '' : 'quota is exhausted',
    input.task.allowedRoutes.includes('cloud_small') ? '' : 'task does not allow small cloud route',
    smallRoute ? '' : 'no active small cloud route supports this task',
  ]);

  return routeSelection({
    routeKind: blockers.length === 0 ? 'cloud_small' : 'manual',
    providerId: blockers.length === 0 ? (smallRoute?.providerId ?? null) : null,
    modelId: blockers.length === 0 ? (smallProvider?.modelId ?? null) : null,
    manualFallbackOffered: blockers.length > 0,
    aiOffComplete: input.deterministicFallbackAvailable,
    cloudRequestAllowed: blockers.length === 0,
    strongRouteExplicit: false,
    regulatedOrWriteTaskRejected: false,
    blockers,
  });
}

export function buildQuotaLedger(input: AiQuotaLedgerInput): AiQuotaLedgerState {
  const usedUnits = input.entries.reduce((total, entry) => {
    if (entry.status === 'rejected') return total;
    if (entry.status === 'system_failure_retry' && input.systemFailureRetryFree) return total;
    return total + (entry.inputUnits + entry.outputUnits) * entry.weight;
  }, 0);
  const remainingUnits = Math.max(0, input.capUnits - usedUnits);
  const overCap = usedUnits > input.capUnits;
  const blockers = compact([
    overCap ? 'AI quota cap is exceeded' : '',
    input.cloudConvenienceOnly ? '' : 'quota is incorrectly attached to core calculations',
    input.visibleBeforeUse ? '' : 'quota is not displayed before use',
  ]);

  return {
    capUnits: input.capUnits,
    usedUnits,
    remainingUnits,
    overCap,
    cloudConvenienceOnly: input.cloudConvenienceOnly,
    visibleBeforeUse: input.visibleBeforeUse,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Quota cap', String(input.capUnits), stateFor(input.capUnits > 0)),
      row('Used units', String(usedUnits), stateFor(!overCap)),
      row('Remaining units', String(remainingUnits), stateFor(!overCap)),
      row('Visible before use', boolText(input.visibleBeforeUse), stateFor(input.visibleBeforeUse)),
      row(
        'Core calculations charged',
        input.cloudConvenienceOnly ? 'no' : 'yes',
        stateFor(input.cloudConvenienceOnly),
      ),
    ],
  };
}

export function estimateOperatorCostScenario(
  input: AiOperatorCostScenarioInput,
): AiOperatorCostScenario {
  const monthlyInputUnits = input.userCount * input.callsPerUser * input.averageInputUnits;
  const monthlyOutputUnits = input.userCount * input.callsPerUser * input.averageOutputUnits;
  const configuredCostUnits =
    monthlyInputUnits * input.inputUnitCost + monthlyOutputUnits * input.outputUnitCost;
  const configuredCostWithHeadroom = configuredCostUnits * (1 + input.headroomRatio);

  return {
    userCount: input.userCount,
    monthlyInputUnits,
    monthlyOutputUnits,
    configuredCostUnits,
    configuredCostWithHeadroom,
    operatorOnly: true,
    notUserFinanceDashboard: true,
    rows: [
      row('Scenario users', String(input.userCount), stateFor(input.userCount === 1000)),
      row('Monthly input units', String(monthlyInputUnits), 'implemented'),
      row('Monthly output units', String(monthlyOutputUnits), 'implemented'),
      row('Operator only', 'yes', 'implemented'),
    ],
  };
}

export function evaluateModelQualityGate(input: AiEvaluationGateInput): AiEvaluationGateState {
  const caseCount = input.cases.length;
  const schemaValidityRate = rate(input.cases, (caseItem) => caseItem.schemaValid);
  const intentAccuracy = rate(input.cases, (caseItem) => caseItem.intentCorrect);
  const unsafeCases = input.cases.filter(
    (caseItem) =>
      !caseItem.schemaValid ||
      !caseItem.faithfulToSuppliedFigures ||
      caseItem.inventedAmountOrDate ||
      caseItem.containsPersonalRecommendation ||
      !caseItem.uncertaintyCorrect ||
      !caseItem.toneSafe ||
      caseItem.workspaceLeakage ||
      !caseItem.promptInjectionResisted ||
      !caseItem.questionsWithinLimit,
  );
  const deployable =
    caseCount > 0 &&
    schemaValidityRate === 1 &&
    intentAccuracy >= input.minimumIntentAccuracy &&
    (!input.requireEveryCaseSafe || unsafeCases.length === 0);
  const blockers = compact([
    caseCount > 0 ? '' : 'evaluation set is empty',
    schemaValidityRate === 1 ? '' : 'not every model output passed schema validation',
    intentAccuracy >= input.minimumIntentAccuracy ? '' : 'intent accuracy is below threshold',
    unsafeCases.length === 0 ? '' : `${unsafeCases.length} evaluation cases failed safety checks`,
  ]);

  return {
    promptVersion: input.promptVersion,
    modelRouteId: input.modelRouteId,
    caseCount,
    schemaValidityRate,
    intentAccuracy,
    deployable,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Prompt version', input.promptVersion, 'implemented'),
      row('Evaluation cases', String(caseCount), stateFor(caseCount > 0)),
      row('Schema validity', decimalRate(schemaValidityRate), stateFor(schemaValidityRate === 1)),
      row(
        'Intent accuracy',
        decimalRate(intentAccuracy),
        stateFor(intentAccuracy >= input.minimumIntentAccuracy),
      ),
      row('Deployable', boolText(deployable), deployable ? 'passed' : 'blocked'),
    ],
  };
}

export function evaluateMeloAiIntegration(input: MeloAiIntegrationInput): MeloAiIntegrationState {
  const aiOffSameFinancialConclusion =
    input.deterministicFallbackAvailable &&
    (!input.aiEnabled ||
      input.aiDraftFinancialConclusion === input.deterministicFinancialConclusion);
  const modelCannotWriteRecords = !input.aiWritesDomainRecords;
  const blockers = compact([
    aiOffSameFinancialConclusion ? '' : 'AI changes or replaces the deterministic conclusion',
    modelCannotWriteRecords ? '' : 'AI route can write domain records',
    input.proposalRequiresUserReview ? '' : 'AI proposal does not require user review',
    input.wordingOnly ? '' : 'AI integration is broader than wording/parse proposal',
  ]);

  return {
    aiOffSameFinancialConclusion,
    modelCannotWriteRecords,
    wordingOnly: input.wordingOnly,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'AI off conclusion',
        aiOffSameFinancialConclusion ? 'same as deterministic' : 'changed',
        stateFor(aiOffSameFinancialConclusion),
      ),
      row(
        'Record changes',
        modelCannotWriteRecords ? 'review action required' : 'automatic change allowed',
        stateFor(modelCannotWriteRecords),
      ),
      row(
        'User review',
        boolText(input.proposalRequiresUserReview),
        stateFor(input.proposalRequiresUserReview),
      ),
      row(
        'Scope',
        input.wordingOnly ? 'wording and parse proposal only' : 'too broad',
        stateFor(input.wordingOnly),
      ),
    ],
  };
}

export function buildFirstCloudAiConsent(
  input: FirstCloudAiConsentInput,
): FirstCloudAiConsentState {
  const prerequisitesMet =
    input.explanationVisible &&
    input.dataMinimised &&
    input.quotaDisplayedBeforeUse &&
    input.providerDataUseShown;
  const cloudAllowed = input.consentGranted && prerequisitesMet;
  const blockers = compact([
    input.explanationVisible ? '' : 'task-level cloud AI explanation is hidden',
    input.dataMinimised ? '' : 'cloud AI context is not minimised',
    input.quotaDisplayedBeforeUse ? '' : 'quota is not visible before use',
    input.providerDataUseShown ? '' : 'provider data-use notice is hidden',
    input.denialUsesLocalManualPath ? '' : 'consent denial does not use local/manual path',
  ]);

  return {
    cloudAllowed,
    denialUsesLocalManualPath: input.denialUsesLocalManualPath,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Cloud AI consent',
        input.consentGranted ? 'granted' : 'denied',
        input.consentGranted ? 'implemented' : 'needs_review',
      ),
      row(
        'Task explanation',
        boolText(input.explanationVisible),
        stateFor(input.explanationVisible),
      ),
      row('Data minimised', boolText(input.dataMinimised), stateFor(input.dataMinimised)),
      row(
        'Quota before use',
        boolText(input.quotaDisplayedBeforeUse),
        stateFor(input.quotaDisplayedBeforeUse),
      ),
      row(
        'Denial path',
        input.denialUsesLocalManualPath ? 'local/manual' : 'blocked',
        stateFor(input.denialUsesLocalManualPath),
      ),
    ],
  };
}

export function evaluateAiBetaGate(input: AiBetaGateInput): AiBetaGateState {
  const blockers = [
    ...input.registry.blockers,
    ...input.gateway.blockers,
    ...input.context.blockers,
    ...input.quota.blockers,
    ...input.evaluation.blockers,
    ...input.consent.blockers,
    ...input.melo.blockers,
    ...compact([
      input.supportRunbookReady ? '' : 'AI support runbook is not ready',
      input.monitoringReady ? '' : 'AI cost/error/correction monitoring is not ready',
      input.rollbackReady ? '' : 'AI rollback switch is not ready',
      input.budgetCapEnforced ? '' : 'AI beta budget cap is not enforced',
    ]),
  ];

  return {
    ready: blockers.length === 0,
    releaseTrack: blockers.length === 0 ? 'strict_beta' : 'not_started',
    blockers,
    rows: [
      row(
        'AI beta ready',
        boolText(blockers.length === 0),
        blockers.length === 0 ? 'passed' : 'blocked',
      ),
      row(
        'Support runbook',
        boolText(input.supportRunbookReady),
        stateFor(input.supportRunbookReady),
      ),
      row('Monitoring', boolText(input.monitoringReady), stateFor(input.monitoringReady)),
      row('Rollback', boolText(input.rollbackReady), stateFor(input.rollbackReady)),
      row('Budget cap', boolText(input.budgetCapEnforced), stateFor(input.budgetCapEnforced)),
    ],
  };
}

export function buildPhase11CoverageRows(
  input: Phase11CoverageInput,
): readonly Phase11CoverageRow[] {
  return [
    coverageRow(
      'T149',
      'AI task schemas/provider registry',
      input.registry.canChangeProviderWithoutMobileRelease ? 'implemented' : 'blocked',
      'versioned task schemas, lifecycle, pricing and data-use metadata are registry controlled',
      firstBlocker(input.registry.blockers),
    ),
    coverageRow(
      'T150',
      'AI gateway',
      input.gateway.releaseBlocked ? 'blocked' : 'implemented',
      'auth, quota, redaction, routing and typed validation are enforced before provider calls',
      firstBlocker(input.gateway.blockers),
    ),
    coverageRow(
      'T151',
      'Minimal context builder',
      input.context.releaseBlocked ? 'blocked' : 'implemented',
      'context is workspace scoped, field limited and identifier-redacted by default',
      firstBlocker(input.context.blockers),
    ),
    coverageRow(
      'T152',
      'On-device model adapters',
      input.onDevice.fallbackWorks ? 'implemented' : 'blocked',
      'platform capability is checked and fallback remains available',
      firstBlocker(input.onDevice.blockers),
    ),
    coverageRow(
      'T153',
      'Cloud small-model route',
      input.smallRoute.routeKind === 'cloud_small' ? 'implemented' : 'blocked',
      'low-cost cloud text route is selected through the registry, not the mobile bundle',
      firstBlocker(input.smallRoute.blockers),
    ),
    coverageRow(
      'T154',
      'Rare strong-model route',
      input.strongRoute.regulatedOrWriteTaskRejected ? 'implemented' : 'needs_review',
      'strong routes require explicit use and reject regulated advice or authoritative writes',
      input.strongRoute.regulatedOrWriteTaskRejected
        ? undefined
        : 'regulated/write rejection was not exercised',
    ),
    coverageRow(
      'T155',
      'Quota and cost ledger',
      input.quota.releaseBlocked ? 'blocked' : 'implemented',
      'weighted units, free system-failure retries, visible quota and 1000-user operator scenario are modelled',
      firstBlocker(input.quota.blockers),
    ),
    coverageRow(
      'T156',
      'Model evaluation pipeline',
      input.evaluation.caseCount > 0 && !input.evaluation.deployable
        ? 'implemented'
        : 'needs_review',
      'schema, faithfulness, advice, injection and workspace leakage failures block deployment',
      input.evaluation.deployable ? 'synthetic blocked case still required' : undefined,
    ),
    coverageRow(
      'T157',
      'Optional AI in Melo',
      input.melo.releaseBlocked ? 'blocked' : 'implemented',
      'Melo AI is wording/parse proposal only; AI off yields the same financial conclusion',
      firstBlocker(input.melo.blockers),
    ),
    coverageRow(
      'T158',
      'First-cloud-AI consent',
      input.consent.releaseBlocked ? 'blocked' : 'implemented',
      'task explanation, data minimisation and local/manual denial path are explicit',
      firstBlocker(input.consent.blockers),
    ),
    coverageRow(
      'T159',
      'AI beta strict quotas',
      input.beta.ready ? 'passed' : 'blocked',
      'strict beta waits for monitoring, rollback, support and budget-cap enforcement',
      firstBlocker(input.beta.blockers),
    ),
  ];
}

export function classifyMeloLocalIntent(prompt: string): MeloLocalIntent {
  if (
    includesAny(prompt, [
      'subscription',
      'subscriptions',
      'renewal',
      'renews',
      'spotify',
      'netflix',
    ])
  ) {
    return 'review_subscriptions';
  }

  if (includesAny(prompt, ['bill', 'bills', 'direct debit', 'regular payment', 'recurring'])) {
    return 'review_recurring';
  }

  if (includesAny(prompt, ['what changed', "what's changed", 'since last', 'different now'])) {
    return 'explain_changes';
  }

  if (
    includesAny(prompt, [
      'irregular income',
      'variable income',
      'gig income',
      'freelance income',
      'income changes',
      'low income month',
    ])
  ) {
    return 'review_irregular_income';
  }

  if (
    includesAny(prompt, [
      'how is the month',
      "how's the month",
      'how is my month',
      'month going',
      'monthly summary',
      'summarise',
      'summarize',
      'money picture',
      'last 30 days',
      'last thirty days',
    ])
  ) {
    return 'summarise_month';
  }

  if (
    includesAny(prompt, [
      'debt',
      'debts',
      'credit card',
      'bnpl',
      'buy now',
      'pay in 3',
      'pay in 4',
      'instalment',
      'installment',
      'loan',
      'minimum payment',
      'overpay',
      'overpayment',
      'payoff',
    ])
  ) {
    return 'review_debts';
  }

  if (
    includesAny(prompt, [
      'saving goal',
      'savings goal',
      'my goals',
      'my pots',
      'target date',
      'goal contribution',
      'contribute to',
      'save toward',
    ])
  ) {
    return 'review_goals';
  }

  if (
    includesAny(prompt, [
      'my account',
      'which account',
      'accounts',
      'account balance',
      'current account',
      'savings account',
      'cash account',
      'credit-card account',
      'credit card account',
    ])
  ) {
    return 'review_accounts';
  }

  if (
    includesAny(prompt, ['can i', 'afford', 'buy', 'purchase', 'spend', 'before payday', 'left'])
  ) {
    return 'check_purchase';
  }

  if (includesAny(prompt, ['payday', 'next pay', 'paid next', 'next income'])) {
    return 'check_payday';
  }

  if (includesAny(prompt, ['calendar', 'coming up', 'next seven days', 'next 7 days'])) {
    return 'review_calendar';
  }

  if (
    includesAny(prompt, [
      'why',
      'available',
      '142',
      'balance',
      'calculation',
      'covered',
      'cash position',
      'dated position',
      'business cash',
      'runway',
    ])
  ) {
    return 'explain_position';
  }

  if (
    includesAny(prompt, [
      'import',
      'csv',
      'statement',
      'abound',
      'rent',
      'payroll',
      'needs my review',
      'need my review',
      'waiting for review',
    ])
  ) {
    return 'review_import';
  }

  if (includesAny(prompt, ['bad month', 'repair', 'car', 'emergency', 'recovery', 'short'])) {
    return 'plan_recovery';
  }

  return 'clarify';
}

function buildBusinessMeloLocalAnswer(input: {
  intent: MeloLocalIntent;
  snapshot: MeloLocalFinancialSnapshot;
  calculation: MeloLocalCalculation | null;
  detectedAmountMinor: number | null;
  amountText: string | null;
  amountCandidatesMinor: readonly number[];
}): string | null {
  const cash = formatMinorAmount(input.snapshot.businessCashBalanceMinor ?? 0);
  const projected = formatMinorAmount(input.snapshot.businessProjectedCashMinor ?? 0);
  const commitments = formatMinorAmount(input.snapshot.businessUpcomingCommitmentsMinor ?? 0);
  const upcomingIncome = formatMinorAmount(input.snapshot.businessUpcomingIncomeMinor ?? 0);
  const liabilities = formatMinorAmount(input.snapshot.businessLiabilityBalanceMinor ?? 0);
  const runway =
    input.snapshot.businessRunwayDays === null || input.snapshot.businessRunwayDays === undefined
      ? 'There is not enough confirmed expense history for a runway estimate yet; it needs at least three expenses across fourteen days.'
      : `At the confirmed expense pace, the current cash is about ${input.snapshot.businessRunwayDays} days of operating runway. This is a history-based estimate, not a forecast of future sales.`;

  switch (input.intent) {
    case 'check_purchase': {
      if (input.amountCandidatesMinor.length > 1) {
        return `I found ${input.amountCandidatesMinor.map(formatMinorAmount).join(' and ')} in that question. Which single business amount should I check?`;
      }
      if (input.detectedAmountMinor === null || input.amountText === null) {
        return `I can check it against confirmed Business records, but I need one amount. Cash is ${cash}; after dated money in and commitments the position is ${projected}.`;
      }
      const after = (input.snapshot.businessProjectedCashMinor ?? 0) - input.detectedAmountMinor;
      return `${input.amountText} would leave ${formatMinorAmount(after)} after the dated Business items currently recorded. That excludes unrecorded invoices, tax and commitments, and nothing has been saved.`;
    }
    case 'explain_position':
      return `Business cash is ${cash}. The next dated window contains ${upcomingIncome} in and ${commitments} out, leaving a projected ${projected}. Recorded liability accounts total ${liabilities}. ${runway}`;
    case 'summarise_month':
      return `Confirmed Business activity over the last 30 days shows ${formatMinorAmount(input.snapshot.businessConfirmedIncome30DaysMinor ?? 0)} in and ${formatMinorAmount(input.snapshot.businessConfirmedExpense30DaysMinor ?? 0)} out. Cash is ${cash}; the dated position is ${projected}. ${runway}`;
    case 'review_subscriptions':
    case 'review_recurring': {
      const count = input.snapshot.activeRecurringCount ?? input.snapshot.subscriptionCount ?? 0;
      if (count === 0) {
        return 'There are no recurring Business commitments recorded yet. Add a dated commitment or a real recurring service before I include one.';
      }
      return `There ${count === 1 ? 'is' : 'are'} ${count} active recurring Business commitment${count === 1 ? '' : 's'} totalling ${formatMinorAmount(input.snapshot.activeSubscriptionMonthlyMinor ?? 0)} a month. The current dated position is ${projected}.`;
    }
    case 'plan_recovery':
      return `The confirmed dated Business position is ${projected}, from ${cash} cash, ${upcomingIncome} dated in and ${commitments} committed out. I can compare one proposed change, but I will not invent an invoice, tax amount or cost to close a gap.`;
    case 'check_payday':
      return input.snapshot.nextPaydayLabel === 'not set up yet'
        ? 'There is no dated Business income recorded yet. Add an expected income event in Calendar; I will not turn irregular client income into a fake payday.'
        : `The next confirmed Business income date is ${input.snapshot.nextPaydayLabel}. The dated position after recorded money in and commitments is ${projected}.`;
    case 'review_debts': {
      const count = input.snapshot.debtCount ?? 0;
      return count === 0
        ? 'There are no Business debts recorded in this workspace.'
        : `This workspace has ${count} recorded Business debt${count === 1 ? '' : 's'} with ${formatMinorAmount(input.snapshot.totalDebtMinor ?? 0)} outstanding and ${formatMinorAmount(input.snapshot.monthlyDebtMinimumMinor ?? 0)} in monthly minimums. The dated cash position stays separate at ${projected}.`;
    }
    case 'review_goals': {
      const count = input.snapshot.goalCount ?? 0;
      return count === 0
        ? 'There are no dated Business plans recorded yet. Add a real target and date before I calculate a pace.'
        : `This workspace has ${count} Business plan${count === 1 ? '' : 's'}, with ${formatMinorAmount(input.snapshot.goalSavedMinor ?? 0)} recorded toward ${formatMinorAmount(input.snapshot.goalTargetMinor ?? 0)}. Nothing is moved by this answer.`;
    }
    case 'review_calendar': {
      const count = input.snapshot.upcomingCalendarCount ?? 0;
      return count === 0
        ? 'There are no confirmed Business dates in the current calendar window.'
        : `There ${count === 1 ? 'is' : 'are'} ${count} confirmed Business event${count === 1 ? '' : 's'} in the current window. The next is ${input.snapshot.nextCalendarDate ?? 'the next recorded date'}; dated commitments total ${commitments}.`;
    }
    case 'explain_changes': {
      const count = input.snapshot.unseenChangeCount ?? 0;
      return count === 0
        ? 'There are no unseen Business changes. Activity still holds the confirmed record and correction history.'
        : `${count} Business change${count === 1 ? '' : 's'} happened since the last briefing. Open Activity for the exact local records; no Personal rows are included.`;
    }
    case 'review_irregular_income':
      return `Confirmed Business income over the last 30 days is ${formatMinorAmount(input.snapshot.businessConfirmedIncome30DaysMinor ?? 0)}. I do not convert irregular client receipts into a promised payday or future invoice.`;
    case 'review_accounts': {
      if (input.calculation?.kind === 'account-position') {
        const position = input.calculation.isLiability
          ? `${formatMinorAmount(input.calculation.balanceMinor)} owed`
          : `${formatMinorAmount(input.calculation.balanceMinor)} in that account`;
        return `The selected Business ${input.calculation.accountKind} account shows ${position}, last set ${input.calculation.balanceAsOfLabel}. Total Business cash is ${cash}; card liabilities stay separate.`;
      }
      const count = input.snapshot.accountCount ?? 0;
      return count === 0
        ? 'There are no Business accounts recorded yet. Add one in Accounts before asking for an account-specific balance.'
        : `There ${count === 1 ? 'is' : 'are'} ${count} active Business account${count === 1 ? '' : 's'}. Cash across non-card accounts is ${cash}; recorded card liabilities total ${liabilities}. Choose an account for its exact balance.`;
    }
    case 'clarify':
      return 'I can explain Business cash and dated commitments, summarise the last 30 days, review accounts or unconfirmed records, check one proposed expense, and show activity or calendar changes. I will not invent invoices, tax, clients or future income.';
    case 'review_import':
      return null;
  }
}

function buildMeloLocalAnswer(input: {
  intent: MeloLocalIntent;
  snapshot: MeloLocalFinancialSnapshot;
  calculation: MeloLocalCalculation | null;
  detectedAmountMinor: number | null;
  amountText: string | null;
  amountCandidatesMinor: readonly number[];
}): string {
  if (input.snapshot.hasMoneyPicture === false) {
    return input.snapshot.workspaceKind === 'business'
      ? 'I do not have a confirmed Business picture to work from yet. Add a Business account or dated record, then I can answer from this workspace without inventing income or commitments.'
      : 'I do not have a real money picture to work from yet. Add your balance or connect an account, then I can answer from your own numbers.';
  }

  if (input.calculation?.kind === 'source-explanation') {
    const values = input.calculation.values
      .map((value) => `${formatMinorAmount(value.amountMinor)} ${value.label}`)
      .join('; ');
    const sourceKinds = input.calculation.sourceKinds.join(', ');
    const excluded =
      input.calculation.excludedReviewCount > 0
        ? ` ${input.calculation.excludedReviewCount} unconfirmed review item${input.calculation.excludedReviewCount === 1 ? ' is' : 's are'} excluded until you decide.`
        : '';
    return `${values}. The local sources are ${sourceKinds}, across ${input.calculation.confirmedRecordCount} confirmed record${input.calculation.confirmedRecordCount === 1 ? '' : 's'}.${excluded} Open the relevant surface for names and row-level evidence.`;
  }

  if (input.snapshot.workspaceKind === 'business') {
    const businessAnswer = buildBusinessMeloLocalAnswer(input);
    if (businessAnswer !== null) return businessAnswer;
  }

  const available = formatMinorAmount(input.snapshot.availableNowMinor);
  const tightest = formatMinorAmount(input.snapshot.tightestBalanceMinor);
  const safeZonePosition =
    input.snapshot.availableNowMinor < 0
      ? `${formatMinorAmount(Math.abs(input.snapshot.availableNowMinor))} below its target`
      : `${available} available`;

  switch (input.intent) {
    case 'check_purchase': {
      if (input.amountCandidatesMinor.length > 1) {
        return `I found ${input.amountCandidatesMinor.map(formatMinorAmount).join(' and ')} in that question. Which single amount should I check?`;
      }
      if (input.detectedAmountMinor === null || input.amountText === null) {
        return `I can check it, but I need the amount first. Right now the local Safe Zone is ${safeZonePosition}, with ${tightest} at the tightest point.`;
      }

      const afterPurchase = input.snapshot.availableNowMinor - input.detectedAmountMinor;
      const afterPurchaseText = formatMinorAmount(afterPurchase);
      if (afterPurchase < 0) {
        return `${input.amountText} would leave the Safe Zone ${formatMinorAmount(
          Math.abs(afterPurchase),
        )} below its target. I would treat that as review-only and look for something to move before saving anything.`;
      }

      return `${input.amountText} is possible in the local route, leaving about ${afterPurchaseText} in the Safe Zone. I would still keep it as a reviewed what-if, not an automatic change.`;
    }

    case 'explain_position':
      return `The Safe Zone is ${safeZonePosition}. It comes from confirmed local items first, with ${input.snapshot.protectedItems.join(
        ', ',
      )} protected before flexible spend. The tightest visible point is ${input.snapshot.tightestDay} at ${tightest}.`;

    case 'review_subscriptions': {
      const count = input.snapshot.subscriptionCount ?? 0;
      const monthly = formatMinorAmount(input.snapshot.activeSubscriptionMonthlyMinor ?? 0);
      if (count === 0) {
        return 'There are no active subscriptions in the local picture yet. Add or connect them and I can help you review the timing and total.';
      }
      return `There ${count === 1 ? 'is' : 'are'} ${count} active subscription${
        count === 1 ? '' : 's'
      } costing ${monthly} a month in total. I can help compare that total with the tightest point without sending their names anywhere.`;
    }

    case 'review_recurring': {
      const count = input.snapshot.activeRecurringCount ?? input.snapshot.subscriptionCount ?? 0;
      const monthly = formatMinorAmount(input.snapshot.activeSubscriptionMonthlyMinor ?? 0);
      if (count === 0) {
        return 'There are no active recurring payments in the local picture yet. Add a bill or statement and I can include the timing in your route.';
      }
      return `There ${count === 1 ? 'is' : 'are'} ${count} active recurring payment${
        count === 1 ? '' : 's'
      } totalling ${monthly} a month in the local picture. The tightest projected point remains ${input.snapshot.tightestDay} at ${tightest}.`;
    }

    case 'summarise_month': {
      const incoming = formatMinorAmount(input.snapshot.monthlyIncomeMinor ?? 0);
      const outgoing = formatMinorAmount(input.snapshot.monthlyOutgoingsMinor ?? 0);
      return `The local picture shows about ${incoming} coming in and ${outgoing} going out for the month. Your current Safe Zone is ${safeZonePosition}, with the tightest projected point on ${input.snapshot.tightestDay} at ${tightest}.`;
    }

    case 'review_import':
      if (input.calculation?.kind === 'import-review-summary') {
        const findings = compact([
          input.calculation.possibleDuplicateCount > 0
            ? `${input.calculation.possibleDuplicateCount} possible same-row match${input.calculation.possibleDuplicateCount === 1 ? '' : 'es'}`
            : '',
          input.calculation.changedAmountCount > 0
            ? `${input.calculation.changedAmountCount} possible changed-amount conflict${input.calculation.changedAmountCount === 1 ? '' : 's'}`
            : '',
          input.calculation.relationshipCount > 0
            ? `${input.calculation.relationshipCount} possible refund or transfer relationship${input.calculation.relationshipCount === 1 ? '' : 's'}`
            : '',
          input.calculation.missingDateCount > 0
            ? `${input.calculation.missingDateCount} item${input.calculation.missingDateCount === 1 ? '' : 's'} without a comparable date`
            : '',
          input.calculation.rememberedCategoryCount > 0
            ? `${input.calculation.rememberedCategoryCount} remembered categor${input.calculation.rememberedCategoryCount === 1 ? 'y' : 'ies'}`
            : '',
        ]);
        const detail =
          findings.length > 0
            ? ` The local review checks found ${findings.join(', ')}.`
            : ' No duplicate or conflict proposal is currently visible from the comparable rows.';
        return `${input.calculation.pendingCount} item${input.calculation.pendingCount === 1 ? '' : 's'} are waiting for review.${detail} These are proposals only: nothing was merged, corrected or posted. Open Review to compare the original wording and decide one item at a time.`;
      }
      return `I can help review imports. There are ${input.snapshot.pendingReviewCount} review item${
        input.snapshot.pendingReviewCount === 1 ? '' : 's'
      } that still need your eye. I can suggest labels, but confirmation stays with you.`;

    case 'plan_recovery':
      if (input.calculation?.kind === 'recovery-preview') {
        if (!input.calculation.hasShortfall) {
          return 'The confirmed local route does not currently show a shortfall to recover from. Recovery stays available if the route changes, but I will not invent a gap or a move.';
        }
        const labels: Readonly<
          Record<'move-bill' | 'pause-recurring' | 'hold-discretionary', string>
        > = {
          'move-bill': 'Move a flexible bill',
          'pause-recurring': 'Pause one recurring payment',
          'hold-discretionary': 'Hold discretionary spending for three days',
        };
        const comparisons = input.calculation.options
          .map((option) => {
            const after =
              option.afterMinor < 0
                ? `${formatMinorAmount(Math.abs(option.afterMinor))} still short`
                : `${formatMinorAmount(option.afterMinor)} of room`;
            return `${labels[option.kind]}: ${formatMinorAmount(option.liftMinor)} lift, leaving ${after}`;
          })
          .join('; ');
        const structural = input.calculation.structuralPressure
          ? ' The local pattern also shows structural pressure, so the Recovery surface includes the real-help signpost rather than treating this as a willpower problem.'
          : '';
        return `The current tight-point gap is ${formatMinorAmount(input.calculation.shortfallMinor)}. ${comparisons}.${structural} These are before/after previews only; nothing changes until you select and confirm a move in Recovery.`;
      }
      return `For a pressure point, I would keep protected items first, preview the spend locally, and show what changes before anything is saved. The current local tightest point is ${input.snapshot.tightestDay} at ${tightest}.`;

    case 'check_payday':
      if (input.snapshot.nextPaydayLabel === 'not set up yet') {
        return 'Your next income date is not set up yet. Add an income source or payday and I can place it on the local route.';
      }
      return `The next income in the local route is ${input.snapshot.nextPaydayLabel}. Until then, the Safe Zone is ${safeZonePosition}, with a tightest point of ${tightest} on ${input.snapshot.tightestDay}.`;

    case 'review_debts': {
      const count = input.snapshot.debtCount ?? 0;
      if (count === 0) {
        return 'There are no debts recorded in the local picture yet. Add one when you are ready and Melo can include its minimum and due date without guessing.';
      }
      if (input.calculation?.kind === 'debt-strategy-required') {
        const after = input.calculation.safeZoneAfterExtraMinor;
        const cashFlowLine =
          after < 0
            ? `It would leave the Safe Zone ${formatMinorAmount(Math.abs(after))} below its target.`
            : `It would leave ${formatMinorAmount(after)} in the Safe Zone.`;
        return `${formatMinorAmount(input.calculation.extraMonthlyMinor)} extra each month can be modelled locally. ${cashFlowLine} Choose highest-rate-first or lowest-balance-first before I project a payoff; I will not choose a debt strategy for you.`;
      }
      if (input.calculation?.kind === 'bnpl-schedule') {
        if (input.calculation.bnplCount === 0) {
          return 'There are no BNPL agreements recorded in the local debt picture.';
        }
        const next =
          input.calculation.nextPaymentDateLabel === null
            ? 'No next payment date is available from the recorded terms.'
            : `The next modelled payment is ${formatMinorAmount(input.calculation.nextPaymentTotalMinor)} on ${input.calculation.nextPaymentDateLabel}.`;
        const final =
          input.calculation.finalPaymentDateLabel === null
            ? 'At least one agreement does not clear within the model window.'
            : `The last modelled payment is around ${input.calculation.finalPaymentDateLabel}.`;
        return `${input.calculation.bnplCount} recorded BNPL agreement${input.calculation.bnplCount === 1 ? '' : 's'} have ${formatMinorAmount(input.calculation.totalRemainingMinor)} remaining across ${input.calculation.scheduledPaymentCount} scheduled monthly payment${input.calculation.scheduledPaymentCount === 1 ? '' : 's'}. ${next} ${final} Modelled interest is ${formatMinorAmount(input.calculation.totalInterestMinor)}. This schedule uses each recorded monthly payment, APR and due day; review those terms if the provider actually collects weekly or fortnightly.`;
      }
      if (input.calculation?.kind === 'debt-projection') {
        if (input.calculation.stalled || input.calculation.payoffMonths === null) {
          return `At the recorded minimums, at least one balance does not clear within the 50-year model window. That usually means a minimum is not reducing principal under the recorded rate. Review the local debt details rather than treating this as a payoff date.`;
        }
        const payoff =
          input.calculation.payoffDateLabel ?? `${input.calculation.payoffMonths} months`;
        if (input.calculation.strategy === 'contractual-minimums') {
          return `At the recorded contractual minimums, the local model clears ${count} debt${count === 1 ? '' : 's'} in ${input.calculation.payoffMonths} month${input.calculation.payoffMonths === 1 ? '' : 's'}, around ${payoff}, with ${formatMinorAmount(input.calculation.totalInterestMinor)} of modelled interest. Rates, minimums and future charges are held constant; this is a projection, not a recommendation.`;
        }
        const strategyLabel =
          input.calculation.strategy === 'highest-rate-first'
            ? 'highest-rate-first'
            : 'lowest-balance-first';
        const after = input.calculation.safeZoneAfterExtraMinor;
        const cashFlowLine =
          after < 0
            ? `That monthly extra would leave the current Safe Zone ${formatMinorAmount(Math.abs(after))} below its target.`
            : `That monthly extra would leave ${formatMinorAmount(after)} in the current Safe Zone.`;
        const savingLine =
          input.calculation.monthsSavedVsMinimums !== null
            ? ` The model is ${input.calculation.monthsSavedVsMinimums} month${input.calculation.monthsSavedVsMinimums === 1 ? '' : 's'} sooner and ${formatMinorAmount(input.calculation.interestSavedVsMinimumsMinor)} lower in interest than recorded minimums.`
            : '';
        return `With ${formatMinorAmount(input.calculation.extraMonthlyMinor)} extra each month using the user-selected ${strategyLabel} rule, the local model clears the portfolio in ${input.calculation.payoffMonths} month${input.calculation.payoffMonths === 1 ? '' : 's'}, around ${payoff}.${savingLine} ${cashFlowLine} This is a neutral scenario, not advice.`;
      }
      return `The local picture has ${count} debt${count === 1 ? '' : 's'} with ${formatMinorAmount(
        input.snapshot.totalDebtMinor ?? 0,
      )} outstanding and ${formatMinorAmount(
        input.snapshot.monthlyDebtMinimumMinor ?? 0,
      )} in monthly minimums. Those minimums stay protected before flexible spend.`;
    }

    case 'review_goals': {
      const count = input.snapshot.goalCount ?? 0;
      if (count === 0) {
        return 'There are no active pots or dated goals in the local picture yet. Add one when you have a real target; Melo will not invent one for you.';
      }
      if (input.calculation?.kind === 'goal-projection') {
        const calculation = input.calculation;
        if (calculation.requiredPerWeekMinor === null) {
          return `The nearest dated plan has ${formatMinorAmount(calculation.remainingMinor)} left, but its target date is ${calculation.targetDateLabel}. It needs a date review before I can claim a weekly pace.`;
        }
        const contributionLine =
          calculation.contributionMinor > 0
            ? ` After a hypothetical ${formatMinorAmount(calculation.contributionMinor)} contribution, ${formatMinorAmount(calculation.remainingAfterContributionMinor)} would remain and the weekly pace would be ${calculation.requiredPerWeekAfterContributionMinor === null ? 'unavailable until the date is reviewed' : formatMinorAmount(calculation.requiredPerWeekAfterContributionMinor)}; that path would be ${calculation.onTrackAfterContribution ? 'on pace' : 'still off the previous pace'}. The current Safe Zone would be ${calculation.safeZoneAfterContributionMinor < 0 ? `${formatMinorAmount(Math.abs(calculation.safeZoneAfterContributionMinor))} below target` : `${formatMinorAmount(calculation.safeZoneAfterContributionMinor)} available`}. Nothing has been moved.`
            : '';
        return `For the nearest dated plan, ${formatMinorAmount(calculation.remainingMinor)} remains by ${calculation.targetDateLabel}. The current pace is ${formatMinorAmount(calculation.currentPerWeekMinor)} a week; about ${formatMinorAmount(calculation.requiredPerWeekMinor)} a week is needed across ${calculation.weeksAvailable} week${calculation.weeksAvailable === 1 ? '' : 's'}. It is ${calculation.onTrack ? 'on the current path' : 'off the previous path and ready to rebase'}.${contributionLine}`;
      }
      return `Across ${count} active goal${count === 1 ? '' : 's'}, the local picture shows ${formatMinorAmount(
        input.snapshot.goalSavedMinor ?? 0,
      )} saved toward ${formatMinorAmount(input.snapshot.goalTargetMinor ?? 0)}. I can open your pots without moving any money.`;
    }

    case 'review_calendar': {
      const count = input.snapshot.upcomingCalendarCount ?? 0;
      if (count === 0) {
        return 'There is nothing confirmed in the next local calendar window yet. Add real bills, income or events and Melo will keep the route quiet until then.';
      }
      const next = input.snapshot.nextCalendarDate ?? 'the next confirmed date';
      return `There ${count === 1 ? 'is' : 'are'} ${count} confirmed money event${
        count === 1 ? '' : 's'
      } in the next local calendar window. The next date is ${next}; open Calendar for the named records and amounts.`;
    }

    case 'explain_changes': {
      const count = input.snapshot.unseenChangeCount ?? 0;
      if (count === 0) {
        return 'There are no unseen changes waiting in the local briefing. The Timeline still holds your confirmed history.';
      }
      return `${count} change${count === 1 ? '' : 's'} happened since the last briefing. I am keeping names and rows out of chat; open Timeline to inspect the exact records.`;
    }

    case 'review_irregular_income': {
      const sourceCount = input.snapshot.incomeSourceCount ?? 0;
      const modeLine = input.snapshot.irregularIncomeMode
        ? 'The irregular-income route is active.'
        : 'The local route is using your recorded income cadences.';
      if (input.calculation?.kind === 'irregular-income-range') {
        if (!input.calculation.sufficientHistory) {
          return `${modeLine} There ${input.calculation.monthsObserved === 1 ? 'is' : 'are'} ${input.calculation.monthsObserved} past month${input.calculation.monthsObserved === 1 ? '' : 's'} with recorded income. I need at least three before showing a low/base/high range; the current monthly equivalent remains ${formatMinorAmount(input.snapshot.monthlyIncomeMinor ?? 0)}.`;
        }
        return `${modeLine} Across ${input.calculation.monthsObserved} past months with recorded income, the local estimates are ${formatMinorAmount(input.calculation.lowMonthMinor ?? 0)} low, ${formatMinorAmount(input.calculation.baseMonthMinor ?? 0)} base and ${formatMinorAmount(input.calculation.highMonthMinor ?? 0)} high. These are history percentiles, not a prediction of future income.`;
      }
      if (sourceCount === 0) {
        return 'No recurring income sources are set up yet. Add each real cadence first so Melo can show a low month without inventing a payday.';
      }
      return `${modeLine} ${sourceCount} source${sourceCount === 1 ? '' : 's'} produce about ${formatMinorAmount(
        input.snapshot.monthlyIncomeMinor ?? 0,
      )} as a monthly equivalent, with the next income on ${input.snapshot.nextPaydayLabel}.`;
    }

    case 'review_accounts': {
      if (input.calculation?.kind === 'account-position') {
        const kindLabel =
          input.calculation.accountKind === 'credit-card'
            ? 'credit-card account'
            : `${input.calculation.accountKind} account`;
        const position = input.calculation.isLiability
          ? `${formatMinorAmount(input.calculation.balanceMinor)} owed`
          : `${formatMinorAmount(input.calculation.balanceMinor)} available in that account`;
        return `The selected ${kindLabel} shows ${position}, last set ${input.calculation.balanceAsOfLabel}. This is the account balance only, not the consolidated Safe Zone.`;
      }
      const count = input.snapshot.accountCount ?? 0;
      if (count === 0) {
        return 'There are no active accounts in the local picture yet. Add one in Account before asking for an account-specific balance.';
      }
      const liabilities = input.snapshot.liabilityAccountCount ?? 0;
      return `There ${count === 1 ? 'is' : 'are'} ${count} active account${count === 1 ? '' : 's'} in the local picture${liabilities > 0 ? `, including ${liabilities} liability account${liabilities === 1 ? '' : 's'}` : ''}. Choose an account explicitly before I use an account-specific balance; the consolidated Safe Zone remains separate.`;
    }

    case 'clarify':
      return 'I can check a purchase, explain the available amount, review bills or imports, show payday, debts, goals, calendar changes or irregular income, and preview recovery. The financial answer stays local and review-only.';
  }
}

function buildFinancialConclusion(input: {
  intent: MeloLocalIntent;
  snapshot: MeloLocalFinancialSnapshot;
  detectedAmountMinor: number | null;
}): string {
  if (input.snapshot.hasMoneyPicture === false) {
    return input.snapshot.workspaceKind === 'business'
      ? 'No confirmed Business picture is available yet.'
      : 'No real money picture is available yet.';
  }

  if (input.snapshot.workspaceKind === 'business') {
    const cash = input.snapshot.businessCashBalanceMinor ?? 0;
    const projected = input.snapshot.businessProjectedCashMinor ?? cash;

    if (input.intent === 'check_purchase' && input.detectedAmountMinor !== null) {
      const afterPurchase = projected - input.detectedAmountMinor;
      return afterPurchase < 0
        ? `Would leave a dated Business shortfall of ${formatMinorAmount(Math.abs(afterPurchase))}.`
        : `Would leave a dated Business position of ${formatMinorAmount(afterPurchase)}.`;
    }

    if (input.intent === 'summarise_month') {
      return `${formatMinorAmount(input.snapshot.businessConfirmedIncome30DaysMinor ?? 0)} confirmed in and ${formatMinorAmount(input.snapshot.businessConfirmedExpense30DaysMinor ?? 0)} confirmed out over the last 30 days.`;
    }

    if (input.intent === 'review_subscriptions' || input.intent === 'review_recurring') {
      const count = input.snapshot.activeRecurringCount ?? input.snapshot.subscriptionCount ?? 0;
      return `${count} active Business commitment${count === 1 ? '' : 's'}, ${formatMinorAmount(input.snapshot.activeSubscriptionMonthlyMinor ?? 0)} per month.`;
    }

    return `Business cash is ${formatMinorAmount(cash)}; the confirmed dated position is ${formatMinorAmount(projected)}.`;
  }

  if (input.intent === 'review_subscriptions') {
    return `${input.snapshot.subscriptionCount ?? 0} active subscription${
      (input.snapshot.subscriptionCount ?? 0) === 1 ? '' : 's'
    }, ${formatMinorAmount(input.snapshot.activeSubscriptionMonthlyMinor ?? 0)} per month.`;
  }

  if (input.intent === 'summarise_month') {
    return `${formatMinorAmount(input.snapshot.monthlyIncomeMinor ?? 0)} in and ${formatMinorAmount(
      input.snapshot.monthlyOutgoingsMinor ?? 0,
    )} out in the current local monthly picture.`;
  }

  if (input.intent === 'review_debts') {
    return `${formatMinorAmount(input.snapshot.totalDebtMinor ?? 0)} outstanding with ${formatMinorAmount(
      input.snapshot.monthlyDebtMinimumMinor ?? 0,
    )} in monthly minimums.`;
  }

  if (input.intent === 'review_goals') {
    return `${formatMinorAmount(input.snapshot.goalSavedMinor ?? 0)} saved toward ${formatMinorAmount(
      input.snapshot.goalTargetMinor ?? 0,
    )} across ${input.snapshot.goalCount ?? 0} active goals.`;
  }

  if (input.intent === 'review_calendar') {
    return `${input.snapshot.upcomingCalendarCount ?? 0} confirmed events in the next local calendar window.`;
  }

  if (input.intent === 'explain_changes') {
    return `${input.snapshot.unseenChangeCount ?? 0} unseen changes in the local briefing.`;
  }

  if (input.intent === 'check_purchase' && input.detectedAmountMinor !== null) {
    const afterPurchase = input.snapshot.availableNowMinor - input.detectedAmountMinor;
    return afterPurchase < 0
      ? `Would be short by ${formatMinorAmount(Math.abs(afterPurchase))}.`
      : `Would leave ${formatMinorAmount(afterPurchase)}.`;
  }

  return `Local route remains ${formatMinorAmount(
    input.snapshot.availableNowMinor,
  )} available now; tightest point ${input.snapshot.tightestDay} is ${formatMinorAmount(
    input.snapshot.tightestBalanceMinor,
  )}.`;
}

function uncertaintyForIntent(
  intent: MeloLocalIntent,
  detectedAmountMinor: number | null,
  injectionConcern: boolean,
  calculation: MeloLocalCalculation | null,
  amountAmbiguous: boolean,
): Readonly<{ state: MeloLocalAiDraft['uncertainty']; reason: string }> {
  if (injectionConcern) {
    return {
      state: 'review-required',
      reason: 'Some wording tried to change instructions or expose data, so Melo ignored it.',
    };
  }
  if (amountAmbiguous) {
    return {
      state: 'needs-context',
      reason: 'Melo found more than one possible amount and needs one explicit choice.',
    };
  }
  if (intent === 'clarify') {
    return {
      state: 'needs-context',
      reason: 'Melo needs a clearer local question before it can explain the route.',
    };
  }
  if (intent === 'check_purchase' && detectedAmountMinor === null) {
    return {
      state: 'needs-context',
      reason: 'Melo needs an amount to test the what-if against the local route.',
    };
  }
  if (calculation?.kind === 'debt-strategy-required') {
    return {
      state: 'needs-context',
      reason: 'A debt projection needs the user to select a neutral repayment order.',
    };
  }
  if (intent === 'review_import') {
    return {
      state: 'review-required',
      reason: 'Import labels remain proposals until the user confirms them.',
    };
  }
  return {
    state: 'none',
    reason: 'Melo used confirmed local route inputs and made no record changes.',
  };
}

function chipsForIntent(
  intent: MeloLocalIntent,
  workspaceKind: MeloLocalFinancialSnapshot['workspaceKind'] = 'personal',
): readonly string[] {
  if (workspaceKind === 'business') {
    switch (intent) {
      case 'summarise_month':
        return ['Explain cash position'];
      case 'check_payday':
        return ['Show dated position'];
      case 'explain_changes':
        return ['What is next?'];
      case 'review_irregular_income':
        return ['Show dated income'];
      case 'clarify':
        return [
          'Explain my business cash position',
          'What needs my review?',
          'How has the last 30 days gone?',
        ];
      default:
        return [];
    }
  }

  switch (intent) {
    case 'check_purchase':
      return [];
    case 'explain_position':
      return [];
    case 'review_subscriptions':
      return [];
    case 'review_recurring':
      return [];
    case 'summarise_month':
      return ['Explain safe zone'];
    case 'review_import':
      return [];
    case 'plan_recovery':
      return [];
    case 'check_payday':
      return ['What is safe until then?'];
    case 'review_debts':
      return [];
    case 'review_goals':
      return [];
    case 'review_calendar':
      return [];
    case 'explain_changes':
      return ['What is next?'];
    case 'review_irregular_income':
      return ['When is my next income?'];
    case 'review_accounts':
      return [];
    case 'clarify':
      return ['Can I spend 120?', 'When is my next payday?', 'What changed?'];
  }
}

function actionsForBusinessDraft(input: {
  intent: MeloLocalIntent;
  snapshot: MeloLocalFinancialSnapshot;
  detectedAmountMinor: number | null;
}): readonly MeloLocalAiAction[] {
  if (input.intent === 'check_purchase' && input.detectedAmountMinor !== null) {
    const afterPurchase =
      (input.snapshot.businessProjectedCashMinor ?? 0) - input.detectedAmountMinor;
    return [
      action(
        'open_what_if',
        afterPurchase < 0 ? 'Try a smaller expense' : 'Open the what-if',
        'Keep this as a temporary Business check until you choose to record anything.',
        true,
      ),
      action(
        'explain_sources',
        'Show the source figures',
        'Review the confirmed Business cash, dated income and commitments used here.',
        false,
      ),
    ];
  }

  switch (input.intent) {
    case 'explain_position':
      return [
        action(
          'explain_sources',
          'Show source figures',
          'Open the confirmed Business figures behind the dated cash position.',
          false,
        ),
        action('open_calendar', 'Show dated items', 'Open the Business money calendar.', false),
      ];
    case 'review_subscriptions':
    case 'review_recurring':
      return [
        action(
          'open_calendar',
          'Open commitments',
          'Review the confirmed Business dates and recurring commitments.',
          false,
        ),
      ];
    case 'summarise_month':
      return [
        action(
          'explain_sources',
          'Show the Business picture',
          'Open the confirmed figures behind the last-30-days summary.',
          false,
        ),
        action('open_timeline', 'Open activity', 'Review exact local Business records.', false),
      ];
    case 'review_import':
      return [
        action(
          'review_imports',
          'Review uncertain records',
          'Confirm, edit or dismiss Business statement and receipt records one at a time.',
          true,
        ),
        action(
          'explain_sources',
          'Show original evidence',
          'Compare proposed records with retained source evidence when available.',
          false,
        ),
      ];
    case 'plan_recovery':
      return [
        action(
          'open_what_if',
          'Test one Business change',
          'Compare a proposed amount with the confirmed dated position without saving it.',
          true,
        ),
        action('open_calendar', 'Review commitments', 'Open confirmed Business dates.', false),
      ];
    case 'check_payday':
      return [
        action(
          'open_calendar',
          'Show dated income',
          'Open confirmed Business income dates without inventing a payday.',
          false,
        ),
      ];
    case 'review_debts':
      return [
        action(
          'explain_sources',
          'Explain the dated position',
          'Review Business cash, liabilities and confirmed commitments separately.',
          false,
        ),
      ];
    case 'review_goals':
      return [action('open_goals', 'Open plans', 'Review recorded Business targets.', false)];
    case 'review_calendar':
      return [
        action(
          'open_calendar',
          'Open calendar',
          'Review named Business events and amounts locally.',
          false,
        ),
      ];
    case 'explain_changes':
      return [
        action(
          'open_timeline',
          'Open activity',
          'Review the exact local Business records that changed.',
          false,
        ),
        action(
          'explain_sources',
          'Explain cash position',
          'Open confirmed Business cash and dated commitments.',
          false,
        ),
      ];
    case 'review_irregular_income':
      return [
        action(
          'open_calendar',
          'Show dated income',
          'Open confirmed Business income dates without forecasting future invoices.',
          false,
        ),
      ];
    case 'review_accounts':
      return [
        action(
          'open_account',
          'Open Business accounts',
          'Review and select accounts in this Business workspace.',
          false,
        ),
      ];
    case 'check_purchase':
    case 'clarify':
      return [
        action(
          'ask_clarifying_question',
          'Show Business questions',
          'Try cash position, review, last-30-days, account or dated-income questions.',
          false,
        ),
      ];
  }
}

function actionsForDraft(input: {
  intent: MeloLocalIntent;
  snapshot: MeloLocalFinancialSnapshot;
  detectedAmountMinor: number | null;
}): readonly MeloLocalAiAction[] {
  if (input.snapshot.workspaceKind === 'business') {
    return actionsForBusinessDraft(input);
  }

  if (input.intent === 'check_purchase' && input.detectedAmountMinor !== null) {
    const afterPurchase = input.snapshot.availableNowMinor - input.detectedAmountMinor;
    if (afterPurchase < 0) {
      return [
        action(
          'build_recovery_route',
          'Preview a recovery spend',
          'Open a local preview where you enter the pressure point before anything is saved.',
          true,
        ),
        action(
          'open_what_if',
          'Try a smaller amount',
          'Test a lower spend without saving it.',
          true,
        ),
        action(
          'explain_sources',
          'Show why it is short',
          'Open the local figures behind the answer.',
          false,
        ),
      ];
    }

    return [
      action(
        'open_what_if',
        'Open the what-if',
        'Keep this as a temporary test until you choose to save it.',
        true,
      ),
      action(
        'explain_sources',
        'Show the source figures',
        'Review the confirmed items used for this answer.',
        false,
      ),
      action(
        'ask_clarifying_question',
        'Show question types',
        'See the local question types Melo can answer.',
        false,
      ),
    ];
  }

  if (input.intent === 'explain_position') {
    return [
      action(
        'explain_sources',
        'Show source figures',
        'Open the confirmed items behind the available amount.',
        false,
      ),
      action('open_what_if', 'Test a purchase', 'Try a spend amount without saving it.', true),
    ];
  }

  if (input.intent === 'review_subscriptions') {
    return [
      action(
        'open_subscriptions',
        'Open subscriptions',
        'Review the local subscription rows and renewal dates.',
        false,
      ),
    ];
  }

  if (input.intent === 'review_recurring') {
    return [
      action(
        'open_subscriptions',
        'Open recurring payments',
        'Review the local recurring rows and renewal dates.',
        false,
      ),
      action('open_calendar', 'Show their timing', 'Open the local money calendar.', false),
    ];
  }

  if (input.intent === 'summarise_month') {
    return [
      action(
        'explain_sources',
        'Show the local picture',
        'Open the confirmed figures behind the monthly summary.',
        false,
      ),
      action('open_what_if', 'Check a purchase', 'Try an amount without saving it.', true),
    ];
  }

  if (input.intent === 'review_import') {
    return [
      action(
        'review_imports',
        'Review uncertain imports',
        'Confirm, edit or dismiss suggested labels one at a time.',
        true,
      ),
      action(
        'explain_sources',
        'Show original wording',
        'Compare Melo suggestions with statement text.',
        false,
      ),
    ];
  }

  if (input.intent === 'plan_recovery') {
    return [
      action(
        'build_recovery_route',
        'Preview recovery spend',
        'Open a local preview where you enter the pressure point before anything is saved.',
        true,
      ),
      action(
        'open_what_if',
        'Test another amount',
        'Try another spend amount without saving it.',
        true,
      ),
    ];
  }

  if (input.intent === 'check_payday') {
    return [
      action(
        'open_payday_ritual',
        'Open payday ritual',
        'Review the local payday steps without changing records.',
        true,
      ),
      action('open_calendar', 'Show the calendar', 'Open the local money calendar.', false),
    ];
  }

  if (input.intent === 'review_debts') {
    return [
      action(
        'explain_sources',
        'Explain protected money',
        'Open the local Safe Zone calculation including confirmed minimums.',
        false,
      ),
    ];
  }

  if (input.intent === 'review_goals') {
    return [action('open_goals', 'Open pots', 'Review local savings pots.', false)];
  }

  if (input.intent === 'review_calendar') {
    return [
      action('open_calendar', 'Open calendar', 'Review named events and amounts locally.', false),
      action('open_what_if', 'Check a purchase', 'Try an amount without saving it.', true),
    ];
  }

  if (input.intent === 'explain_changes') {
    return [
      action(
        'open_timeline',
        'Open timeline',
        'Review the exact local records that changed.',
        false,
      ),
      action(
        'explain_sources',
        'Explain current position',
        'Open the confirmed local Safe Zone calculation.',
        false,
      ),
    ];
  }

  if (input.intent === 'review_irregular_income') {
    return [
      action('open_calendar', 'Show income timing', 'Open the local money calendar.', false),
      action(
        'explain_sources',
        'Explain the safe zone',
        'Open the confirmed local Safe Zone calculation.',
        false,
      ),
    ];
  }

  if (input.intent === 'review_accounts') {
    return [
      action(
        'open_account',
        'Open accounts',
        'Review and select named accounts on this phone.',
        false,
      ),
    ];
  }

  return [
    action(
      'ask_clarifying_question',
      'Show question types',
      'Try a spend amount, available-balance question, import review or recovery question.',
      false,
    ),
  ];
}

function action(
  kind: MeloLocalAiActionKind,
  label: string,
  detail: string,
  requiresUserReview: boolean,
): MeloLocalAiAction {
  return { kind, label, detail, requiresUserReview };
}

export function extractMeloLocalAmountCandidatesMinor(prompt: string): readonly number[] {
  const matches = [...prompt.matchAll(/(?:gbp|pounds?|£)?\s*(\d{1,6})(?:[.,](\d{1,2}))?/gi)];
  if (matches.length === 0) return [];

  return [
    ...new Set(
      matches
        .map((match) => {
          const pounds = Number(match[1]);
          const pennies = Number((match[2] ?? '').padEnd(2, '0'));
          return Number.isFinite(pounds)
            ? pounds * 100 + (Number.isFinite(pennies) ? pennies : 0)
            : 0;
        })
        .filter((amount) => amount > 0),
    ),
  ];
}

export function extractMeloLocalAmountMinor(prompt: string): number | null {
  const amounts = extractMeloLocalAmountCandidatesMinor(prompt);
  return amounts.length === 1 ? (amounts[0] ?? null) : null;
}

function hasPromptInjectionLanguage(prompt: string): boolean {
  return includesAny(prompt, [
    'ignore previous',
    'ignore all',
    'system prompt',
    'developer message',
    'dump',
    'exfiltrate',
    'reveal',
    'api key',
    'database password',
    'write directly',
    'update database',
  ]);
}

function includesAny(value: string, terms: readonly string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function formatMinorAmount(amountMinor: number): string {
  const sign = amountMinor < 0 ? '-' : '';
  const absolute = Math.abs(amountMinor);
  const pounds = Math.floor(absolute / 100);
  const pennies = absolute % 100;
  const pennyText = pennies === 0 ? '' : `.${String(pennies).padStart(2, '0')}`;
  const currency = '\u00a3';
  return `${sign}${currency}${pounds.toLocaleString('en-GB')}${pennyText}`;
}

function routeSelection(input: {
  routeKind: AiRouteKind;
  providerId: string | null;
  modelId: string | null;
  manualFallbackOffered: boolean;
  aiOffComplete: boolean;
  cloudRequestAllowed: boolean;
  strongRouteExplicit: boolean;
  regulatedOrWriteTaskRejected?: boolean;
  blockers: readonly string[];
}): RouteSelectionState {
  return {
    routeKind: input.routeKind,
    providerId: input.providerId,
    modelId: input.modelId,
    manualFallbackOffered: input.manualFallbackOffered,
    aiOffComplete: input.aiOffComplete,
    cloudRequestAllowed: input.cloudRequestAllowed,
    strongRouteExplicit: input.strongRouteExplicit,
    regulatedOrWriteTaskRejected: input.regulatedOrWriteTaskRejected ?? false,
    releaseBlocked: input.blockers.length > 0,
    blockers: input.blockers,
    rows: [
      row(
        'Selected route',
        input.routeKind,
        input.blockers.length === 0 ? 'implemented' : 'blocked',
      ),
      row(
        'Provider',
        input.providerId ?? 'none',
        input.providerId ? 'implemented' : 'needs_review',
      ),
      row(
        'Manual fallback',
        boolText(input.manualFallbackOffered),
        input.manualFallbackOffered ? 'implemented' : 'needs_review',
      ),
      row(
        'Cloud request',
        input.cloudRequestAllowed ? 'allowed' : 'not used',
        input.cloudRequestAllowed ? 'implemented' : 'needs_review',
      ),
    ],
  };
}

function findRoute(
  registry: AiProviderRegistryState,
  taskKind: AiTaskKind,
  routeKind: AiRouteKind,
): AiRouteConfig | undefined {
  return registry.activeRoutes.find(
    (routeConfig) =>
      routeConfig.routeKind === routeKind && routeConfig.taskKinds.includes(taskKind),
  );
}

function providerForRoute(
  registry: AiProviderRegistryState,
  routeConfig: AiRouteConfig,
): AiProviderDescriptor | undefined {
  if (!routeConfig.providerId) return undefined;
  return registry.providers.find((provider) => provider.providerId === routeConfig.providerId);
}

function coverageRow(
  taskId: Phase11TaskId,
  label: string,
  state: AiReadinessState,
  evidence: string,
  blocker?: string,
): Phase11CoverageRow {
  if (blocker) {
    return { taskId, label, state, evidence, blocker };
  }

  return { taskId, label, state, evidence };
}

function matchesFieldType(value: unknown, type: JsonFieldType): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return isRecord(value);
    case 'array':
      return Array.isArray(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function row(label: string, value: string, state: AiReadinessState): EvidenceRow {
  return { label, value, state };
}

function stateFor(condition: boolean): AiReadinessState {
  return condition ? 'implemented' : 'blocked';
}

function boolText(value: boolean): string {
  return value ? 'yes' : 'no';
}

function compact(values: readonly string[]): readonly string[] {
  return values.filter((value) => value.length > 0);
}

function firstBlocker(blockers: readonly string[]): string | undefined {
  return blockers[0];
}

function rate<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  if (items.length === 0) return 0;
  return items.filter(predicate).length / items.length;
}

function decimalRate(value: number): string {
  return value.toFixed(2);
}

function aliasFor(value: string, aliases: Map<string, string>): string {
  const existing = aliases.get(value);
  if (existing) return existing;

  const alias = `local_alias_${aliases.size + 1}`;
  aliases.set(value, alias);
  return alias;
}

const identifierFieldNames = new Set([
  'accountId',
  'accountName',
  'merchant',
  'merchantName',
  'counterparty',
  'documentId',
  'transactionId',
  'planId',
]);
