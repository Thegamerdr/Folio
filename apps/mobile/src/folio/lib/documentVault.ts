import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { base64 } from '@scure/base';
import { AppState, Platform } from 'react-native';

import type { LocalDocumentStageInput } from '@/local/localLedger';
import type { EvidenceDocument } from '@/folio/store';

import { decryptBytes, encryptBytes, GCM_NONCE_BYTES } from './cryptoBlob';
import { getVaultKey } from './vaultKey';
import {
  deriveWorkspacePartitionKey,
  workspaceEvidenceAssociatedData,
  workspaceEvidenceFilename,
  workspacePartitionRef,
} from './workspacePartition';
import type { PersistedWorkspace } from './workspaceRoot';

export const MAX_EVIDENCE_BYTES = 12 * 1024 * 1024;
const VIEW_CACHE_PREFIX = 'melo-evidence-view-';
const ANDROID_VIEW_CACHE_TIMEOUT_MS = 10 * 60 * 1000;

export type EvidenceRetentionFailureCopy = Readonly<{
  title: string;
  body: string;
}>;

/** Keep native filesystem/keystore implementation details out of the intake UI while preserving
 *  specific recovery guidance for failures the user can act on. */
export function evidenceRetentionFailureCopy(reason: unknown): EvidenceRetentionFailureCopy {
  const record = typeof reason === 'object' && reason !== null ? reason : undefined;
  const code =
    record !== undefined && 'code' in record && typeof record.code === 'string'
      ? record.code.toLowerCase()
      : '';
  const message =
    reason instanceof Error ? reason.message.toLowerCase() : String(reason).toLowerCase();
  const detail = `${code} ${message}`;

  if (/enospc|no space|disk full|storage full|quota/u.test(detail)) {
    return {
      title: 'Not enough storage',
      body: 'Melo could not save an encrypted copy. Free some space, then choose the file again. Nothing was added.',
    };
  }
  if (/keystore|keychain|secure.?store|protected key|key storage/u.test(detail)) {
    return {
      title: 'Protected storage unavailable',
      body: 'Unlock the device fully, then choose the file again. Nothing was added.',
    };
  }
  if (/selected source file is empty/u.test(detail)) {
    return {
      title: 'This file is empty',
      body: 'Choose another file. Nothing was added.',
    };
  }
  if (/larger than the 12 mb encrypted-file limit/u.test(detail)) {
    return {
      title: 'This file is too large',
      body: "Choose a file under Melo's 12 MB encrypted-file limit. Nothing was added.",
    };
  }
  return {
    title: 'Could not save this source',
    body: 'Melo could not save an encrypted copy of this file. Try again, or add the record manually. Nothing was added.',
  };
}

export type RetainEvidenceInput = Readonly<{
  workspace: PersistedWorkspace;
  source: LocalDocumentStageInput;
  sourceType: EvidenceDocument['sourceType'];
  extractionStatus: EvidenceDocument['extractionStatus'];
}>;

function cleanDisplayFilename(value: string): string {
  const last = value.split(/[\\/]/u).at(-1) ?? '';
  const cleaned = last.replace(/[\u0000-\u001f\u007f]/gu, '').trim();
  return (cleaned || 'saved-source').slice(0, 240);
}

function safeExtension(filename: string, mediaType: string): string {
  const match = /\.([a-z0-9]{1,10})$/iu.exec(filename);
  if (match?.[1]) return match[1].toLowerCase();
  if (mediaType === 'application/pdf') return 'pdf';
  if (mediaType === 'text/csv') return 'csv';
  if (mediaType.startsWith('text/')) return 'txt';
  if (mediaType === 'image/png') return 'png';
  if (mediaType === 'image/heic' || mediaType === 'image/heif') return 'heic';
  if (mediaType.startsWith('image/')) return 'jpg';
  return 'bin';
}

async function evidenceKey(workspace: PersistedWorkspace): Promise<Uint8Array> {
  return deriveWorkspacePartitionKey(await getVaultKey(), workspace, 'documents');
}

/** Keep an Android viewer grant alive until Melo returns to the foreground. Some viewers return
 *  from ACTION_VIEW before they have read the content URI, so deleting in the launch promise's
 *  `finally` produces a blank document. The timeout and boot cleanup remain bounded fallbacks. */
function removeAndroidViewCacheWhenMeloReturns(cacheUri: string): () => void {
  let sawBackground = AppState.currentState !== 'active';
  let finished = false;
  let subscription: { remove(): void } | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const cleanup = () => {
    if (finished) return;
    finished = true;
    subscription?.remove();
    if (timeout !== undefined) clearTimeout(timeout);
    void FileSystem.deleteAsync(cacheUri, { idempotent: true }).catch(() => undefined);
  };

  subscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      if (sawBackground) cleanup();
      return;
    }
    sawBackground = true;
  });
  timeout = setTimeout(cleanup, ANDROID_VIEW_CACHE_TIMEOUT_MS);
  return cleanup;
}

/** Copy a picker/camera original into an opaque, per-workspace AES-256-GCM vault. The returned state
 *  row contains metadata only; no source URI or file bytes are persisted in AppState. */
