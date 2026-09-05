import * as Crypto from 'expo-crypto';
import type { WorkspaceId } from '@folio/domain';
import type { CloudSyncOperation, EncryptedOperationUpload } from '@folio/sync';
import { workspaceBackupRef } from './cloudBackup';
import { getOrCreateCloudDeviceId } from './cloudBackupNative';
import { GCM_NONCE_BYTES } from './cryptoBlob';
import { openCloudSyncOperation, sealCloudSyncOperation } from './cloudSync';
import { getPersistBlob, getState } from '@/folio/store';
import { persistCurrentStateNow, commitCloudSyncProjection } from './persist';
import { loadCloudSyncLocalState, persistCloudSyncLocalState } from './cloudSyncLocalNative';
import {
  createCloudSyncLocalState,
  queueCloudSyncDelta,
  type CloudSyncLocalState,
} from './cloudSyncLocal';
import { loadActiveEntitlement } from './billing/entitlements';
import {
  applyCloudSyncPatchToState,
  combineCloudSyncChunks,
  createCloudSyncPatches,
  extractProjectionState,
  projectionHash,
  type CloudSyncPatch,
} from './cloudSyncPatch';
import {
  createShareableCloudSyncProjection,
  parseShareableCloudSyncProjection,
  stableCloudSyncJson,
} from './cloudSyncProjection';
import {
  authenticatedCloudSyncApi,
  deriveCloudSyncScope,
  type CloudSyncKeyApi,
} from './cloudSyncTransportNative';
import {
  ensureCloudSyncEnrollment,
  loadEpochKey,
  reconcileCloudSyncKeyHistory,
} from './cloudSyncEnrollmentNative';

export { getCloudSyncDeviceId, authenticatedCloudSyncApi } from './cloudSyncTransportNative';
export {
  ensureCloudSyncEnrollment,
  approveCloudSyncDevice,
  revokeCloudSyncDevice,
  loadEpochKey,
  reconcileCloudSyncKeyHistory,
} from './cloudSyncEnrollmentNative';
export type { CloudSyncEnrollment } from './cloudSyncEnrollmentNative';

export type CloudSyncRunResult = Readonly<{
  uploaded: number;
  applied: number;
  conflicts: number;
  pendingApproval: boolean;
  cursor: number;
  hasMore: boolean;
}>;
type Staged = { operation: CloudSyncOperation; patch: CloudSyncPatch; applied?: boolean };
const runLocks = new Map<string, Promise<void>>();
const HASH = /^[a-f0-9]{64}$/u;
const ID = /^[A-Za-z0-9._:-]{1,128}$/u;

export function getCloudSyncProjection(workspaceId: WorkspaceId): string {
  return createShareableCloudSyncProjection(getPersistBlob(workspaceId), workspaceId);
}

export async function enableCloudSyncWorkspace(
  workspaceId: WorkspaceId,
  bearerToken: string,
): Promise<void> {
  await setCloudSyncEnabled(workspaceId, bearerToken, true);
}

export async function setCloudSyncEnabled(
  workspaceId: WorkspaceId,
  bearerToken: string | null,
  enabled: boolean,
): Promise<void> {
  await withWorkspaceLock(workspaceId, async () => {
    assertSelected(workspaceId);
    await persistCurrentStateNow(workspaceId);
    const current = getCloudSyncProjection(workspaceId);
    const existing = await loadCloudSyncLocalState(workspaceId);
    if (!enabled) {
      if (existing) await persistCloudSyncLocalState(workspaceId, { ...existing, enabled: false });
      return;
    }
    if (!bearerToken) throw new Error('Sign in before enabling cloud sync.');
    const scope = deriveCloudSyncScope(workspaceId, bearerToken);
    if (existing && existing.accountRef !== scope.accountRef) {
      throw new Error(
        'This local journal belongs to another account or an older unbound format. Recover it before choosing a new account.',
      );
    }
    let next =
      existing ?? createCloudSyncLocalState(scope.workspaceRef, current, 1, scope.accountRef);
    if (existing && existing.lastCapturedProjection !== current) {
      next = queueProjection(next, existing.lastCapturedProjection, current);
    }
    await persistCloudSyncLocalState(workspaceId, {
      ...next,
      enabled: true,
      baselineProjection: existing ? existing.baselineProjection : emptyProjection(workspaceId),
      lastCapturedProjection: current,
      lastLocalProjection: current,
    });
  });
}

