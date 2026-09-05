import { describe, expect, it, vi } from 'vitest';

import { openJson, sealJson, storageUserId } from './crypto';
import { handleAuthenticatedRequest, handleCallback, handleRequest } from './index';
import type { OpenBankingStore, ProviderGateway, RuntimeEnv, TransactionsPage } from './types';

const USER_HASH = 'a'.repeat(64);
const WORKSPACE_A_REF = '1'.repeat(64);
const WORKSPACE_B_REF = '2'.repeat(64);
const KEY = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, index) => index + 1)));

const env: RuntimeEnv = {
  OPEN_BANKING_ENABLED: 'true',
  CLERK_ISSUER: 'https://clerk.test',
  CLERK_JWKS_URL: 'https://clerk.test/.well-known/jwks.json',
  ALLOWED_ORIGINS: '',
  PUBLIC_BASE_URL: 'https://banking.test',
  APP_RETURN_URI: 'folio://open-banking',
  TRUELAYER_ENVIRONMENT: 'sandbox',
  TRUELAYER_AUTH_BASE_URL: 'https://auth.test',
  TRUELAYER_API_BASE_URL: 'https://api.test',
  TRUELAYER_CLIENT_ID: 'client',
  TRUELAYER_CLIENT_SECRET: 'secret',
  CONNECTION_ENCRYPTION_KEY: KEY,
};

function memoryStore(): { store: OpenBankingStore; values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    store: {
      get: async (key) => values.get(key) ?? null,
      put: async (key, value) => {
        values.set(key, value);
      },
      delete: async (key) => {
        values.delete(key);
      },
      list: async (prefix) => [...values.keys()].filter((key) => key.startsWith(prefix)),
    },
  };
}

function fakeProvider(configured = true): ProviderGateway {
  let requestReads = 0;
  return {
    configured,
    configurationValid: true,
    environment: 'sandbox',
    createConnection: async () => ({
      providerConnectionId: 'provider-connection-sensitive',
      authorizationUrl: 'https://provider.test/authorize',
    }),
    listAccounts: async () => [
      {
        id: 'provider-account-sensitive',
        type: 'account',
        accountType: 'current',
        customerSegment: 'retail',
        currency: 'GBP',
      },
    ],
    createTransactionsRequest: async () => ({ requestId: 'request-1' }),
    getTransactionsRequest: async (): Promise<TransactionsPage> => {
      requestReads += 1;
      if (requestReads === 1) {
        return {
          status: 'completed',
          requestId: 'request-1',
          items: [
            {
              id: 'provider-transaction-sensitive',
              timestamp: '2026-07-12T10:00:00Z',
              description: 'Local grocer',
              currency: 'GBP',
              amountInMinor: -4210,
              status: 'settled',
            },
          ],
          nextCursor: null,
        };
      }
      return { status: 'pending', requestId: 'request-1' };
    },
  };
}

