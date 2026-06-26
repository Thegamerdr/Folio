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
  | 'review_import'
  | 'plan_recovery'
  | 'clarify';

export type MeloLocalFinancialSnapshot = Readonly<{
  currency: 'GBP';
  availableNowMinor: number;
  tightestDay: string;
  tightestBalanceMinor: number;
  protectedItems: readonly string[];
  pendingReviewCount: number;
  nextPaydayLabel: string;
}>;

export type MeloLocalAiRequest = Readonly<{
  prompt: string;
  snapshot: MeloLocalFinancialSnapshot;
  cloudAiEnabled: boolean;
  cloudConsentGranted: boolean;
  source: 'typed_prompt' | 'quick_action';
}>;

export type MeloLocalAiActionKind =
  | 'open_what_if'
  | 'review_imports'
  | 'explain_sources'
  | 'build_recovery_route'
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
  const detectedAmountMinor = extractAmountMinor(normalized);
  const intent = classifyMeloLocalIntent(normalized);
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
    detectedAmountMinor,
    intent,
    snapshot: input.snapshot,
  });
  const financialConclusion = buildFinancialConclusion({
    detectedAmountMinor,
    intent,
    snapshot: input.snapshot,
  });
  const uncertainty = uncertaintyForIntent(intent, detectedAmountMinor, injectionConcern);
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
  const dataUsed = [
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
    followUpChips: chipsForIntent(intent),
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
      row('Available now', availableText, 'implemented'),
      row('Tightest point', `${input.snapshot.tightestDay}: ${tightestText}`, 'implemented'),
      row('Protected first', protectedItems, 'implemented'),
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

function classifyMeloLocalIntent(prompt: string): MeloLocalIntent {
  if (
    includesAny(prompt, ['can i', 'afford', 'buy', 'purchase', 'spend', 'before payday', 'left'])
  ) {
    return 'check_purchase';
  }

  if (includesAny(prompt, ['why', 'available', '142', 'balance', 'calculation', 'covered'])) {
    return 'explain_position';
  }

  if (includesAny(prompt, ['import', 'csv', 'statement', 'review', 'abound', 'rent', 'payroll'])) {
    return 'review_import';
  }

  if (includesAny(prompt, ['bad month', 'repair', 'car', 'emergency', 'recovery', 'short'])) {
    return 'plan_recovery';
  }

  return 'clarify';
}

function buildMeloLocalAnswer(input: {
  intent: MeloLocalIntent;
  snapshot: MeloLocalFinancialSnapshot;
  detectedAmountMinor: number | null;
  amountText: string | null;
}): string {
  const available = formatMinorAmount(input.snapshot.availableNowMinor);
  const tightest = formatMinorAmount(input.snapshot.tightestBalanceMinor);

  switch (input.intent) {
    case 'check_purchase': {
      if (input.detectedAmountMinor === null || input.amountText === null) {
        return `I can check it, but I need the amount first. Right now the local route shows ${available} available and ${tightest} at the tightest point.`;
      }

      const afterPurchase = input.snapshot.availableNowMinor - input.detectedAmountMinor;
      const afterPurchaseText = formatMinorAmount(afterPurchase);
      if (afterPurchase < 0) {
        return `${input.amountText} would push the local route short by ${formatMinorAmount(
          Math.abs(afterPurchase),
        )}. I would treat that as review-only and look for something to move before saving anything.`;
      }

      return `${input.amountText} is possible in the local route, leaving about ${afterPurchaseText}. I would still keep it as a reviewed what-if, not an automatic change.`;
    }

    case 'explain_position':
      return `The ${available} figure comes from confirmed local items first, with ${input.snapshot.protectedItems.join(
        ', ',
      )} protected before flexible spend. The tightest visible point is ${input.snapshot.tightestDay} at ${tightest}.`;

    case 'review_import':
      return `I can help review imports. There are ${input.snapshot.pendingReviewCount} review item${
        input.snapshot.pendingReviewCount === 1 ? '' : 's'
      } that still need your eye. I can suggest labels, but confirmation stays with you.`;

    case 'plan_recovery':
      return `For a pressure point, I would keep protected items first, preview the spend locally, and show what changes before anything is saved. The current local tightest point is ${input.snapshot.tightestDay} at ${tightest}.`;

    case 'clarify':
      return 'I can help with a local what-if, explain the available amount, review imports, or preview a recovery spend. Ask one of those and I will keep it review-only.';
  }
}

function buildFinancialConclusion(input: {
  intent: MeloLocalIntent;
  snapshot: MeloLocalFinancialSnapshot;
  detectedAmountMinor: number | null;
}): string {
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
): Readonly<{ state: MeloLocalAiDraft['uncertainty']; reason: string }> {
  if (injectionConcern) {
    return {
      state: 'review-required',
      reason: 'Some wording tried to change instructions or expose data, so Melo ignored it.',
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

function chipsForIntent(intent: MeloLocalIntent): readonly string[] {
  switch (intent) {
    case 'check_purchase':
      return ['Test another amount', 'Open what-if', 'Explain tightest point'];
    case 'explain_position':
      return ['Show sources', 'Explain tightest point', 'Review assumptions'];
    case 'review_import':
      return ['Review uncertain items', 'Show original wording', 'Keep source attached'];
    case 'plan_recovery':
      return ['Preview pressure spend', 'Protect rent first', 'Show what changes'];
    case 'clarify':
      return ['Can I spend 120?', 'Why is 142 available?', 'Review imports'];
  }
}

function actionsForDraft(input: {
  intent: MeloLocalIntent;
  snapshot: MeloLocalFinancialSnapshot;
  detectedAmountMinor: number | null;
}): readonly MeloLocalAiAction[] {
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

function extractAmountMinor(prompt: string): number | null {
  const matches = [...prompt.matchAll(/(?:gbp|pounds?|£)?\s*(\d{1,6})(?:[.,](\d{1,2}))?/gi)];
  if (matches.length === 0) return null;

  const amounts = matches
    .map((match) => {
      const pounds = Number(match[1]);
      const pennies = Number((match[2] ?? '').padEnd(2, '0'));
      return Number.isFinite(pounds) ? pounds * 100 + (Number.isFinite(pennies) ? pennies : 0) : 0;
    })
    .filter((amount) => amount > 0);

  if (amounts.length === 0) return null;
  return Math.max(...amounts);
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
