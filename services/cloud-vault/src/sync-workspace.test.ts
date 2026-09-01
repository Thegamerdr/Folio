import { describe, expect, it } from 'vitest';

import { SyncWorkspace, type SyncWorkspaceStorage } from './sync-workspace';

class MemoryStorage implements SyncWorkspaceStorage {
  readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.values.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<boolean> {
    return this.values.delete(key);
  }

  async list<T>(options: {
    prefix: string;
    startAfter?: string;
    limit?: number;
  }): Promise<Map<string, T>> {
    const rows = [...this.values.entries()]
      .filter(([key]) => key.startsWith(options.prefix) && key > (options.startAfter ?? ''))
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, options.limit);
    return new Map(rows) as Map<string, T>;
  }

  async deleteAll(): Promise<void> {
    this.values.clear();
  }
}

const DEVICE_A = 'a'.repeat(32);
const DEVICE_B = 'b'.repeat(32);
const NOW = '2026-09-01T10:00:00.000Z';

function call(
  handler: SyncWorkspace,
  method: string,
  path: string,
  body?: unknown,
  deviceId?: string,
  verifiedSnapshot = false,
): Promise<Response> {
  return handler.fetch(
    new Request(`https://sync.test${path}`, {
      method,
      headers: {
        'x-melo-internal-now': NOW,
        ...(deviceId === undefined ? {} : { 'x-melo-device': deviceId }),
        ...(verifiedSnapshot ? { 'x-melo-internal-backup-verified': 'true' } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

function registration(deviceId: string, epoch = 1) {
  return {
    deviceId,
    label: deviceId === DEVICE_A ? 'Owner phone' : 'Tablet',
    publicKey: 'opaque-public-key',
    publicKeyFingerprint: `sha256:${deviceId[0]!.repeat(64)}`,
    keyEpoch: epoch,
    wrappedSyncKey: 'opaque-wrapped-key',
  };
}

async function operation(deviceSequence = 1, keyEpoch = 1) {
  const ciphertext = btoa(`opaque-${deviceSequence}`);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`opaque-${deviceSequence}`),
  );
  const ciphertextSha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return {
    id: `operation-${deviceSequence}`,
    deviceId: DEVICE_A,
    deviceSequence,
    keyEpoch,
    idempotencyKey: `device-a-${deviceSequence}`,
    createdAt: NOW,
    ciphertext,
    ciphertextSha256,
  };
}

describe('sync workspace coordinator', () => {
  it('replays opaque operations idempotently, acknowledges and compacts only after a snapshot', async () => {
    const storage = new MemoryStorage();
    const handler = new SyncWorkspace(storage);
    expect((await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_A))).status).toBe(
      201,
    );
    expect((await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_B))).status).toBe(
      201,
    );

    const envelope = await operation();
    const uploaded = await call(handler, 'POST', '/v1/sync/operations', envelope, DEVICE_A);
    await expect(uploaded.json()).resolves.toMatchObject({ duplicate: false, cursor: 1 });
    const duplicate = await call(handler, 'POST', '/v1/sync/operations', envelope, DEVICE_A);
    await expect(duplicate.json()).resolves.toMatchObject({ duplicate: true, cursor: 1 });

    const replay = await call(handler, 'GET', '/v1/sync/operations?after=0', undefined, DEVICE_B);
    await expect(replay.json()).resolves.toMatchObject({ nextCursor: 1, hasMore: false });
    for (const deviceId of [DEVICE_A, DEVICE_B]) {
      expect(
        (
          await call(
            handler,
            'POST',
            '/v1/sync/acknowledgements',
            { deviceId, cursor: 1 },
            deviceId,
          )
        ).status,
      ).toBe(200);
    }

    expect(
      (await call(handler, 'POST', '/v1/sync/compaction', { throughCursor: 1 }, DEVICE_A)).status,
    ).toBe(409);

    const snapshot = {
      id: 'snapshot-1',
      cursor: 1,
      keyEpoch: 1,
      backupChecksum: 'c'.repeat(64),
      createdAt: NOW,
      deviceId: DEVICE_A,
    };
    expect((await call(handler, 'PUT', '/v1/sync/snapshot', snapshot, DEVICE_A, true)).status).toBe(
      201,
    );
    const compacted = await call(
      handler,
      'POST',
      '/v1/sync/compaction',
      { throughCursor: 1 },
      DEVICE_A,
    );
    await expect(compacted.json()).resolves.toMatchObject({ compactedThrough: 1, deletedCount: 1 });

    const staleReplay = await call(
      handler,
      'GET',
      '/v1/sync/operations?after=0',
      undefined,
      DEVICE_B,
    );
    expect(staleReplay.status).toBe(409);
    await expect(staleReplay.json()).resolves.toMatchObject({
      code: 'snapshot_required',
      snapshot: { backupChecksum: 'c'.repeat(64), cursor: 1 },
    });
  });

  it('revokes a device only with a complete next-epoch key rotation', async () => {
    const handler = new SyncWorkspace(new MemoryStorage());
    await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_A));
    await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_B));

    const incomplete = await call(
      handler,
      'POST',
      `/v1/sync/devices/${DEVICE_B}/revoke`,
      { newKeyEpoch: 2, wrappedKeys: {} },
      DEVICE_A,
    );
    expect(incomplete.status).toBe(409);

    const revoked = await call(
      handler,
      'POST',
      `/v1/sync/devices/${DEVICE_B}/revoke`,
      { newKeyEpoch: 2, wrappedKeys: { [DEVICE_A]: 'next-opaque-wrapped-key' } },
      DEVICE_A,
    );
    await expect(revoked.json()).resolves.toMatchObject({
      revokedDeviceId: DEVICE_B,
      currentKeyEpoch: 2,
    });

    expect(
      (await call(handler, 'GET', '/v1/sync/operations?after=0', undefined, DEVICE_B)).status,
    ).toBe(403);
    expect(
      (await call(handler, 'POST', '/v1/sync/operations', await operation(1, 1), DEVICE_A)).status,
    ).toBe(409);
  });

  it('rejects tampered ciphertext and purges every workspace-sync row idempotently', async () => {
    const storage = new MemoryStorage();
    const handler = new SyncWorkspace(storage);
    await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_A));
    const tampered = { ...(await operation()), ciphertextSha256: '0'.repeat(64) };
    expect((await call(handler, 'POST', '/v1/sync/operations', tampered, DEVICE_A)).status).toBe(
      400,
    );
    expect((await call(handler, 'DELETE', '/v1/sync/account')).status).toBe(200);
    expect(storage.values.size).toBe(0);
    expect((await call(handler, 'DELETE', '/v1/sync/account')).status).toBe(200);
  });
});
