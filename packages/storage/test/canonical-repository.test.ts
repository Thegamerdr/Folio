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
  createPlanId,
  createPlanRule,
  createPlanImpactId,
  createPlanRuleId,
  createPlannerItemId,
  createProvenanceId,
  createScenarioId,
  createSourceRecordId,
  createTimelineEntryId,
  createTransaction,
  createTransactionId,
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
  canonicalLocalPersistenceCollections,
  canonicalLocalRepositorySchema,
  createInMemoryCanonicalRepository,
} from '../src/index.js';

const personalWorkspaceId = createWorkspaceId('workspace_personal_demo');
const businessWorkspaceId = createWorkspaceId('workspace_business_demo');
const version = createEntityVersion({ dataVersion: 'test:canonical-repository' });
const now = createInstantString('2026-06-22T10:00:00.000Z');
const today = createLocalDate('2026-06-22');
const tomorrow = createLocalDate('2026-06-23');
const gbp = createCurrencyCode('GBP');

describe('canonical local repository authority', () => {
  it('exposes every canonical collection required by local persistence', () => {
    const base = createBaseRecords(personalWorkspaceId);
    const repository = createInMemoryCanonicalRepository(personalWorkspaceId, {
      workspaces: [base.workspace],
      accounts: [base.account],
      balanceObservations: [base.balanceObservation],
      currentBalances: [base.currentBalance],
      balanceAdjustments: [base.balanceAdjustment],
      availablePositionSnapshots: [base.availablePositionSnapshot],
      sourceRecords: [base.sourceRecord],
      provenance: [base.provenance],
    });

    repository.transactions.put(base.transaction);
    repository.events.put(base.event);
    repository.commitments.put(base.commitment);
    repository.expectations.put(base.expectation);
    repository.plannerItems.put(base.plannerItem);
    repository.plans.put(base.plan);
    repository.planRules.put(base.planRule);
    repository.scenarios.put(base.scenario);
    repository.planImpacts.put(base.planImpact);
    repository.parsedRows.put(base.parsedRow);
    repository.importedClaims.put(base.importedClaim);
    repository.userCorrections.put(base.userCorrection);
    repository.documents.put(base.document);
    repository.documentAttachments.put(base.documentAttachment);
    repository.calendarItems.put(base.calendarItem);
    repository.timelineEntries.put(base.timelineEntry);
    repository.meloMemory.put(base.memory);
    repository.meloProposals.put(base.proposal);
    repository.decisions.put(base.decision);
    repository.auditLog.put(base.auditEntry);

    const snapshot = repository.snapshot();

    expect(snapshot.schema).toBe(canonicalLocalRepositorySchema);
    expect(canonicalLocalPersistenceCollections).toEqual([
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
    ]);
    expect(snapshot.collections.transactions).toEqual([base.transaction]);
    expect(snapshot.collections.balanceObservations).toEqual([base.balanceObservation]);
    expect(snapshot.collections.currentBalances).toEqual([base.currentBalance]);
    expect(snapshot.collections.balanceAdjustments).toEqual([base.balanceAdjustment]);
    expect(snapshot.collections.availablePositionSnapshots).toEqual([
      base.availablePositionSnapshot,
    ]);
    expect(snapshot.collections.timelineEntries).toEqual([base.timelineEntry]);
    expect(snapshot.collections.calendarItems).toEqual([base.calendarItem]);
    expect(snapshot.collections.plans).toEqual([base.plan]);
    expect(snapshot.collections.planRules).toEqual([base.planRule]);
    expect(snapshot.collections.planImpacts).toEqual([base.planImpact]);
    expect(snapshot.collections.parsedRows).toEqual([base.parsedRow]);
    expect(snapshot.collections.importedClaims).toEqual([base.importedClaim]);
    expect(snapshot.collections.userCorrections).toEqual([base.userCorrection]);
    expect(snapshot.collections.documentAttachments).toEqual([base.documentAttachment]);
  });

  it('enforces Personal and Business workspace boundaries at repository writes', () => {
    const personal = createBaseRecords(personalWorkspaceId);
    const business = createBaseRecords(businessWorkspaceId);
    const repository = createInMemoryCanonicalRepository(personalWorkspaceId, {
      workspaces: [personal.workspace],
      accounts: [personal.account],
      sourceRecords: [personal.sourceRecord],
      provenance: [personal.provenance],
    });

    expect(() => repository.accounts.put(business.account)).toThrow(/workspace/);
    expect(() => repository.sourceRecords.put(business.sourceRecord)).toThrow(/workspace/);
    expect(() => repository.balanceObservations.put(business.balanceObservation)).toThrow(
      /workspace/,
    );
    expect(repository.accounts.list()).toEqual([personal.account]);
  });

  it('refuses to commit imported transactions before review is ready', () => {
    const base = createBaseRecords(personalWorkspaceId);
    const repository = createInMemoryCanonicalRepository(personalWorkspaceId, {
      workspaces: [base.workspace],
      accounts: [base.account],
      sourceRecords: [base.sourceRecord],
      provenance: [base.provenance],
      importDrafts: [{ ...base.importDraft, reviewState: 'needs-review' }],
    });

    expect(() =>
      repository.acceptReviewedImportDraft({
        draftId: base.importDraft.id,
        transaction: base.importedTransaction,
        decision: base.importDecision,
        auditEntry: base.importAuditEntry,
      }),
    ).toThrow(/before user review/);
    expect(repository.transactions.list()).toEqual([]);
    expect(repository.decisions.list()).toEqual([]);
  });

  it('commits reviewed imports with source, provenance, decision and audit records', () => {
    const base = createBaseRecords(personalWorkspaceId);
    const repository = createInMemoryCanonicalRepository(personalWorkspaceId, {
      workspaces: [base.workspace],
      accounts: [base.account],
      sourceRecords: [base.sourceRecord],
      provenance: [base.provenance],
      importDrafts: [base.importDraft],
    });

    const transaction = repository.acceptReviewedImportDraft({
      draftId: base.importDraft.id,
      transaction: base.importedTransaction,
      decision: base.importDecision,
      auditEntry: base.importAuditEntry,
      event: base.event,
      calendarItem: base.calendarItem,
      timelineEntry: base.timelineEntry,
    });

    expect(transaction).toEqual(base.importedTransaction);
    expect(repository.importDrafts.get(base.importDraft.id)).toMatchObject({
      reviewState: 'user-confirmed',
      userConfirmationState: 'confirmed',
    });
    expect(repository.transactions.list()).toEqual([base.importedTransaction]);
    expect(repository.decisions.list()).toEqual([base.importDecision]);
    expect(repository.auditLog.list()).toEqual([base.importAuditEntry]);
  });

  it('prevents edits from dropping provenance from canonical facts', () => {
    const base = createBaseRecords(personalWorkspaceId);
    const repository = createInMemoryCanonicalRepository(personalWorkspaceId, {
      workspaces: [base.workspace],
      accounts: [base.account],
      sourceRecords: [base.sourceRecord],
      provenance: [base.provenance],
      transactions: [base.transaction],
    });
    const withoutProvenance = {
      ...base.transaction,
      description: 'Corrected lunch',
      provenanceId: undefined,
    } as unknown as FinancialTransaction;

    expect(() => repository.transactions.put(withoutProvenance)).toThrow(/preserve/);
    expect(
      repository.transactions.put({
        ...base.transaction,
        description: 'Corrected lunch',
      }),
    ).toMatchObject({
      description: 'Corrected lunch',
      provenanceId: base.provenance.id,
    });
  });

  it('keeps scenarios isolated from real transactions until explicit user acceptance', () => {
    const base = createBaseRecords(personalWorkspaceId);
    const repository = createInMemoryCanonicalRepository(personalWorkspaceId, {
      workspaces: [base.workspace],
      accounts: [base.account],
      sourceRecords: [base.sourceRecord],
      provenance: [base.provenance],
      plans: [base.plan],
      planRules: [base.planRule],
      scenarios: [base.scenario],
      planImpacts: [base.planImpact],
    });

    expect(repository.transactions.list()).toEqual([]);

    const acceptedPlan = createAcceptedRecoveryPlan(base);
    const acceptedImpact = createAcceptedRecoveryImpact(base);
    const recoveryCalendarItem = createRecoveryCalendarItem(base, acceptedImpact);
    const accepted = repository.acceptScenario({
      scenarioId: base.scenario.id,
      decision: base.scenarioDecision,
      auditEntry: base.scenarioAuditEntry,
      planUpdates: [acceptedPlan],
      planImpacts: [acceptedImpact],
      calendarItems: [recoveryCalendarItem],
      timelineEntry: base.scenarioTimelineEntry,
    });

    expect(accepted.status).toBe('accepted');
    expect(repository.transactions.list()).toEqual([]);
    expect(repository.decisions.list()).toEqual([base.scenarioDecision]);
    expect(repository.auditLog.list()).toEqual([base.scenarioAuditEntry]);
    expect(repository.plans.get(base.plan.id)).toEqual(acceptedPlan);
    expect(repository.planImpacts.get(base.planImpact.id)).toEqual(acceptedImpact);
    expect(repository.calendarItems.list()).toEqual([recoveryCalendarItem]);
  });

  it('rejects scenario acceptance that tries to update an unrelated plan', () => {
    const base = createBaseRecords(personalWorkspaceId);
    const repository = createInMemoryCanonicalRepository(personalWorkspaceId, {
      workspaces: [base.workspace],
      accounts: [base.account],
      sourceRecords: [base.sourceRecord],
      provenance: [base.provenance],
      plans: [base.plan],
      planRules: [base.planRule],
      scenarios: [base.scenario],
      planImpacts: [base.planImpact],
    });

    expect(() =>
      repository.acceptScenario({
        scenarioId: base.scenario.id,
        decision: base.scenarioDecision,
        auditEntry: base.scenarioAuditEntry,
        planUpdates: [
          {
            ...createAcceptedRecoveryPlan(base),
            id: createPlanId('plan_unrelated_record'),
          },
        ],
      }),
    ).toThrow(/unaffected plan/);
    expect(repository.scenarios.get(base.scenario.id)?.status).toBe('previewed');
    expect(repository.decisions.list()).toEqual([]);
  });

  it('keeps Melo proposals review-only and records proposal decisions separately', () => {
    const base = createBaseRecords(personalWorkspaceId);
    const repository = createInMemoryCanonicalRepository(personalWorkspaceId, {
      workspaces: [base.workspace],
      accounts: [base.account],
      sourceRecords: [base.sourceRecord],
      provenance: [base.provenance],
      meloProposals: [base.proposal],
    });

    expect(() =>
      repository.meloProposals.put({
        ...base.proposal,
        canWriteDirectly: true,
      } as unknown as MeloProposalRecord),
    ).toThrow(/write directly/);

    const reviewed = repository.reviewMeloProposal({
      proposalId: base.proposal.id,
      status: 'rejected',
      decision: base.meloDecision,
      auditEntry: base.meloAuditEntry,
      memory: base.memory,
    });

    expect(reviewed.status).toBe('rejected');
    expect(repository.transactions.list()).toEqual([]);
    expect(repository.meloMemory.list()).toEqual([base.memory]);
    expect(repository.decisions.list()).toEqual([base.meloDecision]);
  });
});

