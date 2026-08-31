import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { WorkspaceId } from '@folio/domain';

import { getPersistBlob } from '@/folio/store';
import { applyRestore } from '@/folio/lib/restoreNative';
import { summarizeRestore, validateRestoreJson, type RestoreSummary } from '@/folio/lib/restore';

import {
  buildCloudBackupEnvelope,
  formatRecoveryCode,
  normalizeRecoveryCode,
  normalizeCloudVaultUrl,
  openCloudBackupEnvelope,
  PERSONAL_CLOUD_BACKUP_WORKSPACE_ID,
  recoveryCodeFromBytes,
  recoveryCodeToKey,
  serializeCloudBackupEnvelope,
  workspaceBackupRef,
} from './cloudBackup';
import { GCM_NONCE_BYTES } from './cryptoBlob';

const LEGACY_PERSONAL_RECOVERY_CODE_ID = 'melo.cloudBackupRecovery.v1';
const RECOVERY_CODE_PREFIX = 'melo.cloudBackupRecovery.v2';
const DEVICE_ID = 'melo.cloudBackupDevice.v1';
const REQUEST_TIMEOUT_MS = 20_000;

export type CloudBackupStatus =
  | { exists: false }
  | {
      exists: true;
      createdAt: string;
      size: number;
      checksum: string | null;
      deviceId: string | null;
      generations: number;
    };

export type CreateCloudBackupResult = Readonly<{
  status: Extract<CloudBackupStatus, { exists: true }>;
  newRecoveryCode: string | null;
}>;

export type CloudAccountDeletionResponse = Readonly<{
  deleted: true;
  scope: 'account-cloud-data';
}>;

export type StagedCloudRestore = Readonly<{
  rawState: string;
  createdAt: string;
  summary: RestoreSummary;
  workspaceId: WorkspaceId;
}>;

export function getCloudVaultUrl(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_MELO_CLOUD_VAULT_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    const normalized = normalizeCloudVaultUrl(fromEnv);
    if (normalized !== null) return normalized;
  }
  const fromExtra = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.[
    'EXPO_PUBLIC_MELO_CLOUD_VAULT_URL'
  ];
  if (typeof fromExtra !== 'string' || fromExtra.trim().length === 0) return undefined;
  return normalizeCloudVaultUrl(fromExtra) ?? undefined;
}

export async function hasCloudRecoveryCode(workspaceId: WorkspaceId): Promise<boolean> {
  return (await getStoredRecoveryCode(workspaceId)) !== null;
}

export async function fetchCloudBackupStatus(
  workspaceId: WorkspaceId,
  token: string,
): Promise<CloudBackupStatus> {
  return requestJson<CloudBackupStatus>('/v1/backup', token, workspaceBackupRef(workspaceId), {
    method: 'GET',
  });
}

export async function createCloudBackup(
  workspaceId: WorkspaceId,
  token: string,
  options: { rotateRecoveryCode?: boolean } = {},
): Promise<CreateCloudBackupResult> {
  const workspaceRef = workspaceBackupRef(workspaceId);
  const existingCode = options.rotateRecoveryCode ? null : await getStoredRecoveryCode(workspaceId);
  const recoveryCode =
    existingCode ?? recoveryCodeFromBytes(Uint8Array.from(await Crypto.getRandomBytesAsync(32)));
  const recoveryKey = recoveryCodeToKey(recoveryCode)!;
  const createdAt = new Date().toISOString();
  const deviceId = await getOrCreateDeviceId();
  const plaintext = getPersistBlob(workspaceId);
  const envelope = buildCloudBackupEnvelope({
    plaintext,
    recoveryKey,
    iv: Uint8Array.from(await Crypto.getRandomBytesAsync(GCM_NONCE_BYTES)),
    createdAt,
    deviceId,
    workspaceRef,
  });
  const body = serializeCloudBackupEnvelope(envelope);

  const localProof = openCloudBackupEnvelope(body, recoveryCode, workspaceRef);
  if (!localProof.ok || localProof.plaintext !== plaintext) {
    throw new Error('Melo could not verify the encrypted backup before uploading it.');
  }

  const checksum = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, body);
  const response = await requestJson<{
    ok: true;
    createdAt: string;
    checksum: string;
    generations: number;
  }>('/v1/backup', token, workspaceRef, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/vnd.melo.encrypted-backup+json',
      'Content-Length': String(body.length),
      'X-Melo-Checksum': checksum,
      'X-Melo-Created-At': createdAt,
      'X-Melo-Device': deviceId,
    },
    body,
  });

  if (existingCode === null) {
    await storeRecoveryCode(workspaceRef, recoveryCode);
  }
  return {
    status: {
      exists: true,
      createdAt: response.createdAt,
      size: body.length,
      checksum: response.checksum,
      deviceId,
      generations: response.generations,
    },
    newRecoveryCode: existingCode === null ? formatRecoveryCode(recoveryCode) : null,
  };
}

