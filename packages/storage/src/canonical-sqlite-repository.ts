import type {
  Account,
  AuditLogEntry,
  AvailablePositionSnapshot,
  BalanceAdjustment,
  BalanceObservation,
  CalendarItem,
  Commitment,
  CompanionRuntimeState,
  CurrentBalance,
  CycleRecord,
  DecisionRecord,
  Debt,
  DocumentAttachment,
  DocumentRecord,
  Event,
  FinancialExpectation,
  FinancialContext,
  FinancialTransaction,
  Forecast,
  ImportedClaim,
  IncomeSchedule,
  ImportDraft,
  MeloMemory,
  MeloProposalRecord,
  ParsedRow,
  Plan,
  PlanImpact,
  PlanRule,
  PlannerItem,
  Pot,
  PotLedgerEntry,
  Provenance,
  Scenario,
  SourceRecord,
  Subscription,
  SubscriptionPreference,
  TimelineEntry,
  TransactionIntelligenceState,
  UserCorrection,
  Workspace,
  WorkspaceId,
} from '@folio/domain';

import {
  canonicalLocalRepositorySchema,
  createCanonicalRepositoryFromSnapshot,
  type CanonicalEntityRepository,
  type CanonicalLocalPersistenceCollection,
  type CanonicalRepositorySnapshot,
  type ImportDraftAcceptanceInput,
  type ImportDraftRejectionInput,
  type MeloProposalReviewInput,
  type ScenarioAcceptanceInput,
} from './canonical-repository.js';
import {
  canonicalSqliteCollectionTables,
  canonicalSqliteRepositoryMigrationTable,
  canonicalSqliteRepositoryMigrations,
  type CanonicalSqliteRepositoryMigrationPlan,
} from './canonical-sqlite-schema.js';
import type { DatabaseDriver } from './driver.js';
import { executeSqlBatch, planMigrations, type AppliedMigration } from './migrations.js';

const canonicalAuditCommandType = 'canonical.audit_log_entry';

type WorkspaceRecord = Readonly<{
  id: string;
  workspaceId: WorkspaceId;
}>;

type EntityCollectionName = Exclude<CanonicalLocalPersistenceCollection, 'workspaces'>;

type EntityForCollection<TName extends EntityCollectionName> = {
  accounts: Account;
  balanceObservations: BalanceObservation;
  currentBalances: CurrentBalance;
  balanceAdjustments: BalanceAdjustment;
  availablePositionSnapshots: AvailablePositionSnapshot;
  sourceRecords: SourceRecord;
  provenance: Provenance;
  parsedRows: ParsedRow;
  importedClaims: ImportedClaim;
  importDrafts: ImportDraft;
  userCorrections: UserCorrection;
  transactions: FinancialTransaction;
  events: Event;
  commitments: Commitment;
  expectations: FinancialExpectation;
  plannerItems: PlannerItem;
  plans: Plan;
  planRules: PlanRule;
  scenarios: Scenario;
  planImpacts: PlanImpact;
  forecastSnapshots: Forecast;
  decisions: DecisionRecord;
  documents: DocumentRecord;
  documentAttachments: DocumentAttachment;
  calendarItems: CalendarItem;
  timelineEntries: TimelineEntry;
  meloMemory: MeloMemory;
  meloProposals: MeloProposalRecord;
  pots: Pot;
  potLedgerEntries: PotLedgerEntry;
  subscriptions: Subscription;
  subscriptionPreferences: SubscriptionPreference;
  cycleRecords: CycleRecord;
  debts: Debt;
  financialContexts: FinancialContext;
  incomeSchedules: IncomeSchedule;
  transactionIntelligenceStates: TransactionIntelligenceState;
  companionRuntimeStates: CompanionRuntimeState;
  auditLog: AuditLogEntry;
}[TName];

type RecordJsonRow = Readonly<{
  record_json?: unknown;
}>;

type AuditJsonRow = Readonly<{
  delta_json?: unknown;
}>;

type CountRow = Readonly<{
  count?: unknown;
}>;

type MigrationRow = Readonly<{
  version: number;
  name: string;
  checksum: string;
  applied_at?: string;
}>;

export type CanonicalSqliteWriteEvent = Readonly<{
  operation: 'upsert' | 'delete' | 'clear';
  collection: CanonicalLocalPersistenceCollection;
  id?: string;
  workspaceId?: WorkspaceId;
}>;

export type CanonicalSqliteRepositoryOptions = Readonly<{
  now?: () => Date;
  writeHook?: (event: CanonicalSqliteWriteEvent) => void | Promise<void>;
}>;

export interface AsyncCanonicalWorkspaceRepository {
  list(): Promise<readonly Workspace[]>;
  get(id: Workspace['id']): Promise<Workspace | undefined>;
  put(record: Workspace): Promise<Workspace>;
}

