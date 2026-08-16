import type { WorkspaceId } from '@folio/domain';

import { getState, getWorkspaceRowRepository, resetToEmpty } from '@/folio/store';
import { clearLocalLedgerStorage } from '@/local/nativeLedgerStore';
import { clearQuarantinedNativeWorkspaceVaults } from '@/local/nativeWorkspaceStateStore';

import {
  clearPersistedLocalUserDataArtifacts,
  persistEmptyWorkspaceSetAfterLocalClear,
  quiescePersistenceWrites,
} from './persist';
import { clearAllMeloNotifications } from './notifications';
import { EMPTY_NOTIFY_RUNTIME_STATE, saveNotifyRuntimeState } from './notifyRuntimeState';

export type LocalDataDeletionResult = Readonly<{
  complete: boolean;
  removedArtifacts: readonly string[];
  failedArtifacts: readonly string[];
}>;

/**
 * Clear local money/history and locally retained setup identity across every app-owned surface. This
 * deliberately does not delete the user's Clerk account, encrypted cloud backup, remote bank
 * consent, purchases or non-identifying security/theme preferences; those have separate controls
 * and must never be silently coupled to a device wipe.
 */
export async function clearLocalMeloData(
  workspaceId: WorkspaceId,
): Promise<LocalDataDeletionResult> {
  // Validate the complete active partition before any destructive side effect begins.
  getWorkspaceRowRepository(workspaceId);
  const snapshot = getState();
  const requested = snapshot.workspaces.find(
    (candidate) => String(candidate.id) === String(workspaceId),
  );
  if (requested === undefined || requested.archivedAt !== null) {
    throw new Error(`Workspace ${String(workspaceId)} is unavailable for local deletion.`);
  }
  const resumePersistence = await quiescePersistenceWrites();
  try {
    for (const workspace of snapshot.workspaces) {
      await clearAllMeloNotifications(workspace.id);
      await clearLocalLedgerStorage(workspace);
      await clearQuarantinedNativeWorkspaceVaults(workspace);
      await saveNotifyRuntimeState(workspace.id, EMPTY_NOTIFY_RUNTIME_STATE);
    }

    // Enumerate encrypted evidence while its metadata is still present. If directory enumeration is
    // unavailable, persist.ts can then fall back to the exact opaque filenames for every workspace;
    // resetting first would erase that only fallback and could strand an encrypted original.
    const artifacts = await clearPersistedLocalUserDataArtifacts(workspaceId);

    // Mutate the live product only after auxiliary cleanup has had its chance. The store emits an
    // empty snapshot to every live UI/widget subscriber; no sample data is seeded. The normal
    // writer is quiesced so this explicit SQL commit cannot race its own reset notification.
    resetToEmpty();
    await persistEmptyWorkspaceSetAfterLocalClear();

    return {
      complete: artifacts.failed.length === 0,
      removedArtifacts: artifacts.removed,
      failedArtifacts: artifacts.failed,
    };
  } finally {
    resumePersistence();
  }
}
