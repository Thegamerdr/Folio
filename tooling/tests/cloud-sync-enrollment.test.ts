import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@folio/domain';
import {
  SyncWorkspace,
  type SyncWorkspaceStorage,
} from '../../services/cloud-vault/src/sync-workspace';

const h = vi.hoisted(() => ({
  phone: 'a'.repeat(32),
  secrets: new Map<string, string>(),
  dispatch: null as null | ((url: string, init: RequestInit) => Promise<Response>),
  loseResponse: '',
}));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
  getItemAsync: async (key: string) => h.secrets.get(`${h.phone}:${key}`) ?? null,
  setItemAsync: async (key: string, value: string) => {
    h.secrets.set(`${h.phone}:${key}`, value);
  },
  deleteItemAsync: async (key: string) => {
    h.secrets.delete(`${h.phone}:${key}`);
  },
}));
vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (length: number) => crypto.getRandomValues(new Uint8Array(length)),
}));
vi.mock('../../apps/mobile/src/folio/lib/cloudBackupNative', () => ({
  getCloudVaultUrl: () => 'https://sync.test',
  getOrCreateCloudDeviceId: async () => h.phone,
}));
vi.mock('expo/fetch', () => ({
  fetch: (url: string, init: RequestInit) => h.dispatch!(url, init),
}));

import {
  approveCloudSyncDevice,
  ensureCloudSyncEnrollment,
  loadEpochKey,
  revokeCloudSyncDevice,
} from '../../apps/mobile/src/folio/lib/cloudSyncEnrollmentNative';
import { deriveCloudSyncScope } from '../../apps/mobile/src/folio/lib/cloudSyncTransportNative';
import { getOrCreateCloudSyncIdentity } from '../../apps/mobile/src/folio/lib/cloudSyncSigning';

class Storage implements SyncWorkspaceStorage {
  values = new Map<string, unknown>();
  tail = Promise.resolve();
  async get<T>(key: string): Promise<T | undefined> {
    return structuredClone(this.values.get(key)) as T | undefined;
  }
  async put<T>(key: string, value: T): Promise<void> {
    this.values.set(key, structuredClone(value));
  }
  async delete(key: string): Promise<boolean> {
    return this.values.delete(key);
  }
  async deleteAll(): Promise<void> {
    this.values.clear();
  }
  async list<T>(options: {
    prefix: string;
    startAfter?: string;
    limit?: number;
  }): Promise<Map<string, T>> {
    return new Map(
      [...this.values.entries()]
        .filter(([key]) => key.startsWith(options.prefix) && key > (options.startAfter ?? ''))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .slice(0, options.limit)
        .map(([key, value]) => [key, structuredClone(value) as T]),
    );
  }
  transaction<T>(work: (storage: SyncWorkspaceStorage) => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      const before = structuredClone(this.values);
      try {
        return await work(this);
      } catch (error) {
        this.values = before;
        throw error;
      }
    });
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
const WORKSPACE = 'workspace_personal_local' as WorkspaceId;
const A = 'a'.repeat(32);
const B = 'b'.repeat(32);
const token = (subject: string) => `fixture.${btoa(JSON.stringify({ sub: subject }))}.fixture`;
const TOKEN = token('synthetic-owner');

beforeEach(() => {
  h.phone = A;
  h.secrets.clear();
  h.loseResponse = '';
  const handlers = new Map<string, SyncWorkspace>();
  h.dispatch = async (url, init) => {
    const headers = new Headers(init.headers);
    const account = headers.get('authorization');
    const id = `${account}:${headers.get('x-melo-workspace-ref')}`;
    let handler = handlers.get(id);
    if (!handler) {
      handler = new SyncWorkspace(new Storage());
      handlers.set(id, handler);
    }
    // This fixture exercises the real native signer, transport, wrapping and coordinator.
    // Account JWT verification is intentionally outside this in-process integration test.
    const response = await handler.fetch(new Request(url, init));
    if (`${init.method}:${new URL(url).pathname}` === h.loseResponse) {
      h.loseResponse = '';
      throw new TypeError('Injected response loss after durable service commit.');
    }
    return response;
  };
});

describe('native enrollment through signed sync authority', () => {
  it('recovers first enrollment response loss, approves a second phone and isolates another account key', async () => {
    h.loseResponse = 'POST:/v1/sync/devices';
    await expect(ensureCloudSyncEnrollment(WORKSPACE, TOKEN)).rejects.toThrow('response loss');
    const first = await ensureCloudSyncEnrollment(WORKSPACE, TOKEN);
    expect(first.enrolled).toBe(true);
    h.phone = B;
    expect((await ensureCloudSyncEnrollment(WORKSPACE, TOKEN)).status).toBe('pending');
    const identity = await getOrCreateCloudSyncIdentity(B);
    h.phone = A;
    await approveCloudSyncDevice({
      workspaceId: WORKSPACE,
      bearerToken: TOKEN,
      ...identity,
      label: 'Synthetic tablet',
    });
    h.phone = B;
    expect((await ensureCloudSyncEnrollment(WORKSPACE, TOKEN)).syncKey).toEqual(first.syncKey);
    h.phone = A;
    const other = await ensureCloudSyncEnrollment(WORKSPACE, token('another-owner'));
    expect(other.syncKey).not.toEqual(first.syncKey);
    expect(await loadEpochKey(deriveCloudSyncScope(WORKSPACE, TOKEN), 1)).toEqual(first.syncKey);
  });

  it('recovers a lost atomic revoke response and keeps the old epoch decryptable without accepting the revoked phone', async () => {
    const first = await ensureCloudSyncEnrollment(WORKSPACE, TOKEN);
    h.phone = B;
    const identity = await getOrCreateCloudSyncIdentity(B);
    h.phone = A;
    await approveCloudSyncDevice({
      workspaceId: WORKSPACE,
      bearerToken: TOKEN,
      ...identity,
      label: 'Synthetic tablet',
    });
    h.loseResponse = `POST:/v1/sync/devices/${B}/revoke`;
    await expect(
      revokeCloudSyncDevice({ workspaceId: WORKSPACE, bearerToken: TOKEN, deviceId: B }),
    ).rejects.toThrow('response loss');
    await revokeCloudSyncDevice({ workspaceId: WORKSPACE, bearerToken: TOKEN, deviceId: B });
    const current = await ensureCloudSyncEnrollment(WORKSPACE, TOKEN);
    expect(current.currentKeyEpoch).toBe(2);
    expect(current.syncKey).not.toEqual(first.syncKey);
    expect(await loadEpochKey(deriveCloudSyncScope(WORKSPACE, TOKEN), 1)).toEqual(first.syncKey);
    h.phone = B;
    await expect(ensureCloudSyncEnrollment(WORKSPACE, TOKEN)).rejects.toThrow('removed from sync');
  });
});
