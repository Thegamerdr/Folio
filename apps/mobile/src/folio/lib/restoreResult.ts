/**
 * Truthful result data for a workspace restore. This model deliberately carries only observed
 * post-apply facts; it does not claim rollback or infer that a document exists from a link.
 */
export type RestoreResultStatus = 'success' | 'partial' | 'degraded';

export type RestoreResult = Readonly<{
  workspaceId: string;
  status: RestoreResultStatus;
  degraded: boolean;
  attemptedTransactionCount: number;
  restoredTransactionCount: number;
  /** Rows whose stable ID and supplied material values survived unchanged. */
  intactTransactionCount: number;
  restoredAccountCount: number;
  restoredOriginalFileCount: number;
  missingOriginalFileCount: number;
  unlinkedRecordCount: number;
  unlinkedStatementRecordCount: number;
  restoredTransactionIds: readonly string[];
  /** Valid IDs that were present in the file but absent after the store applied it. */
  missingTransactionIds: readonly string[];
  /** Rows that were dropped or malformed, including rows without a usable ID. */
  droppedTransactionCount: number;
  /** Duplicate IDs violate the stable identity contract and make a restore incomplete. */
  duplicateTransactionIdCount: number;
  /** Rows whose stable ID survived, but a material value changed during restore. */
  changedTransactionIds: readonly string[];
  missingOriginalTransactionIds: readonly string[];
}>;

type RestoreTransactionLike = Readonly<Record<string, unknown>>;

export type RestoreResultInput = Readonly<{
  workspaceId: string;
  degraded: boolean;
  attemptedTransactions: readonly (RestoreTransactionLike | unknown)[];
  restoredTransactions: readonly (RestoreTransactionLike | unknown)[];
  attemptedStatementRecords: readonly Readonly<{
    id?: unknown;
    sourceEvidenceId?: unknown;
  }>[];
  restoredStatementRecords: readonly Readonly<{
    id?: unknown;
    sourceEvidenceId?: unknown;
  }>[];
  restoredAccountCount: number;
  attemptedOriginalFileIds: readonly string[];
  restoredOriginalFileIds: readonly string[];
}>;

export function stringId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

const MATERIAL_KEYS = [
  'when',
  'date',
  'merchant',
  'amount',
  'accountId',
  'category',
  'source',
  'type',
  'externalId',
  'financialAction',
] as const;

function asRecord(value: unknown): RestoreTransactionLike | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as RestoreTransactionLike)
    : null;
}

function materialFingerprint(value: unknown): string | null {
  const row = asRecord(value);
  if (!row) return null;
  const material = MATERIAL_KEYS.filter((key) => key in row).map((key) => [key, row[key]]);
  return material.length === 0 ? null : JSON.stringify(material);
}

function rowsWithIds(rows: readonly unknown[]): ReadonlyMap<string, readonly unknown[]> {
  const grouped = new Map<string, unknown[]>();
  for (const row of rows) {
    const id = stringId(asRecord(row)?.id);
    if (id === null) continue;
    const existing = grouped.get(id);
    if (existing) existing.push(row);
    else grouped.set(id, [row]);
  }
  return grouped;
}

function isMalformedTransaction(value: unknown): boolean {
  const row = asRecord(value);
  const id = stringId(row?.id);
  return (
    id === null ||
    ('amount' in (row ?? {}) && (typeof row?.amount !== 'number' || !Number.isFinite(row.amount)))
  );
}

