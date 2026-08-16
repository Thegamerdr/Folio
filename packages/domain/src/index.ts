export type Brand<TValue, TBrand extends string> = TValue & { readonly __brand: TBrand };

export type EntityId<TKind extends string> = Brand<string, `${TKind}Id`>;
export type CurrencyCode = Brand<string, 'CurrencyCode'>;
export type LocalDate = Brand<string, 'LocalDate'>;
export type LocalTime = Brand<string, 'LocalTime'>;
export type LocalDateTime = Brand<string, 'LocalDateTime'>;
export type TimeZoneId = Brand<string, 'TimeZoneId'>;
export type InstantString = Brand<string, 'InstantString'>;
export type DataVersion = Brand<string, 'DataVersion'>;
export type WorkspaceId = EntityId<'Workspace'>;
export type AccountId = EntityId<'Account'>;
export type BalanceObservationId = EntityId<'BalanceObservation'>;
export type CurrentBalanceId = EntityId<'CurrentBalance'>;
export type BalanceAdjustmentId = EntityId<'BalanceAdjustment'>;
export type AvailablePositionSnapshotId = EntityId<'AvailablePositionSnapshot'>;
export type SourceRecordId = EntityId<'SourceRecord'>;
export type ImportDraftId = EntityId<'ImportDraft'>;
export type ParsedRowId = EntityId<'ParsedRow'>;
export type ImportedClaimId = EntityId<'ImportedClaim'>;
export type UserCorrectionId = EntityId<'UserCorrection'>;
export type TransactionId = EntityId<'Transaction'>;
export type TransactionSplitId = EntityId<'TransactionSplit'>;
export type TransferLinkId = EntityId<'TransferLink'>;
export type EventId = EntityId<'Event'>;
export type CommitmentId = EntityId<'Commitment'>;
export type ExpectationId = EntityId<'Expectation'>;
export type PlannerItemId = EntityId<'PlannerItem'>;
export type PlanId = EntityId<'Plan'>;
export type PlanRuleId = EntityId<'PlanRule'>;
export type PlanImpactId = EntityId<'PlanImpact'>;
export type ScenarioId = EntityId<'Scenario'>;
export type ForecastId = EntityId<'Forecast'>;
export type DecisionRecordId = EntityId<'DecisionRecord'>;
export type DocumentId = EntityId<'Document'>;
export type DocumentAttachmentId = EntityId<'DocumentAttachment'>;
export type CalendarItemId = EntityId<'CalendarItem'>;
export type TimelineEntryId = EntityId<'TimelineEntry'>;
export type ProvenanceId = EntityId<'Provenance'>;
export type MeloMemoryId = EntityId<'MeloMemory'>;
export type MeloProposalId = EntityId<'MeloProposal'>;
export type AuditLogId = EntityId<'AuditLog'>;
export type PotId = EntityId<'Pot'>;
export type PotLedgerEntryId = EntityId<'PotLedgerEntry'>;
export type SubscriptionId = EntityId<'Subscription'>;
export type SubscriptionPreferenceId = EntityId<'SubscriptionPreference'>;
export type CycleRecordId = EntityId<'CycleRecord'>;
export type DebtId = EntityId<'Debt'>;
export type FinancialContextId = EntityId<'FinancialContext'>;
export type IncomeScheduleId = EntityId<'IncomeSchedule'>;
export type TransactionIntelligenceStateId = EntityId<'TransactionIntelligenceState'>;
export type CompanionRuntimeStateId = EntityId<'CompanionRuntimeState'>;

export type AuthorityState =
  | 'confirmed'
  | 'user-confirmed'
  | 'provider-reported'
  | 'imported-claim'
  | 'inferred'
  | 'estimated'
  | 'hypothetical'
  | 'superseded'
  | 'reversed';

export const canonicalAuthorityStates = [
  'confirmed',
  'user-confirmed',
  'provider-reported',
  'imported-claim',
  'inferred',
  'estimated',
  'hypothetical',
  'superseded',
  'reversed',
] as const satisfies readonly AuthorityState[];

export type ReviewState =
  | 'not-required'
  | 'needs-review'
  | 'ready-for-user-confirmation'
  | 'user-confirmed'
  | 'dismissed'
  | 'superseded';

export type UserConfirmationState =
  | 'not-requested'
  | 'requested'
  | 'confirmed'
  | 'corrected'
  | 'rejected';

export type Money = Readonly<{
  minorUnits: number;
  currency: CurrencyCode;
}>;

export type EntityVersion = Readonly<{
  revision: number;
  dataVersion: DataVersion;
}>;

export type WorkspaceKind = 'personal' | 'business';

export type Workspace = Readonly<{
  id: WorkspaceId;
  kind: WorkspaceKind;
  name: string;
  baseCurrency: CurrencyCode;
  jurisdiction: string;
  timeZone: TimeZoneId;
  version: EntityVersion;
}>;

export type AccountKind = 'bank' | 'cash' | 'savings' | 'credit' | 'loan';
export type AccountState = 'active' | 'closed' | 'archived';
export type AccountProjectionRole =
  | 'source'
  | 'synthesized-default'
  | 'unresolved-reference'
  | 'reconciliation'
  | 'canonical-baseline';

export type Account = Readonly<{
  id: AccountId;
  workspaceId: WorkspaceId;
  name: string;
  kind: AccountKind;
  currency: CurrencyCode;
  state: AccountState;
  version: EntityVersion;
  /** Exact identifier used by the source application before canonical ID namespacing. */
  sourceAccountId?: string;
  createdAt?: InstantString;
  projectionRole?: AccountProjectionRole;
}>;

export type BalanceReconciliationState = 'confirmed' | 'provisional' | 'unreconciled';
export type BalanceSourceKind =
  | 'user-entered'
  | 'imported-statement'
  | 'provider-reported'
  | 'calculated'
  | 'migration';
export type BalanceConfidence = 'rough' | 'statement-derived' | 'corrected' | 'sample';
export type BalanceSourceVariant =
  | 'user-entered'
  | 'statement'
  | 'pdf-derived'
  | 'ocr-derived'
  | 'corrected'
  | 'sample';
export type BalanceObservationKind =
  | 'opening-balance'
  | 'current-balance'
  | 'provider-balance'
  | 'imported-statement-balance'
  | 'calculated-balance'
  | 'balance-correction'
  | 'balance-adjustment'
  | 'reconciled-balance';

export type BalanceObservation = Readonly<{
  id: BalanceObservationId;
  workspaceId: WorkspaceId;
  accountId: AccountId;
  observedOn: LocalDate;
  balance: Money;
  source: string;
  sourceKind: BalanceSourceKind;
  observationKind: BalanceObservationKind;
  authorityState: AuthorityState;
  reviewState: ReviewState;
  reconciliationState: BalanceReconciliationState;
  version: EntityVersion;
  observedAt?: InstantString;
  sourceConfidence?: BalanceConfidence;
  sourceVariant?: BalanceSourceVariant;
  sourceRecordId?: SourceRecordId;
  provenanceId?: ProvenanceId;
  replaces?: BalanceObservationId;
}>;

export type BalanceSource = Readonly<{
  kind: BalanceSourceKind;
  label: string;
  authorityState: AuthorityState;
  reviewState: ReviewState;
  sourceRecordId?: SourceRecordId;
  provenanceId?: ProvenanceId;
}>;

export type BalanceProvenance = Readonly<{
  provenanceId: ProvenanceId;
  sourceRecordIds: readonly SourceRecordId[];
  authorityState: AuthorityState;
  reviewState: ReviewState;
}>;

export type OpeningBalance = BalanceObservation & Readonly<{ observationKind: 'opening-balance' }>;
export type ReconciledBalance = BalanceObservation &
  Readonly<{ observationKind: 'reconciled-balance'; reconciliationState: 'confirmed' }>;

export type CurrentBalance = Readonly<{
  id: CurrentBalanceId;
  workspaceId: WorkspaceId;
  accountId: AccountId;
  asOf: LocalDate;
  balance: Money;
  sourceKind: BalanceSourceKind;
  authorityState: AuthorityState;
  reviewState: ReviewState;
  sourceObservationId: BalanceObservationId;
  updatedAt: InstantString;
  version: EntityVersion;
  provenanceId?: ProvenanceId;
  calculatedFromTransactionIds?: readonly TransactionId[];
}>;

export type BalanceAdjustmentKind = 'correction' | 'adjustment' | 'reconciliation';

export type BalanceAdjustment = Readonly<{
  id: BalanceAdjustmentId;
  workspaceId: WorkspaceId;
  accountId: AccountId;
  kind: BalanceAdjustmentKind;
  localDate: LocalDate;
  amount: Money;
  reason: string;
  authorityState: AuthorityState;
  reviewState: ReviewState;
  version: EntityVersion;
  sourceObservationId?: BalanceObservationId;
  resultingObservationId?: BalanceObservationId;
  decisionId?: DecisionRecordId;
  auditLogId?: AuditLogId;
  sourceRecordId?: SourceRecordId;
  provenanceId?: ProvenanceId;
}>;

export type BalanceCorrection = BalanceAdjustment & Readonly<{ kind: 'correction' }>;

export type AvailablePositionSnapshot = Readonly<{
  id: AvailablePositionSnapshotId;
  workspaceId: WorkspaceId;
  asOf: LocalDate;
  currency: CurrencyCode;
  openingBalance: Money;
  availableBalance: Money;
  protectedFloor: Money;
  actualNet: Money;
  expectedNet: Money;
  currentBalanceIds: readonly CurrentBalanceId[];
  balanceObservationIds: readonly BalanceObservationId[];
  sourceIds: readonly string[];
  authorityState: AuthorityState;
  reviewState: ReviewState;
  createdAt: InstantString;
  version: EntityVersion;
  provenanceId?: ProvenanceId;
}>;

export type TransactionStatus = 'pending' | 'posted' | 'reversed' | 'void';
export type TransactionCertainty = AuthorityState;
export type TransactionReviewStatus = 'proposed' | 'needs_review' | 'accepted' | 'rejected';
export type TransactionSourceKind =
  | 'manual'
  | 'melo'
  | 'csv'
  | 'text'
  | 'ofx'
  | 'qif'
  | 'pdf'
  | 'ocr'
  | 'open_banking'
  | 'migration'
  | 'sync';

export type TransactionSplit = Readonly<{
  id: TransactionSplitId;
  amount: Money;
  label: string;
  categoryId?: string;
}>;

export type FinancialTransaction = Readonly<{
  id: TransactionId;
  workspaceId: WorkspaceId;
  accountId: AccountId;
  status: TransactionStatus;
  authorityState: AuthorityState;
  amount: Money;
  localDate: LocalDate;
  sourceKind: TransactionSourceKind;
  certainty: TransactionCertainty;
  reviewStatus: TransactionReviewStatus;
  splits: readonly TransactionSplit[];
  version: EntityVersion;
  bookedAt?: InstantString;
  description?: string;
  reference?: string;
  sourceRecordId?: SourceRecordId;
  provenanceId?: ProvenanceId;
  eventId?: EventId;
  transferLink?: TransferLinkId;
  replaces?: TransactionId;
  replacedBy?: TransactionId;
  fulfils?: ExpectationId;
  reversalOf?: TransactionId;
  /** Exact source-application identity retained across canonical namespacing. */
  sourceTransactionId?: string;
  sourceEvidenceId?: string;
  externalId?: string;
  connectionId?: string;
  sourceOrdinal?: number;
}>;

export type TransferLink = Readonly<{
  id: TransferLinkId;
  workspaceId: WorkspaceId;
  debitTransactionId: TransactionId;
  creditTransactionId: TransactionId;
  amount: Money;
}>;

export type ExpectationCertainty = Exclude<AuthorityState, 'superseded' | 'reversed'>;

export type FinancialExpectation = Readonly<{
  id: ExpectationId;
  workspaceId: WorkspaceId;
  localDate: LocalDate;
  amount: Money;
  authorityState: AuthorityState;
  certainty: ExpectationCertainty;
  fulfilled: boolean;
  version: EntityVersion;
  accountId?: AccountId;
  reference?: string;
  sourceRecordId?: SourceRecordId;
  provenanceId?: ProvenanceId;
  commitmentId?: CommitmentId;
  bookedAt?: InstantString;
  description?: string;
  categoryId?: string;
  sourceKind?: TransactionSourceKind;
  sourceTransactionId?: string;
  sourceEvidenceId?: string;
  externalId?: string;
  connectionId?: string;
  sourceOrdinal?: number;
}>;

export type SourceRecordKind =
  | 'manual-entry'
  | 'statement-row'
  | 'document-text'
  | 'open-banking-row'
  | 'system-derived'
  | 'user-correction';

