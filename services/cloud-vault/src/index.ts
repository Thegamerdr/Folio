import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

const LATEST_NAME = 'latest.melo-backup';
const PREVIOUS_NAME = 'previous.melo-backup';
const DEFAULT_MAX_BACKUP_BYTES = 4 * 1024 * 1024;
const PERSONAL_WORKSPACE_ID = 'workspace_personal_local';
const WORKSPACE_REF_HEADER = 'x-melo-workspace-ref';
const WORKSPACE_REF_PATTERN = /^[a-f0-9]{64}$/;

type BackupObject = Readonly<{
  body: ReadableStream;
  size: number;
  etag: string;
  uploaded: Date;
  customMetadata?: Record<string, string>;
}>;

export type BackupStore = Readonly<{
  get: (key: string) => Promise<BackupObject | null>;
  head: (key: string) => Promise<Omit<BackupObject, 'body'> | null>;
  put: (
    key: string,
    value: ReadableStream | Uint8Array,
    options: Readonly<{
      sha256?: ArrayBuffer;
      customMetadata: Record<string, string>;
    }>,
  ) => Promise<void>;
  delete: (keys: readonly string[]) => Promise<void>;
  list: (prefix: string) => Promise<readonly string[]>;
}>;

type AuthenticatedRequest = Readonly<{
  userId: string;
  token: JWTPayload;
}>;

const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return preflight(request, env);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json(
        { ok: true, service: 'melo-cloud-vault', plaintextStored: false },
        200,
        request,
        env,
      );
    }

    let auth: AuthenticatedRequest;
    try {
      auth = await authenticate(request, env);
    } catch (error: unknown) {
      console.error(
        JSON.stringify({
          message: 'cloud vault authentication failed',
          path: url.pathname,
          error: error instanceof Error ? error.message : 'unknown',
        }),
      );
      return json({ error: 'Unauthorized.' }, 401, request, env);
    }

    try {
      return await handleAuthenticatedRequest(
        request,
        kvStore(env.VAULTS),
        auth.userId,
        positiveInt(env.MAX_BACKUP_BYTES, DEFAULT_MAX_BACKUP_BYTES),
        env,
      );
    } catch (error: unknown) {
      console.error(
        JSON.stringify({
          message: 'cloud vault request failed',
          path: url.pathname,
          user: await userStorageId(auth.userId),
          error: error instanceof Error ? error.message : 'unknown',
        }),
      );
      return json(
        { error: 'The encrypted backup service is temporarily unavailable.' },
        503,
        request,
        env,
      );
    }
  },
} satisfies ExportedHandler<Env>;