/** One bounded foreground pass. Saved ciphertext is retried verbatim; acknowledgements cover only
 * contiguous, durably applied or durably reviewed operations, never a partial atomic group. */
export async function syncCloudWorkspace(
  workspaceId: WorkspaceId,
  bearerToken: string,
  isCurrent: () => boolean = () => true,
): Promise<CloudSyncRunResult> {
  return withWorkspaceLock(workspaceId, async () => {
    const scope = deriveCloudSyncScope(workspaceId, bearerToken);
    const check = () => {
      assertSelected(workspaceId);
      if (!isCurrent())
        throw new Error('Sync paused because the signed-in account or workspace changed.');
    };
    check();
    let local = await loadCloudSyncLocalState(workspaceId);
    if (!local?.enabled) return result(local);
    if (local.accountRef !== scope.accountRef || local.workspaceRef !== scope.workspaceRef)
      throw new Error(
        'This workspace is bound to another Melo account. No data was sent or replaced.',
      );
    if ((await loadActiveEntitlement('live')) === null) return result(local);
    // Capture unsaved UI edits before reading or replacing any journal metadata.
    await persistCurrentStateNow(workspaceId);
    local = await requireLocal(workspaceId, scope.accountRef);
    check();
    const enrollment = await ensureCloudSyncEnrollment(workspaceId, bearerToken);
    if (enrollment.status !== 'active' || enrollment.syncKey === null)
      return { ...result(local), pendingApproval: true };
    if (local.cursor < enrollment.compactedThrough)
      throw new Error(
        'This phone needs an encrypted backup recovery before it can replay compacted sync history.',
      );
    if (
      local.nextSequence <= enrollment.lastDeviceSequence &&
      local.outbox.length === 0 &&
      local.pendingDeltas.length === 0
    ) {
      if (local.cursor !== 0)
        throw new Error(
          'The local operation journal is behind this phone’s registered history. Recover before syncing.',
        );
      local = await persistCloudSyncLocalState(workspaceId, {
        ...local,
        nextSequence: enrollment.lastDeviceSequence + 1,
      });
    }
    const api = await authenticatedCloudSyncApi(workspaceId, bearerToken);
    await reconcileCloudSyncKeyHistory(scope, enrollment.currentKeyEpoch, enrollment.syncKey, api);
    let uploaded = 0;
    let applied = 0;
    let head = enrollment.headCursor;
    let pages = 0;

    const save = async (next: CloudSyncLocalState) => {
      check();
      local = await persistCloudSyncLocalState(workspaceId, next);
    };
    const flush = async () => {
      for (const item of local!.outbox) {
        if (local!.uploadedOperationIds.includes(item.id)) continue;
        check();
        let operation = parseEncryptedOperation(item.sealedDelta);
        // The signed high-water mark, read after rotation, proves this old-epoch sequence never
        // committed. Old epochs cannot be accepted now. Accepted sequences keep exact ciphertext.
        if (
          operation.keyEpoch < enrollment.currentKeyEpoch &&
          operation.deviceSequence > enrollment.lastDeviceSequence
        ) {
          const oldKey = await loadEpochKey(scope, operation.keyEpoch);
          const plaintext =
            oldKey === null
              ? null
              : openCloudSyncOperation({
                  operation: { ...operation, cursor: 0 },
                  workspaceRef: scope.workspaceRef,
                  syncKey: oldKey,
                });
          if (plaintext === null)
            throw new Error('An unsent change needs its previous sync key before it can be sent.');
          operation = await encryptCloudSyncOperation({
            workspaceId,
            id: operation.id,
            deviceSequence: operation.deviceSequence,
            keyEpoch: enrollment.currentKeyEpoch,
            idempotencyKey: operation.idempotencyKey,
            plaintext,
            syncKey: enrollment.syncKey!,
          });
          await save({
            ...local!,
            outbox: local!.outbox.map((entry) =>
              entry.id === item.id ? { ...entry, sealedDelta: JSON.stringify(operation) } : entry,
            ),
          });
        }
        await api.uploadOperation(operation);
        uploaded += 1;
        await save({ ...local!, uploadedOperationIds: [...local!.uploadedOperationIds, item.id] });
      }
    };
    const drain = async () => {
      for (;;) {
        check();
        const staged = local!.partialGroups
          .map(parseStaged)
          .sort((a, b) => a.operation.cursor - b.operation.cursor);
        const first = staged[0];
        if (!first || first.operation.cursor !== local!.cursor + 1) break;
        if (first.applied) {
          await save({
            ...local!,
            cursor: first.operation.cursor,
            partialGroups: staged.slice(1).map((entry) => JSON.stringify(entry)),
          });
          continue;
        }
        const group =
          first.patch.chunkSetId === undefined
            ? [first]
            : staged.filter(
                (entry) =>
                  entry.operation.deviceId === first.operation.deviceId &&
                  entry.patch.chunkSetId === first.patch.chunkSetId,
              );
        if (first.patch.chunkSetId !== undefined && group.length < first.patch.chunkCount!) break;
        const patch = validatePatch(
          first.patch.chunkSetId === undefined
            ? first.patch
            : combineCloudSyncChunks(group.map((entry) => entry.patch)),
          scope.workspaceRef,
          true,
        );
        const own = group.every((entry) => entry.operation.deviceId === enrollment.deviceId);
        const baseline = local!.baselineProjection;
        const current = getCloudSyncProjection(workspaceId);
        if (current !== local!.lastCapturedProjection)
          throw new Error(
            'A local edit arrived during sync. It will be saved before the next pass.',
          );
        const unchecked = forcePatch(workspaceId, baseline, patch);
        let remote = baseline;
        let conflicting = false;
        try {
          remote = patchProjection(workspaceId, baseline, patch);
          if (
            projectionHash(baseline) === patch.baseProjectionHash &&
            projectionHash(remote) !== patch.resultProjectionHash
          )
            throw new Error('invalid_result');
        } catch (reason) {
          if (reason instanceof Error && reason.message === 'invalid_result')
            throw new Error('Sync change failed its result checksum.');
          if (unchecked !== baseline) conflicting = true; // Exact resulting values are idempotent.
        }
        let nextCurrent = current;
        if (!conflicting && !own) {
          try {
            nextCurrent = patchProjection(workspaceId, current, patch);
          } catch {
            const alreadyApplied = forcePatch(workspaceId, current, patch) === current;
            if (!alreadyApplied) conflicting = true;
          }
        }
        // A new phone starts with local defaults, not the remote empty baseline. It must explicitly
        // choose between its current workspace and the received workspace; never silently erase one.
        let conflictRecords = local!.conflictRecords;
        if (conflicting && !conflictRecords.some((entry) => entry.id === first.operation.id)) {
          const alternative = unchecked === current ? baseline : unchecked;
          conflictRecords = [
            ...conflictRecords,
            {
              id: first.operation.id,
              remoteState: extractProjectionState(alternative),
              remoteProjectionHash: projectionHash(alternative),
            },
          ];
          nextCurrent = current;
        }
        const ids = new Set(group.map((entry) => entry.operation.id));
        const next: CloudSyncLocalState = {
          ...local!,
          baselineProjection: remote,
          lastCapturedProjection: nextCurrent,
          lastLocalProjection: nextCurrent,
          outbox: local!.outbox.filter((entry) => !ids.has(entry.id)),
          uploadedOperationIds: local!.uploadedOperationIds.filter((id) => !ids.has(id)),
          conflictRecords,
          conflicts: conflictRecords.map((entry) => entry.id),
          partialGroups: staged.map((entry) =>
            JSON.stringify(ids.has(entry.operation.id) ? { ...entry, applied: true } : entry),
          ),
        };
        if (nextCurrent !== current) {
          check();
          local = await commitCloudSyncProjection(
            workspaceId,
            nextCurrent,
            { ...next, lastCapturedProjection: current },
            () => isCurrent() && getState().activeWorkspaceId === workspaceId,
          );
          applied += 1;
        } else await save(next);
      }
    };
    const receive = async () => {
      await drain();
      while (pages < 4) {
        check();
        const page = await api.downloadOperations(local!.downloadCursor, 100);
        pages += 1;
        if (
          !Number.isSafeInteger(page.headCursor) ||
          !Number.isSafeInteger(page.nextCursor) ||
          page.nextCursor < local!.downloadCursor
        )
          throw new Error('Sync returned an invalid page cursor.');
        head = page.headCursor;
        let expected = local!.downloadCursor + 1;
        const staged = [...local!.partialGroups];
        for (const operation of page.operations) {
          if (operation.cursor !== expected++)
            throw new Error('Sync history has a gap; no acknowledgement was advanced.');
          const key =
            (await loadEpochKey(scope, operation.keyEpoch)) ??
            (operation.keyEpoch === enrollment.currentKeyEpoch ? enrollment.syncKey : null);
          if (key === null) throw new Error('Sync history needs key recovery.');
          const plaintext = openCloudSyncOperation({
            operation,
            workspaceRef: scope.workspaceRef,
            syncKey: key,
          });
          if (plaintext === null)
            throw new Error('A sync change could not be decrypted and verified.');
          const patch = parseDelta(plaintext, scope.workspaceRef);
          staged.push(JSON.stringify({ operation, patch } satisfies Staged));
        }
        if (page.nextCursor !== expected - 1)
          throw new Error('Sync returned an inconsistent page cursor.');
        if (staged.reduce((size, value) => size + value.length, 0) > 12 * 1024 * 1024)
          throw new Error(
            'The staged sync history reached its safe size limit. Recover this workspace before continuing.',
          );
        if (page.operations.length)
          await save({ ...local!, downloadCursor: page.nextCursor, partialGroups: staged });
        await drain();
        if (!page.hasMore) break;
        if (!page.operations.length) throw new Error('Sync returned a page without progress.');
      }
    };

    // Replay already-received history first. Existing sealed groups can still need their remaining
    // chunks uploaded, so those are flushed before a second download. New intent is sealed last.
    await receive();
    await flush();
    if (uploaded > 0 && pages < 4) await receive();
    if (
      head === 0 &&
      local.cursor === 0 &&
      local.outbox.length === 0 &&
      local.baselineProjection === emptyProjection(workspaceId)
    ) {
      local = {
        ...local,
        nextSequence: Math.min(
          local.nextSequence,
          ...local.pendingDeltas.map((entry) => entry.deviceSequence),
        ),
        pendingDeltas: [],
        pendingBaseProjection: null,
      };
      local = queueProjection(local, local.baselineProjection, getCloudSyncProjection(workspaceId));
      await save(local);
    }
    if (
      local.cursor === local.downloadCursor &&
      local.downloadCursor >= head &&
      local.conflictRecords.length === 0
    ) {
      if (local.pendingDeltas.length) {
        const outbox = [...local.outbox];
        for (const pending of local.pendingDeltas) {
          check();
          const operation = await encryptCloudSyncOperation({
            workspaceId,
            id: pending.id,
            deviceSequence: pending.deviceSequence,
            keyEpoch: enrollment.currentKeyEpoch,
            idempotencyKey: pending.id,
            plaintext: pending.plaintext,
            syncKey: enrollment.syncKey,
          });
          outbox.push({
            id: pending.id,
            deviceSequence: pending.deviceSequence,
            baseCursor: pending.baseCursor,
            sealedDelta: JSON.stringify(operation),
            entityGroup: pending.entityGroup,
          });
        }
        await save({
          ...local,
          keyEpoch: enrollment.currentKeyEpoch,
          pendingDeltas: [],
          pendingBaseProjection: null,
          outbox,
        });
        await flush();
        if (pages < 4) await receive();
      }
    }
    check();
    if (local.cursor > 0) await api.acknowledge(local.cursor);
    return {
      uploaded,
      applied,
      conflicts: local.conflictRecords.length,
      pendingApproval: false,
      cursor: local.cursor,
      hasMore:
        local.cursor < head ||
        local.outbox.length > 0 ||
        (local.pendingDeltas.length > 0 && local.conflicts.length === 0),
    };
  });
}

