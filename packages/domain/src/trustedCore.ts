import type {
  AccountId,
  AuditLogId,
  CommitmentId,
  CurrencyCode,
  DecisionRecordId,
  EventId,
  ExpectationId,
  ForecastId,
  InstantString,
  LocalDate,
  Money,
  PlanId,
  ProvenanceId,
  ScenarioId,
  SourceRecordId,
  TransactionId,
  UserCorrectionId,
  WorkspaceKind,
  WorkspaceId,
} from './index.js';

export const trustedCoreTruthClasses = [
  'verified',
  'user_confirmed',
  'observed',
  'inferred',
  'estimated',
  'predicted',
  'assumed',
  'missing',
  'stale',
  'contradicted',
  'sample_demo',
] as const;

export type TrustedCoreTruthClass = (typeof trustedCoreTruthClasses)[number];

export const trustedCoreConfidenceLevels = ['high', 'medium', 'low', 'blocked'] as const;

export type TrustedCoreConfidence = (typeof trustedCoreConfidenceLevels)[number];

export const trustedCoreFreshnessStates = ['fresh', 'ageing', 'stale', 'missing'] as const;

export type TrustedCoreFreshness = (typeof trustedCoreFreshnessStates)[number];

export const trustedSafeRangeRelianceStates = [
  'safe_to_rely',
  'use_caution',
  'provisional',
  'blocked',
] as const;

export type TrustedSafeRangeReliance = (typeof trustedSafeRangeRelianceStates)[number];

export type TrustedCoreSourceType =
  | 'manual_entry'
  | 'user_correction'
  | 'review_confirmation'
  | 'statement_import'
  | 'document_read'
  | 'open_banking'
  | 'calendar_event'
  | 'recurring_obligation'
  | 'forecast'
  | 'scenario'
  | 'melo_tool'
  | 'migration'
  | 'system_derived'
  | 'sample_demo';

export type TrustedCoreFactRef = Readonly<{
  factId: string;
  workspaceId: WorkspaceId;
  truthClass: TrustedCoreTruthClass;
  sourceType: TrustedCoreSourceType;
  sourceRef: string | null;
  capturedAt: InstantString | null;
  confirmedAt: InstantString | null;
  expiresAt: InstantString | null;
  confidence: TrustedCoreConfidence;
  freshness: TrustedCoreFreshness;
  assumptions: readonly string[];
  derivedFrom: readonly string[];
  correctionOf: string | null;
  provenanceId?: ProvenanceId;
  sourceRecordIds?: readonly SourceRecordId[];
}>;

export type TrustedCoreProvenanceSnapshot = Readonly<{
  id: ProvenanceId;
  workspaceId: WorkspaceId;
  truthClass: TrustedCoreTruthClass;
  confidence: TrustedCoreConfidence;
  freshness: TrustedCoreFreshness;
  sourceFactIds: readonly string[];
  missingMaterialInfo: readonly string[];
  assumptions: readonly string[];
  contradictedFactIds: readonly string[];
  createdAt: InstantString;
  expiresAt: InstantString | null;
  auditLogIds: readonly AuditLogId[];
}>;

export type TrustedSafeRangeCause = Readonly<{
  label: string;
  amount: Money;
  dateISO?: LocalDate;
  sourceFactIds: readonly string[];
}>;

export type TrustedSafeRangeSourceBreakdown = Readonly<{
  factId: string;
  truthClass: TrustedCoreTruthClass;
  label: string;
  capturedAt: InstantString | null;
  freshness: TrustedCoreFreshness;
  confidence: TrustedCoreConfidence;
}>;

export const trustedSafeRangeStatuses = [
  'ready',
  'caution',
  'shortfall',
  'insufficient_data',
  'stale',
  'contradicted',
  'sample_demo',
  'workspace_blocked',
] as const;

export type TrustedSafeRangeStatus = (typeof trustedSafeRangeStatuses)[number];

export type TrustedSafeRangeIssueSeverity = 'info' | 'caution' | 'blocker';

export type TrustedSafeRangeIssue = Readonly<{
  id: string;
  label: string;
  severity: TrustedSafeRangeIssueSeverity;
  sourceFactIds: readonly string[];
}>;

