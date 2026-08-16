import {
  nextEntityVersion,
  type Account,
  type AuditLogEntry,
  type AvailablePositionSnapshot,
  type BalanceAdjustment,
  type BalanceObservation,
  type CalendarItem,
  type Commitment,
  type CompanionRuntimeState,
  type CurrentBalance,
  type DecisionRecord,
  type Debt,
  type DocumentAttachment,
  type DocumentRecord,
  type Event,
  type FinancialExpectation,
  type FinancialContext,
  type FinancialTransaction,
  type Forecast,
  type ImportedClaim,
  type IncomeSchedule,
  type ImportDraft,
  type TimelineEntry,
  type TransactionIntelligenceState,
  type MeloMemory,
  type MeloProposalRecord,
  type ParsedRow,
  type Plan,
  type PlanImpact,
  type PlanRule,
  type PlannerItem,
  type Pot,
  type PotLedgerEntry,
  type Provenance,
  type Scenario,
  type SourceRecord,
  type Subscription,
  type SubscriptionPreference,
  type CycleRecord,
  type UserCorrection,
  type Workspace,
  type WorkspaceId,
} from '@folio/domain';

import { assertSameWorkspace } from './workspace.js';

export const canonicalLocalRepositorySchema = 'folio-canonical-local-repository-v1';

export const canonicalLocalPersistenceCollections = [
  'workspaces',
  'accounts',
  'balanceObservations',
  'currentBalances',
  'balanceAdjustments',
  'availablePositionSnapshots',
  'sourceRecords',
  'provenance',
  'parsedRows',
  'importedClaims',
  'importDrafts',
  'userCorrections',
  'transactions',
  'events',
  'commitments',
  'expectations',
  'plannerItems',
  'plans',
  'planRules',
  'scenarios',
  'planImpacts',
  'forecastSnapshots',
  'decisions',
  'documents',
  'documentAttachments',
  'calendarItems',
  'timelineEntries',
  'meloMemory',
  'meloProposals',
  'pots',
  'potLedgerEntries',
  'subscriptions',
  'subscriptionPreferences',
  'cycleRecords',
  'debts',
  'financialContexts',
  'incomeSchedules',
  'transactionIntelligenceStates',
  'companionRuntimeStates',
  'auditLog',
] as const;

export type CanonicalLocalPersistenceCollection =
  (typeof canonicalLocalPersistenceCollections)[number];

export type CanonicalRepositoryCollections = Readonly<{
  workspaces: readonly Workspace[];
  accounts: readonly Account[];
  balanceObservations: readonly BalanceObservation[];
  currentBalances: readonly CurrentBalance[];
  balanceAdjustments: readonly BalanceAdjustment[];
  availablePositionSnapshots: readonly AvailablePositionSnapshot[];
  sourceRecords: readonly SourceRecord[];
  provenance: readonly Provenance[];
  parsedRows: readonly ParsedRow[];
  importedClaims: readonly ImportedClaim[];
  importDrafts: readonly ImportDraft[];
  userCorrections: readonly UserCorrection[];
  transactions: readonly FinancialTransaction[];
  events: readonly Event[];
  commitments: readonly Commitment[];
  expectations: readonly FinancialExpectation[];
  plannerItems: readonly PlannerItem[];
  plans: readonly Plan[];
  planRules: readonly PlanRule[];
  scenarios: readonly Scenario[];
  planImpacts: readonly PlanImpact[];
  forecastSnapshots: readonly Forecast[];
  decisions: readonly DecisionRecord[];
  documents: readonly DocumentRecord[];
  documentAttachments: readonly DocumentAttachment[];
  calendarItems: readonly CalendarItem[];
  timelineEntries: readonly TimelineEntry[];
  meloMemory: readonly MeloMemory[];
  meloProposals: readonly MeloProposalRecord[];
  pots: readonly Pot[];
  potLedgerEntries: readonly PotLedgerEntry[];
  subscriptions: readonly Subscription[];
  subscriptionPreferences: readonly SubscriptionPreference[];
  cycleRecords: readonly CycleRecord[];
  debts: readonly Debt[];
  financialContexts: readonly FinancialContext[];
  incomeSchedules: readonly IncomeSchedule[];
  transactionIntelligenceStates: readonly TransactionIntelligenceState[];
  companionRuntimeStates: readonly CompanionRuntimeState[];
  auditLog: readonly AuditLogEntry[];
}>;

export type CanonicalRepositorySeed = Partial<CanonicalRepositoryCollections>;

export type CanonicalRepositorySnapshot = Readonly<{
  schema: typeof canonicalLocalRepositorySchema;
  workspaceId: WorkspaceId;
  collections: CanonicalRepositoryCollections;
}>;

export interface CanonicalWorkspaceRepository {
  list(): readonly Workspace[];
  get(id: Workspace['id']): Workspace | undefined;
  put(record: Workspace): Workspace;
}

export interface CanonicalEntityRepository<TEntity extends WorkspaceRecord> {
  readonly workspaceId: WorkspaceId;
  list(): readonly TEntity[];
  get(id: TEntity['id']): TEntity | undefined;
  put(record: TEntity): TEntity;
  remove(id: TEntity['id']): boolean;
  count(): number;
}

export type ImportDraftAcceptanceInput = Readonly<{
  draftId: ImportDraft['id'];
  transaction: FinancialTransaction;
  decision: DecisionRecord;
  auditEntry: AuditLogEntry;
  event?: Event;
  calendarItem?: CalendarItem;
  timelineEntry?: TimelineEntry;
}>;

export type ImportDraftRejectionInput = Readonly<{
  draftId: ImportDraft['id'];
  decision: DecisionRecord;
  auditEntry: AuditLogEntry;
  timelineEntry?: TimelineEntry;
}>;

