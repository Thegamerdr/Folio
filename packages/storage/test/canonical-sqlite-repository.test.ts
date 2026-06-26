import {
  createAccount,
  createAvailablePositionSnapshot,
  createAuditLogId,
  createBalanceAdjustment,
  createBalanceObservation,
  createCalendarItemId,
  createCommitmentId,
  createCurrencyCode,
  createCurrentBalance,
  createDecisionRecordId,
  createDocumentAttachment,
  createDocumentAttachmentId,
  createDocumentId,
  createEntityVersion,
  createEventId,
  createExpectationId,
  createForecastId,
  createImportedClaim,
  createImportedClaimId,
  createImportDraftId,
  createInstantString,
  createLocalDate,
  createMeloMemoryId,
  createMeloProposalId,
  createMoney,
  createParsedRow,
  createParsedRowId,
  createPlanImpact,
  createPlanImpactId,
  createPlanId,
  createPlanRule,
  createPlanRuleId,
  createPlannerItemId,
  createProvenanceId,
  createScenarioId,
  createSourceRecordId,
  createTimelineEntryId,
  createTransaction,
  createUserCorrection,
  createUserCorrectionId,
  createWorkspace,
  createWorkspaceId,
  type Account,
  type AuditLogEntry,
  type AvailablePositionSnapshot,
  type BalanceAdjustment,
  type BalanceObservation,
  type CalendarItem,
  type Commitment,
  type CurrentBalance,
  type DecisionRecord,
  type DocumentAttachment,
  type DocumentRecord,
  type Event,
  type FinancialExpectation,
  type FinancialTransaction,
  type Forecast,
  type ImportDraft,
  type ImportedClaim,
  type MeloMemory,
  type MeloProposalRecord,
  type ParsedRow,
  type Plan,
  type PlanImpact,
  type PlanRule,
  type PlannerItem,
  type Provenance,
  type Scenario,
  type SourceRecord,
  type TimelineEntry,
  type UserCorrection,
  type Workspace,
  type WorkspaceId,
} from '@folio/domain';
import { describe, expect, it } from 'vitest';

import {
  applyCanonicalSqliteRepositoryMigrations,
  canonicalLocalRepositorySchema,
  canonicalSqliteCollectionTables,
  InMemoryDatabaseDriver,
  migrateCanonicalSnapshotToSqliteRepository,
  openSqliteCanonicalRepository,
  type CanonicalRepositorySnapshot,
  type CanonicalSqliteWriteEvent,
} from '../src/index.js';

const personalWorkspaceId = createWorkspaceId('workspace_sqlite_personal');
const businessWorkspaceId = createWorkspaceId('workspace_sqlite_business');
const version = createEntityVersion({ dataVersion: 'test:canonical-sqlite-repository' });
const now = createInstantString('2026-06-22T10:00:00.000Z');
const today = createLocalDate('2026-06-22');
const tomorrow = createLocalDate('2026-06-23');
const gbp = createCurrencyCode('GBP');

