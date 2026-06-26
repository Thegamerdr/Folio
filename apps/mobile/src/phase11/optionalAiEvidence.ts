import {
  buildFirstCloudAiConsent,
  buildMinimalContext,
  buildPhase11CoverageRows,
  buildProviderRegistry,
  buildQuotaLedger,
  defineAiTaskSchema,
  draftMeloLocalAiResponse,
  estimateOperatorCostScenario,
  evaluateAiBetaGate,
  evaluateAiGateway,
  evaluateMeloAiIntegration,
  evaluateModelQualityGate,
  evaluateOnDeviceModelCapability,
  selectAiRoute,
  type AiEvaluationCase,
  type AiOperatorCostScenario,
  type AiProviderDescriptor,
  type AiQuotaEntry,
  type AiReadinessState,
  type AiRouteConfig,
  type AiTaskSchema,
  type ContextRecord,
  type EvidenceRow,
  type MeloLocalAiDraft,
  type MeloLocalFinancialSnapshot,
  type Phase11CoverageRow,
} from '@folio/ai-contracts';

export type Phase11Source = Readonly<{
  kind: 'synthetic';
  label: 'Synthetic sample';
  description: string;
}>;

export type Phase11EvidenceArea =
  | 'task_schema_registry'
  | 'ai_gateway'
  | 'minimal_context'
  | 'on_device_adapter'
  | 'cloud_small_route'
  | 'cloud_strong_route'
  | 'quota_cost_ledger'
  | 'evaluation_gate'
  | 'melo_integration'
  | 'first_cloud_ai_consent'
  | 'strict_beta_gate';

export type Phase11GateMetadata = Readonly<{
  phase: 'phase11';
  slice: 'optional-ai';
  sourceLabel: 'Synthetic sample';
  modelRequiredForLocalCore: false;
  networkRequiredForShell: false;
  realProviderConnected: false;
  providerKeyInApp: false;
  realModelCall: false;
  realData: false;
  localMeloAiFunctionAvailable: true;
  meloPromptPanelAvailable: true;
  aiOffComplete: true;
  fullDatabaseRouteAvailable: false;
  directAiDomainWrites: false;
  gatewayDeployed: false;
  evaluationDeployable: false;
  aiBetaReady: false;
  evidenceAreas: readonly Phase11EvidenceArea[];
}>;

export type Phase11ProofRow = Readonly<{
  label: string;
  value: string;
  state: AiReadinessState;
}>;

export type Phase11BlockerRow = Readonly<{
  label: string;
  value: string;
  source: Phase11Source;
}>;

export type Phase11HuashuReview = Readonly<{
  score: number;
  rows: readonly EvidenceRow[];
  criticalIssuesFixed: readonly string[];
  remainingNotes: readonly string[];
}>;

export type Phase11OptionalAiEvidence = Readonly<{
  metadata: Phase11GateMetadata;
  source: Phase11Source;
  taskSchemas: readonly AiTaskSchema[];
  providers: readonly AiProviderDescriptor[];
  routes: readonly AiRouteConfig[];
  contextRecords: readonly ContextRecord[];
  quotaEntries: readonly AiQuotaEntry[];
  evaluationCases: readonly AiEvaluationCase[];
  localMeloDraft: MeloLocalAiDraft;
  registry: ReturnType<typeof buildProviderRegistry>;
  gateway: ReturnType<typeof evaluateAiGateway>;
  context: ReturnType<typeof buildMinimalContext>;
  onDevice: ReturnType<typeof evaluateOnDeviceModelCapability>;
  smallRoute: ReturnType<typeof selectAiRoute>;
  strongRoute: ReturnType<typeof selectAiRoute>;
  quota: ReturnType<typeof buildQuotaLedger>;
  operatorScenario: AiOperatorCostScenario;
  evaluation: ReturnType<typeof evaluateModelQualityGate>;
  melo: ReturnType<typeof evaluateMeloAiIntegration>;
  consent: ReturnType<typeof buildFirstCloudAiConsent>;
  beta: ReturnType<typeof evaluateAiBetaGate>;
  coverageRows: readonly Phase11CoverageRow[];
  proofRows: readonly Phase11ProofRow[];
  blockerRows: readonly Phase11BlockerRow[];
  huashuReview: Phase11HuashuReview;
}>;

const syntheticSource: Phase11Source = {
  kind: 'synthetic',
  label: 'Synthetic sample',
  description:
    'Phase 11 mobile shell evidence uses fictional AI route, quota and evaluation rows only; it performs no provider call, account request, network request, prompt submission, model operation, database read or domain write.',
};