export interface AsyncCanonicalEntityRepository<TEntity extends WorkspaceRecord> {
  readonly workspaceId: WorkspaceId;
  list(): Promise<readonly TEntity[]>;
  get(id: TEntity['id']): Promise<TEntity | undefined>;
  put(record: TEntity): Promise<TEntity>;
  remove(id: TEntity['id']): Promise<boolean>;
  count(): Promise<number>;
}

export interface AsyncCanonicalRepository {
  readonly schema: typeof canonicalLocalRepositorySchema;
  readonly workspaceId: WorkspaceId;
  readonly workspaces: AsyncCanonicalWorkspaceRepository;
  readonly accounts: AsyncCanonicalEntityRepository<Account>;
  readonly balanceObservations: AsyncCanonicalEntityRepository<BalanceObservation>;
  readonly currentBalances: AsyncCanonicalEntityRepository<CurrentBalance>;
  readonly balanceAdjustments: AsyncCanonicalEntityRepository<BalanceAdjustment>;
  readonly availablePositionSnapshots: AsyncCanonicalEntityRepository<AvailablePositionSnapshot>;
  readonly sourceRecords: AsyncCanonicalEntityRepository<SourceRecord>;
  readonly provenance: AsyncCanonicalEntityRepository<Provenance>;
  readonly parsedRows: AsyncCanonicalEntityRepository<ParsedRow>;
  readonly importedClaims: AsyncCanonicalEntityRepository<ImportedClaim>;
  readonly importDrafts: AsyncCanonicalEntityRepository<ImportDraft>;
  readonly userCorrections: AsyncCanonicalEntityRepository<UserCorrection>;
  readonly transactions: AsyncCanonicalEntityRepository<FinancialTransaction>;
  readonly events: AsyncCanonicalEntityRepository<Event>;
  readonly commitments: AsyncCanonicalEntityRepository<Commitment>;
  readonly expectations: AsyncCanonicalEntityRepository<FinancialExpectation>;
  readonly plannerItems: AsyncCanonicalEntityRepository<PlannerItem>;
  readonly plans: AsyncCanonicalEntityRepository<Plan>;
  readonly planRules: AsyncCanonicalEntityRepository<PlanRule>;
  readonly scenarios: AsyncCanonicalEntityRepository<Scenario>;
  readonly planImpacts: AsyncCanonicalEntityRepository<PlanImpact>;
  readonly forecastSnapshots: AsyncCanonicalEntityRepository<Forecast>;
  readonly decisions: AsyncCanonicalEntityRepository<DecisionRecord>;
  readonly auditLog: AsyncCanonicalEntityRepository<AuditLogEntry>;
  readonly meloMemory: AsyncCanonicalEntityRepository<MeloMemory>;
  readonly meloProposals: AsyncCanonicalEntityRepository<MeloProposalRecord>;
  readonly pots: AsyncCanonicalEntityRepository<Pot>;
  readonly potLedgerEntries: AsyncCanonicalEntityRepository<PotLedgerEntry>;
  readonly subscriptions: AsyncCanonicalEntityRepository<Subscription>;
  readonly subscriptionPreferences: AsyncCanonicalEntityRepository<SubscriptionPreference>;
  readonly cycleRecords: AsyncCanonicalEntityRepository<CycleRecord>;
  readonly debts: AsyncCanonicalEntityRepository<Debt>;
  readonly financialContexts: AsyncCanonicalEntityRepository<FinancialContext>;
  readonly incomeSchedules: AsyncCanonicalEntityRepository<IncomeSchedule>;
  readonly transactionIntelligenceStates: AsyncCanonicalEntityRepository<TransactionIntelligenceState>;
  readonly companionRuntimeStates: AsyncCanonicalEntityRepository<CompanionRuntimeState>;
  readonly documents: AsyncCanonicalEntityRepository<DocumentRecord>;
  readonly documentAttachments: AsyncCanonicalEntityRepository<DocumentAttachment>;
  readonly calendarItems: AsyncCanonicalEntityRepository<CalendarItem>;
  readonly timelineEntries: AsyncCanonicalEntityRepository<TimelineEntry>;
  acceptReviewedImportDraft(input: ImportDraftAcceptanceInput): Promise<FinancialTransaction>;
  rejectImportDraft(input: ImportDraftRejectionInput): Promise<ImportDraft>;
  acceptScenario(input: ScenarioAcceptanceInput): Promise<Scenario>;
  reviewMeloProposal(input: MeloProposalReviewInput): Promise<MeloProposalRecord>;
  snapshot(): Promise<CanonicalRepositorySnapshot>;
}

export async function openSqliteCanonicalRepository(
  driver: DatabaseDriver,
  workspaceId: WorkspaceId,
  options: CanonicalSqliteRepositoryOptions = {},
): Promise<AsyncCanonicalRepository> {
  await applyCanonicalSqliteRepositoryMigrations(driver, migrationOptions(options));
  return new SqliteCanonicalRepository(driver, workspaceId, options);
}

