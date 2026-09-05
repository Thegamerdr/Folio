import { describe, expect, it } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha2.js';

import { SyncWorkspace, type SyncWorkspaceStorage } from './sync-workspace';

class MemoryStorage implements SyncWorkspaceStorage {
  readonly values = new Map<string, unknown>();
  private transactionTail: Promise<void> = Promise.resolve();
  failPutKey: string | undefined;

  async get<T>(key: string): Promise<T | undefined> {
    const value = this.values.get(key);
    return value === undefined ? undefined : (structuredClone(value) as T);
  }

  async put<T>(key: string, value: T): Promise<void> {
    if (this.failPutKey === key) {
      this.failPutKey = undefined;
      throw new Error(`Injected put failure for ${key}`);
    }
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
      .sort(([left], [right]) => compareCanonicalText(left, right))
      .slice(0, options.limit);
    return new Map(rows.map(([key, value]) => [key, structuredClone(value)])) as Map<string, T>;
  }

  async deleteAll(): Promise<void> {
    this.values.clear();
  }

  transaction<T>(work: (storage: SyncWorkspaceStorage) => Promise<T>): Promise<T> {
    const run = this.transactionTail.then(async () => {
      const before = structuredClone(this.values);
      try {
        return await work(this);
      } catch (error) {
        this.values.clear();
        for (const [key, value] of before) this.values.set(key, value);
        throw error;
      }
    });
    this.transactionTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

const DEVICE_A = 'a'.repeat(32);
const DEVICE_B = 'b'.repeat(32);
const NOW = '2026-09-01T10:00:00.000Z';
const privateKeys = new Map([
  [DEVICE_A, Uint8Array.from({ length: 32 }, (_, index) => index + 1)],
  [DEVICE_B, Uint8Array.from({ length: 32 }, (_, index) => index + 33)],
]);
const requestSequences = new Map<string, number>();
let nonceCounter = 0;

function call(
  handler: SyncWorkspace,
  method: string,
  path: string,
  body?: unknown,
  deviceId?: string,
  verifiedSnapshot = false,
): Promise<Response> {
  const requestHeaders: Record<string, string> = {
    'x-melo-internal-now': NOW,
    ...(deviceId === undefined ? {} : { 'x-melo-device': deviceId }),
    ...(verifiedSnapshot ? { 'x-melo-internal-backup-verified': 'true' } : {}),
    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
  };
  if (deviceId !== undefined) {
    const privateKey = privateKeys.get(deviceId)!;
    const requestSequence = (requestSequences.get(deviceId) ?? 0) + 1;
    requestSequences.set(deviceId, requestSequence);
    const bodyText = body === undefined ? '' : JSON.stringify(body);
    const bodySha256 = hex(sha256(new TextEncoder().encode(bodyText)));
    const url = new URL(`https://sync.test${path}`);
    const query = [...url.searchParams.entries()]
      .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey === rightKey
          ? compareCanonicalText(leftValue, rightValue)
          : compareCanonicalText(leftKey, rightKey),
      )
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    const nonce = `nonce-${deviceId}-${requestSequence}-${++nonceCounter}`;
    const message = [
      'melo.sync.v1',
      method.toUpperCase(),
      url.pathname,
      query,
      '',
      deviceId,
      bodySha256,
      NOW,
      nonce,
      String(requestSequence),
    ].join('\n');
    requestHeaders['x-melo-signature-version'] = '1';
    requestHeaders['x-melo-signed-at'] = NOW;
    requestHeaders['x-melo-nonce'] = nonce;
    requestHeaders['x-melo-request-sequence'] = String(requestSequence);
    requestHeaders['x-melo-body-sha256'] = bodySha256;
    requestHeaders['x-melo-signature'] = base64Url(
      ed25519.sign(new TextEncoder().encode(message), privateKey),
    );
  }
  return handler.fetch(
    new Request(`https://sync.test${path}`, {
      method,
      headers: requestHeaders,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

function registration(deviceId: string, epoch = 1) {
  const publicKey = ed25519.getPublicKey(privateKeys.get(deviceId)!);
  return {
    deviceId,
    label: deviceId === DEVICE_A ? 'Owner phone' : 'Tablet',
    publicKey: base64Url(publicKey),
    publicKeyFingerprint: `sha256:${hex(sha256(publicKey))}`,
    keyEpoch: epoch,
    wrappedSyncKey: 'opaque-wrapped-key',
  };
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function compareCanonicalText(left: string, right: string): number {
  if (left === right) return 0;
  const leftPoints = Array.from(left, (character) => character.codePointAt(0)!);
  const rightPoints = Array.from(right, (character) => character.codePointAt(0)!);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    if (leftPoints[index]! !== rightPoints[index]!) return leftPoints[index]! - rightPoints[index]!;
  }
  return leftPoints.length - rightPoints.length;
}

async function operation(
  deviceSequence = 1,
  keyEpoch = 1,
  deviceId = DEVICE_A,
  id = `operation-${deviceSequence}`,
  idempotencyKey = `device-a-${deviceSequence}`,
) {
  const ciphertext = btoa(`opaque-${deviceSequence}`);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`opaque-${deviceSequence}`),
  );
  const ciphertextSha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return {
    id,
    deviceId,
    deviceSequence,
    keyEpoch,
    idempotencyKey,
    createdAt: NOW,
    ciphertext,
    ciphertextSha256,
  };
}

describe('sync workspace coordinator', () => {
  it('lets a new phone discover approval without revealing another phone registry', async () => {
    const handler = new SyncWorkspace(new MemoryStorage());
    const initial = await call(
      handler,
      'POST',
      '/v1/sync/enrollment',
      registration(DEVICE_A),
      DEVICE_A,
    );
    await expect(initial.json()).resolves.toMatchObject({
      status: 'new',
      device: null,
      headCursor: 0,
    });
    await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_A), DEVICE_A);
    const pending = await call(
      handler,
      'POST',
      '/v1/sync/enrollment',
      registration(DEVICE_B),
      DEVICE_B,
    );
    const payload = await pending.json();
    expect(payload).toMatchObject({ status: 'pending', device: null });
    expect(JSON.stringify(payload)).not.toContain(DEVICE_A);
    expect((await call(handler, 'GET', '/v1/sync/devices', undefined, DEVICE_B)).status).toBe(401);
    await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_B), DEVICE_A);
    await expect(
      (await call(handler, 'POST', '/v1/sync/enrollment', registration(DEVICE_B), DEVICE_B)).json(),
    ).resolves.toMatchObject({
      status: 'active',
      device: { deviceId: DEVICE_B },
    });
  });

