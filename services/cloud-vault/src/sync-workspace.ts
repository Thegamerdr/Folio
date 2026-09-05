const STATE_KEY = 'workspace-state-v1';
const OPERATION_PREFIX = 'operation:';
const IDEMPOTENCY_PREFIX = 'idempotency:';
const TRANSITION_PREFIX = 'key-transition:';
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
  /** Atomic replay high-water mark; no growing nonce journal is needed. */
  lastRequestSequence: number;
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
  /** Permanent workspace tombstone. Account deletion must not allow a queued request to revive it. */
  deleted?: boolean;
  headCursor: number;
  compactedThrough: number;
  currentKeyEpoch: number;
  devices: Record<string, SyncDevice>;
  latestSnapshot?: SyncSnapshot;
  previousSnapshot?: SyncSnapshot;
  /** Opaque old-key boxes, each sealed by the client under its successor epoch. */
  keyTransitions?: Record<string, { fromKeyEpoch: number; toKeyEpoch: number; sealedKey: string }>;
};

type RequestAuth = Readonly<{ requestSequence: number; publicKey: string }>;

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
  /** Atomic read/modify/write boundary. Production DO storage supplies this using its durable
   * transaction API; test storage supplies clone-on-read/write rollback semantics. */
  transaction<T>(work: (storage: SyncWorkspaceStorage) => Promise<T>): Promise<T>;
}>;

export class SyncWorkspace {
  constructor(private readonly storage: SyncWorkspaceStorage) {}