export type TrustedSafeRangeConfidenceReason = Readonly<{
  id: string;
  label: string;
  impact: 'raises' | 'lowers' | 'blocks';
  sourceFactIds: readonly string[];
}>;

export type TrustedSafeRangeUncertaintySource = Readonly<{
  id: string;
  label: string;
  amount: Money;
  direction: 'widens_down' | 'widens_up' | 'widens_both';
  sourceFactIds: readonly string[];
}>;

export type TrustedSafeRangeAmountRef = Readonly<{
  amount: Money | null;
  truthClass: TrustedCoreTruthClass;
  label: string;
  sourceFactIds: readonly string[];
  observedAt: InstantString | null;
}>;

export type TrustedSafeRangeTightestPoint = Readonly<{
  dateISO: LocalDate | null;
  amount: Money | null;
  sourceFactIds: readonly string[];
}>;

export type TrustedSafeRangeExpectedRange = Readonly<{
  min: Money | null;
  max: Money | null;
  basis: 'exact_known_path' | 'explicit_uncertainty' | 'unavailable';
  uncertaintySources: readonly TrustedSafeRangeUncertaintySource[];
}>;

export type TrustedSafeRangeFreshnessDetail = Readonly<{
  status: TrustedCoreFreshness;
  oldestMaterialSourceAt: InstantString | null;
  affectedSourceIds: readonly string[];
  summary: string;
}>;

export type TrustedSafeRangeSourceReliance = Readonly<{
  safeToRelyOn: boolean;
  label: string;
  blockedBy: readonly string[];
}>;

export type TrustedSafeRangeNextAction = Readonly<{
  id: string;
  label: string;
  route: string;
  reason: string;
  sourceFactIds: readonly string[];
}>;

export type TrustedSafeRangeResult = Readonly<{
  workspaceId: WorkspaceId;
  currency: CurrencyCode;
  calculatedAt: InstantString;
  horizonStartISO: LocalDate;
  horizonEndISO: LocalDate;
  status: TrustedSafeRangeStatus;
  truthClass: TrustedCoreTruthClass;
  currentPosition: TrustedSafeRangeAmountRef;
  committedFloor: TrustedSafeRangeAmountRef;
  expectedRange: TrustedSafeRangeExpectedRange;
  tightestPoint: TrustedSafeRangeTightestPoint;
  shortfall: Money | null;
  confidenceReasons: readonly TrustedSafeRangeConfidenceReason[];
  freshnessDetail: TrustedSafeRangeFreshnessDetail;
  missingInputs: readonly TrustedSafeRangeIssue[];
  contradictions: readonly TrustedSafeRangeIssue[];
  relianceDetail: TrustedSafeRangeSourceReliance;
  whyChanged: readonly TrustedSafeRangeIssue[];
  nextAction: TrustedSafeRangeNextAction | null;
  currentKnownPosition: Money | null;
  knownCommittedFloor: Money | null;
  expectedSafeMin: Money | null;
  expectedSafeMax: Money | null;
  conservativeBoundary: Money | null;
  reliance: TrustedSafeRangeReliance;
  confidence: TrustedCoreConfidence;
  freshness: TrustedCoreFreshness;
  missingMaterialInfo: readonly string[];
  assumptions: readonly string[];
  mainCauses: readonly TrustedSafeRangeCause[];
  wouldChangeIf: readonly string[];
  sourceBreakdown: readonly TrustedSafeRangeSourceBreakdown[];
  forecastVersionId: ForecastId;
  provenanceId: ProvenanceId;
  canUserRelyOnAnswer: boolean;
}>;

export const materialDecisionKinds = [
  'purchase-affordability',
  'recurring-commitment-change',
  'debt-payment',
  'pot-contribution',
  'pot-borrow',
  'spending-hold',
  'recovery-plan',
  'payday-plan',
  'income-assumption',
  'bill-date-change',
  'scenario-choice',
  'manual-financial-adjustment',
  'melo-confirmed-action',
] as const;

export type MaterialDecisionKind = (typeof materialDecisionKinds)[number];