/** A deliberate whole-workspace choice is published as a new CAS change against the current
 * canonical baseline. Unsent local intentions are replaced only by this explicit user decision. */
export async function resolveCloudSyncConflict(
  workspaceId: WorkspaceId,
  conflictId: string,
  choice: 'local' | 'remote',
  isCurrent: () => boolean = () => true,
): Promise<void> {
  await withWorkspaceLock(workspaceId, async () => {
    assertSelected(workspaceId);
    if (!isCurrent()) throw new Error('The selected account changed.');
    await persistCurrentStateNow(workspaceId);
    let local = await loadCloudSyncLocalState(workspaceId);
    if (!local) throw new Error('The sync journal is unavailable.');
    const conflict = local.conflictRecords.find((item) => item.id === conflictId);
    if (!conflict) throw new Error('This conflict is no longer present.');
    if (local.outbox.length > 0)
      throw new Error('Sync the already-sent changes before choosing a version.');
    const current = getCloudSyncProjection(workspaceId);
    const selected =
      choice === 'local' ? current : projectionFromState(workspaceId, conflict.remoteState);
    const nextSequence = Math.min(
      local.nextSequence,
      ...local.pendingDeltas.map((entry) => entry.deviceSequence),
    );
    local = {
      ...local,
      pendingDeltas: [],
      pendingBaseProjection: null,
      nextSequence,
      conflicts: [],
      conflictRecords: [],
      lastCapturedProjection: selected,
      lastLocalProjection: selected,
    };
    local = queueProjection(local, local.baselineProjection, selected);
    if (selected !== current)
      await commitCloudSyncProjection(
        workspaceId,
        selected,
        { ...local, lastCapturedProjection: current },
        () => isCurrent() && getState().activeWorkspaceId === workspaceId,
      );
    else await persistCloudSyncLocalState(workspaceId, local);
  });
}
export async function resolveCloudSyncConflictKeepLocal(
  workspaceId: WorkspaceId,
  conflictId: string,
): Promise<void> {
  await resolveCloudSyncConflict(workspaceId, conflictId, 'local');
}

