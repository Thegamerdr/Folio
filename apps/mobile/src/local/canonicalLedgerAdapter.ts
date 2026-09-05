import {
  createAccount,
  createAccountId,
  createAvailablePositionSnapshot,
  createAuditLogId,
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
  createFinancialExpectation,
  createExpectationId,
  createImportDraftId,
  createImportedClaim,
  createImportedClaimId,
  createInstantString,
  createLocalDate,
  createMeloMemoryId,
  createMeloProposalId,
  createMoney,
  createParsedRow,
  createParsedRowId,
  createPlanImpactId,
  createPlanId,
  createPlanRule,
  createPlanRuleId,
  createPlannerItemId,
  createProvenanceId,
  createScenarioId,
  createSourceRecordId,
  createTimeZoneId,
  createTimelineEntryId,
  createTransactionSplit,
  createTransactionId,
  createUserCorrection,
  createUserCorrectionId,
  createForecastId,
  createWorkspace,
  createWorkspaceId,
  type Account,
  type AccountId,
  type AuditLogEntry,
  type AuthorityState,
  type AvailablePositionSnapshot,
  type BalanceAdjustment,
  type BalanceObservation,
  type CalendarItem,
  type Commitment,
  type CurrencyCode,
  type CurrentBalance,
  type DecisionKind,
  type DecisionRecord,
  type DocumentAttachment,
  type DocumentRecord,
  type Event,
  type FinancialExpectation,
  type FinancialTransaction,
  type Forecast,
  type ImportedClaim,
  type ImportDraft,
  type InstantString,
  type LocalDate,
  type MeloMemory,
  type MeloProposalRecord,
  type Plan,
  type PlanImpact,
  type PlanRule,
  type ParserIssue,
  type ParsedRow,
  type PlannerItem,
  type Provenance,
  type ProvenanceId,
  type ReviewState,
  type Scenario,
  type SourceRecord,
  type SourceRecordKind,
  type SourceRecordId,
  type TimelineEntry,
  type TransactionSourceKind,
  type UserCorrection,
  type Workspace,
  type WorkspaceId,
} from '@folio/domain';
import { derivePlanImpactFromCanonicalRecords } from '@folio/plan-engine';

import type {
  LocalImportDraft,
  LocalLedgerState,
  LocalRejectedImportEvidence,
} from './localLedger.js';

export const canonicalMobileLedgerSchema = 'folio-mobile-canonical-ledger-v1';
export const canonicalMobileWorkspaceId = createWorkspaceId('workspace_personal_local');
export const canonicalMobileAccountId = 'account_personal_cash' as AccountId;
export const canonicalMobileTimeZone = createTimeZoneId('Europe/London');
const forbiddenTrustMetricPattern = new RegExp(
  `\\b${'confi'}${'dence'}\\b|${'confi'}${'dence'}_|_${'confi'}${'dence'}|\\b${'sco'}${'re'}\\b`,
  'i',
);

export type CanonicalSqlAuthorityState =
  | 'confirmed'
  | 'user_confirmed'
  | 'provider_reported'
  | 'imported_claim'
  | 'inferred'
  | 'estimated'
  | 'hypothetical'
  | 'superseded'
  | 'reversed';

export type CanonicalMobileStorageRows = Readonly<{
  workspaces: readonly Readonly<Record<string, unknown>>[];
  accounts: readonly Readonly<Record<string, unknown>>[];
  balanceObservations: readonly Readonly<Record<string, unknown>>[];
  currentBalances: readonly Readonly<Record<string, unknown>>[];
  balanceAdjustments: readonly Readonly<Record<string, unknown>>[];
  availablePositionSnapshots: readonly Readonly<Record<string, unknown>>[];
  sourceRecords: readonly Readonly<Record<string, unknown>>[];
  provenance: readonly Readonly<Record<string, unknown>>[];
  parsedRows: readonly Readonly<Record<string, unknown>>[];
  importedClaims: readonly Readonly<Record<string, unknown>>[];
  importDrafts: readonly Readonly<Record<string, unknown>>[];
  userCorrections: readonly Readonly<Record<string, unknown>>[];
  transactions: readonly Readonly<Record<string, unknown>>[];
  events: readonly Readonly<Record<string, unknown>>[];
  commitments: readonly Readonly<Record<string, unknown>>[];
  expectations: readonly Readonly<Record<string, unknown>>[];
  plannerItems: readonly Readonly<Record<string, unknown>>[];
  plans: readonly Readonly<Record<string, unknown>>[];
  planRules: readonly Readonly<Record<string, unknown>>[];
  scenarios: readonly Readonly<Record<string, unknown>>[];
  planImpacts: readonly Readonly<Record<string, unknown>>[];
  forecastSnapshots: readonly Readonly<Record<string, unknown>>[];
  documents: readonly Readonly<Record<string, unknown>>[];
  documentAttachments: readonly Readonly<Record<string, unknown>>[];
  calendarItems: readonly Readonly<Record<string, unknown>>[];
  timelineEntries: readonly Readonly<Record<string, unknown>>[];
  decisionRecords: readonly Readonly<Record<string, unknown>>[];
  meloMemories: readonly Readonly<Record<string, unknown>>[];
  meloProposals: readonly Readonly<Record<string, unknown>>[];
  auditLog: readonly Readonly<Record<string, unknown>>[];
}>;

export type CanonicalMobileLedgerValidation = Readonly<{
  valid: boolean;
  issues: readonly string[];
}>;

/** A balance-bearing account supplied by a richer application state. `balanceMinor` is always
 * integer minor units here, even when the source store uses decimal major units. */
export type CanonicalMobileAccountInput = Readonly<{
  id: string;
  name: string;
  kind: Account['kind'];
  currency: string;
  state?: Account['state'];
  addedAt?: string;
  projectionRole?: Account['projectionRole'];
  balanceMinor: number;
  balanceAsOfISO: string;
  balanceSourceKind?: BalanceObservation['sourceKind'];
  balanceConfidence?: BalanceObservation['sourceConfidence'];
  balanceSourceVariant?: BalanceObservation['sourceVariant'];
  authorityState?: AuthorityState;
  includeInAvailablePosition?: boolean;
}>;

export type CanonicalMobileLedgerProjectionOptions = Readonly<{
  accounts?: readonly CanonicalMobileAccountInput[];
  defaultAccountId?: string;
}>;

export type CanonicalMobileLedgerSnapshot = Readonly<{
  schema: typeof canonicalMobileLedgerSchema;
  dataVersion: string;
  workspace: Workspace;
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
  documents: readonly DocumentRecord[];
  documentAttachments: readonly DocumentAttachment[];
  calendarItems: readonly CalendarItem[];
  timelineEntries: readonly TimelineEntry[];
  decisionRecords: readonly DecisionRecord[];
  meloMemories: readonly MeloMemory[];
  meloProposals: readonly MeloProposalRecord[];
  auditLog: readonly AuditLogEntry[];
  rows: CanonicalMobileStorageRows;
  validation: CanonicalMobileLedgerValidation;
}>;

type CanonicalBuildContext = Readonly<{
  asOfDate: LocalDate;
  capturedAt: InstantString;
  currency: CurrencyCode;
  dataVersion: string;
  version: ReturnType<typeof createEntityVersion>;
  workspaceId: WorkspaceId;
}>;

type CanonicalAccountProjection = Readonly<{
  sourceId: string;
  account: Account;
  balanceMinor: number;
  observedOn: LocalDate;
  observedAt: InstantString;
  balanceSourceKind: BalanceObservation['sourceKind'];
  balanceConfidence?: BalanceObservation['sourceConfidence'];
  balanceSourceVariant?: BalanceObservation['sourceVariant'];
  authorityState: AuthorityState;
  includeInAvailablePosition: boolean;
  explicit: boolean;
}>;

type TransactionProjection = Readonly<{
  localId: string;
  title: string;
  localDate: LocalDate;
  amountMinor: number;
  authorityState: AuthorityState;
  sourceRecordId: SourceRecordId;
  provenanceId: ProvenanceId;
  transaction?: FinancialTransaction;
  expectation?: FinancialExpectation;
  event: Event;
  commitment?: Commitment;
  calendarItem: CalendarItem;
  timelineEntry: TimelineEntry;
}>;

