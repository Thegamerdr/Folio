import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceId } from '@folio/domain';

const restoreBackupFromBlob = vi.fn();
const hydrateFromBlob = vi.fn();
const getPersistBlob = vi.fn();
const reconcileEntitlements = vi.fn();
const reconcileMissingEvidenceFiles = vi.fn();
const persistCurrentStateNow = vi.fn();
const resumePersistence = vi.fn();
const quiescePersistenceWrites = vi.fn(async () => resumePersistence);

vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }));
vi.mock('expo-file-system/legacy', () => ({
  EncodingType: { UTF8: 'utf8' },
  readAsStringAsync: vi.fn(),
}));
vi.mock('@/folio/store', () => ({
  getPersistBlob,
  hydrateFromBlob,
  restoreBackupFromBlob,
}));
vi.mock('@/folio/lib/billing/entitlements', () => ({ reconcileEntitlements }));
vi.mock('@/folio/lib/persist', () => ({
  persistCurrentStateNow,
  quiescePersistenceWrites,
  reconcileMissingEvidenceFiles,
}));
vi.mock('@/folio/lib/pickerCache', () => ({
  deleteOwnedPickerStage: vi.fn(),
  stagePickerSource: vi.fn(),
}));

const workspaceId = createWorkspaceId('workspace_personal_restore_native');
const validBackup = JSON.stringify({
  schemaVersion: 11,
  workspaces: [{ id: workspaceId }],
  activeWorkspaceId: workspaceId,
  dataWorkspaceId: workspaceId,
  currentBalance: 1200,
  transactions: [],
});

describe('native restore durability boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPersistBlob.mockReturnValue(
      JSON.stringify({
        schemaVersion: 11,
        activeWorkspaceId: workspaceId,
        dataWorkspaceId: workspaceId,
        currentBalance: 900,
        transactions: [],
      }),
    );
    restoreBackupFromBlob.mockReturnValue({ status: 'applied' });
    hydrateFromBlob.mockReturnValue({ status: 'applied' });
    reconcileMissingEvidenceFiles.mockResolvedValue(undefined);
    reconcileEntitlements.mockResolvedValue(undefined);
    persistCurrentStateNow.mockResolvedValue(undefined);
  });

  it('does not report success until the restored partition is durably committed', async () => {
    const { applyRestore } = await import('./restoreNative');

    await expect(applyRestore(validBackup, workspaceId)).resolves.toEqual({
      applied: true,
      durable: true,
    });
    expect(quiescePersistenceWrites).toHaveBeenCalledTimes(1);
    expect(restoreBackupFromBlob).toHaveBeenCalledWith(validBackup, workspaceId);
    expect(reconcileMissingEvidenceFiles).toHaveBeenCalledWith(workspaceId);
    expect(reconcileEntitlements).toHaveBeenCalledTimes(1);
    expect(persistCurrentStateNow).toHaveBeenCalledWith(workspaceId);
    expect(resumePersistence).toHaveBeenCalledTimes(1);
  });

  it('leaves the current state untouched when hydration cannot safely apply the backup', async () => {
    restoreBackupFromBlob.mockReturnValueOnce({ status: 'degraded' });
    const { applyRestore } = await import('./restoreNative');

    await expect(applyRestore(validBackup, workspaceId)).rejects.toMatchObject({
      name: 'RestoreApplyError',
      previousLiveStateRestored: true,
    });
    expect(persistCurrentStateNow).not.toHaveBeenCalled();
    expect(hydrateFromBlob).not.toHaveBeenCalled();
    expect(resumePersistence).toHaveBeenCalledTimes(1);
  });

  it('rolls the live store back if the restored SQLCipher commit fails', async () => {
    persistCurrentStateNow.mockRejectedValueOnce(new Error('disk full'));
    const previous = getPersistBlob();
    const { applyRestore } = await import('./restoreNative');

    await expect(applyRestore(validBackup, workspaceId)).rejects.toMatchObject({
      name: 'RestoreApplyError',
      previousLiveStateRestored: true,
    });
    expect(hydrateFromBlob).toHaveBeenCalledWith(previous, workspaceId);
    expect(resumePersistence).toHaveBeenCalledTimes(1);
  });

  it('reports when even the in-memory rollback cannot be verified', async () => {
    persistCurrentStateNow.mockRejectedValueOnce(new Error('keystore unavailable'));
    hydrateFromBlob.mockReturnValueOnce({ status: 'malformed' });
    const { applyRestore } = await import('./restoreNative');

    await expect(applyRestore(validBackup, workspaceId)).rejects.toMatchObject({
      name: 'RestoreApplyError',
      previousLiveStateRestored: false,
    });
  });
});
