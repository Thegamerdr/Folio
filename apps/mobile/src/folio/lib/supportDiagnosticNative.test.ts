import { beforeEach, describe, expect, it, vi } from 'vitest';

const fileSystem = vi.hoisted(() => ({
  cacheDirectory: 'file:///cache/',
  deleteAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
  EncodingType: { UTF8: 'utf8' },
}));
const sharing = vi.hoisted(() => ({
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}));

vi.mock('expo-constants', () => ({
  default: {
    appOwnership: 'standalone',
    executionEnvironment: 'standalone',
    expoConfig: { version: '1.0.0' },
    isDevice: true,
    nativeAppVersion: '1.0.0',
    nativeBuildVersion: '42',
  },
}));
vi.mock('expo-file-system/legacy', () => fileSystem);
vi.mock('expo-sharing', () => sharing);
vi.mock('react-native', () => ({ Platform: { OS: 'android', Version: 35 } }));

import { shareSupportDiagnosticBundle } from './supportDiagnosticNative';

const safeBundle = {
  generatedAt: '2026-08-17T09:30:00.000Z',
  jsonText: '{"schema":"melo-support-diagnostic-v1"}',
  redacted: { schema: 'melo-support-diagnostic-v1' },
  redactedPaths: [],
  safeForExport: true,
} as const;

describe('native support diagnostic sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fileSystem.cacheDirectory = 'file:///cache/';
    fileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
    fileSystem.writeAsStringAsync.mockResolvedValue(undefined);
    fileSystem.deleteAsync.mockResolvedValue(undefined);
    sharing.isAvailableAsync.mockResolvedValue(true);
    sharing.shareAsync.mockResolvedValue(undefined);
  });

  it('shares the exact previewed bytes and removes the temporary plaintext directory', async () => {
    await shareSupportDiagnosticBundle(safeBundle);

    expect(fileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringMatching(/melo-support-report\.json$/),
      safeBundle.jsonText,
      { encoding: 'utf8' },
    );
    expect(sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringMatching(/melo-support-report\.json$/),
      expect.objectContaining({ mimeType: 'application/json' }),
    );
    expect(fileSystem.deleteAsync).toHaveBeenCalledWith(
      expect.stringMatching(/melo-support-\d+\/$/),
      { idempotent: true },
    );
  });

  it('writes nothing when the privacy gate is not green', async () => {
    await expect(
      shareSupportDiagnosticBundle({ ...safeBundle, safeForExport: false }),
    ).rejects.toThrow('privacy check');

    expect(fileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    expect(fileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    expect(sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('writes nothing when the device cannot open a share sheet', async () => {
    sharing.isAvailableAsync.mockResolvedValue(false);

    await expect(shareSupportDiagnosticBundle(safeBundle)).rejects.toThrow(
      'Sharing is unavailable',
    );
    expect(fileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    expect(fileSystem.writeAsStringAsync).not.toHaveBeenCalled();
  });
});
