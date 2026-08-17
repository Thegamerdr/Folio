import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';

import {
  parseOpenBankingConnectionsResponse,
  parseOpenBankingSyncResponse,
  type OpenBankingConnectionsResponse,
  type OpenBankingRuntimeConnection,
  type OpenBankingSyncResponse,
} from '@folio/open-banking';
import type { WorkspaceId } from '@folio/domain';

import { workspaceBackupRef } from './cloudBackup';
import { recordServiceAccess } from '@/folio/store';

WebBrowser.maybeCompleteAuthSession();

type ApiErrorPayload = Readonly<{ error?: unknown; code?: unknown }>;

export type OpenBankingAccountDeletionResponse = Readonly<{
  deletedConnections: number;
  futureAccessStopped: true;
  providerSecretsDeleted: true;
  providerRevocationSupported: false;
  pendingCallbackMetadataExpiresWithinSeconds: number;
}>;

export class OpenBankingClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'OpenBankingClientError';
    this.code = code;
    this.status = status;
  }
}

export async function fetchOpenBankingConnections(
  token: string,
  workspaceId: WorkspaceId,
): Promise<OpenBankingConnectionsResponse> {
  const payload = await requestJson('/v1/connections', token, workspaceId, { method: 'GET' });
  const parsed = parseOpenBankingConnectionsResponse(payload);
  if (parsed === null) throw invalidResponse();
  return parsed;
}

export async function startOpenBankingConnection(
  token: string,
  workspaceId: WorkspaceId,
  profile: Readonly<{ displayName: string; email: string }>,
): Promise<
  Readonly<{
    connection: OpenBankingRuntimeConnection;
    authorizationUrl: string;
    returnUri: string;
  }>
> {
  const payload = await requestJson('/v1/connections', token, workspaceId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!record(payload)) throw invalidResponse();
  const authorizationUrl = payload['authorizationUrl'];
  const returnUri = payload['returnUri'];
  const parsed = parseOpenBankingConnectionsResponse({
    providerConfigured: true,
    connections: [payload['connection']],
  });
  if (
    parsed === null ||
    parsed.connections[0] === undefined ||
    typeof authorizationUrl !== 'string' ||
    typeof returnUri !== 'string'
  ) {
    throw invalidResponse();
  }
  return { connection: parsed.connections[0], authorizationUrl, returnUri };
}

export async function openBankAuthorization(
  authorizationUrl: string,
  returnUri: string,
): Promise<'returned' | 'cancelled'> {
  const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, returnUri, {
    showInRecents: true,
  });
  return result.type === 'success' ? 'returned' : 'cancelled';
}

export async function syncOpenBankingConnection(
  token: string,
  workspaceId: WorkspaceId,
  connectionId: string,
): Promise<OpenBankingSyncResponse> {
  const payload = await requestJson(
    `/v1/connections/${encodeURIComponent(connectionId)}/sync`,
    token,
    workspaceId,
    {
      method: 'POST',
    },
  );
  const parsed = parseOpenBankingSyncResponse(payload);
  if (parsed === null) throw invalidResponse();
  return parsed;
}

export async function disconnectOpenBankingConnection(
  token: string,
  workspaceId: WorkspaceId,
  connectionId: string,
): Promise<OpenBankingRuntimeConnection> {
  const payload = await requestJson(
    `/v1/connections/${encodeURIComponent(connectionId)}`,
    token,
    workspaceId,
    { method: 'DELETE' },
  );
  if (!record(payload)) throw invalidResponse();
  const parsed = parseOpenBankingConnectionsResponse({
    providerConfigured: true,
    connections: [payload['connection']],
  });
  if (parsed?.connections[0] === undefined) throw invalidResponse();
  return parsed.connections[0];
}

/**
 * Delete Melo's complete server-side bank-connection index and encrypted provider credentials.
 * The provider consent itself cannot currently be revoked through this adapter, so callers must
 * keep that limitation visible instead of presenting token deletion as bank-side revocation.
 */
