// Restore engine — the pure half of "Restore from a Folio export" (plan 113).
//
// The export engine (./export.ts) writes the complete `AppState` as one JSON
// file; this module decides whether a user-picked file IS such an export and
// summarizes what it holds, so the confirm sheet can tell the user what they
// are about to load BEFORE anything is replaced. It never touches the store,
// the filesystem, or react-native — the thin wrapper (./restoreNative.ts) owns
// the side effects, mirroring the export.ts / exportNative.ts split.
//
// HARD CONSTRAINTS:
//   • Pure + deterministic. Same string in → same result out.
//   • Validation here is an ENVELOPE check only ("is this a Folio export?").
//     Field-level safety is deliberately NOT duplicated: the store's own
//     load()/migrate path (via `hydrateFromBlob`) already guards every list
//     field, defaults what's missing, and flags degraded loads — one owner of
//     that logic, not two.

import type { WorkspaceId } from '@folio/domain';

import { PERSONAL_WORKSPACE_ID } from './workspaceRoot';

/** Why a picked file was rejected, for honest user-facing copy. */
export type RestoreRejection =
  | 'not-json'
  | 'not-an-object'
  | 'not-a-folio-export'
  | 'wrong-workspace';

export type RestoreValidation =
  | { ok: true; parsed: Record<string, unknown> }
  | { ok: false; reason: RestoreRejection };

/**
 * Top-level `AppState` keys that mark a file as a Folio export. Requiring at
 * least two guards against loading arbitrary JSON that happens to be an object
 * (a lone `{"subs": ...}` from some other app shouldn't wipe real data), while
 * staying tolerant of exports from older/newer app versions that may lack any
 * single specific field.
 */
const SIGNATURE_KEYS = [
  'currentBalance',
  'onboarding',
  'subs',
  'transactions',
  'pots',
  'cycles',
] as const;

const MIN_SIGNATURE_MATCHES = 2;

/** Envelope check: is this string a Folio export we can hand to the store? */
export function validateRestoreJson(
  raw: string,
  expectedWorkspaceId?: WorkspaceId,
): RestoreValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'not-an-object' };
  }
  const record = parsed as Record<string, unknown>;
  const matches = SIGNATURE_KEYS.filter((k) => k in record).length;
  if (matches < MIN_SIGNATURE_MATCHES) {
    return { ok: false, reason: 'not-a-folio-export' };
  }
  if (
    expectedWorkspaceId !== undefined &&
    !isRestoreOwnedByWorkspace(record, expectedWorkspaceId)
  ) {
    return { ok: false, reason: 'wrong-workspace' };
  }
  return { ok: true, parsed: record };
}

function isRestoreOwnedByWorkspace(
  record: Record<string, unknown>,
  expectedWorkspaceId: WorkspaceId,
): boolean {
  const hasWorkspaceRoot =
    'workspaces' in record || 'activeWorkspaceId' in record || 'dataWorkspaceId' in record;
  if (!hasWorkspaceRoot) {
    // Pre-v9 exports had no root and can only be the historic Personal partition.
    return String(expectedWorkspaceId) === String(PERSONAL_WORKSPACE_ID);
  }
  if (
    String(record.activeWorkspaceId ?? '') !== String(expectedWorkspaceId) ||
    String(record.dataWorkspaceId ?? '') !== String(expectedWorkspaceId) ||
    !Array.isArray(record.workspaces)
  ) {
    return false;
  }
  return record.workspaces.some(
    (workspace) =>
      workspace !== null &&
      typeof workspace === 'object' &&
      !Array.isArray(workspace) &&
      String((workspace as Record<string, unknown>).id ?? '') === String(expectedWorkspaceId),
  );
}

/** What the confirm sheet shows the user before anything is replaced. */
export type RestoreSummary = Readonly<{
  transactions: number;
  subs: number;
  pots: number;
  /** The name captured at onboarding, when the file has one — a human check
   *  that this is the right person's export. */
  name: string | null;
}>;

function listLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/** Summarize a validated export for the confirm copy. Tolerant of missing or
 *  malformed fields (they read as 0 / null — load() will default them too). */
export function summarizeRestore(parsed: Record<string, unknown>): RestoreSummary {
  const onboarding = parsed.onboarding;
  const name =
    onboarding !== null &&
    typeof onboarding === 'object' &&
    typeof (onboarding as Record<string, unknown>).name === 'string' &&
    ((onboarding as Record<string, unknown>).name as string).length > 0
      ? ((onboarding as Record<string, unknown>).name as string)
      : null;
  return {
    transactions: listLength(parsed.transactions),
    subs: listLength(parsed.subs),
    pots: listLength(parsed.pots),
    name,
  };
}