export const decisionLedgerStatuses = [
  'draft',
  'presented',
  'chosen',
  'declined',
  'awaiting-outcome',
  'resolved',
  'corrected',
  'cancelled',
  'expired',
  'deleted',
] as const;

export type DecisionLedgerStatus = (typeof decisionLedgerStatuses)[number];

export type DecisionLedgerQuestionSource =
  | 'user'
  | 'system-detected'
  | 'melo-proposed'
  | 'scenario'
  | 'recovery'
  | 'payday-ritual';

export type DecisionLedgerPriorityType =
  | 'avoid_shortfall'
  | 'keep_commitment'
  | 'reduce_debt'
  | 'build_buffer'
  | 'cashflow_confidence'
  | 'manual_adjustment'
  | 'other';

export type DecisionLedgerChoiceState =
  | 'accepted'
  | 'rejected'
  | 'saved'
  | 'deferred'
  | 'reversed'
  | 'unknown';

export type DecisionLedgerOutcomeState =
  | 'as-expected'
  | 'better-than-expected'
  | 'worse-than-expected'
  | 'partially-observed'
  | 'not-observed'
  | 'invalidated-by-new-information'
  | 'user-reversed'
  | 'unknown'
  | 'expired';

export type DecisionLedgerForecastEvaluationClassification =
  | 'inside_range'
  | 'outside_range'
  | 'conservative'
  | 'unknown';

export type DecisionLedgerAuditAction =
  | 'draft_created'
  | 'safe_range_attached'
  | 'scenarios_attached'
  | 'presented'
  | 'choice_recorded'
  | 'consent_recorded'
  | 'awaiting_outcome'
  | 'outcome_resolved'
  | 'correction_added'
  | 'forecast_evaluated'
  | 'learning_disabled'
  | 'learning_removed'
  | 'cancelled'
  | 'expired'
  | 'deleted';

export type DecisionLedgerMateriality = Readonly<{
  accepted: boolean;
  ruleIds: readonly string[];
  reason: string;
  cashEffect: Money | null;
  bufferEffect: Money | null;
  daysShifted: number | null;
  affectsShortfall: boolean;
}>;

export type DecisionLedgerQuestion = Readonly<{
  text: string;
  source: DecisionLedgerQuestionSource;
  priority: DecisionLedgerPriorityType;
}>;

export type DecisionLedgerFactSnapshot = Readonly<{
  factId: string;
  label: string;
  workspaceId: WorkspaceId;
  truthClass: TrustedCoreTruthClass;
  sourceType: TrustedCoreSourceType;
  sourceRef: string | null;
  capturedAt: InstantString | null;
  confirmedAt: InstantString | null;
  expiresAt: InstantString | null;
  confidence: TrustedCoreConfidence;
  freshness: TrustedCoreFreshness;
  amount: Money | null;
  assumptions: readonly string[];
  derivedFrom: readonly string[];
  correctionOf: string | null;
  provenanceId?: ProvenanceId;
  sourceRecordIds?: readonly SourceRecordId[];
}>;

export type DecisionLedgerUnknown = Readonly<{
  id: string;
  label: string;
  severity: TrustedSafeRangeIssueSeverity;
  sourceFactIds: readonly string[];
}>;

export type DecisionLedgerContradiction = Readonly<{
  id: string;
  label: string;
  impact: 'blocks' | 'widens_range' | 'changes_recommendation';
  sourceFactIds: readonly string[];
}>;

export type DecisionLedgerAssumption = Readonly<{
  id: string;
  label: string;
  truthClass: Extract<TrustedCoreTruthClass, 'assumed' | 'estimated' | 'predicted'>;
  confidence: TrustedCoreConfidence;
  amount: Money | null;
  sourceFactIds: readonly string[];
}>;