function queueProjection(
  local: CloudSyncLocalState,
  base: string,
  next: string,
): CloudSyncLocalState {
  const effectiveBase = local.pendingBaseProjection ?? base;
  let result: CloudSyncLocalState = {
    ...local,
    pendingDeltas: [],
    pendingBaseProjection: null,
    nextSequence: Math.min(
      local.nextSequence,
      ...local.pendingDeltas.map((entry) => entry.deviceSequence),
    ),
  };
  if (effectiveBase === next) return result;
  result = { ...result, pendingBaseProjection: effectiveBase };
  for (const patch of createCloudSyncPatches(local.workspaceRef, effectiveBase, next)) {
    const id =
      'intent-' + result.nextSequence + '-' + projectionHash(JSON.stringify(patch)).slice(0, 40);
    result = queueCloudSyncDelta(result, {
      id,
      entityGroup: patch.chunkSetId ?? 'workspace',
      plaintext: JSON.stringify({
        version: 1,
        workspaceRef: local.workspaceRef,
        entityGroup: 'workspace',
        patch,
      }),
    });
  }
  return result;
}
function patchProjection(workspaceId: WorkspaceId, current: string, patch: CloudSyncPatch): string {
  return projectionFromState(
    workspaceId,
    applyCloudSyncPatchToState(extractProjectionState(current), patch),
  );
}
function forcePatch(workspaceId: WorkspaceId, current: string, patch: CloudSyncPatch): string {
  const groups = patch.groups.map(({ key, value }) =>
    value === undefined ? { key } : { key, value },
  );
  return patchProjection(workspaceId, current, { ...patch, groups });
}
function projectionFromState(workspaceId: WorkspaceId, raw: string): string {
  const next = stableCloudSyncJson({
    version: 1,
    workspaceId: String(workspaceId),
    state: JSON.parse(raw) as unknown,
  });
  parseShareableCloudSyncProjection(next);
  return next;
}
function emptyProjection(workspaceId: WorkspaceId): string {
  return projectionFromState(workspaceId, '{}');
}
function result(local: CloudSyncLocalState | null): CloudSyncRunResult {
  return {
    uploaded: 0,
    applied: 0,
    conflicts: local?.conflicts.length ?? 0,
    cursor: local?.cursor ?? 0,
    pendingApproval: false,
    hasMore: false,
  };
}
async function requireLocal(
  workspaceId: WorkspaceId,
  accountRef: string,
): Promise<CloudSyncLocalState> {
  const local = await loadCloudSyncLocalState(workspaceId);
  if (!local || !local.enabled || local.accountRef !== accountRef)
    throw new Error('The sync binding changed.');
  return local;
}
function assertSelected(workspaceId: WorkspaceId): void {
  if (getState().activeWorkspaceId !== workspaceId)
    throw new Error('The selected workspace changed. Sync left the other workspace untouched.');
}
export async function withCloudSyncWorkspaceLock<T>(
  workspaceId: WorkspaceId,
  work: () => Promise<T>,
): Promise<T> {
  return withWorkspaceLock(workspaceId, work);
}
async function withWorkspaceLock<T>(workspaceId: WorkspaceId, work: () => Promise<T>): Promise<T> {
  const key = String(workspaceId);
  const previous = runLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => gate);
  runLocks.set(key, chained);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (runLocks.get(key) === chained) runLocks.delete(key);
  }
}
export async function encryptCloudSyncOperation(input: {
  workspaceId: WorkspaceId;
  id: string;
  deviceSequence: number;
  keyEpoch: number;
  idempotencyKey: string;
  plaintext: string;
  syncKey: Uint8Array;
}): Promise<EncryptedOperationUpload> {
  return sealCloudSyncOperation({
    ...input,
    workspaceRef: workspaceBackupRef(input.workspaceId),
    deviceId: await getOrCreateCloudDeviceId(),
    createdAt: new Date().toISOString(),
    iv: Uint8Array.from(await Crypto.getRandomBytesAsync(GCM_NONCE_BYTES)),
  });
}
export async function decryptCloudSyncReplay(
  workspaceId: WorkspaceId,
  operations: readonly CloudSyncOperation[],
  syncKey: Uint8Array,
): Promise<readonly { operation: CloudSyncOperation; plaintext: string }[]> {
  return operations.map((operation) => {
    const plaintext = openCloudSyncOperation({
      operation,
      workspaceRef: workspaceBackupRef(workspaceId),
      syncKey,
    });
    if (plaintext === null) throw new Error('Encrypted sync operation could not be verified.');
    return { operation, plaintext };
  });
}
function parseDelta(raw: string, workspaceRef: string): CloudSyncPatch {
  const value: unknown = JSON.parse(raw);
  if (!record(value) || value.version !== 1 || value.workspaceRef !== workspaceRef)
    throw new Error('Sync envelope is invalid.');
  return validatePatch(value.patch, workspaceRef, false);
}
function validatePatch(value: unknown, workspaceRef: string, complete: boolean): CloudSyncPatch {
  if (
    !record(value) ||
    value.version !== 1 ||
    value.workspaceRef !== workspaceRef ||
    typeof value.baseProjectionHash !== 'string' ||
    !HASH.test(value.baseProjectionHash) ||
    typeof value.resultProjectionHash !== 'string' ||
    !HASH.test(value.resultProjectionHash) ||
    !Array.isArray(value.groups) ||
    value.groups.length > 64
  )
    throw new Error('Sync patch metadata is invalid.');
  if (value.chunkSetId !== undefined) {
    if (
      complete ||
      typeof value.chunkSetId !== 'string' ||
      !ID.test(value.chunkSetId) ||
      !Number.isSafeInteger(value.chunkIndex) ||
      !Number.isSafeInteger(value.chunkCount) ||
      Number(value.chunkIndex) < 0 ||
      Number(value.chunkCount) < 2 ||
      Number(value.chunkCount) > 256 ||
      Number(value.chunkIndex) >= Number(value.chunkCount) ||
      typeof value.chunkData !== 'string' ||
      value.chunkData.length > 32000 ||
      typeof value.chunkChecksum !== 'string' ||
      !HASH.test(value.chunkChecksum) ||
      value.groups.length !== 0
    )
      throw new Error('Sync chunk metadata is invalid.');
  } else {
    const keys = new Set<string>();
    for (const group of value.groups) {
      if (
        !record(group) ||
        typeof group.key !== 'string' ||
        keys.has(group.key) ||
        typeof group.beforeHash !== 'string' ||
        !HASH.test(group.beforeHash)
      )
        throw new Error('Sync change lacks a unique checked field.');
      keys.add(group.key);
    }
  }
  return value as unknown as CloudSyncPatch;
}
function parseStaged(raw: string): Staged {
  const value: unknown = JSON.parse(raw);
  if (
    !record(value) ||
    !record(value.operation) ||
    !Number.isSafeInteger(value.operation.cursor) ||
    Number(value.operation.cursor) < 1 ||
    !record(value.patch)
  )
    throw new Error('Staged sync history is invalid.');
  return value as unknown as Staged;
}
function parseEncryptedOperation(raw: string): EncryptedOperationUpload {
  const value: unknown = JSON.parse(raw);
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    !ID.test(value.id) ||
    typeof value.deviceId !== 'string' ||
    !Number.isSafeInteger(value.deviceSequence) ||
    Number(value.deviceSequence) < 1 ||
    !Number.isSafeInteger(value.keyEpoch) ||
    Number(value.keyEpoch) < 1 ||
    typeof value.ciphertext !== 'string' ||
    typeof value.ciphertextSha256 !== 'string'
  )
    throw new Error('Saved sync ciphertext is invalid.');
  return value as unknown as EncryptedOperationUpload;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