export async function handleAuthenticatedRequest(
  request: Request,
  store: BackupStore,
  userId: string,
  maxBackupBytes: number,
  env?: Pick<Env, 'ALLOWED_ORIGINS'>,
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'DELETE' && url.pathname === '/v1/account') {
    const prefix = `${await userStoragePrefix(userId)}/`;
    await store.delete(await store.list(prefix));
    return json({ ok: true, deleted: true, scope: 'account-cloud-data' }, 200, request, env);
  }

  const workspaceScope = await workspaceScopeFromRequest(request);
  if (workspaceScope === null) {
    return json({ error: 'A valid opaque workspace reference is required.' }, 400, request, env);
  }
  const workspaceRef = workspaceScope.workspaceRef;
  const keys = await backupObjectKeys(userId, workspaceRef);
  const personalRef = await workspaceStorageId(PERSONAL_WORKSPACE_ID);
  const legacyKeys =
    workspaceRef === personalRef ? await legacyBackupObjectKeys(userId) : undefined;

  if (request.method === 'GET' && url.pathname === '/v1/backup') {
    const resolved = workspaceScope.legacyClient
      ? legacyKeys === undefined
        ? null
        : await resolveBackupHead(store, legacyKeys)
      : await resolveBackupHead(store, keys, legacyKeys);
    const latest = resolved?.latest ?? null;
    return json(
      latest === null
        ? { exists: false }
        : {
            exists: true,
            createdAt: latest.customMetadata?.['createdAt'] ?? latest.uploaded.toISOString(),
            size: latest.size,
            checksum: latest.customMetadata?.['checksum'] ?? null,
            deviceId: latest.customMetadata?.['deviceId'] ?? null,
            generations: (await store.head(resolved!.keys.previous)) === null ? 1 : 2,
          },
      200,
      request,
      env,
    );
  }

  if (request.method === 'GET' && url.pathname === '/v1/backup/content') {
    const resolved = workspaceScope.legacyClient
      ? legacyKeys === undefined
        ? null
        : await resolveBackupObject(store, legacyKeys)
      : await resolveBackupObject(store, keys, legacyKeys);
    const latest = resolved?.latest ?? null;
    if (latest === null) return json({ error: 'No encrypted backup exists.' }, 404, request, env);
    return new Response(latest.body, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/vnd.melo.encrypted-backup+json',
        ETag: latest.etag,
        'X-Melo-Checksum': latest.customMetadata?.['checksum'] ?? '',
        ...corsHeaders(request, env),
      },
    });
  }

  if (request.method === 'PUT' && url.pathname === '/v1/backup') {
    const declaredSize = contentLength(request);
    if (declaredSize === null) {
      return json({ error: 'Content-Length is required.' }, 411, request, env);
    }
    if (declaredSize <= 0 || declaredSize > maxBackupBytes) {
      return json(
        { error: `Encrypted backup must be between 1 and ${maxBackupBytes} bytes.` },
        413,
        request,
        env,
      );
    }
    const expectedChecksum = request.headers.get('x-melo-checksum')?.trim().toLowerCase();
    if (expectedChecksum === undefined || !/^[a-f0-9]{64}$/.test(expectedChecksum)) {
      return json({ error: 'A SHA-256 checksum is required.' }, 400, request, env);
    }
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength !== declaredSize || bytes.byteLength > maxBackupBytes) {
      return json(
        { error: 'Encrypted backup size did not match the declared size.' },
        400,
        request,
        env,
      );
    }
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const actualChecksum = hex(digest);
    if (actualChecksum !== expectedChecksum) {
      return json({ error: 'Encrypted backup checksum did not match.' }, 400, request, env);
    }
    const createdAt = request.headers.get('x-melo-created-at')?.trim() || new Date().toISOString();
    const deviceId = boundedMetadata(request.headers.get('x-melo-device'), 128) ?? 'unknown';
    const metadata = { checksum: actualChecksum, createdAt, deviceId };
    const hadScopedGeneration = await rotateBackupGeneration(store, keys, bytes, digest, metadata);
    if (legacyKeys !== undefined && workspaceScope.legacyClient) {
      // A pre-workspace client still writes its v1 envelope to the legacy path. New clients write
      // only v2 to the scoped path, so an old client is never handed an envelope it cannot open.
      await rotateBackupGeneration(store, legacyKeys, bytes, digest, metadata);
    }
    return json(
      {
        ok: true,
        createdAt,
        checksum: actualChecksum,
        generations: hadScopedGeneration ? 2 : 1,
      },
      201,
      request,
      env,
    );
  }

  if (request.method === 'DELETE' && url.pathname === '/v1/backup') {
    await store.delete([
      keys.latest,
      keys.previous,
      ...(legacyKeys === undefined ? [] : [legacyKeys.latest, legacyKeys.previous]),
    ]);
    return json({ ok: true, deleted: true, scope: 'backup' }, 200, request, env);
  }

  return json({ error: 'Route not found.' }, 404, request, env);
}

