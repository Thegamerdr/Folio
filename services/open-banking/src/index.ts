import { createRemoteJWKSet, jwtVerify } from 'jose';

import {
  isValidEncryptionKey,
  openJson,
  sealJson,
  stablePublicId,
  storageUserId,
  storageWorkspaceId,
} from './crypto';
import { ProviderError, trueLayerGateway } from './truelayer';
import type {
  OpenBankingStore,
  ProviderAccountSecret,
  ProviderGateway,
  ProviderSecret,
  PublicAccount,
  PublicConnection,
  RuntimeEnv,
  StoredConnection,
} from './types';

const STATE_TTL_SECONDS = 20 * 60;
const FIRST_SYNC_DAYS = 90;
const REFRESH_OVERLAP_DAYS = 3;
const MAX_ACCOUNTS_PER_CONNECTION = 12;
const MAX_PROVIDER_DESCRIPTION = 180;
const WORKSPACE_REF_HEADER = 'X-Melo-Workspace-Ref';
const WORKSPACE_REF_PATTERN = /^[a-f0-9]{64}$/u;
const PERSONAL_WORKSPACE_ID = 'workspace_personal_local';
const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

type WorkspaceScope = Readonly<{
  workspaceRef: string;
  allowLegacyPersonal: boolean;
}>;

type LegacyStoredConnection = Omit<StoredConnection, 'v' | 'workspaceRef'> & { v: 1 };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const store = kvStore(env.OPEN_BANKING);
    const provider = trueLayerGateway(env as RuntimeEnv);
    try {
      return await handleRequest(request, store, provider, env as RuntimeEnv, async () =>
        authenticate(request, env),
      );
    } catch (reason: unknown) {
      const error = reason instanceof ProviderError ? reason : null;
      console.error(
        JSON.stringify({
          message: 'open banking request failed',
          path: new URL(request.url).pathname,
          code: error?.code ?? 'internal_error',
        }),
      );
      return json(
        {
          error:
            error?.code === 'provider_not_configured'
              ? 'Bank connection is not configured for this Melo build yet.'
              : 'Bank connection is temporarily unavailable. Your local Melo data is unchanged.',
          code: error?.code ?? 'service_unavailable',
        },
        error !== null && error.status >= 400 && error.status <= 599 ? error.status : 502,
        request,
        env,
      );
    }
  },
} satisfies ExportedHandler<Env>;

export async function handleRequest(
  request: Request,
  store: OpenBankingStore,
  provider: ProviderGateway,
  env: RuntimeEnv,
  authenticateRequest: () => Promise<string>,
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return preflight(request, env);
  const configurationIssues = serviceConfigurationIssues(env, provider);
  if (request.method === 'GET' && url.pathname === '/health') {
    const enabled = openBankingEnabled(env);
    return json(
      {
        ok: true,
        service: 'melo-open-banking',
        featureEnabled: enabled,
        provider: 'truelayer-data-v3',
        providerConfigured: provider.configured,
        configurationReady: configurationIssues.length === 0,
        activationReady: enabled && provider.configured && configurationIssues.length === 0,
        environment: provider.environment,
        providerCredentialsInApp: false,
        directLedgerWrites: false,
      },
      200,
      request,
      env,
    );
  }
  // Provider credentials and a public Worker URL are not sufficient to ship this feature. The
  // current release candidate keeps the whole route dark until regulated-provider approval and
  // store/privacy declarations are complete.
  const accountDeletion = request.method === 'DELETE' && url.pathname === '/v1/account';
  if (!accountDeletion && !openBankingEnabled(env)) {
    return json(
      { error: 'Bank connection is not available in this release.', code: 'feature_disabled' },
      404,
      request,
      env,
    );
  }
  if (!accountDeletion && configurationIssues.length > 0) {
    return json(
      {
        error: 'Bank connection configuration is incomplete.',
        code: 'service_not_configured',
      },
      503,
      request,
      env,
    );
  }
  if (request.method === 'GET' && url.pathname === '/v1/callback') {
    return handleCallback(request, store, env);
  }

  let userId: string;
  try {
    userId = await authenticateRequest();
  } catch {
    return json(
      { error: 'Sign in again to use bank connection.', code: 'unauthorized' },
      401,
      request,
      env,
    );
  }
  const userHash = await storageUserId(userId);
  return handleAuthenticatedRequest(request, store, provider, env, userHash);
}

