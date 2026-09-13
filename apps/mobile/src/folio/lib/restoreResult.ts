/**
 * Truthful result data for a workspace restore. This model deliberately carries only observed
 * post-apply facts; it does not claim rollback or infer that a document exists from a link.
 */
export type RestoreResultStatus = 'success' | 'partial' | 'degraded';

export type RestoreResult = Readonly<{
  workspaceId: string;
  /** Stable identity for one restore attempt; absent on legacy receipts. */
  resultId?: string;
  /** The restore succeeded, but removing this durable receipt was rejected. */
  acknowledgementFailed?: boolean;
  /** The A03 failure notice has already been announced for this durable receipt. */
  acknowledgementNoticeAnnounced?: boolean;
  status: RestoreResultStatus;
  degraded: boolean;
  attemptedTransactionCount: number;
  restoredTransactionCount: number;
  /** Rows whose stable ID and supplied material values survived unchanged. */
  intactTransactionCount: number;
  /** Rows absent or unreadable after restore, excluding rows that survived with changed values. */
  notRestoredTransactionCount: number;
  restoredAccountCount: number;
  changedAccountCount: number;
  changedDebtCount: number;
  changedSubscriptionCount: number;
  changedPotCount: number;
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
  resultId?: string;
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
  attemptedAccounts?: readonly unknown[];
  restoredAccounts?: readonly unknown[];
  attemptedDebts?: readonly unknown[];
  restoredDebts?: readonly unknown[];
  attemptedSubscriptions?: readonly unknown[];
  restoredSubscriptions?: readonly unknown[];
  attemptedPots?: readonly unknown[];
  restoredPots?: readonly unknown[];
  attemptedOriginalFileIds: readonly string[];
  restoredOriginalFileIds: readonly string[];
}>;

export function stringId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Compare one durable restore attempt without confusing identical result facts from later runs. */
export function restoreResultIdentity(result: RestoreResult): string {
  return result.resultId === undefined
    ? `content:${JSON.stringify(result)}`
    : `attempt:${result.workspaceId}:${result.resultId}`;
}

let restoreResultSequence = 0;

