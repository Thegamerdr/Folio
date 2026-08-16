import { base64 } from '@scure/base';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as FileSystem from 'expo-file-system/legacy';

const native = vi.hoisted(() => ({
  files: new Map<string, string>(),
  contentUris: new Map<string, string>(),
  opened: [] as Array<{
    action: string;
    bytes: string;
    params: Record<string, unknown>;
  }>,
  shared: [] as Array<{ uri: string; bytes: string; options: Record<string, unknown> }>,
  sharingAvailable: true,
  appStateListeners: new Set<(state: string) => void>(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn((_event: string, listener: (state: string) => void) => {
      native.appStateListeners.add(listener);
      return { remove: () => native.appStateListeners.delete(listener) };
    }),
  },
}));

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  readAsStringAsync: vi.fn(async (uri: string) => {
    const value = native.files.get(uri);
    if (value === undefined) throw new Error(`Missing file: ${uri}`);
    return value;
  }),
  writeAsStringAsync: vi.fn(async (uri: string, value: string) => {
    native.files.set(uri, value);
  }),
  deleteAsync: vi.fn(async (uri: string) => {
    native.files.delete(uri);
  }),
  moveAsync: vi.fn(async ({ from, to }: { from: string; to: string }) => {
    const value = native.files.get(from);
    if (value === undefined) throw new Error(`Missing file: ${from}`);
    native.files.set(to, value);
    native.files.delete(from);
  }),
  readDirectoryAsync: vi.fn(async (uri: string) =>
    [...native.files.keys()]
      .filter((candidate) => candidate.startsWith(uri))
      .map((candidate) => candidate.slice(uri.length))
      .filter((candidate) => !candidate.includes('/')),
  ),
  getContentUriAsync: vi.fn(async (uri: string) => {
    const contentUri = `content://melo.vault/${encodeURIComponent(uri)}`;
    native.contentUris.set(contentUri, uri);
    return contentUri;
  }),
}));

vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn(async (length: number) =>
    Array.from({ length }, () => (length === 16 ? 0xab : 0x07)),
  ),
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(async () => native.sharingAvailable),
  shareAsync: vi.fn(async (uri: string, options: Record<string, unknown>) => {
    native.shared.push({ uri, bytes: native.files.get(uri) ?? '', options });
  }),
}));

vi.mock('expo-intent-launcher', () => ({
  startActivityAsync: vi.fn(async (action: string, params: Record<string, unknown>) => {
    const fileUri = native.contentUris.get(String(params.data)) ?? '';
    native.opened.push({ action, bytes: native.files.get(fileUri) ?? '', params });
    for (const listener of native.appStateListeners) listener('background');
    return { resultCode: 0 };
  }),
}));

vi.mock('./vaultKey', () => ({
  getVaultKey: vi.fn(async () => Uint8Array.from({ length: 32 }, () => 0x19)),
}));

import {
  clearEvidenceViewCache,
  deleteEvidenceDocumentFile,
  evidenceRetentionFailureCopy,
  openEvidenceDocument,
  retainEvidenceDocument,
} from './documentVault';
import { workspaceEvidenceFilename } from './workspacePartition';
import { createPersonalWorkspaceRoot } from './workspaceRoot';

const workspace = createPersonalWorkspaceRoot().workspaces[0]!;
const sourceBytes = new TextEncoder().encode('private statement bytes\naccount 12345678');
const sourceUri = 'file:///picker/current-account-june.pdf';

beforeEach(() => {
  native.files.clear();
  native.contentUris.clear();
  native.opened.length = 0;
  native.shared.length = 0;
  native.sharingAvailable = true;
  native.appStateListeners.clear();
  native.files.set(sourceUri, base64.encode(sourceBytes));
});