function openBankingEnabled(env: Pick<RuntimeEnv, 'OPEN_BANKING_ENABLED'>): boolean {
  return env.OPEN_BANKING_ENABLED === 'true';
}

export async function handleAuthenticatedRequest(
  request: Request,
  store: OpenBankingStore,
  provider: ProviderGateway,
  env: RuntimeEnv,
  userHash: string,
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'DELETE' && url.pathname === '/v1/account') {
    const deleted = await deleteAccountConnections(store, userHash);
    return json(
      {
        ok: true,
        deletedConnections: deleted,
        futureAccessStopped: true,
        providerSecretsDeleted: true,
        providerRevocationSupported: false,
        pendingCallbackMetadataExpiresWithinSeconds: STATE_TTL_SECONDS,
      },
      200,
      request,
      env,
    );
  }

  const scope = await workspaceScopeFromRequest(request);
  if (scope === null) {
    return json(
      { error: 'The selected Melo workspace is invalid.', code: 'invalid_workspace' },
      400,
      request,
      env,
    );
  }
  if (request.method === 'GET' && url.pathname === '/v1/connections') {
    const records = await listConnections(store, userHash, scope);
    return json(
      { providerConfigured: provider.configured, connections: records.map(publicConnection) },
      200,
      request,
      env,
    );
  }

  if (request.method === 'POST' && url.pathname === '/v1/connections') {
    if (!provider.configured) throw new ProviderError('provider_not_configured', 503);
    const body = await safeJsonBody(request, 4096);
    const displayName = validDisplayName(body['displayName']);
    const email = validEmail(body['email']);
    if (displayName === null || email === null) {
      return json(
        {
          error: 'Enter your full name and signed-in email before continuing to the bank.',
          code: 'invalid_profile',
        },
        400,
        request,
        env,
      );
    }
    const encryptionKey = requiredEncryptionKey(env);
    const localConnectionId = crypto.randomUUID();
    const state = randomState();
    const returnUri = `${trimSlash(env.PUBLIC_BASE_URL)}/v1/callback?state=${encodeURIComponent(state)}`;
    const created = await provider.createConnection({
      displayName,
      email,
      returnUri,
      localConnectionId,
      ...(clientIp(request) === undefined ? {} : { endUserIp: clientIp(request) }),
    });
    const now = new Date().toISOString();
    const record: StoredConnection = {
      v: 2,
      workspaceRef: scope.workspaceRef,
      id: localConnectionId,
      provider: 'truelayer-data-v3',
      status: 'pending_redirect',
      scopes: ['accounts', 'transactions'],
      createdAt: now,
      callbackAt: null,
      grantedAt: null,
      expiresAt: null,
      disconnectedAt: null,
      lastSuccessfulRefreshAt: null,
      lastErrorCode: null,
      accounts: [],
      sealedProvider: await sealJson(
        {
          providerConnectionId: created.providerConnectionId,
          accounts: [],
        } satisfies ProviderSecret,
        encryptionKey,
        providerSecretBinding(userHash, scope.workspaceRef, localConnectionId),
      ),
    };
    await Promise.all([
      putConnection(store, userHash, scope.workspaceRef, record),
      addConnectionToIndex(store, userHash, scope.workspaceRef, localConnectionId),
      store.put(
        stateKey(state),
        JSON.stringify({
          v: 2,
          userHash,
          workspaceRef: scope.workspaceRef,
          localConnectionId,
          createdAt: now,
        }),
        {
          expirationTtl: STATE_TTL_SECONDS,
        },
      ),
    ]);
    return json(
      {
        connection: publicConnection(record),
        authorizationUrl: created.authorizationUrl,
        returnUri: env.APP_RETURN_URI,
      },
      201,
      request,
      env,
    );
  }

  const route = connectionRoute(url.pathname);
  if (route === null)
    return json({ error: 'Route not found.', code: 'not_found' }, 404, request, env);
  const record = await getOwnedConnection(store, userHash, scope, route.connectionId);
  if (record === null) {
    return json({ error: 'Bank connection was not found.', code: 'not_found' }, 404, request, env);
  }

  if (request.method === 'POST' && route.action === 'sync') {
    if (!provider.configured) throw new ProviderError('provider_not_configured', 503);
    if (record.status === 'pending_redirect') {
      return json(
        {
          error: 'Finish the bank authorisation before refreshing.',
          code: 'authorization_pending',
        },
        409,
        request,
        env,
      );
    }
    if (record.status === 'disconnected' || record.sealedProvider === null) {
      return json(
        {
          error: 'This connection is disconnected. Connect the bank again to refresh.',
          code: 'disconnected',
        },
        409,
        request,
        env,
      );
    }
    try {
      const result = await syncConnection(
        store,
        provider,
        env,
        userHash,
        scope.workspaceRef,
        record,
        clientIp(request),
      );
      return json(result.payload, result.status, request, env);
    } catch (reason: unknown) {
      const code = reason instanceof ProviderError ? reason.code : 'provider_error';
      await putConnection(store, userHash, scope.workspaceRef, {
        ...record,
        status: 'error',
        lastErrorCode: code,
      });
      throw reason;
    }
  }

  if (request.method === 'DELETE' && route.action === null) {
    const now = new Date().toISOString();
    const disconnected: StoredConnection = {
      ...record,
      status: 'disconnected',
      disconnectedAt: now,
      lastErrorCode: null,
      sealedProvider: null,
    };
    await putConnection(store, userHash, scope.workspaceRef, disconnected);
    return json(
      {
        connection: publicConnection(disconnected),
        futureAccessStopped: true,
        providerRevocationSupported: false,
        localHistoryChanged: false,
      },
      200,
      request,
      env,
    );
  }

  return json({ error: 'Route not found.', code: 'not_found' }, 404, request, env);
}