export function createRestoreResult(input: RestoreResultInput): RestoreResult {
  const attemptedTransactionIds = input.attemptedTransactions
    .map((transaction) => stringId(asRecord(transaction)?.id))
    .filter((id): id is string => id !== null);
  const restoredTransactionIds = input.restoredTransactions
    .map((transaction) => stringId(asRecord(transaction)?.id))
    .filter((id): id is string => id !== null);
  const restoredTransactionRows = rowsWithIds(input.restoredTransactions);
  const attemptedTransactionRows = rowsWithIds(input.attemptedTransactions);
  const restoredTransactionIdSet = new Set(restoredTransactionRows.keys());
  const attemptedTransactionIdSet = new Set(attemptedTransactionRows.keys());
  const restoredDocumentIdSet = new Set(input.restoredOriginalFileIds);
  const missingOriginalTransactionIds = input.attemptedTransactions
    .filter((transaction) => {
      const row = asRecord(transaction);
      const transactionId = stringId(row?.id);
      const sourceEvidenceId = stringId(row?.sourceEvidenceId);
      return (
        transactionId !== null &&
        restoredTransactionIdSet.has(transactionId) &&
        sourceEvidenceId !== null &&
        !restoredDocumentIdSet.has(sourceEvidenceId)
      );
    })
    .map((transaction) => stringId(asRecord(transaction)?.id))
    .filter((id): id is string => id !== null);
  const attemptedOriginalFileIdSet = new Set(input.attemptedOriginalFileIds);
  const restoredOriginalFileIdSet = new Set(input.restoredOriginalFileIds);
  const missingOriginalFileCount = [...attemptedOriginalFileIdSet].filter(
    (id) => !restoredOriginalFileIdSet.has(id),
  ).length;
  const uniqueMissingOriginalTransactionIds = [...new Set(missingOriginalTransactionIds)];
  const unlinkedRecordCount = uniqueMissingOriginalTransactionIds.length;
  const restoredStatementRecordIds = new Set(
    input.restoredStatementRecords
      .map((record) => stringId(record.id))
      .filter((id): id is string => id !== null),
  );
  const unlinkedStatementRecordCount = input.attemptedStatementRecords.filter((record) => {
    const recordId = stringId(asRecord(record)?.id);
    const sourceEvidenceId = stringId(asRecord(record)?.sourceEvidenceId);
    return (
      recordId !== null &&
      restoredStatementRecordIds.has(recordId) &&
      sourceEvidenceId !== null &&
      !restoredDocumentIdSet.has(sourceEvidenceId)
    );
  }).length;
  const missingTransactionIds = [...attemptedTransactionIdSet].filter(
    (id) => !restoredTransactionIdSet.has(id),
  );
  const changedTransactionIds = [...attemptedTransactionRows.entries()]
    .filter(([id, attemptedRows]) => {
      const restoredRows = restoredTransactionRows.get(id);
      if (!restoredRows || restoredRows.length < attemptedRows.length) return false;
      return attemptedRows.some((attemptedRow, index) => {
        const restoredRow = restoredRows[index];
        return (
          materialFingerprint(attemptedRow) !== null &&
          materialFingerprint(restoredRow) !== materialFingerprint(attemptedRow)
        );
      });
    })
    .map(([id]) => id);
  const changedTransactionIdSet = new Set(changedTransactionIds);
  const malformedTransactionCount =
    input.attemptedTransactions.filter(isMalformedTransaction).length;
  const duplicateTransactionIdCount = [
    ...attemptedTransactionRows.values(),
    ...restoredTransactionRows.values(),
  ].reduce((total, rows) => total + Math.max(rows.length - 1, 0), 0);
  const validAttemptedTransactionRows = rowsWithIds(
    input.attemptedTransactions.filter((transaction) => !isMalformedTransaction(transaction)),
  );
  const intactTransactionCount = [...validAttemptedTransactionRows.entries()].reduce(
    (total, [id, attemptedRows]) => {
      if (changedTransactionIdSet.has(id)) return total;
      const restoredRows = restoredTransactionRows.get(id);
      if (!restoredRows || restoredRows.length === 0) return total;
      const expected = materialFingerprint(attemptedRows[0]);
      const actual = materialFingerprint(restoredRows[0]);
      return (
        total +
        (expected === null || expected === actual
          ? Math.min(attemptedRows.length, restoredRows.length)
          : 0)
      );
    },
    0,
  );
  const droppedTransactionCount =
    malformedTransactionCount +
    [...validAttemptedTransactionRows.entries()].reduce((total, [id, attemptedRows]) => {
      const expected = attemptedRows.length;
      const actual = restoredTransactionRows.get(id)?.length ?? 0;
      return total + Math.max(expected - actual, 0);
    }, 0);
  const partial =
    input.degraded ||
    droppedTransactionCount > 0 ||
    duplicateTransactionIdCount > 0 ||
    changedTransactionIds.length > 0 ||
    missingOriginalFileCount > 0 ||
    unlinkedRecordCount > 0 ||
    unlinkedStatementRecordCount > 0;

  return {
    workspaceId: input.workspaceId,
    status: input.degraded ? 'degraded' : partial ? 'partial' : 'success',
    degraded: input.degraded,
    attemptedTransactionCount: input.attemptedTransactions.length,
    restoredTransactionCount: input.restoredTransactions.length,
    intactTransactionCount,
    restoredAccountCount: input.restoredAccountCount,
    restoredOriginalFileCount: input.restoredOriginalFileIds.length,
    missingOriginalFileCount,
    unlinkedRecordCount,
    unlinkedStatementRecordCount,
    restoredTransactionIds: [...new Set(restoredTransactionIds)],
    missingTransactionIds,
    droppedTransactionCount,
    duplicateTransactionIdCount,
    changedTransactionIds,
    missingOriginalTransactionIds: uniqueMissingOriginalTransactionIds,
  };
}

/** Additive interface for the existing durable store owner; no persistence is performed here. */
export type RestoreReceiptStore = Readonly<{
  load: (workspaceId: string) => RestoreResult | null;
  save: (result: RestoreResult) => Promise<void>;
  acknowledge: (workspaceId: string) => Promise<void>;
}>;