describe('canonical SQLite repository', () => {
  it('applies repository migrations idempotently outside the global migration table', async () => {
    const driver = new InMemoryDatabaseDriver();

    const firstPlan = await applyCanonicalSqliteRepositoryMigrations(driver, {
      now: () => new Date('2026-06-22T10:00:00.000Z'),
    });
    const secondPlan = await applyCanonicalSqliteRepositoryMigrations(driver, {
      now: () => new Date('2026-06-22T10:00:00.000Z'),
    });

    expect(firstPlan.pending).toHaveLength(4);
    expect(secondPlan.pending).toHaveLength(0);
    expect(driver.appliedMigrations).toEqual([]);
    expect(driver.canonicalRepositoryAppliedMigrations).toHaveLength(4);
  });

  it('round-trips every canonical collection through SQLite tables', async () => {
    const driver = new InMemoryDatabaseDriver();
    const base = createBaseRecords(personalWorkspaceId);

    await migrateCanonicalSnapshotToSqliteRepository(
      driver,
      createSnapshot(personalWorkspaceId, base),
    );
    const repository = await openSqliteCanonicalRepository(driver, personalWorkspaceId);
    const snapshot = await repository.snapshot();

    expect(snapshot.schema).toBe(canonicalLocalRepositorySchema);
    expect(snapshot.collections.workspaces).toEqual([base.workspace]);
    expect(snapshot.collections.accounts).toEqual([base.account]);
    expect(snapshot.collections.balanceObservations).toEqual([base.balanceObservation]);
    expect(snapshot.collections.currentBalances).toEqual([base.currentBalance]);
    expect(snapshot.collections.balanceAdjustments).toEqual([base.balanceAdjustment]);
    expect(snapshot.collections.availablePositionSnapshots).toEqual([
      base.availablePositionSnapshot,
    ]);
    expect(snapshot.collections.sourceRecords).toEqual([base.sourceRecord]);
    expect(snapshot.collections.provenance).toEqual([base.provenance]);
    expect(snapshot.collections.parsedRows).toEqual([base.parsedRow]);
    expect(snapshot.collections.importedClaims).toEqual([base.importedClaim]);
    expect(snapshot.collections.importDrafts).toEqual([base.importDraft]);
    expect(snapshot.collections.userCorrections).toEqual([base.userCorrection]);
    expect(snapshot.collections.transactions).toEqual([base.transaction]);
    expect(snapshot.collections.events).toEqual([base.event]);
    expect(snapshot.collections.commitments).toEqual([base.commitment]);
    expect(snapshot.collections.expectations).toEqual([base.expectation]);
    expect(snapshot.collections.plannerItems).toEqual([base.plannerItem]);
    expect(snapshot.collections.plans).toEqual([base.plan]);
    expect(snapshot.collections.planRules).toEqual([base.planRule]);
    expect(snapshot.collections.scenarios).toEqual([base.scenario]);
    expect(snapshot.collections.planImpacts).toEqual([base.planImpact]);
    expect(snapshot.collections.forecastSnapshots).toEqual([base.forecast]);
    expect(snapshot.collections.decisions).toEqual([base.decision]);
    expect(snapshot.collections.documents).toEqual([base.document]);
    expect(snapshot.collections.documentAttachments).toEqual([base.documentAttachment]);
    expect(snapshot.collections.calendarItems).toEqual([base.calendarItem]);
    expect(snapshot.collections.timelineEntries).toEqual([base.timelineEntry]);
    expect(snapshot.collections.meloMemory).toEqual([base.memory]);
    expect(snapshot.collections.meloProposals).toEqual([base.proposal]);
    expect(snapshot.collections.auditLog).toEqual([base.auditEntry]);
    expect(driver.canonicalTableEntries(canonicalSqliteCollectionTables.transactions)).toHaveLength(
      1,
    );
  });

  it('rolls back partial composite writes so provenance, audit and decisions stay atomic', async () => {
    const driver = new InMemoryDatabaseDriver();
    const base = createBaseRecords(personalWorkspaceId);
    await migrateCanonicalSnapshotToSqliteRepository(
      driver,
      createSnapshot(personalWorkspaceId, base, {
        transactions: [],
        events: [],
        decisions: [],
        auditLog: [],
        calendarItems: [],
        timelineEntries: [],
      }),
    );

    let writes = 0;
    const repository = await openSqliteCanonicalRepository(driver, personalWorkspaceId, {
      writeHook: (event: CanonicalSqliteWriteEvent) => {
        if (event.operation !== 'upsert') return;
        writes += 1;
        if (writes === 2) throw new Error('simulated canonical write failure');
      },
    });

    await expect(
      repository.acceptReviewedImportDraft({
        draftId: base.importDraft.id,
        transaction: base.importedTransaction,
        decision: base.importDecision,
        auditEntry: base.importAuditEntry,
        event: base.event,
        calendarItem: base.calendarItem,
        timelineEntry: base.timelineEntry,
      }),
    ).rejects.toThrow(/simulated canonical write failure/);

    const reloaded = await openSqliteCanonicalRepository(driver, personalWorkspaceId);
    const snapshot = await reloaded.snapshot();
    expect(snapshot.collections.importDrafts).toEqual([base.importDraft]);
    expect(snapshot.collections.transactions).toEqual([]);
    expect(snapshot.collections.decisions).toEqual([]);
    expect(snapshot.collections.auditLog).toEqual([]);
  });

  it('keeps scenario previews hypothetical after reload and only records acceptance as a decision', async () => {
    const driver = new InMemoryDatabaseDriver();
    const base = createBaseRecords(personalWorkspaceId);
    await migrateCanonicalSnapshotToSqliteRepository(
      driver,
      createSnapshot(personalWorkspaceId, base, {
        importDrafts: [],
        transactions: [],
        events: [],
        decisions: [],
        auditLog: [],
        calendarItems: [],
        timelineEntries: [],
      }),
    );

    const previewRepository = await openSqliteCanonicalRepository(driver, personalWorkspaceId);
    const previewSnapshot = await previewRepository.snapshot();
    expect(previewSnapshot.collections.scenarios).toMatchObject([
      { id: base.scenario.id, status: 'previewed', authorityState: 'hypothetical' },
    ]);
    expect(previewSnapshot.collections.transactions).toEqual([]);

    const acceptedPlan = createAcceptedRecoveryPlan(base);
    const acceptedImpact = createAcceptedRecoveryImpact(base);
    const recoveryCalendarItem = createRecoveryCalendarItem(base, acceptedImpact);

    await previewRepository.acceptScenario({
      scenarioId: base.scenario.id,
      decision: base.scenarioDecision,
      auditEntry: base.scenarioAuditEntry,
      planUpdates: [acceptedPlan],
      planImpacts: [acceptedImpact],
      calendarItems: [recoveryCalendarItem],
      timelineEntry: base.scenarioTimelineEntry,
    });

    const acceptedRepository = await openSqliteCanonicalRepository(driver, personalWorkspaceId);
    const acceptedSnapshot = await acceptedRepository.snapshot();
    expect(acceptedSnapshot.collections.scenarios).toMatchObject([
      { id: base.scenario.id, status: 'accepted', authorityState: 'hypothetical' },
    ]);
    expect(acceptedSnapshot.collections.transactions).toEqual([]);
    expect(acceptedSnapshot.collections.plans).toEqual([acceptedPlan]);
    expect(acceptedSnapshot.collections.planImpacts).toEqual([acceptedImpact]);
    expect(acceptedSnapshot.collections.calendarItems).toEqual([recoveryCalendarItem]);
    expect(acceptedSnapshot.collections.decisions).toEqual([base.scenarioDecision]);
    expect(acceptedSnapshot.collections.auditLog).toEqual([base.scenarioAuditEntry]);
  });

  it('does not read rows across Personal and Business workspace boundaries', async () => {
    const driver = new InMemoryDatabaseDriver();
    const personal = createBaseRecords(personalWorkspaceId);
    const business = createBaseRecords(businessWorkspaceId);

    await migrateCanonicalSnapshotToSqliteRepository(
      driver,
      createSnapshot(personalWorkspaceId, personal),
    );
    await migrateCanonicalSnapshotToSqliteRepository(
      driver,
      createSnapshot(businessWorkspaceId, business),
    );

    const personalRepository = await openSqliteCanonicalRepository(driver, personalWorkspaceId);
    const businessRepository = await openSqliteCanonicalRepository(driver, businessWorkspaceId);

    expect(await personalRepository.transactions.get(business.transaction.id)).toBeUndefined();
    expect(await businessRepository.transactions.get(personal.transaction.id)).toBeUndefined();
    expect((await personalRepository.snapshot()).collections.transactions).toEqual([
      personal.transaction,
    ]);
    expect((await businessRepository.snapshot()).collections.transactions).toEqual([
      business.transaction,
    ]);
  });

  it('exposes Today, Timeline, Calendar and Plans inputs from SQLite repository collections only', async () => {
    const driver = new InMemoryDatabaseDriver();
    const base = createBaseRecords(personalWorkspaceId);

    await migrateCanonicalSnapshotToSqliteRepository(
      driver,
      createSnapshot(personalWorkspaceId, base),
    );
    const repository = await openSqliteCanonicalRepository(driver, personalWorkspaceId);
    const canonical = (await repository.snapshot()).collections;

    expect(canonical.transactions).toEqual([base.transaction]);
    expect(canonical.currentBalances).toEqual([base.currentBalance]);
    expect(canonical.balanceObservations).toEqual([base.balanceObservation]);
    expect(canonical.expectations).toEqual([base.expectation]);
    expect(canonical.timelineEntries).toEqual([base.timelineEntry]);
    expect(canonical.calendarItems).toEqual([base.calendarItem]);
    expect(canonical.plans).toEqual([base.plan]);
    expect(canonical.planRules).toEqual([base.planRule]);
    expect(canonical.planImpacts).toEqual([base.planImpact]);
  });
});

