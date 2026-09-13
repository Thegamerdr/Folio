import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDocumentAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  validateRestoreJson: vi.fn(),
  summarizeRestore: vi.fn(),
  reconcileEntitlements: vi.fn(),
  reconcileMissingEvidenceFiles: vi.fn(),
  restorePersistedWorkspacePayload: vi.fn(),
  getState: vi.fn(),
}));

vi.mock('expo-document-picker', () => ({ getDocumentAsync: mocks.getDocumentAsync }));
vi.mock('expo-file-system/legacy', () => ({
  EncodingType: { UTF8: 'utf8' },
  readAsStringAsync: mocks.readAsStringAsync,
}));
vi.mock('@/folio/store', () => ({ getState: mocks.getState }));
vi.mock('@/folio/lib/billing/entitlements', () => ({
  reconcileEntitlements: mocks.reconcileEntitlements,
}));
vi.mock('@/folio/lib/persist', () => ({
  recoverAndActivatePersistedBusinessWorkspace: vi.fn(),
  reconcileMissingEvidenceFiles: mocks.reconcileMissingEvidenceFiles,
  restorePersistedWorkspacePayload: mocks.restorePersistedWorkspacePayload,
}));
vi.mock('./restore', () => ({
  summarizeRestore: mocks.summarizeRestore,
  validateRestoreJson: mocks.validateRestoreJson,
}));

describe('native restore picker boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats picker cancellation as a no-op before reading or validating a file', async () => {
    mocks.getDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });
    const { pickRestoreFile } = await import('./restoreNative');

    await expect(pickRestoreFile('workspace_personal_local' as never)).resolves.toEqual({
      status: 'cancelled',
    });
    expect(mocks.readAsStringAsync).not.toHaveBeenCalled();
    expect(mocks.validateRestoreJson).not.toHaveBeenCalled();
  });

  it('rejects an accountant CSV before reading or applying it as a restore backup', async () => {
    mocks.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'file:///cache/accountant.csv', name: 'accountant.csv', mimeType: 'text/csv' },
      ],
    });
    const { pickRestoreFile } = await import('./restoreNative');

    await expect(pickRestoreFile('workspace_personal_local' as never)).resolves.toEqual({
      status: 'invalid',
      reason: 'accountant-csv',
    });
    expect(mocks.readAsStringAsync).not.toHaveBeenCalled();
    expect(mocks.validateRestoreJson).not.toHaveBeenCalled();
  });

  it('stages a valid picked export without applying it before confirmation', async () => {
    const raw = '{"kind":"folio-export"}';
    const parsed = { kind: 'folio-export' };
    mocks.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/backup.json', name: 'backup.json' }],
    });
    mocks.readAsStringAsync.mockResolvedValue(raw);
    mocks.validateRestoreJson.mockReturnValue({ ok: true, parsed });
    mocks.summarizeRestore.mockReturnValue({ transactions: 1, subs: 0, pots: 2, name: null });
    const { pickRestoreFile } = await import('./restoreNative');

    await expect(pickRestoreFile('workspace_personal_local' as never)).resolves.toEqual({
      status: 'staged',
      raw,
      fileName: 'backup.json',
      summary: { transactions: 1, subs: 0, pots: 2, name: null },
    });
    expect(mocks.validateRestoreJson).toHaveBeenCalledWith(raw, 'workspace_personal_local');
  });

  it('applies only a validated export, then runs evidence and entitlement reconciliation', async () => {
    const raw = '{"kind":"folio-export"}';
    mocks.validateRestoreJson.mockReturnValue({
      ok: true,
      parsed: {
        kind: 'folio-export',
        transactions: [{ id: 'txn-1', sourceEvidenceId: 'doc-1' }],
        evidenceDocuments: [{ id: 'doc-1' }],
      },
    });
    mocks.restorePersistedWorkspacePayload.mockResolvedValue({ degraded: false });
    mocks.getState.mockReturnValue({
      transactions: [{ id: 'txn-1' }],
      accounts: [{ id: 'account-1' }],
      evidenceDocuments: [],
    });
    const { applyRestore } = await import('./restoreNative');

    await expect(applyRestore(raw, 'workspace_personal_local' as never)).resolves.toMatchObject({
      workspaceId: 'workspace_personal_local',
      status: 'partial',
      degraded: false,
      attemptedTransactionCount: 1,
      restoredTransactionCount: 1,
      restoredAccountCount: 1,
      restoredOriginalFileCount: 0,
      missingOriginalFileCount: 1,
      unlinkedRecordCount: 1,
    });
    expect(mocks.restorePersistedWorkspacePayload).toHaveBeenCalledWith(
      raw,
      'workspace_personal_local',
    );
    expect(mocks.reconcileMissingEvidenceFiles).toHaveBeenCalledWith('workspace_personal_local');
    expect(mocks.reconcileEntitlements).toHaveBeenCalledOnce();
  });

  it('rejects an invalid export before any restore or reconciliation side effect', async () => {
    mocks.validateRestoreJson.mockReturnValue({ ok: false, reason: 'wrong-workspace' });
    const { applyRestore } = await import('./restoreNative');

    await expect(
      applyRestore('{"kind":"wrong"}', 'workspace_personal_local' as never),
    ).rejects.toThrow('This backup cannot replace the selected Melo workspace.');
    expect(mocks.restorePersistedWorkspacePayload).not.toHaveBeenCalled();
    expect(mocks.reconcileMissingEvidenceFiles).not.toHaveBeenCalled();
    expect(mocks.reconcileEntitlements).not.toHaveBeenCalled();
  });
});