export async function stageCloudRestore(
  workspaceId: WorkspaceId,
  token: string,
  suppliedRecoveryCode?: string,
): Promise<StagedCloudRestore> {
  const workspaceRef = workspaceBackupRef(workspaceId);
  const supplied =
    suppliedRecoveryCode === undefined ? undefined : normalizeRecoveryCode(suppliedRecoveryCode);
  if (suppliedRecoveryCode !== undefined && supplied === null) {
    throw new Error('Recovery codes contain eight groups of eight letters and numbers.');
  }
  const recoveryCode = supplied ?? (await getStoredRecoveryCode(workspaceId));
  if (recoveryCode === null) {
    throw new Error('Enter the recovery code created when cloud backup was enabled.');
  }

  const rawEnvelope = await requestText('/v1/backup/content', token, workspaceRef);
  const opened = openCloudBackupEnvelope(rawEnvelope, recoveryCode, workspaceRef);
  if (!opened.ok) {
    throw new Error(
      opened.reason === 'wrong-recovery-code'
        ? 'That recovery code could not open this backup.'
        : opened.reason === 'wrong-workspace'
          ? 'This backup belongs to a different Melo workspace.'
          : 'This cloud backup is not in a format this version of Melo can restore.',
    );
  }
  const validation = validateRestoreJson(opened.plaintext, workspaceId);
  if (!validation.ok) throw new Error('The decrypted backup does not contain a valid Melo vault.');

  if (suppliedRecoveryCode !== undefined) {
    await storeRecoveryCode(workspaceRef, recoveryCode);
  }
  return {
    rawState: opened.plaintext,
    createdAt: opened.envelope.createdAt,
    summary: summarizeRestore(validation.parsed),
    workspaceId,
  };
}

export async function applyCloudRestore(
  workspaceId: WorkspaceId,
  staged: StagedCloudRestore,
): Promise<{ degraded: boolean }> {
  if (String(staged.workspaceId) !== String(workspaceId)) {
    throw new Error('This staged backup belongs to a different Melo workspace.');
  }
  return applyRestore(staged.rawState, workspaceId);
}

export async function deleteCloudBackup(workspaceId: WorkspaceId, token: string): Promise<void> {
  await requestJson('/v1/backup', token, workspaceBackupRef(workspaceId), { method: 'DELETE' });
}

/** Purge every backup generation owned by the signed-in Melo account. */
export async function deleteCloudAccountData(token: string): Promise<CloudAccountDeletionResponse> {
  const payload = await requestJson<unknown>('/v1/account', token, null, { method: 'DELETE' });
  if (
    !record(payload) ||
    payload['deleted'] !== true ||
    payload['scope'] !== 'account-cloud-data'
  ) {
    throw new Error('The cloud service did not confirm that account backup data was deleted.');
  }
  return { deleted: true, scope: 'account-cloud-data' };
}

