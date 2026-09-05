import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SyncWorkspace,
  type SyncWorkspaceStorage,
} from '../../services/cloud-vault/src/sync-workspace';
import { createCloudSyncApi } from '../../packages/sync/src/index';
import {
  cloudSyncRequestSigner,
  getOrCreateCloudSyncIdentity,
  serializeCloudSyncRequest,
} from '../../apps/mobile/src/folio/lib/cloudSyncSigning';

const native = vi.hoisted(() => ({
  values: new Map<string, string>(),
  writes: vi.fn(),
  random: vi.fn(),
}));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
  getItemAsync: async (key: string) => native.values.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    native.writes(key);
    native.values.set(key, value);
  },
}));
vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (length: number) => {
    native.random(length);
    return crypto.getRandomValues(new Uint8Array(length));
  },
}));

function coordinator(): SyncWorkspace {
  let values = new Map<string, unknown>();
  let tail = Promise.resolve();
  const storage: SyncWorkspaceStorage = {
    get: async <T>(key: string) => structuredClone(values.get(key)) as T | undefined,
    put: async (key, value) => {
      values.set(key, structuredClone(value));
    },
    delete: async (key) => values.delete(key),
    deleteAll: async () => {
      values.clear();
    },
    list: async <T>({ prefix }: { prefix: string }) =>
      new Map(
        [...values.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, value]) => [key, structuredClone(value) as T]),
      ),
    transaction: <T>(work: (transaction: SyncWorkspaceStorage) => Promise<T>) => {
      const run = tail.then(async () => {
        const before = structuredClone(values);
        try {
          return await work(storage);
        } catch (error) {
          values = before;
          throw error;
        }
      });
      tail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
  return new SyncWorkspace(storage);
}

beforeEach(() => {
  native.values.clear();
  vi.clearAllMocks();
});

describe('native device proof against the real cloud coordinator', () => {
  it('coalesces device key creation and signs only when the previous response is consumed', async () => {
    const deviceId = 'd'.repeat(32);
    const identities = await Promise.all([
      getOrCreateCloudSyncIdentity(deviceId),
      getOrCreateCloudSyncIdentity(deviceId),
    ]);
    expect(identities[0]).toEqual(identities[1]);
    expect(native.random).toHaveBeenCalledTimes(1);
    const handler = coordinator();
    const signer = cloudSyncRequestSigner('a'.repeat(64), identities[0]!);
    const sign = vi.spyOn(signer, 'sign');
    const requests: Request[] = [];
    let releaseFirst: (() => void) | undefined;
    const holdFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const api = createCloudSyncApi({
      baseUrl: 'https://sync.test',
      workspaceRef: 'a'.repeat(64),
      deviceId,
      bearerToken: 'account',
      requestSigner: signer,
      serializeRequest: (work) => serializeCloudSyncRequest(deviceId, work),
      fetch: async (url, init) => {
        const request = new Request(url, init);
        requests.push(request.clone());
        const response = await handler.fetch(request);
        return {
          ok: response.ok,
          status: response.status,
          json: async () => {
            if (requests.length === 1) await holdFirst;
            return response.json();
          },
        };
      },
    });
    const enrollment = api.registerDevice({
      ...identities[0]!,
      label: 'Phone',
      keyEpoch: 1,
      wrappedSyncKey: 'opaque',
    });
    const devices = api.listDevices();
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(sign).toHaveBeenCalledTimes(1);
    releaseFirst!();
    await enrollment;
    expect((await devices).devices).toHaveLength(1);
    expect((await handler.fetch(requests[1]!.clone())).status).toBe(401);
    const altered = new Request(requests[1]!.url.replace('/devices', '/snapshot'), requests[1]);
    expect((await handler.fetch(altered)).status).toBe(401);
  });

  it('rejects a fresh signature when its workspace or body is changed in transit', async () => {
    const deviceId = 'e'.repeat(32);
    const identity = await getOrCreateCloudSyncIdentity(deviceId);
    const signer = cloudSyncRequestSigner('a'.repeat(64), identity);
    const handler = coordinator();
    let tamper: 'workspace' | 'body' | null = 'workspace';
    const api = createCloudSyncApi({
      baseUrl: 'https://sync.test',
      workspaceRef: 'a'.repeat(64),
      deviceId,
      bearerToken: 'account',
      requestSigner: signer,
      fetch: async (url, init) =>
        handler.fetch(
          new Request(url, {
            ...init,
            headers: {
              ...init.headers,
              ...(tamper === 'workspace' ? { 'X-Melo-Workspace-Ref': 'b'.repeat(64) } : {}),
            },
            body: tamper === 'body' ? init.body?.replace('Phone', 'Other') : init.body,
          }),
        ),
    });
    const registration = { ...identity, label: 'Phone', keyEpoch: 1, wrappedSyncKey: 'opaque' };
    await expect(api.registerDevice(registration)).rejects.toThrow('signature');
    tamper = 'body';
    await expect(api.registerDevice(registration)).rejects.toThrow('signature');
    tamper = null;
    await expect(api.registerDevice(registration)).resolves.toMatchObject({ currentKeyEpoch: 1 });
  });
});