export async function handleCallback(
  request: Request,
  store: OpenBankingStore,
  env: Pick<RuntimeEnv, 'APP_RETURN_URI' | 'ALLOWED_ORIGINS'>,
): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get('state')?.trim() ?? '';
  if (!/^[A-Za-z0-9_-]{32,160}$/u.test(state)) {
    return json({ error: 'Invalid bank return state.', code: 'invalid_state' }, 400, request, env);
  }
  const key = stateKey(state);
  const rawState = await store.get(key);
  await store.delete(key);
  const callbackState = await parseCallbackState(rawState);
  if (callbackState === null) {
    return redirectToApp(env.APP_RETURN_URI, { status: 'expired' });
  }
  const scope: WorkspaceScope = {
    workspaceRef: callbackState.workspaceRef,
    allowLegacyPersonal: callbackState.legacyPersonal,
  };
  const record = await getOwnedConnection(
    store,
    callbackState.userHash,
    scope,
    callbackState.localConnectionId,
  );
  if (record === null) return redirectToApp(env.APP_RETURN_URI, { status: 'missing' });
  if (record.status === 'disconnected') {
    return redirectToApp(env.APP_RETURN_URI, { status: 'disconnected', connection: record.id });
  }
  const returnedError = url.searchParams.get('error');
  const now = new Date().toISOString();
  const next: StoredConnection = returnedError
    ? { ...record, status: 'error', callbackAt: now, lastErrorCode: 'authorization_failed' }
    : {
        ...record,
        status: 'pending_sync',
        callbackAt: now,
        grantedAt: now,
        expiresAt: addDays(now, 90),
        lastErrorCode: null,
      };
  await putConnection(store, callbackState.userHash, callbackState.workspaceRef, next);
  return redirectToApp(env.APP_RETURN_URI, {
    status: returnedError ? 'error' : 'connected',
    connection: record.id,
  });
}