export type ScenarioAcceptanceInput = Readonly<{
  scenarioId: Scenario['id'];
  decision: DecisionRecord;
  auditEntry: AuditLogEntry;
  planUpdates?: readonly Plan[];
  planImpacts?: readonly PlanImpact[];
  calendarItems?: readonly CalendarItem[];
  timelineEntry?: TimelineEntry;
}>;

export type MeloProposalReviewInput = Readonly<{
  proposalId: MeloProposalRecord['id'];
  status: Extract<MeloProposalRecord['status'], 'accepted' | 'rejected'>;
  decision: DecisionRecord;
  auditEntry: AuditLogEntry;
  memory?: MeloMemory;
}>;

export interface CanonicalRepository {
  readonly schema: typeof canonicalLocalRepositorySchema;
  readonly workspaceId: WorkspaceId;
  readonly workspaces: CanonicalWorkspaceRepository;
  readonly accounts: CanonicalEntityRepository<Account>;
  readonly balanceObservations: CanonicalEntityRepository<BalanceObservation>;
  readonly currentBalances: CanonicalEntityRepository<CurrentBalance>;
  readonly balanceAdjustments: CanonicalEntityRepository<BalanceAdjustment>;
  readonly availablePositionSnapshots: CanonicalEntityRepository<AvailablePositionSnapshot>;
  readonly sourceRecords: CanonicalEntityRepository<SourceRecord>;
  readonly provenance: CanonicalEntityRepository<Provenance>;
  readonly parsedRows: CanonicalEntityRepository<ParsedRow>;
  readonly importedClaims: CanonicalEntityRepository<ImportedClaim>;
  readonly importDrafts: CanonicalEntityRepository<ImportDraft>;
  readonly userCorrections: CanonicalEntityRepository<UserCorrection>;
  readonly transactions: CanonicalEntityRepository<FinancialTransaction>;
  readonly events: CanonicalEntityRepository<Event>;
  readonly commitments: CanonicalEntityRepository<Commitment>;
  readonly expectations: CanonicalEntityRepository<FinancialExpectation>;
  readonly plannerItems: CanonicalEntityRepository<PlannerItem>;
  readonly plans: CanonicalEntityRepository<Plan>;
  readonly planRules: CanonicalEntityRepository<PlanRule>;
  readonly scenarios: CanonicalEntityRepository<Scenario>;
  readonly planImpacts: CanonicalEntityRepository<PlanImpact>;
  readonly forecastSnapshots: CanonicalEntityRepository<Forecast>;
  readonly decisions: CanonicalEntityRepository<DecisionRecord>;
  readonly auditLog: CanonicalEntityRepository<AuditLogEntry>;
  readonly meloMemory: CanonicalEntityRepository<MeloMemory>;
  readonly meloProposals: CanonicalEntityRepository<MeloProposalRecord>;
  readonly pots: CanonicalEntityRepository<Pot>;
  readonly potLedgerEntries: CanonicalEntityRepository<PotLedgerEntry>;
  readonly subscriptions: CanonicalEntityRepository<Subscription>;
  readonly subscriptionPreferences: CanonicalEntityRepository<SubscriptionPreference>;
  readonly cycleRecords: CanonicalEntityRepository<CycleRecord>;
  readonly debts: CanonicalEntityRepository<Debt>;
  readonly financialContexts: CanonicalEntityRepository<FinancialContext>;
  readonly incomeSchedules: CanonicalEntityRepository<IncomeSchedule>;
  readonly transactionIntelligenceStates: CanonicalEntityRepository<TransactionIntelligenceState>;
  readonly companionRuntimeStates: CanonicalEntityRepository<CompanionRuntimeState>;
  readonly documents: CanonicalEntityRepository<DocumentRecord>;
  readonly documentAttachments: CanonicalEntityRepository<DocumentAttachment>;
  readonly calendarItems: CanonicalEntityRepository<CalendarItem>;
  readonly timelineEntries: CanonicalEntityRepository<TimelineEntry>;
  acceptReviewedImportDraft(input: ImportDraftAcceptanceInput): FinancialTransaction;
  rejectImportDraft(input: ImportDraftRejectionInput): ImportDraft;
  acceptScenario(input: ScenarioAcceptanceInput): Scenario;
  reviewMeloProposal(input: MeloProposalReviewInput): MeloProposalRecord;
  snapshot(): CanonicalRepositorySnapshot;
}

type WorkspaceRecord = Readonly<{
  id: string;
  workspaceId: WorkspaceId;
  provenanceId?: string;
  sourceRecordId?: string;
}>;

