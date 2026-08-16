import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceId } from '@folio/domain';

const resetToEmpty = vi.fn();
const getWorkspaceRowRepository = vi.fn();
const getState = vi.fn();
const clearLocalLedgerStorage = vi.fn().mockResolvedValue(undefined);
const clearQuarantinedNativeWorkspaceVaults = vi.fn().mockResolvedValue(undefined);
const clearAllMeloNotifications = vi.fn().mockResolvedValue(undefined);
const saveNotifyRuntimeState = vi.fn().mockResolvedValue(undefined);
const clearPersistedLocalUserDataArtifacts = vi.fn();
const clearFutureSchemaWriteBlocksAfterLocalDeletion = vi.fn();
const persistEmptyWorkspaceSetAfterLocalClear = vi.fn().mockResolvedValue(undefined);
const resumePersistence = vi.fn();
const quiescePersistenceWrites = vi.fn(async () => resumePersistence);

vi.mock('@/folio/store', () => ({ getState, getWorkspaceRowRepository, resetToEmpty }));
vi.mock('@/local/nativeLedgerStore', () => ({ clearLocalLedgerStorage }));
vi.mock('@/local/nativeWorkspaceStateStore', () => ({ clearQuarantinedNativeWorkspaceVaults }));
vi.mock('./notifications', () => ({ clearAllMeloNotifications }));
vi.mock('./notifyRuntimeState', () => ({
  EMPTY_NOTIFY_RUNTIME_STATE: {
    version: 1,
    localDay: '',
    sentToday: 0,
    dangerSentToday: 0,
    lastSnapshot: null,
  },
  saveNotifyRuntimeState,
}));
vi.mock('./persist', () => ({
  clearPersistedLocalUserDataArtifacts,
  clearFutureSchemaWriteBlocksAfterLocalDeletion,
  persistEmptyWorkspaceSetAfterLocalClear,
  quiescePersistenceWrites,
}));

beforeEach(() => {
  vi.clearAllMocks();
  clearPersistedLocalUserDataArtifacts.mockResolvedValue({
    removed: ['folio.state.v3.bak.json', 'folio-export.json'],
    failed: [],
  });
});

const workspaceId = createWorkspaceId('workspace_personal_local');
const workspace = {
  id: workspaceId,
  kind: 'personal',
  name: 'Personal',
  baseCurrency: 'GBP',
  jurisdiction: 'GB',
  timeZone: 'Europe/London',
  version: { revision: 1, dataVersion: 'workspace:personal:v1' },
  encryptedSubkeyId: 'workspace-subkey-personal-v1',
  archivedAt: null,
};
const businessWorkspace = {
  ...workspace,
  id: createWorkspaceId('workspace_business_delete_test'),
  kind: 'business',
  name: 'Studio Ltd',
  version: { revision: 1, dataVersion: 'workspace:business:v1' },
  encryptedSubkeyId: 'workspace-subkey-business-delete-v1',
};

describe('local Melo data deletion', () => {
  it('clears notifications, the native ledger, the live store and old file artifacts', async () => {
    getState.mockReturnValue({ workspaces: [workspace, businessWorkspace] });
    const { clearLocalMeloData } = await import('./localDataDeletion');
    await expect(clearLocalMeloData(workspaceId)).resolves.toEqual({
      complete: true,
      removedArtifacts: ['folio.state.v3.bak.json', 'folio-export.json'],
      failedArtifacts: [],
    });
    expect(getWorkspaceRowRepository).toHaveBeenCalledWith(workspaceId);
    expect(quiescePersistenceWrites).toHaveBeenCalledTimes(1);
    expect(clearAllMeloNotifications).toHaveBeenCalledWith(workspaceId);
    expect(clearLocalLedgerStorage).toHaveBeenCalledWith(workspace);
    expect(clearLocalLedgerStorage).toHaveBeenCalledWith(businessWorkspace);
    expect(clearQuarantinedNativeWorkspaceVaults).toHaveBeenCalledWith(workspace);
    expect(clearQuarantinedNativeWorkspaceVaults).toHaveBeenCalledWith(businessWorkspace);
    expect(clearAllMeloNotifications).toHaveBeenCalledWith(businessWorkspace.id);
    expect(saveNotifyRuntimeState).toHaveBeenCalledWith(
      businessWorkspace.id,
      expect.objectContaining({ version: 1 }),
    );
    expect(saveNotifyRuntimeState).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({ version: 1 }),
    );
    expect(resetToEmpty).toHaveBeenCalledTimes(1);
    expect(clearFutureSchemaWriteBlocksAfterLocalDeletion).toHaveBeenCalledTimes(1);
    expect(clearPersistedLocalUserDataArtifacts).toHaveBeenCalledWith(workspaceId);
    expect(clearPersistedLocalUserDataArtifacts.mock.invocationCallOrder[0]!).toBeLessThan(
      resetToEmpty.mock.invocationCallOrder[0]!,
    );
    expect(persistEmptyWorkspaceSetAfterLocalClear).toHaveBeenCalledTimes(1);
    expect(resumePersistence).toHaveBeenCalledTimes(1);
  });

  it('reports an incomplete wipe when an old artifact could not be removed', async () => {
    getState.mockReturnValue({ workspaces: [workspace] });
    clearPersistedLocalUserDataArtifacts.mockResolvedValueOnce({
      removed: [],
      failed: ['folio.state.v3.unreadable.json'],
    });
    const { clearLocalMeloData } = await import('./localDataDeletion');
    await expect(clearLocalMeloData(workspaceId)).resolves.toEqual(
      expect.objectContaining({
        complete: false,
        failedArtifacts: ['folio.state.v3.unreadable.json'],
      }),
    );
    expect(clearFutureSchemaWriteBlocksAfterLocalDeletion).not.toHaveBeenCalled();
    expect(resetToEmpty).not.toHaveBeenCalled();
    expect(persistEmptyWorkspaceSetAfterLocalClear).not.toHaveBeenCalled();
  });
});