async function syncConnection(
  store: OpenBankingStore,
  provider: ProviderGateway,
  env: RuntimeEnv,
  userHash: string,
  workspaceRef: string,
  record: StoredConnection,
  endUserIp?: string,
): Promise<{ status: number; payload: unknown }> {
  const encryptionKey = requiredEncryptionKey(env);
  const secret = await openJson<ProviderSecret>(
    record.sealedProvider as NonNullable<StoredConnection['sealedProvider']>,
    encryptionKey,
    providerSecretBinding(userHash, workspaceRef, record.id),
  );
  const context = endUserIp === undefined ? undefined : { endUserIp };
  const providerAccounts = (
    await provider.listAccounts(secret.providerConnectionId, context)
  ).slice(0, MAX_ACCOUNTS_PER_CONNECTION);
  const reconciled = await reconcileAccounts(record, secret, providerAccounts);
  const candidates: Array<{
    externalId: string;
    connectionId: string;
    accountRef: string;
    bookingStatus: 'pending' | 'posted';
    occurredAt: string;
    amountMinor: number;
    currency: string;
    description: string;
  }> = [];
  let pending = false;
  let moreAvailable = false;
  let completedAnAccount = false;

  for (const providerAccount of reconciled.secret.accounts) {
    const publicAccount = reconciled.publicByRef.get(providerAccount.accountRef);
    if (publicAccount === undefined) continue;
    const today = new Date().toISOString().slice(0, 10);
    const from =
      providerAccount.rangeFrom ??
      subtractDays(
        publicAccount.lastSuccessfulRefreshAt ??
          record.lastSuccessfulRefreshAt ??
          new Date().toISOString(),
        publicAccount.lastSuccessfulRefreshAt === null && record.lastSuccessfulRefreshAt === null
          ? FIRST_SYNC_DAYS
          : REFRESH_OVERLAP_DAYS,
      );
    const to = providerAccount.rangeTo ?? today;
    providerAccount.rangeFrom = from;
    providerAccount.rangeTo = to;
    if (providerAccount.pendingRequestId === undefined) {
      const created = await provider.createTransactionsRequest(
        secret.providerConnectionId,
        providerAccount.providerAccountId,
        {
          from,
          to,
          ...(providerAccount.cursor !== undefined ? { cursor: providerAccount.cursor } : {}),
        },
        context,
      );
      providerAccount.pendingRequestId = created.requestId;
    }
    const page = await pollTransactions(
      provider,
      secret.providerConnectionId,
      providerAccount.providerAccountId,
      providerAccount.pendingRequestId,
      context,
    );
    if (page.status === 'pending') {
      pending = true;
      continue;
    }
    if (page.status === 'failed') {
      throw new ProviderError(safeCode(page.reason), 502);
    }
    providerAccount.pendingRequestId = undefined;
    providerAccount.cursor = page.nextCursor ?? undefined;
    moreAvailable ||= page.nextCursor !== null;
    if (page.nextCursor === null) {
      providerAccount.rangeFrom = undefined;
      providerAccount.rangeTo = undefined;
      completedAnAccount = true;
      const refreshedAt = new Date().toISOString();
      reconciled.publicByRef.set(providerAccount.accountRef, {
        ...publicAccount,
        lastSuccessfulRefreshAt: refreshedAt,
      });
    }
    for (const item of page.items) {
      candidates.push({
        externalId: `bank-${await stablePublicId(`${record.id}:${providerAccount.accountRef}:${item.id}`)}`,
        connectionId: record.id,
        accountRef: providerAccount.accountRef,
        bookingStatus: item.status === 'pending' ? 'pending' : 'posted',
        occurredAt: item.timestamp.slice(0, 10),
        amountMinor: item.amountInMinor,
        currency: item.currency,
        description: boundedDescription(item.description),
      });
    }
  }

  const refreshedAt = completedAnAccount
    ? new Date().toISOString()
    : record.lastSuccessfulRefreshAt;
  const nextRecord: StoredConnection = {
    ...record,
    status: 'active',
    grantedAt: record.grantedAt ?? new Date().toISOString(),
    expiresAt: record.expiresAt ?? addDays(new Date().toISOString(), 90),
    lastSuccessfulRefreshAt: refreshedAt,
    lastErrorCode: null,
    accounts: [...reconciled.publicByRef.values()],
    sealedProvider: await sealJson(
      reconciled.secret,
      encryptionKey,
      providerSecretBinding(userHash, workspaceRef, record.id),
    ),
  };
  await putConnection(store, userHash, workspaceRef, nextRecord);
  return {
    status: candidates.length === 0 && pending ? 202 : 200,
    payload: {
      connection: publicConnection(nextRecord),
      candidates,
      pending,
      moreAvailable,
      directLedgerWrites: false,
    },
  };
}