export type SourceRecord = Readonly<{
  id: SourceRecordId;
  workspaceId: WorkspaceId;
  kind: SourceRecordKind;
  authorityState: AuthorityState;
  label: string;
  capturedAt: InstantString;
  sourceHash: string;
  version: EntityVersion;
  externalId?: string;
  documentId?: DocumentId;
  reviewState?: ReviewState;
  rejectionReason?: ImportRejectionReason;
  nonFinancial?: boolean;
}>;

export type ImportDraftReviewState =
  | 'needs-review'
  | 'ready-for-user-confirmation'
  | 'user-confirmed'
  | 'dismissed';

export type ImportRejectionReason =
  | 'duplicate'
  | 'wrong-workspace'
  | 'transfer-internal'
  | 'irrelevant-document'
  | 'parser-error'
  | 'not-mine'
  | 'other';

export type ParserIssueSeverity = 'info' | 'review' | 'blocker';

export type ParserIssue = Readonly<{
  code: string;
  message: string;
  severity: ParserIssueSeverity;
}>;

export type ImportDraft = Readonly<{
  id: ImportDraftId;
  workspaceId: WorkspaceId;
  sourceRecordId: SourceRecordId;
  proposedTransactionId: TransactionId;
  parsedRowId?: ParsedRowId;
  importedClaimId?: ImportedClaimId;
  authorityState: Extract<AuthorityState, 'imported-claim' | 'inferred' | 'estimated'>;
  reviewState: ImportDraftReviewState;
  userConfirmationState: UserConfirmationState;
  parserIssues: readonly ParserIssue[];
  provenanceId: ProvenanceId;
  version: EntityVersion;
  rejectedAt?: InstantString;
  rejectionReason?: ImportRejectionReason;
  nonFinancial?: boolean;
}>;

export type ParsedRow = Readonly<{
  id: ParsedRowId;
  workspaceId: WorkspaceId;
  sourceRecordId: SourceRecordId;
  rowIndex: number;
  rawText: string;
  parsedAt: InstantString;
  parserName: string;
  parserIssues: readonly ParserIssue[];
  authorityState: Extract<AuthorityState, 'imported-claim' | 'estimated'>;
  reviewState: ReviewState;
  version: EntityVersion;
  provenanceId?: ProvenanceId;
  rejectionReason?: ImportRejectionReason;
  nonFinancial?: boolean;
}>;

export type ImportedClaimState =
  | 'needs-review'
  | 'accepted'
  | 'rejected'
  | 'excluded'
  | 'superseded';
export type ImportSourceQuality = 'source-clear' | 'needs-review' | 'unsupported';

export type ImportedClaim = Readonly<{
  id: ImportedClaimId;
  workspaceId: WorkspaceId;
  sourceRecordId: SourceRecordId;
  originalText: string;
  interpretedTitle: string;
  amount?: Money;
  localDate?: LocalDate;
  state: ImportedClaimState;
  sourceQuality: ImportSourceQuality;
  authorityState: Extract<
    AuthorityState,
    'imported-claim' | 'inferred' | 'estimated' | 'user-confirmed'
  >;
  reviewState: ReviewState;
  userConfirmationState: UserConfirmationState;
  version: EntityVersion;
  importDraftId?: ImportDraftId;
  parsedRowId?: ParsedRowId;
  proposedTransactionId?: TransactionId;
  acceptedTransactionId?: TransactionId;
  eventId?: EventId;
  parserIssues?: readonly ParserIssue[];
  provenanceId?: ProvenanceId;
  rejectedAt?: InstantString;
  rejectionReason?: ImportRejectionReason;
  nonFinancial?: boolean;
}>;

export type UserCorrectionKind =
  | 'import-row-edit'
  | 'import-row-dismissal'
  | 'import-row-restore'
  | 'melo-suggestion-review'
  | 'manual-correction';

export type UserCorrection = Readonly<{
  id: UserCorrectionId;
  workspaceId: WorkspaceId;
  kind: UserCorrectionKind;
  subjectId: string;
  originalValue: string;
  correctedValue: string;
  correctedAt: InstantString;
  authorityState: Extract<AuthorityState, 'user-confirmed'>;
  reviewState: Extract<ReviewState, 'user-confirmed' | 'dismissed'>;
  version: EntityVersion;
  reason?: string;
  sourceRecordId?: SourceRecordId;
  provenanceId?: ProvenanceId;
  decisionId?: DecisionRecordId;
  auditLogId?: AuditLogId;
}>;

export type EventKind =
  | 'income'
  | 'payment'
  | 'transfer'
  | 'charge'
  | 'refund'
  | 'life-change'
  | 'business-activity'
  | 'planner';

export type Event = Readonly<{
  id: EventId;
  workspaceId: WorkspaceId;
  kind: EventKind;
  title: string;
  localDate: LocalDate;
  authorityState: AuthorityState;
  version: EntityVersion;
  amount?: Money;
  transactionIds: readonly TransactionId[];
  expectationIds: readonly ExpectationId[];
  sourceRecordIds: readonly SourceRecordId[];
  provenanceId?: ProvenanceId;
}>;

export type CommitmentKind = 'bill' | 'debt-payment' | 'saving' | 'tax' | 'business' | 'custom';

export type Commitment = Readonly<{
  id: CommitmentId;
  workspaceId: WorkspaceId;
  kind: CommitmentKind;
  title: string;
  amount: Money;
  dueDate: LocalDate;
  authorityState: AuthorityState;
  reviewState: ReviewState;
  version: EntityVersion;
  accountId?: AccountId;
  sourceRecordId?: SourceRecordId;
  provenanceId?: ProvenanceId;
}>;

export type PlannerItemKind = 'task' | 'reminder' | 'review' | 'decision';
export type PlannerItemStatus = 'open' | 'completed' | 'dismissed' | 'superseded';

export type PlannerItem = Readonly<{
  id: PlannerItemId;
  workspaceId: WorkspaceId;
  kind: PlannerItemKind;
  title: string;
  dueDate: LocalDate;
  status: PlannerItemStatus;
  authorityState: AuthorityState;
  version: EntityVersion;
  dueTime?: LocalTime;
  linkedPlanId?: PlanId;
  linkedEventId?: EventId;
  provenanceId?: ProvenanceId;
}>;

export type PlanStatus = 'active' | 'paused' | 'completed' | 'superseded';
export type PlanKind =
  | 'protect-commitment'
  | 'build-buffer'
  | 'save-for-goal'
  | 'reduce-debt'
  | 'custom';
export type PlanAccountabilityStyle = 'gentle' | 'balanced' | 'accountability';
export type PlanRuleMode = 'flexible' | 'strict';
export type PlanRuleReviewCondition =
  | 'unexpected-change'
  | 'balance-drop'
  | 'protected-floor-risk'
  | 'deadline-risk'
  | 'missed-contribution';
export type PlanImpactDirection = 'ahead' | 'behind' | 'unchanged' | 'needs-review';

export type Plan = Readonly<{
  id: PlanId;
  workspaceId: WorkspaceId;
  title: string;
  status: PlanStatus;
  authorityState: AuthorityState;
  createdAt: InstantString;
  version: EntityVersion;
  kind?: PlanKind;
  userIntention?: string;
  targetAmount?: Money;
  targetDate?: LocalDate;
  targetRule?: string;
  protectedAmount?: Money;
  commitmentIds: readonly CommitmentId[];
  expectationIds?: readonly ExpectationId[];
  transactionIds?: readonly TransactionId[];
  eventIds?: readonly EventId[];
  ruleIds?: readonly PlanRuleId[];
  impactIds?: readonly PlanImpactId[];
  scenarioIds: readonly ScenarioId[];
  reviewState?: ReviewState;
  accountabilityStyle?: PlanAccountabilityStyle;
  decisionIds?: readonly DecisionRecordId[];
  auditLogIds?: readonly AuditLogId[];
  sourceRecordId?: SourceRecordId;
  provenanceId?: ProvenanceId;
  /** Exact AppState identity/order retained while the shipping planning lens migrates. */
  sourcePlanId?: string;
  sourceOrdinal?: number;
  sourceAddedAt?: string;
  savedAmount?: Money;
  weeklyContribution?: Money;
}>;

export type PlanRule = Readonly<{
  id: PlanRuleId;
  workspaceId: WorkspaceId;
  planId: PlanId;
  title: string;
  mode: PlanRuleMode;
  authorityState: AuthorityState;
  reviewState: ReviewState;
  createdAt: InstantString;
  version: EntityVersion;
  minimumBuffer?: Money;
  protectedAmount?: Money;
  targetContribution?: Money;
  deadline?: LocalDate;
  pauseAllowed: boolean;
  adjustAllowed: boolean;
  rebaseAllowed: boolean;
  reviewRequiredWhen: readonly PlanRuleReviewCondition[];
  sourceRecordId?: SourceRecordId;
  provenanceId?: ProvenanceId;
}>;

export type PlanImpact = Readonly<{
  id: PlanImpactId;
  workspaceId: WorkspaceId;
  planId: PlanId;
  asOf: LocalDate;
  summary: string;
  changedRecordIds: readonly string[];
  direction: PlanImpactDirection;
  newProjectedOutcome: string;
  protectedAmount: Money;
  needsReview: boolean;
  reviewReasons: readonly string[];
  optionIds: readonly string[];
  scenarioIds: readonly ScenarioId[];
  authorityState: Extract<AuthorityState, 'inferred' | 'estimated' | 'hypothetical'>;
  reviewState: ReviewState;
  createdAt: InstantString;
  version: EntityVersion;
  previousProjectedDate?: LocalDate;
  newProjectedDate?: LocalDate;
  previousProjectedAmount?: Money;
  newProjectedAmount?: Money;
  sourceRecordId?: SourceRecordId;
  provenanceId?: ProvenanceId;
}>;

export type ScenarioStatus = 'draft' | 'previewed' | 'accepted' | 'discarded';

export type Scenario = Readonly<{
  id: ScenarioId;
  workspaceId: WorkspaceId;
  title: string;
  status: ScenarioStatus;
  authorityState: Extract<AuthorityState, 'hypothetical' | 'superseded'>;
  createdAt: InstantString;
  version: EntityVersion;
  assumptionIds: readonly ExpectationId[];
  affectedPlanIds: readonly PlanId[];
  provenanceId?: ProvenanceId;
}>;

export type Forecast = Readonly<{
  id: ForecastId;
  workspaceId: WorkspaceId;
  asOf: LocalDate;
  authorityState: Extract<AuthorityState, 'estimated' | 'hypothetical'>;
  createdAt: InstantString;
  sourceIds: readonly (TransactionId | ExpectationId | CommitmentId | ScenarioId)[];
  version: EntityVersion;
  provenanceId?: ProvenanceId;
}>;

// A Pot is a durable savings container the user puts money aside into (a goal with a weekly
// contribution intention). It is not a single money event — it accrues over time — so it lives as
// its own first-class entity rather than on transactions[].
export type Pot = Readonly<{
  id: PotId;
  workspaceId: WorkspaceId;
  sourcePotId?: string;
  sourceOrdinal?: number;
  name: string;
  goal: Money;
  saved: Money;
  perWeek: Money;
  accent: boolean;
  cadence?:
    | Readonly<{ kind: 'after-payday' }>
    | Readonly<{ kind: 'weekly'; weekday: number }>
    | Readonly<{ kind: 'monthly'; dayOfMonth: number }>
    | Readonly<{ kind: 'custom'; nextDate: string }>;
  allowNegative?: boolean;
  version: EntityVersion;
  provenanceId?: ProvenanceId;
}>;

export type PotLedgerEntry = Readonly<{
  id: PotLedgerEntryId;
  workspaceId: WorkspaceId;
  potId: PotId;
  sourceEntryId?: string;
  sourcePotId?: string;
  sourceOrdinal?: number;
  sourceOccurredAt?: string;
  occurredAt: InstantString;
  kind: 'deposit' | 'borrow' | 'repay' | 'withdraw';
  amount: Money;
  source: string;
  version: EntityVersion;
  provenanceId?: ProvenanceId;
}>;

// A Subscription is a recurring charge the user is carrying. Folio tracks how much value the user
// is getting from it (renewal timing, usage) so the user can decide to keep, pause, or cancel.
// How often the charge recurs. cost is per-cadence (a weekly sub's cost is the weekly amount), so
// downstream models must normalize to a per-month figure before summing or comparing across subs.
export type SubscriptionCadence = 'weekly' | 'fortnightly' | 'monthly' | 'yearly' | 'custom-days';

