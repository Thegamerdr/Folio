import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceId } from '@folio/domain';

const maybeCompleteAuthSession = vi.fn();
const openAuthSessionAsync = vi.fn();
const extra: Record<string, unknown> = {};

vi.mock('expo-web-browser', () => ({ maybeCompleteAuthSession, openAuthSessionAsync }));
vi.mock('expo/fetch', () => ({
  fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
}));
vi.mock('expo-constants', () => ({ default: { expoConfig: { extra } } }));
vi.mock('./cloudBackup', () => ({ workspaceBackupRef: () => 'b'.repeat(64) }));

const FLAG = 'EXPO_PUBLIC_MELO_OPEN_BANKING_ENABLED';
const URL = 'EXPO_PUBLIC_MELO_OPEN_BANKING_URL';
const originalFlag = process.env[FLAG];
const originalUrl = process.env[URL];
const workspaceId = createWorkspaceId('workspace_personal_local');

beforeEach(() => {
  process.env[FLAG] = 'true';
  process.env[URL] = 'https://banking.example.test';
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  openAuthSessionAsync.mockReset();
  maybeCompleteAuthSession.mockReset();
  delete extra[FLAG];
  delete extra[URL];
  if (originalFlag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = originalFlag;
  if (originalUrl === undefined) delete process.env[URL];
  else process.env[URL] = originalUrl;
});

describe('Open Banking native client boundary', () => {
  it('rejects an oversized streamed body before parsing it', async () => {
    let cancelled = false;
    const response = new Response(null);
    Object.defineProperty(response, 'body', { value:
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(1024 * 1024 + 1));
          },
          cancel() {
            cancelled = true;
          },
        }),
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    const { fetchOpenBankingConnections } = await import('./openBankingNative');
    await expect(
      fetchOpenBankingConnections('synthetic-session', workspaceId),
    ).rejects.toMatchObject({ code: 'invalid_response' });
    expect(cancelled).toBe(true);
  });
  it('sends only the Clerk token and opaque workspace reference to the configured Worker', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ providerConfigured: false, connections: [] }));
    const { fetchOpenBankingConnections } = await import('./openBankingNative');

    await expect(fetchOpenBankingConnections('clerk-session-token', workspaceId)).resolves.toEqual({
      providerConfigured: false,
      connections: [],
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe('https://banking.example.test/v1/connections');
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get('Authorization')).toBe('Bearer clerk-session-token');
    expect(headers.get('X-Melo-Workspace-Ref')).toBe('b'.repeat(64));
  });

  it('fails closed before fetch when an enabled build contains an unsafe endpoint', async () => {
    process.env[URL] = 'http://banking.example.test';
    vi.resetModules();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { fetchOpenBankingConnections } = await import('./openBankingNative');

    await expect(
      fetchOpenBankingConnections('clerk-session-token', workspaceId),
    ).rejects.toMatchObject({ code: 'feature_disabled', status: 404 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('requires a server deletion receipt even in a build where banking is off', async () => {
    delete process.env[FLAG];
    vi.resetModules();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        deletedConnections: 1,
        futureAccessStopped: true,
        providerSecretsDeleted: true,
        providerRevocationSupported: false,
        pendingCallbackMetadataExpiresWithinSeconds: 1200,
      }),
    );
    const { deleteOpenBankingAccountData } = await import('./openBankingNative');

    await expect(deleteOpenBankingAccountData('clerk-session-token')).resolves.toMatchObject({
      deletedConnections: 1,
      futureAccessStopped: true,
      providerSecretsDeleted: true,
      providerRevocationSupported: false,
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://banking.example.test/v1/account',
      expect.objectContaining({ method: 'DELETE' }),
    );
    delete process.env[URL];
    await expect(deleteOpenBankingAccountData('clerk-session-token')).rejects.toMatchObject({
      code: 'deletion_not_configured',
    });
  });

  it('uses the server-provided app return URI for the hosted TrueLayer session', async () => {
    openAuthSessionAsync.mockResolvedValue({ type: 'success' });
    const { openBankAuthorization } = await import('./openBankingNative');

    await expect(
      openBankAuthorization(
        'https://app.truelayer-sandbox.com/data/connection',
        'folio://open-banking',
      ),
    ).resolves.toBe('returned');
    expect(openAuthSessionAsync).toHaveBeenCalledWith(
      'https://app.truelayer-sandbox.com/data/connection',
      'folio://open-banking',
      { showInRecents: true },
    );
  });
});