/** Generate a non-visible identity for a newly applied restore. */
export function createRestoreResultId(): string {
  restoreResultSequence += 1;
  return `restore-${Date.now().toString(36)}-${restoreResultSequence.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
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

function canonicalRecord(value: unknown): string | null {
  const row = asRecord(value);
  if (!row) return null;
  const canonicalise = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonicalise);
    if (input !== null && typeof input === 'object') {
      return Object.keys(input as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = canonicalise((input as Record<string, unknown>)[key]);
          return result;
        }, {});
    }
    return input;
  };
  return JSON.stringify(canonicalise(row));
}

function affectedRecordCount(attempted: readonly unknown[], restored: readonly unknown[]): number {
  const attemptedRows = rowsWithIds(attempted);
  const restoredRows = rowsWithIds(restored);
  let affected = attempted.filter((row) => stringId(asRecord(row)?.id) === null).length;
  for (const [id, expectedRows] of attemptedRows.entries()) {
    const actualRows = restoredRows.get(id) ?? [];
    affected += Math.max(expectedRows.length - actualRows.length, 0);
    const comparable = Math.min(expectedRows.length, actualRows.length);
    for (let index = 0; index < comparable; index += 1) {
      if (canonicalRecord(expectedRows[index]) !== canonicalRecord(actualRows[index]))
        affected += 1;
    }
  }
  return affected;
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
  // The metric is an identity count: a duplicate ID present on both sides is still one
  // duplicated identity, not one duplicate per attempted/restored representation.
  const duplicateTransactionIdCount = [...new Set([...attemptedTransactionRows.keys(), ...restoredTransactionRows.keys()])].filter(
    (id) =>
      (attemptedTransactionRows.get(id)?.length ?? 0) > 1 ||
      (restoredTransactionRows.get(id)?.length ?? 0) > 1,
  ).length;
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
  const attemptedAccounts = input.attemptedAccounts ?? [];
  const restoredAccounts = input.restoredAccounts ?? [];
  const changedAccountCount =
    affectedRecordCount(attemptedAccounts, restoredAccounts) +
    // Personal load synthesizes Main when the export omitted accounts. Preserve the fact that
    // this account was defaulted so a restore cannot claim every nontransaction record was intact.
    (attemptedAccounts.length === 0 && restoredAccounts.length > 0 ? restoredAccounts.length : 0);
  const changedDebtCount = affectedRecordCount(
    input.attemptedDebts ?? [],
    input.restoredDebts ?? [],
  );
  const changedSubscriptionCount = affectedRecordCount(
    input.attemptedSubscriptions ?? [],
    input.restoredSubscriptions ?? [],
  );
  const changedPotCount = affectedRecordCount(input.attemptedPots ?? [], input.restoredPots ?? []);
  const partial =
    input.degraded ||
    droppedTransactionCount > 0 ||
    duplicateTransactionIdCount > 0 ||
    changedTransactionIds.length > 0 ||
    changedAccountCount > 0 ||
    changedDebtCount > 0 ||
    changedSubscriptionCount > 0 ||
    changedPotCount > 0 ||
    missingOriginalFileCount > 0 ||
    unlinkedRecordCount > 0 ||
    unlinkedStatementRecordCount > 0;

  return {
    workspaceId: input.workspaceId,
    ...(input.resultId === undefined ? {} : { resultId: input.resultId }),
    status: input.degraded ? 'degraded' : partial ? 'partial' : 'success',
    degraded: input.degraded,
    attemptedTransactionCount: input.attemptedTransactions.length,
    restoredTransactionCount: input.restoredTransactions.length,
    intactTransactionCount,
    notRestoredTransactionCount: Math.max(
      input.attemptedTransactions.length - intactTransactionCount - changedTransactionIds.length,
      0,
    ),
    restoredAccountCount: input.restoredAccountCount,
    changedAccountCount,
    changedDebtCount,
    changedSubscriptionCount,
    changedPotCount,
    restoredOriginalFileCount: restoredOriginalFileIdSet.size,
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
  /** Save a receipt, optionally only when the currently stored receipt is `expectedPrevious`. */
  save: (result: RestoreResult, expectedPrevious?: RestoreResult) => Promise<void>;
  /** Remove only the receipt that was presented to the user when `expectedReceipt` is supplied. */
  acknowledge: (workspaceId: string, expectedReceipt?: RestoreResult) => Promise<void>;
}>;

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function receiptCount(
  row: Record<string, unknown>,
  key: string,
  fallback: number,
  required = false,
): number | null {
  if (!Object.prototype.hasOwnProperty.call(row, key)) return required ? null : fallback;
  return nonNegativeInteger(row[key]);
}

function receiptStringArray(
  row: Record<string, unknown>,
  key: string,
  fallback: readonly string[] = [],
): readonly string[] | null {
  if (!Object.prototype.hasOwnProperty.call(row, key)) return fallback;
  const value = row[key];
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => typeof item === 'string' && item.length > 0)) return null;
  return value as readonly string[];
}

/**
 * Read a persisted receipt defensively. Receipts pre-dating the expanded mixed-result model are
 * upgraded with conservative counts; malformed or foreign-workspace values are ignored so a cold
 * launch cannot present another workspace's result or crash while rendering Privacy.
 */
export function normalizeRestoreResult(
  value: unknown,
  expectedWorkspaceId?: string,
): RestoreResult | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const workspaceId = stringId(row.workspaceId);
  if (
    workspaceId === null ||
    (expectedWorkspaceId !== undefined && workspaceId !== expectedWorkspaceId)
  ) {
    return null;
  }
  const declaredStatus = row.status;
  if (
    (declaredStatus !== 'success' &&
      declaredStatus !== 'partial' &&
      declaredStatus !== 'degraded') ||
    typeof row.degraded !== 'boolean'
  ) {
    return null;
  }
  const attempted = receiptCount(row, 'attemptedTransactionCount', 0, true);
  const restored = receiptCount(row, 'restoredTransactionCount', 0, true);
  if (attempted === null || restored === null) return null;
  const intact = receiptCount(row, 'intactTransactionCount', Math.min(restored, attempted));
  const notRestored = receiptCount(
    row,
    'notRestoredTransactionCount',
    Math.max(attempted - Math.min(restored, attempted), 0),
  );
  const restoredAccountCount = receiptCount(row, 'restoredAccountCount', 0);
  const changedAccounts = receiptCount(row, 'changedAccountCount', 0);
  const changedDebts = receiptCount(row, 'changedDebtCount', 0);
  const changedSubscriptions = receiptCount(row, 'changedSubscriptionCount', 0);
  const changedPots = receiptCount(row, 'changedPotCount', 0);
  const restoredOriginalFileCount = receiptCount(row, 'restoredOriginalFileCount', 0);
  const missingOriginalFileCount = receiptCount(row, 'missingOriginalFileCount', 0);
  const unlinkedRecordCount = receiptCount(row, 'unlinkedRecordCount', 0);
  const unlinkedStatementRecordCount = receiptCount(row, 'unlinkedStatementRecordCount', 0);
  const droppedTransactionCount = receiptCount(row, 'droppedTransactionCount', 0);
  const duplicateTransactionIdCount = receiptCount(row, 'duplicateTransactionIdCount', 0);
  const intactIds = receiptStringArray(row, 'restoredTransactionIds');
  const missingIds = receiptStringArray(row, 'missingTransactionIds');
  const changedTransactionIds = receiptStringArray(row, 'changedTransactionIds');
  const missingOriginalTransactionIds = receiptStringArray(row, 'missingOriginalTransactionIds');
  const parsedResultId = row.resultId === undefined ? undefined : stringId(row.resultId);
  if (parsedResultId === null) return null;
  const resultId: string | undefined = parsedResultId;
  if (
    intact === null ||
    notRestored === null ||
    restoredAccountCount === null ||
    changedAccounts === null ||
    changedDebts === null ||
    changedSubscriptions === null ||
    changedPots === null ||
    restoredOriginalFileCount === null ||
    missingOriginalFileCount === null ||
    unlinkedRecordCount === null ||
    unlinkedStatementRecordCount === null ||
    droppedTransactionCount === null ||
    duplicateTransactionIdCount === null ||
    intactIds === null ||
    missingIds === null ||
    changedTransactionIds === null ||
    missingOriginalTransactionIds === null
  ) {
    return null;
  }
  const inconsistentCounts =
    restored > attempted ||
    intact > attempted ||
    intact > restored ||
    notRestored > attempted ||
    droppedTransactionCount > attempted ||
    duplicateTransactionIdCount > attempted ||
    intact + changedTransactionIds.length + notRestored > attempted;
  if (inconsistentCounts) return null;
  const degraded = row.degraded === true || declaredStatus === 'degraded';
  const hasLoss =
    droppedTransactionCount > 0 ||
    duplicateTransactionIdCount > 0 ||
    intact < attempted ||
    restored < attempted ||
    notRestored > 0 ||
    changedTransactionIds.length > 0 ||
    changedAccounts > 0 ||
    changedDebts > 0 ||
    changedSubscriptions > 0 ||
    changedPots > 0 ||
    missingOriginalFileCount > 0 ||
    unlinkedRecordCount > 0 ||
    unlinkedStatementRecordCount > 0;
  const status = degraded ? 'degraded' : hasLoss ? 'partial' : declaredStatus;
  const normalized: RestoreResult = {
    workspaceId,
    ...(resultId === undefined ? {} : { resultId }),
    status,
    degraded,
    attemptedTransactionCount: attempted,
    restoredTransactionCount: restored,
    intactTransactionCount: Math.min(intact, attempted),
    notRestoredTransactionCount: Math.max(
      notRestored,
      Math.max(attempted - intact - changedTransactionIds.length, 0),
    ),
    restoredAccountCount,
    changedAccountCount: changedAccounts,
    changedDebtCount: changedDebts,
    changedSubscriptionCount: changedSubscriptions,
    changedPotCount: changedPots,
    restoredOriginalFileCount,
    missingOriginalFileCount,
    unlinkedRecordCount,
    unlinkedStatementRecordCount,
    restoredTransactionIds: intactIds,
    missingTransactionIds: missingIds,
    droppedTransactionCount,
    duplicateTransactionIdCount,
    changedTransactionIds,
    missingOriginalTransactionIds,
  };
  // Keep legacy receipt object shape stable. Optional markers are serialized only for the explicit
  // A03 failure branch; malformed/missing legacy values remain an ordinary receipt.
  return row.acknowledgementFailed === true
    ? {
        ...normalized,
        acknowledgementFailed: true,
        ...(row.acknowledgementNoticeAnnounced === true
          ? { acknowledgementNoticeAnnounced: true }
          : {}),
      }
    : normalized;
}