export async function migrateCanonicalSnapshotToSqliteRepository(
  driver: DatabaseDriver,
  snapshot: CanonicalRepositorySnapshot,
  options: CanonicalSqliteRepositoryOptions = {},
): Promise<AsyncCanonicalRepository> {
  const validated = createCanonicalRepositoryFromSnapshot(snapshot).snapshot();
  await applyCanonicalSqliteRepositoryMigrations(driver, migrationOptions(options));

  await driver.transaction(async (transactionDriver) => {
    const repository = new SqliteCanonicalRepository(
      transactionDriver,
      validated.workspaceId,
      options,
    );
    await repository.clearWorkspaceRows(validated.workspaceId);
    await repository.writeSnapshot(validated);
  });

  return new SqliteCanonicalRepository(driver, validated.workspaceId, options);
}

export async function applyCanonicalSqliteRepositoryMigrations(
  driver: DatabaseDriver,
  options: Pick<CanonicalSqliteRepositoryOptions, 'now'> = {},
): Promise<CanonicalSqliteRepositoryMigrationPlan> {
  return driver.transaction(async (transactionDriver) => {
    await ensureCanonicalMigrationTable(transactionDriver);
    const applied = await readAppliedCanonicalSqliteRepositoryMigrations(transactionDriver);
    const plan = planMigrations(applied, canonicalSqliteRepositoryMigrations);

    for (const migration of plan.pending) {
      await executeSqlBatch(transactionDriver, migration.sql);
      await transactionDriver.execute(
        `INSERT INTO ${canonicalSqliteRepositoryMigrationTable} (
          version, name, checksum, applied_at
        ) VALUES (?, ?, ?, ?)`,
        [
          migration.version,
          migration.name,
          migration.checksum,
          (options.now?.() ?? new Date()).toISOString(),
        ],
      );
    }

    return plan;
  });
}

export async function readAppliedCanonicalSqliteRepositoryMigrations(
  driver: DatabaseDriver,
): Promise<readonly AppliedMigration[]> {
  const result = await driver.execute<MigrationRow>(
    `SELECT version, name, checksum, applied_at
     FROM ${canonicalSqliteRepositoryMigrationTable}
     ORDER BY version`,
  );

  return result.rows.map((row) => ({
    version: row.version,
    name: row.name,
    checksum: row.checksum as AppliedMigration['checksum'],
    ...(row.applied_at === undefined ? {} : { appliedAt: row.applied_at }),
  }));
}