type CanonicalMapState = {
  workspaces: Map<string, Workspace>;
  accounts: Map<string, Account>;
  balanceObservations: Map<string, BalanceObservation>;
  currentBalances: Map<string, CurrentBalance>;
  balanceAdjustments: Map<string, BalanceAdjustment>;
  availablePositionSnapshots: Map<string, AvailablePositionSnapshot>;
  sourceRecords: Map<string, SourceRecord>;
  provenance: Map<string, Provenance>;
  parsedRows: Map<string, ParsedRow>;
  importedClaims: Map<string, ImportedClaim>;
  importDrafts: Map<string, ImportDraft>;
  userCorrections: Map<string, UserCorrection>;
  transactions: Map<string, FinancialTransaction>;
  events: Map<string, Event>;
  commitments: Map<string, Commitment>;
  expectations: Map<string, FinancialExpectation>;
  plannerItems: Map<string, PlannerItem>;
  plans: Map<string, Plan>;
  planRules: Map<string, PlanRule>;
  scenarios: Map<string, Scenario>;
  planImpacts: Map<string, PlanImpact>;
  forecastSnapshots: Map<string, Forecast>;
  decisions: Map<string, DecisionRecord>;
  documents: Map<string, DocumentRecord>;
  documentAttachments: Map<string, DocumentAttachment>;
  calendarItems: Map<string, CalendarItem>;
  timelineEntries: Map<string, TimelineEntry>;
  meloMemory: Map<string, MeloMemory>;
  meloProposals: Map<string, MeloProposalRecord>;
  pots: Map<string, Pot>;
  potLedgerEntries: Map<string, PotLedgerEntry>;
  subscriptions: Map<string, Subscription>;
  subscriptionPreferences: Map<string, SubscriptionPreference>;
  cycleRecords: Map<string, CycleRecord>;
  debts: Map<string, Debt>;
  financialContexts: Map<string, FinancialContext>;
  incomeSchedules: Map<string, IncomeSchedule>;
  transactionIntelligenceStates: Map<string, TransactionIntelligenceState>;
  companionRuntimeStates: Map<string, CompanionRuntimeState>;
  auditLog: Map<string, AuditLogEntry>;
};

type EntityCollectionName = Exclude<CanonicalLocalPersistenceCollection, 'workspaces'>;

type EntityCollection = CanonicalMapState[EntityCollectionName];

type EntityForCollection<TName extends EntityCollectionName> =
  CanonicalMapState[TName] extends Map<string, infer TEntity> ? TEntity : never;

export function createInMemoryCanonicalRepository(
  workspaceId: WorkspaceId,
  seed: CanonicalRepositorySeed = {},
): CanonicalRepository {
  const state = createEmptyCanonicalMapState();
  const repository = new InMemoryCanonicalRepository(workspaceId, state);

  seedCanonicalRepository(repository, seed);

  return repository;
}

export function seedCanonicalRepository(
  repository: CanonicalRepository,
  seed: CanonicalRepositorySeed,
): void {
  for (const workspace of seed.workspaces ?? []) repository.workspaces.put(workspace);
  for (const account of seed.accounts ?? []) repository.accounts.put(account);
  for (const record of seed.sourceRecords ?? []) repository.sourceRecords.put(record);
  for (const record of seed.provenance ?? []) repository.provenance.put(record);
  for (const row of seed.parsedRows ?? []) repository.parsedRows.put(row);
  for (const claim of seed.importedClaims ?? []) repository.importedClaims.put(claim);
  for (const observation of seed.balanceObservations ?? []) {
    repository.balanceObservations.put(observation);
  }
  for (const balance of seed.currentBalances ?? []) repository.currentBalances.put(balance);
  for (const adjustment of seed.balanceAdjustments ?? []) {
    repository.balanceAdjustments.put(adjustment);
  }
  for (const position of seed.availablePositionSnapshots ?? []) {
    repository.availablePositionSnapshots.put(position);
  }
  for (const document of seed.documents ?? []) repository.documents.put(document);
  for (const attachment of seed.documentAttachments ?? []) {
    repository.documentAttachments.put(attachment);
  }
  for (const draft of seed.importDrafts ?? []) repository.importDrafts.put(draft);
  for (const correction of seed.userCorrections ?? []) {
    repository.userCorrections.put(correction);
  }
  for (const transaction of seed.transactions ?? []) repository.transactions.put(transaction);
  for (const event of seed.events ?? []) repository.events.put(event);
  for (const commitment of seed.commitments ?? []) repository.commitments.put(commitment);
  for (const expectation of seed.expectations ?? []) repository.expectations.put(expectation);
  for (const item of seed.plannerItems ?? []) repository.plannerItems.put(item);
  for (const plan of seed.plans ?? []) repository.plans.put(plan);
  for (const rule of seed.planRules ?? []) repository.planRules.put(rule);
  for (const scenario of seed.scenarios ?? []) repository.scenarios.put(scenario);
  for (const impact of seed.planImpacts ?? []) repository.planImpacts.put(impact);
  for (const forecast of seed.forecastSnapshots ?? []) {
    repository.forecastSnapshots.put(forecast);
  }
  for (const decision of seed.decisions ?? []) repository.decisions.put(decision);
  for (const item of seed.calendarItems ?? []) repository.calendarItems.put(item);
  for (const entry of seed.timelineEntries ?? []) repository.timelineEntries.put(entry);
  for (const memory of seed.meloMemory ?? []) repository.meloMemory.put(memory);
  for (const proposal of seed.meloProposals ?? []) repository.meloProposals.put(proposal);
  for (const pot of seed.pots ?? []) repository.pots.put(pot);
  for (const entry of seed.potLedgerEntries ?? []) repository.potLedgerEntries.put(entry);
  for (const subscription of seed.subscriptions ?? []) {
    repository.subscriptions.put(subscription);
  }
  for (const preference of seed.subscriptionPreferences ?? []) {
    repository.subscriptionPreferences.put(preference);
  }
  for (const cycle of seed.cycleRecords ?? []) repository.cycleRecords.put(cycle);
  for (const debt of seed.debts ?? []) repository.debts.put(debt);
  for (const context of seed.financialContexts ?? []) repository.financialContexts.put(context);
  for (const schedule of seed.incomeSchedules ?? []) repository.incomeSchedules.put(schedule);
  for (const intelligence of seed.transactionIntelligenceStates ?? []) {
    repository.transactionIntelligenceStates.put(intelligence);
  }
  for (const runtime of seed.companionRuntimeStates ?? []) {
    repository.companionRuntimeStates.put(runtime);
  }
  for (const entry of seed.auditLog ?? []) repository.auditLog.put(entry);
}