describe('encrypted document vault', () => {
  it('retains an original as opaque workspace-bound ciphertext and metadata only', async () => {
    const document = await retainEvidenceDocument({
      workspace,
      source: {
        uri: sourceUri,
        filename: 'current-account-june.pdf',
        mediaType: 'application/pdf',
        byteSize: sourceBytes.byteLength,
        storageState: 'copied_to_app_cache',
      },
      sourceType: 'document',
      extractionStatus: 'read',
    });

    expect(document).toMatchObject({
      id: 'evidence_abababababababababababababababab',
      workspaceId: workspace.id,
      filename: 'current-account-june.pdf',
      mediaType: 'application/pdf',
      byteSize: sourceBytes.byteLength,
      storageState: 'encrypted-device-vault',
    });
    expect(document).not.toHaveProperty('uri');

    const encryptedUri = `file:///documents/${workspaceEvidenceFilename(workspace.id, document.id)}`;
    const ciphertext = native.files.get(encryptedUri);
    expect(ciphertext).toMatch(/^FVB1:/u);
    expect(ciphertext).not.toContain(base64.encode(sourceBytes));
    expect(ciphertext).not.toContain('current-account-june.pdf');
    expect([...native.files.keys()].some((uri) => uri.endsWith('.tmp'))).toBe(false);
  });

  it('authenticates, opens a short-lived plaintext copy, then deletes it on return', async () => {
    native.files.set('file:///cache/melo-evidence-view-interrupted.pdf', 'stale-plaintext');
    const document = await retainEvidenceDocument({
      workspace,
      source: {
        uri: sourceUri,
        filename: 'current-account-june.pdf',
        mediaType: 'application/pdf',
        byteSize: sourceBytes.byteLength,
        storageState: 'copied_to_app_cache',
      },
      sourceType: 'document',
      extractionStatus: 'read',
    });

    await openEvidenceDocument(workspace, document);

    expect(native.opened).toHaveLength(1);
    expect(base64.decode(native.opened[0]!.bytes)).toEqual(sourceBytes);
    expect(native.opened[0]).toMatchObject({
      action: 'android.intent.action.VIEW',
      params: {
        flags: 1,
        type: 'application/pdf',
      },
    });
    expect(native.shared).toHaveLength(0);
    expect([...native.files.keys()].some((uri) => uri.includes('melo-evidence-view-'))).toBe(true);

    for (const listener of native.appStateListeners) listener('active');
    await Promise.resolve();
    expect([...native.files.keys()].some((uri) => uri.includes('melo-evidence-view-'))).toBe(false);
  });

  it('rejects a ciphertext swapped onto a different evidence row before opening it', async () => {
    const document = await retainEvidenceDocument({
      workspace,
      source: {
        uri: sourceUri,
        filename: 'current-account-june.pdf',
        mediaType: 'application/pdf',
        byteSize: sourceBytes.byteLength,
        storageState: 'copied_to_app_cache',
      },
      sourceType: 'document',
      extractionStatus: 'read',
    });
    const swapped = {
      ...document,
      id: 'evidence_cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
    };
    const originalUri = `file:///documents/${workspaceEvidenceFilename(workspace.id, document.id)}`;
    const swappedUri = `file:///documents/${workspaceEvidenceFilename(workspace.id, swapped.id)}`;
    native.files.set(swappedUri, native.files.get(originalUri)!);

    await expect(openEvidenceDocument(workspace, swapped)).rejects.toThrow(/could not be verified/);
    expect(native.opened).toHaveLength(0);
    expect([...native.files.keys()].some((uri) => uri.includes('melo-evidence-view-'))).toBe(false);
  });

  it('clears plaintext leftovers without touching unrelated cache files', async () => {
    native.files.set('file:///cache/melo-evidence-view-old.pdf', 'plaintext');
    native.files.set('file:///cache/unrelated.txt', 'keep');

    await clearEvidenceViewCache();

    expect(native.files.has('file:///cache/melo-evidence-view-old.pdf')).toBe(false);
    expect(native.files.get('file:///cache/unrelated.txt')).toBe('keep');
  });

  it('deletes the opaque encrypted file and any temporary generation', async () => {
    const document = await retainEvidenceDocument({
      workspace,
      source: {
        uri: sourceUri,
        filename: 'current-account-june.pdf',
        mediaType: 'application/pdf',
        byteSize: sourceBytes.byteLength,
        storageState: 'copied_to_app_cache',
      },
      sourceType: 'document',
      extractionStatus: 'read',
    });
    const uri = `file:///documents/${workspaceEvidenceFilename(workspace.id, document.id)}`;
    native.files.set(`${uri}.tmp`, 'interrupted-encrypted-generation');

    await deleteEvidenceDocumentFile(workspace, document);

    expect(native.files.has(uri)).toBe(false);
    expect(native.files.has(`${uri}.tmp`)).toBe(false);
  });

  it('removes partial encrypted generations when final promotion fails', async () => {
    vi.mocked(FileSystem.moveAsync).mockRejectedValueOnce(new Error('ENOSPC'));

    await expect(
      retainEvidenceDocument({
        workspace,
        source: {
          uri: sourceUri,
          filename: 'current-account-june.csv',
          mediaType: 'text/csv',
          byteSize: sourceBytes.byteLength,
          storageState: 'copied_to_app_cache',
        },
        sourceType: 'document',
        extractionStatus: 'read',
      }),
    ).rejects.toThrow(/ENOSPC/);

    const id = 'evidence_abababababababababababababababab';
    const uri = `file:///documents/${workspaceEvidenceFilename(workspace.id, id)}`;
    expect(native.files.has(uri)).toBe(false);
    expect(native.files.has(`${uri}.tmp`)).toBe(false);
  });

  it('fails deletion without pretending the encrypted original disappeared', async () => {
    const document = await retainEvidenceDocument({
      workspace,
      source: {
        uri: sourceUri,
        filename: 'current-account-june.pdf',
        mediaType: 'application/pdf',
        byteSize: sourceBytes.byteLength,
        storageState: 'copied_to_app_cache',
      },
      sourceType: 'document',
      extractionStatus: 'read',
    });
    const uri = `file:///documents/${workspaceEvidenceFilename(workspace.id, document.id)}`;
    vi.mocked(FileSystem.deleteAsync).mockRejectedValueOnce(new Error('EIO'));

    await expect(deleteEvidenceDocumentFile(workspace, document)).rejects.toThrow(/EIO/);
    expect(native.files.has(uri)).toBe(true);
  });
});