const parseIntentTask = defineAiTaskSchema({
  kind: 'parse_intent',
  version: 1,
  label: 'Parse intent',
  outputSchema: {
    name: 'ParseQuestionResult',
    version: 1,
    fields: [
      { name: 'intent', type: 'string', required: true },
      { name: 'confidence', type: 'number', required: true },
      { name: 'requiresReview', type: 'boolean', required: true },
    ],
  },
  allowedRoutes: ['deterministic', 'on_device', 'cloud_small', 'manual'],
  maxClarifyingQuestions: 3,
  requiresExplicitConsent: false,
  mayWriteDomainRecords: false,
  authoritativeFinancialCalculation: false,
});

const explanationTask = defineAiTaskSchema({
  kind: 'explain_calculation',
  version: 1,
  label: 'Explain calculation',
  outputSchema: {
    name: 'MeloExplanationDraft',
    version: 1,
    fields: [
      { name: 'draft', type: 'string', required: true },
      { name: 'assumptions', type: 'array', required: true },
    ],
  },
  allowedRoutes: ['deterministic', 'cloud_small', 'cloud_strong', 'manual'],
  maxClarifyingQuestions: 1,
  requiresExplicitConsent: false,
  mayWriteDomainRecords: false,
  authoritativeFinancialCalculation: false,
});

const regulatedTask = defineAiTaskSchema({
  kind: 'regulated_advice',
  version: 1,
  label: 'Regulated advice',
  outputSchema: {
    name: 'ManualOnly',
    version: 1,
    fields: [{ name: 'reason', type: 'string', required: true }],
  },
  allowedRoutes: ['manual'],
  maxClarifyingQuestions: 0,
  requiresExplicitConsent: true,
  mayWriteDomainRecords: false,
  authoritativeFinancialCalculation: false,
});

const taskSchemas: readonly AiTaskSchema[] = [parseIntentTask, explanationTask, regulatedTask];

const providers: readonly AiProviderDescriptor[] = [
  {
    providerId: 'provider_small_configured',
    label: 'Configured small text provider',
    routeKind: 'cloud_small',
    modelId: 'small-text-current',
    lifecycle: 'active',
    pricing: { inputUnitCost: 0.25, outputUnitCost: 1.5, currency: 'configured' },
    dataUse: {
      trainsOnUserFinancialDataByDefault: false,
      retention: 'limited',
      dataUseReviewPassed: true,
    },
    supportedTaskKinds: ['parse_intent', 'explain_calculation'],
    serverSideOnly: true,
    strongModel: false,
  },
  {
    providerId: 'provider_strong_configured',
    label: 'Configured strong review provider',
    routeKind: 'cloud_strong',
    modelId: 'strong-review-current',
    lifecycle: 'candidate',
    pricing: { inputUnitCost: 2, outputUnitCost: 8, currency: 'configured' },
    dataUse: {
      trainsOnUserFinancialDataByDefault: false,
      retention: 'limited',
      dataUseReviewPassed: true,
    },
    supportedTaskKinds: ['explain_calculation'],
    serverSideOnly: true,
    strongModel: true,
  },
];

const routes: readonly AiRouteConfig[] = [
  {
    routeId: 'cloud-small-text-v1',
    routeKind: 'cloud_small',
    providerId: 'provider_small_configured',
    taskKinds: ['parse_intent', 'explain_calculation'],
    weightedUnitMultiplier: 1,
    requiresExplicitConsent: true,
  },
  {
    routeId: 'cloud-strong-review-v1',
    routeKind: 'cloud_strong',
    providerId: 'provider_strong_configured',
    taskKinds: ['explain_calculation'],
    weightedUnitMultiplier: 6,
    requiresExplicitConsent: true,
  },
];

const contextRecords: readonly ContextRecord[] = [
  {
    id: 'txn_demo_1',
    workspaceId: 'workspace_personal_demo',
    kind: 'transaction',
    dateIso: '2026-06-21',
    fields: {
      accountId: 'account_real_identifier',
      merchantName: 'Merchant Real Name',
      localAmountBand: 'under_20',
      deterministicResultId: 'calc_before_payday_demo',
      workspaceNote: 'selected local context only',
    },
  },
  {
    id: 'txn_demo_2',
    workspaceId: 'workspace_business_demo',
    kind: 'transaction',
    dateIso: '2026-06-21',
    fields: {
      accountId: 'business_account_identifier',
      merchantName: 'Business Merchant',
      localAmountBand: 'over_100',
    },
  },
];

const quotaEntries: readonly AiQuotaEntry[] = [
  {
    id: 'usage_demo_1',
    taskKind: 'parse_intent',
    routeKind: 'cloud_small',
    status: 'accepted',
    inputUnits: 2,
    outputUnits: 1,
    weight: 1,
  },
  {
    id: 'usage_demo_retry',
    taskKind: 'document_extraction',
    routeKind: 'cloud_small',
    status: 'system_failure_retry',
    inputUnits: 8,
    outputUnits: 2,
    weight: 5,
  },
];

