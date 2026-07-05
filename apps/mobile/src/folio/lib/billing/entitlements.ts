// Entitlement record — native persistence ADAPTER. Pure serialize/parse logic lives in
// ./entitlementsLogic (Node-testable, no expo); this file is the thin device layer, exactly like
// ../persist.ts is the device layer over the store's pure `getPersistBlob`/`hydrateFromBlob`.
//
// Self-contained: its own file, its own read/write, no dependency on ../persist.ts or
// ../../store.ts. Not encrypted at rest (unlike the main store blob) — this record carries no
// financial data, only a tier label and an optional expiry, so the ENCRYPTED AT REST bar that
// applies to money data doesn't apply here.

import * as FileSystem from 'expo-file-system/legacy';

import {
  isEntitlementActive,
  parseEntitlement,
  serializeEntitlement,
  type EntitlementRecord,
} from './entitlementsLogic';

export type { EntitlementRecord, EntitlementSource } from './entitlementsLogic';

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