async function authenticate(request: Request, env: Env): Promise<AuthenticatedRequest> {
  const authorization = request.headers.get('Authorization') ?? '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  if (token.length === 0) throw new Error('missing bearer token');
  const jwksUrl = new URL(env.CLERK_JWKS_URL);
  let jwks = jwksByUrl.get(jwksUrl.href);
  if (jwks === undefined) {
    jwks = createRemoteJWKSet(jwksUrl);
    jwksByUrl.set(jwksUrl.href, jwks);
  }
  const verified = await jwtVerify(token, jwks, {
    algorithms: ['RS256'],
    issuer: env.CLERK_ISSUER,
  });
  const userId = verified.payload.sub;
  if (typeof userId !== 'string' || userId.length === 0) throw new Error('missing subject');
  if (verified.payload['sts'] === 'pending') throw new Error('pending session');
  const allowedParties = commaList(env.ALLOWED_ORIGINS);
  const authorizedParty = verified.payload['azp'];
  if (
    allowedParties.length > 0 &&
    (typeof authorizedParty !== 'string' || !allowedParties.includes(authorizedParty))
  ) {
    throw new Error('unauthorized party');
  }
  return { userId, token: verified.payload };
}

type KvBackupMetadata = Readonly<{
  size: number;
  etag: string;
  uploaded: string;
  customMetadata: Record<string, string>;
}>;

function kvStore(namespace: KVNamespace): BackupStore {
  return {
    get: async (key) => {
      const object = await namespace.getWithMetadata<KvBackupMetadata>(key, 'stream');
      if (object.value === null) return null;
      const metadata = validKvMetadata(object.metadata);
      if (metadata === null) throw new Error('backup metadata is missing or invalid');
      return {
        body: object.value,
        size: metadata.size,
        etag: metadata.etag,
        uploaded: new Date(metadata.uploaded),
        customMetadata: metadata.customMetadata,
      };
    },
    head: async (key) => {
      const object = await namespace.getWithMetadata<KvBackupMetadata>(key, 'stream');
      if (object.value === null) return null;
      await object.value.cancel();
      const metadata = validKvMetadata(object.metadata);
      if (metadata === null) throw new Error('backup metadata is missing or invalid');
      return {
        size: metadata.size,
        etag: metadata.etag,
        uploaded: new Date(metadata.uploaded),
        customMetadata: metadata.customMetadata,
      };
    },
    put: async (key, value, options) => {
      const bytes =
        value instanceof Uint8Array
          ? value
          : new Uint8Array(await new Response(value).arrayBuffer());
      const checksum =
        options.customMetadata['checksum'] ?? hex(await crypto.subtle.digest('SHA-256', bytes));
      await namespace.put(key, bytes, {
        metadata: {
          size: bytes.byteLength,
          etag: `"${checksum}"`,
          uploaded: new Date().toISOString(),
          customMetadata: options.customMetadata,
        } satisfies KvBackupMetadata,
      });
    },
    delete: async (keys) => {
      await Promise.all(keys.map((key) => namespace.delete(key)));
    },
    list: async (prefix) => {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await namespace.list({ prefix, ...(cursor === undefined ? {} : { cursor }) });
        keys.push(...page.keys.map((key) => key.name));
        cursor = page.list_complete ? undefined : page.cursor;
        if (page.list_complete) break;
      } while (cursor !== undefined);
      return keys;
    },
  };
}

function validKvMetadata(value: KvBackupMetadata | null): KvBackupMetadata | null {
  if (
    value === null ||
    !Number.isSafeInteger(value.size) ||
    value.size < 0 ||
    typeof value.etag !== 'string' ||
    typeof value.uploaded !== 'string' ||
    !Number.isFinite(Date.parse(value.uploaded)) ||
    value.customMetadata === null ||
    typeof value.customMetadata !== 'object'
  ) {
    return null;
  }
  return value;
}

export async function backupObjectKeys(
  userId: string,
  workspaceRef: string,
): Promise<{ latest: string; previous: string }> {
  const normalized = normalizeWorkspaceRef(workspaceRef);
  if (normalized === null) throw new Error('invalid workspace reference');
  const prefix = `${await userStoragePrefix(userId)}/workspaces/${normalized}`;
  return { latest: `${prefix}/${LATEST_NAME}`, previous: `${prefix}/${PREVIOUS_NAME}` };
}

