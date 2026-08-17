// Native restore wrapper — the thin platform layer over the PURE restore
// engine (./restore.ts), mirroring the export.ts / exportNative.ts split
// (plan 113). Picks the file, reads it, validates the envelope; applying it
// routes through the store's own restore-backed hydration path so every migrate /
// guard / re-anchor rule applies identically to a restore and a first run, while
// preserving the user-visible backup-restore explanation.
//
// HARD CONSTRAINTS:
//   • Validation happens BEFORE `restoreBackupFromBlob` is ever called —
//     the store's low-level hydrate boundary silently no-ops on malformed input (correct for a disk
//     blob, wrong for a user-picked file where failure must be visible), so
//     nothing invalid may reach it.
//   • This module never confirms anything. The caller (PrivacyScreen) owns the
//     replace-your-data confirm chain; `applyRestore` assumes consent is given.
//   • No new persistence logic: restoreBackupFromBlob publishes via setPartial, which
//     the running persister (persist.ts startPersisting) picks up and writes.

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import type { WorkspaceId } from '@folio/domain';

import { getPersistBlob, hydrateFromBlob, restoreBackupFromBlob } from '@/folio/store';
import { reconcileEntitlements } from '@/folio/lib/billing/entitlements';
import {
  persistCurrentStateNow,
  quiescePersistenceWrites,
  reconcileMissingEvidenceFiles,
} from '@/folio/lib/persist';
import { deleteOwnedPickerStage, stagePickerSource } from '@/folio/lib/pickerCache';

import { summarizeRestore, validateRestoreJson } from './restore';
import type { RestoreRejection, RestoreSummary } from './restore';

/** Outcome of the pick-and-validate stage (nothing is replaced yet). */
export type PickRestoreResult =
  | { status: 'cancelled' }
  | { status: 'invalid'; reason: RestoreRejection }
  | { status: 'staged'; raw: string; fileName: string; summary: RestoreSummary };

/**
 * Open the system file picker, read the chosen file, and validate it as a
 * Folio export. Returns a STAGED payload (plus the summary the confirm sheet
 * shows) — the caller must confirm with the user before `applyRestore`.
 */
export async function pickRestoreFile(workspaceId: WorkspaceId): Promise<PickRestoreResult> {
  // JSON mime plus octet-stream: share/download chains (email attachments,
  // some file managers) strip or rewrite the JSON mime type, and the envelope
  // validation is the real gate — the picker filter is only a convenience.
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'application/octet-stream'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || picked.assets.length === 0) return { status: 'cancelled' };

  const asset = picked.assets[0]!;
  const stagedUri = await stagePickerSource({
    uri: asset.uri,
    filename: asset.name,
    mediaType: asset.mimeType ?? 'application/json',
  });
  try {
    const raw = await FileSystem.readAsStringAsync(stagedUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const validation = validateRestoreJson(raw, workspaceId);
    if (!validation.ok) return { status: 'invalid', reason: validation.reason };

    return {
      status: 'staged',
      raw,
      fileName: asset.name,
      summary: summarizeRestore(validation.parsed),
    };
  } finally {
    await deleteOwnedPickerStage(stagedUri).catch(() => false);
  }
}

export type ApplyRestoreResult = Readonly<{
  applied: true;
  durable: true;
}>;

export class RestoreApplyError extends Error {
  readonly previousLiveStateRestored: boolean;

  constructor(message: string, previousLiveStateRestored: boolean, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RestoreApplyError';
    this.previousLiveStateRestored = previousLiveStateRestored;
  }
}

/**
 * Replace live state with a staged export. Runs the store's cold-boot path
 * (`restoreBackupFromBlob` → load()/migrate/guards/re-anchor), reads the degraded
 * flag, then reconciles purchase entitlements against the restored lens flags
 * (same ordering as app boot: hydrate first, entitlements after).
 */
export async function applyRestore(
  raw: string,
  workspaceId: WorkspaceId,
): Promise<ApplyRestoreResult> {
  const validation = validateRestoreJson(raw, workspaceId);
  if (!validation.ok) throw new Error('This backup cannot replace the selected Melo workspace.');
  const previousBlob = getPersistBlob(workspaceId);
  const resumePersistence = await quiescePersistenceWrites();
  let changedLiveState = false;
  try {
    const hydration = restoreBackupFromBlob(raw, workspaceId);
    if (hydration.status === 'incompatible-future-schema') {
      throw new Error(
        'This backup was created by a newer Melo version. Update Melo before restoring it.',
      );
    }
    if (hydration.status !== 'applied') {
      throw new Error('This backup could not be loaded safely. Nothing was replaced.');
    }
    changedLiveState = true;
    await reconcileMissingEvidenceFiles(workspaceId);
    await reconcileEntitlements();

    // A restore is not complete merely because React state changed. Commit the exact restored
    // partition through the read-verified SQLCipher authority before telling the user it worked.
    // The ordinary debounced writer is paused so it cannot race this explicit destructive write.
    await persistCurrentStateNow(workspaceId);
    return { applied: true, durable: true };
  } catch (cause: unknown) {
    let previousLiveStateRestored = !changedLiveState;
    if (changedLiveState) {
      try {
        previousLiveStateRestored = hydrateFromBlob(previousBlob, workspaceId).status === 'applied';
      } catch {
        previousLiveStateRestored = false;
      }
    }
    const baseMessage =
      cause instanceof Error ? cause.message : 'This backup could not be restored safely.';
    throw new RestoreApplyError(
      previousLiveStateRestored
        ? `${baseMessage} Your previous live data is still in place.`
        : `${baseMessage} Keep Melo open and do not make changes until you retry or recover from an export.`,
      previousLiveStateRestored,
      { cause },
    );
  } finally {
    resumePersistence();
  }
}
