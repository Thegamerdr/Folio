import { parseOpenBankingSyncResponse, type OpenBankingSyncResponse } from '@folio/open-banking';
import type { WorkspaceId } from '@folio/domain';
import { utf8ToBytes } from '@noble/ciphers/utils.js';

/** Unreviewed provider receipts belong in the encrypted partition, not a screen's React state. */
export type BankImportBatch = Readonly<{
  id: string;
  workspaceId: WorkspaceId;
  receivedAt: string;
  sync: OpenBankingSyncResponse;
  accountMappings: Readonly<Record<string, string>>;
}>;

const MAX_BATCHES = 24;
const MAX_CANDIDATES_PER_BATCH = 500;
const MAX_INBOX_BYTES = 1024 * 1024;
const BATCH_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/** Fail closed on corrupt durable receipts; never silently drop a batch already acknowledged. */
export function parseBankImportInbox(value: unknown, workspaceId: WorkspaceId): BankImportBatch[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_BATCHES)
    throw new Error('Bank inbox is invalid.');
  const seen = new Set<string>();
  const batches = value.map((candidate: unknown) => {
    if (candidate === null || typeof candidate !== 'object')
      throw new Error('Bank receipt is invalid.');
    const row = candidate as Record<string, unknown>;
    const sync = parseOpenBankingSyncResponse(row['sync']);
    const rawSync = row['sync'];
    const rawSyncRecord =
      typeof rawSync === 'object' && rawSync !== null && !Array.isArray(rawSync)
        ? (rawSync as Record<string, unknown>)
        : null;
    const deliveryId = rawSyncRecord?.['deliveryId'];
    const connectionRevision = rawSyncRecord?.['connectionRevision'];
    const durableSync =
      sync !== null && typeof deliveryId === 'string' && Number.isSafeInteger(connectionRevision)
        ? ({ ...sync, deliveryId, connectionRevision } as OpenBankingSyncResponse)
        : sync;
    const mappings = row['accountMappings'];
    if (
      typeof row['id'] !== 'string' ||
      !BATCH_ID.test(row['id']) ||
      seen.has(row['id']) ||
      row['workspaceId'] !== workspaceId ||
      typeof row['receivedAt'] !== 'string' ||
      !Number.isFinite(Date.parse(row['receivedAt'])) ||
      durableSync === null ||
      durableSync.candidates.length > MAX_CANDIDATES_PER_BATCH ||
      mappings === null ||
      typeof mappings !== 'object' ||
      Array.isArray(mappings) ||
      Object.values(mappings).some(
        (id) => typeof id !== 'string' || id.length === 0 || id.length > 128,
      )
    ) {
      throw new Error('Bank receipt does not match this workspace or its delivery contract.');
    }
    const accounts = new Set(durableSync.connection.accounts.map((account) => account.accountRef));
    if (
      durableSync.candidates.some(
        (item) => item.connectionId !== durableSync.connection.id || !accounts.has(item.accountRef),
      ) ||
      Object.keys(mappings).some((ref) => !accounts.has(ref))
    ) {
      throw new Error('Bank receipt contains an unrelated connection or account.');
    }
    seen.add(row['id']);
    return {
      id: row['id'],
      workspaceId,
      receivedAt: row['receivedAt'],
      sync: durableSync,
      accountMappings: { ...mappings } as Record<string, string>,
    };
  });
  if (utf8ToBytes(JSON.stringify(batches)).byteLength > MAX_INBOX_BYTES) {
    throw new Error('Review or explicitly discard older bank batches before refreshing again.');
  }
  return batches;
}

/** Retain any receipt with an undecided candidate, even when Review's visual queue expires/overflows. */
export function unsettledBankImportBatches(
  batches: readonly BankImportBatch[],
  settledExternalIds: ReadonlySet<string>,
): BankImportBatch[] {
  return batches.filter((batch) =>
    batch.sync.candidates.some((item) => !settledExternalIds.has(item.externalId)),
  );
}