type BaseRecords = ReturnType<typeof createBaseRecords>;

function createSnapshot(
  workspaceId: WorkspaceId,
  base: BaseRecords,
  overrides: Partial<CanonicalRepositorySnapshot['collections']> = {},
): CanonicalRepositorySnapshot {
  return {
    schema: canonicalLocalRepositorySchema,
    workspaceId,
    collections: {
      workspaces: [base.workspace],
      accounts: [base.account],
      balanceObservations: [base.balanceObservation],
      currentBalances: [base.currentBalance],
      balanceAdjustments: [base.balanceAdjustment],
      availablePositionSnapshots: [base.availablePositionSnapshot],
      sourceRecords: [base.sourceRecord],
      provenance: [base.provenance],
      parsedRows: [base.parsedRow],
      importedClaims: [base.importedClaim],
      importDrafts: [base.importDraft],
      userCorrections: [base.userCorrection],
      transactions: [base.transaction],
      events: [base.event],
      commitments: [base.commitment],
      expectations: [base.expectation],
      plannerItems: [base.plannerItem],
      plans: [base.plan],
      planRules: [base.planRule],
      scenarios: [base.scenario],
      planImpacts: [base.planImpact],
      forecastSnapshots: [base.forecast],
      decisions: [base.decision],
      documents: [base.document],
      documentAttachments: [base.documentAttachment],
      calendarItems: [base.calendarItem],
      timelineEntries: [base.timelineEntry],
      meloMemory: [base.memory],
      meloProposals: [base.proposal],
      auditLog: [base.auditEntry],
      ...overrides,
    },
  };
}