  it('deletion wins after a request verifies but before its write transaction', async () => {
    let entered!: () => void;
    let release!: () => void;
    const atTransaction = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const resume = new Promise<void>((resolve) => {
      release = resolve;
    });
    class PausingStorage extends MemoryStorage {
      pause = false;
      override async transaction<T>(
        work: (storage: SyncWorkspaceStorage) => Promise<T>,
      ): Promise<T> {
        if (this.pause) {
          this.pause = false;
          entered();
          await resume;
        }
        return super.transaction(work);
      }
    }
    const storage = new PausingStorage();
    const handler = new SyncWorkspace(storage);
    await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_A), DEVICE_A);
    storage.pause = true;
    const upload = call(handler, 'POST', '/v1/sync/operations', await operation(), DEVICE_A);
    await atTransaction;
    expect((await call(handler, 'DELETE', '/v1/sync/account')).status).toBe(200);
    release();
    expect((await upload).status).toBe(410);
    expect([...storage.values.keys()]).toEqual(['workspace-state-v1']);
  });

  it('keeps a permanent tombstone so a queued request cannot revive deleted sync data', async () => {
    const handler = new SyncWorkspace(new MemoryStorage());
    expect((await call(handler, 'DELETE', '/v1/sync/account')).status).toBe(200);
    expect(
      (await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_A), DEVICE_A)).status,
    ).toBe(410);
    expect((await call(handler, 'DELETE', '/v1/sync/account')).status).toBe(200);
  });

  it('replays opaque operations idempotently, acknowledges and compacts only after a snapshot', async () => {
    const storage = new MemoryStorage();
    const handler = new SyncWorkspace(storage);
    expect(
      (await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_A), DEVICE_A)).status,
    ).toBe(201);
    expect(
      (await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_B), DEVICE_A)).status,
    ).toBe(201);

    const envelope = await operation();
    const uploaded = await call(handler, 'POST', '/v1/sync/operations', envelope, DEVICE_A);
    await expect(uploaded.json()).resolves.toMatchObject({ duplicate: false, cursor: 1 });
    const duplicate = await call(handler, 'POST', '/v1/sync/operations', envelope, DEVICE_A);
    await expect(duplicate.json()).resolves.toMatchObject({ duplicate: true, cursor: 1 });

    const replay = await call(handler, 'GET', '/v1/sync/operations?after=0', undefined, DEVICE_B);
    await expect(replay.json()).resolves.toMatchObject({ nextCursor: 1, hasMore: false });
    const beforeApproval = await storage.get<{
      devices: Record<string, { lastRequestSequence: number }>;
    }>('workspace-state-v1');
    await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_B), DEVICE_A);
    const afterApproval = await storage.get<{
      devices: Record<string, { lastRequestSequence: number }>;
    }>('workspace-state-v1');
    expect(afterApproval?.devices[DEVICE_B]?.lastRequestSequence).toBe(
      beforeApproval?.devices[DEVICE_B]?.lastRequestSequence,
    );
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
    await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_A), DEVICE_A);
    await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_B), DEVICE_A);

    const transition = 'FVE1:000000000000000000000000:00000000000000000000000000000000';
    const keyTransition = { fromKeyEpoch: 1, toKeyEpoch: 2, sealedKey: transition };
    const incomplete = await call(
      handler,
      'POST',
      `/v1/sync/devices/${DEVICE_B}/revoke`,
      { newKeyEpoch: 2, wrappedKeys: {}, keyTransition },
      DEVICE_A,
    );
    expect(incomplete.status).toBe(409);

    const revoked = await call(
      handler,
      'POST',
      `/v1/sync/devices/${DEVICE_B}/revoke`,
      { newKeyEpoch: 2, wrappedKeys: { [DEVICE_A]: 'next-opaque-wrapped-key' }, keyTransition },
      DEVICE_A,
    );
    await expect(revoked.json()).resolves.toMatchObject({
      revokedDeviceId: DEVICE_B,
      currentKeyEpoch: 2,
    });
    const devices = (await (
      await call(handler, 'GET', '/v1/sync/devices', undefined, DEVICE_A)
    ).json()) as {
      devices: Array<{ deviceId: string; keyEpoch: number; wrappedSyncKey: string }>;
    };
    expect(devices.devices.find((device) => device.deviceId === DEVICE_A)).toMatchObject({
      keyEpoch: 2,
      wrappedSyncKey: 'next-opaque-wrapped-key',
    });

    // History must already be present without a second client write.
    await expect(
      (await call(handler, 'GET', '/v1/sync/key-transitions', undefined, DEVICE_A)).json(),
    ).resolves.toMatchObject({
      transitions: [keyTransition],
      hasMore: false,
      nextAfterEpoch: 2,
    });
    expect(
      (
        await call(
          handler,
          'POST',
          '/v1/sync/key-transitions',
          {
            fromKeyEpoch: 1,
            toKeyEpoch: 2,
            sealedKey: transition,
          },
          DEVICE_A,
        )
      ).status,
    ).toBe(200);
    await expect(
      (await call(handler, 'GET', '/v1/sync/key-transitions', undefined, DEVICE_A)).json(),
    ).resolves.toMatchObject({
      transitions: [{ fromKeyEpoch: 1, toKeyEpoch: 2, sealedKey: transition }],
    });

    expect(
      (await call(handler, 'GET', '/v1/sync/operations?after=0', undefined, DEVICE_B)).status,
    ).toBe(401);
    expect(
      (await call(handler, 'POST', '/v1/sync/operations', await operation(1, 1), DEVICE_A)).status,
    ).toBe(409);
  });

  it('rejects tampered ciphertext and purges every workspace-sync row idempotently', async () => {
    const storage = new MemoryStorage();
    const handler = new SyncWorkspace(storage);
    await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_A), DEVICE_A);
    const tampered = { ...(await operation()), ciphertextSha256: '0'.repeat(64) };
    expect((await call(handler, 'POST', '/v1/sync/operations', tampered, DEVICE_A)).status).toBe(
      400,
    );
    await call(handler, 'POST', '/v1/sync/operations', await operation(), DEVICE_A);
    expect((await call(handler, 'DELETE', '/v1/sync/account')).status).toBe(200);
    expect([...storage.values.keys()]).toEqual(['workspace-state-v1']);
    expect(storage.values.get('workspace-state-v1')).toEqual({
      version: 1,
      deleted: true,
      headCursor: 0,
      compactedThrough: 0,
      currentKeyEpoch: 1,
      devices: {},
    });
    expect((await call(handler, 'DELETE', '/v1/sync/account')).status).toBe(200);
  });

  it('requires device proof and never accepts a replacement public key', async () => {
    const handler = new SyncWorkspace(new MemoryStorage());
    const unsigned = await handler.fetch(
      new Request('https://sync.test/v1/sync/devices', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-melo-device': DEVICE_A },
        body: JSON.stringify(registration(DEVICE_A)),
      }),
    );
    expect(unsigned.status).toBe(401);
    expect(
      (await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_A), DEVICE_A)).status,
    ).toBe(201);
    const replacement = {
      ...registration(DEVICE_A),
      ...registration(DEVICE_B),
      deviceId: DEVICE_A,
      label: 'Owner phone',
    };
    expect((await call(handler, 'POST', '/v1/sync/devices', replacement, DEVICE_A)).status).toBe(
      409,
    );

    const raceHandler = new SyncWorkspace(new MemoryStorage());
    const enrollments = await Promise.all([
      call(raceHandler, 'POST', '/v1/sync/devices', registration(DEVICE_A), DEVICE_A),
      call(raceHandler, 'POST', '/v1/sync/devices', registration(DEVICE_B), DEVICE_B),
    ]);
    expect(enrollments.map((result) => result.status).sort()).toEqual([201, 403]);
  });

  it('serializes concurrent same-sequence uploads and leaves exactly one durable operation', async () => {
    const handler = new SyncWorkspace(new MemoryStorage());
    await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_A), DEVICE_A);
    const first = await operation(1, 1);
    const second = { ...first, id: 'operation-race-2', idempotencyKey: 'device-a-race-2' };
    const results = await Promise.all([
      call(handler, 'POST', '/v1/sync/operations', first, DEVICE_A),
      call(handler, 'POST', '/v1/sync/operations', second, DEVICE_A),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    const replay = await call(handler, 'GET', '/v1/sync/operations?after=0', undefined, DEVICE_A);
    await expect(replay.json()).resolves.toMatchObject({ headCursor: 1, nextCursor: 1 });
  });

  it('accepts independent sequence-one uploads concurrently from two enrolled devices', async () => {
    const storage = new MemoryStorage();
    const handler = new SyncWorkspace(storage);
    await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_A), DEVICE_A);
    await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_B), DEVICE_A);
    const results = await Promise.all([
      call(
        handler,
        'POST',
        '/v1/sync/operations',
        await operation(1, 1, DEVICE_A, 'operation-a', 'idempotency-a'),
        DEVICE_A,
      ),
      call(
        handler,
        'POST',
        '/v1/sync/operations',
        await operation(1, 1, DEVICE_B, 'operation-b', 'idempotency-b'),
        DEVICE_B,
      ),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 201]);
    const durableOperations = [...storage.values.entries()].filter(([key]) =>
      key.startsWith('operation:'),
    );
    expect(durableOperations).toHaveLength(2);
    expect((await storage.get<{ headCursor: number }>('workspace-state-v1'))?.headCursor).toBe(2);
  });

  it('rolls back operation, idempotency and head state when a durable write fails', async () => {
    const storage = new MemoryStorage();
    const handler = new SyncWorkspace(storage);
    await call(handler, 'POST', '/v1/sync/devices', registration(DEVICE_A), DEVICE_A);
    const envelope = await operation();
    storage.failPutKey = 'workspace-state-v1';
    await expect(call(handler, 'POST', '/v1/sync/operations', envelope, DEVICE_A)).rejects.toThrow(
      'Injected put failure',
    );
    expect([...storage.values.keys()].some((key) => key.startsWith('operation:'))).toBe(false);
    expect([...storage.values.keys()].some((key) => key.startsWith('idempotency:'))).toBe(false);
    expect((await storage.get<{ headCursor: number }>('workspace-state-v1'))?.headCursor).toBe(0);
    await expect(
      call(handler, 'POST', '/v1/sync/operations', envelope, DEVICE_A),
    ).resolves.toMatchObject({
      status: 201,
    });
  });
});