export function createCanonicalRepositoryFromSnapshot(
  snapshot: CanonicalRepositorySnapshot,
): CanonicalRepository {
  if (snapshot.schema !== canonicalLocalRepositorySchema) {
    throw new Error(`Unsupported canonical repository schema: ${snapshot.schema}`);
  }

  return createInMemoryCanonicalRepository(snapshot.workspaceId, snapshot.collections);
}

class InMemoryCanonicalRepository implements CanonicalRepository {
  readonly schema = canonicalLocalRepositorySchema;
  readonly workspaces: CanonicalWorkspaceRepository;
  readonly accounts: CanonicalEntityRepository<Account>;
  readonly balanceObservations: CanonicalEntityRepository<BalanceObservation>;
  readonly currentBalances: CanonicalEntityRepository<CurrentBalance>;
  readonly balanceAdjustments: CanonicalEntityRepository<BalanceAdjustment>;
  readonly availablePositionSnapshots: CanonicalEntityRepository<AvailablePositionSnapshot>;
  readonly sourceRecords: CanonicalEntityRepository<SourceRecord>;
  readonly provenance: CanonicalEntityRepository<Provenance>;
  readonly parsedRows: CanonicalEntityRepository<ParsedRow>;
  readonly importedClaims: CanonicalEntityRepository<ImportedClaim>;
  readonly importDrafts: CanonicalEntityRepository<ImportDraft>;
  readonly userCorrections: CanonicalEntityRepository<UserCorrection>;
  readonly transactions: CanonicalEntityRepository<FinancialTransaction>;
  readonly events: CanonicalEntityRepository<Event>;
  readonly commitments: CanonicalEntityRepository<Commitment>;
  readonly expectations: CanonicalEntityRepository<FinancialExpectation>;
  readonly plannerItems: CanonicalEntityRepository<PlannerItem>;
  readonly plans: CanonicalEntityRepository<Plan>;
  readonly planRules: CanonicalEntityRepository<PlanRule>;
  readonly scenarios: CanonicalEntityRepository<Scenario>;
  readonly planImpacts: CanonicalEntityRepository<PlanImpact>;
  readonly forecastSnapshots: CanonicalEntityRepository<Forecast>;
  readonly decisions: CanonicalEntityRepository<DecisionRecord>;
  readonly documents: CanonicalEntityRepository<DocumentRecord>;
  readonly documentAttachments: CanonicalEntityRepository<DocumentAttachment>;
  readonly calendarItems: CanonicalEntityRepository<CalendarItem>;
  readonly timelineEntries: CanonicalEntityRepository<TimelineEntry>;
  readonly meloMemory: CanonicalEntityRepository<MeloMemory>;
  readonly meloProposals: CanonicalEntityRepository<MeloProposalRecord>;
  readonly pots: CanonicalEntityRepository<Pot>;
  readonly potLedgerEntries: CanonicalEntityRepository<PotLedgerEntry>;
  readonly subscriptions: CanonicalEntityRepository<Subscription>;
  readonly subscriptionPreferences: CanonicalEntityRepository<SubscriptionPreference>;
  readonly cycleRecords: CanonicalEntityRepository<CycleRecord>;
  readonly debts: CanonicalEntityRepository<Debt>;
  readonly financialContexts: CanonicalEntityRepository<FinancialContext>;
  readonly incomeSchedules: CanonicalEntityRepository<IncomeSchedule>;
  readonly transactionIntelligenceStates: CanonicalEntityRepository<TransactionIntelligenceState>;
  readonly companionRuntimeStates: CanonicalEntityRepository<CompanionRuntimeState>;
  readonly auditLog: CanonicalEntityRepository<AuditLogEntry>;

  constructor(
    readonly workspaceId: WorkspaceId,
    private readonly state: CanonicalMapState,
  ) {
    this.workspaces = new InMemoryWorkspaceRepository(state);
    this.accounts = this.entityRepository('accounts');
    this.balanceObservations = this.entityRepository('balanceObservations');
    this.currentBalances = this.entityRepository('currentBalances');
    this.balanceAdjustments = this.entityRepository('balanceAdjustments');
    this.availablePositionSnapshots = this.entityRepository('availablePositionSnapshots');
    this.sourceRecords = this.entityRepository('sourceRecords');
    this.provenance = this.entityRepository('provenance');
    this.parsedRows = this.entityRepository('parsedRows');
    this.importedClaims = this.entityRepository('importedClaims');
    this.importDrafts = this.entityRepository('importDrafts');
    this.userCorrections = this.entityRepository('userCorrections');
    this.transactions = this.entityRepository('transactions');
    this.events = this.entityRepository('events');
    this.commitments = this.entityRepository('commitments');
    this.expectations = this.entityRepository('expectations');
    this.plannerItems = this.entityRepository('plannerItems');
    this.plans = this.entityRepository('plans');
    this.planRules = this.entityRepository('planRules');
    this.scenarios = this.entityRepository('scenarios');
    this.planImpacts = this.entityRepository('planImpacts');
    this.forecastSnapshots = this.entityRepository('forecastSnapshots');
    this.decisions = this.entityRepository('decisions');
    this.documents = this.entityRepository('documents');
    this.documentAttachments = this.entityRepository('documentAttachments');
    this.calendarItems = this.entityRepository('calendarItems');
    this.timelineEntries = this.entityRepository('timelineEntries');
    this.meloMemory = this.entityRepository('meloMemory');
    this.meloProposals = this.entityRepository('meloProposals');
    this.pots = this.entityRepository('pots');
    this.potLedgerEntries = this.entityRepository('potLedgerEntries');
    this.subscriptions = this.entityRepository('subscriptions');
    this.subscriptionPreferences = this.entityRepository('subscriptionPreferences');
    this.cycleRecords = this.entityRepository('cycleRecords');
    this.debts = this.entityRepository('debts');
    this.financialContexts = this.entityRepository('financialContexts');
    this.incomeSchedules = this.entityRepository('incomeSchedules');
    this.transactionIntelligenceStates = this.entityRepository('transactionIntelligenceStates');
    this.companionRuntimeStates = this.entityRepository('companionRuntimeStates');
    this.auditLog = this.entityRepository('auditLog');
  }

