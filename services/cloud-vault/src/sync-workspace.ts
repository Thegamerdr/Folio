const STATE_KEY = 'workspace-state-v1';
const OPERATION_PREFIX = 'operation:';
const IDEMPOTENCY_PREFIX = 'idempotency:';
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 250;
const DEVICE_ID_PATTERN = /^[a-f0-9]{32}$/;
const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/;
const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export type SyncDevice = Readonly<{
  deviceId: string;
  label: string;
  publicKey: string;
  publicKeyFingerprint: string;
  keyEpoch: number;
  wrappedSyncKey: string;
  registeredAt: string;
  lastSeenAt: string;
  acknowledgedCursor: number;
  lastDeviceSequence: number;
  revokedAt?: string;
}>;

export type StoredOperation = Readonly<{
  id: string;
  cursor: number;
  deviceId: string;
  deviceSequence: number;
  keyEpoch: number;
  idempotencyKey: string;
  createdAt: string;
  ciphertext: string;
  ciphertextSha256: string;
}>;

export type SyncSnapshot = Readonly<{
  id: string;
  cursor: number;
  keyEpoch: number;
  backupChecksum: string;
  createdAt: string;
  deviceId: string;
}>;

type WorkspaceState = {
  version: 1;
  headCursor: number;
  compactedThrough: number;
  currentKeyEpoch: number;
  devices: Record<string, SyncDevice>;
  latestSnapshot?: SyncSnapshot;
  previousSnapshot?: SyncSnapshot;
};

export type SyncWorkspaceStorage = Readonly<{
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T>(options: {
    prefix: string;
    startAfter?: string;
    limit?: number;
  }): Promise<Map<string, T>>;
  deleteAll(): Promise<void>;
}>;

export class SyncWorkspace {
  constructor(private readonly storage: SyncWorkspaceStorage) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const now = request.headers.get('x-melo-internal-now') ?? new Date().toISOString();
    if (!isIso(now)) return response({ error: 'Invalid service time.' }, 500);

    if (request.method === 'DELETE' && url.pathname === '/v1/sync/account') {
      await this.storage.deleteAll();
      return response({ ok: true, deleted: true, scope: 'workspace-sync-data' });
    }

    const state = await this.state();

    if (url.pathname === '/v1/sync/devices' && request.method === 'GET') {
      return response({
        devices: Object.values(state.devices).sort((left, right) =>
          left.registeredAt.localeCompare(right.registeredAt),
        ),
        currentKeyEpoch: state.currentKeyEpoch,
        headCursor: state.headCursor,
        compactedThrough: state.compactedThrough,
      });
    }

    if (url.pathname === '/v1/sync/devices' && request.method === 'POST') {
      const body = await jsonBody(request);
      if (!validDeviceRegistration(body)) {
        return response({ error: 'Device registration is invalid.' }, 400);
      }
      const existing = state.devices[body.deviceId];
      if (existing?.revokedAt !== undefined) {
        return response({ error: 'A revoked device identifier cannot be registered again.' }, 409);
      }
      if (body.keyEpoch !== state.currentKeyEpoch) {
        return response({ error: 'Device registration uses a stale sync-key epoch.' }, 409);
      }
      const device: SyncDevice = {
        deviceId: body.deviceId,
        label: body.label.trim(),
        publicKey: body.publicKey,
        publicKeyFingerprint: body.publicKeyFingerprint,
        keyEpoch: body.keyEpoch,
        wrappedSyncKey: body.wrappedSyncKey,
        registeredAt: existing?.registeredAt ?? now,
        lastSeenAt: now,
        acknowledgedCursor: existing?.acknowledgedCursor ?? state.compactedThrough,
        lastDeviceSequence: existing?.lastDeviceSequence ?? 0,
      };
      state.devices[device.deviceId] = device;
      await this.save(state);
      return response(
        { ok: true, device, currentKeyEpoch: state.currentKeyEpoch },
        existing ? 200 : 201,
      );
    }

