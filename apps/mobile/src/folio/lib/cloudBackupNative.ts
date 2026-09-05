import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { fetch as nativeFetch } from 'expo/fetch';
import { createWorkspaceId, type WorkspaceId } from '@folio/domain';

import { getPersistBlob } from '@/folio/store';
import { applyBusinessCloudRestore } from '@/folio/lib/restoreNative';
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
const MAX_CLOUD_RESPONSE_BYTES = 4 * 1024 * 1024 + 256 * 1024;
let deviceIdentityCreation: Promise<string> | null = null;
const backupTails = new Map<string, Promise<void>>();

export type CloudBackupStatus =
  | { exists: false; revision?: number }
  | {
      exists: true;
      createdAt: string;
      size: number;
      checksum: string | null;
      deviceId: string | null;
      generations: number;
      generation?: number;
      previousGeneration?: number | null;
      anchorGeneration?: number | null;
      revision?: number;
    };

export type CloudBackupCatalogEntry = Readonly<{
  workspaceRef: string;
  generation: number;
  previousGeneration: number | null;
  anchorGeneration: number | null;
  createdAt: string;
  size: number;
  checksum: string;
}>;

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
  /** Memory-only until explicit apply. Never log or include in confirmation summaries. */
  recoveryCode?: string;
  generation?: 'current' | 'previous' | 'anchor';
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
  const value = await requestJson<unknown>('/v1/backup', token, workspaceBackupRef(workspaceId), {
    method: 'GET',
  });
  if (
    !record(value) ||
    typeof value.exists !== 'boolean' ||
    !Number.isSafeInteger(value.revision) ||
    Number(value.revision) < 0
  )
    throw new Error(
      'Cloud backup status is invalid. Upgrade the configured service before backing up.',
    );
  if (!value.exists) return { exists: false, revision: Number(value.revision) };
  if (
    !isCatalogEntry({ ...value, workspaceRef: workspaceBackupRef(workspaceId) }) ||
    !Number.isSafeInteger(value.generations) ||
    typeof value.deviceId !== 'string'
  )
    throw new Error('Cloud backup generation is invalid.');
  return value as Extract<CloudBackupStatus, { exists: true }>;
}

/** Ciphertext-only account discovery. Labels and workspace IDs remain inside encrypted bodies. */
export async function fetchCloudBackupCatalog(
  token: string,
): Promise<readonly CloudBackupCatalogEntry[]> {
  const payload = await requestJson<{ workspaces?: unknown }>('/v1/backups', token, null, {
    method: 'GET',
  });
  if (!record(payload) || !Array.isArray(payload.workspaces)) {
    throw new Error('Cloud backup catalog is invalid.');
  }
  if (!payload.workspaces.every(isCatalogEntry))
    throw new Error('Cloud backup catalog contains an invalid generation.');
  return payload.workspaces;
}

export async function createCloudBackup(
  workspaceId: WorkspaceId,
  token: string,
  options: { rotateRecoveryCode?: boolean } = {},
): Promise<CreateCloudBackupResult> {
  const ref = workspaceBackupRef(workspaceId);
  const prior = backupTails.get(ref) ?? Promise.resolve();
  const run = prior.then(() => performCreateCloudBackup(workspaceId, token, options));
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  backupTails.set(ref, settled);
  void settled.then(() => {
    if (backupTails.get(ref) === settled) backupTails.delete(ref);
  });
  return run;
}