function createBaseRecords(workspaceId: WorkspaceId) {
  const suffix = workspaceId === personalWorkspaceId ? 'personal' : 'business';
  const workspace = createWorkspaceRecord(workspaceId);
  const account = createAccountRecord(workspaceId, suffix);
  const sourceRecord = createSourceRecord(workspaceId, `source_${suffix}_manual`);
  const provenance = createProvenanceRecord(
    workspaceId,
    sourceRecord,
    `transaction_${suffix}_manual`,
  );
  const balanceObservation = createBalanceObservationRecord(
    workspaceId,
    suffix,
    account,
    sourceRecord,
    provenance,
  );
  const currentBalance = createCurrentBalanceRecord(
    workspaceId,
    suffix,
    account,
    balanceObservation,
    provenance,
  );
  const balanceAdjustment = createBalanceAdjustmentRecord(
    workspaceId,
    suffix,
    account,
    balanceObservation,
    sourceRecord,
    provenance,
  );
  const availablePositionSnapshot = createAvailablePositionRecord(
    workspaceId,
    suffix,
    currentBalance,
    balanceObservation,
  );
  const transaction = createTransaction({
    id: `transaction_${suffix}_manual`,
    workspaceId,
    accountId: account.id,
    status: 'posted',
    authorityState: 'user-confirmed',
    amount: createMoney({ minorUnits: -450, currency: gbp }),
    localDate: today,
    sourceKind: 'manual',
    certainty: 'user-confirmed',
    reviewStatus: 'accepted',
    sourceRecordId: sourceRecord.id,
    provenanceId: provenance.id,
    description: 'Lunch',
    reference: 'Lunch receipt',
  });
  const importedTransaction = createTransaction({
    id: `transaction_${suffix}_import`,
    workspaceId,
    accountId: account.id,
    status: 'posted',
    authorityState: 'user-confirmed',
    amount: createMoney({ minorUnits: -1299, currency: gbp }),
    localDate: today,
    sourceKind: 'csv',
    certainty: 'user-confirmed',
    reviewStatus: 'accepted',
    sourceRecordId: sourceRecord.id,
    provenanceId: provenance.id,
    description: 'Imported coffee',
    reference: 'CSV row 2',
  });
  const importDraft: ImportDraft = {
    id: createImportDraftId(`importdraft_${suffix}_review`),
    workspaceId,
    sourceRecordId: sourceRecord.id,
    proposedTransactionId: importedTransaction.id,
    parsedRowId: createParsedRowId(`parsedrow_${suffix}_review`),
    importedClaimId: createImportedClaimId(`importedclaim_${suffix}_review`),
    authorityState: 'imported-claim',
    reviewState: 'ready-for-user-confirmation',
    userConfirmationState: 'requested',
    parserIssues: [],
    provenanceId: provenance.id,
    version,
  };
  const parsedRow = createParsedRow({
    id: importDraft.parsedRowId ?? `parsedrow_${suffix}_review`,
    workspaceId,
    sourceRecordId: sourceRecord.id,
    rowIndex: 0,
    rawText: '2026-06-22,Imported coffee,-12.99',
    parsedAt: now,
    parserName: 'test parser',
    parserIssues: [],
    authorityState: 'imported-claim',
    reviewState: 'ready-for-user-confirmation',
    provenanceId: provenance.id,
    version,
  });
  const importedClaim = createImportedClaim({
    id: importDraft.importedClaimId ?? `importedclaim_${suffix}_review`,
    workspaceId,
    sourceRecordId: sourceRecord.id,
    importDraftId: importDraft.id,
    parsedRowId: parsedRow.id,
    proposedTransactionId: importedTransaction.id,
    originalText: parsedRow.rawText,
    interpretedTitle: 'Imported coffee',
    amount: importedTransaction.amount,
    localDate: today,
    state: 'needs-review',
    sourceQuality: 'source-clear',
    authorityState: 'imported-claim',
    reviewState: 'ready-for-user-confirmation',
    userConfirmationState: 'requested',
    parserIssues: [],
    provenanceId: provenance.id,
    version,
  });
  const event: Event = {
    id: createEventId(`event_${suffix}_manual`),
    workspaceId,
    kind: 'payment',
    title: 'Lunch',
    localDate: today,
    authorityState: 'user-confirmed',
    version,
    amount: createMoney({ minorUnits: -450, currency: gbp }),
    transactionIds: [transaction.id],
    expectationIds: [],
    sourceRecordIds: [sourceRecord.id],
    provenanceId: provenance.id,
  };
  const commitment: Commitment = {
    id: createCommitmentId(`commitment_${suffix}_rent`),
    workspaceId,
    kind: 'bill',
    title: 'Rent',
    amount: createMoney({ minorUnits: -87500, currency: gbp }),
    dueDate: tomorrow,
    authorityState: 'user-confirmed',
    reviewState: 'user-confirmed',
    version,
    accountId: account.id,
    sourceRecordId: sourceRecord.id,
    provenanceId: provenance.id,
  };
  const expectation: FinancialExpectation = {
    id: createExpectationId(`expectation_${suffix}_rent`),
    workspaceId,
    localDate: tomorrow,
    amount: createMoney({ minorUnits: -87500, currency: gbp }),
    authorityState: 'user-confirmed',
    certainty: 'user-confirmed',
    fulfilled: false,
    version,
    accountId: account.id,
    commitmentId: commitment.id,
    sourceRecordId: sourceRecord.id,
    provenanceId: provenance.id,
  };
  const plannerItem: PlannerItem = {
    id: createPlannerItemId(`planner_${suffix}_review`),
    workspaceId,
    kind: 'review',
    title: 'Review import row',
    dueDate: today,
    status: 'open',
    authorityState: 'inferred',
    version,
    provenanceId: provenance.id,
  };
  const plan: Plan = {
    id: createPlanId(`plan_${suffix}_emergency`),
    workspaceId,
    title: 'Emergency fund',
    kind: 'build-buffer',
    userIntention: 'Build a visible reserve without touching protected commitments.',
    status: 'active',
    authorityState: 'user-confirmed',
    reviewState: 'user-confirmed',
    createdAt: now,
    version,
    targetAmount: createMoney({ minorUnits: 100000, currency: gbp }),
    targetDate: createLocalDate('2026-12-31'),
    protectedAmount: createMoney({ minorUnits: 25000, currency: gbp }),
    commitmentIds: [commitment.id],
    expectationIds: [expectation.id],
    transactionIds: [transaction.id],
    eventIds: [event.id],
    ruleIds: [createPlanRuleId(`planrule_${suffix}_emergency`)],
    impactIds: [createPlanImpactId(`planimpact_${suffix}_emergency`)],
    scenarioIds: [],
    accountabilityStyle: 'balanced',
    provenanceId: provenance.id,
  };
  const scenario: Scenario = {
    id: createScenarioId(`scenario_${suffix}_recovery`),
    workspaceId,
    title: 'Recovery spend preview',
    status: 'previewed',
    authorityState: 'hypothetical',
    createdAt: now,
    version,
    assumptionIds: [expectation.id],
    affectedPlanIds: [plan.id],
    provenanceId: provenance.id,
  };
  const planRule = createPlanRule({
    id: plan.ruleIds?.[0] ?? `planrule_${suffix}_emergency`,
    workspaceId,
    planId: plan.id,
    title: 'Emergency reserve rule',
    mode: 'flexible',
    minimumBuffer: { minorUnits: 25000, currency: gbp },
    targetContribution: { minorUnits: 10000, currency: gbp },
    deadline: '2026-12-31',
    reviewRequiredWhen: ['unexpected-change', 'protected-floor-risk'],
    createdAt: now,
    version,
    provenanceId: provenance.id,
  });
  const planImpact = createPlanImpact({
    id: plan.impactIds?.[0] ?? `planimpact_${suffix}_emergency`,
    workspaceId,
    planId: plan.id,
    asOf: today,
    summary: 'Lunch changed the visible reserve projection.',
    changedRecordIds: [transaction.id, event.id],
    direction: 'unchanged',
    newProjectedOutcome: 'Emergency fund remains linked to 2026-12-31.',
    protectedAmount: { minorUnits: 25000, currency: gbp },
    needsReview: false,
    reviewReasons: [],
    optionIds: ['inspect-plan'],
    scenarioIds: [scenario.id],
    createdAt: now,
    version,
    provenanceId: provenance.id,
  });
  const forecast: Forecast = {
    id: createForecastId(`forecast_${suffix}_today`),
    workspaceId,
    asOf: today,
    authorityState: 'hypothetical',
    createdAt: now,
    sourceIds: [transaction.id, expectation.id, commitment.id, scenario.id],
    version,
    provenanceId: provenance.id,
  };
  const document: DocumentRecord = {
    id: createDocumentId(`document_${suffix}_statement`),
    workspaceId,
    kind: 'statement',
    filename: 'statement.csv',
    capturedAt: now,
    authorityState: 'imported-claim',
    reviewState: 'needs-review',
    sourceHash: `sha256:statement:${suffix}`,
    version,
    sourceRecordId: sourceRecord.id,
    provenanceId: provenance.id,
  };
  const documentAttachment: DocumentAttachment = createDocumentAttachment({
    id: createDocumentAttachmentId(`documentattachment_${suffix}_statement_source`),
    workspaceId,
    documentId: document.id,
    targetKind: 'source-record',
    targetId: sourceRecord.id,
    attachedAt: now,
    authorityState: 'imported-claim',
    reviewState: 'needs-review',
    sourceRecordId: sourceRecord.id,
    provenanceId: provenance.id,
    version,
  });
  const calendarItem: CalendarItem = {
    id: createCalendarItemId(`calendar_${suffix}_rent`),
    workspaceId,
    kind: 'commitment',
    title: 'Rent',
    localDate: tomorrow,
    authorityState: 'user-confirmed',
    version,
    commitmentId: commitment.id,
    provenanceId: provenance.id,
  };
  const timelineEntry: TimelineEntry = {
    id: createTimelineEntryId(`timeline_${suffix}_lunch`),
    workspaceId,
    kind: 'fact',
    title: 'Lunch',
    localDate: today,
    authorityState: 'user-confirmed',
    subjectId: transaction.id,
    version,
    provenanceId: provenance.id,
  };
  const scenarioTimelineEntry: TimelineEntry = {
    id: createTimelineEntryId(`timeline_${suffix}_scenario`),
    workspaceId,
    kind: 'decision',
    title: 'Recovery spend preview accepted',
    localDate: today,
    authorityState: 'user-confirmed',
    subjectId: `decision_${suffix}_scenario`,
    version,
    provenanceId: provenance.id,
  };
  const proposal: MeloProposalRecord = {
    id: createMeloProposalId(`proposal_${suffix}_import`),
    workspaceId,
    title: 'Review Melo import suggestion',
    status: 'needs-review',
    authorityState: 'inferred',
    createdAt: now,
    proposedCommand: 'ClassifyTransaction',
    canWriteDirectly: false,
    version,
    provenanceId: provenance.id,
  };
  const memory: MeloMemory = {
    id: createMeloMemoryId(`memory_${suffix}_import`),
    workspaceId,
    authorityState: 'inferred',
    reviewState: 'needs-review',
    value: 'Melo suggested a reviewable import label.',
    createdAt: now,
    version,
    provenanceId: provenance.id,
  };
  const decision = createDecisionRecord(
    workspaceId,
    `decision_${suffix}_manual`,
    'correct-record',
    [transaction.id],
    provenance.id,
  );
  const importDecision = createDecisionRecord(
    workspaceId,
    `decision_${suffix}_import`,
    'confirm-import',
    [importDraft.id, importedTransaction.id],
    provenance.id,
  );
  const scenarioDecision = createDecisionRecord(
    workspaceId,
    `decision_${suffix}_scenario`,
    'accept-scenario',
    [scenario.id],
    provenance.id,
  );
  const auditEntry = createAuditEntry(
    workspaceId,
    `audit_${suffix}_manual`,
    'manual_record',
    transaction.id,
    provenance.id,
  );
  const importAuditEntry = createAuditEntry(
    workspaceId,
    `audit_${suffix}_import`,
    'confirm_import',
    importedTransaction.id,
    provenance.id,
  );
  const scenarioAuditEntry = createAuditEntry(
    workspaceId,
    `audit_${suffix}_scenario`,
    'accept_scenario',
    scenario.id,
    provenance.id,
  );
  const userCorrection: UserCorrection = createUserCorrection({
    id: createUserCorrectionId(`correction_${suffix}_import`),
    workspaceId,
    kind: 'import-row-edit',
    subjectId: importDraft.id,
    originalValue: 'Imported cof',
    correctedValue: 'Imported coffee',
    correctedAt: now,
    sourceRecordId: sourceRecord.id,
    provenanceId: provenance.id,
    decisionId: importDecision.id,
    auditLogId: importAuditEntry.id,
    version,
  });

  return {
    workspace,
    account,
    balanceObservation,
    currentBalance,
    balanceAdjustment,
    availablePositionSnapshot,
    sourceRecord,
    provenance,
    parsedRow,
    importedClaim,
    importDraft,
    userCorrection,
    transaction,
    importedTransaction,
    event,
    commitment,
    expectation,
    plannerItem,
    plan,
    planRule,
    scenario,
    planImpact,
    forecast,
    document,
    documentAttachment,
    calendarItem,
    timelineEntry,
    scenarioTimelineEntry,
    proposal,
    memory,
    decision,
    importDecision,
    scenarioDecision,
    auditEntry,
    importAuditEntry,
    scenarioAuditEntry,
  };
}