  acceptReviewedImportDraft(input: ImportDraftAcceptanceInput): FinancialTransaction {
    const draft = this.importDrafts.get(input.draftId);
    if (draft === undefined) {
      throw new Error(`Import draft ${String(input.draftId)} does not exist.`);
    }
    if (
      draft.reviewState !== 'ready-for-user-confirmation' ||
      draft.userConfirmationState !== 'requested'
    ) {
      throw new Error('Import drafts cannot commit before user review is ready.');
    }
    if (input.transaction.reviewStatus !== 'accepted') {
      throw new Error('Accepted import transactions must use accepted review status.');
    }
    assertSameWorkspace(this.workspaceId, input.transaction.workspaceId, 'transaction.workspaceId');
    if (input.transaction.sourceRecordId !== draft.sourceRecordId) {
      throw new Error('Accepted import transaction must keep the reviewed source record.');
    }
    if (input.transaction.provenanceId !== draft.provenanceId) {
      throw new Error('Accepted import transaction must keep reviewed provenance.');
    }

    const acceptedDraft: ImportDraft = {
      ...draft,
      reviewState: 'user-confirmed',
      userConfirmationState: 'confirmed',
      version: nextEntityVersion(draft.version),
    };

    this.importDrafts.put(acceptedDraft);
    const transaction = this.transactions.put(input.transaction);
    if (input.event !== undefined) this.events.put(input.event);
    if (input.calendarItem !== undefined) this.calendarItems.put(input.calendarItem);
    if (input.timelineEntry !== undefined) this.timelineEntries.put(input.timelineEntry);
    this.decisions.put(input.decision);
    this.auditLog.put(input.auditEntry);

    return transaction;
  }

  rejectImportDraft(input: ImportDraftRejectionInput): ImportDraft {
    const draft = this.importDrafts.get(input.draftId);
    if (draft === undefined) {
      throw new Error(`Import draft ${String(input.draftId)} does not exist.`);
    }

    const rejectedDraft: ImportDraft = {
      ...draft,
      reviewState: 'dismissed',
      userConfirmationState: 'rejected',
      version: nextEntityVersion(draft.version),
    };

    this.importDrafts.put(rejectedDraft);
    if (input.timelineEntry !== undefined) this.timelineEntries.put(input.timelineEntry);
    this.decisions.put(input.decision);
    this.auditLog.put(input.auditEntry);

    return rejectedDraft;
  }

  acceptScenario(input: ScenarioAcceptanceInput): Scenario {
    const scenario = this.scenarios.get(input.scenarioId);
    if (scenario === undefined) {
      throw new Error(`Scenario ${String(input.scenarioId)} does not exist.`);
    }
    assertScenarioAcceptancePlanUpdates(scenario, input);

    const acceptedScenario: Scenario = {
      ...scenario,
      status: 'accepted',
      version: nextEntityVersion(scenario.version),
    };

    this.scenarios.put(acceptedScenario);
    for (const plan of input.planUpdates ?? []) this.plans.put(plan);
    for (const impact of input.planImpacts ?? []) this.planImpacts.put(impact);
    for (const item of input.calendarItems ?? []) this.calendarItems.put(item);
    if (input.timelineEntry !== undefined) this.timelineEntries.put(input.timelineEntry);
    this.decisions.put(input.decision);
    this.auditLog.put(input.auditEntry);

    return acceptedScenario;
  }

  reviewMeloProposal(input: MeloProposalReviewInput): MeloProposalRecord {
    const proposal = this.meloProposals.get(input.proposalId);
    if (proposal === undefined) {
      throw new Error(`Melo proposal ${String(input.proposalId)} does not exist.`);
    }
    if (proposal.canWriteDirectly !== false) {
      throw new Error('Melo proposals must remain review-only.');
    }

    const reviewedProposal: MeloProposalRecord = {
      ...proposal,
      status: input.status,
      version: nextEntityVersion(proposal.version),
    };

    this.meloProposals.put(reviewedProposal);
    if (input.memory !== undefined) this.meloMemory.put(input.memory);
    this.decisions.put(input.decision);
    this.auditLog.put(input.auditEntry);

    return reviewedProposal;
  }

  snapshot(): CanonicalRepositorySnapshot {
    return {
      schema: canonicalLocalRepositorySchema,
      workspaceId: this.workspaceId,
      collections: {
        workspaces: this.workspaces.list(),
        accounts: this.accounts.list(),
        balanceObservations: this.balanceObservations.list(),
        currentBalances: this.currentBalances.list(),
        balanceAdjustments: this.balanceAdjustments.list(),
        availablePositionSnapshots: this.availablePositionSnapshots.list(),
        sourceRecords: this.sourceRecords.list(),
        provenance: this.provenance.list(),
        parsedRows: this.parsedRows.list(),
        importedClaims: this.importedClaims.list(),
        importDrafts: this.importDrafts.list(),
        userCorrections: this.userCorrections.list(),
        transactions: this.transactions.list(),
        events: this.events.list(),
        commitments: this.commitments.list(),
        expectations: this.expectations.list(),
        plannerItems: this.plannerItems.list(),
        plans: this.plans.list(),
        planRules: this.planRules.list(),
        scenarios: this.scenarios.list(),
        planImpacts: this.planImpacts.list(),
        forecastSnapshots: this.forecastSnapshots.list(),
        decisions: this.decisions.list(),
        documents: this.documents.list(),
        documentAttachments: this.documentAttachments.list(),
        calendarItems: this.calendarItems.list(),
        timelineEntries: this.timelineEntries.list(),
        meloMemory: this.meloMemory.list(),
        meloProposals: this.meloProposals.list(),
        pots: this.pots.list(),
        potLedgerEntries: this.potLedgerEntries.list(),
        subscriptions: this.subscriptions.list(),
        subscriptionPreferences: this.subscriptionPreferences.list(),
        cycleRecords: this.cycleRecords.list(),
        debts: this.debts.list(),
        financialContexts: this.financialContexts.list(),
        incomeSchedules: this.incomeSchedules.list(),
        transactionIntelligenceStates: this.transactionIntelligenceStates.list(),
        companionRuntimeStates: this.companionRuntimeStates.list(),
        auditLog: this.auditLog.list(),
      },
    };
  }