async function performCreateCloudBackup(
  workspaceId: WorkspaceId,
  token: string,
  options: { rotateRecoveryCode?: boolean },
): Promise<CreateCloudBackupResult> {
  const workspaceRef = workspaceBackupRef(workspaceId);
  const storedCode = await getStoredRecoveryCode(workspaceId);
  const pendingCode = await getPendingRecoveryCode(workspaceRef);
  const remote = await fetchCloudBackupStatus(workspaceId, token);
  let activeCode = storedCode;
  let pendingPromoted = false;
  if (remote.exists) {
    const raw = await requestText('/v1/backup/content', token, workspaceRef);
    const checksum = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
    if (checksum !== remote.checksum)
      throw new Error('The backup changed while checking its recovery key. Refresh and retry.');
    // A prior upload may have committed while its response was lost. Promote that intent only
    // after opening the CURRENT ciphertext; otherwise an ordinary save must continue using the
    // known active key and leave the pending rotation recoverable for an explicit retry.
    if (pendingCode !== null && openCloudBackupEnvelope(raw, pendingCode, workspaceRef).ok) {
      activeCode = pendingCode;
      pendingPromoted = true;
      if (storedCode !== null && storedCode !== pendingCode) {
        await storeAnchorRecoveryCode(workspaceRef, storedCode);
      }
      await storeRecoveryCode(workspaceRef, pendingCode);
    }
    if (
      !options.rotateRecoveryCode &&
      (activeCode === null || !openCloudBackupEnvelope(raw, activeCode, workspaceRef).ok)
    ) {
      throw new Error(
        'Enter the recovery code for the current backup before replacing it. Another device may have changed the code.',
      );
    }
  }
  // An accepted rotation's retry must not promote the new-key copy over the old-key anchor.
  const rotate = options.rotateRecoveryCode === true && !pendingPromoted;
  const existingCode = rotate ? pendingCode : (activeCode ?? pendingCode);
  if (remote.exists && storedCode === null && pendingCode === null && !options.rotateRecoveryCode) {
    throw new Error(
      'This account already has an encrypted backup. Enter its recovery code before replacing it.',
    );
  }
  const recoveryCode =
    existingCode ?? recoveryCodeFromBytes(Uint8Array.from(await Crypto.getRandomBytesAsync(32)));
  if ((storedCode === null || rotate) && pendingCode !== recoveryCode) {
    await storePendingRecoveryCode(workspaceRef, recoveryCode);
  }
  const recoveryKey = recoveryCodeToKey(recoveryCode)!;
  const createdAt = new Date().toISOString();
  const deviceId = await getOrCreateCloudDeviceId();
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
    generation?: number;
    previousGeneration?: number | null;
    anchorGeneration?: number | null;
    revision?: number;
  }>('/v1/backup', token, workspaceRef, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/vnd.melo.encrypted-backup+json',
      'Content-Length': String(body.length),
      'X-Melo-Checksum': checksum,
      'X-Melo-Created-At': createdAt,
      'X-Melo-Device': deviceId,
      ...(remote.exists ? { 'If-Match': String(remote.generation) } : { 'If-None-Match': '*' }),
      ...(rotate ? { 'X-Melo-Key-Rotation': '1' } : {}),
      'X-Melo-Backup-Revision': String(remote.revision ?? 0),
    },
    body,
  });

  if (
    !record(response) ||
    response.ok !== true ||
    response.checksum !== checksum ||
    !Number.isSafeInteger(response.generation) ||
    !Number.isSafeInteger(response.generations)
  )
    throw new Error(
      'The server did not confirm this encrypted backup. Its recovery code remains saved for retry.',
    );
  if (storedCode === null || rotate || pendingPromoted) {
    if (storedCode !== null && storedCode !== recoveryCode) {
      await storeAnchorRecoveryCode(workspaceRef, storedCode);
    }
    await storeRecoveryCode(workspaceRef, recoveryCode);
    await SecureStore.deleteItemAsync(pendingRecoveryCodeId(workspaceRef));
  }
  return {
    status: {
      exists: true,
      createdAt: response.createdAt,
      size: body.length,
      checksum: response.checksum,
      deviceId,
      generations: response.generations,
      ...(typeof response.generation === 'number' ? { generation: response.generation } : {}),
      ...(response.previousGeneration !== undefined
        ? { previousGeneration: response.previousGeneration }
        : {}),
      ...(response.anchorGeneration !== undefined
        ? { anchorGeneration: response.anchorGeneration }
        : {}),
      revision: response.revision ?? remote.revision ?? 0,
    },
    newRecoveryCode:
      storedCode === null || rotate || pendingPromoted ? formatRecoveryCode(recoveryCode) : null,
  };
}