async function reconcileAccounts(
  record: StoredConnection,
  secret: ProviderSecret,
  accounts: readonly {
    id: string;
    type: 'account' | 'card';
    accountType: 'current' | 'savings' | 'card';
    customerSegment: 'retail' | 'business';
    currency: string;
  }[],
): Promise<{
  secret: ProviderSecret;
  publicByRef: Map<string, PublicAccount>;
}> {
  const existingPublic = new Map(record.accounts.map((account) => [account.accountRef, account]));
  const existingSecrets = new Map(
    secret.accounts.map((account) => [account.providerAccountId, account]),
  );
  const nextSecrets: ProviderAccountSecret[] = [];
  const publicByRef = new Map<string, PublicAccount>();
  const labelCount = new Map<string, number>();
  for (const account of accounts) {
    const previousSecret = existingSecrets.get(account.id);
    const accountRef =
      previousSecret?.accountRef ?? `account-${await stablePublicId(`${record.id}:${account.id}`)}`;
    const baseLabel =
      account.accountType === 'savings'
        ? 'Savings account'
        : account.accountType === 'card'
          ? 'Card'
          : 'Current account';
    const occurrence = (labelCount.get(baseLabel) ?? 0) + 1;
    labelCount.set(baseLabel, occurrence);
    const previousPublic = existingPublic.get(accountRef);
    nextSecrets.push({
      accountRef,
      providerAccountId: account.id,
      ...(previousSecret?.cursor !== undefined ? { cursor: previousSecret.cursor } : {}),
      ...(previousSecret?.rangeFrom !== undefined ? { rangeFrom: previousSecret.rangeFrom } : {}),
      ...(previousSecret?.rangeTo !== undefined ? { rangeTo: previousSecret.rangeTo } : {}),
      ...(previousSecret?.pendingRequestId !== undefined
        ? { pendingRequestId: previousSecret.pendingRequestId }
        : {}),
    });
    publicByRef.set(accountRef, {
      accountRef,
      label: previousPublic?.label ?? `${baseLabel}${occurrence > 1 ? ` ${occurrence}` : ''}`,
      currency: account.currency,
      kind: account.customerSegment === 'business' ? 'business' : 'personal',
      accountType: account.accountType,
      lastSuccessfulRefreshAt: previousPublic?.lastSuccessfulRefreshAt ?? null,
    });
  }
  return {
    secret: { providerConnectionId: secret.providerConnectionId, accounts: nextSecrets },
    publicByRef,
  };
}

async function pollTransactions(
  provider: ProviderGateway,
  providerConnectionId: string,
  providerAccountId: string,
  requestId: string,
  context?: Readonly<{ endUserIp?: string }>,
) {
  const delays = [0, 250, 500, 1000, 1500] as const;
  let result = await provider.getTransactionsRequest(
    providerConnectionId,
    providerAccountId,
    requestId,
    context,
  );
  for (const delayMs of delays.slice(1)) {
    if (result.status !== 'pending') return result;
    await delay(delayMs);
    result = await provider.getTransactionsRequest(
      providerConnectionId,
      providerAccountId,
      requestId,
      context,
    );
  }
  return result;
}

async function authenticate(request: Request, env: Env): Promise<string> {
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
  return userId;
}

function kvStore(namespace: KVNamespace): OpenBankingStore {
  return {
    get: (key) => namespace.get(key),
    put: (key, value, options) =>
      namespace.put(
        key,
        value,
        options?.expirationTtl ? { expirationTtl: options.expirationTtl } : undefined,
      ),
    delete: (key) => namespace.delete(key),
    list: async (prefix) => {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await namespace.list({ prefix, ...(cursor === undefined ? {} : { cursor }) });
        keys.push(...page.keys.map((key) => key.name));
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor !== undefined);
      return keys;
    },
  };
}

async function listConnections(
  store: OpenBankingStore,
  userHash: string,
  scope: WorkspaceScope,
): Promise<StoredConnection[]> {
  const ids = await connectionIndex(store, userHash, scope.workspaceRef);
  const records = await Promise.all(
    ids.map((id) => getConnection(store, userHash, scope.workspaceRef, id)),
  );
  const byId = new Map(
    records
      .filter((record): record is StoredConnection => record !== null)
      .map((record) => [record.id, record]),
  );
  if (!scope.allowLegacyPersonal) return [...byId.values()];

  const legacyIds = await legacyConnectionIndex(store, userHash);
  const legacyRecords = await Promise.all(
    legacyIds.map((id) => getLegacyConnection(store, userHash, id)),
  );
  const migrations: StoredConnection[] = [];
  for (const legacy of legacyRecords) {
    if (legacy === null || byId.has(legacy.id)) continue;
    const migrated = migrateLegacyConnection(legacy, scope.workspaceRef);
    byId.set(migrated.id, migrated);
    migrations.push(migrated);
  }
  if (migrations.length > 0) {
    await Promise.all(
      migrations.map((record) => putConnection(store, userHash, scope.workspaceRef, record)),
    );
    await writeConnectionIndex(store, userHash, scope.workspaceRef, [...byId.keys()]);
  }
  return [...byId.values()];
}

