import type { WorkspaceId } from '@folio/domain';
import { fetch as nativeFetch } from 'expo/fetch';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/ciphers/utils.js';
import { decodeCloudSyncBase64, type CloudSyncKeyScope } from './cloudSyncKeys';
import { createCloudSyncApi, type CloudSyncApi } from '@folio/sync';

import { workspaceBackupRef } from './cloudBackup';
import { getCloudVaultUrl, getOrCreateCloudDeviceId } from './cloudBackupNative';
import {
  cloudSyncRequestSigner,
  getOrCreateCloudSyncIdentity,
  serializeCloudSyncRequest,
} from './cloudSyncSigning';

export type CloudSyncKeyApi = CloudSyncApi;

/** Decoding the subject chooses a LOCAL namespace only. It never authenticates a request;
 * the Worker verifies the complete token. Persisted scope must match before any local replay. */
export function deriveCloudSyncScope(
  workspaceId: WorkspaceId,
  bearerToken: string,
): CloudSyncKeyScope {
  try {
    const parts = bearerToken.split('.');
    if (parts.length !== 3 || parts[1]!.length > 16_384) throw new Error();
    const bytes = decodeCloudSyncBase64(parts[1]!);
    if (bytes === null) throw new Error();
    const payload: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (
      payload === null ||
      typeof payload !== 'object' ||
      !('sub' in payload) ||
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0 ||
      payload.sub.length > 256
    )
      throw new Error();
    const accountRef = Array.from(
      sha256(utf8ToBytes(`melo.sync.account.v1:${payload.sub}`)),
      (byte) => byte.toString(16).padStart(2, '0'),
    ).join('');
    return { accountRef, workspaceRef: workspaceBackupRef(workspaceId) };
  } catch {
    throw new Error('Sign in again before connecting this workspace to sync.');
  }
}

/** Stable local identity used by coordinator UI. Enrollment remains a separate concern. */
export async function getCloudSyncDeviceId(): Promise<string> {
  return getOrCreateCloudDeviceId();
}

/** Constructs the authenticated, serialized cloud transport. The request signer serializes
 * sign/send/response consumption so one device cannot race its monotonic request sequence. */
export async function authenticatedCloudSyncApi(
  workspaceId: WorkspaceId,
  bearerToken: string,
): Promise<CloudSyncKeyApi> {
  const scope = deriveCloudSyncScope(workspaceId, bearerToken);
  const deadline = Date.now() + 20_000;
  const baseUrl = getCloudVaultUrl();
  if (baseUrl === undefined)
    throw new Error('Encrypted cloud sync is not configured in this build.');
  const deviceId = await getOrCreateCloudDeviceId();
  const identity = await getOrCreateCloudSyncIdentity(deviceId);
  return createCloudSyncApi({
    baseUrl,
    bearerToken,
    workspaceRef: scope.workspaceRef,
    deviceId,
    requestSigner: cloudSyncRequestSigner(workspaceBackupRef(workspaceId), identity),
    serializeRequest: (work) => serializeCloudSyncRequest(deviceId, work),
    fetch: async (url, init) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0)
        throw new Error('Cloud sync paused at its time limit. It can resume safely.');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), remaining);
      try {
        const response = await nativeFetch(url, {
          ...init,
          signal: controller.signal,
          redirect: 'error',
        });
        const reader = response.body?.getReader();
        if (reader === undefined) throw new Error('Cloud sync returned an empty response.');
        const chunks: Uint8Array[] = [];
        let size = 0;
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 2 * 1024 * 1024) {
            await reader.cancel();
            throw new Error('Cloud sync response exceeds the safe size limit.');
          }
          chunks.push(part.value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        const body = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        return {
          ok: response.ok,
          status: response.status,
          json: async () => JSON.parse(body) as unknown,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  });
}
