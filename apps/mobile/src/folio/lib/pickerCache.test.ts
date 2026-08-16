import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as FileSystem from 'expo-file-system/legacy';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const native = vi.hoisted(() => ({
  files: new Map<string, string>(),
  deleteFailures: new Set<string>(),
  copyFailure: false,
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: vi.fn(async () => undefined),
  copyAsync: vi.fn(async ({ from, to }: { from: string; to: string }) => {
    if (native.copyFailure) throw new Error('copy failed');
    const value = native.files.get(from);
    if (value === undefined) throw new Error('source missing');
    native.files.set(to, value);
  }),
  deleteAsync: vi.fn(async (uri: string) => {
    if (native.deleteFailures.has(uri)) throw new Error('delete failed');
    native.files.delete(uri);
  }),
  readDirectoryAsync: vi.fn(async (uri: string) =>
    [...native.files.keys()]
      .filter((candidate) => candidate.startsWith(uri))
      .map((candidate) => candidate.slice(uri.length))
      .filter((candidate) => !candidate.includes('/')),
  ),
}));

vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn(async () => Array.from({ length: 16 }, () => 0xab)),
}));

import { deleteOwnedPickerStage, stagePickerSource, sweepOwnedPickerStaging } from './pickerCache';

const owned = 'file:///cache/melo-import-staging/melo-import-abababababababababababababababab.pdf';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url).href), 'utf8');
}

beforeEach(() => {
  native.files.clear();
  native.deleteFailures.clear();
  native.copyFailure = false;
  vi.clearAllMocks();
});

describe('owned picker cache staging', () => {
  it('copies an app-cache picker file into the owned directory and deletes only that source', async () => {
    const source = 'file:///cache/DocumentPicker/statement.pdf';
    native.files.set(source, 'private statement');
    native.files.set('file:///cache/unrelated.txt', 'keep');

    await expect(
      stagePickerSource({
        uri: source,
        filename: '../statement.pdf',
        mediaType: 'application/pdf',
      }),
    ).resolves.toBe(owned);

    expect(native.files.get(owned)).toBe('private statement');
    expect(native.files.has(source)).toBe(false);
    expect(native.files.get('file:///cache/unrelated.txt')).toBe('keep');
  });

  it('copies content and external originals without deleting them', async () => {
    for (const source of ['content://media/receipt/1', 'file:///external/library/receipt.jpg']) {
      native.files.clear();
      native.files.set(source, 'receipt');
      const staged = await stagePickerSource({
        uri: source,
        filename: 'receipt.jpg',
        mediaType: 'image/jpeg',
      });
      expect(native.files.get(staged)).toBe('receipt');
      expect(native.files.get(source)).toBe('receipt');
    }
  });

  it('rejects traversal, nested paths and cache-prefix confusion at the deletion boundary', async () => {
    const unsafe = [
      'file:///cache/melo-import-staging/../unrelated.txt',
      'file:///cache/melo-import-staging/nested/melo-import-abababababababababababababababab.pdf',
      'file:///cache-other/melo-import-staging/melo-import-abababababababababababababababab.pdf',
      'content://cache/melo-import-staging/melo-import-abababababababababababababababab.pdf',
    ];
    for (const uri of unsafe) native.files.set(uri, 'keep');

    for (const uri of unsafe) await expect(deleteOwnedPickerStage(uri)).resolves.toBe(false);

    for (const uri of unsafe) expect(native.files.get(uri)).toBe('keep');
  });

  it('deletes an exact owned stage idempotently', async () => {
    native.files.set(owned, 'plaintext');
    await expect(deleteOwnedPickerStage(owned)).resolves.toBe(true);
    await expect(deleteOwnedPickerStage(owned)).resolves.toBe(true);
    expect(native.files.has(owned)).toBe(false);
  });

  it('leaves the original intact and removes a partial target when copying fails', async () => {
    const source = 'file:///cache/DocumentPicker/statement.pdf';
    native.files.set(source, 'private statement');
    native.files.set(owned, 'partial');
    native.copyFailure = true;

    await expect(
      stagePickerSource({ uri: source, filename: 'statement.pdf', mediaType: 'application/pdf' }),
    ).rejects.toThrow(/copy failed/);

    expect(native.files.get(source)).toBe('private statement');
    expect(native.files.has(owned)).toBe(false);
  });

  it('keeps a completed owned copy available when picker-source cleanup fails', async () => {
    const source = 'file:///cache/DocumentPicker/statement.pdf';
    native.files.set(source, 'private statement');
    native.deleteFailures.add(source);

    await expect(
      stagePickerSource({ uri: source, filename: 'statement.pdf', mediaType: 'application/pdf' }),
    ).resolves.toBe(owned);

    expect(native.files.get(source)).toBe('private statement');
    expect(native.files.get(owned)).toBe('private statement');
  });

  it('leaves a failed caller cleanup for the next startup sweep', async () => {
    native.files.set(owned, 'interrupted plaintext');
    native.deleteFailures.add(owned);

    await expect(deleteOwnedPickerStage(owned)).rejects.toThrow(/delete failed/);
    expect(native.files.get(owned)).toBe('interrupted plaintext');

    native.deleteFailures.delete(owned);
    await sweepOwnedPickerStaging();
    expect(native.files.has(owned)).toBe(false);
  });

  it('sweeps only helper-created owned files and leaves other cache entries untouched', async () => {
    native.files.set(owned, 'interrupted plaintext');
    native.files.set('file:///cache/melo-import-staging/notes.txt', 'keep');
    native.files.set('file:///cache/melo-evidence-view-old.pdf', 'keep');
    native.files.set('file:///cache/unrelated.txt', 'keep');

    await sweepOwnedPickerStaging();

    expect(native.files.has(owned)).toBe(false);
    expect(native.files.get('file:///cache/melo-import-staging/notes.txt')).toBe('keep');
    expect(native.files.get('file:///cache/melo-evidence-view-old.pdf')).toBe('keep');
    expect(native.files.get('file:///cache/unrelated.txt')).toBe('keep');
    expect(vi.mocked(FileSystem.readDirectoryAsync)).toHaveBeenCalledWith(
      'file:///cache/melo-import-staging/',
    );
  });

  it('wires cleanup to both consumers and runs the sweep before hydration', () => {
    const intake = readSource('../screens/IntakeScreen.tsx');
    const editTransaction = readSource('../sheets/EditTxnSheet.tsx');
    const restore = readSource('./restoreNative.ts');
    const appRoot = readSource('../../../app/index.tsx');

    expect(intake).toMatch(/finally\s*\{\s*await deleteOwnedPickerStage\(source\.uri\)/u);
    expect(editTransaction).toMatch(
      /finally\s*\{\s*await deleteOwnedPickerStage\(pickedSourceUri\)/u,
    );
    expect(restore).toMatch(/finally\s*\{\s*await deleteOwnedPickerStage\(stagedUri\)/u);
    expect(appRoot.indexOf('sweepOwnedPickerStaging()')).toBeLessThan(
      appRoot.indexOf('loadPersistedActiveWorkspace()'),
    );
  });
});