async function getOwnedConnection(
  store: OpenBankingStore,
  userHash: string,
  scope: WorkspaceScope,
  connectionId: string,
): Promise<StoredConnection | null> {
  const ids = await connectionIndex(store, userHash, scope.workspaceRef);
  if (ids.includes(connectionId)) {
    return getConnection(store, userHash, scope.workspaceRef, connectionId);
  }
  if (!scope.allowLegacyPersonal) return null;
  const legacyIds = await legacyConnectionIndex(store, userHash);
  if (!legacyIds.includes(connectionId)) return null;
  const legacy = await getLegacyConnection(store, userHash, connectionId);
  if (legacy === null) return null;
  const migrated = migrateLegacyConnection(legacy, scope.workspaceRef);
  await Promise.all([
    putConnection(store, userHash, scope.workspaceRef, migrated),
    addConnectionToIndex(store, userHash, scope.workspaceRef, connectionId),
  ]);
  return migrated;
}

async function getConnection(
  store: OpenBankingStore,
  userHash: string,
  workspaceRef: string,
  connectionId: string,
): Promise<StoredConnection | null> {
  const raw = await store.get(recordKey(userHash, workspaceRef, connectionId));
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isStoredConnection(parsed) && parsed.workspaceRef === workspaceRef ? parsed : null;
  } catch {
    return null;
  }
}

async function getLegacyConnection(
  store: OpenBankingStore,
  userHash: string,
  connectionId: string,
): Promise<LegacyStoredConnection | null> {
  const raw = await store.get(legacyRecordKey(userHash, connectionId));
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isLegacyStoredConnection(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function putConnection(
  store: OpenBankingStore,
  userHash: string,
  workspaceRef: string,
  connection: StoredConnection,
): Promise<void> {
  if (connection.workspaceRef !== workspaceRef) {
    throw new Error('Bank connection workspace mismatch.');
  }
  await store.put(recordKey(userHash, workspaceRef, connection.id), JSON.stringify(connection));
}

async function addConnectionToIndex(
  store: OpenBankingStore,
  userHash: string,
  workspaceRef: string,
  connectionId: string,
): Promise<void> {
  const current = await connectionIndex(store, userHash, workspaceRef);
  const next = [connectionId, ...current.filter((id) => id !== connectionId)].slice(0, 10);
  await writeConnectionIndex(store, userHash, workspaceRef, next);
}

async function writeConnectionIndex(
  store: OpenBankingStore,
  userHash: string,
  workspaceRef: string,
  ids: readonly string[],
): Promise<void> {
  await store.put(indexKey(userHash, workspaceRef), JSON.stringify(ids.slice(0, 10)));
}

async function connectionIndex(
  store: OpenBankingStore,
  userHash: string,
  workspaceRef: string,
): Promise<string[]> {
  return readConnectionIndex(store, indexKey(userHash, workspaceRef));
}

async function legacyConnectionIndex(store: OpenBankingStore, userHash: string): Promise<string[]> {
  return readConnectionIndex(store, legacyIndexKey(userHash));
}

async function readConnectionIndex(store: OpenBankingStore, key: string): Promise<string[]> {
  const raw = await store.get(key);
  if (raw === null) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && validConnectionId(item))
      : [];
  } catch {
    return [];
  }
}

async function deleteAccountConnections(
  store: OpenBankingStore,
  userHash: string,
): Promise<number> {
  const keys = await store.list(userPrefix(userHash));
  const connectionIds = new Set<string>();
  for (const key of keys) {
    const match = /\/connections\/([0-9a-f-]{36})$/iu.exec(key);
    if (match?.[1] !== undefined && validConnectionId(match[1])) connectionIds.add(match[1]);
  }
  await Promise.all(keys.map((key) => store.delete(key)));
  return connectionIds.size;
}

function migrateLegacyConnection(
  connection: LegacyStoredConnection,
  workspaceRef: string,
): StoredConnection {
  const { v: _legacyVersion, ...rest } = connection;
  return { ...rest, v: 2, workspaceRef };
}