export type Subscription = Readonly<{
  id: SubscriptionId;
  workspaceId: WorkspaceId;
  sourceName?: string;
  sourceOrdinal?: number;
  name: string;
  cost: Money;
  cadence: SubscriptionCadence;
  nextRenewalDaysAway: number;
  nextRenewalISO?: string;
  renewalPeriodDays?: number;
  lastUsedDaysAgo: number;
  usesPerMonth: number;
  trialEndsInDays?: number;
  paused: boolean;
  pausedUntil?: LocalDate;
  autoResume?: 'prompt' | 'silent';
  pauseReason?: string;
  pausedAt?: LocalDate;
  /** Present only for a recoverably cancelled subscription archive row. */
  cancelledAt?: LocalDate;
  version: EntityVersion;
  provenanceId?: ProvenanceId;
}>;

export type SubscriptionPreference = Readonly<{
  id: SubscriptionPreferenceId;
  workspaceId: WorkspaceId;
  sourceName: string;
  paused?: boolean;
  overrideDays?: number;
  version: EntityVersion;
}>;

// A CycleRecord is a closed pay-cycle the user has finished — durable history, not a forecast.
// Insights reads across these to show how the user has been doing cycle over cycle.
export type CycleRecord = Readonly<{
  id: CycleRecordId;
  workspaceId: WorkspaceId;
  sourceOrdinal?: number;
  sourceClosedAt?: string;
  closedAt: InstantString;
  label: string;
  spare: Money;
  tightPoint: Money;
  setAside: Money;
  version: EntityVersion;
  note?: string;
  reconstructed?: true;
  provenanceId?: ProvenanceId;
}>;

export type Debt = Readonly<{
  id: DebtId;
  workspaceId: WorkspaceId;
  sourceDebtId?: string;
  sourceOrdinal?: number;
  name: string;
  kind: 'loan' | 'card' | 'bnpl' | 'other';
  balance: Money;
  apr: number;
  minimumPayment: Money;
  dueDayOfMonth: number;
  sourceAddedAt?: string;
  addedAt: InstantString;
  linkedSourceAccountId?: string;
  version: EntityVersion;
  provenanceId?: ProvenanceId;
}>;

export type FinancialMode =
  | 'survival'
  | 'stability'
  | 'growth'
  | 'debt'
  | 'irregular'
  | 'household'
  | 'planning'
  | 'optimizer'
  | 'reset'
  | 'lowVis';

/** One lossless workspace-scoped profile for route-affecting financial settings. These values are
 * cohesive user declarations rather than ledger events, but they must share the canonical
 * generation and workspace boundary because they materially change payday, safety-floor and lens
 * calculations throughout the shipping application. */
export type FinancialContext = Readonly<{
  id: FinancialContextId;
  workspaceId: WorkspaceId;
  onboarding: Readonly<{
    done: boolean;
    name: string;
    payday: number;
    monthlyIncome: Money;
  }>;
  nextYouNote: string;
  tightPointGoal: Money | null;
  droppedTransactionCount: number;
  moneyMode: FinancialMode;
  bufferAmount: Money;
  modeExtras: Readonly<Partial<Record<FinancialMode, Money>>>;
  household: Readonly<{
    partnerName: string;
    defaultShare: number;
    subShareOverrides: Readonly<Record<string, number>>;
  }>;
  spendHold?: Readonly<{
    start: LocalDate;
    end: LocalDate;
    dailyCap: Money;
    setAt: InstantString;
    breachedDates: readonly LocalDate[];
  }> | null;
  whatIfHolds?: readonly Readonly<{
    id: string;
    amount: Money;
    recurrence: 'once' | 'weekly' | 'monthly';
    addedAt: InstantString;
    label?: string;
  }>[];
  /** Lossless encrypted bridge for the workspace-scoped Business operations aggregate while its
   * ledgers are promoted to dedicated canonical collections. The JSON is produced and read only by
   * the typed Business workspace normalizer; UI code never consumes this field directly. */
  businessOperationsJson?: string;
  version: EntityVersion;
}>;

export type IncomeCadence =
  | 'monthly'
  | 'weekly'
  | 'fortnightly'
  | 'four-weekly'
  | 'last-working-day';

export type IncomeSchedule = Readonly<{
  id: IncomeScheduleId;
  workspaceId: WorkspaceId;
  sourceIncomeId: string;
  sourceOrdinal: number;
  label: string;
  cadence: IncomeCadence;
  amount: Money;
  source: 'onboarding' | 'inferred' | 'manual';
  version: EntityVersion;
  dayOfMonth?: number;
  anchorDate?: LocalDate;
}>;

export type TransactionCorrectionField = 'merchant' | 'amount' | 'when' | 'category' | 'note';

export type TransactionCorrectionState = Readonly<{
  id?: string;
  sourceTransactionId: string;
  field: TransactionCorrectionField;
  before: string | number | undefined;
  after: string | number | undefined;
  at: string;
  by: 'user' | 'melo';
}>;

export type DriftCooldownState = Readonly<{
  merchant: string;
  at: string;
}>;

export type MerchantCategoryMemoryState = Readonly<{
  category: string;
  correctedAt: string;
  hits: number;
  pendingCategory?: string;
  pendingCount?: number;
}>;

export type StatementImportState = Readonly<{
  id: string;
  source: 'paste' | 'pdf' | 'image' | 'csv' | 'txt' | 'manual' | 'unknown';
  rowCount: number;
  atISO: string;
  accountId?: string;
  filename?: string;
  closingBalanceMinor?: number;
  sourceEvidenceId?: string;
}>;

export type EvidenceDocumentState = Readonly<{
  id: string;
  filename: string;
  mediaType: string;
  byteSize: number;
  addedAtISO: string;
  sourceType: 'document' | 'image' | 'camera';
  extractionStatus: 'read' | 'unreadable' | 'not-requested';
  storageState: 'encrypted-device-vault';
  linkedTransactionIds?: readonly string[];
}>;

export type TimelineEventState = Readonly<{
  id: string;
  at: string;
  kind: 'sub-paused' | 'sub-resumed' | 'review-ignored';
  subject: string;
  note?: string;
}>;

export type ReviewQueueItemState = Readonly<{
  id: string;
  source: 'paste' | 'pdf' | 'image' | 'csv' | 'txt' | 'manual' | 'bank';
  sourceEvidenceId?: string;
  merchant: string;
  amount: number;
  date?: string;
  accountId?: string;
  externalId?: string;
  bankConnectionId?: string;
  hint?: string;
  addedAt: string;
  category?: string;
  rememberedCategory?: true;
}>;

/** Workspace-scoped source-preserving state used by transaction intake and evidence workflows.
 * These are durable user decisions and recovery metadata, not posted ledger events. Keeping them
 * together prevents a canonical recovery from resurrecting dismissed proposals, losing correction
 * history, or stranding an encrypted original while still preserving every nested field exactly. */
export type TransactionIntelligenceState = Readonly<{
  id: TransactionIntelligenceStateId;
  workspaceId: WorkspaceId;
  corrections: readonly TransactionCorrectionState[];
  ignoredReviewSignatures: readonly string[];
  ignoredBankExternalIds: readonly string[];
  dismissedIncomeSignals: readonly string[];
  dismissedBillSignals: readonly string[];
  dismissedDriftSignals: readonly DriftCooldownState[];
  dismissedAnnualSignals: readonly string[];
  merchantCategories: Readonly<Record<string, MerchantCategoryMemoryState>>;
  statementImports: readonly StatementImportState[];
  evidenceDocuments: readonly EvidenceDocumentState[];
  timelineEvents: readonly TimelineEventState[];
  reviewQueue: readonly ReviewQueueItemState[];
  reviewQueueSpillover: readonly ReviewQueueItemState[];
  version: EntityVersion;
}>;

export type StatementReadCandidateState = Readonly<{
  id: string;
  sourceEvidenceId?: string;
  source: 'csv' | 'paste' | 'pdf' | 'photo';
  kind: 'income' | 'spend' | 'bill' | 'subscription' | 'debt-payment' | 'transfer' | 'unknown';
  merchant: string;
  amount: number;
  date?: string;
  category?: string;
  confidence: 'high' | 'medium' | 'low';
  note?: string;
}>;

export type ReaderClosingBalanceState = Readonly<{
  amount: number;
  asOfISO: string;
  openingAmount?: number;
  statedTotalDebits?: number;
  statedTotalCredits?: number;
}>;

export type StatementReadCacheState = Readonly<{
  candidates: readonly StatementReadCandidateState[];
  closingBalance: ReaderClosingBalanceState | null;
  at: string;
}>;

export type TinyWinState = Readonly<{
  id: string;
  kind:
    | 'danger-date-pushed'
    | 'first-10-saved'
    | 'afford-streak-3'
    | 'afford-streak-7'
    | 'bill-week-survived'
    | 'first-green-after-red'
    | 'first-pot-funded'
    | 'first-sub-caught'
    | 'first-postcard-shared'
    | 'first-sub-cancelled'
    | 'first-pot-fully-funded'
    | 'four-week-green-streak';
  awardedAt: string;
  message: string;
}>;

/** Durable companion preferences, entitlement state and bounded local read cache. This is one
 * recovery boundary because every field is workspace-local companion runtime state; none of it is
 * a money fact and none may be silently reset merely because the exact AppState copy is damaged. */
export type CompanionRuntimeState = Readonly<{
  id: CompanionRuntimeStateId;
  workspaceId: WorkspaceId;
  aiReads: Readonly<{ monthKey: string; used: number }>;
  aiReadCache: Readonly<Record<string, StatementReadCacheState>>;
  whatChangedSeenISO: string | null;
  lens: Readonly<{
    plusUnlocked: boolean;
    proUnlocked: boolean;
    trialCycleId: string | null;
    trialEndedCycleId: string | null;
    trialEndAcknowledged: boolean;
  }>;
  melo: Readonly<{
    quietMode: boolean;
    wardrobe: readonly string[];
    tone: 'calm' | 'honest' | 'dry' | 'coachy';
    soundEnabled?: boolean;
  }>;
  tinyWins: readonly TinyWinState[];
  meloPrimerSeen?: boolean;
  meloPrimerBeat?: number;
  meloPrimerSeenAt?: InstantString | null;
  lastOpenedAt?: InstantString | null;
  oneMoveHistory?: readonly Readonly<{
    key: string;
    shownAt: LocalDate;
    tappedAt?: InstantString;
  }>[];
  meloMoves?: readonly Readonly<{
    id: string;
    createdAt: InstantString;
    headline: string;
    kind: 'potAdd' | 'potBorrow' | 'hold' | 'wait' | 'sweep';
    amount?: number;
    targetId?: string;
    status: 'suggested' | 'accepted' | 'dismissed' | 'expired';
    outcome?: Readonly<{
      resolvedAt: InstantString;
      pathDelta: number;
      tightPointDelta: number;
    }>;
    sourceKey?: string;
    acceptedAt?: InstantString;
    dismissedAt?: InstantString;
    baselinePathSpare?: number;
    baselineTightPoint?: number;
  }>[];
  meloDismissLog?: readonly Readonly<{
    kind: string;
    reason: 'not-now' | 'wrong-amount' | 'wrong-pot' | 'another-plan' | 'just-no' | null;
    at: InstantString;
    amount?: number;
    potId?: string;
  }>[];
  meloMemoryThread?: readonly Readonly<{
    id: string;
    at: InstantString;
    kind: 'moment' | 'whisper' | 'postcard' | 'move' | 'preference' | 'cadence';
    text: string;
    editable: boolean;
    source: 'observed' | 'toldByYou';
  }>[];
  meloForgottenMemoryIds?: readonly string[];
  version: EntityVersion;
}>;

export type DecisionKind =
  | 'confirm-import'
  | 'correct-record'
  | 'accept-plan'
  | 'accept-scenario'
  | 'dismiss-proposal'
  | 'delete-data';

export type DecisionRecord = Readonly<{
  id: DecisionRecordId;
  workspaceId: WorkspaceId;
  kind: DecisionKind;
  decidedAt: InstantString;
  actor: 'user';
  summary: string;
  affectedIds: readonly string[];
  version: EntityVersion;
  provenanceId?: ProvenanceId;
}>;

export type DocumentKind = 'statement' | 'receipt' | 'invoice' | 'tax' | 'other';

export type DocumentRecord = Readonly<{
  id: DocumentId;
  workspaceId: WorkspaceId;
  kind: DocumentKind;
  filename: string;
  capturedAt: InstantString;
  authorityState: AuthorityState;
  reviewState?: ReviewState;
  sourceHash: string;
  version: EntityVersion;
  provenanceId?: ProvenanceId;
  sourceRecordId?: SourceRecordId;
  attachmentIds?: readonly DocumentAttachmentId[];
}>;

