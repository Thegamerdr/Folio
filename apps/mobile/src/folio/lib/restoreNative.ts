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

import { restoreBackupFromBlob } from '@/folio/store';
import { reconcileEntitlements } from '@/folio/lib/billing/entitlements';
import { reconcileMissingEvidenceFiles } from '@/folio/lib/persist';

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
  const raw = await FileSystem.readAsStringAsync(asset.uri, {
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
}

export type ApplyRestoreResult = Readonly<{
  /** True when the store's load pipeline THREW and degraded the state to safe
   *  defaults — the file passed the envelope check but was fundamentally
   *  unreadable. (Per-FIELD corruption is silently defaulted by load()'s
   *  guards, same as a cold boot, and is NOT reported here — see
   *  restore.test.ts "field tolerance".) The caller must say so honestly. */
  degraded: boolean;
}>;

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
  const hydration = restoreBackupFromBlob(raw, workspaceId);
  if (hydration.status === 'incompatible-future-schema') {
    throw new Error(
      'This backup was created by a newer Melo version. Update Melo before restoring it.',
    );
  }
  const degraded = hydration.status !== 'applied';
  if (!degraded) await reconcileMissingEvidenceFiles(workspaceId);
  await reconcileEntitlements();
  return { degraded };
}