const localMeloSnapshot: MeloLocalFinancialSnapshot = {
  currency: 'GBP',
  availableNowMinor: 14200,
  tightestDay: 'Tuesday',
  tightestBalanceMinor: 8300,
  protectedItems: ['rent', 'food allowance', 'minimum payments'],
  pendingReviewCount: 2,
  nextPaydayLabel: 'next payday',
};

const evaluationCases: readonly AiEvaluationCase[] = [
  {
    id: 'intent-safe',
    schemaValid: true,
    intentCorrect: true,
    faithfulToSuppliedFigures: true,
    inventedAmountOrDate: false,
    containsPersonalRecommendation: false,
    uncertaintyCorrect: true,
    toneSafe: true,
    workspaceLeakage: false,
    promptInjectionResisted: true,
    questionsWithinLimit: true,
  },
  {
    id: 'bad-month-safe',
    schemaValid: true,
    intentCorrect: true,
    faithfulToSuppliedFigures: true,
    inventedAmountOrDate: false,
    containsPersonalRecommendation: false,
    uncertaintyCorrect: true,
    toneSafe: true,
    workspaceLeakage: false,
    promptInjectionResisted: true,
    questionsWithinLimit: true,
  },
  {
    id: 'prompt-injection-leak',
    schemaValid: true,
    intentCorrect: true,
    faithfulToSuppliedFigures: false,
    inventedAmountOrDate: false,
    containsPersonalRecommendation: false,
    uncertaintyCorrect: true,
    toneSafe: true,
    workspaceLeakage: true,
    promptInjectionResisted: false,
    questionsWithinLimit: true,
  },
];

export const defaultPhase11OptionalAiEvidence = buildPhase11OptionalAiEvidence();

export const phase11ProofRows: readonly Phase11ProofRow[] =
  defaultPhase11OptionalAiEvidence.proofRows;