export type DocumentAttachmentTargetKind =
  | 'source-record'
  | 'import-draft'
  | 'transaction'
  | 'event'
  | 'plan'
  | 'decision';

export type DocumentAttachment = Readonly<{
  id: DocumentAttachmentId;
  workspaceId: WorkspaceId;
  documentId: DocumentId;
  targetKind: DocumentAttachmentTargetKind;
  targetId: string;
  attachedAt: InstantString;
  authorityState: AuthorityState;
  reviewState: ReviewState;
  version: EntityVersion;
  sourceRecordId?: SourceRecordId;
  provenanceId?: ProvenanceId;
}>;

export type CalendarItemKind = 'money-event' | 'task' | 'commitment' | 'plan-check-in';

export type CalendarItem = Readonly<{
  id: CalendarItemId;
  workspaceId: WorkspaceId;
  kind: CalendarItemKind;
  title: string;
  localDate: LocalDate;
  authorityState: AuthorityState;
  version: EntityVersion;
  localTime?: LocalTime;
  eventId?: EventId;
  commitmentId?: CommitmentId;
  planId?: PlanId;
  planRuleId?: PlanRuleId;
  planImpactId?: PlanImpactId;
  scenarioId?: ScenarioId;
  plannerItemId?: PlannerItemId;
  provenanceId?: ProvenanceId;
  /** Lossless source fields for user-authored AppState calendar rows. */
  sourceCalendarEventId?: string;
  sourceOrdinal?: number;
  sourceKind?: 'in' | 'out' | 'review' | 'deadline';
  sourceTime?: string;
  sourceNote?: string;
  sourceAmount?: Money;
  sourceReminderOffsetMinutes?: number;
}>;

export type TimelineEntryKind = 'fact' | 'expectation' | 'plan' | 'decision' | 'system';

export type TimelineEntry = Readonly<{
  id: TimelineEntryId;
  workspaceId: WorkspaceId;
  kind: TimelineEntryKind;
  title: string;
  localDate: LocalDate;
  authorityState: AuthorityState;
  subjectId: string;
  version: EntityVersion;
  provenanceId?: ProvenanceId;
}>;

export type ProvenanceRelationshipKind =
  | 'represents'
  | 'evidences'
  | 'settles'
  | 'groups'
  | 'affects'
  | 'derived_from'
  | 'projected_as'
  | 'supersedes'
  | 'transfers_to';

export type ProvenanceLink = Readonly<{
  relationship: ProvenanceRelationshipKind;
  fromId: string;
  toId: string;
}>;

export type Provenance = Readonly<{
  id: ProvenanceId;
  workspaceId: WorkspaceId;
  authorityState: AuthorityState;
  sourceRecordIds: readonly SourceRecordId[];
  links: readonly ProvenanceLink[];
  createdAt: InstantString;
  version: EntityVersion;
}>;

export type MeloMemory = Readonly<{
  id: MeloMemoryId;
  workspaceId: WorkspaceId;
  authorityState: AuthorityState;
  reviewState: ReviewState;
  value: string;
  createdAt: InstantString;
  version: EntityVersion;
  provenanceId?: ProvenanceId;
  deletedAt?: InstantString;
}>;

export type MeloProposalStatus = 'draft' | 'needs-review' | 'accepted' | 'rejected' | 'committed';

export type MeloProposalRecord = Readonly<{
  id: MeloProposalId;
  workspaceId: WorkspaceId;
  title: string;
  status: MeloProposalStatus;
  authorityState: Extract<AuthorityState, 'inferred' | 'estimated' | 'hypothetical'>;
  createdAt: InstantString;
  proposedCommand: string;
  canWriteDirectly: false;
  version: EntityVersion;
  provenanceId?: ProvenanceId;
}>;

export type AuditLogEntry = Readonly<{
  id: AuditLogId;
  workspaceId: WorkspaceId;
  actor: 'user' | 'system' | 'import' | 'sync' | 'melo';
  action: string;
  occurredAt: InstantString;
  reversible: boolean;
  version: EntityVersion;
  subjectId?: string;
  provenanceId?: ProvenanceId;
}>;

export type CurrentFinancialTruth = Readonly<{
  transactionIds: readonly TransactionId[];
  expectationIds: readonly ExpectationId[];
}>;

export type ActualExpectationReconciliation = Readonly<{
  countedTransactionId: TransactionId;
  supersededExpectationId: ExpectationId;
  variance: Money;
  questionType: 'matched' | 'recurring_amount_variance';
}>;

type MoneyInput = Readonly<{ minorUnits: number; currency: string | CurrencyCode }>;

type VersionInput = Readonly<{
  revision?: number;
  dataVersion?: string | DataVersion;
}>;

const internalIdPattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;
const localDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const localTimePattern = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function createCurrencyCode(input: string): CurrencyCode {
  const normalized = input.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error(`Invalid ISO 4217 currency code: ${input}`);
  }
  return normalized as CurrencyCode;
}

export function createMoney(input: MoneyInput): Money {
  assertSafeMinorUnits(input.minorUnits, 'Money minorUnits');

  return {
    minorUnits: input.minorUnits,
    currency:
      typeof input.currency === 'string' ? createCurrencyCode(input.currency) : input.currency,
  };
}

export function addMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  const minorUnits = left.minorUnits + right.minorUnits;
  assertSafeMinorUnits(minorUnits, 'Money addition result');
  return createMoney({ minorUnits, currency: left.currency });
}

export function subtractMoney(left: Money, right: Money): Money {
  return addMoney(left, negateMoney(right));
}

export function negateMoney(value: Money): Money {
  const minorUnits = -value.minorUnits;
  assertSafeMinorUnits(minorUnits, 'Money negation result');
  return createMoney({ minorUnits, currency: value.currency });
}

export function sumMoney(values: readonly Money[], currency: string | CurrencyCode): Money {
  return values.reduce(
    (total, value) => addMoney(total, value),
    createMoney({ minorUnits: 0, currency }),
  );
}

export function compareMoney(left: Money, right: Money): number {
  assertSameCurrency(left, right);
  if (left.minorUnits === right.minorUnits) return 0;
  return left.minorUnits < right.minorUnits ? -1 : 1;
}

export function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new Error(
      `Currency mismatch: ${left.currency} cannot be combined with ${right.currency}.`,
    );
  }
}

export function createLocalDate(input: string): LocalDate {
  const match = localDatePattern.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid local date: ${input}`);
  }

  const yearText = match[1];
  const monthText = match[2];
  const dayText = match[3];
  if (yearText === undefined || monthText === undefined || dayText === undefined) {
    throw new Error(`Invalid local date: ${input}`);
  }

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1 || month < 1 || month > 12) {
    throw new Error(`Invalid local date: ${input}`);
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) {
    throw new Error(`Invalid local date: ${input}`);
  }

  return `${yearText}-${monthText}-${dayText}` as LocalDate;
}

export function compareLocalDate(left: string | LocalDate, right: string | LocalDate): number {
  const normalizedLeft = createLocalDate(String(left));
  const normalizedRight = createLocalDate(String(right));
  return normalizedLeft.localeCompare(normalizedRight);
}

export function addDaysToLocalDate(date: string | LocalDate, days: number): LocalDate {
  if (!Number.isInteger(days)) {
    throw new Error('Day offset must be an integer.');
  }

  const normalized = createLocalDate(String(date));
  const match = localDatePattern.exec(normalized);
  if (!match) throw new Error(`Invalid local date: ${date}`);
  const yearText = match[1];
  const monthText = match[2];
  const dayText = match[3];
  if (yearText === undefined || monthText === undefined || dayText === undefined) {
    throw new Error(`Invalid local date: ${date}`);
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const timestamp = Date.UTC(year, month - 1, day + days);
  return createLocalDate(new Date(timestamp).toISOString().slice(0, 10));
}

export function createLocalTime(input: string): LocalTime {
  const match = localTimePattern.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid local time: ${input}`);
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] === undefined ? 0 : Number(match[3]);
  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error(`Invalid local time: ${input}`);
  }

  return `${match[1]}:${match[2]}:${String(second).padStart(2, '0')}` as LocalTime;
}

export function createLocalDateTime(input: string): LocalDateTime {
  const [date, time, extra] = input.trim().split('T');
  if (date === undefined || time === undefined || extra !== undefined) {
    throw new Error(`Invalid local date-time: ${input}`);
  }

  return `${createLocalDate(date)}T${createLocalTime(time)}` as LocalDateTime;
}

export function createTimeZoneId(input: string): TimeZoneId {
  const normalized = input.trim();
  if (normalized.length === 0) {
    throw new Error('Time zone ID is required.');
  }

  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: normalized }).format(new Date(0));
  } catch {
    throw new Error(`Invalid time zone ID: ${input}`);
  }

  return normalized as TimeZoneId;
}

/** Convert an instant to the calendar date observed in an explicit IANA time zone. */
export function localDateFromInstant(instant: Date | string, timeZone: TimeZoneId): LocalDate {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('Invalid instant for local date conversion.');
  }

  // Revalidate at the runtime boundary even though callers normally hold a branded value. This
  // keeps restored/cast data from silently falling back to the host time zone.
  const normalizedTimeZone = createTimeZoneId(String(timeZone));
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: normalizedTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: 'year' | 'month' | 'day'): string | undefined =>
    parts.find((candidate) => candidate.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error('Unable to derive a local date from the instant.');
  }

  return createLocalDate(`${year}-${month}-${day}`);
}

export function createInstantString(input: string): InstantString {
  const normalized = input.trim();
  const timestamp = Date.parse(normalized);
  if (!normalized.endsWith('Z') || Number.isNaN(timestamp)) {
    throw new Error(`Invalid UTC instant: ${input}`);
  }
  return new Date(timestamp).toISOString() as InstantString;
}

export function createDataVersion(input: string): DataVersion {
  const normalized = input.trim();
  if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(normalized)) {
    throw new Error('Data versions must be stable non-empty identifiers.');
  }
  return normalized as DataVersion;
}

export function createEntityVersion(input: VersionInput = {}): EntityVersion {
  const revision = input.revision ?? 1;
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error('Entity revision must be a positive safe integer.');
  }

  const dataVersion = input.dataVersion ?? `revision:${revision}`;
  return {
    revision,
    dataVersion: typeof dataVersion === 'string' ? createDataVersion(dataVersion) : dataVersion,
  };
}

export function nextEntityVersion(current: EntityVersion, dataVersion?: string): EntityVersion {
  const nextRevision = current.revision + 1;
  if (!Number.isSafeInteger(nextRevision)) {
    throw new Error('Entity revision overflow.');
  }
  return dataVersion === undefined
    ? createEntityVersion({ revision: nextRevision })
    : createEntityVersion({ revision: nextRevision, dataVersion });
}

export function createWorkspaceId(input: string): WorkspaceId {
  return createPrefixedId(input, 'workspace') as WorkspaceId;
}

export function createAccountId(input: string): AccountId {
  return createPrefixedId(input, 'account') as AccountId;
}

export function createBalanceObservationId(input: string): BalanceObservationId {
  return createPrefixedId(input, 'balance') as BalanceObservationId;
}

export function createCurrentBalanceId(input: string): CurrentBalanceId {
  return createPrefixedId(input, 'currentbalance') as CurrentBalanceId;
}

export function createBalanceAdjustmentId(input: string): BalanceAdjustmentId {
  return createPrefixedId(input, 'balanceadjustment') as BalanceAdjustmentId;
}

export function createAvailablePositionSnapshotId(input: string): AvailablePositionSnapshotId {
  return createPrefixedId(input, 'position') as AvailablePositionSnapshotId;
}

export function createSourceRecordId(input: string): SourceRecordId {
  return createPrefixedId(input, 'source') as SourceRecordId;
}

export function createImportDraftId(input: string): ImportDraftId {
  return createPrefixedId(input, 'importdraft') as ImportDraftId;
}

export function createParsedRowId(input: string): ParsedRowId {
  return createPrefixedId(input, 'parsedrow') as ParsedRowId;
}

export function createImportedClaimId(input: string): ImportedClaimId {
  return createPrefixedId(input, 'importedclaim') as ImportedClaimId;
}

export function createUserCorrectionId(input: string): UserCorrectionId {
  return createPrefixedId(input, 'correction') as UserCorrectionId;
}

export function createTransactionId(input: string): TransactionId {
  return createPrefixedId(input, 'transaction') as TransactionId;
}

export function createTransactionSplitId(input: string): TransactionSplitId {
  return createPrefixedId(input, 'split') as TransactionSplitId;
}

export function createTransferLinkId(input: string): TransferLinkId {
  return createPrefixedId(input, 'transfer') as TransferLinkId;
}

export function createEventId(input: string): EventId {
  return createPrefixedId(input, 'event') as EventId;
}

