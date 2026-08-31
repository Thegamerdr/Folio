import { createWorkspaceId, type WorkspaceId } from '@folio/domain';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';

import { decryptBlob, encryptBlob, GCM_NONCE_BYTES, VAULT_KEY_BYTES } from './cryptoBlob';

export const CLOUD_BACKUP_VERSION = 2 as const;
const LEGACY_CLOUD_BACKUP_VERSION = 1 as const;
export const RECOVERY_CODE_BYTES = VAULT_KEY_BYTES;
export const PERSONAL_CLOUD_BACKUP_WORKSPACE_ID = createWorkspaceId('workspace_personal_local');

const WORKSPACE_REF_PATTERN = /^[a-f0-9]{64}$/;

/** Normalize a cloud-vault origin before it can receive a Clerk bearer token or ciphertext. */
export function normalizeCloudVaultUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== 'https:' ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      url.search.length > 0 ||
      url.hash.length > 0 ||
      (url.pathname !== '' && url.pathname !== '/')
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export type CloudBackupEnvelope = Readonly<{
  version: typeof CLOUD_BACKUP_VERSION;
  encryption: 'AES-256-GCM';
  createdAt: string;
  deviceId: string;
  /** Opaque SHA-256 binding. The remote vault never needs the raw workspace ID. */
  workspaceRef: string;
  ciphertext: string;
}>;

type LegacyCloudBackupEnvelope = Readonly<{
  version: typeof LEGACY_CLOUD_BACKUP_VERSION;
  encryption: 'AES-256-GCM';
  createdAt: string;
  deviceId: string;
  ciphertext: string;
}>;

export type OpenCloudBackupResult =
  | {
      ok: true;
      plaintext: string;
      envelope: CloudBackupEnvelope | LegacyCloudBackupEnvelope;
      legacyPersonal: boolean;
    }
  | {
      ok: false;
      reason: 'invalid-envelope' | 'wrong-recovery-code' | 'wrong-workspace';
    };

export function normalizeRecoveryCode(value: string): string | null {
  const normalized = value.replace(/[\s-]/g, '').toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
}

export function formatRecoveryCode(value: string): string {
  const normalized = normalizeRecoveryCode(value);
  if (normalized === null) throw new Error('Recovery code must contain 64 hexadecimal characters.');
  return normalized
    .toUpperCase()
    .match(/.{1,8}/g)!
    .join('-');
}

export function recoveryCodeToKey(value: string): Uint8Array | null {
  const normalized = normalizeRecoveryCode(value);
  return normalized === null ? null : Uint8Array.from(hexToBytes(normalized));
}

export function recoveryCodeFromBytes(bytes: Uint8Array): string {
  if (bytes.byteLength !== RECOVERY_CODE_BYTES) {
    throw new Error(`Recovery code entropy must be ${RECOVERY_CODE_BYTES} bytes.`);
  }
  return bytesToHex(bytes);
}

/** Stable opaque identifier used by ciphertext AAD, SecureStore keys and the remote object path. */
export function workspaceBackupRef(workspaceId: string | WorkspaceId): string {
  const checked = createWorkspaceId(String(workspaceId));
  return bytesToHex(sha256(utf8ToBytes(String(checked))));
}

export function normalizeWorkspaceBackupRef(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return WORKSPACE_REF_PATTERN.test(normalized) ? normalized : null;
}

export function buildCloudBackupEnvelope(input: {
  plaintext: string;
  recoveryKey: Uint8Array;
  iv: Uint8Array;
  createdAt: string;
  deviceId: string;
  workspaceRef: string;
}): CloudBackupEnvelope {
  if (input.recoveryKey.byteLength !== RECOVERY_CODE_BYTES) {
    throw new Error('Recovery key must be 256 bits.');
  }
  if (input.iv.byteLength !== GCM_NONCE_BYTES) {
    throw new Error('Cloud backup nonce must be 96 bits.');
  }
  const workspaceRef = normalizeWorkspaceBackupRef(input.workspaceRef);
  if (!isIsoDate(input.createdAt) || !isSafeDeviceId(input.deviceId) || workspaceRef === null) {
    throw new Error('Cloud backup metadata is invalid.');
  }
  return {
    version: CLOUD_BACKUP_VERSION,
    encryption: 'AES-256-GCM',
    createdAt: input.createdAt,
    deviceId: input.deviceId,
    workspaceRef,
    ciphertext: encryptBlob(
      input.plaintext,
      input.recoveryKey,
      input.iv,
      cloudBackupAssociatedData(workspaceRef),
    ),
  };
}

export function openCloudBackupEnvelope(
  raw: string,
  recoveryCode: string,
  expectedWorkspaceRef: string,
): OpenCloudBackupResult {
  const key = recoveryCodeToKey(recoveryCode);
  if (key === null) return { ok: false, reason: 'wrong-recovery-code' };
  const expected = normalizeWorkspaceBackupRef(expectedWorkspaceRef);
  if (expected === null) return { ok: false, reason: 'invalid-envelope' };

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid-envelope' };
  }

  if (isCloudBackupEnvelope(candidate)) {
    if (candidate.workspaceRef !== expected) return { ok: false, reason: 'wrong-workspace' };
    const plaintext = decryptBlob(
      candidate.ciphertext,
      key,
      cloudBackupAssociatedData(candidate.workspaceRef),
    );
    return plaintext === null
      ? { ok: false, reason: 'wrong-recovery-code' }
      : { ok: true, plaintext, envelope: candidate, legacyPersonal: false };
  }

  if (!isLegacyCloudBackupEnvelope(candidate)) {
    return { ok: false, reason: 'invalid-envelope' };
  }
  if (expected !== workspaceBackupRef(PERSONAL_CLOUD_BACKUP_WORKSPACE_ID)) {
    return { ok: false, reason: 'wrong-workspace' };
  }
  const plaintext = decryptBlob(candidate.ciphertext, key);
  return plaintext === null
    ? { ok: false, reason: 'wrong-recovery-code' }
    : { ok: true, plaintext, envelope: candidate, legacyPersonal: true };
}

export function serializeCloudBackupEnvelope(envelope: CloudBackupEnvelope): string {
  return JSON.stringify(envelope);
}

function cloudBackupAssociatedData(workspaceRef: string): Uint8Array {
  return utf8ToBytes(`melo.cloud-backup.v2:${workspaceRef}`);
}

function isCloudBackupEnvelope(value: unknown): value is CloudBackupEnvelope {
  if (!isEnvelopeRecord(value)) return false;
  return (
    value.version === CLOUD_BACKUP_VERSION &&
    typeof value.workspaceRef === 'string' &&
    normalizeWorkspaceBackupRef(value.workspaceRef) === value.workspaceRef
  );
}

function isLegacyCloudBackupEnvelope(value: unknown): value is LegacyCloudBackupEnvelope {
  return isEnvelopeRecord(value) && value.version === LEGACY_CLOUD_BACKUP_VERSION;
}

function isEnvelopeRecord(value: unknown): value is Record<string, unknown> & {
  encryption: 'AES-256-GCM';
  createdAt: string;
  deviceId: string;
  ciphertext: string;
} {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.encryption === 'AES-256-GCM' &&
    typeof record.createdAt === 'string' &&
    isIsoDate(record.createdAt) &&
    typeof record.deviceId === 'string' &&
    isSafeDeviceId(record.deviceId) &&
    typeof record.ciphertext === 'string' &&
    record.ciphertext.startsWith('FVE1:')
  );
}

function isIsoDate(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isSafeDeviceId(value: string): boolean {
  return /^[a-f0-9]{32}$/.test(value);
}