export async function deleteOpenBankingAccountData(
  token: string,
): Promise<OpenBankingAccountDeletionResponse> {
  const payload = await requestJson('/v1/account', token, null, { method: 'DELETE' });
  if (!record(payload)) throw invalidResponse();
  const deletedConnections = payload['deletedConnections'];
  const pendingSeconds = payload['pendingCallbackMetadataExpiresWithinSeconds'];
  if (
    !Number.isSafeInteger(deletedConnections) ||
    (deletedConnections as number) < 0 ||
    payload['futureAccessStopped'] !== true ||
    payload['providerSecretsDeleted'] !== true ||
    payload['providerRevocationSupported'] !== false ||
    !Number.isSafeInteger(pendingSeconds) ||
    (pendingSeconds as number) < 0
  ) {
    throw invalidResponse();
  }
  return {
    deletedConnections: deletedConnections as number,
    futureAccessStopped: true,
    providerSecretsDeleted: true,
    providerRevocationSupported: false,
    pendingCallbackMetadataExpiresWithinSeconds: pendingSeconds as number,
  };
}

function baseUrl(): string {
  const value =
    process.env.EXPO_PUBLIC_MELO_OPEN_BANKING_URL ??
    Constants.expoConfig?.extra?.['EXPO_PUBLIC_MELO_OPEN_BANKING_URL'];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OpenBankingClientError(
      'Bank connection is not configured for this Melo build yet.',
      'service_not_configured',
      503,
    );
  }
  return value.replace(/\/+$/u, '');
}

async function requestJson(
  path: string,
  token: string,
  workspaceId: WorkspaceId | null,
  init: RequestInit,
): Promise<unknown> {
  const operation = bankOperation(path, init.method);
  if (token.trim().length === 0) {
    recordServiceAccess({
      service: 'bank',
      operation,
      outcome: 'failed',
      ...(workspaceId === null ? {} : { workspaceId }),
    });
    throw new OpenBankingClientError('Sign in again to use bank connection.', 'unauthorized', 401);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', 'application/json');
    if (workspaceId !== null) {
      headers.set('X-Melo-Workspace-Ref', workspaceBackupRef(workspaceId));
    }
    const response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    const payload = await readPayload(response);
    if (!response.ok) {
      const error = record(payload) ? (payload as ApiErrorPayload) : {};
      throw new OpenBankingClientError(
        typeof error.error === 'string'
          ? error.error
          : 'Bank connection could not complete. Your local Melo data is unchanged.',
        typeof error.code === 'string' ? error.code : `http_${response.status}`,
        response.status,
      );
    }
    recordServiceAccess({
      service: 'bank',
      operation,
      outcome: 'completed',
      ...(workspaceId === null ? {} : { workspaceId }),
    });
    return payload;
  } catch (reason: unknown) {
    recordServiceAccess({
      service: 'bank',
      operation,
      outcome: 'failed',
      ...(workspaceId === null ? {} : { workspaceId }),
    });
    if (reason instanceof OpenBankingClientError) throw reason;
    if (reason instanceof Error && reason.name === 'AbortError') {
      throw new OpenBankingClientError(
        'Bank connection took too long to respond. Try again without changing your local data.',
        'timeout',
        408,
      );
    }
    throw new OpenBankingClientError(
      'Bank connection is unreachable. Your local Melo data is unchanged.',
      'network_error',
      503,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function bankOperation(path: string, method = 'GET'): string {
  if (path.endsWith('/sync')) return 'connection-refresh';
  if (path === '/v1/account') return 'account-delete';
  if (method === 'POST') return 'connection-start';
  if (method === 'DELETE') return 'connection-disconnect';
  return 'connection-status';
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw invalidResponse();
  }
}

function invalidResponse(): OpenBankingClientError {
  return new OpenBankingClientError(
    'The bank service returned an unfamiliar response. Nothing was added to Melo.',
    'invalid_response',
    502,
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