  async fetch(request: Request): Promise<Response> {
    if (request.body !== null) {
      const bytes = await boundedRequestBody(request.body);
      if (bytes === null)
        return response({ error: 'Sync request exceeds the safe body limit.' }, 413);
      request = new Request(request, { body: bytes });
    }
    const url = new URL(request.url);
    const now = request.headers.get('x-melo-internal-now') ?? new Date().toISOString();
    if (!isIso(now)) return response({ error: 'Invalid service time.' }, 500);

    if (request.method === 'DELETE' && url.pathname === '/v1/sync/account') {
      // Fence first, dropping wrapped keys/device metadata immediately. Purge bounded batches
      // afterwards; a lost response/restart can resume without ever reopening this authority.
      await this.storage.transaction(async (storage) => {
        await this.save(
          {
            version: 1,
            deleted: true,
            headCursor: 0,
            compactedThrough: 0,
            currentKeyEpoch: 1,
            devices: {},
          },
          storage,
        );
      });
      for (;;) {
        const removed = await this.storage.transaction(async (storage) => {
          const keys = [...(await storage.list<unknown>({ prefix: '', limit: 128 })).keys()].filter(
            (key) => key !== STATE_KEY,
          );
          for (const key of keys) await storage.delete(key);
          return keys.length;
        });
        if (removed === 0) break;
      }
      return response({ ok: true, deleted: true, scope: 'workspace-sync-data' });
    }

    const state = await this.state();
    if (state.deleted) {
      return response({ error: 'This workspace sync authority has been deleted.' }, 410);
    }
    const requestAuth = await verifySignedRequest(request, state, now);
    if (requestAuth === null) {
      return response(
        { error: 'A fresh device signature is required for this sync request.' },
        401,
      );
    }

    if (url.pathname === '/v1/sync/enrollment' && request.method === 'POST') {
      return this.transaction(async (storage) => {
        const current = await this.state(storage);
        const deviceId = deviceHeader(request)!;
        const device = current.devices[deviceId];
        if (device !== undefined && device.publicKey !== requestAuth.publicKey) {
          return response({ error: 'The registered device key changed.' }, 403);
        }
        if (device !== undefined && requestAuth.requestSequence <= device.lastRequestSequence) {
          return response({ error: 'This signed sync request was already used.' }, 409);
        }
        if (device !== undefined) {
          current.devices[deviceId] = {
            ...device,
            lastRequestSequence: requestAuth.requestSequence,
          };
          await this.save(current, storage);
        }
        // An account-authenticated new phone may discover approval requirements, not other
        // phones' identifiers, public keys, labels, or key boxes.
        return response({
          status:
            device?.revokedAt !== undefined
              ? 'revoked'
              : device !== undefined
                ? 'active'
                : Object.keys(current.devices).length === 0
                  ? 'new'
                  : 'pending',
          device: device?.revokedAt === undefined ? (device ?? null) : null,
          currentKeyEpoch: current.currentKeyEpoch,
          headCursor: current.headCursor,
          compactedThrough: current.compactedThrough,
        });
      });
    }

    if (url.pathname === '/v1/sync/devices' && request.method === 'GET') {
      const actorId = deviceHeader(request);
      return this.transaction(async (storage) => {
        const current = await this.state(storage);
        const actor =
          actorId === null ? undefined : activeDevice(current, actorId, requestAuth.publicKey);
        if (actor === undefined)
          return response({ error: 'An active registered device is required.' }, 403);
        if (requestAuth.requestSequence <= actor.lastRequestSequence) {
          return response({ error: 'This signed sync request was already used.' }, 409);
        }
        current.devices[actor.deviceId] = {
          ...actor,
          lastRequestSequence: requestAuth.requestSequence,
          lastSeenAt: now,
        };
        await this.save(current, storage);
        return response({
          devices: Object.values(current.devices).sort((left, right) =>
            compareCanonicalText(left.registeredAt, right.registeredAt),
          ),
          currentKeyEpoch: current.currentKeyEpoch,
          headCursor: current.headCursor,
          compactedThrough: current.compactedThrough,
        });
      });
    }

    if (url.pathname === '/v1/sync/devices' && request.method === 'POST') {
      const body = await jsonBody(request);
      if (!validDeviceRegistration(body) || !(await deviceFingerprintMatches(body))) {
        return response({ error: 'Device registration is invalid.' }, 400);
      }
      return this.transaction(async (storage) => {
        const current = await this.state(storage);
        const actorId = deviceHeader(request)!;
        const existing = current.devices[body.deviceId];
        if (existing === undefined && Object.keys(current.devices).length >= 32) {
          return response({ error: 'This workspace has reached its device limit.' }, 409);
        }
        if (
          actorId === body.deviceId &&
          existing !== undefined &&
          existing.publicKey !== requestAuth.publicKey
        ) {
          return response(
            { error: 'The device key changed before this request could be accepted.' },
            403,
          );
        }
        if (existing?.revokedAt !== undefined) {
          return response(
            { error: 'A revoked device identifier cannot be registered again.' },
            409,
          );
        }
        if (body.keyEpoch !== current.currentKeyEpoch) {
          return response({ error: 'Device registration uses a stale sync-key epoch.' }, 409);
        }
        if (
          existing !== undefined &&
          (existing.publicKey !== body.publicKey ||
            existing.publicKeyFingerprint !== body.publicKeyFingerprint)
        ) {
          return response({ error: 'A registered device public key cannot be replaced.' }, 409);
        }
        if (
          actorId === body.deviceId &&
          existing !== undefined &&
          requestAuth.requestSequence <= existing.lastRequestSequence
        ) {
          return response({ error: 'The device request sequence is stale.' }, 409);
        }
        if (
          actorId !== body.deviceId &&
          (Object.keys(current.devices).length === 0 ||
            activeDevice(current, actorId, requestAuth.publicKey) === undefined)
        ) {
          return response({ error: 'An active approving device is required.' }, 403);
        }
        if (
          actorId === body.deviceId &&
          existing === undefined &&
          Object.keys(current.devices).length !== 0
        ) {
          return response(
            { error: 'A new device must be approved by an active trusted device.' },
            403,
          );
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
          acknowledgedCursor: existing?.acknowledgedCursor ?? current.compactedThrough,
          lastDeviceSequence: existing?.lastDeviceSequence ?? 0,
          // A later device enrollment is signed by the approving device; it must not advance the
          // newly enrolled device's own request counter before that device has ever signed.
          lastRequestSequence:
            actorId === body.deviceId
              ? requestAuth.requestSequence
              : (existing?.lastRequestSequence ?? 0),
        };
        current.devices[device.deviceId] = device;
        if (actorId !== body.deviceId) {
          const actor = activeDevice(current, actorId, requestAuth.publicKey);
          if (actor === undefined || requestAuth.requestSequence <= actor.lastRequestSequence) {
            return response({ error: 'An active approving device is required.' }, 403);
          }
          current.devices[actorId] = {
            ...actor,
            lastRequestSequence: requestAuth.requestSequence,
            lastSeenAt: now,
          };
        }
        await this.save(current, storage);
        return response(
          { ok: true, device, currentKeyEpoch: current.currentKeyEpoch },
          existing ? 200 : 201,
        );
      });
    }

    const revokeMatch = /^\/v1\/sync\/devices\/([a-f0-9]{32})\/revoke$/.exec(url.pathname);
    if (revokeMatch !== null && request.method === 'POST') {
      const targetId = revokeMatch[1]!;
      const body = await jsonBody(request);
      const actorId = deviceHeader(request);
      return this.transaction(async (storage) => {
        const current = await this.state(storage);
        const actor =
          actorId === null ? undefined : activeDevice(current, actorId, requestAuth.publicKey);
        const target = current.devices[targetId];
        if (
          actor === undefined ||
          target === undefined ||
          target.revokedAt !== undefined ||
          !validRotation(body, current.currentKeyEpoch + 1)
        ) {
          return response({ error: 'Device revoke and key rotation request is invalid.' }, 400);
        }
        if (actorId === targetId) {
          return response({ error: 'A device cannot revoke itself.' }, 409);
        }
        if (requestAuth.requestSequence <= actor.lastRequestSequence) {
          return response({ error: 'The device request sequence is stale.' }, 409);
        }
        const remainingIds = Object.values(current.devices)
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
        current.devices[targetId] = { ...target, revokedAt: now, lastSeenAt: now };
        for (const deviceId of remainingIds) {
          const device = current.devices[deviceId]!;
          current.devices[deviceId] = {
            ...device,
            keyEpoch: body.newKeyEpoch,
            wrappedSyncKey: body.wrappedKeys[deviceId]!,
          };
        }
        const rotatedActor = current.devices[actor.deviceId]!;
        current.devices[actor.deviceId] = {
          ...rotatedActor,
          lastRequestSequence: requestAuth.requestSequence,
          lastSeenAt: now,
        };
        current.currentKeyEpoch = body.newKeyEpoch;
        // Publishing key history separately from revocation leaves an unrecoverable crash
        // window. The next-epoch boxes and backward key bridge commit together.
        await storage.put(transitionKey(body.newKeyEpoch), body.keyTransition);
        await this.save(current, storage);
        return response({
          ok: true,
          revokedDeviceId: targetId,
          revokedAt: now,
          currentKeyEpoch: current.currentKeyEpoch,
        });
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
      return this.transaction(async (storage) => {
        const current = await this.state(storage);
        const currentActor = activeDevice(current, actorId!, requestAuth.publicKey);
        if (currentActor === undefined) {
          return response({ error: 'Encrypted operation request is invalid.' }, 400);
        }
        if (requestAuth.requestSequence <= currentActor.lastRequestSequence) {
          return response({ error: 'This signed sync request was already used.' }, 409);
        }
        const replayCursor = await storage.get<number>(idempotencyKey(body.idempotencyKey));
        if (replayCursor !== undefined) {
          const replay = await storage.get<StoredOperation>(operationKey(replayCursor));
          if (
            replay === undefined ||
            replay.id !== body.id ||
            replay.createdAt !== body.createdAt ||
            replay.deviceId !== body.deviceId ||
            replay.deviceSequence !== body.deviceSequence ||
            replay.keyEpoch !== body.keyEpoch ||
            replay.ciphertext !== body.ciphertext ||
            replay.ciphertextSha256 !== body.ciphertextSha256
          ) {
            return response(
              { error: 'Idempotency key was already used for different ciphertext.' },
              409,
            );
          }
          current.devices[currentActor.deviceId] = {
            ...currentActor,
            lastRequestSequence: requestAuth.requestSequence,
            lastSeenAt: now,
          };
          await this.save(current, storage);
          return response({
            ok: true,
            duplicate: true,
            cursor: replayCursor,
            headCursor: current.headCursor,
          });
        }
        if (
          body.keyEpoch !== current.currentKeyEpoch ||
          body.deviceSequence !== currentActor.lastDeviceSequence + 1
        ) {
          return response({ error: 'Encrypted operation sequence or key epoch is stale.' }, 409);
        }
        const cursor = current.headCursor + 1;
        const operation: StoredOperation = { ...body, cursor };
        await storage.put(operationKey(cursor), operation);
        await storage.put(idempotencyKey(body.idempotencyKey), cursor);
        current.headCursor = cursor;
        current.devices[currentActor.deviceId] = {
          ...currentActor,
          lastDeviceSequence: body.deviceSequence,
          lastRequestSequence: requestAuth.requestSequence,
          lastSeenAt: now,
        };
        await this.save(current, storage);
        return response({ ok: true, duplicate: false, cursor, headCursor: cursor }, 201);
      });
    }

    if (url.pathname === '/v1/sync/operations' && request.method === 'GET') {
      const actorId = deviceHeader(request);
      const after = queryCursor(url.searchParams.get('after'));
      if (after === null) return response({ error: 'Operation cursor is invalid.' }, 400);
      const limit = pageSize(url.searchParams.get('limit'));
      if (limit === null) return response({ error: 'Operation page size is invalid.' }, 400);
      return this.transaction(async (storage) => {
        const current = await this.state(storage);
        const actor =
          actorId === null ? undefined : activeDevice(current, actorId, requestAuth.publicKey);
        if (actor === undefined) {
          return response({ error: 'An active registered device is required.' }, 403);
        }
        if (requestAuth.requestSequence <= actor.lastRequestSequence) {
          return response({ error: 'This signed sync request was already used.' }, 409);
        }
        current.devices[actor.deviceId] = {
          ...actor,
          lastRequestSequence: requestAuth.requestSequence,
          lastSeenAt: now,
        };
        if (after < current.compactedThrough) {
          await this.save(current, storage);
          return response(
            {
              error: 'Encrypted snapshot restore is required before operation replay.',
              code: 'snapshot_required',
              compactedThrough: current.compactedThrough,
              snapshot: current.latestSnapshot ?? null,
            },
            409,
          );
        }
        const listed = await storage.list<StoredOperation>({
          prefix: OPERATION_PREFIX,
          startAfter: operationKey(after),
          limit: limit + 1,
        });
        const operations: StoredOperation[] = [];
        let responseBytes = 1024;
        for (const operation of [...listed.values()].sort((a, b) => a.cursor - b.cursor)) {
          const size = new TextEncoder().encode(JSON.stringify(operation)).byteLength;
          if (operations.length >= limit || responseBytes + size > 1536 * 1024) break;
          responseBytes += size;
          operations.push(operation);
        }
        const hasMore = listed.size > operations.length;
        const nextCursor = operations.at(-1)?.cursor ?? after;
        await this.save(current, storage);
        return response({ operations, nextCursor, headCursor: current.headCursor, hasMore });
      });
    }

    if (url.pathname === '/v1/sync/acknowledgements' && request.method === 'POST') {
      const actorId = deviceHeader(request);
      const body = await jsonBody(request);
      return this.transaction(async (storage) => {
        const current = await this.state(storage);
        const actor =
          actorId === null ? undefined : activeDevice(current, actorId, requestAuth.publicKey);
        if (
          actor === undefined ||
          !record(body) ||
          body['deviceId'] !== actorId ||
          !safeCursor(body['cursor']) ||
          body['cursor'] < actor.acknowledgedCursor ||
          body['cursor'] > current.headCursor
        ) {
          return response({ error: 'Operation acknowledgement is invalid.' }, 400);
        }
        if (requestAuth.requestSequence <= actor.lastRequestSequence) {
          return response({ error: 'This signed sync request was already used.' }, 409);
        }
        current.devices[actor.deviceId] = {
          ...actor,
          acknowledgedCursor: body['cursor'],
          lastRequestSequence: requestAuth.requestSequence,
          lastSeenAt: now,
        };
        await this.save(current, storage);
        return response({
          ok: true,
          acknowledgedCursor: body['cursor'],
          headCursor: current.headCursor,
        });
      });
    }

    if (url.pathname === '/v1/sync/snapshot' && request.method === 'PUT') {
      const actorId = deviceHeader(request);
      const body = await jsonBody(request);
      return this.transaction(async (storage) => {
        const current = await this.state(storage);
        const actor =
          actorId === null ? undefined : activeDevice(current, actorId, requestAuth.publicKey);
        if (
          actor === undefined ||
          !validSnapshot(body) ||
          body.deviceId !== actorId ||
          body.keyEpoch !== current.currentKeyEpoch ||
          body.cursor > current.headCursor ||
          body.cursor < current.compactedThrough ||
          request.headers.get('x-melo-internal-backup-verified') !== 'true'
        ) {
          return response({ error: 'Encrypted snapshot checkpoint is invalid.' }, 400);
        }
        if (requestAuth.requestSequence <= actor.lastRequestSequence) {
          return response({ error: 'This signed sync request was already used.' }, 409);
        }
        current.previousSnapshot = current.latestSnapshot;
        current.latestSnapshot = body;
        current.devices[actor.deviceId] = {
          ...actor,
          lastRequestSequence: requestAuth.requestSequence,
          lastSeenAt: now,
        };
        await this.save(current, storage);
        return response({ ok: true, snapshot: body }, 201);
      });
    }

    if (url.pathname === '/v1/sync/snapshot' && request.method === 'GET') {
      const actorId = deviceHeader(request);
      return this.transaction(async (storage) => {
        const current = await this.state(storage);
        const actor =
          actorId === null ? undefined : activeDevice(current, actorId, requestAuth.publicKey);
        if (actor === undefined)
          return response({ error: 'An active registered device is required.' }, 403);
        if (requestAuth.requestSequence <= actor.lastRequestSequence) {
          return response({ error: 'This signed sync request was already used.' }, 409);
        }
        current.devices[actor.deviceId] = {
          ...actor,
          lastRequestSequence: requestAuth.requestSequence,
          lastSeenAt: now,
        };
        await this.save(current, storage);
        return response({
          exists: current.latestSnapshot !== undefined,
          snapshot: current.latestSnapshot ?? null,
        });
      });
    }

    if (url.pathname === '/v1/sync/key-transitions' && request.method === 'POST') {
      const actorId = deviceHeader(request);
      const body = await jsonBody(request);
      return this.transaction(async (storage) => {
        const current = await this.state(storage);
        const actor =
          actorId === null ? undefined : activeDevice(current, actorId, requestAuth.publicKey);
        if (actor === undefined || !validKeyTransition(body, current.currentKeyEpoch))
          return response({ error: 'Sync key transition is invalid.' }, 400);
        if (requestAuth.requestSequence <= actor.lastRequestSequence)
          return response({ error: 'This signed sync request was already used.' }, 409);
        const key = transitionKey(body.toKeyEpoch);
        const existing =
          (await storage.get<{ sealedKey: string }>(key)) ??
          current.keyTransitions?.[`${body.fromKeyEpoch}:${body.toKeyEpoch}`];
        if (existing !== undefined && existing.sealedKey !== body.sealedKey)
          return response({ error: 'A sync key transition cannot be replaced.' }, 409);
        await storage.put(key, {
          fromKeyEpoch: body.fromKeyEpoch,
          toKeyEpoch: body.toKeyEpoch,
          sealedKey: body.sealedKey,
        });
        current.devices[actor.deviceId] = {
          ...actor,
          lastRequestSequence: requestAuth.requestSequence,
          lastSeenAt: now,
        };
        await this.save(current, storage);
        return response({ ok: true });
      });
    }

    if (url.pathname === '/v1/sync/key-transitions' && request.method === 'GET') {
      const actorId = deviceHeader(request);
      const after = queryCursor(url.searchParams.get('afterEpoch'));
      if (after === null) return response({ error: 'Key history cursor is invalid.' }, 400);
      return this.transaction(async (storage) => {
        const current = await this.state(storage);
        const actor =
          actorId === null ? undefined : activeDevice(current, actorId, requestAuth.publicKey);
        if (actor === undefined)
          return response({ error: 'An active registered device is required.' }, 403);
        if (requestAuth.requestSequence <= actor.lastRequestSequence)
          return response({ error: 'This signed sync request was already used.' }, 409);
        current.devices[actor.deviceId] = {
          ...actor,
          lastRequestSequence: requestAuth.requestSequence,
          lastSeenAt: now,
        };
        for (const transition of Object.values(current.keyTransitions ?? {})) {
          if ((await storage.get(transitionKey(transition.toKeyEpoch))) === undefined) {
            await storage.put(transitionKey(transition.toKeyEpoch), transition);
          }
        }
        delete current.keyTransitions;
        await this.save(current, storage);
        const rows = [
          ...(
            await storage.list<{ fromKeyEpoch: number; toKeyEpoch: number; sealedKey: string }>({
              prefix: TRANSITION_PREFIX,
              startAfter: transitionKey(after),
              limit: 65,
            })
          ).values(),
        ];
        const hasMore = rows.length > 64;
        if (hasMore) rows.pop();
        return response({
          transitions: rows,
          hasMore,
          nextAfterEpoch: rows.at(-1)?.toKeyEpoch ?? after,
        });
      });
    }

    if (url.pathname === '/v1/sync/compaction' && request.method === 'POST') {
      const actorId = deviceHeader(request);
      const body = await jsonBody(request);
      if (!record(body) || !safeCursor(body['throughCursor'])) {
        return response({ error: 'Compaction cursor is invalid.' }, 400);
      }
      const throughCursor = body['throughCursor'] as number;
      return this.transaction(async (storage) => {
        const current = await this.state(storage);
        const actor =
          actorId === null ? undefined : activeDevice(current, actorId, requestAuth.publicKey);
        if (actor === undefined) {
          return response({ error: 'An active registered device is required.' }, 403);
        }
        if (requestAuth.requestSequence <= actor.lastRequestSequence) {
          return response({ error: 'This signed sync request was already used.' }, 409);
        }
        const active = Object.values(current.devices).filter(
          (device) => device.revokedAt === undefined,
        );
        const minimumActiveAck = Math.min(...active.map((device) => device.acknowledgedCursor));
        if (
          current.latestSnapshot === undefined ||
          throughCursor > current.latestSnapshot.cursor ||
          throughCursor > minimumActiveAck ||
          throughCursor < current.compactedThrough
        ) {
          return response(
            {
              error: 'Compaction is not safe for every active device and encrypted snapshot.',
              minimumActiveAck,
              snapshotCursor: current.latestSnapshot?.cursor ?? null,
            },
            409,
          );
        }
        const doomed = await storage.list<StoredOperation>({ prefix: OPERATION_PREFIX });
        let deletedCount = 0;
        for (const [key, operation] of doomed) {
          if (operation.cursor <= throughCursor && (await storage.delete(key))) deletedCount += 1;
        }
        current.compactedThrough = throughCursor;
        current.devices[actor.deviceId] = {
          ...actor,
          lastRequestSequence: requestAuth.requestSequence,
          lastSeenAt: now,
        };
        await this.save(current, storage);
        return response({ ok: true, compactedThrough: throughCursor, deletedCount });
      });
    }

    return response({ error: 'Route not found.' }, 404);
  }

  private async state(storage: SyncWorkspaceStorage = this.storage): Promise<WorkspaceState> {
    return (
      (await storage.get<WorkspaceState>(STATE_KEY)) ?? {
        version: 1,
        headCursor: 0,
        compactedThrough: 0,
        currentKeyEpoch: 1,
        devices: {},
      }
    );
  }

  private async save(
    state: WorkspaceState,
    storage: SyncWorkspaceStorage = this.storage,
  ): Promise<void> {
    await storage.put(STATE_KEY, state);
  }

  private async transaction(
    work: (storage: SyncWorkspaceStorage) => Promise<Response>,
  ): Promise<Response> {
    return this.storage.transaction(async (storage) => {
      // Signature verification/body reads await outside the transaction. Deletion can win
      // there; every normal route must recheck the fence at its actual mutation boundary.
      if ((await this.state(storage)).deleted) {
        return response({ error: 'This workspace sync authority has been deleted.' }, 410);
      }
      return work(storage);
    });
  }
}

export function storageAdapter(
  storage: DurableObjectStorage | DurableObjectTransaction,
): SyncWorkspaceStorage {
  return {
    get: (key) => storage.get(key),
    put: (key, value) => storage.put(key, value),
    delete: (key) => storage.delete(key),
    list: (options) => storage.list(options),
    deleteAll:
      'deleteAll' in storage
        ? () => storage.deleteAll()
        : async () => {
            throw new Error('deleteAll is unavailable inside a Durable Object transaction.');
          },
    transaction:
      'transaction' in storage
        ? (work) => storage.transaction((transaction) => work(storageAdapter(transaction)))
        : async () => {
            throw new Error('A Durable Object transaction is required at the workspace root.');
          },
  };
}

export class SyncWorkspaceDurableObject implements DurableObject {
  private readonly handler: SyncWorkspace;

  constructor(state: DurableObjectState) {
    this.handler = new SyncWorkspace(storageAdapter(state.storage));
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

async function deviceFingerprintMatches(value: {
  publicKey: string;
  publicKeyFingerprint: string;
}): Promise<boolean> {
  const publicKey = decodeBase64Url(value.publicKey);
  if (publicKey === null || publicKey.byteLength !== 32) return false;
  const digest = await crypto.subtle.digest('SHA-256', publicKey);
  return `sha256:${hexBytes(new Uint8Array(digest))}` === value.publicKeyFingerprint;
}

function validRotation(
  value: unknown,
  expectedEpoch: number,
): value is {
  newKeyEpoch: number;
  wrappedKeys: Record<string, string>;
  keyTransition: { fromKeyEpoch: number; toKeyEpoch: number; sealedKey: string };
} {
  if (
    !record(value) ||
    value['newKeyEpoch'] !== expectedEpoch ||
    !record(value['wrappedKeys']) ||
    !validKeyTransition(value['keyTransition'], expectedEpoch)
  ) {
    return false;
  }
  return Object.entries(value['wrappedKeys']).every(
    ([deviceId, wrapped]) => DEVICE_ID_PATTERN.test(deviceId) && safeOpaque(wrapped, 2048),
  );
}

function validKeyTransition(
  value: unknown,
  currentEpoch: number,
): value is { fromKeyEpoch: number; toKeyEpoch: number; sealedKey: string } {
  return (
    record(value) &&
    safePositiveInt(value['fromKeyEpoch']) &&
    safePositiveInt(value['toKeyEpoch']) &&
    value['toKeyEpoch'] === currentEpoch &&
    value['fromKeyEpoch'] === currentEpoch - 1 &&
    safeOpaque(value['sealedKey'], 4096)
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

function activeDevice(
  state: WorkspaceState,
  deviceId: string,
  expectedKey?: string,
): SyncDevice | undefined {
  const device = state.devices[deviceId];
  return device?.revokedAt === undefined &&
    (expectedKey === undefined || device?.publicKey === expectedKey)
    ? device
    : undefined;
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

function transitionKey(epoch: number): string {
  return `${TRANSITION_PREFIX}${String(epoch).padStart(16, '0')}`;
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

async function boundedRequestBody(stream: ReadableStream<Uint8Array>): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > 128 * 1024) {
        await reader.cancel();
        return null;
      }
      parts.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes;
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

async function verifySignedRequest(
  request: Request,
  state: WorkspaceState,
  now: string,
): Promise<RequestAuth | null> {
  const version = request.headers.get('x-melo-signature-version');
  const signedAt = request.headers.get('x-melo-signed-at');
  const nonce = request.headers.get('x-melo-nonce');
  const sequenceRaw = request.headers.get('x-melo-request-sequence');
  const expectedBodyHash = request.headers.get('x-melo-body-sha256')?.toLowerCase();
  const encodedSignature = request.headers.get('x-melo-signature');
  const actorId = deviceHeader(request);
  if (
    version !== '1' ||
    signedAt === null ||
    !isIso(signedAt) ||
    nonce === null ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(nonce) ||
    sequenceRaw === null ||
    !/^\d+$/.test(sequenceRaw) ||
    expectedBodyHash === undefined ||
    !CHECKSUM_PATTERN.test(expectedBodyHash) ||
    encodedSignature === null ||
    actorId === null
  ) {
    return null;
  }
  const requestSequence = Number.parseInt(sequenceRaw, 10);
  if (!safePositiveInt(requestSequence)) return null;
  const signedMs = Date.parse(signedAt);
  const nowMs = Date.parse(now);
  if (
    !Number.isFinite(signedMs) ||
    !Number.isFinite(nowMs) ||
    Math.abs(signedMs - nowMs) > 5 * 60_000
  ) {
    return null;
  }
  const bodyBytes = new Uint8Array(await request.clone().arrayBuffer());
  const actualBodyHash = await sha256Base64(bodyBytes);
  if (actualBodyHash !== expectedBodyHash) return null;

  let publicKeyValue: string | undefined;
  const isEnrollment =
    new URL(request.url).pathname === '/v1/sync/enrollment' && request.method === 'POST';
  if (state.devices[actorId] !== undefined) {
    const actor = isEnrollment ? state.devices[actorId] : activeDevice(state, actorId);
    if (actor === undefined || requestSequence <= actor.lastRequestSequence) return null;
    publicKeyValue = actor.publicKey;
  } else if (
    isEnrollment ||
    (new URL(request.url).pathname === '/v1/sync/devices' && request.method === 'POST')
  ) {
    const body = (await request
      .clone()
      .json()
      .catch(() => null)) as Record<string, unknown> | null;
    if (
      (!isEnrollment && Object.keys(state.devices).length !== 0) ||
      typeof body?.['deviceId'] !== 'string' ||
      body['deviceId'] !== actorId
    ) {
      return null;
    }
    publicKeyValue = typeof body['publicKey'] === 'string' ? body['publicKey'] : undefined;
    if (publicKeyValue === undefined) return null;
  } else {
    return null;
  }
  const publicKey = decodeBase64Url(publicKeyValue);
  const signature = decodeBase64Url(encodedSignature);
  if (publicKey === null || signature === null || signature.byteLength !== 64) return null;
  const url = new URL(request.url);
  const query = [...url.searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey
        ? compareCanonicalText(leftValue, rightValue)
        : compareCanonicalText(leftKey, rightKey),
    )
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  const message = [
    'melo.sync.v1',
    request.method.toUpperCase(),
    url.pathname,
    query,
    request.headers.get('x-melo-workspace-ref') ?? '',
    actorId,
    expectedBodyHash,
    signedAt,
    nonce,
    String(requestSequence),
  ].join('\n');
  try {
    const key = await crypto.subtle.importKey('raw', publicKey, { name: 'Ed25519' }, false, [
      'verify',
    ]);
    const valid = await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      signature,
      new TextEncoder().encode(message),
    );
    return valid ? { requestSequence, publicKey: publicKeyValue } : null;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = `${value.replace(/-/g, '+').replace(/_/g, '/')}${'='.repeat((4 - (value.length % 4)) % 4)}`;
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function sha256Base64(value: string | Uint8Array): Promise<string> {
  const bytes =
    typeof value === 'string'
      ? Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
      : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexBytes(bytes: Uint8Array): string {
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
