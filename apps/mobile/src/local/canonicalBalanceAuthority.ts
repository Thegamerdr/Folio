import {
  createAuditLogId,
  createBalanceAdjustment,
  createBalanceObservation,
  createCurrentBalance,
  createDecisionRecordId,
  createEntityVersion,
  createInstantString,
  createLocalDate,
  createMoney,
  createProvenanceId,
  createSourceRecordId,
  createTimelineEntryId,
  type AccountId,
  type AuditLogEntry,
  type BalanceAdjustment,
  type BalanceObservation,
  type CurrentBalance,
  type DecisionRecord,
  type LocalDate,
  type Provenance,
  type SourceRecord,
  type TimelineEntry,
} from '@folio/domain';
import type { CanonicalRepository } from '@folio/storage';

export type CanonicalBalanceCorrectionInput = Readonly<{
  accountId: AccountId;
  sourceObservationId: BalanceObservation['id'];
  correctedBalanceMinor: number;
  localDate: string;
  decidedAt: string;
  reason: string;
}>;

export type CanonicalBalanceCorrectionResult = Readonly<{
  sourceRecord: SourceRecord;
  provenance: Provenance;
  observation: BalanceObservation;
  currentBalance: CurrentBalance;
  adjustment: BalanceAdjustment;
  decision: DecisionRecord;
  auditEntry: AuditLogEntry;
  timelineEntry: TimelineEntry;
}>;

export function recordCanonicalBalanceCorrection(
  repository: CanonicalRepository,
  input: CanonicalBalanceCorrectionInput,
): CanonicalBalanceCorrectionResult {
  const account = repository.accounts.get(input.accountId);
  if (account === undefined) {
    throw new Error(`Balance correction account ${String(input.accountId)} does not exist.`);
  }
  const sourceObservation = repository.balanceObservations.get(input.sourceObservationId);
  if (sourceObservation === undefined) {
    throw new Error(
      `Balance correction source observation ${String(input.sourceObservationId)} does not exist.`,
    );
  }
  const localDate = createLocalDate(input.localDate);
  const decidedAt = createInstantString(input.decidedAt);
  const idSeed = canonicalBalanceIdPart(
    `${String(account.id)}_${String(sourceObservation.id)}_${input.correctedBalanceMinor}_${input.localDate}_${input.reason}`,
  );
  const dataVersion = `balance-correction:${idSeed}`;
  const version = createEntityVersion({ dataVersion });
  const sourceRecord: SourceRecord = {
    id: createSourceRecordId(`source_balance_correction_${idSeed}`),
    workspaceId: repository.workspaceId,
    kind: 'user-correction',
    authorityState: 'user-confirmed',
    label: input.reason,
    capturedAt: decidedAt,
    sourceHash: dataVersion,
    version,
  };
  const observationId = `balance_correction_${idSeed}`;
  const provenance: Provenance = {
    id: createProvenanceId(`provenance_balance_correction_${idSeed}`),
    workspaceId: repository.workspaceId,
    authorityState: 'user-confirmed',
    sourceRecordIds: [sourceRecord.id],
    links: [
      {
        relationship: 'supersedes',
        fromId: observationId,
        toId: String(sourceObservation.id),
      },
      {
        relationship: 'evidences',
        fromId: sourceRecord.id,
        toId: observationId,
      },
    ],
    createdAt: decidedAt,
    version,
  };
  const observation = createBalanceObservation({
    id: observationId,
    workspaceId: repository.workspaceId,
    accountId: account.id,
    observedOn: localDate,
    observedAt: decidedAt,
    balance: { minorUnits: input.correctedBalanceMinor, currency: account.currency },
    source: input.reason,
    sourceKind: 'user-entered',
    observationKind: 'balance-correction',
    authorityState: 'user-confirmed',
    reviewState: 'user-confirmed',
    reconciliationState: 'provisional',
    sourceRecordId: sourceRecord.id,
    provenanceId: provenance.id,
    replaces: sourceObservation.id,
    version,
  });
  const currentBalance = createCurrentBalance({
    id: `currentbalance_correction_${idSeed}`,
    workspaceId: repository.workspaceId,
    accountId: account.id,
    asOf: localDate,
    balance: observation.balance,
    sourceKind: observation.sourceKind,
    authorityState: observation.authorityState,
    reviewState: observation.reviewState,
    sourceObservationId: observation.id,
    updatedAt: decidedAt,
    provenanceId: provenance.id,
    version,
  });
  const differenceMinor = input.correctedBalanceMinor - sourceObservation.balance.minorUnits;
  const decision: DecisionRecord = {
    id: createDecisionRecordId(`decision_balance_correction_${idSeed}`),
    workspaceId: repository.workspaceId,
    kind: 'correct-record',
    decidedAt,
    actor: 'user',
    summary: `Balance corrected: ${input.reason}`,
    affectedIds: [String(sourceObservation.id), String(observation.id), String(currentBalance.id)],
    version,
    provenanceId: provenance.id,
  };
  const auditEntry: AuditLogEntry = {
    id: createAuditLogId(`audit_balance_correction_${idSeed}`),
    workspaceId: repository.workspaceId,
    actor: 'user',
    action: 'balance_corrected',
    occurredAt: decidedAt,
    reversible: true,
    version,
    subjectId: String(observation.id),
    provenanceId: provenance.id,
  };
  const adjustment = createBalanceAdjustment({
    id: `balanceadjustment_correction_${idSeed}`,
    workspaceId: repository.workspaceId,
    accountId: account.id,
    kind: 'correction',
    localDate,
    amount: createMoney({ minorUnits: differenceMinor, currency: account.currency }),
    reason: input.reason,
    sourceObservationId: sourceObservation.id,
    resultingObservationId: observation.id,
    decisionId: decision.id,
    auditLogId: auditEntry.id,
    sourceRecordId: sourceRecord.id,
    provenanceId: provenance.id,
    version,
  });
  const timelineEntry: TimelineEntry = {
    id: createTimelineEntryId(`timeline_balance_correction_${idSeed}`),
    workspaceId: repository.workspaceId,
    kind: 'decision',
    title: decision.summary,
    localDate,
    authorityState: 'user-confirmed',
    subjectId: String(adjustment.id),
    version,
    provenanceId: provenance.id,
  };

  repository.sourceRecords.put(sourceRecord);
  repository.provenance.put(provenance);
  repository.balanceObservations.put(observation);
  repository.currentBalances.put(currentBalance);
  repository.balanceAdjustments.put(adjustment);
  repository.decisions.put(decision);
  repository.auditLog.put(auditEntry);
  repository.timelineEntries.put(timelineEntry);

  return {
    sourceRecord,
    provenance,
    observation,
    currentBalance,
    adjustment,
    decision,
    auditEntry,
    timelineEntry,
  };
}

function canonicalBalanceIdPart(raw: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized.slice(0, 96) || 'correction';
}
