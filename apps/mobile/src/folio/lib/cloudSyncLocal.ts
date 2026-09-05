const WORKSPACE_REF = /^[a-f0-9]{64}$/u;

export type CloudSyncLocalState = Readonly<{
  version: 2;
  enabled: boolean;
  /** The authenticated account namespace that owns this local sync journal. */
  accountRef: string | null;
  workspaceRef: string;
  /** Monotonic CAS revision for metadata writes racing a network runner. */
  revision: number;
  baselineProjection: string;
  /** Last exact local shareable projection captured into this journal. */
  lastCapturedProjection: string;
  /** Backward-compatible alias for older callers; never used as the remote baseline. */
  lastLocalProjection: string;
  /** Highest fetched cursor; `cursor` remains the contiguous durable replay/ack cursor. */
  downloadCursor: number;
  cursor: number;
  nextSequence: number;
  keyEpoch: number;
  outbox: readonly Readonly<{
    id: string;
    deviceSequence: number;
    baseCursor: number;
    sealedDelta: string;
    entityGroup: string;
  }>[];
  /** IDs accepted by the coordinator but not yet replayed into the remote baseline. */
  uploadedOperationIds: readonly string[];
  /** Base of the single never-sent intent being coalesced across ordinary saves. */
  pendingBaseProjection: string | null;
  /** Committed before encryption/network so a restart can finish sealing deterministically. */
  pendingDeltas: readonly Readonly<{
    id: string;
    deviceSequence: number;
    baseCursor: number;
    plaintext: string;
    entityGroup: string;
  }>[];
  conflictRecords: readonly Readonly<{
    id: string;
    remoteState: string;
    remoteProjectionHash: string;
  }>[];
  partialGroups: readonly string[];
  conflicts: readonly string[];
}>;

export function createCloudSyncLocalState(
  workspaceRef: string,
  projection: string,
  keyEpoch = 1,
  accountRef: string | null = null,
): CloudSyncLocalState {
  assertWorkspaceRef(workspaceRef);
  assertAccountRef(accountRef);
  if (keyEpoch < 1 || !Number.isSafeInteger(keyEpoch))
    throw new Error('Sync key epoch is invalid.');
  return {
    version: 2,
    enabled: false,
    accountRef,
    workspaceRef,
    revision: 1,
    baselineProjection: projection,
    lastCapturedProjection: projection,
    lastLocalProjection: projection,
    downloadCursor: 0,
    cursor: 0,
    nextSequence: 1,
    keyEpoch,
    outbox: [],
    uploadedOperationIds: [],
    pendingBaseProjection: null,
    pendingDeltas: [],
    conflictRecords: [],
    partialGroups: [],
    conflicts: [],
  };
}

