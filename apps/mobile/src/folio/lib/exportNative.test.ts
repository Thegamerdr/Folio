import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeAsStringAsync: vi.fn(),
  deleteAsync: vi.fn(),
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
  getState: vi.fn(),
  buildExport: vi.fn(),
}));

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: mocks.writeAsStringAsync,
  deleteAsync: mocks.deleteAsync,
}));
vi.mock('expo-sharing', () => ({
  isAvailableAsync: mocks.isAvailableAsync,
  shareAsync: mocks.shareAsync,
}));
vi.mock('@/folio/store', () => ({ getState: mocks.getState }));
vi.mock('./export', () => ({ buildExport: mocks.buildExport }));

describe('native export handoff boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getState.mockReturnValue({
      activeWorkspaceId: 'workspace_personal_local',
      workspaces: [{ id: 'workspace_personal_local', kind: 'personal', archivedAt: null }],
    });
    mocks.buildExport.mockReturnValue({
      json: '{"transactions":[]}',
      csvs: { 'records.csv': 'x' },
    });
    mocks.writeAsStringAsync.mockResolvedValue(undefined);
    mocks.deleteAsync.mockResolvedValue(undefined);
    mocks.isAvailableAsync.mockResolvedValue(true);
  });

  it('removes files already written when generation fails part-way', async () => {
    mocks.writeAsStringAsync
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('disk full'));
    const { runExport } = await import('./exportNative');

    await expect(runExport('workspace_personal_local' as never)).rejects.toThrow('disk full');
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file:///docs/melo-personal-export.json', {
      idempotent: true,
    });
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file:///docs/melo-personal-records.csv', {
      idempotent: true,
    });
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });

  it('cleans a URI even when its native write rejects before resolving', async () => {
    mocks.writeAsStringAsync.mockRejectedValueOnce(new Error('partial write'));
    const { runExport } = await import('./exportNative');

    await expect(runExport('workspace_personal_local' as never)).rejects.toThrow('partial write');
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file:///docs/melo-personal-export.json', {
      idempotent: true,
    });
  });

  it('classifies availability failure after generation as a failed handoff', async () => {
    mocks.isAvailableAsync.mockRejectedValueOnce(new Error('sharing service unavailable'));
    const { ExportHandoffError, runExport } = await import('./exportNative');

    await expect(runExport('workspace_personal_local' as never)).rejects.toBeInstanceOf(
      ExportHandoffError,
    );
    expect(mocks.deleteAsync).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });
});