export function createCommitmentId(input: string): CommitmentId {
  return createPrefixedId(input, 'commitment') as CommitmentId;
}

export function createExpectationId(input: string): ExpectationId {
  return createPrefixedId(input, 'expectation') as ExpectationId;
}

export function createPlannerItemId(input: string): PlannerItemId {
  return createPrefixedId(input, 'planner') as PlannerItemId;
}

export function createPlanId(input: string): PlanId {
  return createPrefixedId(input, 'plan') as PlanId;
}

export function createPlanRuleId(input: string): PlanRuleId {
  return createPrefixedId(input, 'planrule') as PlanRuleId;
}

export function createPlanImpactId(input: string): PlanImpactId {
  return createPrefixedId(input, 'planimpact') as PlanImpactId;
}

export function createScenarioId(input: string): ScenarioId {
  return createPrefixedId(input, 'scenario') as ScenarioId;
}

export function createForecastId(input: string): ForecastId {
  return createPrefixedId(input, 'forecast') as ForecastId;
}

export function createDecisionRecordId(input: string): DecisionRecordId {
  return createPrefixedId(input, 'decision') as DecisionRecordId;
}

export function createDocumentId(input: string): DocumentId {
  return createPrefixedId(input, 'document') as DocumentId;
}

export function createDocumentAttachmentId(input: string): DocumentAttachmentId {
  return createPrefixedId(input, 'documentattachment') as DocumentAttachmentId;
}

export function createCalendarItemId(input: string): CalendarItemId {
  return createPrefixedId(input, 'calendar') as CalendarItemId;
}

export function createTimelineEntryId(input: string): TimelineEntryId {
  return createPrefixedId(input, 'timeline') as TimelineEntryId;
}

export function createProvenanceId(input: string): ProvenanceId {
  return createPrefixedId(input, 'provenance') as ProvenanceId;
}

export function createMeloMemoryId(input: string): MeloMemoryId {
  return createPrefixedId(input, 'memory') as MeloMemoryId;
}

export function createMeloProposalId(input: string): MeloProposalId {
  return createPrefixedId(input, 'proposal') as MeloProposalId;
}

export function createAuditLogId(input: string): AuditLogId {
  return createPrefixedId(input, 'audit') as AuditLogId;
}

export function createPotId(input: string): PotId {
  return createPrefixedId(input, 'pot') as PotId;
}

export function createPotLedgerEntryId(input: string): PotLedgerEntryId {
  return createPrefixedId(input, 'potledger') as PotLedgerEntryId;
}

export function createSubscriptionId(input: string): SubscriptionId {
  return createPrefixedId(input, 'subscription') as SubscriptionId;
}

export function createSubscriptionPreferenceId(input: string): SubscriptionPreferenceId {
  return createPrefixedId(input, 'subpref') as SubscriptionPreferenceId;
}

export function createCycleRecordId(input: string): CycleRecordId {
  return createPrefixedId(input, 'cycle') as CycleRecordId;
}

export function createDebtId(input: string): DebtId {
  return createPrefixedId(input, 'debt') as DebtId;
}

export function createFinancialContextId(input: string): FinancialContextId {
  return createPrefixedId(input, 'financialcontext') as FinancialContextId;
}

export function createIncomeScheduleId(input: string): IncomeScheduleId {
  return createPrefixedId(input, 'incomeschedule') as IncomeScheduleId;
}

export function createTransactionIntelligenceStateId(
  input: string,
): TransactionIntelligenceStateId {
  return createPrefixedId(input, 'transactionintelligence') as TransactionIntelligenceStateId;
}

export function createCompanionRuntimeStateId(input: string): CompanionRuntimeStateId {
  return createPrefixedId(input, 'companionruntime') as CompanionRuntimeStateId;
}

export function createWorkspace(input: {
  id: string | WorkspaceId;
  kind: WorkspaceKind;
  name: string;
  baseCurrency: string | CurrencyCode;
  jurisdiction: string;
  timeZone: string | TimeZoneId;
  version?: VersionInput;
}): Workspace {
  const name = input.name.trim();
  const jurisdiction = input.jurisdiction.trim().toUpperCase();
  if (name.length === 0 || name.length > 120) {
    throw new Error('Workspace name must be between 1 and 120 characters.');
  }
  if (!/^[A-Z]{2,12}$/.test(jurisdiction)) {
    throw new Error('Workspace jurisdiction must be a stable jurisdiction code.');
  }

  return {
    id: typeof input.id === 'string' ? createWorkspaceId(input.id) : input.id,
    kind: input.kind,
    name,
    baseCurrency:
      typeof input.baseCurrency === 'string'
        ? createCurrencyCode(input.baseCurrency)
        : input.baseCurrency,
    jurisdiction,
    timeZone:
      typeof input.timeZone === 'string' ? createTimeZoneId(input.timeZone) : input.timeZone,
    version: createEntityVersion(input.version),
  };
}

export function createAccount(input: {
  id: string | AccountId;
  workspaceId: string | WorkspaceId;
  name: string;
  kind: AccountKind;
  currency: string | CurrencyCode;
  state?: AccountState;
  version?: VersionInput;
  sourceAccountId?: string;
  createdAt?: string | InstantString;
  projectionRole?: AccountProjectionRole;
}): Account {
  const name = input.name.trim();
  if (name.length === 0 || name.length > 160) {
    throw new Error('Account name must be between 1 and 160 characters.');
  }

  const sourceAccountId = input.sourceAccountId?.trim();
  if (
    sourceAccountId !== undefined &&
    (sourceAccountId.length === 0 || sourceAccountId.length > 256)
  ) {
    throw new Error('Source account ID must be between 1 and 256 characters.');
  }

  return {
    id: typeof input.id === 'string' ? createAccountId(input.id) : input.id,
    workspaceId:
      typeof input.workspaceId === 'string'
        ? createWorkspaceId(input.workspaceId)
        : input.workspaceId,
    name,
    kind: input.kind,
    currency:
      typeof input.currency === 'string' ? createCurrencyCode(input.currency) : input.currency,
    state: input.state ?? 'active',
    version: createEntityVersion(input.version),
    ...(sourceAccountId === undefined ? {} : { sourceAccountId }),
    ...(input.createdAt === undefined
      ? {}
      : {
          createdAt:
            typeof input.createdAt === 'string'
              ? createInstantString(input.createdAt)
              : input.createdAt,
        }),
    ...(input.projectionRole === undefined ? {} : { projectionRole: input.projectionRole }),
  };
}

export function createBalanceObservation(input: {
  id: string | BalanceObservationId;
  workspaceId: string | WorkspaceId;
  accountId: string | AccountId;
  observedOn: string | LocalDate;
  balance: MoneyInput | Money;
  source: string;
  sourceKind?: BalanceSourceKind;
  observationKind?: BalanceObservationKind;
  authorityState?: AuthorityState;
  reviewState?: ReviewState;
  reconciliationState?: BalanceReconciliationState;
  version?: VersionInput;
  observedAt?: string | InstantString;
  sourceConfidence?: BalanceConfidence;
  sourceVariant?: BalanceSourceVariant;
  sourceRecordId?: string | SourceRecordId;
  provenanceId?: string | ProvenanceId;
  replaces?: string | BalanceObservationId;
}): BalanceObservation {
  const source = input.source.trim();
  if (source.length === 0) {
    throw new Error('Balance observation source is required.');
  }
  const sourceKind = input.sourceKind ?? 'user-entered';
  const authorityState = input.authorityState ?? authorityStateForBalanceSource(sourceKind);
  const reviewState = input.reviewState ?? reviewStateForBalanceAuthority(authorityState);

  return {
    id: typeof input.id === 'string' ? createBalanceObservationId(input.id) : input.id,
    workspaceId:
      typeof input.workspaceId === 'string'
        ? createWorkspaceId(input.workspaceId)
        : input.workspaceId,
    accountId:
      typeof input.accountId === 'string' ? createAccountId(input.accountId) : input.accountId,
    observedOn:
      typeof input.observedOn === 'string' ? createLocalDate(input.observedOn) : input.observedOn,
    balance: createMoney(input.balance),
    source,
    sourceKind,
    observationKind: input.observationKind ?? 'current-balance',
    authorityState,
    reviewState,
    reconciliationState: input.reconciliationState ?? 'confirmed',
    version: createEntityVersion(input.version),
    ...(input.observedAt === undefined
      ? {}
      : {
          observedAt:
            typeof input.observedAt === 'string'
              ? createInstantString(input.observedAt)
              : input.observedAt,
        }),
    ...(input.sourceConfidence === undefined ? {} : { sourceConfidence: input.sourceConfidence }),
    ...(input.sourceVariant === undefined ? {} : { sourceVariant: input.sourceVariant }),
    ...(input.sourceRecordId === undefined
      ? {}
      : {
          sourceRecordId:
            typeof input.sourceRecordId === 'string'
              ? createSourceRecordId(input.sourceRecordId)
              : input.sourceRecordId,
        }),
    ...(input.provenanceId === undefined
      ? {}
      : {
          provenanceId:
            typeof input.provenanceId === 'string'
              ? createProvenanceId(input.provenanceId)
              : input.provenanceId,
        }),
    ...(input.replaces === undefined
      ? {}
      : {
          replaces:
            typeof input.replaces === 'string'
              ? createBalanceObservationId(input.replaces)
              : input.replaces,
        }),
  };
}

export function createCurrentBalance(input: {
  id: string | CurrentBalanceId;
  workspaceId: string | WorkspaceId;
  accountId: string | AccountId;
  asOf: string | LocalDate;
  balance: MoneyInput | Money;
  sourceKind: BalanceSourceKind;
  authorityState: AuthorityState;
  reviewState: ReviewState;
  sourceObservationId: string | BalanceObservationId;
  updatedAt: string | InstantString;
  version?: VersionInput;
  provenanceId?: string | ProvenanceId;
  calculatedFromTransactionIds?: readonly (string | TransactionId)[];
}): CurrentBalance {
  return {
    id: typeof input.id === 'string' ? createCurrentBalanceId(input.id) : input.id,
    workspaceId:
      typeof input.workspaceId === 'string'
        ? createWorkspaceId(input.workspaceId)
        : input.workspaceId,
    accountId:
      typeof input.accountId === 'string' ? createAccountId(input.accountId) : input.accountId,
    asOf: typeof input.asOf === 'string' ? createLocalDate(input.asOf) : input.asOf,
    balance: createMoney(input.balance),
    sourceKind: input.sourceKind,
    authorityState: input.authorityState,
    reviewState: input.reviewState,
    sourceObservationId:
      typeof input.sourceObservationId === 'string'
        ? createBalanceObservationId(input.sourceObservationId)
        : input.sourceObservationId,
    updatedAt:
      typeof input.updatedAt === 'string' ? createInstantString(input.updatedAt) : input.updatedAt,
    version: createEntityVersion(input.version),
    ...(input.provenanceId === undefined
      ? {}
      : {
          provenanceId:
            typeof input.provenanceId === 'string'
              ? createProvenanceId(input.provenanceId)
              : input.provenanceId,
        }),
    ...(input.calculatedFromTransactionIds === undefined
      ? {}
      : {
          calculatedFromTransactionIds: input.calculatedFromTransactionIds.map((id) =>
            typeof id === 'string' ? createTransactionId(id) : id,
          ),
        }),
  };
}