  private entityRepository<TName extends EntityCollectionName>(
    name: TName,
  ): CanonicalEntityRepository<Extract<EntityForCollection<TName>, WorkspaceRecord>> {
    return new InMemoryCanonicalEntityRepository(
      this.workspaceId,
      name,
      this.state[name] as unknown as Map<
        string,
        Extract<EntityForCollection<TName>, WorkspaceRecord>
      >,
      this,
    );
  }

  assertEntityCanBeStored<TEntity extends WorkspaceRecord>(
    collection: EntityCollectionName,
    record: TEntity,
    existing: TEntity | undefined,
  ): void {
    assertSameWorkspace(this.workspaceId, record.workspaceId, `${collection}.workspaceId`);
    if (existing?.provenanceId !== undefined && record.provenanceId === undefined) {
      throw new Error(`${collection} edits must preserve existing provenance.`);
    }
    this.assertReferencedWorkspace(collection, record);
    this.assertCollectionRules(collection, record);
  }

  private assertReferencedWorkspace<TEntity extends WorkspaceRecord>(
    collection: EntityCollectionName,
    record: TEntity,
  ): void {
    if (record.provenanceId !== undefined) {
      this.assertIdBelongsToWorkspace('provenance', record.provenanceId, collection);
    }
    if (record.sourceRecordId !== undefined) {
      this.assertIdBelongsToWorkspace('sourceRecords', record.sourceRecordId, collection);
    }
    if ('sourceRecordIds' in record) {
      for (const id of readStringArray(record.sourceRecordIds)) {
        this.assertIdBelongsToWorkspace('sourceRecords', id, collection);
      }
    }
    if ('sourceRecordId' in record && record.sourceRecordId !== undefined) {
      this.assertIdBelongsToWorkspace('sourceRecords', String(record.sourceRecordId), collection);
    }
    if ('accountId' in record && record.accountId !== undefined) {
      this.assertIdBelongsToWorkspace('accounts', String(record.accountId), collection);
    }
    if ('sourceObservationId' in record && record.sourceObservationId !== undefined) {
      this.assertIdBelongsToWorkspace(
        'balanceObservations',
        String(record.sourceObservationId),
        collection,
      );
    }
    if ('resultingObservationId' in record && record.resultingObservationId !== undefined) {
      this.assertIdBelongsToWorkspace(
        'balanceObservations',
        String(record.resultingObservationId),
        collection,
      );
    }
    if ('parsedRowId' in record && record.parsedRowId !== undefined) {
      this.assertIdBelongsToWorkspace('parsedRows', String(record.parsedRowId), collection, {
        allowMissing: true,
      });
    }
    if ('importDraftId' in record && record.importDraftId !== undefined) {
      this.assertIdBelongsToWorkspace('importDrafts', String(record.importDraftId), collection, {
        allowMissing: true,
      });
    }
    if ('importedClaimId' in record && record.importedClaimId !== undefined) {
      this.assertIdBelongsToWorkspace(
        'importedClaims',
        String(record.importedClaimId),
        collection,
        {
          allowMissing: true,
        },
      );
    }
    if ('documentId' in record && record.documentId !== undefined) {
      this.assertIdBelongsToWorkspace('documents', String(record.documentId), collection, {
        allowMissing: true,
      });
    }
    if ('decisionId' in record && record.decisionId !== undefined) {
      this.assertIdBelongsToWorkspace('decisions', String(record.decisionId), collection, {
        allowMissing: true,
      });
    }
    if ('auditLogId' in record && record.auditLogId !== undefined) {
      this.assertIdBelongsToWorkspace('auditLog', String(record.auditLogId), collection, {
        allowMissing: true,
      });
    }
    if ('proposedTransactionId' in record && record.proposedTransactionId !== undefined) {
      this.assertIdBelongsToWorkspace(
        'transactions',
        String(record.proposedTransactionId),
        collection,
        { allowMissing: true },
      );
    }
    if ('acceptedTransactionId' in record && record.acceptedTransactionId !== undefined) {
      this.assertIdBelongsToWorkspace(
        'transactions',
        String(record.acceptedTransactionId),
        collection,
        { allowMissing: true },
      );
    }
    if ('transactionIds' in record) {
      for (const id of readStringArray(record.transactionIds)) {
        this.assertIdBelongsToWorkspace('transactions', id, collection, { allowMissing: true });
      }
    }
    if ('eventIds' in record) {
      for (const id of readStringArray(record.eventIds)) {
        this.assertIdBelongsToWorkspace('events', id, collection, { allowMissing: true });
      }
    }
    if ('eventId' in record && record.eventId !== undefined) {
      this.assertIdBelongsToWorkspace('events', String(record.eventId), collection, {
        allowMissing: true,
      });
    }
    if ('calculatedFromTransactionIds' in record) {
      for (const id of readStringArray(record.calculatedFromTransactionIds)) {
        this.assertIdBelongsToWorkspace('transactions', id, collection, { allowMissing: true });
      }
    }
    if ('currentBalanceIds' in record) {
      for (const id of readStringArray(record.currentBalanceIds)) {
        this.assertIdBelongsToWorkspace('currentBalances', id, collection);
      }
    }
    if ('balanceObservationIds' in record) {
      for (const id of readStringArray(record.balanceObservationIds)) {
        this.assertIdBelongsToWorkspace('balanceObservations', id, collection);
      }
    }
    if ('expectationIds' in record) {
      for (const id of readStringArray(record.expectationIds)) {
        this.assertIdBelongsToWorkspace('expectations', id, collection, { allowMissing: true });
      }
    }
    if ('commitmentIds' in record) {
      for (const id of readStringArray(record.commitmentIds)) {
        this.assertIdBelongsToWorkspace('commitments', id, collection, { allowMissing: true });
      }
    }
    if ('planId' in record && record.planId !== undefined) {
      this.assertIdBelongsToWorkspace('plans', String(record.planId), collection);
    }
    if ('ruleIds' in record) {
      for (const id of readStringArray(record.ruleIds)) {
        this.assertIdBelongsToWorkspace('planRules', id, collection, { allowMissing: true });
      }
    }
    if ('planRuleId' in record && record.planRuleId !== undefined) {
      this.assertIdBelongsToWorkspace('planRules', String(record.planRuleId), collection);
    }
    if ('impactIds' in record) {
      for (const id of readStringArray(record.impactIds)) {
        this.assertIdBelongsToWorkspace('planImpacts', id, collection, { allowMissing: true });
      }
    }
    if ('planImpactId' in record && record.planImpactId !== undefined) {
      this.assertIdBelongsToWorkspace('planImpacts', String(record.planImpactId), collection);
    }
    if ('scenarioIds' in record) {
      for (const id of readStringArray(record.scenarioIds)) {
        this.assertIdBelongsToWorkspace('scenarios', id, collection, { allowMissing: true });
      }
    }
    if ('scenarioId' in record && record.scenarioId !== undefined) {
      this.assertIdBelongsToWorkspace('scenarios', String(record.scenarioId), collection);
    }
    if ('affectedPlanIds' in record) {
      for (const id of readStringArray(record.affectedPlanIds)) {
        this.assertIdBelongsToWorkspace('plans', id, collection, { allowMissing: true });
      }
    }
  }