export function createCanonicalMobileLedgerSnapshot(
  state: LocalLedgerState,
  workspaceInput?: Workspace,
  options: CanonicalMobileLedgerProjectionOptions = {},
): CanonicalMobileLedgerSnapshot {
  const workspaceId = workspaceInput?.id ?? canonicalMobileWorkspaceId;
  if (
    workspaceInput !== undefined &&
    String(workspaceInput.baseCurrency) !== String(state.currency)
  ) {
    throw new Error('Canonical local ledger currency must match its workspace currency.');
  }
  const dataVersion = createCanonicalDataVersion({
    workspaceId,
    asOfDate: state.asOfDate,
    cashOnHandMinor: state.cashOnHandMinor,
    transactions: state.transactions,
    importDrafts: state.importDrafts,
    rejectedImports: state.rejectedImports,
    documentStages: state.documentStages,
    history: state.history,
    accounts: options.accounts ?? [],
  });
  const context: CanonicalBuildContext = {
    asOfDate: createLocalDate(state.asOfDate),
    capturedAt: createInstantString(`${state.asOfDate}T10:00:00.000Z`),
    currency: createCurrencyCode(state.currency),
    dataVersion,
    version: createEntityVersion({ dataVersion }),
    workspaceId,
  };
  const workspace = createWorkspace({
    id: context.workspaceId,
    kind: workspaceInput?.kind ?? 'personal',
    name: workspaceInput?.name ?? 'Personal',
    baseCurrency: context.currency,
    jurisdiction: workspaceInput?.jurisdiction ?? 'GB',
    timeZone: workspaceInput?.timeZone ?? canonicalMobileTimeZone,
    version: { dataVersion },
  });
  const accountProjections = createAccountProjections(context, state, options);
  const accounts = accountProjections.map((projection) => projection.account);
  const transactionAccountIds = new Map(
    accountProjections.map((projection) => [projection.sourceId, projection.account.id]),
  );
  const defaultAccountId = resolveDefaultAccountId(accountProjections, options.defaultAccountId);

  const sourceRecords: SourceRecord[] = [];
  const provenance: Provenance[] = [];
  const balanceObservations: BalanceObservation[] = [];
  const currentBalances: CurrentBalance[] = [];
  const balanceAdjustments: BalanceAdjustment[] = [];
  const projections: TransactionProjection[] = [];
  const parsedRows: ParsedRow[] = [];
  const importedClaims: ImportedClaim[] = [];
  const importDrafts: ImportDraft[] = [];
  const userCorrections: UserCorrection[] = [];
  const plannerItems: PlannerItem[] = [];
  const documents: DocumentRecord[] = [];
  const documentAttachments: DocumentAttachment[] = [];
  const decisionRecords: DecisionRecord[] = [];
  const scenarios: Scenario[] = [];
  const meloMemories: MeloMemory[] = [];
  const meloProposals: MeloProposalRecord[] = [];
  const auditLog: AuditLogEntry[] = [];
  for (const accountProjection of accountProjections) {
    const openingBalanceSourceRecord = createSourceRecordForOpeningBalance(
      context,
      state,
      accountProjection,
    );
    const openingBalanceProvenance = createProvenanceForSource(
      context,
      openingBalanceSourceRecord,
      accountProjection.authorityState,
      'balance_observation',
      openingBalanceId(accountProjection),
    );
    const openingBalanceObservation = createOpeningBalanceObservation(
      context,
      accountProjection,
      openingBalanceSourceRecord.id,
      openingBalanceProvenance.id,
    );
    const currentBalance = createCurrentBalanceFromObservation(
      context,
      openingBalanceObservation,
      openingBalanceProvenance.id,
    );
    sourceRecords.push(openingBalanceSourceRecord);
    provenance.push(openingBalanceProvenance);
    balanceObservations.push(openingBalanceObservation);
    currentBalances.push(currentBalance);
  }

  for (const transaction of state.transactions) {
    const accountId = resolveTransactionAccountId(
      transaction.accountId,
      transactionAccountIds,
      defaultAccountId,
    );
    const sourceRecord = createSourceRecordForLocalTransaction(context, transaction);
    const transactionProvenance = createProvenanceForSource(
      context,
      sourceRecord,
      transactionAuthorityState(transaction),
      'transaction',
      canonicalId('transaction', transaction.id),
    );
    const projection = createTransactionProjection(
      context,
      transaction,
      sourceRecord.id,
      transactionProvenance.id,
      accountId,
    );
    sourceRecords.push(sourceRecord);
    provenance.push(transactionProvenance);
    projections.push(projection);
    if (transaction.source === 'import') {
      const parsedRow = createParsedRowForAcceptedImport(
        context,
        transaction,
        sourceRecord.id,
        transactionProvenance.id,
      );
      parsedRows.push(parsedRow);
      importedClaims.push(
        createImportedClaimForAcceptedImport({
          context,
          eventId: projection.event.id,
          parsedRow,
          provenanceId: transactionProvenance.id,
          sourceRecordId: sourceRecord.id,
          transaction,
        }),
      );
    }
  }

  for (const [draftIndex, draft] of state.importDrafts.entries()) {
    const sourceRecord = createSourceRecordForImportDraft(context, draft);
    const draftProvenance = createProvenanceForSource(
      context,
      sourceRecord,
      draft.authorityState,
      'import_draft',
      canonicalId('importdraft', draft.rowId),
    );
    const parsedRow = createParsedRowForDraft(
      context,
      draft,
      sourceRecord.id,
      draftProvenance.id,
      draftIndex,
    );
    const importedClaim = createImportedClaimForDraft(
      context,
      draft,
      sourceRecord.id,
      parsedRow.id,
      draftProvenance.id,
    );
    sourceRecords.push(sourceRecord);
    provenance.push(draftProvenance);
    parsedRows.push(parsedRow);
    importedClaims.push(importedClaim);
    importDrafts.push(
      createCanonicalImportDraft(
        context,
        draft,
        sourceRecord.id,
        draftProvenance.id,
        parsedRow.id,
        importedClaim.id,
      ),
    );
    plannerItems.push(createImportReviewPlannerItem(context, draft, draftProvenance.id));
  }

  for (const [rejectedIndex, rejected] of state.rejectedImports.entries()) {
    const sourceRecord = createSourceRecordForRejectedImport(context, rejected);
    const rejectedProvenance = createProvenanceForSource(
      context,
      sourceRecord,
      'imported-claim',
      'rejected_import',
      canonicalId('importedclaim', rejected.rowId),
    );
    const parsedRow = createParsedRowForRejectedImport(
      context,
      rejected,
      sourceRecord.id,
      rejectedProvenance.id,
      rejectedIndex,
    );
    const importedClaim = createImportedClaimForRejectedImport(
      context,
      rejected,
      sourceRecord.id,
      parsedRow.id,
      rejectedProvenance.id,
    );
    sourceRecords.push(sourceRecord);
    provenance.push(rejectedProvenance);
    parsedRows.push(parsedRow);
    importedClaims.push(importedClaim);
    importDrafts.push(
      createCanonicalRejectedImportDraft(
        context,
        rejected,
        sourceRecord.id,
        rejectedProvenance.id,
        parsedRow.id,
        importedClaim.id,
      ),
    );
  }

  for (const [index, document] of state.documentStages.entries()) {
    const documentRecord = createCanonicalDocument(context, document, index);
    const sourceRecord = createSourceRecordForDocument(context, document, documentRecord.id);
    const documentProvenance = createProvenanceForSource(
      context,
      sourceRecord,
      'imported-claim',
      'document',
      documentRecord.id,
    );
    const attachment = createDocumentAttachmentForSource(
      context,
      documentRecord.id,
      sourceRecord.id,
      documentProvenance.id,
    );
    documents.push({
      ...documentRecord,
      provenanceId: documentProvenance.id,
      sourceRecordId: sourceRecord.id,
      attachmentIds: [attachment.id],
    });
    documentAttachments.push(attachment);
    sourceRecords.push(sourceRecord);
    provenance.push(documentProvenance);
  }

  for (const entry of state.history) {
    const auditEntry = createCanonicalAuditEntry(context, entry);
    auditLog.push(auditEntry);
    const decision = decisionRecordFromHistory(context, entry);
    if (decision !== undefined) decisionRecords.push(decision);
    const correction = createUserCorrectionFromHistory(context, entry, decision?.id);
    if (correction !== undefined) userCorrections.push(correction);
    const scenario = createScenarioFromHistory(context, entry);
    if (scenario !== undefined) scenarios.push(scenario);
    const meloProposal = createMeloProposalFromHistory(context, entry);
    if (meloProposal !== undefined) meloProposals.push(meloProposal);
    const meloMemory = createMeloMemoryFromHistory(context, entry);
    if (meloMemory !== undefined) meloMemories.push(meloMemory);
  }

  const transactions = projections.map((projection) => projection.transaction).filter(isPresent);
  const expectations = projections.map((projection) => projection.expectation).filter(isPresent);
  const events = projections.map((projection) => projection.event);
  const commitments = projections.map((projection) => projection.commitment).filter(isPresent);
  const recoveryScenarioIds = scenarios.map((scenario) => scenario.id);
  const acceptedRecoveryDecisionIds = decisionRecords
    .filter((decision) => decision.kind === 'accept-scenario')
    .map((decision) => decision.id);
  const acceptedRecoveryAuditIds = auditLog
    .filter((entry) => entry.action === 'recovery_recorded' || entry.action === 'accept_scenario')
    .map((entry) => entry.id);
  const plans = commitments.map((commitment) =>
    createPlanFromCommitment(context, commitment, {
      auditLogIds: acceptedRecoveryAuditIds,
      decisionIds: acceptedRecoveryDecisionIds,
      events,
      expectations,
      scenarioIds: recoveryScenarioIds,
      transactions,
    }),
  );
  const linkedScenarios = scenarios.map((scenario) =>
    scenario.affectedPlanIds.length > 0 || plans.length === 0
      ? scenario
      : { ...scenario, affectedPlanIds: plans.map((plan) => plan.id) },
  );
  const planRules = plans.map((plan) => createPlanRuleFromPlan(context, plan));
  const planImpacts = plans.map((plan, index) => {
    const commitment = commitments[index];
    const currentBalance = currentBalances.find(
      (balance) => balance.accountId === commitment?.accountId,
    );
    if (currentBalance === undefined) {
      throw new Error(`Canonical plan ${String(plan.id)} is missing its account balance.`);
    }
    return createPlanImpactFromPlan(context, plan, {
      currentBalance,
      scenarios: linkedScenarios,
    });
  });
  const forecastSnapshots = createForecastSnapshots(context, {
    transactions,
    expectations,
    commitments,
    scenarios: linkedScenarios,
  });
  const availableAccountIds = new Set(
    accountProjections
      .filter((projection) => projection.includeInAvailablePosition)
      .map((projection) => projection.account.id),
  );
  const availableCurrentBalances = currentBalances.filter((balance) =>
    availableAccountIds.has(balance.accountId),
  );
  const availableBalanceObservations = balanceObservations.filter((observation) =>
    availableAccountIds.has(observation.accountId),
  );
  const availablePositionSnapshots =
    availableCurrentBalances.length === 0
      ? []
      : [
          createAvailablePositionFromCanonicalRecords(context, {
            accountIds: availableAccountIds,
            commitments,
            currentBalances: availableCurrentBalances,
            expectations,
            openingBalanceObservations: availableBalanceObservations,
            transactions,
          }),
        ];
  const calendarItems = [
    ...projections.map((projection) => projection.calendarItem),
    ...plannerItems.map((item) => createCalendarItemForPlannerItem(context, item)),
    ...plans.map((plan) => createCalendarItemForPlan(context, plan)),
    ...plans.flatMap((plan) =>
      createCalendarItemsForPlanRule(
        context,
        plan,
        planRules.find((rule) => rule.planId === plan.id),
      ),
    ),
    ...planImpacts
      .filter((impact) => impact.needsReview)
      .map((impact) => createCalendarItemForPlanImpact(context, impact)),
  ];
  const timelineEntries = [
    ...projections.map((projection) => projection.timelineEntry),
    ...importDrafts
      .filter(isActiveImportDraft)
      .map((draft) => createTimelineEntryForImportDraft(context, draft)),
    ...decisionRecords.map((decision) => createTimelineEntryForDecision(context, decision)),
  ];

  const snapshotWithoutRows = {
    schema: canonicalMobileLedgerSchema,
    dataVersion,
    workspace,
    accounts,
    balanceObservations,
    currentBalances,
    balanceAdjustments,
    availablePositionSnapshots,
    sourceRecords,
    provenance,
    parsedRows,
    importedClaims,
    importDrafts,
    userCorrections,
    transactions,
    events,
    commitments,
    expectations,
    plannerItems,
    plans,
    planRules,
    scenarios: linkedScenarios,
    planImpacts,
    forecastSnapshots,
    documents,
    documentAttachments,
    calendarItems,
    timelineEntries,
    decisionRecords,
    meloMemories,
    meloProposals,
    auditLog,
  } satisfies Omit<CanonicalMobileLedgerSnapshot, 'rows' | 'validation'>;
  const rows = createCanonicalMobileStorageRows(snapshotWithoutRows);
  const validation = validateCanonicalMobileLedgerSnapshot({
    ...snapshotWithoutRows,
    rows,
    validation: { valid: true, issues: [] },
  });

  return {
    ...snapshotWithoutRows,
    rows,
    validation,
  };
}

export function canonicalAccountIdForWorkspace(workspaceId: WorkspaceId): AccountId {
  if (String(workspaceId) === String(canonicalMobileWorkspaceId)) {
    return canonicalMobileAccountId;
  }
  return `account_workspace_cash_${hashStableString(String(workspaceId))}` as AccountId;
}

/** Deterministic canonical identity for a named source account inside one workspace. */
export function canonicalAccountIdForSource(
  workspaceId: WorkspaceId,
  sourceAccountId: string,
): AccountId {
  const checked = sourceAccountId.trim();
  if (checked.length === 0) throw new Error('Canonical source account ID is required.');
  return createAccountId(canonicalId('account', `${String(workspaceId)}_${checked}`));
}