async function ensureCanonicalMigrationTable(driver: DatabaseDriver): Promise<void> {
  await driver.execute(`
    CREATE TABLE IF NOT EXISTS ${canonicalSqliteRepositoryMigrationTable} (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
}

class SqliteCanonicalRepository implements AsyncCanonicalRepository {
  readonly schema = canonicalLocalRepositorySchema;
  readonly workspaces: AsyncCanonicalWorkspaceRepository;
  readonly accounts: AsyncCanonicalEntityRepository<Account>;
  readonly balanceObservations: AsyncCanonicalEntityRepository<BalanceObservation>;
  readonly currentBalances: AsyncCanonicalEntityRepository<CurrentBalance>;
  readonly balanceAdjustments: AsyncCanonicalEntityRepository<BalanceAdjustment>;
  readonly availablePositionSnapshots: AsyncCanonicalEntityRepository<AvailablePositionSnapshot>;
  readonly sourceRecords: AsyncCanonicalEntityRepository<SourceRecord>;
  readonly provenance: AsyncCanonicalEntityRepository<Provenance>;
  readonly parsedRows: AsyncCanonicalEntityRepository<ParsedRow>;
  readonly importedClaims: AsyncCanonicalEntityRepository<ImportedClaim>;
  readonly importDrafts: AsyncCanonicalEntityRepository<ImportDraft>;
  readonly userCorrections: AsyncCanonicalEntityRepository<UserCorrection>;
  readonly transactions: AsyncCanonicalEntityRepository<FinancialTransaction>;
  readonly events: AsyncCanonicalEntityRepository<Event>;
  readonly commitments: AsyncCanonicalEntityRepository<Commitment>;
  readonly expectations: AsyncCanonicalEntityRepository<FinancialExpectation>;
  readonly plannerItems: AsyncCanonicalEntityRepository<PlannerItem>;
  readonly plans: AsyncCanonicalEntityRepository<Plan>;
  readonly planRules: AsyncCanonicalEntityRepository<PlanRule>;
  readonly scenarios: AsyncCanonicalEntityRepository<Scenario>;
  readonly planImpacts: AsyncCanonicalEntityRepository<PlanImpact>;
  readonly forecastSnapshots: AsyncCanonicalEntityRepository<Forecast>;
  readonly decisions: AsyncCanonicalEntityRepository<DecisionRecord>;
  readonly documents: AsyncCanonicalEntityRepository<DocumentRecord>;
  readonly documentAttachments: AsyncCanonicalEntityRepository<DocumentAttachment>;
  readonly calendarItems: AsyncCanonicalEntityRepository<CalendarItem>;
  readonly timelineEntries: AsyncCanonicalEntityRepository<TimelineEntry>;
  readonly meloMemory: AsyncCanonicalEntityRepository<MeloMemory>;
  readonly meloProposals: AsyncCanonicalEntityRepository<MeloProposalRecord>;
  readonly pots: AsyncCanonicalEntityRepository<Pot>;
  readonly potLedgerEntries: AsyncCanonicalEntityRepository<PotLedgerEntry>;
  readonly subscriptions: AsyncCanonicalEntityRepository<Subscription>;
  readonly subscriptionPreferences: AsyncCanonicalEntityRepository<SubscriptionPreference>;
  readonly cycleRecords: AsyncCanonicalEntityRepository<CycleRecord>;
  readonly debts: AsyncCanonicalEntityRepository<Debt>;
  readonly financialContexts: AsyncCanonicalEntityRepository<FinancialContext>;
  readonly incomeSchedules: AsyncCanonicalEntityRepository<IncomeSchedule>;
  readonly transactionIntelligenceStates: AsyncCanonicalEntityRepository<TransactionIntelligenceState>;
  readonly companionRuntimeStates: AsyncCanonicalEntityRepository<CompanionRuntimeState>;
  readonly auditLog: AsyncCanonicalEntityRepository<AuditLogEntry>;

  constructor(
    private readonly driver: DatabaseDriver,
    readonly workspaceId: WorkspaceId,
    private readonly options: CanonicalSqliteRepositoryOptions,
  ) {
    this.workspaces = new SqliteWorkspaceRepository(this);
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

  async acceptReviewedImportDraft(
    input: ImportDraftAcceptanceInput,
  ): Promise<FinancialTransaction> {
    return this.driver.transaction(async (transactionDriver) => {
      const repository = this.withDriver(transactionDriver);
      const memory = await repository.createValidationRepository();
      const transaction = memory.acceptReviewedImportDraft(input);
      const acceptedDraft = memory.importDrafts.get(input.draftId);
      if (acceptedDraft === undefined) {
        throw new Error(`Accepted import draft ${String(input.draftId)} could not be reloaded.`);
      }

      await repository.writeEntity('importDrafts', acceptedDraft);
      await repository.writeEntity('transactions', transaction);
      if (input.event !== undefined) await repository.writeEntity('events', input.event);
      if (input.calendarItem !== undefined) {
        await repository.writeEntity('calendarItems', input.calendarItem);
      }
      if (input.timelineEntry !== undefined) {
        await repository.writeEntity('timelineEntries', input.timelineEntry);
      }
      await repository.writeEntity('decisions', input.decision);
      await repository.writeEntity('auditLog', input.auditEntry);

      return transaction;
    });
  }

  async rejectImportDraft(input: ImportDraftRejectionInput): Promise<ImportDraft> {
    return this.driver.transaction(async (transactionDriver) => {
      const repository = this.withDriver(transactionDriver);
      const memory = await repository.createValidationRepository();
      const rejectedDraft = memory.rejectImportDraft(input);

      await repository.writeEntity('importDrafts', rejectedDraft);
      if (input.timelineEntry !== undefined) {
        await repository.writeEntity('timelineEntries', input.timelineEntry);
      }
      await repository.writeEntity('decisions', input.decision);
      await repository.writeEntity('auditLog', input.auditEntry);

      return rejectedDraft;
    });
  }

  async acceptScenario(input: ScenarioAcceptanceInput): Promise<Scenario> {
    return this.driver.transaction(async (transactionDriver) => {
      const repository = this.withDriver(transactionDriver);
      const memory = await repository.createValidationRepository();
      const scenario = memory.acceptScenario(input);

      await repository.writeEntity('scenarios', scenario);
      for (const plan of input.planUpdates ?? []) {
        await repository.writeEntity('plans', plan);
      }
      for (const impact of input.planImpacts ?? []) {
        await repository.writeEntity('planImpacts', impact);
      }
      for (const item of input.calendarItems ?? []) {
        await repository.writeEntity('calendarItems', item);
      }
      if (input.timelineEntry !== undefined) {
        await repository.writeEntity('timelineEntries', input.timelineEntry);
      }
      await repository.writeEntity('decisions', input.decision);
      await repository.writeEntity('auditLog', input.auditEntry);

      return scenario;
    });
  }

  async reviewMeloProposal(input: MeloProposalReviewInput): Promise<MeloProposalRecord> {
    return this.driver.transaction(async (transactionDriver) => {
      const repository = this.withDriver(transactionDriver);
      const memory = await repository.createValidationRepository();
      const proposal = memory.reviewMeloProposal(input);

      await repository.writeEntity('meloProposals', proposal);
      if (input.memory !== undefined) await repository.writeEntity('meloMemory', input.memory);
      await repository.writeEntity('decisions', input.decision);
      await repository.writeEntity('auditLog', input.auditEntry);

      return proposal;
    });
  }

  async snapshot(): Promise<CanonicalRepositorySnapshot> {
    return {
      schema: canonicalLocalRepositorySchema,
      workspaceId: this.workspaceId,
      collections: {
        workspaces: await this.workspaces.list(),
        accounts: await this.accounts.list(),
        balanceObservations: await this.balanceObservations.list(),
        currentBalances: await this.currentBalances.list(),
        balanceAdjustments: await this.balanceAdjustments.list(),
        availablePositionSnapshots: await this.availablePositionSnapshots.list(),
        sourceRecords: await this.sourceRecords.list(),
        provenance: await this.provenance.list(),
        parsedRows: await this.parsedRows.list(),
        importedClaims: await this.importedClaims.list(),
        importDrafts: await this.importDrafts.list(),
        userCorrections: await this.userCorrections.list(),
        transactions: await this.transactions.list(),
        events: await this.events.list(),
        commitments: await this.commitments.list(),
        expectations: await this.expectations.list(),
        plannerItems: await this.plannerItems.list(),
        plans: await this.plans.list(),
        planRules: await this.planRules.list(),
        scenarios: await this.scenarios.list(),
        planImpacts: await this.planImpacts.list(),
        forecastSnapshots: await this.forecastSnapshots.list(),
        decisions: await this.decisions.list(),
        documents: await this.documents.list(),
        documentAttachments: await this.documentAttachments.list(),
        calendarItems: await this.calendarItems.list(),
        timelineEntries: await this.timelineEntries.list(),
        meloMemory: await this.meloMemory.list(),
        meloProposals: await this.meloProposals.list(),
        pots: await this.pots.list(),
        potLedgerEntries: await this.potLedgerEntries.list(),
        subscriptions: await this.subscriptions.list(),
        subscriptionPreferences: await this.subscriptionPreferences.list(),
        cycleRecords: await this.cycleRecords.list(),
        debts: await this.debts.list(),
        financialContexts: await this.financialContexts.list(),
        incomeSchedules: await this.incomeSchedules.list(),
        transactionIntelligenceStates: await this.transactionIntelligenceStates.list(),
        companionRuntimeStates: await this.companionRuntimeStates.list(),
        auditLog: await this.auditLog.list(),
      },
    };
  }

  async listWorkspaces(): Promise<readonly Workspace[]> {
    const result = await this.driver.execute<RecordJsonRow>(
      `SELECT record_json FROM ${canonicalSqliteCollectionTables.workspaces} ORDER BY id`,
    );
    return result.rows.map((row) => readRecordJson<Workspace>(row));
  }

  async getWorkspace(id: Workspace['id']): Promise<Workspace | undefined> {
    const result = await this.driver.execute<RecordJsonRow>(
      `SELECT record_json FROM ${canonicalSqliteCollectionTables.workspaces} WHERE id = ?`,
      [String(id)],
    );
    const row = result.rows[0];
    return row === undefined ? undefined : readRecordJson<Workspace>(row);
  }

  async putWorkspace(record: Workspace): Promise<Workspace> {
    return this.driver.transaction(async (transactionDriver) => {
      const repository = this.withDriver(transactionDriver);
      await repository.writeWorkspace(record);
      return record;
    });
  }

  async listEntities<TName extends EntityCollectionName>(
    collection: TName,
  ): Promise<readonly EntityForCollection<TName>[]> {
    if (collection === 'auditLog') {
      return (await this.listCanonicalAuditLog()) as readonly EntityForCollection<TName>[];
    }

    const result = await this.driver.execute<RecordJsonRow>(
      `SELECT record_json FROM ${entityTable(collection)} WHERE workspace_id = ? ORDER BY id`,
      [this.workspaceId],
    );
    return result.rows.map((row) => readRecordJson<EntityForCollection<TName>>(row));
  }

  async getEntity<TName extends EntityCollectionName>(
    collection: TName,
    id: string,
  ): Promise<EntityForCollection<TName> | undefined> {
    if (collection === 'auditLog') {
      return (await this.getCanonicalAuditEntry(String(id))) as
        | EntityForCollection<TName>
        | undefined;
    }

    const result = await this.driver.execute<RecordJsonRow>(
      `SELECT record_json FROM ${entityTable(collection)}
       WHERE id = ? AND workspace_id = ?`,
      [String(id), this.workspaceId],
    );
    const row = result.rows[0];
    return row === undefined ? undefined : readRecordJson<EntityForCollection<TName>>(row);
  }

  async putEntity<TName extends EntityCollectionName>(
    collection: TName,
    record: EntityForCollection<TName>,
  ): Promise<EntityForCollection<TName>> {
    return this.driver.transaction(async (transactionDriver) => {
      const repository = this.withDriver(transactionDriver);
      const validated = await repository.validateEntityPut(collection, record);
      await repository.writeEntity(collection, validated);
      return validated;
    });
  }

  async removeEntity<TName extends EntityCollectionName>(
    collection: TName,
    id: string,
  ): Promise<boolean> {
    return this.driver.transaction(async (transactionDriver) => {
      const repository = this.withDriver(transactionDriver);
      const existing = await repository.getEntity(collection, id);
      if (existing === undefined) return false;
      await repository.deleteEntity(collection, String(id));
      return true;
    });
  }

  async countEntities(collection: EntityCollectionName): Promise<number> {
    if (collection === 'auditLog') return this.countCanonicalAuditLog();

    const result = await this.driver.execute<CountRow>(
      `SELECT COUNT(*) AS count FROM ${entityTable(collection)} WHERE workspace_id = ?`,
      [this.workspaceId],
    );
    return readCount(result.rows[0]);
  }

  async clearWorkspaceRows(workspaceId: WorkspaceId): Promise<void> {
    for (const collection of entityCollectionNames) {
      if (collection === 'auditLog') {
        await this.driver.execute(
          `DELETE FROM ${canonicalSqliteCollectionTables.auditLog}
           WHERE workspace_id = ? AND command_type = ?`,
          [workspaceId, canonicalAuditCommandType],
        );
      } else {
        await this.driver.execute(`DELETE FROM ${entityTable(collection)} WHERE workspace_id = ?`, [
          workspaceId,
        ]);
      }
      await this.callWriteHook({ operation: 'clear', collection, workspaceId });
    }
  }

  async writeSnapshot(snapshot: CanonicalRepositorySnapshot): Promise<void> {
    for (const workspace of snapshot.collections.workspaces) await this.writeWorkspace(workspace);
    for (const account of snapshot.collections.accounts)
      await this.writeEntity('accounts', account);
    for (const source of snapshot.collections.sourceRecords) {
      await this.writeEntity('sourceRecords', source);
    }
    for (const provenance of snapshot.collections.provenance) {
      await this.writeEntity('provenance', provenance);
    }
    for (const row of snapshot.collections.parsedRows) {
      await this.writeEntity('parsedRows', row);
    }
    for (const claim of snapshot.collections.importedClaims) {
      await this.writeEntity('importedClaims', claim);
    }
    for (const observation of snapshot.collections.balanceObservations) {
      await this.writeEntity('balanceObservations', observation);
    }
    for (const balance of snapshot.collections.currentBalances) {
      await this.writeEntity('currentBalances', balance);
    }
    for (const adjustment of snapshot.collections.balanceAdjustments) {
      await this.writeEntity('balanceAdjustments', adjustment);
    }
    for (const position of snapshot.collections.availablePositionSnapshots) {
      await this.writeEntity('availablePositionSnapshots', position);
    }
    for (const document of snapshot.collections.documents) {
      await this.writeEntity('documents', document);
    }
    for (const attachment of snapshot.collections.documentAttachments) {
      await this.writeEntity('documentAttachments', attachment);
    }
    for (const draft of snapshot.collections.importDrafts) {
      await this.writeEntity('importDrafts', draft);
    }
    for (const correction of snapshot.collections.userCorrections) {
      await this.writeEntity('userCorrections', correction);
    }
    for (const transaction of snapshot.collections.transactions) {
      await this.writeEntity('transactions', transaction);
    }
    for (const event of snapshot.collections.events) await this.writeEntity('events', event);
    for (const commitment of snapshot.collections.commitments) {
      await this.writeEntity('commitments', commitment);
    }
    for (const expectation of snapshot.collections.expectations) {
      await this.writeEntity('expectations', expectation);
    }
    for (const item of snapshot.collections.plannerItems) {
      await this.writeEntity('plannerItems', item);
    }
    for (const plan of snapshot.collections.plans) await this.writeEntity('plans', plan);
    for (const rule of snapshot.collections.planRules) await this.writeEntity('planRules', rule);
    for (const scenario of snapshot.collections.scenarios) {
      await this.writeEntity('scenarios', scenario);
    }
    for (const impact of snapshot.collections.planImpacts) {
      await this.writeEntity('planImpacts', impact);
    }
    for (const forecast of snapshot.collections.forecastSnapshots) {
      await this.writeEntity('forecastSnapshots', forecast);
    }
    for (const decision of snapshot.collections.decisions) {
      await this.writeEntity('decisions', decision);
    }
    for (const item of snapshot.collections.calendarItems) {
      await this.writeEntity('calendarItems', item);
    }
    for (const entry of snapshot.collections.timelineEntries) {
      await this.writeEntity('timelineEntries', entry);
    }
    for (const memory of snapshot.collections.meloMemory) {
      await this.writeEntity('meloMemory', memory);
    }
    for (const proposal of snapshot.collections.meloProposals) {
      await this.writeEntity('meloProposals', proposal);
    }
    for (const pot of snapshot.collections.pots) await this.writeEntity('pots', pot);
    for (const entry of snapshot.collections.potLedgerEntries) {
      await this.writeEntity('potLedgerEntries', entry);
    }
    for (const subscription of snapshot.collections.subscriptions) {
      await this.writeEntity('subscriptions', subscription);
    }
    for (const preference of snapshot.collections.subscriptionPreferences) {
      await this.writeEntity('subscriptionPreferences', preference);
    }
    for (const cycle of snapshot.collections.cycleRecords) {
      await this.writeEntity('cycleRecords', cycle);
    }
    for (const debt of snapshot.collections.debts) await this.writeEntity('debts', debt);
    for (const context of snapshot.collections.financialContexts) {
      await this.writeEntity('financialContexts', context);
    }
    for (const schedule of snapshot.collections.incomeSchedules) {
      await this.writeEntity('incomeSchedules', schedule);
    }
    for (const intelligence of snapshot.collections.transactionIntelligenceStates) {
      await this.writeEntity('transactionIntelligenceStates', intelligence);
    }
    for (const runtime of snapshot.collections.companionRuntimeStates) {
      await this.writeEntity('companionRuntimeStates', runtime);
    }
    for (const entry of snapshot.collections.auditLog) await this.writeEntity('auditLog', entry);
  }

  private entityRepository<TName extends EntityCollectionName>(
    collection: TName,
  ): AsyncCanonicalEntityRepository<Extract<EntityForCollection<TName>, WorkspaceRecord>> {
    return new SqliteCanonicalEntityRepository(this, collection) as AsyncCanonicalEntityRepository<
      Extract<EntityForCollection<TName>, WorkspaceRecord>
    >;
  }

  private withDriver(driver: DatabaseDriver): SqliteCanonicalRepository {
    return new SqliteCanonicalRepository(driver, this.workspaceId, this.options);
  }

  private async createValidationRepository() {
    return createCanonicalRepositoryFromSnapshot(await this.snapshot());
  }

  private async validateEntityPut<TName extends EntityCollectionName>(
    collection: TName,
    record: EntityForCollection<TName>,
  ): Promise<EntityForCollection<TName>> {
    const repository = await this.createValidationRepository();
    const collectionRepository = repository[collection] as CanonicalEntityRepository<
      Extract<EntityForCollection<TName>, WorkspaceRecord>
    >;
    return collectionRepository.put(
      record as Extract<EntityForCollection<TName>, WorkspaceRecord>,
    ) as EntityForCollection<TName>;
  }

  private async writeWorkspace(record: Workspace): Promise<void> {
    await this.driver.execute(
      `INSERT OR REPLACE INTO ${canonicalSqliteCollectionTables.workspaces} (
        id, kind, record_json, updated_at
      ) VALUES (?, ?, ?, ?)`,
      [String(record.id), record.kind, JSON.stringify(record), this.nowIso()],
    );
    await this.callWriteHook({
      operation: 'upsert',
      collection: 'workspaces',
      id: String(record.id),
    });
  }

  private async writeEntity<TName extends EntityCollectionName>(
    collection: TName,
    record: EntityForCollection<TName>,
  ): Promise<void> {
    if (collection === 'auditLog') {
      await this.writeCanonicalAuditEntry(record as AuditLogEntry);
      return;
    }

    const workspaceRecord = record as WorkspaceRecord;
    await this.driver.execute(
      `INSERT OR REPLACE INTO ${entityTable(collection)} (
        id, workspace_id, record_json, updated_at
      ) VALUES (?, ?, ?, ?)`,
      [
        String(workspaceRecord.id),
        workspaceRecord.workspaceId,
        JSON.stringify(record),
        this.nowIso(),
      ],
    );
    await this.callWriteHook({
      operation: 'upsert',
      collection,
      id: String(workspaceRecord.id),
      workspaceId: workspaceRecord.workspaceId,
    });
  }

  private async deleteEntity(collection: EntityCollectionName, id: string): Promise<void> {
    if (collection === 'auditLog') {
      await this.driver.execute(
        `DELETE FROM ${canonicalSqliteCollectionTables.auditLog}
         WHERE id = ? AND workspace_id = ? AND command_type = ?`,
        [id, this.workspaceId, canonicalAuditCommandType],
      );
    } else {
      await this.driver.execute(
        `DELETE FROM ${entityTable(collection)} WHERE id = ? AND workspace_id = ?`,
        [id, this.workspaceId],
      );
    }
    await this.callWriteHook({
      operation: 'delete',
      collection,
      id,
      workspaceId: this.workspaceId,
    });
  }

  private async writeCanonicalAuditEntry(record: AuditLogEntry): Promise<void> {
    await this.driver.execute(
      `INSERT OR REPLACE INTO ${canonicalSqliteCollectionTables.auditLog} (
        id,
        workspace_id,
        command_type,
        actor_kind,
        actor_ref,
        entity_refs_json,
        delta_json,
        provenance_json,
        device_id,
        reversal_of_id,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(record.id),
        record.workspaceId,
        canonicalAuditCommandType,
        record.actor,
        null,
        JSON.stringify({
          refs: [
            {
              type: record.subjectId === undefined ? 'audit_log' : 'subject',
              id: record.subjectId ?? String(record.id),
            },
          ],
        }),
        JSON.stringify(record),
        record.provenanceId === undefined
          ? null
          : JSON.stringify({ provenanceId: record.provenanceId }),
        null,
        null,
        record.occurredAt,
      ],
    );
    await this.callWriteHook({
      operation: 'upsert',
      collection: 'auditLog',
      id: String(record.id),
      workspaceId: record.workspaceId,
    });
  }

  private async listCanonicalAuditLog(): Promise<readonly AuditLogEntry[]> {
    const result = await this.driver.execute<AuditJsonRow>(
      `SELECT delta_json FROM ${canonicalSqliteCollectionTables.auditLog}
       WHERE workspace_id = ? AND command_type = ?
       ORDER BY created_at, id`,
      [this.workspaceId, canonicalAuditCommandType],
    );
    return result.rows.map(readAuditJson);
  }

  private async getCanonicalAuditEntry(id: string): Promise<AuditLogEntry | undefined> {
    const result = await this.driver.execute<AuditJsonRow>(
      `SELECT delta_json FROM ${canonicalSqliteCollectionTables.auditLog}
       WHERE id = ? AND workspace_id = ? AND command_type = ?`,
      [id, this.workspaceId, canonicalAuditCommandType],
    );
    const row = result.rows[0];
    return row === undefined ? undefined : readAuditJson(row);
  }

  private async countCanonicalAuditLog(): Promise<number> {
    const result = await this.driver.execute<CountRow>(
      `SELECT COUNT(*) AS count FROM ${canonicalSqliteCollectionTables.auditLog}
       WHERE workspace_id = ? AND command_type = ?`,
      [this.workspaceId, canonicalAuditCommandType],
    );
    return readCount(result.rows[0]);
  }

  private async callWriteHook(event: CanonicalSqliteWriteEvent): Promise<void> {
    await this.options.writeHook?.(event);
  }

  private nowIso(): string {
    return (this.options.now?.() ?? new Date()).toISOString();
  }
}