  private assertCollectionRules<TEntity extends WorkspaceRecord>(
    collection: EntityCollectionName,
    record: TEntity,
  ): void {
    if (collection === 'transactions') {
      const transaction = record as unknown as FinancialTransaction;
      if (transaction.sourceRecordId === undefined || transaction.provenanceId === undefined) {
        throw new Error('Canonical transactions require source record and provenance.');
      }
    }
    if (collection === 'balanceObservations') {
      const observation = record as unknown as BalanceObservation;
      if (observation.sourceRecordId === undefined || observation.provenanceId === undefined) {
        throw new Error('Balance observations require source record and provenance.');
      }
    }
    if (collection === 'currentBalances') {
      const balance = record as unknown as CurrentBalance;
      if (balance.sourceObservationId === undefined) {
        throw new Error('Current balances require a source balance observation.');
      }
    }
    if (collection === 'availablePositionSnapshots') {
      const position = record as unknown as AvailablePositionSnapshot;
      if (position.currentBalanceIds.length === 0 || position.balanceObservationIds.length === 0) {
        throw new Error('Available position snapshots require balance sources.');
      }
    }
    if (collection === 'plans') {
      const plan = record as unknown as Plan;
      if (plan.provenanceId === undefined) {
        throw new Error('Plans require provenance.');
      }
    }
    if (collection === 'planRules') {
      const rule = record as unknown as PlanRule;
      if (
        rule.minimumBuffer === undefined &&
        rule.protectedAmount === undefined &&
        rule.targetContribution === undefined &&
        rule.deadline === undefined
      ) {
        throw new Error('Plan rules require at least one configured constraint.');
      }
    }
    if (collection === 'planImpacts') {
      const impact = record as unknown as PlanImpact;
      if (impact.changedRecordIds.length === 0 || impact.newProjectedOutcome.trim().length === 0) {
        throw new Error('Plan impacts require changed records and a projected outcome.');
      }
    }
    if (collection === 'importDrafts') {
      const draft = record as unknown as ImportDraft;
      this.assertIdBelongsToWorkspace('sourceRecords', draft.sourceRecordId, collection);
      this.assertIdBelongsToWorkspace('provenance', draft.provenanceId, collection);
    }
    if (collection === 'parsedRows') {
      const row = record as unknown as ParsedRow;
      if (row.rawText.trim().length === 0 || row.parserName.trim().length === 0) {
        throw new Error('Parsed rows require raw source text and parser name.');
      }
    }
    if (collection === 'importedClaims') {
      const claim = record as unknown as ImportedClaim;
      if (claim.originalText.trim().length === 0 || claim.interpretedTitle.trim().length === 0) {
        throw new Error('Imported claims require original source text and an interpretation.');
      }
    }
    if (collection === 'userCorrections') {
      const correction = record as unknown as UserCorrection;
      if (
        correction.originalValue.trim().length === 0 ||
        correction.correctedValue.trim().length === 0
      ) {
        throw new Error('User corrections require original and corrected values.');
      }
    }
    if (collection === 'documentAttachments') {
      const attachment = record as unknown as DocumentAttachment;
      this.assertIdBelongsToWorkspace('documents', attachment.documentId, collection);
      if (attachment.targetId.trim().length === 0) {
        throw new Error('Document attachments require a target.');
      }
    }
    if (collection === 'meloProposals') {
      const proposal = record as unknown as MeloProposalRecord;
      if (proposal.canWriteDirectly !== false) {
        throw new Error('Melo proposals must not be able to write directly.');
      }
    }
  }