export function createBalanceAdjustment(input: {
  id: string | BalanceAdjustmentId;
  workspaceId: string | WorkspaceId;
  accountId: string | AccountId;
  kind: BalanceAdjustmentKind;
  localDate: string | LocalDate;
  amount: MoneyInput | Money;
  reason: string;
  authorityState?: AuthorityState;
  reviewState?: ReviewState;
  version?: VersionInput;
  sourceObservationId?: string | BalanceObservationId;
  resultingObservationId?: string | BalanceObservationId;
  decisionId?: string | DecisionRecordId;
  auditLogId?: string | AuditLogId;
  sourceRecordId?: string | SourceRecordId;
  provenanceId?: string | ProvenanceId;
}): BalanceAdjustment {
  const reason = input.reason.trim();
  if (reason.length === 0) {
    throw new Error('Balance adjustment reason is required.');
  }

  return {
    id: typeof input.id === 'string' ? createBalanceAdjustmentId(input.id) : input.id,
    workspaceId:
      typeof input.workspaceId === 'string'
        ? createWorkspaceId(input.workspaceId)
        : input.workspaceId,
    accountId:
      typeof input.accountId === 'string' ? createAccountId(input.accountId) : input.accountId,
    kind: input.kind,
    localDate:
      typeof input.localDate === 'string' ? createLocalDate(input.localDate) : input.localDate,
    amount: createMoney(input.amount),
    reason,
    authorityState: input.authorityState ?? 'user-confirmed',
    reviewState: input.reviewState ?? 'user-confirmed',
    version: createEntityVersion(input.version),
    ...(input.sourceObservationId === undefined
      ? {}
      : {
          sourceObservationId:
            typeof input.sourceObservationId === 'string'
              ? createBalanceObservationId(input.sourceObservationId)
              : input.sourceObservationId,
        }),
    ...(input.resultingObservationId === undefined
      ? {}
      : {
          resultingObservationId:
            typeof input.resultingObservationId === 'string'
              ? createBalanceObservationId(input.resultingObservationId)
              : input.resultingObservationId,
        }),
    ...(input.decisionId === undefined
      ? {}
      : {
          decisionId:
            typeof input.decisionId === 'string'
              ? createDecisionRecordId(input.decisionId)
              : input.decisionId,
        }),
    ...(input.auditLogId === undefined
      ? {}
      : {
          auditLogId:
            typeof input.auditLogId === 'string'
              ? createAuditLogId(input.auditLogId)
              : input.auditLogId,
        }),
    ...(input.sourceRecordId === undefined
      ? {}
      : {
          sourceRecordId:
            typeof input.sourceRecordId === 'string'
              ? createSourceRecordId(input.sourceRecordId)
              : input.sourceRecordId,
        }),
    ...(input.provenanceId === undefined
      ? {}
      : {
          provenanceId:
            typeof input.provenanceId === 'string'
              ? createProvenanceId(input.provenanceId)
              : input.provenanceId,
        }),
  };
}

export function createAvailablePositionSnapshot(input: {
  id: string | AvailablePositionSnapshotId;
  workspaceId: string | WorkspaceId;
  asOf: string | LocalDate;
  currency: string | CurrencyCode;
  openingBalance: MoneyInput | Money;
  availableBalance: MoneyInput | Money;
  protectedFloor: MoneyInput | Money;
  actualNet: MoneyInput | Money;
  expectedNet: MoneyInput | Money;
  currentBalanceIds: readonly (string | CurrentBalanceId)[];
  balanceObservationIds: readonly (string | BalanceObservationId)[];
  sourceIds: readonly string[];
  authorityState?: AuthorityState;
  reviewState?: ReviewState;
  createdAt: string | InstantString;
  version?: VersionInput;
  provenanceId?: string | ProvenanceId;
}): AvailablePositionSnapshot {
  return {
    id: typeof input.id === 'string' ? createAvailablePositionSnapshotId(input.id) : input.id,
    workspaceId:
      typeof input.workspaceId === 'string'
        ? createWorkspaceId(input.workspaceId)
        : input.workspaceId,
    asOf: typeof input.asOf === 'string' ? createLocalDate(input.asOf) : input.asOf,
    currency:
      typeof input.currency === 'string' ? createCurrencyCode(input.currency) : input.currency,
    openingBalance: createMoney(input.openingBalance),
    availableBalance: createMoney(input.availableBalance),
    protectedFloor: createMoney(input.protectedFloor),
    actualNet: createMoney(input.actualNet),
    expectedNet: createMoney(input.expectedNet),
    currentBalanceIds: input.currentBalanceIds.map((id) =>
      typeof id === 'string' ? createCurrentBalanceId(id) : id,
    ),
    balanceObservationIds: input.balanceObservationIds.map((id) =>
      typeof id === 'string' ? createBalanceObservationId(id) : id,
    ),
    sourceIds: input.sourceIds.map((id) => id.trim()).filter((id) => id.length > 0),
    authorityState: input.authorityState ?? 'inferred',
    reviewState: input.reviewState ?? 'not-required',
    createdAt:
      typeof input.createdAt === 'string' ? createInstantString(input.createdAt) : input.createdAt,
    version: createEntityVersion(input.version),
    ...(input.provenanceId === undefined
      ? {}
      : {
          provenanceId:
            typeof input.provenanceId === 'string'
              ? createProvenanceId(input.provenanceId)
              : input.provenanceId,
        }),
  };
}

export function createParsedRow(input: {
  id: string | ParsedRowId;
  workspaceId: string | WorkspaceId;
  sourceRecordId: string | SourceRecordId;
  rowIndex: number;
  rawText: string;
  parsedAt: string | InstantString;
  parserName: string;
  parserIssues?: readonly ParserIssue[];
  authorityState?: Extract<AuthorityState, 'imported-claim' | 'estimated'>;
  reviewState?: ReviewState;
  version?: VersionInput;
  provenanceId?: string | ProvenanceId;
  rejectionReason?: ImportRejectionReason;
  nonFinancial?: boolean;
}): ParsedRow {
  const rawText = input.rawText.trim();
  const parserName = input.parserName.trim();
  if (!Number.isSafeInteger(input.rowIndex) || input.rowIndex < 0) {
    throw new Error('Parsed row index must be a non-negative safe integer.');
  }
  if (rawText.length === 0) {
    throw new Error('Parsed row raw text is required.');
  }
  if (parserName.length === 0) {
    throw new Error('Parsed row parser name is required.');
  }

  return {
    id: typeof input.id === 'string' ? createParsedRowId(input.id) : input.id,
    workspaceId:
      typeof input.workspaceId === 'string'
        ? createWorkspaceId(input.workspaceId)
        : input.workspaceId,
    sourceRecordId:
      typeof input.sourceRecordId === 'string'
        ? createSourceRecordId(input.sourceRecordId)
        : input.sourceRecordId,
    rowIndex: input.rowIndex,
    rawText,
    parsedAt:
      typeof input.parsedAt === 'string' ? createInstantString(input.parsedAt) : input.parsedAt,
    parserName,
    parserIssues: input.parserIssues ?? [],
    authorityState: input.authorityState ?? 'imported-claim',
    reviewState: input.reviewState ?? 'needs-review',
    version: createEntityVersion(input.version),
    ...(input.rejectionReason === undefined ? {} : { rejectionReason: input.rejectionReason }),
    ...(input.nonFinancial === undefined ? {} : { nonFinancial: input.nonFinancial }),
    ...(input.provenanceId === undefined
      ? {}
      : {
          provenanceId:
            typeof input.provenanceId === 'string'
              ? createProvenanceId(input.provenanceId)
              : input.provenanceId,
        }),
  };
}

export function createImportedClaim(input: {
  id: string | ImportedClaimId;
  workspaceId: string | WorkspaceId;
  sourceRecordId: string | SourceRecordId;
  originalText: string;
  interpretedTitle: string;
  amount?: MoneyInput | Money;
  localDate?: string | LocalDate;
  state?: ImportedClaimState;
  sourceQuality?: ImportSourceQuality;
  authorityState?: Extract<
    AuthorityState,
    'imported-claim' | 'inferred' | 'estimated' | 'user-confirmed'
  >;
  reviewState?: ReviewState;
  userConfirmationState?: UserConfirmationState;
  version?: VersionInput;
  importDraftId?: string | ImportDraftId;
  parsedRowId?: string | ParsedRowId;
  proposedTransactionId?: string | TransactionId;
  acceptedTransactionId?: string | TransactionId;
  eventId?: string | EventId;
  parserIssues?: readonly ParserIssue[];
  provenanceId?: string | ProvenanceId;
  rejectedAt?: string | InstantString;
  rejectionReason?: ImportRejectionReason;
  nonFinancial?: boolean;
}): ImportedClaim {
  const originalText = input.originalText.trim();
  const interpretedTitle = input.interpretedTitle.trim();
  if (originalText.length === 0) {
    throw new Error('Imported claim original text is required.');
  }
  if (interpretedTitle.length === 0) {
    throw new Error('Imported claim interpreted title is required.');
  }

  return {
    id: typeof input.id === 'string' ? createImportedClaimId(input.id) : input.id,
    workspaceId:
      typeof input.workspaceId === 'string'
        ? createWorkspaceId(input.workspaceId)
        : input.workspaceId,
    sourceRecordId:
      typeof input.sourceRecordId === 'string'
        ? createSourceRecordId(input.sourceRecordId)
        : input.sourceRecordId,
    originalText,
    interpretedTitle,
    ...(input.amount === undefined ? {} : { amount: createMoney(input.amount) }),
    ...(input.localDate === undefined
      ? {}
      : {
          localDate:
            typeof input.localDate === 'string'
              ? createLocalDate(input.localDate)
              : input.localDate,
        }),
    state: input.state ?? 'needs-review',
    sourceQuality: input.sourceQuality ?? 'needs-review',
    authorityState: input.authorityState ?? 'imported-claim',
    reviewState: input.reviewState ?? 'needs-review',
    userConfirmationState: input.userConfirmationState ?? 'requested',
    version: createEntityVersion(input.version),
    ...(input.importDraftId === undefined
      ? {}
      : {
          importDraftId:
            typeof input.importDraftId === 'string'
              ? createImportDraftId(input.importDraftId)
              : input.importDraftId,
        }),
    ...(input.parsedRowId === undefined
      ? {}
      : {
          parsedRowId:
            typeof input.parsedRowId === 'string'
              ? createParsedRowId(input.parsedRowId)
              : input.parsedRowId,
        }),
    ...(input.proposedTransactionId === undefined
      ? {}
      : {
          proposedTransactionId:
            typeof input.proposedTransactionId === 'string'
              ? createTransactionId(input.proposedTransactionId)
              : input.proposedTransactionId,
        }),
    ...(input.acceptedTransactionId === undefined
      ? {}
      : {
          acceptedTransactionId:
            typeof input.acceptedTransactionId === 'string'
              ? createTransactionId(input.acceptedTransactionId)
              : input.acceptedTransactionId,
        }),
    ...(input.eventId === undefined
      ? {}
      : {
          eventId: typeof input.eventId === 'string' ? createEventId(input.eventId) : input.eventId,
        }),
    ...(input.parserIssues === undefined ? {} : { parserIssues: input.parserIssues }),
    ...(input.rejectedAt === undefined
      ? {}
      : {
          rejectedAt:
            typeof input.rejectedAt === 'string'
              ? createInstantString(input.rejectedAt)
              : input.rejectedAt,
        }),
    ...(input.rejectionReason === undefined ? {} : { rejectionReason: input.rejectionReason }),
    ...(input.nonFinancial === undefined ? {} : { nonFinancial: input.nonFinancial }),
    ...(input.provenanceId === undefined
      ? {}
      : {
          provenanceId:
            typeof input.provenanceId === 'string'
              ? createProvenanceId(input.provenanceId)
              : input.provenanceId,
        }),
  };
}

export function createUserCorrection(input: {
  id: string | UserCorrectionId;
  workspaceId: string | WorkspaceId;
  kind: UserCorrectionKind;
  subjectId: string;
  originalValue: string;
  correctedValue: string;
  correctedAt: string | InstantString;
  reviewState?: Extract<ReviewState, 'user-confirmed' | 'dismissed'>;
  version?: VersionInput;
  reason?: string;
  sourceRecordId?: string | SourceRecordId;
  provenanceId?: string | ProvenanceId;
  decisionId?: string | DecisionRecordId;
  auditLogId?: string | AuditLogId;
}): UserCorrection {
  const subjectId = input.subjectId.trim();
  const originalValue = input.originalValue.trim();
  const correctedValue = input.correctedValue.trim();
  if (subjectId.length === 0) throw new Error('User correction subject is required.');
  if (originalValue.length === 0) throw new Error('User correction original value is required.');
  if (correctedValue.length === 0) throw new Error('User correction corrected value is required.');

  return {
    id: typeof input.id === 'string' ? createUserCorrectionId(input.id) : input.id,
    workspaceId:
      typeof input.workspaceId === 'string'
        ? createWorkspaceId(input.workspaceId)
        : input.workspaceId,
    kind: input.kind,
    subjectId,
    originalValue,
    correctedValue,
    correctedAt:
      typeof input.correctedAt === 'string'
        ? createInstantString(input.correctedAt)
        : input.correctedAt,
    authorityState: 'user-confirmed',
    reviewState: input.reviewState ?? 'user-confirmed',
    version: createEntityVersion(input.version),
    ...(input.reason === undefined ? {} : { reason: input.reason.trim() }),
    ...(input.sourceRecordId === undefined
      ? {}
      : {
          sourceRecordId:
            typeof input.sourceRecordId === 'string'
              ? createSourceRecordId(input.sourceRecordId)
              : input.sourceRecordId,
        }),
    ...(input.provenanceId === undefined
      ? {}
      : {
          provenanceId:
            typeof input.provenanceId === 'string'
              ? createProvenanceId(input.provenanceId)
              : input.provenanceId,
        }),
    ...(input.decisionId === undefined
      ? {}
      : {
          decisionId:
            typeof input.decisionId === 'string'
              ? createDecisionRecordId(input.decisionId)
              : input.decisionId,
        }),
    ...(input.auditLogId === undefined
      ? {}
      : {
          auditLogId:
            typeof input.auditLogId === 'string'
              ? createAuditLogId(input.auditLogId)
              : input.auditLogId,
        }),
  };
}