    const revokeMatch = /^\/v1\/sync\/devices\/([a-f0-9]{32})\/revoke$/.exec(url.pathname);
    if (revokeMatch !== null && request.method === 'POST') {
      const targetId = revokeMatch[1]!;
      const actorId = deviceHeader(request);
      const actor = actorId === null ? undefined : activeDevice(state, actorId);
      const target = state.devices[targetId];
      const body = await jsonBody(request);
      if (
        actor === undefined ||
        target === undefined ||
        target.revokedAt !== undefined ||
        !validRotation(body, state.currentKeyEpoch + 1)
      ) {
        return response({ error: 'Device revoke and key rotation request is invalid.' }, 400);
      }
      if (actorId === targetId) {
        return response({ error: 'A device cannot revoke itself.' }, 409);
      }
      const remainingIds = Object.values(state.devices)
        .filter((device) => device.revokedAt === undefined && device.deviceId !== targetId)
        .map((device) => device.deviceId)
        .sort();
      const suppliedIds = Object.keys(body.wrappedKeys).sort();
      if (
        remainingIds.length !== suppliedIds.length ||
        remainingIds.some((deviceId, index) => suppliedIds[index] !== deviceId)
      ) {
        return response(
          { error: 'A rotated sync key must be wrapped for every remaining active device.' },
          409,
        );
      }
      state.devices[targetId] = { ...target, revokedAt: now, lastSeenAt: now };
      for (const deviceId of remainingIds) {
        const device = state.devices[deviceId]!;
        state.devices[deviceId] = {
          ...device,
          keyEpoch: body.newKeyEpoch,
          wrappedSyncKey: body.wrappedKeys[deviceId]!,
        };
      }
      state.currentKeyEpoch = body.newKeyEpoch;
      await this.save(state);
      return response({
        ok: true,
        revokedDeviceId: targetId,
        revokedAt: now,
        currentKeyEpoch: state.currentKeyEpoch,
      });
    }

    if (url.pathname === '/v1/sync/operations' && request.method === 'POST') {
      const actorId = deviceHeader(request);
      const actor = actorId === null ? undefined : activeDevice(state, actorId);
      const body = await jsonBody(request);
      if (actor === undefined || !validOperationUpload(body) || body.deviceId !== actorId) {
        return response({ error: 'Encrypted operation request is invalid.' }, 400);
      }
      if ((await sha256Base64(body.ciphertext)) !== body.ciphertextSha256) {
        return response({ error: 'Encrypted operation checksum did not match.' }, 400);
      }
      const replayCursor = await this.storage.get<number>(idempotencyKey(body.idempotencyKey));
      if (replayCursor !== undefined) {
        const replay = await this.storage.get<StoredOperation>(operationKey(replayCursor));
        if (replay === undefined || replay.ciphertextSha256 !== body.ciphertextSha256) {
          return response(
            { error: 'Idempotency key was already used for different ciphertext.' },
            409,
          );
        }
        return response({
          ok: true,
          duplicate: true,
          cursor: replayCursor,
          headCursor: state.headCursor,
        });
      }
      if (
        body.keyEpoch !== state.currentKeyEpoch ||
        body.deviceSequence !== actor.lastDeviceSequence + 1
      ) {
        return response({ error: 'Encrypted operation sequence or key epoch is stale.' }, 409);
      }
      const cursor = state.headCursor + 1;
      const operation: StoredOperation = { ...body, cursor };
      await this.storage.put(operationKey(cursor), operation);
      await this.storage.put(idempotencyKey(body.idempotencyKey), cursor);
      state.headCursor = cursor;
      state.devices[actor.deviceId] = {
        ...actor,
        lastDeviceSequence: body.deviceSequence,
        lastSeenAt: now,
      };
      await this.save(state);
      return response({ ok: true, duplicate: false, cursor, headCursor: cursor }, 201);
    }

    if (url.pathname === '/v1/sync/operations' && request.method === 'GET') {
      const actorId = deviceHeader(request);
      if (actorId === null || activeDevice(state, actorId) === undefined) {
        return response({ error: 'An active registered device is required.' }, 403);
      }
      const after = queryCursor(url.searchParams.get('after'));
      if (after === null) return response({ error: 'Operation cursor is invalid.' }, 400);
      if (after < state.compactedThrough) {
        return response(
          {
            error: 'Encrypted snapshot restore is required before operation replay.',
            code: 'snapshot_required',
            compactedThrough: state.compactedThrough,
            snapshot: state.latestSnapshot ?? null,
          },
          409,
        );
      }
      const limit = pageSize(url.searchParams.get('limit'));
      if (limit === null) return response({ error: 'Operation page size is invalid.' }, 400);
      const listed = await this.storage.list<StoredOperation>({
        prefix: OPERATION_PREFIX,
        startAfter: operationKey(after),
        limit: limit + 1,
      });
      const operations = [...listed.values()].sort((a, b) => a.cursor - b.cursor);
      const hasMore = operations.length > limit;
      if (hasMore) operations.pop();
      const nextCursor = operations.at(-1)?.cursor ?? after;
      return response({ operations, nextCursor, headCursor: state.headCursor, hasMore });
    }