/** Remove device-only recovery material after its remote ciphertext no longer exists. */
export async function clearCloudBackupLocalSecrets(
  workspaceIds: readonly WorkspaceId[] = [PERSONAL_CLOUD_BACKUP_WORKSPACE_ID],
): Promise<void> {
  const recoveryKeys = [
    ...new Set(workspaceIds.map((id) => recoveryCodeId(workspaceBackupRef(id)))),
  ];
  await Promise.all([
    ...recoveryKeys.map((key) => SecureStore.deleteItemAsync(key)),
    SecureStore.deleteItemAsync(LEGACY_PERSONAL_RECOVERY_CODE_ID),
    SecureStore.deleteItemAsync(DEVICE_ID),
  ]);
}

async function getStoredRecoveryCode(workspaceId: WorkspaceId): Promise<string | null> {
  const workspaceRef = workspaceBackupRef(workspaceId);
  const scoped = normalizeRecoveryCode(
    (await SecureStore.getItemAsync(recoveryCodeId(workspaceRef))) ?? '',
  );
  if (scoped !== null) return scoped;
  if (String(workspaceId) !== String(PERSONAL_CLOUD_BACKUP_WORKSPACE_ID)) return null;

  const legacy = normalizeRecoveryCode(
    (await SecureStore.getItemAsync(LEGACY_PERSONAL_RECOVERY_CODE_ID)) ?? '',
  );
  if (legacy !== null) await storeRecoveryCode(workspaceRef, legacy);
  return legacy;
}

async function storeRecoveryCode(workspaceRef: string, recoveryCode: string): Promise<void> {
  await SecureStore.setItemAsync(recoveryCodeId(workspaceRef), recoveryCode, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

function recoveryCodeId(workspaceRef: string): string {
  return `${RECOVERY_CODE_PREFIX}.${workspaceRef}`;
}

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID);
  if (existing !== null && /^[a-f0-9]{32}$/.test(existing)) return existing;
  const generated = recoveryCodeFromBytes(
    Uint8Array.from(await Crypto.getRandomBytesAsync(32)),
  ).slice(0, 32);
  await SecureStore.setItemAsync(DEVICE_ID, generated, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return generated;
}

async function requestJson<T = unknown>(
  path: string,
  token: string,
  workspaceRef: string | null,
  init: RequestInit,
): Promise<T> {
  const response = await cloudFetch(path, token, workspaceRef, init);
  const parsed = (await response.json().catch(() => null)) as { error?: unknown } | null;
  if (!response.ok) throw new Error(apiError(parsed, response.status));
  return parsed as T;
}

async function requestText(path: string, token: string, workspaceRef: string): Promise<string> {
  const response = await cloudFetch(path, token, workspaceRef, { method: 'GET' });
  if (!response.ok) {
    const parsed = (await response.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(apiError(parsed, response.status));
  }
  return response.text();
}

async function cloudFetch(
  path: string,
  token: string,
  workspaceRef: string | null,
  init: RequestInit,
): Promise<Response> {
  const baseUrl = getCloudVaultUrl();
  if (baseUrl === undefined) throw new Error('Encrypted backup is not configured in this build.');
  if (token.trim().length === 0) throw new Error('Sign in again before using cloud backup.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(workspaceRef === null ? {} : { 'X-Melo-Workspace-Ref': workspaceRef }),
        ...init.headers,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Cloud backup took too long to respond. Your local data is unchanged.');
    }
    throw new Error('Cloud backup is unreachable. Your local data is unchanged.');
  } finally {
    clearTimeout(timeout);
  }
}

function apiError(payload: { error?: unknown } | null, status: number): string {
  if (payload !== null && typeof payload.error === 'string' && payload.error.length > 0) {
    return payload.error;
  }
  if (status === 401) return 'Your sign-in expired. Sign in again and retry.';
  if (status === 404) return 'No encrypted cloud backup exists for this account.';
  return 'Cloud backup could not complete. Your local data is unchanged.';
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