function jsonRequest(
  method: string,
  path: string,
  body?: unknown,
  workspaceRef?: string,
  endUserIp?: string,
): Request {
  const headers = new Headers();
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (workspaceRef !== undefined) headers.set('X-Melo-Workspace-Ref', workspaceRef);
  if (endUserIp !== undefined) headers.set('CF-Connecting-IP', endUserIp);
  return new Request(`https://banking.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('Melo Open Banking service', () => {
  it('permits authenticated historical bank-data deletion while connection setup is disabled', async () => {
    const { store, values } = memoryStore();
    const userHash = await storageUserId('deleting-user');
    const ownKey = `users/${userHash}/workspaces/${WORKSPACE_A_REF}/connections/12345678-1234-4234-8234-123456789abc`;
    values.set(ownKey, 'encrypted provider data');
    values.set(`users/${USER_HASH}/unrelated`, 'other account');
    const disabled = { ...env, OPEN_BANKING_ENABLED: 'false', CONNECTION_ENCRYPTION_KEY: '' };
    const response = await handleRequest(
      jsonRequest('DELETE', '/v1/account'),
      store,
      fakeProvider(false),
      disabled,
      async () => 'deleting-user',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      deletedConnections: 1,
      providerSecretsDeleted: true,
    });
    expect(values.has(ownKey)).toBe(false);
    expect(values.get(`users/${USER_HASH}/unrelated`)).toBe('other account');
    const unauthorized = await handleRequest(
      jsonRequest('DELETE', '/v1/account'),
      store,
      fakeProvider(false),
      disabled,
      async () => {
        throw new Error('no session');
      },
    );
    expect(unauthorized.status).toBe(401);
  });

  it('reports an honest unconfigured health state without authenticating', async () => {
    const { store } = memoryStore();
    const response = await handleRequest(
      jsonRequest('GET', '/health'),
      store,
      fakeProvider(false),
      env,
      async () => {
        throw new Error('health must not authenticate');
      },
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      featureEnabled: true,
      providerConfigured: false,
      configurationReady: true,
      activationReady: false,
      providerCredentialsInApp: false,
      directLedgerWrites: false,
    });
  });

  it('fails closed before authentication when non-secret service configuration is invalid', async () => {
    const { store } = memoryStore();
    const authenticate = vi.fn(async () => USER_HASH);
    const provider = { ...fakeProvider(), configurationValid: false };
    const response = await handleRequest(
      jsonRequest('GET', '/v1/connections'),
      store,
      provider,
      env,
      authenticate,
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: 'service_not_configured' });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('keeps every non-health route dark when the release switch is off', async () => {
    const { store } = memoryStore();
    const authenticate = vi.fn(async () => USER_HASH);
    const response = await handleRequest(
      jsonRequest('GET', '/v1/connections'),
      store,
      fakeProvider(true),
      { ...env, OPEN_BANKING_ENABLED: 'false' },
      authenticate,
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Bank connection is not available in this release.',
      code: 'feature_disabled',
    });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('round-trips provider identifiers only through AES-256-GCM envelopes', async () => {
    const sealed = await sealJson({ connection: 'sensitive' }, KEY);
    expect(JSON.stringify(sealed)).not.toContain('sensitive');
    await expect(openJson(sealed, KEY)).resolves.toEqual({ connection: 'sensitive' });

    const bound = await sealJson({ connection: 'workspace-sensitive' }, KEY, 'workspace-a');
    expect(bound).toMatchObject({ v: 2, binding: 'melo-open-banking-connection' });
    await expect(openJson(bound, KEY, 'workspace-a')).resolves.toEqual({
      connection: 'workspace-sensitive',
    });
    await expect(openJson(bound, KEY, 'workspace-b')).rejects.toThrow();
  });

  it('runs hosted consent, stages real provider rows, and never stores plaintext identifiers', async () => {
    const { store, values } = memoryStore();
    const provider = fakeProvider();
    const started = await handleAuthenticatedRequest(
      jsonRequest('POST', '/v1/connections', {
        displayName: 'Melo Tester',
        email: 'tester@example.com',
      }),
      store,
      provider,
      env,
      USER_HASH,
    );
    expect(started.status).toBe(201);
    const startedBody = (await started.json()) as {
      connection: { id: string };
      authorizationUrl: string;
    };
    expect(startedBody.authorizationUrl).toBe('https://provider.test/authorize');
    expect([...values.values()].join('\n')).not.toContain('provider-connection-sensitive');

    const stateKey = [...values.keys()].find((key) => key.startsWith('states/'));
    expect(stateKey).toBeDefined();
    const state = stateKey?.slice('states/'.length) ?? '';
    const callback = await handleCallback(
      new Request(`https://banking.test/v1/callback?state=${state}`),
      store,
      env,
    );
    expect(callback.status).toBe(302);
    expect(callback.headers.get('Location')).toContain('status=connected');
    expect(values.has(stateKey as string)).toBe(false);

    const synced = await handleAuthenticatedRequest(
      jsonRequest('POST', `/v1/connections/${startedBody.connection.id}/sync`),
      store,
      provider,
      env,
      USER_HASH,
    );
    expect(synced.status).toBe(200);
    const syncedBody = (await synced.json()) as {
      directLedgerWrites: boolean;
      candidates: Array<Record<string, unknown>>;
      connection: { accounts: Array<Record<string, unknown>> };
    };
    expect(syncedBody.directLedgerWrites).toBe(false);
    expect(syncedBody.candidates).toEqual([
      expect.objectContaining({
        connectionId: startedBody.connection.id,
        bookingStatus: 'posted',
        amountMinor: -4210,
        currency: 'GBP',
        description: 'Local grocer',
      }),
    ]);
    expect(syncedBody.candidates[0]?.['externalId']).not.toBe('provider-transaction-sensitive');
    expect(syncedBody.connection.accounts[0]?.['accountRef']).not.toBe(
      'provider-account-sensitive',
    );
    expect([...values.values()].join('\n')).not.toContain('provider-account-sensitive');
  });

  it('forwards a validated Cloudflare client IP to the provider without trusting malformed values', async () => {
    const { store } = memoryStore();
    const baseProvider = fakeProvider();
    const createConnection = vi.fn(baseProvider.createConnection);
    const provider = { ...baseProvider, createConnection };

    await handleAuthenticatedRequest(
      jsonRequest(
        'POST',
        '/v1/connections',
        { displayName: 'Melo Tester', email: 'tester@example.com' },
        WORKSPACE_A_REF,
        '203.0.113.42',
      ),
      store,
      provider,
      env,
      USER_HASH,
    );
    expect(createConnection).toHaveBeenLastCalledWith(
      expect.objectContaining({ endUserIp: '203.0.113.42' }),
    );

    await handleAuthenticatedRequest(
      jsonRequest(
        'POST',
        '/v1/connections',
        { displayName: 'Melo Tester', email: 'tester@example.com' },
        WORKSPACE_A_REF,
        'not-an-ip',
      ),
      store,
      provider,
      env,
      USER_HASH,
    );
    expect(createConnection).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ endUserIp: expect.anything() }),
    );
  });

  it('consumes callback state once and treats replay as expired', async () => {
    const { store, values } = memoryStore();
    const started = await handleAuthenticatedRequest(
      jsonRequest('POST', '/v1/connections', {
        displayName: 'Melo Tester',
        email: 'tester@example.com',
      }),
      store,
      fakeProvider(),
      env,
      USER_HASH,
    );
    expect(started.status).toBe(201);
    const stateKey = [...values.keys()].find((key) => key.startsWith('states/'));
    const callbackUrl = `https://banking.test/v1/callback?state=${stateKey?.slice('states/'.length) ?? ''}`;

    const first = await handleCallback(new Request(callbackUrl), store, env);
    const replay = await handleCallback(new Request(callbackUrl), store, env);

    expect(first.headers.get('Location')).toContain('status=connected');
    expect(replay.headers.get('Location')).toContain('status=expired');
  });

  it('records hosted-flow cancellation without granting or importing anything', async () => {
    const { store, values } = memoryStore();
    const started = await handleAuthenticatedRequest(
      jsonRequest('POST', '/v1/connections', {
        displayName: 'Melo Tester',
        email: 'tester@example.com',
      }),
      store,
      fakeProvider(),
      env,
      USER_HASH,
    );
    const connectionId = ((await started.json()) as { connection: { id: string } }).connection.id;
    const stateKey = [...values.keys()].find((key) => key.startsWith('states/'));
    const callback = await handleCallback(
      new Request(
        `https://banking.test/v1/callback?state=${stateKey?.slice('states/'.length) ?? ''}&error=user_cancelled`,
      ),
      store,
      env,
    );
    expect(callback.headers.get('Location')).toContain('status=error');

    const listed = await handleAuthenticatedRequest(
      jsonRequest('GET', '/v1/connections'),
      store,
      fakeProvider(),
      env,
      USER_HASH,
    );
    await expect(listed.json()).resolves.toMatchObject({
      connections: [
        {
          id: connectionId,
          status: 'error',
          grantedAt: null,
          lastErrorCode: 'authorization_failed',
          accounts: [],
        },
      ],
    });
  });

  it('isolates connection lists and operations between two workspaces on the same account', async () => {
    const { store, values } = memoryStore();
    const provider = fakeProvider();
    const startedA = await handleAuthenticatedRequest(
      jsonRequest(
        'POST',
        '/v1/connections',
        { displayName: 'Melo Tester', email: 'tester@example.com' },
        WORKSPACE_A_REF,
      ),
      store,
      provider,
      env,
      USER_HASH,
    );
    const connectionA = ((await startedA.json()) as { connection: { id: string } }).connection.id;
    const stateAKey = [...values.keys()].find((key) => key.startsWith('states/'));
    expect(stateAKey).toBeDefined();
    expect(JSON.parse(values.get(stateAKey as string) ?? '{}')).toMatchObject({
      v: 2,
      userHash: USER_HASH,
      workspaceRef: WORKSPACE_A_REF,
      localConnectionId: connectionA,
    });

    const startedB = await handleAuthenticatedRequest(
      jsonRequest(
        'POST',
        '/v1/connections',
        { displayName: 'Melo Tester', email: 'tester@example.com' },
        WORKSPACE_B_REF,
      ),
      store,
      provider,
      env,
      USER_HASH,
    );
    const connectionB = ((await startedB.json()) as { connection: { id: string } }).connection.id;

    const listA = await handleAuthenticatedRequest(
      jsonRequest('GET', '/v1/connections', undefined, WORKSPACE_A_REF),
      store,
      provider,
      env,
      USER_HASH,
    );
    const listB = await handleAuthenticatedRequest(
      jsonRequest('GET', '/v1/connections', undefined, WORKSPACE_B_REF),
      store,
      provider,
      env,
      USER_HASH,
    );
    await expect(listA.json()).resolves.toMatchObject({ connections: [{ id: connectionA }] });
    await expect(listB.json()).resolves.toMatchObject({ connections: [{ id: connectionB }] });

    const crossSync = await handleAuthenticatedRequest(
      jsonRequest('POST', `/v1/connections/${connectionA}/sync`, undefined, WORKSPACE_B_REF),
      store,
      provider,
      env,
      USER_HASH,
    );
    const crossDelete = await handleAuthenticatedRequest(
      jsonRequest('DELETE', `/v1/connections/${connectionA}`, undefined, WORKSPACE_B_REF),
      store,
      provider,
      env,
      USER_HASH,
    );
    expect(crossSync.status).toBe(404);
    expect(crossDelete.status).toBe(404);

    const callbackA = await handleCallback(
      new Request(
        `https://banking.test/v1/callback?state=${stateAKey?.slice('states/'.length) ?? ''}`,
      ),
      store,
      env,
    );
    expect(callbackA.headers.get('Location')).toContain(`connection=${connectionA}`);
    const syncedA = await handleAuthenticatedRequest(
      jsonRequest('POST', `/v1/connections/${connectionA}/sync`, undefined, WORKSPACE_A_REF),
      store,
      provider,
      env,
      USER_HASH,
    );
    expect(syncedA.status).toBe(200);
  });

  it('rejects malformed workspace references before reading connection storage', async () => {
    const { store } = memoryStore();
    const response = await handleAuthenticatedRequest(
      jsonRequest('GET', '/v1/connections', undefined, 'workspace_business_raw'),
      store,
      fakeProvider(),
      env,
      USER_HASH,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'invalid_workspace' });
  });

  it('maps headerless legacy clients only to Personal and migrates old account-level records', async () => {
    const { store, values } = memoryStore();
    const connectionId = '11111111-1111-4111-8111-111111111111';
    values.set(`users/${USER_HASH}/connections`, JSON.stringify([connectionId]));
    values.set(
      `users/${USER_HASH}/connections/${connectionId}`,
      JSON.stringify({
        v: 1,
        id: connectionId,
        provider: 'truelayer-data-v3',
        status: 'disconnected',
        scopes: ['accounts', 'transactions'],
        createdAt: '2026-07-12T10:00:00.000Z',
        callbackAt: null,
        grantedAt: null,
        expiresAt: null,
        disconnectedAt: '2026-07-12T11:00:00.000Z',
        lastSuccessfulRefreshAt: null,
        lastErrorCode: null,
        accounts: [],
        sealedProvider: null,
      }),
    );

    const legacyList = await handleAuthenticatedRequest(
      jsonRequest('GET', '/v1/connections'),
      store,
      fakeProvider(),
      env,
      USER_HASH,
    );
    await expect(legacyList.json()).resolves.toMatchObject({ connections: [{ id: connectionId }] });
    const businessList = await handleAuthenticatedRequest(
      jsonRequest('GET', '/v1/connections', undefined, WORKSPACE_B_REF),
      store,
      fakeProvider(),
      env,
      USER_HASH,
    );
    await expect(businessList.json()).resolves.toMatchObject({ connections: [] });
    expect(
      [...values.keys()].some(
        (key) => key.includes('/workspaces/') && key.endsWith(`/connections/${connectionId}`),
      ),
    ).toBe(true);
  });

  it('disconnects future server access without deleting or claiming to revoke local history', async () => {
    const { store } = memoryStore();
    const provider = fakeProvider();
    const started = await handleAuthenticatedRequest(
      jsonRequest('POST', '/v1/connections', {
        displayName: 'Melo Tester',
        email: 'tester@example.com',
      }),
      store,
      provider,
      env,
      USER_HASH,
    );
    const connectionId = ((await started.json()) as { connection: { id: string } }).connection.id;
    const disconnected = await handleAuthenticatedRequest(
      jsonRequest('DELETE', `/v1/connections/${connectionId}`),
      store,
      provider,
      env,
      USER_HASH,
    );
    await expect(disconnected.json()).resolves.toMatchObject({
      futureAccessStopped: true,
      providerRevocationSupported: false,
      localHistoryChanged: false,
      connection: { status: 'disconnected' },
    });
  });

  it('purges every workspace connection and encrypted provider secret for account deletion', async () => {
    const { store, values } = memoryStore();
    const provider = fakeProvider();
    await handleAuthenticatedRequest(
      jsonRequest(
        'POST',
        '/v1/connections',
        { displayName: 'Melo Tester', email: 'tester@example.com' },
        WORKSPACE_A_REF,
      ),
      store,
      provider,
      env,
      USER_HASH,
    );
    await handleAuthenticatedRequest(
      jsonRequest(
        'POST',
        '/v1/connections',
        { displayName: 'Melo Tester', email: 'tester@example.com' },
        WORKSPACE_B_REF,
      ),
      store,
      provider,
      env,
      USER_HASH,
    );
    const deleted = await handleAuthenticatedRequest(
      jsonRequest('DELETE', '/v1/account'),
      store,
      provider,
      env,
      USER_HASH,
    );
    await expect(deleted.json()).resolves.toMatchObject({
      deletedConnections: 2,
      futureAccessStopped: true,
      providerSecretsDeleted: true,
      providerRevocationSupported: false,
      pendingCallbackMetadataExpiresWithinSeconds: 1200,
    });
    expect([...values.keys()].some((key) => key.startsWith(`users/${USER_HASH}/`))).toBe(false);
  });
});