    if (url.pathname === '/v1/sync/acknowledgements' && request.method === 'POST') {
      const actorId = deviceHeader(request);
      const actor = actorId === null ? undefined : activeDevice(state, actorId);
      const body = await jsonBody(request);
      if (
        actor === undefined ||
        !record(body) ||
        body['deviceId'] !== actorId ||
        !safeCursor(body['cursor']) ||
        body['cursor'] < actor.acknowledgedCursor ||
        body['cursor'] > state.headCursor
      ) {
        return response({ error: 'Operation acknowledgement is invalid.' }, 400);
      }
      state.devices[actor.deviceId] = {
        ...actor,
        acknowledgedCursor: body['cursor'],
        lastSeenAt: now,
      };
      await this.save(state);
      return response({
        ok: true,
        acknowledgedCursor: body['cursor'],
        headCursor: state.headCursor,
      });
    }

    if (url.pathname === '/v1/sync/snapshot' && request.method === 'PUT') {
      const actorId = deviceHeader(request);
      const actor = actorId === null ? undefined : activeDevice(state, actorId);
      const body = await jsonBody(request);
      if (
        actor === undefined ||
        !validSnapshot(body) ||
        body.deviceId !== actorId ||
        body.keyEpoch !== state.currentKeyEpoch ||
        body.cursor > state.headCursor ||
        body.cursor < state.compactedThrough ||
        request.headers.get('x-melo-internal-backup-verified') !== 'true'
      ) {
        return response({ error: 'Encrypted snapshot checkpoint is invalid.' }, 400);
      }
      state.previousSnapshot = state.latestSnapshot;
      state.latestSnapshot = body;
      await this.save(state);
      return response({ ok: true, snapshot: body }, 201);
    }

    if (url.pathname === '/v1/sync/snapshot' && request.method === 'GET') {
      return response({
        exists: state.latestSnapshot !== undefined,
        snapshot: state.latestSnapshot ?? null,
      });
    }

    if (url.pathname === '/v1/sync/compaction' && request.method === 'POST') {
      const actorId = deviceHeader(request);
      if (actorId === null || activeDevice(state, actorId) === undefined) {
        return response({ error: 'An active registered device is required.' }, 403);
      }
      const body = await jsonBody(request);
      if (!record(body) || !safeCursor(body['throughCursor'])) {
        return response({ error: 'Compaction cursor is invalid.' }, 400);
      }
      const throughCursor = body['throughCursor'];
      const active = Object.values(state.devices).filter(
        (device) => device.revokedAt === undefined,
      );
      const minimumActiveAck = Math.min(...active.map((device) => device.acknowledgedCursor));
      if (
        state.latestSnapshot === undefined ||
        throughCursor > state.latestSnapshot.cursor ||
        throughCursor > minimumActiveAck ||
        throughCursor < state.compactedThrough
      ) {
        return response(
          {
            error: 'Compaction is not safe for every active device and encrypted snapshot.',
            minimumActiveAck,
            snapshotCursor: state.latestSnapshot?.cursor ?? null,
          },
          409,
        );
      }
      const doomed = await this.storage.list<StoredOperation>({ prefix: OPERATION_PREFIX });
      let deletedCount = 0;
      for (const [key, operation] of doomed) {
        if (operation.cursor <= throughCursor && (await this.storage.delete(key)))
          deletedCount += 1;
      }
      state.compactedThrough = throughCursor;
      await this.save(state);
      return response({ ok: true, compactedThrough: throughCursor, deletedCount });
    }

    return response({ error: 'Route not found.' }, 404);
  }

  private async state(): Promise<WorkspaceState> {
    return (
      (await this.storage.get<WorkspaceState>(STATE_KEY)) ?? {
        version: 1,
        headCursor: 0,
        compactedThrough: 0,
        currentKeyEpoch: 1,
        devices: {},
      }
    );
  }

  private async save(state: WorkspaceState): Promise<void> {
    await this.storage.put(STATE_KEY, state);
  }
}

export class SyncWorkspaceDurableObject implements DurableObject {
  private readonly handler: SyncWorkspace;

  constructor(state: DurableObjectState) {
    this.handler = new SyncWorkspace(state.storage);
  }