export async function legacyBackupObjectKeys(
  userId: string,
): Promise<{ latest: string; previous: string }> {
  const prefix = await userStoragePrefix(userId);
  return { latest: `${prefix}/${LATEST_NAME}`, previous: `${prefix}/${PREVIOUS_NAME}` };
}

async function userStoragePrefix(userId: string): Promise<string> {
  return `users/${await userStorageId(userId)}`;
}

async function workspaceScopeFromRequest(
  request: Request,
): Promise<{ workspaceRef: string; legacyClient: boolean } | null> {
  const supplied = request.headers.get(WORKSPACE_REF_HEADER);
  if (supplied === null) {
    // Compatibility for mobile builds predating workspace isolation. Those builds can only hold
    // Personal data, so an absent header has one safe historic interpretation.
    return { workspaceRef: await workspaceStorageId(PERSONAL_WORKSPACE_ID), legacyClient: true };
  }
  const workspaceRef = normalizeWorkspaceRef(supplied);
  return workspaceRef === null ? null : { workspaceRef, legacyClient: false };
}

function normalizeWorkspaceRef(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return WORKSPACE_REF_PATTERN.test(normalized) ? normalized : null;
}

async function workspaceStorageId(workspaceId: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(workspaceId)));
}

type BackupKeys = Awaited<ReturnType<typeof backupObjectKeys>>;

async function resolveBackupHead(
  store: BackupStore,
  scoped: BackupKeys,
  legacy?: BackupKeys,
): Promise<{ latest: Omit<BackupObject, 'body'>; keys: BackupKeys } | null> {
  const current = await store.head(scoped.latest);
  if (current !== null) return { latest: current, keys: scoped };
  if (legacy === undefined) return null;
  const fallback = await store.head(legacy.latest);
  return fallback === null ? null : { latest: fallback, keys: legacy };
}

async function resolveBackupObject(
  store: BackupStore,
  scoped: BackupKeys,
  legacy?: BackupKeys,
): Promise<{ latest: BackupObject; keys: BackupKeys } | null> {
  const current = await store.get(scoped.latest);
  if (current !== null) return { latest: current, keys: scoped };
  if (legacy === undefined) return null;
  const fallback = await store.get(legacy.latest);
  return fallback === null ? null : { latest: fallback, keys: legacy };
}

async function rotateBackupGeneration(
  store: BackupStore,
  keys: BackupKeys,
  bytes: Uint8Array,
  digest: ArrayBuffer,
  customMetadata: Record<string, string>,
): Promise<boolean> {
  const latest = await store.get(keys.latest);
  if (latest !== null) {
    await store.put(keys.previous, latest.body, {
      customMetadata: latest.customMetadata ?? {},
    });
  }
  await store.put(keys.latest, bytes, { sha256: digest, customMetadata });
  return latest !== null;
}

async function userStorageId(userId: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId)));
}

function preflight(request: Request, env: Pick<Env, 'ALLOWED_ORIGINS'>): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

function json(
  payload: unknown,
  status: number,
  request: Request,
  env?: Pick<Env, 'ALLOWED_ORIGINS'>,
): Response {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store', ...corsHeaders(request, env) },
  });
}

function corsHeaders(request: Request, env?: Pick<Env, 'ALLOWED_ORIGINS'>): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowed = commaList(env?.ALLOWED_ORIGINS);
  const allowOrigin =
    origin !== null && allowed.includes(origin) ? origin : allowed.length === 0 ? '*' : 'null';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Authorization, Content-Type, Content-Length, X-Melo-Checksum, X-Melo-Created-At, X-Melo-Device, X-Melo-Workspace-Ref',
    'Access-Control-Expose-Headers': 'ETag, X-Melo-Checksum',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function contentLength(request: Request): number | null {
  const raw = request.headers.get('Content-Length');
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isSafeInteger(value) ? value : null;
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw?.trim() ?? '', 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function commaList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function boundedMetadata(value: string | null, maxLength: number): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

function hex(input: ArrayBuffer): string {
  return Array.from(new Uint8Array(input), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
