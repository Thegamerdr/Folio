// Entitlement record — pure LOGIC, Node-testable (no expo, no react-native). The device adapter
// (expo-file-system read/write) lives in ./entitlements and is a thin wrapper over this file,
// mirroring the pure/native split ../vaultKeyLogic.ts uses over ../vaultKey.
//
// This is intentionally a SEPARATE persisted record from the app's own encrypted store blob
// (../persist.ts / ../../store.ts) — the task brief calls for "a small self-contained persisted
// module (own persist file per persist.ts pattern)", not a new field bolted onto the shared
// store. The store's real `lens.plusUnlocked` / `lens.proUnlocked` / `lens.trialCycleId` remain
// the single source of truth PaywallScreen reads (via useLens()) for what's actually unlocked;
// this record exists so the billing layer has somewhere honest to note WHERE an entitlement came
// from (a real store purchase vs. today's preview/trial fallback) without inventing a second
// competing "is this unlocked" flag.
//
// `source: 'preview'` covers everything the app already does today — the existing local
// trial/preview flags (lens.trialCycleId, setLensPlusUnlocked/setLensProUnlocked called from the
// preview-fallback CTA) keep working exactly as before. `source: 'store'` is written only after a
// real expo-iap purchase resolves, once a Play listing exists.

export type EntitlementSource = 'preview' | 'store';

/** Tier vocabulary since the 2026-07-10 Free/Full/Live restructure (MONEY_MODEL.md §2b):
 *  'full' = the one-time purchase, 'live' = the metered AI/sync subscription. 'plus'/'pro' are
 *  LEGACY record values still parsed from disk — the reconciler maps them to Full (grandfather
 *  rule); new records never write them. */
export type EntitlementTier = 'full' | 'live' | 'plus' | 'pro';

export type EntitlementRecord = {
  source: EntitlementSource;
  tier: EntitlementTier;
  /** ISO date-time. Present for a time-boxed store subscription once expo-iap surfaces an expiry;
   *  absent for preview/trial entitlements (those are governed by lens.trialCycleId instead). */
  expiresAt?: string;
};

const CURRENT_VERSION = 1;

type EntitlementBlob = {
  v: number;
  record: EntitlementRecord | null;
};

const EMPTY_BLOB: EntitlementBlob = { v: CURRENT_VERSION, record: null };

/** Serialize a record (or its absence) to the on-disk blob string. Pure. */
export function serializeEntitlement(record: EntitlementRecord | null): string {
  const blob: EntitlementBlob = { v: CURRENT_VERSION, record };
  return JSON.stringify(blob);
}

/** Parse a previously-serialized blob back into a record. A missing file, malformed JSON, or a
 *  record that fails the shape guard all resolve to `null` (no entitlement) rather than throwing
 *  — a corrupt entitlement file must never crash the app or fake a purchase into existing. */
export function parseEntitlement(raw: string | null): EntitlementRecord | null {
  if (raw === null || raw.length === 0) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EntitlementBlob>;
    if (parsed === null || typeof parsed !== 'object') return null;
    return normalizeRecord(parsed.record ?? null);
  } catch {
    return null;
  }
}

function normalizeRecord(value: unknown): EntitlementRecord | null {
  if (value === null || typeof value !== 'object') return null;
  const r = value as Partial<EntitlementRecord>;
  if (r.source !== 'preview' && r.source !== 'store') return null;
  if (r.tier !== 'full' && r.tier !== 'live' && r.tier !== 'plus' && r.tier !== 'pro') return null;
  if (r.expiresAt !== undefined && typeof r.expiresAt !== 'string') return null;
  return r.expiresAt !== undefined
    ? { source: r.source, tier: r.tier, expiresAt: r.expiresAt }
    : { source: r.source, tier: r.tier };
}

/** True when a record exists and (if it carries an expiry) that expiry hasn't passed yet. A
 *  record with no `expiresAt` (preview/trial, or a store record before expiry is known) is
 *  treated as currently active — expiry-less means "governed elsewhere" (lens.trialCycleId),
 *  never means "forever" by omission. */
export function isEntitlementActive(record: EntitlementRecord | null, now: Date): boolean {
  if (record === null) return false;
  if (record.expiresAt === undefined) return true;
  const expiry = new Date(record.expiresAt);
  if (Number.isNaN(expiry.getTime())) return true; // unparsable expiry — fail open, don't punish the user for a bad write.
  return expiry.getTime() > now.getTime();
}

export const ENTITLEMENT_EMPTY_BLOB_STRING = serializeEntitlement(EMPTY_BLOB.record);
