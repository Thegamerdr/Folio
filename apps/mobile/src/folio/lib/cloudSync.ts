import type { CloudSyncOperation, EncryptedOperationUpload } from '@folio/sync';
import { utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { base64 } from '@scure/base';

import { decryptBlob, encryptBlob, GCM_NONCE_BYTES, VAULT_KEY_BYTES } from './cryptoBlob';

export function sealCloudSyncOperation(input: {
  id: string;
  workspaceRef: string;
  deviceId: string;
  deviceSequence: number;
  keyEpoch: number;
  idempotencyKey: string;
  createdAt: string;
  plaintext: string;
  syncKey: Uint8Array;
  iv: Uint8Array;
}): EncryptedOperationUpload {
  assertMetadata(input);
  if (input.syncKey.byteLength !== VAULT_KEY_BYTES || input.iv.byteLength !== GCM_NONCE_BYTES) {
    throw new Error('Cloud sync encryption key or nonce is invalid.');
  }
  const sealed = encryptBlob(
    input.plaintext,
    input.syncKey,
    input.iv,
    operationAssociatedData(input),
  );
  const sealedBytes = utf8ToBytes(sealed);
  return {
    id: input.id,
    deviceId: input.deviceId,
    deviceSequence: input.deviceSequence,
    keyEpoch: input.keyEpoch,
    idempotencyKey: input.idempotencyKey,
    createdAt: input.createdAt,
    ciphertext: base64.encode(sealedBytes),
    ciphertextSha256: hex(sha256(sealedBytes)),
  };
}

export function openCloudSyncOperation(input: {
  operation: CloudSyncOperation;
  workspaceRef: string;
  syncKey: Uint8Array;
}): string | null {
  if (input.syncKey.byteLength !== VAULT_KEY_BYTES) return null;
  try {
    const sealed = bytesToUtf8(base64.decode(input.operation.ciphertext));
    return decryptBlob(
      sealed,
      input.syncKey,
      operationAssociatedData({ ...input.operation, workspaceRef: input.workspaceRef }),
    );
  } catch {
    return null;
  }
}

function operationAssociatedData(input: {
  workspaceRef: string;
  deviceId: string;
  deviceSequence: number;
  keyEpoch: number;
}): Uint8Array {
  return utf8ToBytes(
    `melo.cloud-sync.operation.v1:${input.workspaceRef}:${input.deviceId}:${input.deviceSequence}:${input.keyEpoch}`,
  );
}

function assertMetadata(input: {
  id: string;
  workspaceRef: string;
  deviceId: string;
  deviceSequence: number;
  keyEpoch: number;
  idempotencyKey: string;
  createdAt: string;
}): void {
  if (
    !/^[A-Za-z0-9._:-]{1,128}$/.test(input.id) ||
    !/^[A-Za-z0-9._:-]{1,128}$/.test(input.idempotencyKey) ||
    !/^[a-f0-9]{64}$/.test(input.workspaceRef) ||
    !/^[a-f0-9]{32}$/.test(input.deviceId) ||
    !Number.isSafeInteger(input.deviceSequence) ||
    input.deviceSequence < 1 ||
    !Number.isSafeInteger(input.keyEpoch) ||
    input.keyEpoch < 1 ||
    !isIso(input.createdAt)
  ) {
    throw new Error('Cloud sync operation metadata is invalid.');
  }
}

function isIso(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