function createWorkspaceRecord(workspaceId: WorkspaceId): Workspace {
  return createWorkspace({
    id: workspaceId,
    kind: workspaceId === personalWorkspaceId ? 'personal' : 'business',
    name: workspaceId === personalWorkspaceId ? 'Personal' : 'Business',
    baseCurrency: gbp,
    jurisdiction: 'GB',
    timeZone: 'Europe/London',
    version,
  });
}

function createAccountRecord(workspaceId: WorkspaceId, suffix: string): Account {
  return createAccount({
    id: `account_${suffix}_cash`,
    workspaceId,
    name: 'Local cash',
    kind: 'cash',
    currency: gbp,
    version,
  });
}

function createBalanceObservationRecord(
  workspaceId: WorkspaceId,
  suffix: string,
  account: Account,
  sourceRecord: SourceRecord,
  provenance: Provenance,
): BalanceObservation {
  return createBalanceObservation({
    id: `balance_${suffix}_opening`,
    workspaceId,
    accountId: account.id,
    observedOn: today,
    observedAt: now,
    balance: { minorUnits: 100000, currency: gbp },
    source: 'Opening balance',
    sourceKind: 'user-entered',
    observationKind: 'opening-balance',
    authorityState: 'user-confirmed',
    reviewState: 'not-required',
    reconciliationState: 'provisional',
    sourceRecordId: sourceRecord.id,
    provenanceId: provenance.id,
    version,
  });
}