function providerSecretBinding(
  userHash: string,
  workspaceRef: string,
  connectionId: string,
): string {
  return `melo.open-banking.v2:${userHash}:${workspaceRef}:${connectionId}`;
}

function publicConnection(record: StoredConnection): PublicConnection {
  return {
    id: record.id,
    provider: record.provider,
    providerLabel: 'TrueLayer',
    status: record.status,
    scopes: record.scopes,
    createdAt: record.createdAt,
    grantedAt: record.grantedAt,
    expiresAt: record.expiresAt,
    disconnectedAt: record.disconnectedAt,
    lastSuccessfulRefreshAt: record.lastSuccessfulRefreshAt,
    lastErrorCode: record.lastErrorCode,
    accounts: record.accounts,
    futureAccessStopped: record.status === 'disconnected' && record.sealedProvider === null,
    providerRevocationSupported: false,
  };
}

function connectionRoute(pathname: string): { connectionId: string; action: 'sync' | null } | null {
  const match = /^\/v1\/connections\/([0-9a-f-]{36})(?:\/(sync))?$/u.exec(pathname);
  if (match === null || match[1] === undefined) return null;
  return { connectionId: match[1], action: match[2] === 'sync' ? 'sync' : null };
}

async function parseCallbackState(raw: string | null): Promise<{
  userHash: string;
  workspaceRef: string;
  localConnectionId: string;
  legacyPersonal: boolean;
} | null> {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !isRecord(parsed) ||
      typeof parsed['userHash'] !== 'string' ||
      !/^[a-f0-9]{64}$/u.test(parsed['userHash']) ||
      typeof parsed['localConnectionId'] !== 'string' ||
      !validConnectionId(parsed['localConnectionId'])
    ) {
      return null;
    }
    if (parsed['v'] === 2) {
      const workspaceRef =
        typeof parsed['workspaceRef'] === 'string'
          ? normalizeWorkspaceRef(parsed['workspaceRef'])
          : null;
      if (workspaceRef === null) return null;
      return {
        userHash: parsed['userHash'],
        workspaceRef,
        localConnectionId: parsed['localConnectionId'],
        legacyPersonal: false,
      };
    }
    return {
      userHash: parsed['userHash'],
      workspaceRef: await storageWorkspaceId(PERSONAL_WORKSPACE_ID),
      localConnectionId: parsed['localConnectionId'],
      legacyPersonal: true,
    };
  } catch {
    return null;
  }
}

function isStoredConnection(value: unknown): value is StoredConnection {
  return (
    isStoredConnectionFields(value) &&
    value['v'] === 2 &&
    typeof value['workspaceRef'] === 'string' &&
    normalizeWorkspaceRef(value['workspaceRef']) === value['workspaceRef']
  );
}

function isLegacyStoredConnection(value: unknown): value is LegacyStoredConnection {
  return isStoredConnectionFields(value) && value['v'] === 1;
}

function isStoredConnectionFields(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const status = value['status'];
  return (
    typeof value['id'] === 'string' &&
    validConnectionId(value['id']) &&
    value['provider'] === 'truelayer-data-v3' &&
    (status === 'pending_redirect' ||
      status === 'pending_sync' ||
      status === 'active' ||
      status === 'error' ||
      status === 'disconnected') &&
    Array.isArray(value['accounts'])
  );
}

function userPrefix(userHash: string): string {
  return `users/${userHash}/`;
}

function indexKey(userHash: string, workspaceRef: string): string {
  return `${userPrefix(userHash)}workspaces/${workspaceRef}/connections`;
}

function recordKey(userHash: string, workspaceRef: string, connectionId: string): string {
  return `${indexKey(userHash, workspaceRef)}/${connectionId}`;
}

function legacyIndexKey(userHash: string): string {
  return `${userPrefix(userHash)}connections`;
}

function legacyRecordKey(userHash: string, connectionId: string): string {
  return `${legacyIndexKey(userHash)}/${connectionId}`;
}

