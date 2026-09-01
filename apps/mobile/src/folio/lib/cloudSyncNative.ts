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
import { GCM_NONCE_BYTES } from './cryptoBlob';

export async function authenticatedCloudSyncApi(
  workspaceId: WorkspaceId,
  bearerToken: string,
): Promise<CloudSyncApi> {
  const baseUrl = getCloudVaultUrl();
  if (baseUrl === undefined)
    throw new Error('Encrypted cloud sync is not configured in this build.');
  return createCloudSyncApi({
    baseUrl,
    bearerToken,
    workspaceRef: workspaceBackupRef(workspaceId),
    deviceId: await getOrCreateCloudDeviceId(),
    fetch: (url, init) => fetch(url, init),
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
