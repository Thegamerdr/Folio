import * as WebBrowser from 'expo-web-browser';
import { fetch as nativeFetch } from 'expo/fetch';

import {
  parseOpenBankingConnectionsResponse,
  parseOpenBankingSyncResponse,
  type OpenBankingConnectionsResponse,
  type OpenBankingRuntimeConnection,
  type OpenBankingSyncResponse,
} from '@folio/open-banking';
import type { WorkspaceId } from '@folio/domain';

import { workspaceBackupRef } from './cloudBackup';
import { getOpenBankingDeletionUrl, getOpenBankingUrl } from './openBankingConfig';

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

export type DurableOpenBankingSyncResponse = OpenBankingSyncResponse &
  Readonly<{
    deliveryId: string;
    connectionRevision: number;
  }>;

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
): Promise<DurableOpenBankingSyncResponse> {
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
  const raw = record(payload) ? payload : {};
  const deliveryId = raw['deliveryId'];
  const connectionRevision = raw['connectionRevision'];
  if (typeof deliveryId !== 'string' || !Number.isSafeInteger(connectionRevision)) {
    throw invalidResponse();
  }
  return { ...parsed, deliveryId, connectionRevision } as DurableOpenBankingSyncResponse;
}

export async function acknowledgeOpenBankingBatch(
  token: string,
  workspaceId: WorkspaceId,
  connectionId: string,
  deliveryId: string,
  connectionRevision: number,
): Promise<void> {
  const payload = await requestJson(
    `/v1/connections/${encodeURIComponent(connectionId)}/ack`,
    token,
    workspaceId,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryId, revision: connectionRevision }),
    },
  );
  if (!record(payload) || payload['ok'] !== true) throw invalidResponse();
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

function baseUrl(accountDeletion: boolean): string {
  const value = accountDeletion ? getOpenBankingDeletionUrl() : getOpenBankingUrl();
  if (value === undefined) {
    throw new OpenBankingClientError(
      accountDeletion
        ? 'Bank-data deletion is not configured. Melo cannot confirm that historical bank data was removed.'
        : 'Bank connection is not available in this Melo release.',
      accountDeletion ? 'deletion_not_configured' : 'feature_disabled',
      accountDeletion ? 503 : 404,
    );
  }
  return value;
}

async function requestJson(
  path: string,
  token: string,
  workspaceId: WorkspaceId | null,
  init: Readonly<{ method: string; headers?: Readonly<Record<string, string>>; body?: string }>,
): Promise<unknown> {
  if (token.trim().length === 0) {
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
    const accountDeletion = init.method === 'DELETE' && path === '/v1/account';
    const response = await nativeFetch(`${baseUrl(accountDeletion)}${path}`, {
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
    return payload;
  } catch (reason: unknown) {
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

async function readPayload(response: Response): Promise<unknown> {
  if (response.body === null) return {};
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > 1024 * 1024) {
        await reader.cancel();
        throw invalidResponse();
      }
      chunks.push(part.value);
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
  const text = new TextDecoder().decode(bytes);
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
