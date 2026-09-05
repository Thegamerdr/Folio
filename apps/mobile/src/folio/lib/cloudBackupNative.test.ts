import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import {
  buildCloudBackupEnvelope,
  openCloudBackupEnvelope,
  recoveryCodeFromBytes,
  recoveryCodeToKey,
  serializeCloudBackupEnvelope,
  workspaceBackupRef,
} from './cloudBackup';
import { PERSONAL_WORKSPACE_ID } from './workspaceRoot';

const mocks = vi.hoisted(() => ({
  secrets: new Map<string, string>(),
  fetch: vi.fn(),
  apply: vi.fn(async () => ({ degraded: false })),
}));
vi.mock('expo-constants', () => ({
  default: {
    expoConfig: { extra: { EXPO_PUBLIC_MELO_CLOUD_VAULT_URL: 'https://backup.example.test' } },
  },
}));
vi.mock('expo/fetch', () => ({ fetch: mocks.fetch }));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: async (id: string) => mocks.secrets.get(id) ?? null,
  setItemAsync: async (id: string, value: string) => {
    mocks.secrets.set(id, value);
  },
  deleteItemAsync: async (id: string) => {
    mocks.secrets.delete(id);
  },
}));
vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (size: number) => randomBytes(size),
  CryptoDigestAlgorithm: { SHA256: 'sha256' },
  digestStringAsync: async (_: string, value: string) =>
    createHash('sha256').update(value).digest('hex'),
}));
vi.mock('@/folio/store', () => ({
  getPersistBlob: () =>
    JSON.stringify({ transactions: [], pots: [], currentBalance: { amount: 23 } }),
}));
vi.mock('@/folio/lib/restoreNative', () => ({ applyBusinessCloudRestore: mocks.apply }));
vi.mock('@/folio/lib/restore', async () => import('./restore'));
import { applyCloudRestore, createCloudBackup, stageCloudRestore } from './cloudBackupNative';

const ref = workspaceBackupRef(PERSONAL_WORKSPACE_ID);
const keyId = `melo.cloudBackupRecovery.v2.${ref}`;
const pendingId = `melo.cloudBackupRecovery.v2.pending.${ref}`;
const anchorId = `melo.cloudBackupRecovery.v2.anchor.${ref}`;
const oldCode = recoveryCodeFromBytes(new Uint8Array(32).fill(15));
const hash = (body: string) => createHash('sha256').update(body).digest('hex');
function envelope(code: string): string {
  return serializeCloudBackupEnvelope(
    buildCloudBackupEnvelope({
      plaintext: JSON.stringify({ transactions: [], pots: [] }),
      recoveryKey: recoveryCodeToKey(code)!,
      iv: new Uint8Array(12).fill(3),
      createdAt: '2026-09-05T12:00:00.000Z',
      deviceId: 'a'.repeat(32),
      workspaceRef: ref,
    }),
  );
}
beforeEach(() => {
  mocks.secrets.clear();
  mocks.fetch.mockReset();
  mocks.apply.mockClear();
});

describe('native backup recovery boundaries', () => {
  it('recovers a lost rotation response without losing the old-key anchor on its retry', async () => {
    mocks.secrets.set(keyId, oldCode);
    let current = envelope(oldCode),
      generation = 1,
      anchor: number | null = null,
      loseResponse = true;
    const rotations: (string | null)[] = [];
    mocks.fetch.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith('/content')) return new Response(current);
      if (init.method === 'GET')
        return Response.json({
          exists: true,
          revision: 0,
          generation,
          previousGeneration: null,
          anchorGeneration: anchor,
          generations: anchor === null ? 1 : 2,
          checksum: hash(current),
          createdAt: '2026-09-05T12:00:00.000Z',
          size: current.length,
          deviceId: 'a'.repeat(32),
        });
      const headers = new Headers(init.headers);
      rotations.push(headers.get('X-Melo-Key-Rotation'));
      expect(mocks.secrets.has(pendingId) || generation > 1).toBe(true);
      if (headers.get('X-Melo-Key-Rotation') === '1') anchor = generation;
      current = String(init.body);
      generation += 1;
      if (loseResponse) {
        loseResponse = false;
        throw new Error('synthetic response loss after server commit');
      }
      return Response.json({
        ok: true,
        checksum: hash(current),
        createdAt: '2026-09-05T12:00:00.000Z',
        generation,
        generations: 3,
        previousGeneration: generation - 1,
        anchorGeneration: anchor,
      });
    });
    await expect(
      createCloudBackup(PERSONAL_WORKSPACE_ID, 'synthetic-token', { rotateRecoveryCode: true }),
    ).rejects.toThrow();
    const pending = mocks.secrets.get(pendingId)!;
    expect(pending).toBeTruthy();
    expect(mocks.secrets.get(keyId)).toBe(oldCode);
    await createCloudBackup(PERSONAL_WORKSPACE_ID, 'synthetic-token', { rotateRecoveryCode: true });
    expect(rotations).toEqual(['1', null]);
    expect(anchor).toBe(1);
    expect(mocks.secrets.get(keyId)).toBe(pending);
    expect(mocks.secrets.get(anchorId)).toBe(oldCode);
    expect(openCloudBackupEnvelope(current, pending, ref).ok).toBe(true);
  });

  it('does not overwrite an unknown current key or treat a failed key probe as permission to upload', async () => {
    mocks.secrets.set(keyId, oldCode);
    const current = envelope(recoveryCodeFromBytes(new Uint8Array(32).fill(27)));
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith('/content')
        ? new Response(current)
        : Response.json({
            exists: true,
            revision: 0,
            generation: 8,
            generations: 2,
            previousGeneration: 7,
            anchorGeneration: null,
            checksum: hash(current),
            createdAt: '2026-09-05T12:00:00.000Z',
            size: current.length,
            deviceId: 'a'.repeat(32),
          }),
    );
    await expect(createCloudBackup(PERSONAL_WORKSPACE_ID, 'synthetic-token')).rejects.toThrow(
      /recovery code/,
    );
    expect(mocks.fetch.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true);
    mocks.fetch.mockRejectedValue(new Error('offline'));
    await expect(createCloudBackup(PERSONAL_WORKSPACE_ID, 'synthetic-token')).rejects.toThrow();
    expect(mocks.secrets.get(keyId)).toBe(oldCode);
  });

  it('keeps preview non-mutating and remembers only an explicitly applied current recovery key', async () => {
    const currentCode = recoveryCodeFromBytes(new Uint8Array(32).fill(44));
    mocks.secrets.set(keyId, currentCode);
    mocks.fetch.mockResolvedValue(new Response(envelope(oldCode)));
    const previous = await stageCloudRestore(PERSONAL_WORKSPACE_ID, 'synthetic-token', oldCode, {
      generation: 'previous',
    });
    await applyCloudRestore(PERSONAL_WORKSPACE_ID, previous);
    expect(mocks.secrets.get(keyId)).toBe(currentCode);
    mocks.fetch.mockResolvedValue(new Response(envelope(oldCode)));
    const current = await stageCloudRestore(PERSONAL_WORKSPACE_ID, 'synthetic-token', oldCode);
    expect(mocks.secrets.get(keyId)).toBe(currentCode);
    await applyCloudRestore(PERSONAL_WORKSPACE_ID, current);
    expect(mocks.secrets.get(keyId)).toBe(oldCode);
  });
});