export function validateCanonicalMobileLedgerSnapshot(
  snapshot: CanonicalMobileLedgerSnapshot,
): CanonicalMobileLedgerValidation {
  const issues: string[] = [];
  const workspaceId = snapshot.workspace.id;
  const accountIds = new Set(snapshot.accounts.map((account) => account.id));
  const sourceRecordIds = new Set(snapshot.sourceRecords.map((record) => record.id));
  const provenanceIds = new Set(snapshot.provenance.map((record) => record.id));

  if (snapshot.schema !== canonicalMobileLedgerSchema) {
    issues.push('Canonical mobile ledger schema is not supported.');
  }
  if (snapshot.workspace.kind !== 'personal' && snapshot.workspace.kind !== 'business') {
    issues.push('Canonical mobile ledger workspace kind is not supported.');
  }
  if (snapshot.accounts.length === 0) {
    issues.push('Canonical mobile ledger requires at least one local account.');
  }
  if (snapshot.balanceObservations.length === 0) {
    issues.push('Canonical mobile ledger requires at least one balance observation.');
  }
  if (snapshot.currentBalances.length === 0) {
    issues.push('Canonical mobile ledger requires at least one current balance.');
  }

  for (const record of allWorkspaceRecords(snapshot)) {
    if (record.workspaceId !== workspaceId) {
      issues.push(`Record ${String(record.id)} is outside the canonical workspace.`);
    }
  }
  for (const observation of snapshot.balanceObservations) {
    if (!accountIds.has(observation.accountId)) {
      issues.push(`Balance observation ${observation.id} is missing its account.`);
    }
    if (
      observation.sourceRecordId === undefined ||
      !sourceRecordIds.has(observation.sourceRecordId)
    ) {
      issues.push(`Balance observation ${observation.id} is missing its source record.`);
    }
    if (observation.provenanceId === undefined || !provenanceIds.has(observation.provenanceId)) {
      issues.push(`Balance observation ${observation.id} is missing provenance.`);
    }
  }
  for (const balance of snapshot.currentBalances) {
    if (!accountIds.has(balance.accountId)) {
      issues.push(`Current balance ${balance.id} is missing its account.`);
    }
    if (
      !snapshot.balanceObservations.some(
        (observation) => observation.id === balance.sourceObservationId,
      )
    ) {
      issues.push(`Current balance ${balance.id} is missing its source observation.`);
    }
  }
  for (const position of snapshot.availablePositionSnapshots) {
    if (position.currentBalanceIds.length === 0 || position.balanceObservationIds.length === 0) {
      issues.push(`Available position ${position.id} is missing balance sources.`);
    }
  }
  for (const row of snapshot.parsedRows) {
    if (!sourceRecordIds.has(row.sourceRecordId)) {
      issues.push(`Parsed row ${row.id} is missing its source record.`);
    }
    if (row.provenanceId === undefined || !provenanceIds.has(row.provenanceId)) {
      issues.push(`Parsed row ${row.id} is missing provenance.`);
    }
  }
  for (const claim of snapshot.importedClaims) {
    if (!sourceRecordIds.has(claim.sourceRecordId)) {
      issues.push(`Imported claim ${claim.id} is missing its source record.`);
    }
    if (claim.provenanceId === undefined || !provenanceIds.has(claim.provenanceId)) {
      issues.push(`Imported claim ${claim.id} is missing provenance.`);
    }
    if (
      claim.importDraftId !== undefined &&
      !snapshot.importDrafts.some((draft) => draft.id === claim.importDraftId)
    ) {
      issues.push(`Imported claim ${claim.id} is missing its import draft.`);
    }
    if (
      claim.parsedRowId !== undefined &&
      !snapshot.parsedRows.some((row) => row.id === claim.parsedRowId)
    ) {
      issues.push(`Imported claim ${claim.id} is missing its parsed row.`);
    }
  }
  for (const plan of snapshot.plans) {
    if (plan.provenanceId === undefined || !provenanceIds.has(plan.provenanceId)) {
      issues.push(`Plan ${plan.id} is missing provenance.`);
    }
    for (const ruleId of plan.ruleIds ?? []) {
      if (!snapshot.planRules.some((rule) => rule.id === ruleId)) {
        issues.push(`Plan ${plan.id} is missing rule ${ruleId}.`);
      }
    }
    for (const impactId of plan.impactIds ?? []) {
      if (!snapshot.planImpacts.some((impact) => impact.id === impactId)) {
        issues.push(`Plan ${plan.id} is missing impact ${impactId}.`);
      }
    }
  }
  for (const rule of snapshot.planRules) {
    if (!snapshot.plans.some((plan) => plan.id === rule.planId)) {
      issues.push(`Plan rule ${rule.id} is missing its plan.`);
    }
  }
  for (const impact of snapshot.planImpacts) {
    if (!snapshot.plans.some((plan) => plan.id === impact.planId)) {
      issues.push(`Plan impact ${impact.id} is missing its plan.`);
    }
  }
  for (const draft of snapshot.importDrafts) {
    if (!sourceRecordIds.has(draft.sourceRecordId)) {
      issues.push(`Import draft ${draft.id} is missing its source record.`);
    }
    if (!provenanceIds.has(draft.provenanceId)) {
      issues.push(`Import draft ${draft.id} is missing provenance.`);
    }
    if (draft.userConfirmationState === 'confirmed' && draft.reviewState !== 'user-confirmed') {
      issues.push(`Import draft ${draft.id} has mismatched confirmation state.`);
    }
    if (
      draft.parsedRowId !== undefined &&
      !snapshot.parsedRows.some((row) => row.id === draft.parsedRowId)
    ) {
      issues.push(`Import draft ${draft.id} is missing parsed row ${draft.parsedRowId}.`);
    }
    if (
      draft.importedClaimId !== undefined &&
      !snapshot.importedClaims.some((claim) => claim.id === draft.importedClaimId)
    ) {
      issues.push(`Import draft ${draft.id} is missing imported claim ${draft.importedClaimId}.`);
    }
  }
  for (const correction of snapshot.userCorrections) {
    if (
      correction.sourceRecordId !== undefined &&
      !sourceRecordIds.has(correction.sourceRecordId)
    ) {
      issues.push(`User correction ${correction.id} is missing its source record.`);
    }
    if (correction.provenanceId !== undefined && !provenanceIds.has(correction.provenanceId)) {
      issues.push(`User correction ${correction.id} is missing provenance.`);
    }
  }
  for (const transaction of snapshot.transactions) {
    if (!accountIds.has(transaction.accountId)) {
      issues.push(`Transaction ${transaction.id} is missing its account.`);
    }
    if (
      transaction.sourceRecordId === undefined ||
      !sourceRecordIds.has(transaction.sourceRecordId)
    ) {
      issues.push(`Transaction ${transaction.id} is missing its source record.`);
    }
    if (transaction.provenanceId === undefined || !provenanceIds.has(transaction.provenanceId)) {
      issues.push(`Transaction ${transaction.id} is missing provenance.`);
    }
    // A future-dated confirmed transaction is legitimate (e.g. a known upcoming rent or payday the
    // ledger already models), so it is NOT a validation failure. Treating it as fatal made the
    // canonical repository throw during render and crashed the app on launch once the device date
    // advanced past a seeded/imported row.
  }
  for (const expectation of snapshot.expectations) {
    if (expectation.accountId !== undefined && !accountIds.has(expectation.accountId)) {
      issues.push(`Expectation ${expectation.id} is missing its account.`);
    }
  }
  for (const commitment of snapshot.commitments) {
    if (commitment.accountId !== undefined && !accountIds.has(commitment.accountId)) {
      issues.push(`Commitment ${commitment.id} is missing its account.`);
    }
  }
  for (const proposal of snapshot.meloProposals) {
    if (proposal.canWriteDirectly !== false) {
      issues.push(`Melo proposal ${proposal.id} can write directly.`);
    }
  }
  for (const document of snapshot.documents) {
    if (document.sourceRecordId !== undefined && !sourceRecordIds.has(document.sourceRecordId)) {
      issues.push(`Document ${document.id} is missing its source record.`);
    }
    for (const attachmentId of document.attachmentIds ?? []) {
      if (!snapshot.documentAttachments.some((attachment) => attachment.id === attachmentId)) {
        issues.push(`Document ${document.id} is missing attachment ${attachmentId}.`);
      }
    }
  }
  for (const attachment of snapshot.documentAttachments) {
    if (!snapshot.documents.some((document) => document.id === attachment.documentId)) {
      issues.push(`Document attachment ${attachment.id} is missing its document.`);
    }
    if (
      attachment.sourceRecordId !== undefined &&
      !sourceRecordIds.has(attachment.sourceRecordId)
    ) {
      issues.push(`Document attachment ${attachment.id} is missing its source record.`);
    }
    if (attachment.provenanceId !== undefined && !provenanceIds.has(attachment.provenanceId)) {
      issues.push(`Document attachment ${attachment.id} is missing provenance.`);
    }
  }

  const serialized = JSON.stringify(snapshot.rows);
  if (forbiddenTrustMetricPattern.test(serialized)) {
    issues.push('Canonical mobile storage rows expose forbidden trust-metric language.');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function createCanonicalMobileStorageRows(
  snapshot: Omit<CanonicalMobileLedgerSnapshot, 'rows' | 'validation'>,
): CanonicalMobileStorageRows {
  return {
    workspaces: [
      {
        id: snapshot.workspace.id,
        kind: snapshot.workspace.kind,
        name: snapshot.workspace.name,
        base_currency: snapshot.workspace.baseCurrency,
        jurisdiction: snapshot.workspace.jurisdiction,
        time_zone: snapshot.workspace.timeZone,
        data_version: snapshot.workspace.version.dataVersion,
      },
    ],
    accounts: snapshot.accounts.map((account) => ({
      id: account.id,
      workspace_id: account.workspaceId,
      name: account.name,
      kind: account.kind,
      currency: account.currency,
      state: account.state,
      source_account_id: account.sourceAccountId ?? null,
      created_at: account.createdAt ?? null,
      projection_role: account.projectionRole ?? null,
      data_version: account.version.dataVersion,
    })),
    balanceObservations: snapshot.balanceObservations.map((observation) => ({
      id: observation.id,
      workspace_id: observation.workspaceId,
      account_id: observation.accountId,
      observed_on: observation.observedOn,
      observed_at: observation.observedAt ?? null,
      amount_minor: observation.balance.minorUnits,
      currency: observation.balance.currency,
      source: observation.source,
      source_kind: observation.sourceKind,
      observation_kind: observation.observationKind,
      authority_state: authorityStateToSql(observation.authorityState),
      review_state: reviewStateToSql(observation.reviewState),
      reconciliation_state: observation.reconciliationState,
      source_record_id: observation.sourceRecordId ?? null,
      provenance_id: observation.provenanceId ?? null,
      replaces: observation.replaces ?? null,
      data_version: observation.version.dataVersion,
    })),
    currentBalances: snapshot.currentBalances.map((balance) => ({
      id: balance.id,
      workspace_id: balance.workspaceId,
      account_id: balance.accountId,
      as_of: balance.asOf,
      amount_minor: balance.balance.minorUnits,
      currency: balance.balance.currency,
      source_kind: balance.sourceKind,
      authority_state: authorityStateToSql(balance.authorityState),
      review_state: reviewStateToSql(balance.reviewState),
      source_observation_id: balance.sourceObservationId,
      calculated_from_transaction_ids_json: JSON.stringify(
        balance.calculatedFromTransactionIds ?? [],
      ),
      provenance_id: balance.provenanceId ?? null,
      updated_at: balance.updatedAt,
      data_version: balance.version.dataVersion,
    })),
    balanceAdjustments: snapshot.balanceAdjustments.map((adjustment) => ({
      id: adjustment.id,
      workspace_id: adjustment.workspaceId,
      account_id: adjustment.accountId,
      kind: adjustment.kind,
      local_date: adjustment.localDate,
      amount_minor: adjustment.amount.minorUnits,
      currency: adjustment.amount.currency,
      reason: adjustment.reason,
      authority_state: authorityStateToSql(adjustment.authorityState),
      review_state: reviewStateToSql(adjustment.reviewState),
      source_observation_id: adjustment.sourceObservationId ?? null,
      resulting_observation_id: adjustment.resultingObservationId ?? null,
      decision_id: adjustment.decisionId ?? null,
      audit_log_id: adjustment.auditLogId ?? null,
      source_record_id: adjustment.sourceRecordId ?? null,
      provenance_id: adjustment.provenanceId ?? null,
      data_version: adjustment.version.dataVersion,
    })),
    availablePositionSnapshots: snapshot.availablePositionSnapshots.map((position) => ({
      id: position.id,
      workspace_id: position.workspaceId,
      as_of: position.asOf,
      currency: position.currency,
      opening_balance_minor: position.openingBalance.minorUnits,
      available_balance_minor: position.availableBalance.minorUnits,
      protected_floor_minor: position.protectedFloor.minorUnits,
      actual_net_minor: position.actualNet.minorUnits,
      expected_net_minor: position.expectedNet.minorUnits,
      current_balance_ids_json: JSON.stringify(position.currentBalanceIds),
      balance_observation_ids_json: JSON.stringify(position.balanceObservationIds),
      source_ids_json: JSON.stringify(position.sourceIds),
      authority_state: authorityStateToSql(position.authorityState),
      review_state: reviewStateToSql(position.reviewState),
      provenance_id: position.provenanceId ?? null,
      created_at: position.createdAt,
      data_version: position.version.dataVersion,
    })),
    sourceRecords: snapshot.sourceRecords.map((record) => ({
      id: record.id,
      workspace_id: record.workspaceId,
      kind: sourceRecordKindToSql(record.kind),
      authority_state: authorityStateToSql(record.authorityState),
      review_state: record.reviewState === undefined ? null : reviewStateToSql(record.reviewState),
      label: record.label,
      source_hash: record.sourceHash,
      external_id: record.externalId ?? null,
      document_id: record.documentId ?? null,
      rejection_reason: record.rejectionReason ?? null,
      non_financial: record.nonFinancial === true ? 1 : 0,
      captured_at: record.capturedAt,
      data_version: record.version.dataVersion,
    })),
    provenance: snapshot.provenance.map((record) => ({
      id: record.id,
      workspace_id: record.workspaceId,
      authority_state: authorityStateToSql(record.authorityState),
      source_record_ids_json: JSON.stringify(record.sourceRecordIds),
      links_json: JSON.stringify(record.links),
      created_at: record.createdAt,
      data_version: record.version.dataVersion,
    })),
    parsedRows: snapshot.parsedRows.map((row) => ({
      id: row.id,
      workspace_id: row.workspaceId,
      source_record_id: row.sourceRecordId,
      row_index: row.rowIndex,
      raw_text: row.rawText,
      parsed_at: row.parsedAt,
      parser_name: row.parserName,
      parser_issues_json: JSON.stringify(row.parserIssues),
      authority_state: authorityStateToSql(row.authorityState),
      review_state: reviewStateToSql(row.reviewState),
      rejection_reason: row.rejectionReason ?? null,
      non_financial: row.nonFinancial === true ? 1 : 0,
      provenance_id: row.provenanceId ?? null,
      data_version: row.version.dataVersion,
    })),
    importedClaims: snapshot.importedClaims.map((claim) => ({
      id: claim.id,
      workspace_id: claim.workspaceId,
      source_record_id: claim.sourceRecordId,
      import_draft_id: claim.importDraftId ?? null,
      parsed_row_id: claim.parsedRowId ?? null,
      proposed_transaction_id: claim.proposedTransactionId ?? null,
      accepted_transaction_id: claim.acceptedTransactionId ?? null,
      event_id: claim.eventId ?? null,
      original_text: claim.originalText,
      interpreted_title: claim.interpretedTitle,
      amount_minor: claim.amount?.minorUnits ?? null,
      currency: claim.amount?.currency ?? null,
      local_date: claim.localDate ?? null,
      state: claim.state,
      source_quality: claim.sourceQuality,
      authority_state: authorityStateToSql(claim.authorityState),
      review_state: reviewStateToSql(claim.reviewState),
      user_confirmation_state: confirmationStateToSql(claim.userConfirmationState),
      parser_issues_json: JSON.stringify(claim.parserIssues ?? []),
      rejected_at: claim.rejectedAt ?? null,
      rejection_reason: claim.rejectionReason ?? null,
      non_financial: claim.nonFinancial === true ? 1 : 0,
      provenance_id: claim.provenanceId ?? null,
      data_version: claim.version.dataVersion,
    })),
    importDrafts: snapshot.importDrafts.map((draft) => ({
      id: draft.id,
      workspace_id: draft.workspaceId,
      source_record_id: draft.sourceRecordId,
      proposed_transaction_id: draft.proposedTransactionId,
      parsed_row_id: draft.parsedRowId ?? null,
      imported_claim_id: draft.importedClaimId ?? null,
      authority_state: authorityStateToSql(draft.authorityState),
      review_state: reviewStateToSql(draft.reviewState),
      user_confirmation_state: confirmationStateToSql(draft.userConfirmationState),
      parser_issues_json: JSON.stringify(draft.parserIssues),
      rejected_at: draft.rejectedAt ?? null,
      rejection_reason: draft.rejectionReason ?? null,
      non_financial: draft.nonFinancial === true ? 1 : 0,
      provenance_id: draft.provenanceId,
      data_version: draft.version.dataVersion,
    })),
    userCorrections: snapshot.userCorrections.map((correction) => ({
      id: correction.id,
      workspace_id: correction.workspaceId,
      kind: correction.kind,
      subject_id: correction.subjectId,
      original_value: correction.originalValue,
      corrected_value: correction.correctedValue,
      reason: correction.reason ?? null,
      source_record_id: correction.sourceRecordId ?? null,
      provenance_id: correction.provenanceId ?? null,
      decision_id: correction.decisionId ?? null,
      audit_log_id: correction.auditLogId ?? null,
      corrected_at: correction.correctedAt,
      authority_state: authorityStateToSql(correction.authorityState),
      review_state: reviewStateToSql(correction.reviewState),
      data_version: correction.version.dataVersion,
    })),
    transactions: snapshot.transactions.map((transaction) => ({
      id: transaction.id,
      workspace_id: transaction.workspaceId,
      account_id: transaction.accountId,
      status: transaction.status,
      amount_minor: transaction.amount.minorUnits,
      currency: transaction.amount.currency,
      local_date: transaction.localDate,
      booked_at: transaction.bookedAt ?? null,
      description: transaction.description ?? null,
      reference: transaction.reference ?? null,
      splits_json: JSON.stringify(transaction.splits),
      source_kind: transaction.sourceKind,
      authority_state: authorityStateToSql(transaction.authorityState),
      review_status: transaction.reviewStatus,
      source_record_id: transaction.sourceRecordId ?? null,
      provenance_id: transaction.provenanceId ?? null,
      event_id: transaction.eventId ?? null,
      source_transaction_id: transaction.sourceTransactionId ?? null,
      source_evidence_id: transaction.sourceEvidenceId ?? null,
      external_id: transaction.externalId ?? null,
      connection_id: transaction.connectionId ?? null,
      financial_action_json:
        transaction.financialAction === undefined
          ? null
          : JSON.stringify(transaction.financialAction),
      data_version: transaction.version.dataVersion,
    })),
    events: snapshot.events.map((event) => ({
      id: event.id,
      workspace_id: event.workspaceId,
      kind: event.kind,
      title: event.title,
      local_date: event.localDate,
      amount_minor: event.amount?.minorUnits ?? null,
      currency: event.amount?.currency ?? null,
      authority_state: authorityStateToSql(event.authorityState),
      transaction_ids_json: JSON.stringify(event.transactionIds),
      expectation_ids_json: JSON.stringify(event.expectationIds),
      source_record_ids_json: JSON.stringify(event.sourceRecordIds),
      provenance_id: event.provenanceId ?? null,
      data_version: event.version.dataVersion,
    })),
    commitments: snapshot.commitments.map((commitment) => ({
      id: commitment.id,
      workspace_id: commitment.workspaceId,
      kind: commitment.kind,
      title: commitment.title,
      amount_minor: commitment.amount.minorUnits,
      currency: commitment.amount.currency,
      due_date: commitment.dueDate,
      authority_state: authorityStateToSql(commitment.authorityState),
      review_state: reviewStateToSql(commitment.reviewState),
      account_id: commitment.accountId ?? null,
      source_record_id: commitment.sourceRecordId ?? null,
      provenance_id: commitment.provenanceId ?? null,
      data_version: commitment.version.dataVersion,
    })),
    expectations: snapshot.expectations.map((expectation) => ({
      id: expectation.id,
      workspace_id: expectation.workspaceId,
      local_date: expectation.localDate,
      amount_minor: expectation.amount.minorUnits,
      currency: expectation.amount.currency,
      authority_state: authorityStateToSql(expectation.authorityState),
      fulfilled: expectation.fulfilled ? 1 : 0,
      account_id: expectation.accountId ?? null,
      commitment_id: expectation.commitmentId ?? null,
      source_record_id: expectation.sourceRecordId ?? null,
      provenance_id: expectation.provenanceId ?? null,
      reference: expectation.reference ?? null,
      data_version: expectation.version.dataVersion,
    })),
    plannerItems: snapshot.plannerItems.map((item) => ({
      id: item.id,
      workspace_id: item.workspaceId,
      kind: item.kind,
      title: item.title,
      due_date: item.dueDate,
      due_time: item.dueTime ?? null,
      status: item.status,
      authority_state: authorityStateToSql(item.authorityState),
      linked_plan_id: item.linkedPlanId ?? null,
      linked_event_id: item.linkedEventId ?? null,
      provenance_id: item.provenanceId ?? null,
      data_version: item.version.dataVersion,
    })),
    plans: snapshot.plans.map((plan) => ({
      id: plan.id,
      workspace_id: plan.workspaceId,
      title: plan.title,
      kind: plan.kind ?? null,
      user_intention: plan.userIntention ?? null,
      status: plan.status,
      authority_state: authorityStateToSql(plan.authorityState),
      review_state: plan.reviewState === undefined ? null : reviewStateToSql(plan.reviewState),
      target_amount_minor: plan.targetAmount?.minorUnits ?? null,
      currency: plan.targetAmount?.currency ?? null,
      target_date: plan.targetDate ?? null,
      target_rule: plan.targetRule ?? null,
      protected_amount_minor: plan.protectedAmount?.minorUnits ?? null,
      commitment_ids_json: JSON.stringify(plan.commitmentIds),
      expectation_ids_json: JSON.stringify(plan.expectationIds ?? []),
      transaction_ids_json: JSON.stringify(plan.transactionIds ?? []),
      event_ids_json: JSON.stringify(plan.eventIds ?? []),
      rule_ids_json: JSON.stringify(plan.ruleIds ?? []),
      impact_ids_json: JSON.stringify(plan.impactIds ?? []),
      scenario_ids_json: JSON.stringify(plan.scenarioIds),
      accountability_style: plan.accountabilityStyle ?? null,
      decision_ids_json: JSON.stringify(plan.decisionIds ?? []),
      audit_log_ids_json: JSON.stringify(plan.auditLogIds ?? []),
      source_record_id: plan.sourceRecordId ?? null,
      provenance_id: plan.provenanceId ?? null,
      created_at: plan.createdAt,
      data_version: plan.version.dataVersion,
    })),
    planRules: snapshot.planRules.map((rule) => ({
      id: rule.id,
      workspace_id: rule.workspaceId,
      plan_id: rule.planId,
      title: rule.title,
      mode: rule.mode,
      minimum_buffer_minor: rule.minimumBuffer?.minorUnits ?? null,
      protected_amount_minor: rule.protectedAmount?.minorUnits ?? null,
      target_contribution_minor: rule.targetContribution?.minorUnits ?? null,
      currency:
        rule.minimumBuffer?.currency ??
        rule.protectedAmount?.currency ??
        rule.targetContribution?.currency ??
        null,
      deadline: rule.deadline ?? null,
      pause_allowed: rule.pauseAllowed ? 1 : 0,
      adjust_allowed: rule.adjustAllowed ? 1 : 0,
      rebase_allowed: rule.rebaseAllowed ? 1 : 0,
      review_required_when_json: JSON.stringify(rule.reviewRequiredWhen),
      authority_state: authorityStateToSql(rule.authorityState),
      review_state: reviewStateToSql(rule.reviewState),
      source_record_id: rule.sourceRecordId ?? null,
      provenance_id: rule.provenanceId ?? null,
      created_at: rule.createdAt,
      data_version: rule.version.dataVersion,
    })),
    scenarios: snapshot.scenarios.map((scenario) => ({
      id: scenario.id,
      workspace_id: scenario.workspaceId,
      title: scenario.title,
      status: scenario.status,
      authority_state: authorityStateToSql(scenario.authorityState),
      assumption_ids_json: JSON.stringify(scenario.assumptionIds),
      affected_plan_ids_json: JSON.stringify(scenario.affectedPlanIds),
      provenance_id: scenario.provenanceId ?? null,
      created_at: scenario.createdAt,
      data_version: scenario.version.dataVersion,
    })),
    planImpacts: snapshot.planImpacts.map((impact) => ({
      id: impact.id,
      workspace_id: impact.workspaceId,
      plan_id: impact.planId,
      as_of: impact.asOf,
      summary: impact.summary,
      changed_record_ids_json: JSON.stringify(impact.changedRecordIds),
      direction: impact.direction,
      new_projected_outcome: impact.newProjectedOutcome,
      protected_amount_minor: impact.protectedAmount.minorUnits,
      currency: impact.protectedAmount.currency,
      needs_review: impact.needsReview ? 1 : 0,
      review_reasons_json: JSON.stringify(impact.reviewReasons),
      option_ids_json: JSON.stringify(impact.optionIds),
      scenario_ids_json: JSON.stringify(impact.scenarioIds),
      authority_state: authorityStateToSql(impact.authorityState),
      review_state: reviewStateToSql(impact.reviewState),
      previous_projected_date: impact.previousProjectedDate ?? null,
      new_projected_date: impact.newProjectedDate ?? null,
      previous_projected_amount_minor: impact.previousProjectedAmount?.minorUnits ?? null,
      new_projected_amount_minor: impact.newProjectedAmount?.minorUnits ?? null,
      source_record_id: impact.sourceRecordId ?? null,
      provenance_id: impact.provenanceId ?? null,
      created_at: impact.createdAt,
      data_version: impact.version.dataVersion,
    })),
    forecastSnapshots: snapshot.forecastSnapshots.map((forecast) => ({
      id: forecast.id,
      workspace_id: forecast.workspaceId,
      as_of: forecast.asOf,
      authority_state: authorityStateToSql(forecast.authorityState),
      source_ids_json: JSON.stringify(forecast.sourceIds),
      provenance_id: forecast.provenanceId ?? null,
      created_at: forecast.createdAt,
      data_version: forecast.version.dataVersion,
    })),
    documents: snapshot.documents.map((document) => ({
      id: document.id,
      workspace_id: document.workspaceId,
      kind: document.kind,
      filename: document.filename,
      captured_at: document.capturedAt,
      authority_state: authorityStateToSql(document.authorityState),
      review_state:
        document.reviewState === undefined ? null : reviewStateToSql(document.reviewState),
      source_hash: document.sourceHash,
      source_record_id: document.sourceRecordId ?? null,
      attachment_ids_json: JSON.stringify(document.attachmentIds ?? []),
      provenance_id: document.provenanceId ?? null,
      data_version: document.version.dataVersion,
    })),
    documentAttachments: snapshot.documentAttachments.map((attachment) => ({
      id: attachment.id,
      workspace_id: attachment.workspaceId,
      document_id: attachment.documentId,
      target_kind: attachment.targetKind,
      target_id: attachment.targetId,
      attached_at: attachment.attachedAt,
      authority_state: authorityStateToSql(attachment.authorityState),
      review_state: reviewStateToSql(attachment.reviewState),
      source_record_id: attachment.sourceRecordId ?? null,
      provenance_id: attachment.provenanceId ?? null,
      data_version: attachment.version.dataVersion,
    })),
    calendarItems: snapshot.calendarItems.map((item) => ({
      id: item.id,
      workspace_id: item.workspaceId,
      kind: item.kind,
      title: item.title,
      local_date: item.localDate,
      local_time: item.localTime ?? null,
      authority_state: authorityStateToSql(item.authorityState),
      event_id: item.eventId ?? null,
      commitment_id: item.commitmentId ?? null,
      plan_id: item.planId ?? null,
      plan_rule_id: item.planRuleId ?? null,
      plan_impact_id: item.planImpactId ?? null,
      scenario_id: item.scenarioId ?? null,
      planner_item_id: item.plannerItemId ?? null,
      provenance_id: item.provenanceId ?? null,
      data_version: item.version.dataVersion,
    })),
    timelineEntries: snapshot.timelineEntries.map((entry) => ({
      id: entry.id,
      workspace_id: entry.workspaceId,
      kind: entry.kind,
      title: entry.title,
      local_date: entry.localDate,
      authority_state: authorityStateToSql(entry.authorityState),
      subject_id: entry.subjectId,
      provenance_id: entry.provenanceId ?? null,
      data_version: entry.version.dataVersion,
    })),
    decisionRecords: snapshot.decisionRecords.map((decision) => ({
      id: decision.id,
      workspace_id: decision.workspaceId,
      kind: decision.kind,
      actor: decision.actor,
      summary: decision.summary,
      affected_ids_json: JSON.stringify(decision.affectedIds),
      provenance_id: decision.provenanceId ?? null,
      decided_at: decision.decidedAt,
      data_version: decision.version.dataVersion,
    })),
    meloMemories: snapshot.meloMemories.map((memory) => ({
      id: memory.id,
      workspace_id: memory.workspaceId,
      authority_state: authorityStateToSql(memory.authorityState),
      review_state: reviewStateToSql(memory.reviewState),
      value: memory.value,
      provenance_id: memory.provenanceId ?? null,
      created_at: memory.createdAt,
      deleted_at: memory.deletedAt ?? null,
      data_version: memory.version.dataVersion,
    })),
    meloProposals: snapshot.meloProposals.map((proposal) => ({
      id: proposal.id,
      workspace_id: proposal.workspaceId,
      title: proposal.title,
      status: proposal.status,
      authority_state: authorityStateToSql(proposal.authorityState),
      proposed_command: proposal.proposedCommand,
      can_write_directly: proposal.canWriteDirectly ? 1 : 0,
      provenance_id: proposal.provenanceId ?? null,
      created_at: proposal.createdAt,
      data_version: proposal.version.dataVersion,
    })),
    auditLog: snapshot.auditLog.map((entry) => ({
      id: entry.id,
      workspace_id: entry.workspaceId,
      actor_kind: entry.actor,
      command_type: entry.action,
      subject_id: entry.subjectId ?? null,
      provenance_id: entry.provenanceId ?? null,
      reversible: entry.reversible ? 1 : 0,
      created_at: entry.occurredAt,
      data_version: entry.version.dataVersion,
    })),
  };
}

export function canonicalMobileLedgerRowCount(
  snapshot: CanonicalMobileLedgerSnapshot,
  key: keyof CanonicalMobileStorageRows,
): number {
  return snapshot.rows[key].length;
}

function createAccountProjections(
  context: CanonicalBuildContext,
  state: LocalLedgerState,
  options: CanonicalMobileLedgerProjectionOptions,
): readonly CanonicalAccountProjection[] {
  const inputs = options.accounts ?? [];
  if (inputs.length === 0) {
    const emptyBaseline = isEmptyFinancialLedger(state);
    const account = createAccount({
      id: canonicalAccountIdForWorkspace(context.workspaceId),
      workspaceId: context.workspaceId,
      name: 'Local cash',
      kind: 'cash',
      currency: context.currency,
      state: 'active',
      projectionRole: 'canonical-baseline',
      version: { dataVersion: context.dataVersion },
    });
    return [
      {
        sourceId: String(account.id),
        account,
        balanceMinor: state.cashOnHandMinor,
        observedOn: context.asOfDate,
        observedAt: context.capturedAt,
        balanceSourceKind: emptyBaseline ? 'calculated' : 'user-entered',
        authorityState: emptyBaseline ? 'estimated' : 'user-confirmed',
        includeInAvailablePosition: true,
        explicit: false,
      },
    ];
  }

  const seen = new Set<string>();
  return inputs.map((input) => {
    const sourceId = input.id.trim();
    if (sourceId.length === 0) throw new Error('Canonical source account ID is required.');
    if (seen.has(sourceId)) throw new Error(`Canonical source account ${sourceId} is duplicated.`);
    seen.add(sourceId);
    if (!Number.isSafeInteger(input.balanceMinor)) {
      throw new Error(`Canonical account ${sourceId} balance must use integer minor units.`);
    }
    const currency = createCurrencyCode(input.currency);
    if (String(currency) !== String(context.currency)) {
      throw new Error(`Canonical account ${sourceId} currency must match its workspace currency.`);
    }
    const observedAt = createInstantString(input.balanceAsOfISO);
    const observedOn = createLocalDate(input.balanceAsOfISO.slice(0, 10));
    const account = createAccount({
      id: canonicalAccountIdForSource(context.workspaceId, sourceId),
      workspaceId: context.workspaceId,
      name: input.name,
      kind: input.kind,
      currency,
      state: input.state ?? 'active',
      sourceAccountId: sourceId,
      ...(input.addedAt === undefined ? {} : { createdAt: input.addedAt }),
      projectionRole: input.projectionRole ?? 'source',
      version: { dataVersion: context.dataVersion },
    });
    return {
      sourceId,
      account,
      balanceMinor: input.balanceMinor,
      observedOn,
      observedAt,
      balanceSourceKind: input.balanceSourceKind ?? 'user-entered',
      ...(input.balanceConfidence === undefined
        ? {}
        : { balanceConfidence: input.balanceConfidence }),
      ...(input.balanceSourceVariant === undefined
        ? {}
        : { balanceSourceVariant: input.balanceSourceVariant }),
      authorityState: input.authorityState ?? 'user-confirmed',
      includeInAvailablePosition:
        input.includeInAvailablePosition ?? (input.kind !== 'credit' && input.kind !== 'loan'),
      explicit: true,
    };
  });
}

function resolveDefaultAccountId(
  accounts: readonly CanonicalAccountProjection[],
  requestedSourceId: string | undefined,
): AccountId {
  const requested =
    requestedSourceId === undefined
      ? undefined
      : accounts.find((projection) => projection.sourceId === requestedSourceId)?.account.id;
  if (requestedSourceId !== undefined && requested === undefined) {
    throw new Error(`Canonical default account ${requestedSourceId} is unavailable.`);
  }
  const resolved = requested ?? accounts[0]?.account.id;
  if (resolved === undefined) throw new Error('Canonical ledger requires an account.');
  return resolved;
}

function resolveTransactionAccountId(
  sourceAccountId: string | undefined,
  accountIds: ReadonlyMap<string, AccountId>,
  defaultAccountId: AccountId,
): AccountId {
  if (sourceAccountId === undefined) return defaultAccountId;
  const resolved = accountIds.get(sourceAccountId);
  if (resolved === undefined) {
    throw new Error(`Canonical transaction account ${sourceAccountId} is unavailable.`);
  }
  return resolved;
}

function openingBalanceId(account: CanonicalAccountProjection): string {
  return canonicalId(
    'balance',
    `opening_${String(account.account.id)}_${String(account.observedOn)}`,
  );
}

function createSourceRecordForOpeningBalance(
  context: CanonicalBuildContext,
  state: LocalLedgerState,
  account: CanonicalAccountProjection,
): SourceRecord {
  const emptyBaseline = !account.explicit && isEmptyFinancialLedger(state);
  return {
    id: createSourceRecordId(
      canonicalId(
        'source',
        `opening_balance_${String(account.account.id)}_${String(account.observedOn)}`,
      ),
    ),
    workspaceId: context.workspaceId,
    kind: emptyBaseline ? 'system-derived' : 'manual-entry',
    authorityState: account.authorityState,
    label: emptyBaseline
      ? `Empty workspace baseline for ${String(account.observedOn)}`
      : `${account.account.name} balance for ${String(account.observedOn)}`,
    capturedAt: account.observedAt,
    sourceHash: createCanonicalDataVersion({
      accountId: account.account.id,
      asOfDate: account.observedOn,
      balanceMinor: account.balanceMinor,
      currency: state.currency,
    }),
    ...(emptyBaseline ? { reviewState: 'needs-review' as const } : {}),
    version: context.version,
  };
}

function createOpeningBalanceObservation(
  context: CanonicalBuildContext,
  account: CanonicalAccountProjection,
  sourceRecordId: SourceRecordId,
  provenanceId: ProvenanceId,
): BalanceObservation {
  const emptyBaseline = !account.explicit && account.authorityState === 'estimated';
  return createBalanceObservation({
    id: openingBalanceId(account),
    workspaceId: context.workspaceId,
    accountId: account.account.id,
    observedOn: account.observedOn,
    observedAt: account.observedAt,
    balance: { minorUnits: account.balanceMinor, currency: context.currency },
    source: emptyBaseline ? 'Empty workspace baseline' : `${account.account.name} balance`,
    sourceKind: emptyBaseline ? 'calculated' : account.balanceSourceKind,
    ...(account.balanceConfidence === undefined
      ? {}
      : { sourceConfidence: account.balanceConfidence }),
    ...(account.balanceSourceVariant === undefined
      ? {}
      : { sourceVariant: account.balanceSourceVariant }),
    observationKind: emptyBaseline
      ? 'calculated-balance'
      : account.explicit
        ? 'current-balance'
        : 'opening-balance',
    authorityState: account.authorityState,
    reviewState: emptyBaseline ? 'needs-review' : 'not-required',
    reconciliationState: 'provisional',
    sourceRecordId,
    provenanceId,
    version: { dataVersion: context.dataVersion },
  });
}

function isEmptyFinancialLedger(state: LocalLedgerState): boolean {
  return (
    state.cashOnHandMinor === 0 &&
    state.transactions.length === 0 &&
    state.importDrafts.length === 0 &&
    state.rejectedImports.length === 0 &&
    state.documentStages.length === 0
  );
}

function createCurrentBalanceFromObservation(
  context: CanonicalBuildContext,
  observation: BalanceObservation,
  provenanceId: ProvenanceId,
): CurrentBalance {
  return createCurrentBalance({
    id: canonicalId('currentbalance', `${observation.accountId}_${observation.observedOn}`),
    workspaceId: context.workspaceId,
    accountId: observation.accountId,
    asOf: observation.observedOn,
    balance: observation.balance,
    sourceKind: observation.sourceKind,
    authorityState: observation.authorityState,
    reviewState: observation.reviewState,
    sourceObservationId: observation.id,
    updatedAt: observation.observedAt ?? context.capturedAt,
    provenanceId,
    version: { dataVersion: context.dataVersion },
  });
}

function createAvailablePositionFromCanonicalRecords(
  context: CanonicalBuildContext,
  input: Readonly<{
    accountIds: ReadonlySet<AccountId>;
    commitments: readonly Commitment[];
    currentBalances: readonly CurrentBalance[];
    expectations: readonly FinancialExpectation[];
    openingBalanceObservations: readonly BalanceObservation[];
    transactions: readonly FinancialTransaction[];
  }>,
): AvailablePositionSnapshot {
  const actualNetMinor = input.transactions
    .filter(
      (transaction) =>
        input.accountIds.has(transaction.accountId) && transaction.localDate >= context.asOfDate,
    )
    .reduce((total, transaction) => total + transaction.amount.minorUnits, 0);
  const expectedNetMinor = input.expectations
    .filter(
      (expectation) =>
        expectation.accountId !== undefined &&
        input.accountIds.has(expectation.accountId) &&
        expectation.localDate >= context.asOfDate,
    )
    .reduce((total, expectation) => total + expectation.amount.minorUnits, 0);
  const protectedFloorMinor = input.commitments
    .filter(
      (commitment) =>
        commitment.accountId !== undefined &&
        input.accountIds.has(commitment.accountId) &&
        commitment.dueDate >= context.asOfDate &&
        commitment.amount.minorUnits < 0,
    )
    .reduce((total, commitment) => total + Math.abs(commitment.amount.minorUnits), 0);
  const currentBalanceMinor = input.currentBalances.reduce(
    (total, balance) => total + balance.balance.minorUnits,
    0,
  );
  const projectedMinor = currentBalanceMinor + actualNetMinor + expectedNetMinor;
  const availableMinor = Math.max(0, projectedMinor - protectedFloorMinor);
  const sourceIds = [
    ...input.currentBalances.map((balance) => balance.id),
    ...input.openingBalanceObservations.map((observation) => observation.id),
    ...input.transactions
      .filter((transaction) => input.accountIds.has(transaction.accountId))
      .map((transaction) => transaction.id),
    ...input.expectations
      .filter(
        (expectation) =>
          expectation.accountId !== undefined && input.accountIds.has(expectation.accountId),
      )
      .map((expectation) => expectation.id),
    ...input.commitments
      .filter(
        (commitment) =>
          commitment.accountId !== undefined && input.accountIds.has(commitment.accountId),
      )
      .map((commitment) => commitment.id),
  ].map(String);

  return createAvailablePositionSnapshot({
    id: canonicalId('position', `${context.asOfDate}_${context.dataVersion}`),
    workspaceId: context.workspaceId,
    asOf: context.asOfDate,
    currency: context.currency,
    openingBalance: { minorUnits: currentBalanceMinor, currency: context.currency },
    availableBalance: { minorUnits: availableMinor, currency: context.currency },
    protectedFloor: { minorUnits: protectedFloorMinor, currency: context.currency },
    actualNet: { minorUnits: actualNetMinor, currency: context.currency },
    expectedNet: { minorUnits: expectedNetMinor, currency: context.currency },
    currentBalanceIds: input.currentBalances.map((balance) => balance.id),
    balanceObservationIds: input.openingBalanceObservations.map((observation) => observation.id),
    sourceIds,
    authorityState: 'inferred',
    reviewState: 'not-required',
    createdAt: context.capturedAt,
    version: { dataVersion: context.dataVersion },
  });
}

function createSourceRecordForLocalTransaction(
  context: CanonicalBuildContext,
  transaction: LocalLedgerState['transactions'][number],
): SourceRecord {
  const sourceKind: SourceRecordKind =
    transaction.source === 'manual'
      ? 'manual-entry'
      : transaction.source === 'import'
        ? 'statement-row'
        : transaction.source === 'open_banking'
          ? 'open-banking-row'
          : 'system-derived';

  return {
    id: createSourceRecordId(canonicalId('source', `transaction_${transaction.id}`)),
    workspaceId: context.workspaceId,
    kind: sourceKind,
    authorityState: transactionAuthorityState(transaction),
    label: transaction.original ?? transaction.title,
    capturedAt:
      transaction.bookedAt === undefined
        ? instantForLocalDate(transaction.date)
        : createInstantString(transaction.bookedAt),
    sourceHash: createCanonicalDataVersion({
      id: transaction.id,
      accountId: transaction.accountId ?? null,
      original: transaction.original ?? transaction.title,
      amountMinor: transaction.amountMinor,
      date: transaction.date,
      bookedAt: transaction.bookedAt ?? null,
      categoryId: transaction.categoryId ?? null,
      source: transaction.source,
      sourceTransactionId: transaction.sourceTransactionId ?? null,
      sourceEvidenceId: transaction.sourceEvidenceId ?? null,
      externalId: transaction.externalId ?? null,
      connectionId: transaction.connectionId ?? null,
      sourceOrdinal: transaction.sourceOrdinal ?? null,
    }),
    externalId: transaction.externalId ?? transaction.sourceTransactionId ?? transaction.id,
    version: context.version,
  };
}

function createSourceRecordForImportDraft(
  context: CanonicalBuildContext,
  draft: LocalImportDraft,
): SourceRecord {
  return {
    id: createSourceRecordId(canonicalId('source', `draft_${draft.rowId}`)),
    workspaceId: context.workspaceId,
    kind: 'statement-row',
    authorityState: draft.authorityState,
    label: draft.original,
    capturedAt: context.capturedAt,
    sourceHash: draft.provenanceHash,
    version: context.version,
    externalId: draft.rowId,
  };
}

function createSourceRecordForRejectedImport(
  context: CanonicalBuildContext,
  rejected: LocalRejectedImportEvidence,
): SourceRecord {
  return {
    id: createSourceRecordId(canonicalId('source', `rejected_${rejected.rowId}`)),
    workspaceId: context.workspaceId,
    kind: 'statement-row',
    authorityState: 'imported-claim',
    reviewState: 'dismissed',
    label: rejected.original,
    capturedAt: createInstantString(rejected.rejectedAt),
    sourceHash: rejected.provenanceHash,
    version: context.version,
    externalId: rejected.rowId,
    rejectionReason: rejected.rejectionReason,
    nonFinancial: true,
  };
}

function createSourceRecordForDocument(
  context: CanonicalBuildContext,
  document: LocalLedgerState['documentStages'][number],
  documentId: DocumentRecord['id'],
): SourceRecord {
  return {
    id: createSourceRecordId(canonicalId('source', `document_${document.id}`)),
    workspaceId: context.workspaceId,
    kind: 'document-text',
    authorityState: 'imported-claim',
    label: document.filename,
    capturedAt: createInstantString(document.stagedAt),
    sourceHash: document.textDigest,
    version: context.version,
    documentId,
  };
}

function createParsedRowForDraft(
  context: CanonicalBuildContext,
  draft: LocalImportDraft,
  sourceRecordId: SourceRecordId,
  provenanceId: ProvenanceId,
  rowIndex: number,
): ParsedRow {
  return createParsedRow({
    id: createParsedRowId(canonicalId('parsedrow', draft.rowId)),
    workspaceId: context.workspaceId,
    sourceRecordId,
    rowIndex,
    rawText: draft.original,
    parsedAt: context.capturedAt,
    parserName: 'local statement import',
    parserIssues: draft.parserIssues.map(parserIssueFromString),
    authorityState: draft.reviewState === 'needs-review' ? 'estimated' : 'imported-claim',
    reviewState: draft.reviewState,
    provenanceId,
    version: { dataVersion: context.dataVersion },
  });
}

function createParsedRowForRejectedImport(
  context: CanonicalBuildContext,
  rejected: LocalRejectedImportEvidence,
  sourceRecordId: SourceRecordId,
  provenanceId: ProvenanceId,
  rowIndex: number,
): ParsedRow {
  return createParsedRow({
    id: createParsedRowId(canonicalId('parsedrow', `rejected_${rejected.rowId}`)),
    workspaceId: context.workspaceId,
    sourceRecordId,
    rowIndex,
    rawText: rejected.original,
    parsedAt: rejected.rejectedAt,
    parserName: 'local statement import',
    parserIssues: rejected.parserIssues.map(parserIssueFromString),
    authorityState: 'imported-claim',
    reviewState: 'dismissed',
    rejectionReason: rejected.rejectionReason,
    nonFinancial: true,
    provenanceId,
    version: { dataVersion: context.dataVersion },
  });
}

function createParsedRowForAcceptedImport(
  context: CanonicalBuildContext,
  transaction: LocalLedgerState['transactions'][number],
  sourceRecordId: SourceRecordId,
  provenanceId: ProvenanceId,
): ParsedRow {
  return createParsedRow({
    id: createParsedRowId(canonicalId('parsedrow', transaction.id)),
    workspaceId: context.workspaceId,
    sourceRecordId,
    rowIndex: 0,
    rawText: transaction.original ?? transaction.title,
    parsedAt:
      transaction.bookedAt === undefined
        ? instantForLocalDate(transaction.date)
        : createInstantString(transaction.bookedAt),
    parserName: 'local statement import',
    parserIssues: [],
    authorityState: 'imported-claim',
    reviewState: 'user-confirmed',
    provenanceId,
    version: { dataVersion: context.dataVersion },
  });
}

function createImportedClaimForDraft(
  context: CanonicalBuildContext,
  draft: LocalImportDraft,
  sourceRecordId: SourceRecordId,
  parsedRowId: ParsedRow['id'],
  provenanceId: ProvenanceId,
): ImportedClaim {
  return createImportedClaim({
    id: createImportedClaimId(canonicalId('importedclaim', draft.rowId)),
    workspaceId: context.workspaceId,
    sourceRecordId,
    importDraftId: createImportDraftId(canonicalId('importdraft', draft.rowId)),
    parsedRowId,
    proposedTransactionId: createTransactionId(canonicalId('transaction', draft.transactionId)),
    originalText: draft.original,
    interpretedTitle: draft.interpretation,
    amount: { minorUnits: draft.amountMinor, currency: context.currency },
    localDate: draft.date,
    state: 'needs-review',
    sourceQuality: draft.parserIssues.length === 0 ? 'source-clear' : 'needs-review',
    authorityState:
      draft.authorityState === 'user-confirmed' ? 'imported-claim' : draft.authorityState,
    reviewState: draft.reviewState,
    userConfirmationState: draft.userConfirmationState,
    parserIssues: draft.parserIssues.map(parserIssueFromString),
    provenanceId,
    version: { dataVersion: context.dataVersion },
  });
}

function createImportedClaimForRejectedImport(
  context: CanonicalBuildContext,
  rejected: LocalRejectedImportEvidence,
  sourceRecordId: SourceRecordId,
  parsedRowId: ParsedRow['id'],
  provenanceId: ProvenanceId,
): ImportedClaim {
  return createImportedClaim({
    id: createImportedClaimId(canonicalId('importedclaim', `rejected_${rejected.rowId}`)),
    workspaceId: context.workspaceId,
    sourceRecordId,
    importDraftId: createImportDraftId(canonicalId('importdraft', `rejected_${rejected.rowId}`)),
    parsedRowId,
    proposedTransactionId: createTransactionId(canonicalId('transaction', rejected.transactionId)),
    originalText: rejected.original,
    interpretedTitle: rejected.interpretation,
    amount: { minorUnits: rejected.amountMinor, currency: context.currency },
    localDate: rejected.date,
    state: rejected.status === 'Excluded' ? 'excluded' : 'rejected',
    sourceQuality: 'needs-review',
    authorityState: 'imported-claim',
    reviewState: 'dismissed',
    userConfirmationState: 'rejected',
    parserIssues: rejected.parserIssues.map(parserIssueFromString),
    rejectedAt: rejected.rejectedAt,
    rejectionReason: rejected.rejectionReason,
    nonFinancial: true,
    provenanceId,
    version: { dataVersion: context.dataVersion },
  });
}

function createImportedClaimForAcceptedImport(
  input: Readonly<{
    context: CanonicalBuildContext;
    eventId: Event['id'];
    parsedRow: ParsedRow;
    provenanceId: ProvenanceId;
    sourceRecordId: SourceRecordId;
    transaction: LocalLedgerState['transactions'][number];
  }>,
): ImportedClaim {
  return createImportedClaim({
    id: createImportedClaimId(canonicalId('importedclaim', input.transaction.id)),
    workspaceId: input.context.workspaceId,
    sourceRecordId: input.sourceRecordId,
    parsedRowId: input.parsedRow.id,
    acceptedTransactionId: createTransactionId(canonicalId('transaction', input.transaction.id)),
    eventId: input.eventId,
    originalText: input.transaction.original ?? input.transaction.title,
    interpretedTitle: input.transaction.title,
    amount: { minorUnits: input.transaction.amountMinor, currency: input.context.currency },
    localDate: input.transaction.date,
    state: 'accepted',
    sourceQuality: 'source-clear',
    authorityState: 'user-confirmed',
    reviewState: 'user-confirmed',
    userConfirmationState: 'confirmed',
    parserIssues: [],
    provenanceId: input.provenanceId,
    version: { dataVersion: input.context.dataVersion },
  });
}

function createProvenanceForSource(
  context: CanonicalBuildContext,
  sourceRecord: SourceRecord,
  authorityState: AuthorityState,
  entityType: string,
  entityId: string,
): Provenance {
  return {
    id: createProvenanceId(canonicalId('provenance', `${entityType}_${entityId}`)),
    workspaceId: context.workspaceId,
    authorityState,
    sourceRecordIds: [sourceRecord.id],
    links: [
      {
        relationship: 'evidences',
        fromId: sourceRecord.id,
        toId: entityId,
      },
    ],
    createdAt: context.capturedAt,
    version: context.version,
  };
}

function createTransactionProjection(
  context: CanonicalBuildContext,
  transaction: LocalLedgerState['transactions'][number],
  sourceRecordId: SourceRecordId,
  provenanceId: ProvenanceId,
  accountId: AccountId,
): TransactionProjection {
  const localDate = createLocalDate(transaction.date);
  const authorityState = transactionAuthorityState(transaction);
  const transactionId = createTransactionId(canonicalId('transaction', transaction.id));
  const expectationId = createExpectationId(canonicalId('expectation', transaction.id));
  const eventId = createEventId(canonicalId('event', transaction.id));
  const commitmentId = transaction.protected
    ? createCommitmentId(canonicalId('commitment', transaction.id))
    : undefined;
  const isFutureAssumption = localDate > context.asOfDate;
  const amount = createMoney({ minorUnits: transaction.amountMinor, currency: context.currency });
  const eventKind = transaction.amountMinor >= 0 ? 'income' : 'payment';
  const expectationAuthorityState =
    authorityState === 'reversed' || authorityState === 'superseded' ? 'estimated' : authorityState;

  const expectation: FinancialExpectation | undefined = isFutureAssumption
    ? createFinancialExpectation({
        id: expectationId,
        workspaceId: context.workspaceId,
        localDate,
        amount,
        authorityState: expectationAuthorityState,
        certainty: expectationAuthorityState,
        fulfilled: false,
        version: context.version,
        accountId,
        reference: transaction.original ?? transaction.title,
        sourceRecordId,
        provenanceId,
        bookedAt:
          transaction.bookedAt === undefined
            ? instantForLocalDate(transaction.date)
            : createInstantString(transaction.bookedAt),
        description: transaction.title,
        ...(transaction.categoryId === undefined ? {} : { categoryId: transaction.categoryId }),
        sourceKind: transactionSourceKind(transaction.source),
        sourceTransactionId: transaction.sourceTransactionId ?? transaction.id,
        ...(transaction.sourceEvidenceId === undefined
          ? {}
          : { sourceEvidenceId: transaction.sourceEvidenceId }),
        ...(transaction.externalId === undefined ? {} : { externalId: transaction.externalId }),
        ...(transaction.connectionId === undefined
          ? {}
          : { connectionId: transaction.connectionId }),
        ...(transaction.sourceOrdinal === undefined
          ? {}
          : { sourceOrdinal: transaction.sourceOrdinal }),
        ...(commitmentId === undefined ? {} : { commitmentId }),
      })
    : undefined;
  const canonicalTransaction: FinancialTransaction | undefined = isFutureAssumption
    ? undefined
    : {
        id: transactionId,
        workspaceId: context.workspaceId,
        accountId,
        status: transaction.status === 'confirmed' ? 'posted' : 'pending',
        authorityState,
        amount,
        localDate,
        sourceKind: transactionSourceKind(transaction.source),
        certainty: authorityState,
        reviewStatus: transaction.status === 'confirmed' ? 'accepted' : 'needs_review',
        splits:
          transaction.categoryId === undefined
            ? []
            : [
                createTransactionSplit({
                  id: canonicalId('split', `${transaction.id}_${transaction.categoryId}`),
                  amount,
                  label: transaction.title,
                  categoryId: transaction.categoryId,
                }),
              ],
        version: context.version,
        bookedAt:
          transaction.bookedAt === undefined
            ? instantForLocalDate(transaction.date)
            : createInstantString(transaction.bookedAt),
        description: transaction.title,
        reference: transaction.original ?? transaction.title,
        sourceRecordId,
        provenanceId,
        eventId,
        sourceTransactionId: transaction.sourceTransactionId ?? transaction.id,
        ...(transaction.sourceEvidenceId === undefined
          ? {}
          : { sourceEvidenceId: transaction.sourceEvidenceId }),
        ...(transaction.externalId === undefined ? {} : { externalId: transaction.externalId }),
        ...(transaction.connectionId === undefined
          ? {}
          : { connectionId: transaction.connectionId }),
        ...(transaction.sourceOrdinal === undefined
          ? {}
          : { sourceOrdinal: transaction.sourceOrdinal }),
        ...(transaction.financialAction === undefined
          ? {}
          : { financialAction: transaction.financialAction }),
      };
  const commitment: Commitment | undefined =
    commitmentId === undefined || transaction.amountMinor >= 0
      ? undefined
      : {
          id: commitmentId,
          workspaceId: context.workspaceId,
          kind: commitmentKindForTitle(transaction.title),
          title: transaction.title,
          amount,
          dueDate: localDate,
          authorityState,
          reviewState: reviewStateForAuthority(authorityState),
          version: context.version,
          accountId,
          sourceRecordId,
          provenanceId,
        };
  const event: Event = {
    id: eventId,
    workspaceId: context.workspaceId,
    kind: eventKind,
    title: transaction.title,
    localDate,
    authorityState,
    version: context.version,
    amount,
    transactionIds: canonicalTransaction === undefined ? [] : [canonicalTransaction.id],
    expectationIds: expectation === undefined ? [] : [expectation.id],
    sourceRecordIds: [sourceRecordId],
    provenanceId,
  };
  const calendarItem: CalendarItem = {
    id: createCalendarItemId(canonicalId('calendar', transaction.id)),
    workspaceId: context.workspaceId,
    kind: commitment === undefined ? 'money-event' : 'commitment',
    title: transaction.title,
    localDate,
    authorityState,
    version: context.version,
    eventId,
    ...(commitment === undefined ? {} : { commitmentId: commitment.id }),
    provenanceId,
  };
  const timelineEntry: TimelineEntry = {
    id: createTimelineEntryId(canonicalId('timeline', transaction.id)),
    workspaceId: context.workspaceId,
    kind: isFutureAssumption ? 'expectation' : 'fact',
    title: transaction.title,
    localDate,
    authorityState,
    subjectId: canonicalTransaction?.id ?? expectationId,
    version: context.version,
    provenanceId,
  };

  return {
    localId: transaction.id,
    title: transaction.title,
    localDate,
    amountMinor: transaction.amountMinor,
    authorityState,
    sourceRecordId,
    provenanceId,
    ...(canonicalTransaction === undefined ? {} : { transaction: canonicalTransaction }),
    ...(expectation === undefined ? {} : { expectation }),
    event,
    ...(commitment === undefined ? {} : { commitment }),
    calendarItem,
    timelineEntry,
  };
}

function createCanonicalImportDraft(
  context: CanonicalBuildContext,
  draft: LocalImportDraft,
  sourceRecordId: SourceRecordId,
  provenanceId: ProvenanceId,
  parsedRowId: ParsedRow['id'],
  importedClaimId: ImportedClaim['id'],
): ImportDraft {
  return {
    id: createImportDraftId(canonicalId('importdraft', draft.rowId)),
    workspaceId: context.workspaceId,
    sourceRecordId,
    proposedTransactionId: createTransactionId(canonicalId('transaction', draft.transactionId)),
    parsedRowId,
    importedClaimId,
    authorityState:
      draft.authorityState === 'user-confirmed' ? 'imported-claim' : draft.authorityState,
    reviewState: draft.userConfirmationState === 'confirmed' ? 'user-confirmed' : draft.reviewState,
    userConfirmationState: draft.userConfirmationState,
    parserIssues: draft.parserIssues.map(parserIssueFromString),
    provenanceId,
    version: context.version,
  };
}

function createCanonicalRejectedImportDraft(
  context: CanonicalBuildContext,
  rejected: LocalRejectedImportEvidence,
  sourceRecordId: SourceRecordId,
  provenanceId: ProvenanceId,
  parsedRowId: ParsedRow['id'],
  importedClaimId: ImportedClaim['id'],
): ImportDraft {
  return {
    id: createImportDraftId(canonicalId('importdraft', `rejected_${rejected.rowId}`)),
    workspaceId: context.workspaceId,
    sourceRecordId,
    proposedTransactionId: createTransactionId(canonicalId('transaction', rejected.transactionId)),
    parsedRowId,
    importedClaimId,
    authorityState: 'imported-claim',
    reviewState: 'dismissed',
    userConfirmationState: 'rejected',
    parserIssues: rejected.parserIssues.map(parserIssueFromString),
    rejectedAt: createInstantString(rejected.rejectedAt),
    rejectionReason: rejected.rejectionReason,
    nonFinancial: true,
    provenanceId,
    version: context.version,
  };
}

function createImportReviewPlannerItem(
  context: CanonicalBuildContext,
  draft: LocalImportDraft,
  provenanceId: ProvenanceId,
): PlannerItem {
  return {
    id: createPlannerItemId(canonicalId('planner', `review_${draft.rowId}`)),
    workspaceId: context.workspaceId,
    kind: 'review',
    title: `Review ${draft.interpretation}`,
    dueDate: context.asOfDate,
    status: draft.reviewState === 'needs-review' ? 'open' : 'open',
    authorityState: 'inferred',
    version: context.version,
    provenanceId,
  };
}

function createPlanFromCommitment(
  context: CanonicalBuildContext,
  commitment: Commitment,
  links: Readonly<{
    auditLogIds: readonly AuditLogEntry['id'][];
    decisionIds: readonly DecisionRecord['id'][];
    events: readonly Event[];
    expectations: readonly FinancialExpectation[];
    scenarioIds: readonly Scenario['id'][];
    transactions: readonly FinancialTransaction[];
  }>,
): Plan {
  const targetAmountMinor = Math.abs(commitment.amount.minorUnits);
  const id = createPlanId(canonicalId('plan', `commitment_${commitment.id}`));
  const ruleId = createPlanRuleId(canonicalId('planrule', `commitment_${commitment.id}`));
  const impactId = createPlanImpactId(canonicalId('planimpact', `commitment_${commitment.id}`));
  const expectationIds = links.expectations
    .filter((expectation) => expectation.commitmentId === commitment.id)
    .map((expectation) => expectation.id);
  const transactionIds = links.transactions
    .filter((transaction) => transaction.localDate <= commitment.dueDate)
    .map((transaction) => transaction.id);
  const eventIds = links.events
    .filter(
      (event) =>
        event.localDate <= commitment.dueDate ||
        event.expectationIds.some((expectationId) => expectationIds.includes(expectationId)),
    )
    .map((event) => event.id);

  return {
    id,
    workspaceId: context.workspaceId,
    title: `Protect ${commitment.title.replace(/\s+protected$/iu, '')}`,
    status: 'active',
    authorityState: commitment.authorityState,
    reviewState: links.scenarioIds.length > 0 ? 'needs-review' : 'user-confirmed',
    createdAt: context.capturedAt,
    version: context.version,
    kind: 'protect-commitment',
    userIntention: `Keep ${commitment.title.replace(/\s+protected$/iu, '')} covered.`,
    targetAmount: createMoney({ minorUnits: targetAmountMinor, currency: context.currency }),
    targetDate: commitment.dueDate,
    targetRule: 'Protect the linked commitment before flexible spending.',
    protectedAmount: createMoney({ minorUnits: targetAmountMinor, currency: context.currency }),
    commitmentIds: [commitment.id],
    expectationIds,
    transactionIds,
    eventIds,
    ruleIds: [ruleId],
    impactIds: [impactId],
    scenarioIds: links.scenarioIds,
    accountabilityStyle: 'balanced',
    ...(links.decisionIds.length === 0 ? {} : { decisionIds: links.decisionIds }),
    ...(links.auditLogIds.length === 0 ? {} : { auditLogIds: links.auditLogIds }),
    ...(commitment.sourceRecordId === undefined
      ? {}
      : { sourceRecordId: commitment.sourceRecordId }),
    ...(commitment.provenanceId === undefined ? {} : { provenanceId: commitment.provenanceId }),
  };
}

function createPlanRuleFromPlan(context: CanonicalBuildContext, plan: Plan): PlanRule {
  return createPlanRule({
    id: plan.ruleIds?.[0] ?? canonicalId('planrule', `plan_${plan.id}`),
    workspaceId: context.workspaceId,
    planId: plan.id,
    title: `${plan.title} rule`,
    mode: 'flexible',
    minimumBuffer: plan.protectedAmount ??
      plan.targetAmount ?? {
        minorUnits: 0,
        currency: context.currency,
      },
    protectedAmount: plan.protectedAmount ??
      plan.targetAmount ?? {
        minorUnits: 0,
        currency: context.currency,
      },
    pauseAllowed: true,
    adjustAllowed: true,
    rebaseAllowed: true,
    reviewRequiredWhen: ['unexpected-change', 'protected-floor-risk', 'deadline-risk'],
    createdAt: context.capturedAt,
    version: context.version,
    ...(plan.targetDate === undefined ? {} : { deadline: plan.targetDate }),
    ...(plan.targetAmount === undefined ? {} : { targetContribution: plan.targetAmount }),
    ...(plan.provenanceId === undefined ? {} : { provenanceId: plan.provenanceId }),
  });
}

function createPlanImpactFromPlan(
  context: CanonicalBuildContext,
  plan: Plan,
  input: Readonly<{
    currentBalance: CurrentBalance;
    scenarios: readonly Scenario[];
  }>,
): PlanImpact {
  return derivePlanImpactFromCanonicalRecords({
    id: plan.impactIds?.[0] ?? canonicalId('planimpact', `plan_${plan.id}`),
    workspaceId: context.workspaceId,
    plan,
    asOf: context.asOfDate,
    currentBalance: input.currentBalance,
    scenarios: input.scenarios,
    createdAt: context.capturedAt,
    version: context.version,
  });
}

function createScenarioFromHistory(
  context: CanonicalBuildContext,
  entry: LocalLedgerState['history'][number],
): Scenario | undefined {
  if (entry.kind !== 'recovery_recorded') return undefined;

  return {
    id: createScenarioId(canonicalId('scenario', entry.id)),
    workspaceId: context.workspaceId,
    title: entry.label,
    status: 'accepted',
    authorityState: 'hypothetical',
    createdAt: createInstantString(entry.createdAt),
    version: context.version,
    assumptionIds: [],
    affectedPlanIds: [],
  };
}

function createForecastSnapshots(
  context: CanonicalBuildContext,
  input: Readonly<{
    transactions: readonly FinancialTransaction[];
    expectations: readonly FinancialExpectation[];
    commitments: readonly Commitment[];
    scenarios: readonly Scenario[];
  }>,
): readonly Forecast[] {
  const sourceIds: Forecast['sourceIds'] = [
    ...input.transactions.map((transaction) => transaction.id),
    ...input.expectations.map((expectation) => expectation.id),
    ...input.commitments.map((commitment) => commitment.id),
    ...input.scenarios.map((scenario) => scenario.id),
  ];

  if (sourceIds.length === 0) return [];

  return [
    {
      id: createForecastId(canonicalId('forecast', `${context.asOfDate}_${context.dataVersion}`)),
      workspaceId: context.workspaceId,
      asOf: context.asOfDate,
      authorityState: input.scenarios.length > 0 ? 'hypothetical' : 'estimated',
      createdAt: context.capturedAt,
      sourceIds,
      version: context.version,
    },
  ];
}

function createCanonicalDocument(
  context: CanonicalBuildContext,
  document: LocalLedgerState['documentStages'][number],
  index: number,
): DocumentRecord {
  return {
    id: createDocumentId(canonicalId('document', document.id || `stage_${index + 1}`)),
    workspaceId: context.workspaceId,
    kind: 'statement',
    filename: document.filename,
    capturedAt: createInstantString(document.stagedAt),
    authorityState: 'imported-claim',
    reviewState: 'needs-review',
    sourceHash: document.textDigest,
    version: context.version,
  };
}

function createDocumentAttachmentForSource(
  context: CanonicalBuildContext,
  documentId: DocumentRecord['id'],
  sourceRecordId: SourceRecordId,
  provenanceId: ProvenanceId,
): DocumentAttachment {
  return createDocumentAttachment({
    id: createDocumentAttachmentId(canonicalId('documentattachment', `${documentId}_source`)),
    workspaceId: context.workspaceId,
    documentId,
    targetKind: 'source-record',
    targetId: sourceRecordId,
    attachedAt: context.capturedAt,
    authorityState: 'imported-claim',
    reviewState: 'needs-review',
    sourceRecordId,
    provenanceId,
    version: { dataVersion: context.dataVersion },
  });
}

function createCalendarItemForPlannerItem(
  context: CanonicalBuildContext,
  item: PlannerItem,
): CalendarItem {
  return {
    id: createCalendarItemId(canonicalId('calendar', `planner_${item.id}`)),
    workspaceId: context.workspaceId,
    kind: 'task',
    title: item.title,
    localDate: item.dueDate,
    authorityState: item.authorityState,
    version: context.version,
    plannerItemId: item.id,
    ...(item.provenanceId === undefined ? {} : { provenanceId: item.provenanceId }),
  };
}

function createCalendarItemForPlan(context: CanonicalBuildContext, plan: Plan): CalendarItem {
  return {
    id: createCalendarItemId(canonicalId('calendar', `plan_${plan.id}`)),
    workspaceId: context.workspaceId,
    kind: 'plan-check-in',
    title: `${plan.title} deadline`,
    localDate: plan.targetDate ?? context.asOfDate,
    authorityState: plan.authorityState,
    version: context.version,
    planId: plan.id,
    ...(plan.ruleIds?.[0] === undefined ? {} : { planRuleId: plan.ruleIds[0] }),
    ...(plan.provenanceId === undefined ? {} : { provenanceId: plan.provenanceId }),
  };
}

function createCalendarItemsForPlanRule(
  context: CanonicalBuildContext,
  plan: Plan,
  rule: PlanRule | undefined,
): readonly CalendarItem[] {
  if (rule === undefined) return [];

  const base = {
    workspaceId: context.workspaceId,
    kind: 'plan-check-in',
    localDate: context.asOfDate,
    authorityState: 'inferred',
    version: context.version,
    planId: plan.id,
    planRuleId: rule.id,
    ...(rule.provenanceId === undefined ? {} : { provenanceId: rule.provenanceId }),
  } satisfies Omit<CalendarItem, 'id' | 'title'>;

  const reviewItem: CalendarItem = {
    ...base,
    id: createCalendarItemId(canonicalId('calendar', `plan_rule_review_${rule.id}`)),
    title: `${plan.title} review`,
  };
  const contributionItem: CalendarItem | undefined =
    rule.targetContribution === undefined
      ? undefined
      : {
          ...base,
          id: createCalendarItemId(canonicalId('calendar', `plan_rule_contribution_${rule.id}`)),
          title: `${plan.title} planned contribution`,
        };

  return contributionItem === undefined ? [reviewItem] : [contributionItem, reviewItem];
}

function createCalendarItemForPlanImpact(
  context: CanonicalBuildContext,
  impact: PlanImpact,
): CalendarItem {
  return {
    id: createCalendarItemId(canonicalId('calendar', `plan_impact_${impact.id}`)),
    workspaceId: context.workspaceId,
    kind: 'plan-check-in',
    title: 'Review recovery impact',
    localDate: impact.asOf,
    authorityState: 'inferred',
    version: context.version,
    planId: impact.planId,
    planImpactId: impact.id,
    ...(impact.scenarioIds[0] === undefined ? {} : { scenarioId: impact.scenarioIds[0] }),
    ...(impact.provenanceId === undefined ? {} : { provenanceId: impact.provenanceId }),
  };
}

function createTimelineEntryForImportDraft(
  context: CanonicalBuildContext,
  draft: ImportDraft,
): TimelineEntry {
  return {
    id: createTimelineEntryId(canonicalId('timeline', `import_${draft.id}`)),
    workspaceId: context.workspaceId,
    kind: 'system',
    title: 'Imported payment needs review',
    localDate: context.asOfDate,
    authorityState: draft.authorityState,
    subjectId: draft.id,
    version: context.version,
    provenanceId: draft.provenanceId,
  };
}

function createTimelineEntryForDecision(
  context: CanonicalBuildContext,
  decision: DecisionRecord,
): TimelineEntry {
  return {
    id: createTimelineEntryId(canonicalId('timeline', `decision_${decision.id}`)),
    workspaceId: context.workspaceId,
    kind: 'decision',
    title: decision.summary,
    localDate: createLocalDate(decision.decidedAt.slice(0, 10)),
    authorityState: 'user-confirmed',
    subjectId: decision.id,
    version: context.version,
    ...(decision.provenanceId === undefined ? {} : { provenanceId: decision.provenanceId }),
  };
}

function createCanonicalAuditEntry(
  context: CanonicalBuildContext,
  entry: LocalLedgerState['history'][number],
): AuditLogEntry {
  return {
    id: createAuditLogId(canonicalId('audit', entry.id)),
    workspaceId: context.workspaceId,
    actor:
      entry.kind === 'import_suggested'
        ? 'melo'
        : entry.kind.startsWith('import')
          ? 'import'
          : 'user',
    action: entry.kind,
    occurredAt: createInstantString(entry.createdAt),
    reversible: entry.kind !== 'document_staged',
    version: context.version,
    subjectId: entry.id,
  };
}

function decisionRecordFromHistory(
  context: CanonicalBuildContext,
  entry: LocalLedgerState['history'][number],
): DecisionRecord | undefined {
  const kind = decisionKindFromHistory(entry.kind);
  if (kind === undefined) return undefined;

  return {
    id: createDecisionRecordId(canonicalId('decision', entry.id)),
    workspaceId: context.workspaceId,
    kind,
    decidedAt: createInstantString(entry.createdAt),
    actor: 'user',
    summary: entry.label,
    affectedIds: [entry.id],
    version: context.version,
  };
}

function createUserCorrectionFromHistory(
  context: CanonicalBuildContext,
  entry: LocalLedgerState['history'][number],
  decisionId: DecisionRecord['id'] | undefined,
): UserCorrection | undefined {
  if (entry.kind !== 'import_edited' && entry.kind !== 'import_dismissed') return undefined;

  return createUserCorrection({
    id: createUserCorrectionId(canonicalId('correction', entry.id)),
    workspaceId: context.workspaceId,
    kind: entry.kind === 'import_edited' ? 'import-row-edit' : 'import-row-dismissal',
    subjectId: entry.id,
    originalValue: entry.label,
    correctedValue:
      entry.kind === 'import_edited'
        ? 'Edited locally; confirmation required before saving.'
        : 'Dismissed locally; no saved record changed.',
    correctedAt: entry.createdAt,
    reviewState: entry.kind === 'import_edited' ? 'user-confirmed' : 'dismissed',
    reason: entry.label,
    ...(decisionId === undefined ? {} : { decisionId }),
    version: { dataVersion: context.dataVersion },
  });
}

function createMeloProposalFromHistory(
  context: CanonicalBuildContext,
  entry: LocalLedgerState['history'][number],
): MeloProposalRecord | undefined {
  if (entry.kind !== 'import_suggested') return undefined;

  return {
    id: createMeloProposalId(canonicalId('proposal', entry.id)),
    workspaceId: context.workspaceId,
    title: 'Review Melo import suggestion',
    status: 'needs-review',
    authorityState: 'inferred',
    createdAt: createInstantString(entry.createdAt),
    proposedCommand: 'ClassifyTransaction',
    canWriteDirectly: false,
    version: context.version,
  };
}

function createMeloMemoryFromHistory(
  context: CanonicalBuildContext,
  entry: LocalLedgerState['history'][number],
): MeloMemory | undefined {
  if (entry.kind !== 'import_suggested') return undefined;

  return {
    id: createMeloMemoryId(canonicalId('memory', entry.id)),
    workspaceId: context.workspaceId,
    authorityState: 'inferred',
    reviewState: 'needs-review',
    value: entry.label,
    createdAt: createInstantString(entry.createdAt),
    version: context.version,
  };
}

function decisionKindFromHistory(
  kind: LocalLedgerState['history'][number]['kind'],
): DecisionKind | undefined {
  switch (kind) {
    case 'import_confirmed':
      return 'confirm-import';
    case 'import_dismissed':
      return 'dismiss-proposal';
    case 'import_edited':
      return 'correct-record';
    case 'recovery_recorded':
      return 'accept-scenario';
    default:
      return undefined;
  }
}

function transactionAuthorityState(
  transaction: LocalLedgerState['transactions'][number],
): AuthorityState {
  if (transaction.status === 'needs_review') return 'estimated';
  if (transaction.source === 'seed') return 'confirmed';
  return 'user-confirmed';
}

function transactionSourceKind(
  source: LocalLedgerState['transactions'][number]['source'],
): TransactionSourceKind {
  if (source === 'manual') return 'manual';
  if (source === 'melo') return 'melo';
  if (source === 'import') return 'csv';
  if (source === 'open_banking') return 'open_banking';
  return 'migration';
}

function commitmentKindForTitle(title: string): Commitment['kind'] {
  if (/\b(debt|loan|minimum|repayment)\b/i.test(title)) return 'debt-payment';
  if (/\b(tax)\b/i.test(title)) return 'tax';
  if (/\b(saving|savings)\b/i.test(title)) return 'saving';
  return 'bill';
}

function reviewStateForAuthority(authorityState: AuthorityState): ReviewState {
  if (authorityState === 'estimated' || authorityState === 'inferred') return 'needs-review';
  if (authorityState === 'user-confirmed') return 'user-confirmed';
  return 'not-required';
}

function parserIssueFromString(value: string): ParserIssue {
  const code = canonicalIdPart(value);
  return {
    code: code.length === 0 ? 'parser_issue' : code,
    message: value,
    severity: 'review',
  };
}

function authorityStateToSql(value: AuthorityState): CanonicalSqlAuthorityState {
  return value.replace(/-/g, '_') as CanonicalSqlAuthorityState;
}

function sourceRecordKindToSql(value: SourceRecordKind): string {
  return value.replace(/-/g, '_');
}

function reviewStateToSql(value: string): string {
  return value.replace(/-/g, '_');
}

function confirmationStateToSql(value: string): string {
  return value.replace(/-/g, '_');
}

function allWorkspaceRecords(
  snapshot: CanonicalMobileLedgerSnapshot,
): readonly Readonly<{ id: string; workspaceId: WorkspaceId }>[] {
  return [
    ...snapshot.accounts,
    ...snapshot.balanceObservations,
    ...snapshot.currentBalances,
    ...snapshot.balanceAdjustments,
    ...snapshot.availablePositionSnapshots,
    ...snapshot.sourceRecords,
    ...snapshot.provenance,
    ...snapshot.parsedRows,
    ...snapshot.importedClaims,
    ...snapshot.importDrafts,
    ...snapshot.userCorrections,
    ...snapshot.transactions,
    ...snapshot.events,
    ...snapshot.commitments,
    ...snapshot.expectations,
    ...snapshot.plannerItems,
    ...snapshot.plans,
    ...snapshot.planRules,
    ...snapshot.scenarios,
    ...snapshot.planImpacts,
    ...snapshot.forecastSnapshots,
    ...snapshot.documents,
    ...snapshot.documentAttachments,
    ...snapshot.calendarItems,
    ...snapshot.timelineEntries,
    ...snapshot.decisionRecords,
    ...snapshot.meloMemories,
    ...snapshot.meloProposals,
    ...snapshot.auditLog,
  ];
}

function instantForLocalDate(date: string): InstantString {
  return createInstantString(`${createLocalDate(date)}T10:00:00.000Z`);
}

function createCanonicalDataVersion(value: unknown): string {
  return `canonical-hash:${hashStableString(stableStringify(value))}`;
}

function canonicalId(prefix: string, raw: string): string {
  const base = canonicalIdPart(raw);
  const safeBase = base.length === 0 ? 'record' : base;
  const hash = hashStableString(raw).slice(0, 8);
  const maxBaseLength = Math.max(1, 128 - prefix.length - hash.length - 2);
  const trimmedBase = safeBase.slice(0, maxBaseLength).replace(/_+$/g, '') || 'record';
  return `${prefix}_${trimmedBase}_${hash}`;
}

function canonicalIdPart(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function hashStableString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isActiveImportDraft(draft: ImportDraft): boolean {
  return draft.reviewState !== 'dismissed' && draft.userConfirmationState !== 'rejected';
}