export type DecisionLedgerSafeRangeSnapshot = Readonly<{
  forecastVersionId: ForecastId;
  provenanceId: ProvenanceId;
  calculatedAt: InstantString;
  horizonStartISO: LocalDate;
  horizonEndISO: LocalDate;
  status: TrustedSafeRangeStatus;
  reliance: TrustedSafeRangeReliance;
  confidence: TrustedCoreConfidence;
  freshness: TrustedCoreFreshness;
  currentKnownPosition: Money | null;
  knownCommittedFloor: Money | null;
  expectedSafeMin: Money | null;
  expectedSafeMax: Money | null;
  conservativeBoundary: Money | null;
  tightestPointDateISO: LocalDate | null;
  tightestPointAmount: Money | null;
  shortfall: Money | null;
  missingMaterialInfo: readonly string[];
  assumptions: readonly string[];
  sourceFactIds: readonly string[];
  canUserRelyOnAnswer: boolean;
}>;

export type DecisionLedgerForecastSnapshot = Readonly<{
  forecastVersionId: ForecastId;
  createdAt: InstantString;
  horizonStartISO: LocalDate;
  horizonEndISO: LocalDate;
  predictedTightestPoint: Money | null;
  predictedEndPosition: Money | null;
  predictedSafeMin: Money | null;
  predictedSafeMax: Money | null;
  conservativeBoundary: Money | null;
  confidence: TrustedCoreConfidence;
  sourceFactIds: readonly string[];
}>;

export type DecisionLedgerConsent = Readonly<{
  required: boolean;
  granted: boolean | null;
  capturedAt: InstantString | null;
  label: string | null;
  sourceControlId: string | null;
}>;

export type DecisionLedgerScenario = Readonly<{
  id: ScenarioId;
  label: string;
  forecastVersionId: ForecastId;
  summary: string;
  assumptionFactIds: readonly string[];
  expectedCashDelta: Money | null;
  expectedBufferDelta: Money | null;
  risk: 'low' | 'medium' | 'high' | 'unknown';
}>;

export type DecisionLedgerMove = Readonly<{
  id: string;
  label: string;
  decisionType: MaterialDecisionKind;
  reversible: boolean;
  risk: string;
  expectedCashDelta: Money | null;
  expectedBufferDelta: Money | null;
  affectedFactIds: readonly string[];
}>;

export type DecisionLedgerUserChoice = Readonly<{
  state: DecisionLedgerChoiceState;
  selectedScenarioId: ScenarioId | null;
  selectedMoveIds: readonly string[];
  recordedAt: InstantString | null;
  actor: 'user' | 'melo' | 'system';
  note: string | null;
}>;

export type DecisionLedgerOutcome = Readonly<{
  checkedAt: InstantString | null;
  state: DecisionLedgerOutcomeState;
  actualCashDelta: Money | null;
  actualBufferDelta: Money | null;
  actualSourceFactIds: readonly string[];
  note: string | null;
  forecastError: Money | null;
}>;

export type DecisionLedgerForecastEvaluation = Readonly<{
  id: string;
  evaluatedAt: InstantString;
  forecastVersionId: ForecastId;
  expected: DecisionLedgerForecastSnapshot;
  actualTightestPoint: Money | null;
  actualEndPosition: Money | null;
  error: Money | null;
  classification: DecisionLedgerForecastEvaluationClassification;
  confidence: TrustedCoreConfidence;
  note: string | null;
  sourceFactIds: readonly string[];
}>;

export type DecisionLedgerCorrection = Readonly<{
  id: string;
  correctedAt: InstantString;
  field: string;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
  reason: string;
  userCorrectionId: UserCorrectionId | null;
  recalculatesForecast: boolean;
}>;

export type DecisionLedgerLearning = Readonly<{
  permitted: boolean;
  disabledAt: InstantString | null;
  removedAt: InstantString | null;
  memoryRefs: readonly string[];
}>;

export type DecisionLedgerAuditEntry = Readonly<{
  at: InstantString;
  action: DecisionLedgerAuditAction;
  actor: 'user' | 'melo' | 'system';
  ref: string | null;
  commandId: string | null;
}>;

