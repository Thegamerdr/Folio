import * as Crypto from 'expo-crypto';
import type { WorkspaceId } from '@folio/domain';
import {
  createCloudSyncApi,
  type CloudSyncApi,
  type CloudSyncOperation,
  type EncryptedOperationUpload,
} from '@folio/sync';

import { workspaceBackupRef } from './cloudBackup';
import { getCloudVaultUrl, getOrCreateCloudDeviceId } from './cloudBackupNative';
import { openCloudSyncOperation, sealCloudSyncOperation } from './cloudSync';
import {
  cloudSyncRequestSigner,
  getOrCreateCloudSyncIdentity,
  serializeCloudSyncRequest,
} from './cloudSyncSigning';
import { GCM_NONCE_BYTES } from './cryptoBlob';

export async function authenticatedCloudSyncApi(
  workspaceId: WorkspaceId,
  bearerToken: string,
): Promise<CloudSyncApi> {
  const baseUrl = getCloudVaultUrl();
  if (baseUrl === undefined)
    throw new Error('Encrypted cloud sync is not configured in this build.');
  const deviceId = await getOrCreateCloudDeviceId();
  const identity = await getOrCreateCloudSyncIdentity(deviceId);
  return createCloudSyncApi({
    baseUrl,
    bearerToken,
    workspaceRef: workspaceBackupRef(workspaceId),
    deviceId,
    requestSigner: cloudSyncRequestSigner(workspaceBackupRef(workspaceId), identity),
    serializeRequest: (work) => serializeCloudSyncRequest(deviceId, work),
    fetch: async (url, init) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        const body = await response.text();
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

export async function encryptCloudSyncOperation(input: {
  workspaceId: WorkspaceId;
  id: string;
  deviceSequence: number;
  keyEpoch: number;
  idempotencyKey: string;
  plaintext: string;
  /** Current unwrapped epoch key. Key distribution/rotation must complete before this call. */
  syncKey: Uint8Array;
}): Promise<EncryptedOperationUpload> {
  return sealCloudSyncOperation({
    ...input,
    workspaceRef: workspaceBackupRef(input.workspaceId),
    deviceId: await getOrCreateCloudDeviceId(),
    createdAt: new Date().toISOString(),
    iv: Uint8Array.from(await Crypto.getRandomBytesAsync(GCM_NONCE_BYTES)),
  });
}

export async function decryptCloudSyncReplay(
  workspaceId: WorkspaceId,
  operations: readonly CloudSyncOperation[],
  syncKey: Uint8Array,
): Promise<readonly { operation: CloudSyncOperation; plaintext: string }[]> {
  const workspaceRef = workspaceBackupRef(workspaceId);
  return operations.map((operation) => {
    const plaintext = openCloudSyncOperation({ operation, workspaceRef, syncKey });
    if (plaintext === null) {
      throw new Error(`Encrypted operation at cursor ${operation.cursor} could not be verified.`);
    }
    return { operation, plaintext };
  });
}