export function createDocumentAttachment(input: {
  id: string | DocumentAttachmentId;
  workspaceId: string | WorkspaceId;
  documentId: string | DocumentId;
  targetKind: DocumentAttachmentTargetKind;
  targetId: string;
  attachedAt: string | InstantString;
  authorityState?: AuthorityState;
  reviewState?: ReviewState;
  version?: VersionInput;
  sourceRecordId?: string | SourceRecordId;
  provenanceId?: string | ProvenanceId;
}): DocumentAttachment {
  const targetId = input.targetId.trim();
  if (targetId.length === 0) throw new Error('Document attachment target is required.');

  return {
    id: typeof input.id === 'string' ? createDocumentAttachmentId(input.id) : input.id,
    workspaceId:
      typeof input.workspaceId === 'string'
        ? createWorkspaceId(input.workspaceId)
        : input.workspaceId,
    documentId:
      typeof input.documentId === 'string' ? createDocumentId(input.documentId) : input.documentId,
    targetKind: input.targetKind,
    targetId,
    attachedAt:
      typeof input.attachedAt === 'string'
        ? createInstantString(input.attachedAt)
        : input.attachedAt,
    authorityState: input.authorityState ?? 'imported-claim',
    reviewState: input.reviewState ?? 'needs-review',
    version: createEntityVersion(input.version),
    ...(input.sourceRecordId === undefined
      ? {}
      : {
          sourceRecordId:
            typeof input.sourceRecordId === 'string'
              ? createSourceRecordId(input.sourceRecordId)
              : input.sourceRecordId,
        }),
    ...(input.provenanceId === undefined
      ? {}
      : {
          provenanceId:
            typeof input.provenanceId === 'string'
              ? createProvenanceId(input.provenanceId)
              : input.provenanceId,
        }),
  };
}

export function createPlanRule(input: {
  id: string | PlanRuleId;
  workspaceId: string | WorkspaceId;
  planId: string | PlanId;
  title: string;
  mode?: PlanRuleMode;
  authorityState?: AuthorityState;
  reviewState?: ReviewState;
  createdAt: string | InstantString;
  version?: VersionInput;
  minimumBuffer?: MoneyInput | Money;
  protectedAmount?: MoneyInput | Money;
  targetContribution?: MoneyInput | Money;
  deadline?: string | LocalDate;
  pauseAllowed?: boolean;
  adjustAllowed?: boolean;
  rebaseAllowed?: boolean;
  reviewRequiredWhen?: readonly PlanRuleReviewCondition[];
  sourceRecordId?: string | SourceRecordId;
  provenanceId?: string | ProvenanceId;
}): PlanRule {
  const title = input.title.trim();
  if (title.length === 0) {
    throw new Error('Plan rule title is required.');
  }
  const hasConstraint =
    input.minimumBuffer !== undefined ||
    input.protectedAmount !== undefined ||
    input.targetContribution !== undefined ||
    input.deadline !== undefined;
  if (!hasConstraint) {
    throw new Error('Plan rules require at least one configured constraint.');
  }

  return {
    id: typeof input.id === 'string' ? createPlanRuleId(input.id) : input.id,
    workspaceId:
      typeof input.workspaceId === 'string'
        ? createWorkspaceId(input.workspaceId)
        : input.workspaceId,
    planId: typeof input.planId === 'string' ? createPlanId(input.planId) : input.planId,
    title,
    mode: input.mode ?? 'flexible',
    authorityState: input.authorityState ?? 'user-confirmed',
    reviewState: input.reviewState ?? 'user-confirmed',
    createdAt:
      typeof input.createdAt === 'string' ? createInstantString(input.createdAt) : input.createdAt,
    version: createEntityVersion(input.version),
    ...(input.minimumBuffer === undefined
      ? {}
      : { minimumBuffer: createMoney(input.minimumBuffer) }),
    ...(input.protectedAmount === undefined
      ? {}
      : { protectedAmount: createMoney(input.protectedAmount) }),
    ...(input.targetContribution === undefined
      ? {}
      : { targetContribution: createMoney(input.targetContribution) }),
    ...(input.deadline === undefined
      ? {}
      : {
          deadline:
            typeof input.deadline === 'string' ? createLocalDate(input.deadline) : input.deadline,
        }),
    pauseAllowed: input.pauseAllowed ?? true,
    adjustAllowed: input.adjustAllowed ?? true,
    rebaseAllowed: input.rebaseAllowed ?? true,
    reviewRequiredWhen: [
      ...(input.reviewRequiredWhen ?? ['unexpected-change', 'protected-floor-risk']),
    ],
    ...(input.sourceRecordId === undefined
      ? {}
      : {
          sourceRecordId:
            typeof input.sourceRecordId === 'string'
              ? createSourceRecordId(input.sourceRecordId)
              : input.sourceRecordId,
        }),
    ...(input.provenanceId === undefined
      ? {}
      : {
          provenanceId:
            typeof input.provenanceId === 'string'
              ? createProvenanceId(input.provenanceId)
              : input.provenanceId,
        }),
  };
}

export function createPlanImpact(input: {
  id: string | PlanImpactId;
  workspaceId: string | WorkspaceId;
  planId: string | PlanId;
  asOf: string | LocalDate;
  summary: string;
  changedRecordIds: readonly string[];
  direction: PlanImpactDirection;
  newProjectedOutcome: string;
  protectedAmount: MoneyInput | Money;
  needsReview?: boolean;
  reviewReasons?: readonly string[];
  optionIds?: readonly string[];
  scenarioIds?: readonly (string | ScenarioId)[];
  authorityState?: Extract<AuthorityState, 'inferred' | 'estimated' | 'hypothetical'>;
  reviewState?: ReviewState;
  createdAt: string | InstantString;
  version?: VersionInput;
  previousProjectedDate?: string | LocalDate;
  newProjectedDate?: string | LocalDate;
  previousProjectedAmount?: MoneyInput | Money;
  newProjectedAmount?: MoneyInput | Money;
  sourceRecordId?: string | SourceRecordId;
  provenanceId?: string | ProvenanceId;
}): PlanImpact {
  const summary = input.summary.trim();
  const newProjectedOutcome = input.newProjectedOutcome.trim();
  const changedRecordIds = input.changedRecordIds
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (summary.length === 0 || newProjectedOutcome.length === 0) {
    throw new Error('Plan impacts require a summary and projected outcome.');
  }
  if (changedRecordIds.length === 0) {
    throw new Error('Plan impacts require at least one changed record.');
  }

  return {
    id: typeof input.id === 'string' ? createPlanImpactId(input.id) : input.id,
    workspaceId:
      typeof input.workspaceId === 'string'
        ? createWorkspaceId(input.workspaceId)
        : input.workspaceId,
    planId: typeof input.planId === 'string' ? createPlanId(input.planId) : input.planId,
    asOf: typeof input.asOf === 'string' ? createLocalDate(input.asOf) : input.asOf,
    summary,
    changedRecordIds,
    direction: input.direction,
    newProjectedOutcome,
    protectedAmount: createMoney(input.protectedAmount),
    needsReview:
      input.needsReview ?? (input.direction === 'behind' || input.direction === 'needs-review'),
    reviewReasons: [...(input.reviewReasons ?? [])],
    optionIds: input.optionIds?.map((id) => id.trim()).filter((id) => id.length > 0) ?? [],
    scenarioIds: (input.scenarioIds ?? []).map((id) =>
      typeof id === 'string' ? createScenarioId(id) : id,
    ),
    authorityState: input.authorityState ?? 'inferred',
    reviewState:
      input.reviewState ?? (input.needsReview === false ? 'not-required' : 'needs-review'),
    createdAt:
      typeof input.createdAt === 'string' ? createInstantString(input.createdAt) : input.createdAt,
    version: createEntityVersion(input.version),
    ...(input.previousProjectedDate === undefined
      ? {}
      : {
          previousProjectedDate:
            typeof input.previousProjectedDate === 'string'
              ? createLocalDate(input.previousProjectedDate)
              : input.previousProjectedDate,
        }),
    ...(input.newProjectedDate === undefined
      ? {}
      : {
          newProjectedDate:
            typeof input.newProjectedDate === 'string'
              ? createLocalDate(input.newProjectedDate)
              : input.newProjectedDate,
        }),
    ...(input.previousProjectedAmount === undefined
      ? {}
      : { previousProjectedAmount: createMoney(input.previousProjectedAmount) }),
    ...(input.newProjectedAmount === undefined
      ? {}
      : { newProjectedAmount: createMoney(input.newProjectedAmount) }),
    ...(input.sourceRecordId === undefined
      ? {}
      : {
          sourceRecordId:
            typeof input.sourceRecordId === 'string'
              ? createSourceRecordId(input.sourceRecordId)
              : input.sourceRecordId,
        }),
    ...(input.provenanceId === undefined
      ? {}
      : {
          provenanceId:
            typeof input.provenanceId === 'string'
              ? createProvenanceId(input.provenanceId)
              : input.provenanceId,
        }),
  };
}

function authorityStateForBalanceSource(sourceKind: BalanceSourceKind): AuthorityState {
  if (sourceKind === 'provider-reported') return 'provider-reported';
  if (sourceKind === 'imported-statement') return 'imported-claim';
  if (sourceKind === 'calculated') return 'inferred';
  if (sourceKind === 'migration') return 'user-confirmed';
  return 'user-confirmed';
}

function reviewStateForBalanceAuthority(authorityState: AuthorityState): ReviewState {
  if (authorityState === 'imported-claim' || authorityState === 'estimated') return 'needs-review';
  if (authorityState === 'user-confirmed' || authorityState === 'confirmed') return 'not-required';
  if (authorityState === 'provider-reported') return 'not-required';
  return 'needs-review';
}

export function createTransactionSplit(input: {
  id: string | TransactionSplitId;
  amount: MoneyInput | Money;
  label: string;
  categoryId?: string;
}): TransactionSplit {
  const label = input.label.trim();
  if (label.length === 0) {
    throw new Error('Transaction split label is required.');
  }

  const split: {
    id: TransactionSplitId;
    amount: Money;
    label: string;
    categoryId?: string;
  } = {
    id: typeof input.id === 'string' ? createTransactionSplitId(input.id) : input.id,
    amount: createMoney(input.amount),
    label,
  };

  if (input.categoryId !== undefined) {
    split.categoryId = input.categoryId;
  }

  return split;
}