describe('evidence retention failure copy', () => {
  it('turns native ENOSPC detail into actionable storage guidance', () => {
    const reason = Object.assign(
      new Error(
        "Call to function 'ExponentFileSystem.writeAsStringAsync' was rejected: write failed: ENOSPC (No space left on device)",
      ),
      { code: 'ERR_FILESYSTEM_CANNOT_WRITE' },
    );

    expect(evidenceRetentionFailureCopy(reason)).toEqual({
      title: 'Not enough storage',
      body: 'Melo could not save an encrypted copy. Free some space, then choose the file again. Nothing was added.',
    });
  });

  it('does not expose an unknown native exception to the user', () => {
    const copy = evidenceRetentionFailureCopy(
      new Error('java.lang.IllegalStateException from ExpoFileSystem internals'),
    );

    expect(copy.title).toBe('Could not save this source');
    expect(copy.body).not.toMatch(/java|expo|exception/iu);
    expect(copy.body).toContain('Nothing was added.');
  });

  it('keeps empty and oversized file failures specific', () => {
    expect(evidenceRetentionFailureCopy(new Error('The selected source file is empty.'))).toEqual({
      title: 'This file is empty',
      body: 'Choose another file. Nothing was added.',
    });
    expect(
      evidenceRetentionFailureCopy(
        new Error('The selected source is larger than the 12 MB encrypted-file limit.'),
      ),
    ).toEqual({
      title: 'This file is too large',
      body: "Choose a file under Melo's 12 MB encrypted-file limit. Nothing was added.",
    });
  });
});