function createCurrentBalanceRecord(
  workspaceId: WorkspaceId,
  suffix: string,
  account: Account,
  observation: BalanceObservation,
  provenance: Provenance,
): CurrentBalance {
  return createCurrentBalance({
    id: `currentbalance_${suffix}_opening`,
    workspaceId,
    accountId: account.id,
    asOf: today,
    balance: observation.balance,
    sourceKind: observation.sourceKind,
    authorityState: observation.authorityState,
    reviewState: observation.reviewState,
    sourceObservationId: observation.id,
    updatedAt: now,
    provenanceId: provenance.id,
    version,
  });
}

function createBalanceAdjustmentRecord(
  workspaceId: WorkspaceId,
  suffix: string,
  account: Account,
  observation: BalanceObservation,
  sourceRecord: SourceRecord,
  provenance: Provenance,
): BalanceAdjustment {
  return createBalanceAdjustment({
    id: `balanceadjustment_${suffix}_opening_correction`,
    workspaceId,
    accountId: account.id,
    kind: 'correction',
    localDate: today,
    amount: { minorUnits: 0, currency: gbp },
    reason: 'Opening balance confirmed',
    sourceObservationId: observation.id,
    resultingObservationId: observation.id,
    sourceRecordId: sourceRecord.id,
    provenanceId: provenance.id,
    version,
  });
}