export type DecisionLedgerRecord = Readonly<{
  id: DecisionRecordId;
  workspaceId: WorkspaceId;
  workspaceKind: Extract<WorkspaceKind, 'personal' | 'business'>;
  decisionType: MaterialDecisionKind;
  /**
   * @deprecated Phase B compatibility alias. New code must read `decisionType`.
   */
  materialDecisionKind: MaterialDecisionKind;
  status: DecisionLedgerStatus;
  createdAt: InstantString;
  updatedAt: InstantString;
  presentedAt: InstantString | null;
  resolvedAt: InstantString | null;
  expiresAt: InstantString | null;
  question: DecisionLedgerQuestion;
  /**
   * @deprecated Phase B compatibility alias. New code must read `question.text`.
   */
  userQuestion: string;
  /**
   * @deprecated Phase B compatibility alias. New code must read `question.priority`.
   */
  userPriority: DecisionLedgerPriorityType;
  contextRoute: string;
  materiality: DecisionLedgerMateriality;
  factSnapshots: readonly DecisionLedgerFactSnapshot[];
  factRefs: readonly string[];
  truthClasses: Readonly<Record<string, TrustedCoreTruthClass>>;
  unknowns: readonly DecisionLedgerUnknown[];
  missingInformation: readonly string[];
  contradictions: readonly DecisionLedgerContradiction[];
  assumptions: readonly DecisionLedgerAssumption[];
  assumptionLabels: readonly string[];
  safeRange: DecisionLedgerSafeRangeSnapshot | null;
  forecast: DecisionLedgerForecastSnapshot | null;
  scenarios: readonly DecisionLedgerScenario[];
  chosenScenarioId: ScenarioId | null;
  forecastVersionId: ForecastId | null;
  meloExplanation: string | null;
  proposedMoves: readonly DecisionLedgerMove[];
  userChoice: DecisionLedgerUserChoice;
  consent: DecisionLedgerConsent;
  outcome: DecisionLedgerOutcome;
  forecastEvaluations: readonly DecisionLedgerForecastEvaluation[];
  corrections: readonly DecisionLedgerCorrection[];
  userCorrectionRefs: readonly UserCorrectionId[];
  learning: DecisionLedgerLearning;
  learningPermitted: boolean;
  audit: readonly DecisionLedgerAuditEntry[];
  provenanceId: ProvenanceId;
}>;

export type DecisionLedgerEntry = DecisionLedgerRecord;

export type TrustedSafeRangeSnapshot = DecisionLedgerSafeRangeSnapshot;

export const criticalJourneyIds = [
  'first_trustworthy_answer',
  'material_financial_change',
  'financial_decision',
  'pressure_and_recovery',
  'payday_and_cycle_close',
  'correction_and_recalculation',
] as const;

export type CriticalJourneyId = (typeof criticalJourneyIds)[number];

export const materialFinancialChangeTypes = [
  'new_transaction',
  'balance_correction',
  'bill_amount_change',
  'bill_date_shift',
  'income_change',
  'subscription_detected',
  'debt_payment',
  'pot_move',
  'reviewed_statement',
  'provider_stale',
  'restored_backup',
  'user_correction',
  'forecast_recalculation',
] as const;

export type MaterialFinancialChangeType = (typeof materialFinancialChangeTypes)[number];

export type ChangeCause = Readonly<{
  id: string;
  label: string;
  weight: 'primary' | 'secondary';
  sourceFactIds: readonly string[];
  amount: Money | null;
}>;

export type MaterialFinancialChange = Readonly<{
  id: string;
  workspaceId: WorkspaceId;
  occurredAt: InstantString;
  detectedAt: InstantString;
  type: MaterialFinancialChangeType;
  sourceIds: readonly string[];
  truth: TrustedCoreTruthClass;
  before?: TrustedSafeRangeSnapshot;
  after?: TrustedSafeRangeSnapshot;
  monetaryEffect?: Money;
  rangeEffect?: Readonly<{
    lowerDelta?: Money;
    upperDelta?: Money;
    conservativeBoundaryDelta?: Money;
  }>;
  causes: readonly ChangeCause[];
  affectedDecisionIds: readonly DecisionRecordId[];
  reviewRequired: boolean;
  userActionRequired: boolean;
  explanationCode: string;
}>;

export type ProvisionalAnswerInputFact = Readonly<{
  id: string;
  label: string;
  truth: TrustedCoreTruthClass;
  sourceType: TrustedCoreSourceType;
  sourceIds: readonly string[];
}>;