class SqliteWorkspaceRepository implements AsyncCanonicalWorkspaceRepository {
  constructor(private readonly parent: SqliteCanonicalRepository) {}

  list(): Promise<readonly Workspace[]> {
    return this.parent.listWorkspaces();
  }

  get(id: Workspace['id']): Promise<Workspace | undefined> {
    return this.parent.getWorkspace(id);
  }

  put(record: Workspace): Promise<Workspace> {
    return this.parent.putWorkspace(record);
  }
}

class SqliteCanonicalEntityRepository<
  TEntity extends WorkspaceRecord,
> implements AsyncCanonicalEntityRepository<TEntity> {
  readonly workspaceId: WorkspaceId;

  constructor(
    private readonly parent: SqliteCanonicalRepository,
    private readonly collection: EntityCollectionName,
  ) {
    this.workspaceId = parent.workspaceId;
  }

  list(): Promise<readonly TEntity[]> {
    return this.parent.listEntities(this.collection) as unknown as Promise<readonly TEntity[]>;
  }

  get(id: TEntity['id']): Promise<TEntity | undefined> {
    return this.parent.getEntity(this.collection, String(id)) as unknown as Promise<
      TEntity | undefined
    >;
  }

  put(record: TEntity): Promise<TEntity> {
    return this.parent.putEntity(
      this.collection,
      record as unknown as EntityForCollection<EntityCollectionName>,
    ) as unknown as Promise<TEntity>;
  }

  remove(id: TEntity['id']): Promise<boolean> {
    return this.parent.removeEntity(this.collection, String(id));
  }

  count(): Promise<number> {
    return this.parent.countEntities(this.collection);
  }
}

const entityCollectionNames = [
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
] as const satisfies readonly EntityCollectionName[];

function migrationOptions(
  options: CanonicalSqliteRepositoryOptions,
): Pick<CanonicalSqliteRepositoryOptions, 'now'> {
  return options.now === undefined ? {} : { now: options.now };
}

function entityTable(collection: Exclude<EntityCollectionName, 'auditLog'>): string;
function entityTable(collection: EntityCollectionName): string {
  if (collection === 'auditLog') return canonicalSqliteCollectionTables.auditLog;
  return canonicalSqliteCollectionTables[collection];
}

function readRecordJson<TEntity>(row: RecordJsonRow): TEntity {
  if (typeof row.record_json !== 'string') {
    throw new Error('Canonical SQLite row is missing record_json.');
  }
  return JSON.parse(row.record_json) as TEntity;
}

function readAuditJson(row: AuditJsonRow): AuditLogEntry {
  if (typeof row.delta_json !== 'string') {
    throw new Error('Canonical audit log row is missing delta_json.');
  }
  return JSON.parse(row.delta_json) as AuditLogEntry;
}

function readCount(row: CountRow | undefined): number {
  const value = row?.count;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return Number.parseInt(value, 10);
  return 0;
}
