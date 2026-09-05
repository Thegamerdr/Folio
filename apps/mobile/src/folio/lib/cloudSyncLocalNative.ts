import type { WorkspaceId } from '@folio/domain';
import { workspaceBackupRef } from './cloudBackup';
import { loadNativeWorkspaceSyncState } from '@/local/nativeWorkspaceStateStore';
import { persistCurrentStateNow, workspaceMetadata } from './persist';
import {
  parseCloudSyncLocalState,
  serializeCloudSyncLocalState,
  type CloudSyncLocalState,
} from './cloudSyncLocal';
import { getPersistBlob } from '@/folio/store';
import { createShareableCloudSyncProjection } from './cloudSyncProjection';

export async function loadCloudSyncLocalState(
  workspaceId: WorkspaceId,
): Promise<CloudSyncLocalState | null> {
  const saved = await loadNativeWorkspaceSyncState(workspaceMetadata(workspaceId));
  if (saved === null) return null;
  return parseCloudSyncLocalState(saved.payload, workspaceBackupRef(workspaceId));
}

/** Persists sync metadata in the same exact-state SQLCipher transaction as the selected workspace. */
export async function persistCloudSyncLocalState(
  workspaceId: WorkspaceId,
  state: CloudSyncLocalState,
): Promise<CloudSyncLocalState> {
  if (state.workspaceRef !== workspaceBackupRef(workspaceId))
    throw new Error('Sync workspace does not match local state.');
  if (!Number.isSafeInteger(state.revision) || state.revision < 1)
    throw new Error('Sync metadata revision is invalid.');
  // Network metadata writes are not allowed to turn a newer UI edit into the captured baseline.
  // The ordinary save path will capture that edit in its own SQL transaction; the runner must
  // reload and retry instead of overwriting it with a stale journal revision.
  if (
    createShareableCloudSyncProjection(getPersistBlob(workspaceId), workspaceId) !==
    state.lastCapturedProjection
  ) {
    throw new Error('Cloud sync metadata is stale because local workspace data changed.');
  }
  const prior = await loadNativeWorkspaceSyncState(workspaceMetadata(workspaceId));
  // Loading the metadata is asynchronous. Recheck immediately before the native transaction so
  // an edit that landed during that read cannot be absorbed by this metadata-only write.
  if (
    createShareableCloudSyncProjection(getPersistBlob(workspaceId), workspaceId) !==
    state.lastCapturedProjection
  ) {
    throw new Error('Cloud sync metadata is stale because local workspace data changed.');
  }
  const next = { ...state, revision: state.revision + 1 };
  await persistCurrentStateNow(workspaceId, serializeCloudSyncLocalState(next), {
    expectedSyncRevision: prior === null ? 0 : state.revision,
  });
  return next;
}
