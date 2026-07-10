// Entitlement record — native persistence ADAPTER. Pure serialize/parse logic lives in
// ./entitlementsLogic (Node-testable, no expo); this file is the thin device layer, exactly like
// ../persist.ts is the device layer over the store's pure `getPersistBlob`/`hydrateFromBlob`.
//
// Self-contained: its own file, its own read/write, no dependency on ../persist.ts or
// ../../store.ts. Not encrypted at rest (unlike the main store blob) — this record carries no
// financial data, only a tier label and an optional expiry, so the ENCRYPTED AT REST bar that
// applies to money data doesn't apply here.

import * as FileSystem from 'expo-file-system/legacy';

import { getState, setLensFullUnlocked } from '../../store';
import {
  isEntitlementActive,
  parseEntitlement,
  serializeEntitlement,
  type EntitlementRecord,
} from './entitlementsLogic';

export type { EntitlementRecord, EntitlementSource, EntitlementTier } from './entitlementsLogic';

const ENTITLEMENT_FILENAME = 'folio.entitlement.v1.json';

function fileUri(): string | null {
  const dir = FileSystem.documentDirectory;
  if (dir === null) return null;
  return `${dir}${ENTITLEMENT_FILENAME}`;
}

/** Read the persisted entitlement, if any. Missing file / read failure / malformed content all
 *  resolve to `null` — never throws, never blocks a caller. */
export async function loadEntitlement(): Promise<EntitlementRecord | null> {
  const uri = fileUri();
  if (uri === null) return null;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return parseEntitlement(raw);
  } catch {
    return null;
  }
}

/** Persist (or clear, with `null`) the entitlement record. Swallows disk failures — a failed
 *  write just means the next launch falls back to no-entitlement, same as first run. */
export async function saveEntitlement(record: EntitlementRecord | null): Promise<void> {
  const uri = fileUri();
  if (uri === null) return;
  try {
    await FileSystem.writeAsStringAsync(uri, serializeEntitlement(record), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    /* disk failure — swallow; entitlement falls back to absent next read. */
  }
}

/** Convenience: load and immediately apply the "still active" check against wall-clock now. */
export async function loadActiveEntitlement(): Promise<EntitlementRecord | null> {
  const record = await loadEntitlement();
  return isEntitlementActive(record, new Date()) ? record : null;
}

/**
 * Boot-time reconciliation between the persisted entitlement record and the lens store's own
 * unlock flags. Call once on app launch, after the store has been hydrated from disk.
 *
 * Two cases this repairs:
 *  1. A real store purchase (`source: 'store'`) that is still active but the lens store's
 *     `plusUnlocked`/`proUnlocked` flag was never set (or was lost — e.g. a restore/migration
 *     edge case) — the flag is re-set from the entitlement record.
 *  2. A store entitlement whose expiry has passed (`isEntitlementActive` false) — this is
 *     deliberately a NO-OP. An offline user must never be punished by having a tier revoked out
 *     from under them just because their expiry lapsed while the device couldn't reach the
 *     store to renew the record; the platform (or a future explicit expiry-refresh flow) owns
 *     revocation, not boot-time reconciliation.
 *
 * Never throws — every step is already defensive (loadActiveEntitlement/loadEntitlement never
 * throw), and this function does nothing observable when there is nothing to reconcile.
 */
export async function reconcileEntitlements(): Promise<void> {
  const active = await loadActiveEntitlement();
  if (active === null || active.source !== 'store') return; // no entitlement, or a preview/trial
  // record — trials are governed entirely by lens.trialCycleId, not this record.

  // `lens` is optional on AppState for shape-migration reasons (see store.ts DEFAULT_LENS);
  // `?? false` mirrors how useLens() reads these same flags. Tier mapping since the Free/Full/
  // Live restructure: 'full' AND the legacy 'plus'/'pro' records all repair the Full unlock
  // (grandfather rule — a paid legacy sub owns Full). 'live' never touches lens flags — it
  // gates AI quantity, not lenses; its consumer is the read-allowance layer.
  const lens = getState().lens;
  const fullUnlocked = (lens?.plusUnlocked ?? false) || (lens?.proUnlocked ?? false);
  if (active.tier !== 'live' && !fullUnlocked) {
    setLensFullUnlocked(true);
  }
}