export type ProvisionalAnswerRecord = Readonly<{
  id: string;
  workspaceId: WorkspaceId;
  createdAt: InstantString;
  updatedAt: InstantString;
  question: string;
  enteredFacts: readonly ProvisionalAnswerInputFact[];
  safeRange: TrustedSafeRangeSnapshot;
  truth: TrustedCoreTruthClass;
  confidence: TrustedCoreConfidence;
  reliance: TrustedSafeRangeReliance;
  assumptions: readonly string[];
  missingMaterialInfo: readonly string[];
  contradictions: readonly string[];
  nextBestInput: string | null;
  savedToSetup: boolean;
  decisionLedgerEntryId: DecisionRecordId | null;
}>;

export type CorrectionImpactRecord = Readonly<{
  id: string;
  workspaceId: WorkspaceId;
  correctedAt: InstantString;
  correctedBy: 'user' | 'melo' | 'system';
  subject: Readonly<{
    kind:
      | 'balance'
      | 'transaction'
      | 'bill'
      | 'income'
      | 'debt'
      | 'subscription'
      | 'date'
      | 'recurrence'
      | 'truth'
      | 'source'
      | 'forecast_assumption';
    id: string;
  }>;
  field: string;
  original: string | number | boolean | null;
  corrected: string | number | boolean | null;
  sourceIds: readonly string[];
  before?: TrustedSafeRangeSnapshot;
  after?: TrustedSafeRangeSnapshot;
  materialChangeId: string | null;
  affectedDecisionIds: readonly DecisionRecordId[];
  contradictionState: 'none' | 'resolved' | 'introduced' | 'still_present';
  futureBehaviour:
    | 'unchanged'
    | 'remember_correction'
    | 'ask_before_reusing'
    | 'block_until_reviewed';
  reversedByCorrectionId: string | null;
}>;

export type CriticalJourneyContinuityRecord = Readonly<{
  id: string;
  workspaceId: WorkspaceId;
  journeyId: CriticalJourneyId;
  status: 'started' | 'previewed' | 'confirmed' | 'completed' | 'blocked' | 'abandoned';
  startedAt: InstantString;
  updatedAt: InstantString;
  currentRoute: string;
  pendingAction: string | null;
  blockerCodes: readonly string[];
  decisionLedgerEntryIds: readonly DecisionRecordId[];
  materialChangeIds: readonly string[];
  correctionImpactIds: readonly string[];
  lastSafeRange?: TrustedSafeRangeSnapshot;
}>;

export const trustedCoreResponsibilities = [
  'account-model',
  'ledger',
  'recurring-obligations',
  'forecast-engine',
  'truth-classification',
  'safe-range-result',
  'decision-ledger',
  'review-queue',
  'persistence',
  'corrections',
  'melo-tools',
  'workspace-boundaries',
  'normalised-sql-storage',
  'appstate-snapshot-compatibility',
  'navigation-transition',
  'evidence-storage',
] as const;

export type TrustedCoreResponsibility = (typeof trustedCoreResponsibilities)[number];

export type TrustedCoreOwnerLayer =
  | '@folio/domain'
  | '@folio/storage'
  | '@folio/finance-engine'
  | '@folio/calendar-engine'
  | '@folio/business-workspace'
  | 'apps/mobile/src/folio/store.ts'
  | 'apps/mobile/src/folio/lib'
  | 'apps/mobile/src/local'
  | 'apps/mobile/src/folio/shell/FolioShell.tsx';

export type TrustedCoreOwnerRecord = Readonly<{
  canonicalOwner: TrustedCoreOwnerLayer;
  runtimeAdapter: TrustedCoreOwnerLayer | null;
  compatibilityAuthority: 'normalised_sql' | 'appstate_snapshot' | 'dual_read_appstate_wins';
  migrationPhase: 'phase_b' | 'phase_c' | 'phase_d' | 'phase_e' | 'phase_f';
  userVisibleBehaviourChangesInPhaseB: false;
}>;