function stateKey(state: string): string {
  return `states/${state}`;
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

async function workspaceScopeFromRequest(request: Request): Promise<WorkspaceScope | null> {
  const personalRef = await storageWorkspaceId(PERSONAL_WORKSPACE_ID);
  const supplied = request.headers.get(WORKSPACE_REF_HEADER);
  if (supplied === null) {
    return { workspaceRef: personalRef, allowLegacyPersonal: true };
  }
  const workspaceRef = normalizeWorkspaceRef(supplied);
  return workspaceRef === null
    ? null
    : { workspaceRef, allowLegacyPersonal: workspaceRef === personalRef };
}

function normalizeWorkspaceRef(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return WORKSPACE_REF_PATTERN.test(normalized) ? normalized : null;
}

function redirectToApp(baseUri: string, params: Readonly<Record<string, string>>): Response {
  const url = new URL(baseUri);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString(), 'Cache-Control': 'no-store' },
  });
}

function validDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/gu, ' ');
  if (normalized.length < 3 || normalized.length > 100 || /[()]/u.test(normalized)) return null;
  return normalized.split(' ').filter(Boolean).length >= 2 ? normalized : null;
}

function validEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized) && normalized.length <= 254
    ? normalized
    : null;
}

async function safeJsonBody(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const length = Number.parseInt(request.headers.get('Content-Length') ?? '0', 10);
  if (Number.isFinite(length) && length > maxBytes)
    throw new ProviderError('request_too_large', 400);
  const text = await readBoundedBody(request, maxBytes);
  try {
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function readBoundedBody(request: Request, maxBytes: number): Promise<string> {
  if (request.body === null) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('request body exceeded limit');
        throw new ProviderError('request_too_large', 400);
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function requiredEncryptionKey(env: Pick<RuntimeEnv, 'CONNECTION_ENCRYPTION_KEY'>): string {
  const value = env.CONNECTION_ENCRYPTION_KEY?.trim();
  if (!isValidEncryptionKey(value)) throw new ProviderError('provider_not_configured', 503);
  return value;
}

function serviceConfigurationIssues(env: RuntimeEnv, provider: ProviderGateway): string[] {
  const issues: string[] = [];
  const publicBase = secureUrl(env.PUBLIC_BASE_URL);
  if (publicBase === null || publicBase.pathname !== '/' || publicBase.search || publicBase.hash) {
    issues.push('public_base_url');
  }
  if (env.APP_RETURN_URI !== 'folio://open-banking') issues.push('app_return_uri');
  const clerkIssuer = secureUrl(env.CLERK_ISSUER);
  const clerkJwks = secureUrl(env.CLERK_JWKS_URL);
  if (clerkIssuer === null) issues.push('clerk_issuer');
  if (
    clerkJwks === null ||
    clerkIssuer === null ||
    clerkJwks.origin !== clerkIssuer.origin ||
    clerkJwks.pathname !== '/.well-known/jwks.json'
  ) {
    issues.push('clerk_jwks_url');
  }
  if (!provider.configurationValid) issues.push('provider_environment');
  return issues;
}

function secureUrl(value: string | undefined): URL | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed : null;
  } catch {
    return null;
  }
}

function clientIp(request: Request): string | undefined {
  const value = request.headers.get('CF-Connecting-IP')?.trim();
  return value !== undefined && /^[0-9a-f:.]{2,64}$/iu.test(value) ? value : undefined;
}

function boundedDescription(value: string): string {
  const normalized = value.trim().replace(/\s+/gu, ' ');
  return (normalized || 'Bank transaction').slice(0, MAX_PROVIDER_DESCRIPTION);
}

function subtractDays(value: string, days: number): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return new Date().toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number): string {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function safeCode(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/gu, '_')
      .slice(0, 80) || 'provider_error'
  );
}

function validConnectionId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function commaList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/u, '');
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function preflight(request: Request, env: Pick<RuntimeEnv, 'ALLOWED_ORIGINS'>): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

function json(
  payload: unknown,
  status: number,
  request: Request,
  env?: Pick<RuntimeEnv, 'ALLOWED_ORIGINS'>,
): Response {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store', ...corsHeaders(request, env) },
  });
}

function corsHeaders(
  request: Request,
  env?: Pick<RuntimeEnv, 'ALLOWED_ORIGINS'>,
): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowed = commaList(env?.ALLOWED_ORIGINS);
  const allowOrigin =
    origin !== null && allowed.includes(origin) ? origin : allowed.length === 0 ? '*' : 'null';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': `Authorization, Content-Type, ${WORKSPACE_REF_HEADER}`,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