export function parseCloudSyncLocalState(raw: string, workspaceRef: string): CloudSyncLocalState {
  assertWorkspaceRef(workspaceRef);
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Saved sync state is unreadable.');
  }
  if (
    !record(value) ||
    (value.version !== 1 && value.version !== 2) ||
    typeof value.enabled !== 'boolean' ||
    value.workspaceRef !== workspaceRef ||
    typeof value.baselineProjection !== 'string' ||
    typeof value.lastLocalProjection !== 'string' ||
    !safeInt(value.cursor, 0) ||
    !safeInt(value.nextSequence, 1) ||
    !safeInt(value.keyEpoch, 1) ||
    !Array.isArray(value.outbox) ||
    !Array.isArray(value.partialGroups) ||
    !Array.isArray(value.conflicts)
  )
    throw new Error('Saved sync state is invalid.');
  const accountRef = value.accountRef === undefined ? null : value.accountRef;
  assertAccountRef(accountRef);
  // v1 journals predate account binding. Keep their local data untouched but require an explicit
  // authenticated re-enable before any network operation can use it.
  const enabled = value.enabled && accountRef !== null;
  const lastCapturedProjection =
    typeof value.lastCapturedProjection === 'string'
      ? value.lastCapturedProjection
      : value.lastLocalProjection;
  const revision = safeInt(value.revision, 1) ? value.revision : 1;
  const downloadCursor = value.downloadCursor === undefined ? value.cursor : value.downloadCursor;
  if (!safeInt(downloadCursor, 0) || downloadCursor < value.cursor)
    throw new Error('Saved cloud sync download cursor is invalid.');
  const outbox = value.outbox.filter(
    (item): item is CloudSyncLocalState['outbox'][number] =>
      record(item) &&
      typeof item.id === 'string' &&
      typeof item.sealedDelta === 'string' &&
      typeof item.entityGroup === 'string' &&
      safeInt(item.deviceSequence, 1) &&
      safeInt(item.baseCursor, 0),
  );
  if (outbox.length !== value.outbox.length) throw new Error('Saved sync outbox is invalid.');
  if (value.uploadedOperationIds !== undefined && !Array.isArray(value.uploadedOperationIds))
    throw new Error('Saved cloud sync upload journal is invalid.');
  const rawUploadedOperationIds: unknown[] =
    value.uploadedOperationIds === undefined ? [] : value.uploadedOperationIds;
  const uploadedOperationIds = rawUploadedOperationIds.filter(
    (id): id is string => typeof id === 'string' && /^[A-Za-z0-9._:-]{1,128}$/u.test(id),
  );
  if (
    uploadedOperationIds.length !== rawUploadedOperationIds.length ||
    uploadedOperationIds.length > 256
  )
    throw new Error('Saved cloud sync upload journal is invalid.');
  const pendingBaseProjection =
    value.pendingBaseProjection === undefined ? null : value.pendingBaseProjection;
  if (
    pendingBaseProjection !== null &&
    (typeof pendingBaseProjection !== 'string' || pendingBaseProjection.length === 0)
  )
    throw new Error('Saved cloud sync pending base is invalid.');
  if (
    pendingBaseProjection !== null &&
    value.pendingDeltas !== undefined &&
    Array.isArray(value.pendingDeltas) &&
    value.pendingDeltas.length === 0
  )
    throw new Error('Saved cloud sync pending base is orphaned.');
  const rawPendingDeltas: unknown[] =
    value.pendingDeltas === undefined
      ? []
      : Array.isArray(value.pendingDeltas)
        ? value.pendingDeltas
        : [];
  const pendingDeltas = rawPendingDeltas.filter(
    (item): item is CloudSyncLocalState['pendingDeltas'][number] =>
      record(item) &&
      typeof item.id === 'string' &&
      typeof item.plaintext === 'string' &&
      item.plaintext.length > 0 &&
      item.plaintext.length <= 1024 * 1024 &&
      typeof item.entityGroup === 'string' &&
      item.entityGroup.length > 0 &&
      safeInt(item.deviceSequence, 1) &&
      safeInt(item.baseCursor, 0),
  );
  if (pendingDeltas.length !== (value.pendingDeltas === undefined ? 0 : value.pendingDeltas.length))
    throw new Error('Saved sync pending delta is invalid.');
  const rawConflictRecords: unknown[] =
    value.conflictRecords === undefined
      ? []
      : Array.isArray(value.conflictRecords)
        ? value.conflictRecords
        : [];
  const conflictRecords = rawConflictRecords.filter(
    (item): item is CloudSyncLocalState['conflictRecords'][number] => {
      if (
        !record(item) ||
        typeof item.id !== 'string' ||
        !/^[A-Za-z0-9._:-]{1,128}$/u.test(item.id) ||
        typeof item.remoteState !== 'string' ||
        item.remoteState.length === 0 ||
        typeof item.remoteProjectionHash !== 'string' ||
        !/^[a-f0-9]{64}$/.test(item.remoteProjectionHash)
      )
        return false;
      try {
        const parsed = JSON.parse(item.remoteState) as unknown;
        return record(parsed) && !Array.isArray(parsed);
      } catch {
        return false;
      }
    },
  );
  if (
    conflictRecords.length !==
    (value.conflictRecords === undefined
      ? 0
      : Array.isArray(value.conflictRecords)
        ? value.conflictRecords.length
        : -1)
  )
    throw new Error('Saved sync conflicts are invalid.');
  const partialGroups = value.partialGroups.filter(
    (entry): entry is string =>
      typeof entry === 'string' && entry.length > 0 && entry.length <= 1024 * 1024,
  );
  const conflicts = value.conflicts.filter(
    (entry): entry is string =>
      typeof entry === 'string' && /^[A-Za-z0-9._:-]{1,128}$/u.test(entry),
  );
  if (
    partialGroups.length !== value.partialGroups.length ||
    conflicts.length !== value.conflicts.length
  )
    throw new Error('Saved cloud sync journal lists are invalid.');
  return {
    ...value,
    version: 2,
    accountRef,
    enabled,
    revision,
    lastCapturedProjection,
    downloadCursor,
    pendingBaseProjection,
    pendingDeltas,
    conflictRecords,
    uploadedOperationIds,
    partialGroups,
    conflicts,
  } as unknown as CloudSyncLocalState;
}

export function queueCloudSyncDelta(
  state: CloudSyncLocalState,
  input: Readonly<{ id: string; plaintext: string; entityGroup: string }>,
): CloudSyncLocalState {
  if (
    !/^[A-Za-z0-9._:-]{1,128}$/u.test(input.id) ||
    input.plaintext.length === 0 ||
    input.plaintext.length > 1024 * 1024 ||
    input.entityGroup.length === 0 ||
    input.entityGroup.length > 128
  )
    throw new Error('Sync pending delta is invalid.');
  if (
    state.pendingDeltas.some((item) => item.id === input.id) ||
    state.outbox.some((item) => item.id === input.id)
  )
    return state;
  return {
    ...state,
    pendingDeltas: [
      ...state.pendingDeltas,
      {
        id: input.id,
        deviceSequence: state.nextSequence,
        baseCursor: state.cursor,
        plaintext: input.plaintext,
        entityGroup: input.entityGroup,
      },
    ],
    nextSequence: state.nextSequence + 1,
  };
}

export function appendCloudSyncDelta(
  state: CloudSyncLocalState,
  input: Readonly<{ id: string; sealedDelta: string; entityGroup: string }>,
): CloudSyncLocalState {
  if (
    !/^[A-Za-z0-9._:-]{1,128}$/u.test(input.id) ||
    input.sealedDelta.length === 0 ||
    input.sealedDelta.length > 512 * 1024 ||
    input.entityGroup.length === 0 ||
    input.entityGroup.length > 128
  )
    throw new Error('Sync operation is invalid.');
  if (state.outbox.some((item) => item.id === input.id)) return state;
  return {
    ...state,
    outbox: [
      ...state.outbox,
      {
        id: input.id,
        deviceSequence: state.nextSequence,
        baseCursor: state.cursor,
        sealedDelta: input.sealedDelta,
        entityGroup: input.entityGroup,
      },
    ],
    nextSequence: state.nextSequence + 1,
  };
}

export function serializeCloudSyncLocalState(state: CloudSyncLocalState): string {
  return JSON.stringify(state);
}

function assertWorkspaceRef(value: string): void {
  if (!WORKSPACE_REF.test(value)) throw new Error('Sync workspace reference is invalid.');
}
function assertAccountRef(value: string | null): void {
  if (value !== null && !WORKSPACE_REF.test(value))
    throw new Error('Sync account reference is invalid.');
}
function safeInt(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}
function record(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