function createBaseRecords(workspaceId: WorkspaceId) {
  const workspace = createWorkspaceRecord(workspaceId);
  const account = createAccountRecord(workspaceId);
  const sourceRecord = createSourceRecord(workspaceId, 'source_manual_record');
  const provenance = createProvenanceRecord(workspaceId, sourceRecord);
  const balanceObservation = createBalanceObservationRecord(
    workspaceId,
    account,
    sourceRecord,
    provenance,
  );
  const currentBalance = createCurrentBalanceRecord(
    workspaceId,
    account,
    balanceObservation,
    provenance,
  );
  const balanceAdjustment = createBalanceAdjustmentRecord(
    workspaceId,
    account,
    balanceObservation,
    sourceRecord,
    provenance,
  );
  const availablePositionSnapshot = createAvailablePositionRecord(
    workspaceId,
    currentBalance,
    balanceObservation,
  );
  const transaction = createTransaction({
    id: 'transaction_manual_record',
    workspaceId,
    accountId: account.id,
    status: 'posted',
    authorityState: 'user-confirmed',
    amount: { minorUnits: -450, currency: gbp },
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
    id: 'transaction_import_record',
    workspaceId,
    accountId: account.id,
    status: 'posted',
    authorityState: 'user-confirmed',
    amount: { minorUnits: -1299, currency: gbp },
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
    id: createImportDraftId('importdraft_review_record'),
    workspaceId,
    sourceRecordId: sourceRecord.id,
    proposedTransactionId: importedTransaction.id,
    parsedRowId: createParsedRowId('parsedrow_review_record'),
    importedClaimId: createImportedClaimId('importedclaim_review_record'),
    authorityState: 'imported-claim',
    reviewState: 'ready-for-user-confirmation',
    userConfirmationState: 'requested',
    parserIssues: [],
    provenanceId: provenance.id,
    version,
  };
  const parsedRow = createParsedRow({
    id: importDraft.parsedRowId ?? 'parsedrow_review_record',
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
    id: importDraft.importedClaimId ?? 'importedclaim_review_record',
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
    id: createEventId('event_manual_record'),
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
    id: createCommitmentId('commitment_rent_record'),
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
    id: createExpectationId('expectation_rent_record'),
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
    id: createPlannerItemId('planner_review_record'),
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
    id: createPlanId('plan_emergency_record'),
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
    ruleIds: [createPlanRuleId('planrule_emergency_record')],
    impactIds: [createPlanImpactId('planimpact_emergency_record')],
    scenarioIds: [],
    accountabilityStyle: 'balanced',
    provenanceId: provenance.id,
  };
  const scenario: Scenario = {
    id: createScenarioId('scenario_recovery_record'),
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
    id: plan.ruleIds?.[0] ?? 'planrule_emergency_record',
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
    id: plan.impactIds?.[0] ?? 'planimpact_emergency_record',
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
  const document: DocumentRecord = {
    id: createDocumentId('document_statement_record'),
    workspaceId,
    kind: 'statement',
    filename: 'statement.csv',
    capturedAt: now,
    authorityState: 'imported-claim',
    reviewState: 'needs-review',
    sourceHash: 'sha256:statement',
    version,
    sourceRecordId: sourceRecord.id,
    provenanceId: provenance.id,
  };
  const documentAttachment = createDocumentAttachment({
    id: createDocumentAttachmentId('documentattachment_statement_source_record'),
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
    id: createCalendarItemId('calendar_rent_record'),
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
    id: createTimelineEntryId('timeline_lunch_record'),
    workspaceId,
    kind: 'fact',
    title: 'Lunch',
    localDate: today,
    authorityState: 'user-confirmed',
    subjectId: transaction.id,
    version,
    provenanceId: provenance.id,
  };
  const importDecision = createDecisionRecord(
    workspaceId,
    'decision_import_record',
    'confirm-import',
    [importDraft.id, importedTransaction.id],
  );
  const scenarioDecision = createDecisionRecord(
    workspaceId,
    'decision_scenario_record',
    'accept-scenario',
    [scenario.id],
  );
  const meloDecision = createDecisionRecord(
    workspaceId,
    'decision_melo_record',
    'dismiss-proposal',
    [],
  );
  const importAuditEntry = createAuditEntry(workspaceId, 'audit_import_record', 'confirm_import');
  const scenarioAuditEntry = createAuditEntry(
    workspaceId,
    'audit_scenario_record',
    'accept_scenario',
  );
  const meloAuditEntry = createAuditEntry(workspaceId, 'audit_melo_record', 'reject_melo_proposal');
  const auditEntry = createAuditEntry(workspaceId, 'audit_manual_record', 'manual_record');
  const userCorrection = createUserCorrection({
    id: createUserCorrectionId('correction_import_record'),
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
  const scenarioTimelineEntry: TimelineEntry = {
    id: createTimelineEntryId('timeline_scenario_record'),
    workspaceId,
    kind: 'decision',
    title: 'Recovery spend preview accepted',
    localDate: today,
    authorityState: 'user-confirmed',
    subjectId: scenarioDecision.id,
    version,
    provenanceId: provenance.id,
  };
  const proposal: MeloProposalRecord = {
    id: createMeloProposalId('proposal_import_record'),
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
    id: createMeloMemoryId('memory_import_record'),
    workspaceId,
    authorityState: 'inferred',
    reviewState: 'needs-review',
    value: 'Melo suggested a reviewable import label.',
    createdAt: now,
    version,
    provenanceId: provenance.id,
  };

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
    document,
    documentAttachment,
    calendarItem,
    timelineEntry,
    scenarioTimelineEntry,
    proposal,
    memory,
    decision: importDecision,
    importDecision,
    scenarioDecision,
    meloDecision,
    auditEntry,
    importAuditEntry,
    scenarioAuditEntry,
    meloAuditEntry,
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

function createAccountRecord(workspaceId: WorkspaceId): Account {
  return createAccount({
    id: 'account_personal_cash',
    workspaceId,
    name: 'Local cash',
    kind: 'cash',
    currency: gbp,
    version,
  });
}

function createBalanceObservationRecord(
  workspaceId: WorkspaceId,
  account: Account,
  sourceRecord: SourceRecord,
  provenance: Provenance,
): BalanceObservation {
  return createBalanceObservation({
    id: 'balance_opening_record',
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
  account: Account,
  observation: BalanceObservation,
  provenance: Provenance,
): CurrentBalance {
  return createCurrentBalance({
    id: 'currentbalance_opening_record',
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
  account: Account,
  observation: BalanceObservation,
  sourceRecord: SourceRecord,
  provenance: Provenance,
): BalanceAdjustment {
  return createBalanceAdjustment({
    id: 'balanceadjustment_opening_correction',
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
  currentBalance: CurrentBalance,
  observation: BalanceObservation,
): AvailablePositionSnapshot {
  return createAvailablePositionSnapshot({
    id: 'position_today_record',
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

function createProvenanceRecord(workspaceId: WorkspaceId, sourceRecord: SourceRecord): Provenance {
  return {
    id: createProvenanceId('provenance_manual_record'),
    workspaceId,
    authorityState: 'user-confirmed',
    sourceRecordIds: [sourceRecord.id],
    links: [
      {
        relationship: 'evidences',
        fromId: sourceRecord.id,
        toId: 'transaction_manual_record',
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
  };
}

function createAuditEntry(workspaceId: WorkspaceId, id: string, action: string): AuditLogEntry {
  return {
    id: createAuditLogId(id),
    workspaceId,
    actor: 'user',
    action,
    occurredAt: now,
    reversible: true,
    version,
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
    id: createCalendarItemId('calendar_recovery_followup_record'),
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