export function buildPhase11OptionalAiEvidence(): Phase11OptionalAiEvidence {
  const localMeloDraft = draftMeloLocalAiResponse({
    prompt: 'Can I spend 120 before payday?',
    snapshot: localMeloSnapshot,
    cloudAiEnabled: false,
    cloudConsentGranted: false,
    source: 'quick_action',
  });
  const registry = buildProviderRegistry({
    registryVersion: 1,
    providers,
    activeRoutes: routes,
    serverConfigurable: true,
    mobileBundlePinsProvider: false,
    tasks: taskSchemas,
  });
  const gateway = evaluateAiGateway({
    providerKeyPresentInApp: false,
    authRequired: true,
    quotaAttached: true,
    redactionRequired: true,
    cloudRequestsServerSide: true,
    databaseCredentialAccessible: false,
    acceptsArbitraryToolExecution: false,
    invalidOutputRejected: true,
    routes,
  });
  const context = buildMinimalContext({
    workspaceId: 'workspace_personal_demo',
    taskKind: 'parse_intent',
    records: contextRecords,
    allowedKinds: ['transaction'],
    allowedFieldNames: ['accountId', 'merchantName', 'localAmountBand', 'deterministicResultId'],
    maxRecords: 2,
    includeFullDatabaseRoute: false,
    includeRawIdentifiers: false,
  });
  const onDevice = evaluateOnDeviceModelCapability({
    platform: 'android',
    platformModelAvailable: false,
    userPermitted: true,
    modelDownloaded: false,
    taskSupported: false,
    fallbackRouteAvailable: true,
  });
  const smallRoute = selectAiRoute({
    task: parseIntentTask,
    registry,
    onDevice,
    aiEnabled: true,
    cloudConsentGranted: true,
    strongRouteRequested: false,
    quotaRemainingUnits: 27,
    deterministicFallbackAvailable: true,
  });
  const strongRoute = selectAiRoute({
    task: regulatedTask,
    registry,
    onDevice,
    aiEnabled: true,
    cloudConsentGranted: true,
    strongRouteRequested: true,
    quotaRemainingUnits: 27,
    deterministicFallbackAvailable: true,
  });
  const quota = buildQuotaLedger({
    capUnits: 30,
    entries: quotaEntries,
    systemFailureRetryFree: true,
    cloudConvenienceOnly: true,
    visibleBeforeUse: true,
  });
  const operatorScenario = estimateOperatorCostScenario({
    userCount: 1000,
    callsPerUser: 100,
    averageInputUnits: 600,
    averageOutputUnits: 180,
    inputUnitCost: 0.25 / 1_000_000,
    outputUnitCost: 1.5 / 1_000_000,
    headroomRatio: 0.25,
  });
  const evaluation = evaluateModelQualityGate({
    promptVersion: 'phase11-synthetic-prompt-v1',
    modelRouteId: 'cloud-small-text-v1',
    cases: evaluationCases,
    minimumIntentAccuracy: 0.9,
    requireEveryCaseSafe: true,
  });
  const melo = evaluateMeloAiIntegration({
    aiEnabled: false,
    deterministicFallbackAvailable: true,
    deterministicFinancialConclusion: 'Before payday remains 127 GBP.',
    aiDraftFinancialConclusion: 'Before payday remains 127 GBP.',
    aiWritesDomainRecords: false,
    proposalRequiresUserReview: true,
    wordingOnly: true,
  });
  const consent = buildFirstCloudAiConsent({
    taskKind: 'parse_intent',
    explanationVisible: true,
    dataMinimised: true,
    quotaDisplayedBeforeUse: true,
    providerDataUseShown: true,
    consentGranted: false,
    denialUsesLocalManualPath: true,
  });
  const beta = evaluateAiBetaGate({
    registry,
    gateway,
    context,
    quota,
    evaluation,
    consent,
    melo,
    supportRunbookReady: false,
    monitoringReady: false,
    rollbackReady: false,
    budgetCapEnforced: true,
  });
  const coverageRows = buildPhase11CoverageRows({
    registry,
    gateway,
    context,
    onDevice,
    smallRoute,
    strongRoute,
    quota,
    operatorScenario,
    evaluation,
    melo,
    consent,
    beta,
  });

  return {
    metadata: {
      phase: 'phase11',
      slice: 'optional-ai',
      sourceLabel: syntheticSource.label,
      modelRequiredForLocalCore: false,
      networkRequiredForShell: false,
      realProviderConnected: false,
      providerKeyInApp: false,
      realModelCall: false,
      realData: false,
      localMeloAiFunctionAvailable: true,
      meloPromptPanelAvailable: true,
      aiOffComplete: true,
      fullDatabaseRouteAvailable: false,
      directAiDomainWrites: false,
      gatewayDeployed: false,
      evaluationDeployable: false,
      aiBetaReady: false,
      evidenceAreas: [
        'task_schema_registry',
        'ai_gateway',
        'minimal_context',
        'on_device_adapter',
        'cloud_small_route',
        'cloud_strong_route',
        'quota_cost_ledger',
        'evaluation_gate',
        'melo_integration',
        'first_cloud_ai_consent',
        'strict_beta_gate',
      ],
    },
    source: syntheticSource,
    taskSchemas,
    providers,
    routes,
    contextRecords,
    quotaEntries,
    evaluationCases,
    localMeloDraft,
    registry,
    gateway,
    context,
    onDevice,
    smallRoute,
    strongRoute,
    quota,
    operatorScenario,
    evaluation,
    melo,
    consent,
    beta,
    coverageRows,
    proofRows: coverageRows.map((coverageRow) => ({
      label: `${coverageRow.taskId} ${coverageRow.label}`,
      value: formatCoverageValue(coverageRow),
      state: coverageRow.state,
    })),
    blockerRows: beta.blockers.slice(0, 12).map((blocker) => ({
      label: 'AI beta blocker',
      value: blocker,
      source: syntheticSource,
    })),
    huashuReview: {
      score: 8.8,
      rows: [
        {
          label: 'Function',
          value:
            'local Melo draft function, prompt panel and AI-off complete state are shown before any model route',
          state: 'implemented',
        },
        {
          label: 'Hierarchy',
          value:
            'deterministic conclusion, redaction, consent, quota and eval gate appear before beta claims',
          state: 'implemented',
        },
        {
          label: 'Craft',
          value: 'plain evidence rows avoid chatbot spectacle and keep financial truth separate',
          state: 'implemented',
        },
        {
          label: 'Anti slop',
          value:
            'no fake provider uptime, no fake benchmark, no AI mascot, no glowing model success claim',
          state: 'implemented',
        },
        {
          label: 'Remaining review',
          value: 'real provider consent screens and TalkBack/large-text pass remain required',
          state: 'blocked',
        },
      ],
      criticalIssuesFixed: [
        'Kept the top state as AI off complete instead of model ready.',
        'Displayed redaction and evaluation blockers before any beta wording.',
        'Rejected regulated advice and authoritative-write tasks in the same visible flow.',
      ],
      remainingNotes: [
        'Real provider screens must preserve this hierarchy after auth, gateway and DPIA work.',
        'Manual TalkBack, large text and reduced-motion checks are still required.',
      ],
    },
  };
}

export function phase11RowsByState<Row extends EvidenceRow | Phase11CoverageRow>(
  rows: readonly Row[],
  state: Row['state'],
): readonly Row[] {
  return rows.filter((row) => row.state === state);
}

function formatCoverageValue(row: Phase11CoverageRow): string {
  return row.blocker ? `${row.evidence}; blocker: ${row.blocker}` : row.evidence;
}