export async function retainEvidenceDocument(
  input: RetainEvidenceInput,
): Promise<EvidenceDocument> {
  const dir = FileSystem.documentDirectory;
  if (dir === null || input.source.uri === undefined) {
    throw new Error('Encrypted source storage is unavailable on this device.');
  }

  const sourceBase64 = await FileSystem.readAsStringAsync(input.source.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = base64.decode(sourceBase64);
  if (bytes.byteLength < 1) throw new Error('The selected source file is empty.');
  if (bytes.byteLength > MAX_EVIDENCE_BYTES) {
    throw new Error('The selected source is larger than the 12 MB encrypted-file limit.');
  }

  const idBytes = Uint8Array.from(await Crypto.getRandomBytesAsync(16));
  const evidenceId = `evidence_${Array.from(idBytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')}`;
  const filename = workspaceEvidenceFilename(input.workspace.id, evidenceId);
  const main = `${dir}${filename}`;
  const temporary = `${main}.tmp`;
  const iv = Uint8Array.from(await Crypto.getRandomBytesAsync(GCM_NONCE_BYTES));
  const encoded = encryptBytes(
    bytes,
    await evidenceKey(input.workspace),
    iv,
    workspaceEvidenceAssociatedData(input.workspace, evidenceId),
  );

  try {
    await FileSystem.writeAsStringAsync(temporary, encoded, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await FileSystem.deleteAsync(main, { idempotent: true });
    await FileSystem.moveAsync({ from: temporary, to: main });
  } catch (reason: unknown) {
    await Promise.allSettled([
      FileSystem.deleteAsync(temporary, { idempotent: true }),
      FileSystem.deleteAsync(main, { idempotent: true }),
    ]);
    throw reason;
  }

  return {
    id: evidenceId,
    workspaceId: input.workspace.id,
    filename: cleanDisplayFilename(input.source.filename),
    mediaType: input.source.mediaType.trim() || 'application/octet-stream',
    byteSize: bytes.byteLength,
    addedAtISO: new Date().toISOString(),
    sourceType: input.sourceType,
    extractionStatus: input.extractionStatus,
    storageState: 'encrypted-device-vault',
  };
}

/** Decrypt one retained original into a short-lived cache file and hand it to the OS. Android keeps
 *  the grant alive only until Melo returns to the foreground; other platforms remove the plaintext
 *  when their share/view surface returns. A wrong workspace, swapped row, missing file or tampered
 *  ciphertext fails before any external surface opens. */
export async function openEvidenceDocument(
  workspace: PersistedWorkspace,
  document: EvidenceDocument,
): Promise<void> {
  if (document.workspaceId !== workspace.id) {
    throw new Error('This source belongs to a different workspace.');
  }
  const dir = FileSystem.documentDirectory;
  const cache = FileSystem.cacheDirectory;
  if (dir === null || cache === null)
    throw new Error('Source viewing is unavailable on this device.');

  await clearEvidenceViewCache();
  const encryptedUri = `${dir}${workspaceEvidenceFilename(workspace.id, document.id)}`;
  const encoded = await FileSystem.readAsStringAsync(encryptedUri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const bytes = decryptBytes(
    encoded,
    await evidenceKey(workspace),
    workspaceEvidenceAssociatedData(workspace, document.id),
  );
  if (bytes === null) throw new Error('This saved source could not be verified.');
  if (Platform.OS !== 'android' && !(await Sharing.isAvailableAsync())) {
    throw new Error('No compatible source viewer is available on this device.');
  }

  const extension = safeExtension(document.filename, document.mediaType);
  const cacheName = `${VIEW_CACHE_PREFIX}${workspacePartitionRef(workspace.id).slice(0, 12)}-${document.id.slice(-12)}.${extension}`;
  const cacheUri = `${cache}${cacheName}`;
  let deleteImmediately = true;
  try {
    await FileSystem.writeAsStringAsync(cacheUri, base64.encode(bytes), {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (Platform.OS === 'android') {
      const contentUri = await FileSystem.getContentUriAsync(cacheUri);
      const cancelDeferredCleanup = removeAndroidViewCacheWhenMeloReturns(cacheUri);
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: document.mediaType,
        });
        deleteImmediately = false;
      } catch (reason: unknown) {
        cancelDeferredCleanup();
        throw reason;
      }
    } else {
      await Sharing.shareAsync(cacheUri, {
        dialogTitle: `Open ${document.filename}`,
        mimeType: document.mediaType,
      });
    }
  } finally {
    if (deleteImmediately) {
      await FileSystem.deleteAsync(cacheUri, { idempotent: true }).catch(() => undefined);
    }
  }
}

/** Delete one encrypted original after explicit user confirmation. Metadata/reference removal lives
 *  in the store and must run only after this idempotent file deletion succeeds. */
export async function deleteEvidenceDocumentFile(
  workspace: PersistedWorkspace,
  document: EvidenceDocument,
): Promise<void> {
  if (document.workspaceId !== workspace.id) {
    throw new Error('This source belongs to a different workspace.');
  }
  const dir = FileSystem.documentDirectory;
  if (dir === null) throw new Error('Source storage is unavailable on this device.');
  const uri = `${dir}${workspaceEvidenceFilename(workspace.id, document.id)}`;
  await Promise.all([
    FileSystem.deleteAsync(uri, { idempotent: true }),
    FileSystem.deleteAsync(`${uri}.tmp`, { idempotent: true }),
    clearEvidenceViewCache(),
  ]);
}

/** Remove plaintext viewer leftovers from an interrupted prior session. Safe to call at boot. */
export async function clearEvidenceViewCache(): Promise<void> {
  const cache = FileSystem.cacheDirectory;
  if (cache === null || cache === undefined) return;
  let names: string[] = [];
  try {
    names = await FileSystem.readDirectoryAsync(cache);
  } catch {
    return;
  }
  await Promise.allSettled(
    names
      .filter((name) => name.startsWith(VIEW_CACHE_PREFIX))
      .map((name) => FileSystem.deleteAsync(`${cache}${name}`, { idempotent: true })),
  );
}