export async function stageCloudRestore(
  workspaceId: WorkspaceId,
  token: string,
  suppliedRecoveryCode?: string,
  options: { generation?: 'current' | 'previous' | 'anchor' } = {},
): Promise<StagedCloudRestore> {
  const workspaceRef = workspaceBackupRef(workspaceId);
  const supplied =
    suppliedRecoveryCode === undefined ? undefined : normalizeRecoveryCode(suppliedRecoveryCode);
  if (suppliedRecoveryCode !== undefined && supplied === null) {
    throw new Error('Recovery codes contain eight groups of eight letters and numbers.');
  }
  const recoveryCode =
    supplied ??
    (options.generation === 'anchor'
      ? normalizeRecoveryCode(
          (await SecureStore.getItemAsync(anchorRecoveryCodeId(workspaceRef))) ?? '',
        )
      : await getStoredRecoveryCode(workspaceId));
  if (recoveryCode === null) {
    throw new Error('Enter the recovery code created when cloud backup was enabled.');
  }

  const rawEnvelope = await requestText(
    `/v1/backup/content${options.generation === 'previous' ? '?generation=previous' : options.generation === 'anchor' ? '?generation=anchor' : ''}`,
    token,
    workspaceRef,
  );
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

  return {
    rawState: opened.plaintext,
    createdAt: opened.envelope.createdAt,
    summary: summarizeRestore(validation.parsed),
    workspaceId,
    recoveryCode,
    generation: options.generation ?? 'current',
  };
}

export async function applyCloudRestore(
  workspaceId: WorkspaceId,
  staged: StagedCloudRestore,
): Promise<{ degraded: boolean }> {
  if (String(staged.workspaceId) !== String(workspaceId)) {
    throw new Error('This staged backup belongs to a different Melo workspace.');
  }
  const result = await applyBusinessCloudRestore(staged.rawState, workspaceId);
  if (!result.degraded && staged.generation === 'current' && staged.recoveryCode !== undefined) {
    await storeRecoveryCode(workspaceBackupRef(workspaceId), staged.recoveryCode);
  }
  return result;
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
    ...new Set(
      workspaceIds.flatMap((id) => {
        const ref = workspaceBackupRef(id);
        return [recoveryCodeId(ref), pendingRecoveryCodeId(ref), anchorRecoveryCodeId(ref)];
      }),
    ),
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

/** Discover and stage a backup on a clean device without exposing workspace metadata remotely. */
export async function stageDiscoveredCloudRestore(
  workspaceRef: string,
  token: string,
  recoveryCode: string,
  options: { generation?: 'current' | 'previous' | 'anchor' } = {},
): Promise<StagedCloudRestore> {
  const expectedRef = workspaceRef.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedRef)) throw new Error('Cloud backup reference is invalid.');
  const normalizedCode = normalizeRecoveryCode(recoveryCode);
  if (normalizedCode === null)
    throw new Error('Recovery codes contain eight groups of eight letters and numbers.');
  const rawEnvelope = await requestText(
    `/v1/backup/content${options.generation === 'previous' ? '?generation=previous' : options.generation === 'anchor' ? '?generation=anchor' : ''}`,
    token,
    expectedRef,
  );
  const opened = openCloudBackupEnvelope(rawEnvelope, normalizedCode, expectedRef);
  if (!opened.ok)
    throw new Error(
      opened.reason === 'wrong-recovery-code'
        ? 'That recovery code could not open this backup.'
        : 'This cloud backup could not be opened safely.',
    );
  const workspaceId = workspaceIdFromBackupPlaintext(opened.plaintext, expectedRef);
  const validation = validateRestoreJson(opened.plaintext, workspaceId);
  if (!validation.ok) throw new Error('The decrypted backup does not contain a valid Melo vault.');
  return {
    rawState: opened.plaintext,
    createdAt: opened.envelope.createdAt,
    summary: summarizeRestore(validation.parsed),
    workspaceId,
    recoveryCode: normalizedCode,
    generation: options.generation ?? 'current',
  };
}