export function createTransaction(input: {
  id: string | TransactionId;
  workspaceId: string | WorkspaceId;
  accountId: string | AccountId;
  status: TransactionStatus;
  authorityState?: AuthorityState;
  amount: MoneyInput | Money;
  localDate: string | LocalDate;
  sourceKind: TransactionSourceKind;
  certainty: TransactionCertainty;
  reviewStatus?: TransactionReviewStatus;
  splits?: readonly (TransactionSplit | Parameters<typeof createTransactionSplit>[0])[];
  version?: VersionInput;
  bookedAt?: string | InstantString;
  description?: string;
  reference?: string;
  sourceRecordId?: string | SourceRecordId;
  provenanceId?: string | ProvenanceId;
  eventId?: string | EventId;
  transferLink?: string | TransferLinkId;
  replaces?: string | TransactionId;
  replacedBy?: string | TransactionId;
  fulfils?: string | ExpectationId;
  reversalOf?: string | TransactionId;
  sourceTransactionId?: string;
  sourceEvidenceId?: string;
  externalId?: string;
  connectionId?: string;
  sourceOrdinal?: number;
}): FinancialTransaction {
  const amount = createMoney(input.amount);
  const splits = (input.splits ?? []).map((split) => createTransactionSplit(split));
  assertSplitsBalance(amount, splits);

  const transaction: {
    id: TransactionId;
    workspaceId: WorkspaceId;
    accountId: AccountId;
    status: TransactionStatus;
    authorityState: AuthorityState;
    amount: Money;
    localDate: LocalDate;
    sourceKind: TransactionSourceKind;
    certainty: TransactionCertainty;
    reviewStatus: TransactionReviewStatus;
    splits: readonly TransactionSplit[];
    version: EntityVersion;
    bookedAt?: InstantString;
    description?: string;
    reference?: string;
    sourceRecordId?: SourceRecordId;
    provenanceId?: ProvenanceId;
    eventId?: EventId;
    transferLink?: TransferLinkId;
    replaces?: TransactionId;
    replacedBy?: TransactionId;
    fulfils?: ExpectationId;
    reversalOf?: TransactionId;
    sourceTransactionId?: string;
    sourceEvidenceId?: string;
    externalId?: string;
    connectionId?: string;
    sourceOrdinal?: number;
  } = {
    id: typeof input.id === 'string' ? createTransactionId(input.id) : input.id,
    workspaceId:
      typeof input.workspaceId === 'string'
        ? createWorkspaceId(input.workspaceId)
        : input.workspaceId,
    accountId:
      typeof input.accountId === 'string' ? createAccountId(input.accountId) : input.accountId,
    status: input.status,
    authorityState: input.authorityState ?? input.certainty,
    amount,
    localDate:
      typeof input.localDate === 'string' ? createLocalDate(input.localDate) : input.localDate,
    sourceKind: input.sourceKind,
    certainty: input.certainty,
    reviewStatus: input.reviewStatus ?? 'accepted',
    splits,
    version: createEntityVersion(input.version),
  };

  if (input.bookedAt !== undefined) {
    transaction.bookedAt =
      typeof input.bookedAt === 'string' ? createInstantString(input.bookedAt) : input.bookedAt;
  }
  if (input.description !== undefined) transaction.description = input.description;
  if (input.reference !== undefined) transaction.reference = input.reference;
  if (input.sourceRecordId !== undefined) {
    transaction.sourceRecordId =
      typeof input.sourceRecordId === 'string'
        ? createSourceRecordId(input.sourceRecordId)
        : input.sourceRecordId;
  }
  if (input.provenanceId !== undefined) {
    transaction.provenanceId =
      typeof input.provenanceId === 'string'
        ? createProvenanceId(input.provenanceId)
        : input.provenanceId;
  }
  if (input.eventId !== undefined) {
    transaction.eventId =
      typeof input.eventId === 'string' ? createEventId(input.eventId) : input.eventId;
  }
  if (input.transferLink !== undefined) {
    transaction.transferLink =
      typeof input.transferLink === 'string'
        ? createTransferLinkId(input.transferLink)
        : input.transferLink;
  }
  if (input.replaces !== undefined) {
    transaction.replaces =
      typeof input.replaces === 'string' ? createTransactionId(input.replaces) : input.replaces;
  }
  if (input.replacedBy !== undefined) {
    transaction.replacedBy =
      typeof input.replacedBy === 'string'
        ? createTransactionId(input.replacedBy)
        : input.replacedBy;
  }
  if (input.fulfils !== undefined) {
    transaction.fulfils =
      typeof input.fulfils === 'string' ? createExpectationId(input.fulfils) : input.fulfils;
  }
  if (input.reversalOf !== undefined) {
    transaction.reversalOf =
      typeof input.reversalOf === 'string'
        ? createTransactionId(input.reversalOf)
        : input.reversalOf;
  }

  for (const [label, value] of [
    ['Source transaction ID', input.sourceTransactionId],
    ['Source evidence ID', input.sourceEvidenceId],
    ['External transaction ID', input.externalId],
    ['Connection ID', input.connectionId],
  ] as const) {
    if (value !== undefined && (value.trim().length === 0 || value.length > 512)) {
      throw new Error(`${label} must be between 1 and 512 characters.`);
    }
  }
  if (input.sourceTransactionId !== undefined) {
    transaction.sourceTransactionId = input.sourceTransactionId;
  }
  if (input.sourceEvidenceId !== undefined) transaction.sourceEvidenceId = input.sourceEvidenceId;
  if (input.externalId !== undefined) transaction.externalId = input.externalId;
  if (input.connectionId !== undefined) transaction.connectionId = input.connectionId;
  if (input.sourceOrdinal !== undefined) {
    if (!Number.isSafeInteger(input.sourceOrdinal) || input.sourceOrdinal < 0) {
      throw new Error('Source transaction ordinal must be a non-negative safe integer.');
    }
    transaction.sourceOrdinal = input.sourceOrdinal;
  }

  return transaction;
}

export function assertSplitsBalance(
  parentAmount: Money,
  splits: readonly TransactionSplit[],
): void {
  if (splits.length === 0) return;

  const splitTotal = sumMoney(
    splits.map((split) => split.amount),
    parentAmount.currency,
  );
  if (splitTotal.minorUnits !== parentAmount.minorUnits) {
    throw new Error('Transaction splits must sum exactly to the parent transaction amount.');
  }
}

export function createTransferLink(input: {
  id: string | TransferLinkId;
  debit: FinancialTransaction;
  credit: FinancialTransaction;
}): TransferLink {
  const { debit, credit } = input;
  if (debit.workspaceId !== credit.workspaceId) {
    throw new Error('Transfer transactions must belong to the same workspace.');
  }
  if (debit.accountId === credit.accountId) {
    throw new Error('Transfer transactions must use different accounts.');
  }
  assertSameCurrency(debit.amount, credit.amount);
  if (debit.amount.minorUnits >= 0 || credit.amount.minorUnits <= 0) {
    throw new Error('Transfer transactions must have opposite debit and credit signs.');
  }
  if (debit.amount.minorUnits + credit.amount.minorUnits !== 0) {
    throw new Error('Transfer transactions must be equal and opposite.');
  }

  return {
    id: typeof input.id === 'string' ? createTransferLinkId(input.id) : input.id,
    workspaceId: debit.workspaceId,
    debitTransactionId: debit.id,
    creditTransactionId: credit.id,
    amount: createMoney({ minorUnits: credit.amount.minorUnits, currency: credit.amount.currency }),
  };
}

export function isTransferPairNetNeutral(
  debit: FinancialTransaction,
  credit: FinancialTransaction,
): boolean {
  try {
    createTransferLink({ id: 'transfer_validation_pair', debit, credit });
    return true;
  } catch {
    return false;
  }
}

export function createFinancialExpectation(input: {
  id: string | ExpectationId;
  workspaceId: string | WorkspaceId;
  localDate: string | LocalDate;
  amount: MoneyInput | Money;
  authorityState?: ExpectationCertainty;
  certainty?: ExpectationCertainty;
  fulfilled?: boolean;
  version?: VersionInput;
  accountId?: string | AccountId;
  reference?: string;
  sourceRecordId?: string | SourceRecordId;
  provenanceId?: string | ProvenanceId;
  commitmentId?: string | CommitmentId;
  bookedAt?: string | InstantString;
  description?: string;
  categoryId?: string;
  sourceKind?: TransactionSourceKind;
  sourceTransactionId?: string;
  sourceEvidenceId?: string;
  externalId?: string;
  connectionId?: string;
  sourceOrdinal?: number;
}): FinancialExpectation {
  const expectation: {
    id: ExpectationId;
    workspaceId: WorkspaceId;
    localDate: LocalDate;
    amount: Money;
    authorityState: AuthorityState;
    certainty: ExpectationCertainty;
    fulfilled: boolean;
    version: EntityVersion;
    accountId?: AccountId;
    reference?: string;
    sourceRecordId?: SourceRecordId;
    provenanceId?: ProvenanceId;
    commitmentId?: CommitmentId;
    bookedAt?: InstantString;
    description?: string;
    categoryId?: string;
    sourceKind?: TransactionSourceKind;
    sourceTransactionId?: string;
    sourceEvidenceId?: string;
    externalId?: string;
    connectionId?: string;
    sourceOrdinal?: number;
  } = {
    id: typeof input.id === 'string' ? createExpectationId(input.id) : input.id,
    workspaceId:
      typeof input.workspaceId === 'string'
        ? createWorkspaceId(input.workspaceId)
        : input.workspaceId,
    localDate:
      typeof input.localDate === 'string' ? createLocalDate(input.localDate) : input.localDate,
    amount: createMoney(input.amount),
    authorityState: input.authorityState ?? input.certainty ?? 'estimated',
    certainty: input.certainty ?? input.authorityState ?? 'estimated',
    fulfilled: input.fulfilled ?? false,
    version: createEntityVersion(input.version),
  };

  if (input.accountId !== undefined) {
    expectation.accountId =
      typeof input.accountId === 'string' ? createAccountId(input.accountId) : input.accountId;
  }
  if (input.reference !== undefined) expectation.reference = input.reference;
  if (input.sourceRecordId !== undefined) {
    expectation.sourceRecordId =
      typeof input.sourceRecordId === 'string'
        ? createSourceRecordId(input.sourceRecordId)
        : input.sourceRecordId;
  }
  if (input.provenanceId !== undefined) {
    expectation.provenanceId =
      typeof input.provenanceId === 'string'
        ? createProvenanceId(input.provenanceId)
        : input.provenanceId;
  }
  if (input.commitmentId !== undefined) {
    expectation.commitmentId =
      typeof input.commitmentId === 'string'
        ? createCommitmentId(input.commitmentId)
        : input.commitmentId;
  }
  if (input.bookedAt !== undefined) {
    expectation.bookedAt =
      typeof input.bookedAt === 'string' ? createInstantString(input.bookedAt) : input.bookedAt;
  }
  for (const [label, value] of [
    ['Expectation description', input.description],
    ['Expectation category ID', input.categoryId],
    ['Source transaction ID', input.sourceTransactionId],
    ['Source evidence ID', input.sourceEvidenceId],
    ['External transaction ID', input.externalId],
    ['Connection ID', input.connectionId],
  ] as const) {
    if (value !== undefined && (value.trim().length === 0 || value.length > 512)) {
      throw new Error(`${label} must be between 1 and 512 characters.`);
    }
  }
  if (input.description !== undefined) expectation.description = input.description;
  if (input.categoryId !== undefined) expectation.categoryId = input.categoryId;
  if (input.sourceKind !== undefined) expectation.sourceKind = input.sourceKind;
  if (input.sourceTransactionId !== undefined) {
    expectation.sourceTransactionId = input.sourceTransactionId;
  }
  if (input.sourceEvidenceId !== undefined) expectation.sourceEvidenceId = input.sourceEvidenceId;
  if (input.externalId !== undefined) expectation.externalId = input.externalId;
  if (input.connectionId !== undefined) expectation.connectionId = input.connectionId;
  if (input.sourceOrdinal !== undefined) {
    if (!Number.isSafeInteger(input.sourceOrdinal) || input.sourceOrdinal < 0) {
      throw new Error('Source expectation ordinal must be a non-negative safe integer.');
    }
    expectation.sourceOrdinal = input.sourceOrdinal;
  }

  return expectation;
}

export function reconcileActualWithExpectation(
  actual: FinancialTransaction,
  expectation: FinancialExpectation,
): ActualExpectationReconciliation {
  if (actual.workspaceId !== expectation.workspaceId) {
    throw new Error('Actual transaction and expectation must share a workspace.');
  }
  assertSameCurrency(actual.amount, expectation.amount);
  const variance = subtractMoney(actual.amount, expectation.amount);

  return {
    countedTransactionId: actual.id,
    supersededExpectationId: expectation.id,
    variance,
    questionType: variance.minorUnits === 0 ? 'matched' : 'recurring_amount_variance',
  };
}

export function chooseCurrentFinancialTruth(input: {
  transactions: readonly FinancialTransaction[];
  expectations: readonly FinancialExpectation[];
}): CurrentFinancialTruth {
  const replacedTransactionIds = new Set<TransactionId>();
  const fulfilledExpectationIds = new Set<ExpectationId>();

  for (const transaction of input.transactions) {
    if (transaction.replacedBy !== undefined) {
      replacedTransactionIds.add(transaction.id);
    }
    if (transaction.replaces !== undefined) {
      replacedTransactionIds.add(transaction.replaces);
    }
    if (transaction.fulfils !== undefined) {
      fulfilledExpectationIds.add(transaction.fulfils);
    }
  }

  const transactionIds = input.transactions
    .filter(
      (transaction) => transaction.status !== 'void' && !replacedTransactionIds.has(transaction.id),
    )
    .map((transaction) => transaction.id);
  const expectationIds = input.expectations
    .filter((expectation) => !expectation.fulfilled && !fulfilledExpectationIds.has(expectation.id))
    .map((expectation) => expectation.id);

  return { transactionIds, expectationIds };
}

export * from './trustedCore.js';

function createPrefixedId(input: string, prefix: string): EntityId<string> {
  const normalized = input.trim();
  if (
    normalized.length < 8 ||
    normalized.length > 128 ||
    !normalized.startsWith(`${prefix}_`) ||
    !internalIdPattern.test(normalized)
  ) {
    throw new Error(
      `IDs for ${prefix} records must be stable internal IDs prefixed with ${prefix}_.`,
    );
  }
  return normalized as EntityId<string>;
}

function assertSafeMinorUnits(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer.`);
  }
}
