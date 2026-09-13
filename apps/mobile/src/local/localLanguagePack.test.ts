import { beforeEach, describe, expect, it, vi } from 'vitest';
const harness = vi.hoisted(() => ({
  files: new Set<string>(),
  initialize: vi.fn(),
  verify: vi.fn(),
  moves: vi.fn(),
  download: vi.fn(),
}));
vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/com.folio.v2.greenfield/files/',
  getInfoAsync: async (uri: string) => ({ exists: harness.files.has(uri) }),
  deleteAsync: async (uri: string) => {
    harness.files.delete(uri);
  },
  makeDirectoryAsync: async () => undefined,
  createDownloadResumable: (url: string, uri: string) => ({
    downloadAsync: async () => {
      harness.download(url, uri);
      harness.files.add(uri);
      return { status: 200, uri };
    },
  }),
  moveAsync: async (value: { from: string; to: string }) => {
    harness.moves(value);
    harness.files.delete(value.from);
    harness.files.add(value.to);
  },
}));
vi.mock('../../modules/folio-local-language', () => ({
  getLocalLanguageStatus: () => ({ available: true, initialized: false }),
  closeLocalLanguageModel: async () => undefined,
  verifyLocalLanguageModel: (uri: string, sha: string, bytes: number) =>
    harness.verify(uri, sha, bytes),
  initializeLocalLanguageModel: (uri: string, sha: string, bytes: number) =>
    harness.initialize(uri, sha, bytes),
}));
import { installLocalLanguagePack, MELO_LOCAL_LANGUAGE_PACK } from './localLanguagePack';

beforeEach(() => {
  harness.files.clear();
  harness.moves.mockReset();
  harness.download.mockReset();
  harness.initialize
    .mockReset()
    .mockResolvedValue({ kind: 'ready', modelBytes: MELO_LOCAL_LANGUAGE_PACK.bytes });
  harness.verify
    .mockReset()
    .mockImplementation(async (uri: string, sha: string, bytes: number) =>
      harness.files.has(uri) &&
      uri.endsWith('.litertlm') &&
      sha === MELO_LOCAL_LANGUAGE_PACK.sha256 &&
      bytes === MELO_LOCAL_LANGUAGE_PACK.bytes
        ? { kind: 'valid' }
        : { kind: 'invalid-model', message: 'Invalid file or signature.' },
    );
});
describe('Private language pack installation', () => {
  it('verifies the downloaded temporary file under a native-compatible suffix before promoting or initializing it', async () => {
    const result = await installLocalLanguagePack();
    expect(result.kind).toBe('ready');
    const temporary = harness.download.mock.calls[0]![1];
    expect(temporary).toMatch(/\.partial\.litertlm$/);
    expect(harness.verify).toHaveBeenCalledWith(
      temporary,
      MELO_LOCAL_LANGUAGE_PACK.sha256,
      MELO_LOCAL_LANGUAGE_PACK.bytes,
    );
    expect(harness.moves).toHaveBeenCalledWith({
      from: temporary,
      to: temporary.replace('.partial.litertlm', ''),
    });
    expect(harness.verify.mock.invocationCallOrder[0]).toBeLessThan(
      harness.moves.mock.invocationCallOrder[0]!,
    );
    expect(harness.moves.mock.invocationCallOrder[0]).toBeLessThan(
      harness.initialize.mock.invocationCallOrder[0]!,
    );
  });
  it('does not promote or execute an unverified download', async () => {
    harness.verify.mockResolvedValue({ kind: 'invalid-model', message: 'Signature mismatch.' });
    expect(await installLocalLanguagePack()).toEqual({
      kind: 'error',
      message: 'Signature mismatch.',
    });
    expect(harness.moves).not.toHaveBeenCalled();
    expect(harness.initialize).not.toHaveBeenCalled();
    expect(harness.files.size).toBe(0);
  });
});