  private assertIdBelongsToWorkspace(
    collection: EntityCollectionName,
    id: string,
    referringCollection: EntityCollectionName,
    options: Readonly<{ allowMissing?: boolean }> = {},
  ): void {
    const targetWorkspace = this.findRecordWorkspace(collection, id);
    if (targetWorkspace === undefined) {
      if (options.allowMissing === true) return;
      throw new Error(`${referringCollection} references missing ${collection} record ${id}.`);
    }
    assertSameWorkspace(this.workspaceId, targetWorkspace, `${referringCollection}.${collection}`);
  }

  private findRecordWorkspace(
    collection: EntityCollectionName,
    id: string,
  ): WorkspaceId | undefined {
    const record = (this.state[collection] as EntityCollection).get(id) as
      | WorkspaceRecord
      | undefined;
    return record?.workspaceId;
  }
}

class InMemoryWorkspaceRepository implements CanonicalWorkspaceRepository {
  constructor(private readonly state: CanonicalMapState) {}

  list(): readonly Workspace[] {
    return [...this.state.workspaces.values()];
  }

  get(id: Workspace['id']): Workspace | undefined {
    return this.state.workspaces.get(String(id));
  }

  put(record: Workspace): Workspace {
    this.state.workspaces.set(String(record.id), record);
    return record;
  }
}

class InMemoryCanonicalEntityRepository<
  TEntity extends WorkspaceRecord,
> implements CanonicalEntityRepository<TEntity> {
  constructor(
    readonly workspaceId: WorkspaceId,
    private readonly collection: EntityCollectionName,
    private readonly records: Map<string, TEntity>,
    private readonly parent: InMemoryCanonicalRepository,
  ) {}

  list(): readonly TEntity[] {
    return [...this.records.values()].filter((record) => record.workspaceId === this.workspaceId);
  }

  get(id: TEntity['id']): TEntity | undefined {
    const record = this.records.get(String(id));
    return record?.workspaceId === this.workspaceId ? record : undefined;
  }

  put(record: TEntity): TEntity {
    const key = String(record.id);
    const existing = this.records.get(key);
    this.parent.assertEntityCanBeStored(this.collection, record, existing);
    this.records.set(key, record);
    return record;
  }

  remove(id: TEntity['id']): boolean {
    const existing = this.get(id);
    if (existing === undefined) return false;
    return this.records.delete(String(id));
  }

  count(): number {
    return this.list().length;
  }
}

function createEmptyCanonicalMapState(): CanonicalMapState {
  return {
    workspaces: new Map(),
    accounts: new Map(),
    balanceObservations: new Map(),
    currentBalances: new Map(),
    balanceAdjustments: new Map(),
    availablePositionSnapshots: new Map(),
    sourceRecords: new Map(),
    provenance: new Map(),
    parsedRows: new Map(),
    importedClaims: new Map(),
    importDrafts: new Map(),
    userCorrections: new Map(),
    transactions: new Map(),
    events: new Map(),
    commitments: new Map(),
    expectations: new Map(),
    plannerItems: new Map(),
    plans: new Map(),
    planRules: new Map(),
    scenarios: new Map(),
    planImpacts: new Map(),
    forecastSnapshots: new Map(),
    decisions: new Map(),
    documents: new Map(),
    documentAttachments: new Map(),
    calendarItems: new Map(),
    timelineEntries: new Map(),
    meloMemory: new Map(),
    meloProposals: new Map(),
    pots: new Map(),
    potLedgerEntries: new Map(),
    subscriptions: new Map(),
    subscriptionPreferences: new Map(),
    cycleRecords: new Map(),
    debts: new Map(),
    financialContexts: new Map(),
    incomeSchedules: new Map(),
    transactionIntelligenceStates: new Map(),
    companionRuntimeStates: new Map(),
    auditLog: new Map(),
  };
}

function readStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function assertScenarioAcceptancePlanUpdates(
  scenario: Scenario,
  input: ScenarioAcceptanceInput,
): void {
  const affectedPlanIds = new Set(scenario.affectedPlanIds.map(String));
  for (const plan of input.planUpdates ?? []) {
    if (!affectedPlanIds.has(String(plan.id))) {
      throw new Error(`Scenario acceptance cannot update unaffected plan ${String(plan.id)}.`);
    }
    if (!(plan.scenarioIds ?? []).some((id) => id === input.scenarioId)) {
      throw new Error('Accepted scenario plan updates must link the accepted scenario.');
    }
    if (!(plan.decisionIds ?? []).some((id) => id === input.decision.id)) {
      throw new Error('Accepted scenario plan updates must link the user decision.');
    }
    if (!(plan.auditLogIds ?? []).some((id) => id === input.auditEntry.id)) {
      throw new Error('Accepted scenario plan updates must link the audit entry.');
    }
  }

  for (const impact of input.planImpacts ?? []) {
    if (!affectedPlanIds.has(String(impact.planId))) {
      throw new Error(
        `Scenario acceptance cannot write impact for unaffected plan ${String(impact.planId)}.`,
      );
    }
    if (!impact.scenarioIds.some((id) => id === input.scenarioId)) {
      throw new Error('Accepted scenario plan impacts must link the accepted scenario.');
    }
  }
}
