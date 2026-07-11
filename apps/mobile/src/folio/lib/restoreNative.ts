// Native restore wrapper — the thin platform layer over the PURE restore
// engine (./restore.ts), mirroring the export.ts / exportNative.ts split
// (plan 113). Picks the file, reads it, validates the envelope; applying it
// routes through the store's own cold-boot hydration path so every migrate /
// guard / re-anchor rule applies identically to a restore and a first run.
//
// HARD CONSTRAINTS:
//   • Validation happens BEFORE `hydrateFromBlob` is ever called —
//     hydrateFromBlob silently no-ops on malformed input (correct for a disk
//     blob, wrong for a user-picked file where failure must be visible), so
//     nothing invalid may reach it.
//   • This module never confirms anything. The caller (PrivacyScreen) owns the
//     replace-your-data confirm chain; `applyRestore` assumes consent is given.
//   • No new persistence logic: hydrateFromBlob publishes via setPartial, which
//     the running persister (persist.ts startPersisting) picks up and writes.

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { consumeLoadDegraded, hydrateFromBlob } from '@/folio/store';
import { reconcileEntitlements } from '@/folio/lib/billing/entitlements';

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
export async function pickRestoreFile(): Promise<PickRestoreResult> {
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

  const validation = validateRestoreJson(raw);
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
 * (`hydrateFromBlob` → load()/migrate/guards/re-anchor), reads the degraded
 * flag, then reconciles purchase entitlements against the restored lens flags
 * (same ordering as app boot: hydrate first, entitlements after).
 */
export async function applyRestore(raw: string): Promise<ApplyRestoreResult> {
  hydrateFromBlob(raw);
  const degraded = consumeLoadDegraded();
  await reconcileEntitlements();
  return { degraded };
}
