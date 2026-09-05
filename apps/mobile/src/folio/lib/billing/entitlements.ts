// Entitlement record — native persistence ADAPTER. Pure serialize/parse logic lives in
// ./entitlementsLogic (Node-testable, no expo); this file is the thin device layer, exactly like
// ../persist.ts is the device layer over the store's pure `getPersistBlob`/`hydrateFromBlob`.
//
// Self-contained: its own file, its own read/write, no dependency on ../persist.ts. Store grants
// are public-key verified before use; a plain local tier label is never authority. The record has
// no financial details or raw Play token, only signed public claims and token hash.

import * as FileSystem from 'expo-file-system/legacy';

import { getState, setLensFullUnlocked } from '../../store';
import {
  isEntitlementActive,
  parseEntitlements,
  serializeEntitlements,
  type EntitlementRecord,
} from './entitlementsLogic';
import { billingVerificationConfig } from './billingVerification';
import { verifyEntitlementGrant } from './entitlementGrant';

export type { EntitlementRecord, EntitlementSource, EntitlementTier } from './entitlementsLogic';

const ENTITLEMENT_FILENAME = 'folio.entitlement.v1.json';
let verifiedWrite: Promise<unknown> = Promise.resolve();

function fileUri(): string | null {
  const dir = FileSystem.documentDirectory;
  if (dir === null) return null;
  return `${dir}${ENTITLEMENT_FILENAME}`;
}

/** Read the persisted entitlement, if any. Missing file / read failure / malformed content all
 *  resolve to `null` — never throws, never blocks a caller. */
export async function loadEntitlement(): Promise<EntitlementRecord | null> {
  const records = await loadEntitlements();
  return records[0] ?? null;
}

async function loadEntitlements(): Promise<EntitlementRecord[]> {
  const uri = fileUri();
  if (uri === null) return [];
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return parseEntitlements(raw);
  } catch {
    return [];
  }
}

/** Persist (or clear, with `null`) the entitlement record. Swallows disk failures — a failed
 *  write just means the next launch falls back to no-entitlement, same as first run. */
export async function saveEntitlement(record: EntitlementRecord | null): Promise<void> {
  // Store ownership can only enter through saveVerifiedEntitlement. Keep this legacy export for
  // preview migration/clearing without leaving an unsigned unlock path behind.
  if (record?.source === 'store') return;
  const uri = fileUri();
  if (uri === null) return;
  try {
    await FileSystem.writeAsStringAsync(
      uri,
      serializeEntitlements(record === null ? [] : [record]),
      {
        encoding: FileSystem.EncodingType.UTF8,
      },
    );
  } catch {
    /* disk failure — swallow; entitlement falls back to absent next read. */
  }
}

/** Persist one independently-owned signed grant, replacing only the same tier. The grant is
 * verified again here so callers cannot smuggle an unverified server response onto disk. */
export async function saveVerifiedEntitlement(grant: string): Promise<EntitlementRecord | null> {
  const write = verifiedWrite.then(() => persistVerifiedEntitlement(grant));
  verifiedWrite = write.catch(() => undefined);
  return write;
}

async function persistVerifiedEntitlement(grant: string): Promise<EntitlementRecord | null> {
  const config = billingVerificationConfig();
  if (config === null) return null;
  const verified = verifyEntitlementGrant(grant, config, new Date());
  if (verified === null) return null;
  const existing = await loadEntitlements();
  const record: EntitlementRecord = {
    source: 'store',
    tier: verified.tier,
    grant,
    productId: verified.productId,
    ...(verified.expiresAt !== null ? { expiresAt: verified.expiresAt } : {}),
    ...(verified.graceUntil !== null ? { graceUntil: verified.graceUntil } : {}),
    refreshAfter: verified.refreshAfter,
  };
  const records = [
    ...existing.filter((candidate) => candidate.tier !== verified.tier),
    record,
  ].slice(-4);
  const uri = fileUri();
  if (uri === null) return null;
  try {
    await FileSystem.writeAsStringAsync(uri, serializeEntitlements(records), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return record;
  } catch {
    return null;
  }
}

/** Load all currently-authoritative records. Every store record is reconstructed from its signed
 * grant, so modified redundant JSON fields cannot affect the returned entitlement. */
export async function loadActiveEntitlements(): Promise<EntitlementRecord[]> {
  const now = new Date();
  const config = billingVerificationConfig();
  const records = await loadEntitlements();
  const active: EntitlementRecord[] = [];
  for (const record of records) {
    if (record.source === 'preview') {
      if (isEntitlementActive(record, now)) active.push(record);
      continue;
    }
    if (config === null || !record.grant) continue;
    const verified = verifyEntitlementGrant(record.grant, config, now, record.productId);
    if (verified === null) continue;
    active.push({
      source: 'store',
      tier: verified.tier,
      grant: record.grant,
      productId: verified.productId,
      ...(verified.expiresAt !== null ? { expiresAt: verified.expiresAt } : {}),
      ...(verified.graceUntil !== null ? { graceUntil: verified.graceUntil } : {}),
      refreshAfter: verified.refreshAfter,
    });
  }
  return active;
}

/** Convenience lookup. Without a tier, Live is preferred because legacy callers use this to
 * decide the read allowance; Full remains independently available through the lens store. */
export async function loadActiveEntitlement(
  tier?: 'full' | 'live',
): Promise<EntitlementRecord | null> {
  const records = await loadActiveEntitlements();
  if (tier !== undefined) return records.find((record) => record.tier === tier) ?? null;
  return records.find((record) => record.tier === 'live') ?? records[0] ?? null;
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
  const activeRecords = await loadActiveEntitlements();
  const ownsFull = activeRecords.some(
    (record) =>
      record.source === 'store' &&
      (record.tier === 'full' || record.tier === 'plus' || record.tier === 'pro'),
  );
  if (!ownsFull) return;

  // `lens` is optional on AppState for shape-migration reasons (see store.ts DEFAULT_LENS);
  // `?? false` mirrors how useLens() reads these same flags. Tier mapping since the Free/Full/
  // Live restructure: 'full' AND the legacy 'plus'/'pro' records all repair the Full unlock
  // (grandfather rule — a paid legacy sub owns Full). 'live' never touches lens flags — it
  // gates AI quantity, not lenses; its consumer is the read-allowance layer.
  const lens = getState().lens;
  const fullUnlocked = (lens?.plusUnlocked ?? false) || (lens?.proUnlocked ?? false);
  if (!fullUnlocked) {
    setLensFullUnlocked(true);
  }
}