  fetch(request: Request): Promise<Response> {
    return this.handler.fetch(request);
  }
}

function validDeviceRegistration(value: unknown): value is {
  deviceId: string;
  label: string;
  publicKey: string;
  publicKeyFingerprint: string;
  keyEpoch: number;
  wrappedSyncKey: string;
} {
  return (
    record(value) &&
    typeof value['deviceId'] === 'string' &&
    DEVICE_ID_PATTERN.test(value['deviceId']) &&
    typeof value['label'] === 'string' &&
    value['label'].trim().length > 0 &&
    value['label'].trim().length <= 80 &&
    safeOpaque(value['publicKey'], 512) &&
    typeof value['publicKeyFingerprint'] === 'string' &&
    FINGERPRINT_PATTERN.test(value['publicKeyFingerprint']) &&
    typeof value['keyEpoch'] === 'number' &&
    Number.isSafeInteger(value['keyEpoch']) &&
    value['keyEpoch'] >= 1 &&
    safeOpaque(value['wrappedSyncKey'], 2048)
  );
}

function validRotation(
  value: unknown,
  expectedEpoch: number,
): value is {
  newKeyEpoch: number;
  wrappedKeys: Record<string, string>;
} {
  if (!record(value) || value['newKeyEpoch'] !== expectedEpoch || !record(value['wrappedKeys'])) {
    return false;
  }
  return Object.entries(value['wrappedKeys']).every(
    ([deviceId, wrapped]) => DEVICE_ID_PATTERN.test(deviceId) && safeOpaque(wrapped, 2048),
  );
}

function validOperationUpload(value: unknown): value is Omit<StoredOperation, 'cursor'> {
  return (
    record(value) &&
    typeof value['id'] === 'string' &&
    OPAQUE_ID_PATTERN.test(value['id']) &&
    typeof value['deviceId'] === 'string' &&
    DEVICE_ID_PATTERN.test(value['deviceId']) &&
    safePositiveInt(value['deviceSequence']) &&
    safePositiveInt(value['keyEpoch']) &&
    typeof value['idempotencyKey'] === 'string' &&
    OPAQUE_ID_PATTERN.test(value['idempotencyKey']) &&
    typeof value['createdAt'] === 'string' &&
    isIso(value['createdAt']) &&
    safeBase64(value['ciphertext'], 90_000) &&
    typeof value['ciphertextSha256'] === 'string' &&
    CHECKSUM_PATTERN.test(value['ciphertextSha256'])
  );
}

function validSnapshot(value: unknown): value is SyncSnapshot {
  return (
    record(value) &&
    typeof value['id'] === 'string' &&
    OPAQUE_ID_PATTERN.test(value['id']) &&
    safeCursor(value['cursor']) &&
    safePositiveInt(value['keyEpoch']) &&
    typeof value['backupChecksum'] === 'string' &&
    CHECKSUM_PATTERN.test(value['backupChecksum']) &&
    typeof value['createdAt'] === 'string' &&
    isIso(value['createdAt']) &&
    typeof value['deviceId'] === 'string' &&
    DEVICE_ID_PATTERN.test(value['deviceId'])
  );
}

function activeDevice(state: WorkspaceState, deviceId: string): SyncDevice | undefined {
  const device = state.devices[deviceId];
  return device?.revokedAt === undefined ? device : undefined;
}

function deviceHeader(request: Request): string | null {
  const value = request.headers.get('x-melo-device')?.trim().toLowerCase() ?? '';
  return DEVICE_ID_PATTERN.test(value) ? value : null;
}

function operationKey(cursor: number): string {
  return `${OPERATION_PREFIX}${String(cursor).padStart(16, '0')}`;
}

function idempotencyKey(value: string): string {
  return `${IDEMPOTENCY_PREFIX}${value}`;
}

function queryCursor(value: string | null): number | null {
  if (value === null) return 0;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return safeCursor(parsed) ? parsed : null;
}

function pageSize(value: string | null): number | null {
  if (value === null) return DEFAULT_PAGE_SIZE;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= MAX_PAGE_SIZE ? parsed : null;
}

async function jsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

function response(payload: unknown, status = 200): Response {
  return Response.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeOpaque(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function safeBase64(value: unknown, max: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= max &&
    value.length % 4 === 0 &&
    BASE64_PATTERN.test(value)
  );
}

function safeCursor(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value >= 0;
}

function safePositiveInt(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value >= 1;
}

function isIso(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

async function sha256Base64(value: string): Promise<string> {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