export const trustedCoreResponsibilityOwners = {
  'account-model': {
    canonicalOwner: '@folio/domain',
    runtimeAdapter: 'apps/mobile/src/folio/store.ts',
    compatibilityAuthority: 'dual_read_appstate_wins',
    migrationPhase: 'phase_c',
    userVisibleBehaviourChangesInPhaseB: false,
  },
  ledger: {
    canonicalOwner: '@folio/storage',
    runtimeAdapter: 'apps/mobile/src/folio/store.ts',
    compatibilityAuthority: 'dual_read_appstate_wins',
    migrationPhase: 'phase_d',
    userVisibleBehaviourChangesInPhaseB: false,
  },
  'recurring-obligations': {
    canonicalOwner: '@folio/domain',
    runtimeAdapter: 'apps/mobile/src/folio/lib',
    compatibilityAuthority: 'dual_read_appstate_wins',
    migrationPhase: 'phase_c',
    userVisibleBehaviourChangesInPhaseB: false,
  },
  'forecast-engine': {
    canonicalOwner: '@folio/finance-engine',
    runtimeAdapter: 'apps/mobile/src/local',
    compatibilityAuthority: 'dual_read_appstate_wins',
    migrationPhase: 'phase_c',
    userVisibleBehaviourChangesInPhaseB: false,
  },
  'truth-classification': {
    canonicalOwner: '@folio/domain',
    runtimeAdapter: 'apps/mobile/src/folio/lib',
    compatibilityAuthority: 'appstate_snapshot',
    migrationPhase: 'phase_c',
    userVisibleBehaviourChangesInPhaseB: false,
  },
  'safe-range-result': {
    canonicalOwner: '@folio/domain',
    runtimeAdapter: 'apps/mobile/src/local',
    compatibilityAuthority: 'dual_read_appstate_wins',
    migrationPhase: 'phase_c',
    userVisibleBehaviourChangesInPhaseB: false,
  },
  'decision-ledger': {
    canonicalOwner: '@folio/domain',
    runtimeAdapter: 'apps/mobile/src/folio/lib',
    compatibilityAuthority: 'appstate_snapshot',
    migrationPhase: 'phase_d',
    userVisibleBehaviourChangesInPhaseB: false,
  },
  'review-queue': {
    canonicalOwner: '@folio/domain',
    runtimeAdapter: 'apps/mobile/src/folio/store.ts',
    compatibilityAuthority: 'dual_read_appstate_wins',
    migrationPhase: 'phase_c',
    userVisibleBehaviourChangesInPhaseB: false,
  },
  persistence: {
    canonicalOwner: '@folio/storage',
    runtimeAdapter: 'apps/mobile/src/folio/lib',
    compatibilityAuthority: 'appstate_snapshot',
    migrationPhase: 'phase_f',
    userVisibleBehaviourChangesInPhaseB: false,
  },
  corrections: {
    canonicalOwner: '@folio/domain',
    runtimeAdapter: 'apps/mobile/src/folio/store.ts',
    compatibilityAuthority: 'dual_read_appstate_wins',
    migrationPhase: 'phase_d',
    userVisibleBehaviourChangesInPhaseB: false,
  },
  'melo-tools': {
    canonicalOwner: '@folio/domain',
    runtimeAdapter: 'apps/mobile/src/folio/store.ts',
    compatibilityAuthority: 'appstate_snapshot',
    migrationPhase: 'phase_d',
    userVisibleBehaviourChangesInPhaseB: false,
  },
  'workspace-boundaries': {
    canonicalOwner: '@folio/domain',
    runtimeAdapter: 'apps/mobile/src/folio/store.ts',
    compatibilityAuthority: 'dual_read_appstate_wins',
    migrationPhase: 'phase_b',
    userVisibleBehaviourChangesInPhaseB: false,
  },
  'normalised-sql-storage': {
    canonicalOwner: '@folio/storage',
    runtimeAdapter: 'apps/mobile/src/local',
    compatibilityAuthority: 'normalised_sql',
    migrationPhase: 'phase_d',
    userVisibleBehaviourChangesInPhaseB: false,
  },
  'appstate-snapshot-compatibility': {
    canonicalOwner: 'apps/mobile/src/folio/store.ts',
    runtimeAdapter: 'apps/mobile/src/folio/lib',
    compatibilityAuthority: 'appstate_snapshot',
    migrationPhase: 'phase_f',
    userVisibleBehaviourChangesInPhaseB: false,
  },
  'navigation-transition': {
    canonicalOwner: 'apps/mobile/src/folio/shell/FolioShell.tsx',
    runtimeAdapter: null,
    compatibilityAuthority: 'appstate_snapshot',
    migrationPhase: 'phase_e',
    userVisibleBehaviourChangesInPhaseB: false,
  },
  'evidence-storage': {
    canonicalOwner: '@folio/storage',
    runtimeAdapter: 'apps/mobile/src/folio/store.ts',
    compatibilityAuthority: 'dual_read_appstate_wins',
    migrationPhase: 'phase_d',
    userVisibleBehaviourChangesInPhaseB: false,
  },
} as const satisfies Readonly<Record<TrustedCoreResponsibility, TrustedCoreOwnerRecord>>;