function createAvailablePositionRecord(
  workspaceId: WorkspaceId,
  suffix: string,
  currentBalance: CurrentBalance,
  observation: BalanceObservation,
): AvailablePositionSnapshot {
  return createAvailablePositionSnapshot({
    id: `position_${suffix}_today`,
    workspaceId,
    asOf: today,
    currency: gbp,
    openingBalance: currentBalance.balance,
    availableBalance: currentBalance.balance,
    protectedFloor: { minorUnits: 0, currency: gbp },
    actualNet: { minorUnits: 0, currency: gbp },
    expectedNet: { minorUnits: 0, currency: gbp },
    currentBalanceIds: [currentBalance.id],
    balanceObservationIds: [observation.id],
    sourceIds: [String(currentBalance.id), String(observation.id)],
    authorityState: 'inferred',
    reviewState: 'not-required',
    createdAt: now,
    version,
  });
}

function createSourceRecord(workspaceId: WorkspaceId, id: string): SourceRecord {
  return {
    id: createSourceRecordId(id),
    workspaceId,
    kind: 'manual-entry',
    authorityState: 'user-confirmed',
    label: 'Manual record',
    capturedAt: now,
    sourceHash: `sha256:${id}`,
    version,
  };
}

function createProvenanceRecord(
  workspaceId: WorkspaceId,
  sourceRecord: SourceRecord,
  transactionId: string,
): Provenance {
  return {
    id: createProvenanceId(
      `provenance_${workspaceId === personalWorkspaceId ? 'personal' : 'business'}_manual`,
    ),
    workspaceId,
    authorityState: 'user-confirmed',
    sourceRecordIds: [sourceRecord.id],
    links: [
      {
        relationship: 'evidences',
        fromId: sourceRecord.id,
        toId: transactionId,
      },
    ],
    createdAt: now,
    version,
  };
}

