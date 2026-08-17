import type { WorkspaceId } from '@folio/domain';

import { getState, getWorkspaceRowRepository, resetToEmpty } from '@/folio/store';
import { clearLocalLedgerStorage } from '@/local/nativeLedgerStore';
import { clearQuarantinedNativeWorkspaceVaults } from '@/local/nativeWorkspaceStateStore';

import {
  clearPersistedLocalUserDataArtifacts,
  clearFutureSchemaWriteBlocksAfterLocalDeletion,
  persistEmptyWorkspaceSetAfterLocalClear,
  quiescePersistenceWrites,
} from './persist';
import { clearAllMeloNotifications } from './notifications';
import { EMPTY_NOTIFY_RUNTIME_STATE, saveNotifyRuntimeState } from './notifyRuntimeState';

export type LocalDataDeletionResult = Readonly<{
  complete: boolean;
  liveStateCleared: true;
  removedArtifacts: readonly string[];
  failedArtifacts: readonly string[];
  failedSurfaces: readonly LocalDataDeletionFailure[];
}>;

export type LocalDataDeletionSurface =
  | 'notifications'
  | 'native-ledger'
  | 'quarantined-vaults'
  | 'notification-runtime'
  | 'file-artifacts';

export type LocalDataDeletionFailure = Readonly<{
  surface: LocalDataDeletionSurface;
  workspaceId: string | null;
}>;

export class LocalDataDeletionError extends Error {
  readonly liveStateCleared: boolean;
  readonly failedSurfaces: readonly LocalDataDeletionFailure[];

  constructor(
    message: string,
    liveStateCleared: boolean,
    failedSurfaces: readonly LocalDataDeletionFailure[],
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'LocalDataDeletionError';
    this.liveStateCleared = liveStateCleared;
    this.failedSurfaces = failedSurfaces;
  }
}

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
  const failedSurfaces: LocalDataDeletionFailure[] = [];
  const recordFailure = (surface: LocalDataDeletionSurface, owner: WorkspaceId | null) => {
    failedSurfaces.push({ surface, workspaceId: owner === null ? null : String(owner) });
  };
  const attempt = async (
    surface: LocalDataDeletionSurface,
    owner: WorkspaceId | null,
    operation: () => Promise<void>,
  ) => {
    try {
      await operation();
    } catch {
      // A privacy wipe is best-effort across independent stores. Continue deleting every other
      // surface, commit the empty authoritative state, and report the exact residual scope so a
      // retry can finish it. Aborting at the first auxiliary failure leaves substantially more
      // personal data behind than the user requested.
      recordFailure(surface, owner);
    }
  };
  try {
    for (const workspace of snapshot.workspaces) {
      await attempt('notifications', workspace.id, () => clearAllMeloNotifications(workspace.id));
      await attempt('native-ledger', workspace.id, () => clearLocalLedgerStorage(workspace));
      await attempt('quarantined-vaults', workspace.id, () =>
        clearQuarantinedNativeWorkspaceVaults(workspace),
      );
      await attempt('notification-runtime', workspace.id, () =>
        saveNotifyRuntimeState(workspace.id, EMPTY_NOTIFY_RUNTIME_STATE),
      );
    }

    // Enumerate encrypted evidence while its metadata is still present. If directory enumeration is
    // unavailable, persist.ts can then fall back to the exact opaque filenames for every workspace;
    // resetting first would erase that only fallback and could strand an encrypted original.
    let artifacts = { removed: [] as readonly string[], failed: [] as readonly string[] };
    try {
      artifacts = await clearPersistedLocalUserDataArtifacts(workspaceId);
    } catch {
      recordFailure('file-artifacts', null);
    }

    // Mutate the live product only after auxiliary cleanup has had its chance. The store emits an
    // empty snapshot to every live UI/widget subscriber; no sample data is seeded. The normal
    // writer is quiesced so this explicit SQL commit cannot race its own reset notification.
    clearFutureSchemaWriteBlocksAfterLocalDeletion();
    resetToEmpty();
    try {
      await persistEmptyWorkspaceSetAfterLocalClear();
    } catch (cause: unknown) {
      throw new LocalDataDeletionError(
        'Melo emptied this session, but could not confirm the empty encrypted state on disk. Keep the app open and retry the local clear.',
        true,
        failedSurfaces,
        { cause },
      );
    }

    const complete = artifacts.failed.length === 0 && failedSurfaces.length === 0;

    return {
      complete,
      liveStateCleared: true,
      removedArtifacts: artifacts.removed,
      failedArtifacts: artifacts.failed,
      failedSurfaces,
    };
  } finally {
    resumePersistence();
  }
}