export const trustedCoreMigrationPlan = [
  {
    id: 'truth-provenance-v1',
    sourceAuthority: 'AppState snapshot plus existing source/import metadata',
    targetAuthority: '@folio/domain TrustedCoreFactRef and @folio/storage fact tables',
    phase: 'phase_c',
    userVisibleBehaviour: 'unchanged',
    rollback: 'ignore derived truth records and keep AppState snapshot authoritative',
    destructive: false,
  },
  {
    id: 'safe-range-result-v1',
    sourceAuthority: 'legacy Safe Zone and finance-engine forecast outputs',
    targetAuthority: '@folio/domain TrustedSafeRangeResult returned by Phase C adapter',
    phase: 'phase_c',
    userVisibleBehaviour: 'unchanged until Phase C UI is approved',
    rollback: 'route Today back to legacy Safe Zone adapter',
    destructive: false,
  },
  {
    id: 'decision-ledger-v1',
    sourceAuthority: 'existing review, correction, Melo confirmation and audit fragments',
    targetAuthority: '@folio/domain DecisionLedgerRecord and storage-backed ledger table',
    phase: 'phase_d',
    userVisibleBehaviour: 'unchanged until receipt surfaces are approved',
    rollback: 'disable decision-ledger writer and retain existing action paths',
    destructive: false,
  },
  {
    id: 'critical-journeys-v1',
    sourceAuthority: 'AppState Safe Range, Decision Ledger, review and correction records',
    targetAuthority:
      '@folio/domain MaterialFinancialChange, ProvisionalAnswerRecord and CorrectionImpactRecord',
    phase: 'phase_e',
    userVisibleBehaviour: 'critical Personal journeys explain source, change and recalculation',
    rollback: 'ignore Phase E journey records and keep Safe Range/Decision Ledger paths active',
    destructive: false,
  },
] as const;

export type TrustedCoreMigrationPlanItem = (typeof trustedCoreMigrationPlan)[number];

export type WorkspaceBoundaryCheck = Readonly<{
  activeWorkspaceId: WorkspaceId;
  subjectWorkspaceId: WorkspaceId;
  allowed: boolean;
  reason: 'same_workspace' | 'cross_workspace_blocked';
}>;

export function evaluateWorkspaceBoundary(input: {
  activeWorkspaceId: WorkspaceId;
  subjectWorkspaceId: WorkspaceId;
}): WorkspaceBoundaryCheck {
  const allowed = input.activeWorkspaceId === input.subjectWorkspaceId;
  return {
    activeWorkspaceId: input.activeWorkspaceId,
    subjectWorkspaceId: input.subjectWorkspaceId,
    allowed,
    reason: allowed ? 'same_workspace' : 'cross_workspace_blocked',
  };
}

export type TrustedCoreForecastIntegrationInput = Readonly<{
  workspaceId: WorkspaceId;
  asOf: LocalDate;
  accountIds: readonly AccountId[];
  transactionIds: readonly TransactionId[];
  expectationIds: readonly ExpectationId[];
  commitmentIds: readonly CommitmentId[];
  eventIds: readonly EventId[];
  planIds: readonly PlanId[];
  scenarioIds: readonly ScenarioId[];
  factRefs: readonly TrustedCoreFactRef[];
}>;