function createDecisionRecord(
  workspaceId: WorkspaceId,
  id: string,
  kind: DecisionRecord['kind'],
  affectedIds: readonly string[],
  provenanceId: Provenance['id'],
): DecisionRecord {
  return {
    id: createDecisionRecordId(id),
    workspaceId,
    kind,
    decidedAt: now,
    actor: 'user',
    summary: `${kind} decision`,
    affectedIds,
    version,
    provenanceId,
  };
}

function createAuditEntry(
  workspaceId: WorkspaceId,
  id: string,
  action: string,
  subjectId: string,
  provenanceId: Provenance['id'],
): AuditLogEntry {
  return {
    id: createAuditLogId(id),
    workspaceId,
    actor: 'user',
    action,
    occurredAt: now,
    reversible: true,
    version,
    subjectId,
    provenanceId,
  };
}

function createAcceptedRecoveryPlan(base: ReturnType<typeof createBaseRecords>): Plan {
  return {
    ...base.plan,
    reviewState: 'needs-review',
    scenarioIds: [base.scenario.id],
    decisionIds: [base.scenarioDecision.id],
    auditLogIds: [base.scenarioAuditEntry.id],
  };
}

function createAcceptedRecoveryImpact(base: ReturnType<typeof createBaseRecords>): PlanImpact {
  return {
    ...base.planImpact,
    direction: 'needs-review',
    needsReview: true,
    reviewState: 'needs-review',
    scenarioIds: [base.scenario.id],
    changedRecordIds: [
      ...base.planImpact.changedRecordIds,
      String(base.scenario.id),
      String(base.scenarioDecision.id),
      String(base.scenarioAuditEntry.id),
    ],
    reviewReasons: ['Accepted recovery scenario changed the plan path.'],
    optionIds: ['keep-current-plan', 'adjust-contribution', 'pause-and-review'],
  };
}

function createRecoveryCalendarItem(
  base: ReturnType<typeof createBaseRecords>,
  impact: PlanImpact,
): CalendarItem {
  return {
    id: createCalendarItemId('calendar_personal_recovery_followup'),
    workspaceId: base.plan.workspaceId,
    kind: 'plan-check-in',
    title: 'Review recovery impact',
    localDate: today,
    authorityState: 'inferred',
    version,
    planId: base.plan.id,
    planImpactId: impact.id,
    scenarioId: base.scenario.id,
    provenanceId: base.provenance.id,
  };
}