async function getPendingRecoveryCode(workspaceRef: string): Promise<string | null> {
  return normalizeRecoveryCode(
    (await SecureStore.getItemAsync(pendingRecoveryCodeId(workspaceRef))) ?? '',
  );
}

async function storeRecoveryCode(workspaceRef: string, recoveryCode: string): Promise<void> {
  await SecureStore.setItemAsync(recoveryCodeId(workspaceRef), recoveryCode, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function storeAnchorRecoveryCode(workspaceRef: string, recoveryCode: string): Promise<void> {
  await SecureStore.setItemAsync(anchorRecoveryCodeId(workspaceRef), recoveryCode, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function storePendingRecoveryCode(workspaceRef: string, recoveryCode: string): Promise<void> {
  await SecureStore.setItemAsync(pendingRecoveryCodeId(workspaceRef), recoveryCode, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

function recoveryCodeId(workspaceRef: string): string {
  return `${RECOVERY_CODE_PREFIX}.${workspaceRef}`;
}

function pendingRecoveryCodeId(workspaceRef: string): string {
  return `${RECOVERY_CODE_PREFIX}.pending.${workspaceRef}`;
}

function anchorRecoveryCodeId(workspaceRef: string): string {
  return `${RECOVERY_CODE_PREFIX}.anchor.${workspaceRef}`;
}

function workspaceIdFromBackupPlaintext(raw: string, expectedRef: string): WorkspaceId {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('The decrypted backup is not valid JSON.');
  }
  const dataWorkspaceId =
    record(parsed) && typeof parsed.dataWorkspaceId === 'string'
      ? parsed.dataWorkspaceId
      : String(PERSONAL_CLOUD_BACKUP_WORKSPACE_ID);
  let workspaceId: WorkspaceId;
  try {
    workspaceId = createWorkspaceId(dataWorkspaceId);
  } catch {
    throw new Error('The decrypted backup does not identify a valid workspace.');
  }
  if (workspaceBackupRef(workspaceId) !== expectedRef) {
    throw new Error('The decrypted backup belongs to a different workspace.');
  }
  return workspaceId;
}

export async function getOrCreateCloudDeviceId(): Promise<string> {
  if (deviceIdentityCreation !== null) return deviceIdentityCreation;
  deviceIdentityCreation = loadOrCreateCloudDeviceId().finally(() => {
    deviceIdentityCreation = null;
  });
  return deviceIdentityCreation;
}

async function loadOrCreateCloudDeviceId(): Promise<string> {
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
    const response = await nativeFetch(`${baseUrl}${path}`, {
      method: init.method ?? 'GET',
      ...(init.body === undefined ? {} : { body: init.body }),
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(workspaceRef === null ? {} : { 'X-Melo-Workspace-Ref': workspaceRef }),
        ...init.headers,
      },
    });
    const body = await readBoundedResponseBody(response, MAX_CLOUD_RESPONSE_BYTES);
    return new Response(body, { status: response.status, headers: response.headers });
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

async function readBoundedResponseBody(response: Response, limit: number): Promise<Uint8Array> {
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error('Cloud backup response exceeded the safe size limit.');
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function isCatalogEntry(value: unknown): value is CloudBackupCatalogEntry {
  return (
    record(value) &&
    typeof value.workspaceRef === 'string' &&
    /^[a-f0-9]{64}$/.test(value.workspaceRef) &&
    typeof value.generation === 'number' &&
    Number.isSafeInteger(value.generation) &&
    value.generation >= 1 &&
    (value.previousGeneration === null || Number.isSafeInteger(value.previousGeneration)) &&
    (value.anchorGeneration === null || Number.isSafeInteger(value.anchorGeneration)) &&
    typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    typeof value.size === 'number' &&
    Number.isSafeInteger(value.size) &&
    value.size > 0 &&
    typeof value.checksum === 'string' &&
    /^[a-f0-9]{64}$/.test(value.checksum)
  );
}
