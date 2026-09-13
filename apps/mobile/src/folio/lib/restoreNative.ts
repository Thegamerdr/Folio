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
import type { WorkspaceId } from '@folio/domain';

import { getState } from '@/folio/store';
import { reconcileEntitlements } from '@/folio/lib/billing/entitlements';
import {
  recoverAndActivatePersistedBusinessWorkspace,
  reconcileMissingEvidenceFiles,
  restorePersistedWorkspacePayload,
} from '@/folio/lib/persist';

import { summarizeRestore, validateRestoreJson } from './restore';
import { createRestoreResult, stringId, type RestoreResult } from './restoreResult';
import { PERSONAL_WORKSPACE_ID } from './workspaceRoot';
import type { RestoreRejection, RestoreSummary } from './restore';

/** Outcome of the pick-and-validate stage (nothing is replaced yet). */
export type PickRestoreResult =
  | { status: 'cancelled' }
  | { status: 'invalid'; reason: RestoreRejection; workspaceKind?: 'Personal' | 'Business' }
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
  const fileName = asset.name ?? '';
  if (asset.mimeType === 'text/csv' || fileName.toLowerCase().endsWith('.csv')) {
    return { status: 'invalid', reason: 'accountant-csv' };
  }
  const raw = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const validation = validateRestoreJson(raw, workspaceId);
  if (!validation.ok) {
    const workspaceKind =
      validation.reason === 'wrong-workspace' ? exportedWorkspaceKind(raw) : null;
    return {
      status: 'invalid',
      reason: validation.reason,
      ...(workspaceKind === null ? {} : { workspaceKind }),
    };
  }

  return {
    status: 'staged',
    raw,
    fileName: asset.name ?? 'Melo export.json',
    summary: summarizeRestore(validation.parsed),
  };
}

function exportedWorkspaceKind(raw: string): 'Personal' | 'Business' | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const workspaces = Array.isArray(parsed.workspaces) ? parsed.workspaces : [];
    const activeId = String(parsed.activeWorkspaceId ?? '');
    const workspace = workspaces.find(
      (candidate) =>
        candidate !== null &&
        typeof candidate === 'object' &&
        !Array.isArray(candidate) &&
        String((candidate as Record<string, unknown>).id ?? '') === activeId,
    );
    const kind =
      workspace && typeof workspace === 'object'
        ? (workspace as Record<string, unknown>).kind
        : parsed.kind;
    return kind === 'business' ? 'Business' : kind === 'personal' ? 'Personal' : null;
  } catch {
    return null;
  }
}

export type ApplyRestoreResult = RestoreResult;

function restoreInput(parsed: Record<string, unknown>) {
  // Keep malformed/non-object entries in the attempted count. The store is the authority for
  // whether a row can be loaded, while the receipt must still report rows it dropped.
  const attemptedTransactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
  const attemptedOriginalFileIds = Array.isArray(parsed.evidenceDocuments)
    ? parsed.evidenceDocuments
        .map((document) =>
          document !== null && typeof document === 'object' && !Array.isArray(document)
            ? stringId((document as Record<string, unknown>).id)
            : null,
        )
        .filter((id): id is string => id !== null)
    : [];
  const attemptedStatementRecords = Array.isArray(parsed.statementImports)
    ? parsed.statementImports.filter(
        (record): record is Record<string, unknown> =>
          record !== null && typeof record === 'object' && !Array.isArray(record),
      )
    : [];
  return {
    attemptedTransactions,
    attemptedStatementRecords,
    attemptedOriginalFileIds,
    attemptedAccounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
    attemptedDebts: Array.isArray(parsed.debts) ? parsed.debts : [],
    attemptedSubscriptions: Array.isArray(parsed.subs) ? parsed.subs : [],
    attemptedPots: Array.isArray(parsed.pots) ? parsed.pots : [],
  };
}

function resultFromState(
  workspaceId: WorkspaceId,
  degraded: boolean,
  input: ReturnType<typeof restoreInput>,
): RestoreResult {
  const restored = getState();
  return createRestoreResult({
    workspaceId: String(workspaceId),
    degraded,
    attemptedTransactions: input.attemptedTransactions,
    restoredTransactions: Array.isArray(restored.transactions) ? restored.transactions : [],
    attemptedStatementRecords: input.attemptedStatementRecords,
    restoredStatementRecords: Array.isArray(restored.statementImports)
      ? restored.statementImports
      : [],
    restoredAccountCount: Array.isArray(restored.accounts) ? restored.accounts.length : 0,
    attemptedAccounts: input.attemptedAccounts,
    restoredAccounts: Array.isArray(restored.accounts) ? restored.accounts : [],
    attemptedDebts: input.attemptedDebts,
    restoredDebts: Array.isArray(restored.debts) ? restored.debts : [],
    attemptedSubscriptions: input.attemptedSubscriptions,
    restoredSubscriptions: Array.isArray(restored.subs) ? restored.subs : [],
    attemptedPots: input.attemptedPots,
    restoredPots: Array.isArray(restored.pots) ? restored.pots : [],
    attemptedOriginalFileIds: input.attemptedOriginalFileIds,
    restoredOriginalFileIds: (restored.evidenceDocuments ?? [])
      .map((document) => stringId(document.id))
      .filter((id): id is string => id !== null),
  });
}

/**
 * Replace live state with a staged export. Runs the store's cold-boot path
 * (`hydrateFromBlob` → load()/migrate/guards/re-anchor), reads the degraded
 * flag, then reconciles purchase entitlements against the restored lens flags
 * (same ordering as app boot: hydrate first, entitlements after).
 */
export async function applyRestore(
  raw: string,
  workspaceId: WorkspaceId,
): Promise<ApplyRestoreResult> {
  const validation = validateRestoreJson(raw, workspaceId);
  if (!validation.ok) throw new Error('This backup cannot replace the selected Melo workspace.');
  const input = restoreInput(validation.parsed);
  const { degraded } = await restorePersistedWorkspacePayload(raw, workspaceId);
  if (!degraded) await reconcileMissingEvidenceFiles(workspaceId);
  const result = resultFromState(workspaceId, degraded, input);
  await reconcileEntitlements();
  return result;
}

/**
 * Apply a cloud restore without conflating a clean-phone Business recovery with a Personal
 * partition replacement. The persistence adapter stages the Business vault and commits its
 * manifest before switching; an existing workspace keeps the established restore path.
 */
export async function applyBusinessCloudRestore(
  raw: string,
  workspaceId: WorkspaceId,
): Promise<ApplyRestoreResult> {
  const hasBusiness = getState().workspaces.some(
    (workspace) => workspace.kind === 'business' && workspace.id === workspaceId,
  );
  if (!hasBusiness && String(workspaceId) !== String(PERSONAL_WORKSPACE_ID)) {
    const validation = validateRestoreJson(raw, workspaceId);
    if (!validation.ok) throw new Error('This backup cannot replace the selected Melo workspace.');
    const input = restoreInput(validation.parsed);
    await recoverAndActivatePersistedBusinessWorkspace(raw, workspaceId);
    await reconcileEntitlements();
    return resultFromState(workspaceId, false, input);
  }
  return applyRestore(raw, workspaceId);
}
