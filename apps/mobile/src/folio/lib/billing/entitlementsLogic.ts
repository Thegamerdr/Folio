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
// `source: 'preview'` covers the local trial. A `source: 'store'` record is accepted by the native
// adapter only when its `grant` passes Ed25519 verification; the redundant tier/product fields are
// indexing hints, not authority. Plus and Pro are stored independently; Pro is applied as the
// superset by the lens store.

export type EntitlementSource = 'preview' | 'store';

/** Paid lens tier from the live Lovable pricing model. */
export type EntitlementTier = 'plus' | 'pro';

export type EntitlementRecord = {
  source: EntitlementSource;
  tier: EntitlementTier;
  /** The server-issued compact JWS. Required before a store record can grant access. */
  grant?: string;
  /** Store product that the signed grant was issued for. */
  productId?: string;
  /** Provider expiry for the subscription. */
  expiresAt?: string;
  /** Bounded offline window after provider expiry. */
  graceUntil?: string;
};

const CURRENT_VERSION = 3;

type EntitlementBlob = {
  v: number;
  records: EntitlementRecord[];
};

const EMPTY_BLOB: EntitlementBlob = { v: CURRENT_VERSION, records: [] };

/** Serialize a record (or its absence) to the on-disk blob string. Pure. */
export function serializeEntitlement(record: EntitlementRecord | null): string {
  return serializeEntitlements(record === null ? [] : [record]);
}

/** Serialize the independent Plus/Pro records into the current on-disk blob. */
export function serializeEntitlements(records: readonly EntitlementRecord[]): string {
  const blob: EntitlementBlob = { v: CURRENT_VERSION, records: [...records] };
  return JSON.stringify(blob);
}

/** Parse a previously-serialized blob back into a record. A missing file, malformed JSON, or a
 *  record that fails the shape guard all resolve to `null` (no entitlement) rather than throwing
 *  — a corrupt entitlement file must never crash the app or fake a purchase into existing. */
export function parseEntitlement(raw: string | null): EntitlementRecord | null {
  return parseEntitlements(raw)[0] ?? null;
}

/** Parse current records while still reading the former single-record shape.
 * Unsigned store records are returned here but the native verifier rejects them as authority. */
export function parseEntitlements(raw: string | null): EntitlementRecord[] {
  if (raw === null || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    const values = Array.isArray(parsed['records'])
      ? parsed['records']
      : parsed['record'] === null || parsed['record'] === undefined
        ? []
        : [parsed['record']];
    return values
      .map((value) => normalizeRecord(value))
      .filter((record): record is EntitlementRecord => record !== null)
      .slice(0, 4);
  } catch {
    return [];
  }
}

function normalizeRecord(value: unknown): EntitlementRecord | null {
  if (value === null || typeof value !== 'object') return null;
  const r = value as Partial<EntitlementRecord>;
  if (r.source !== 'preview' && r.source !== 'store') return null;
  if (r.tier !== 'plus' && r.tier !== 'pro') return null;
  if (r.grant !== undefined && typeof r.grant !== 'string') return null;
  if (r.productId !== undefined && typeof r.productId !== 'string') return null;
  if (r.expiresAt !== undefined && typeof r.expiresAt !== 'string') return null;
  if (r.graceUntil !== undefined && typeof r.graceUntil !== 'string') return null;
  return {
    source: r.source,
    tier: r.tier,
    ...(r.grant !== undefined ? { grant: r.grant } : {}),
    ...(r.productId !== undefined ? { productId: r.productId } : {}),
    ...(r.expiresAt !== undefined ? { expiresAt: r.expiresAt } : {}),
    ...(r.graceUntil !== undefined ? { graceUntil: r.graceUntil } : {}),
  };
}

/** True when a record exists and (if it carries an expiry) that expiry hasn't passed yet. A
 *  record with no `expiresAt` (preview/trial, or a store record before expiry is known) is
 *  treated as currently active — expiry-less means "governed elsewhere" (lens.trialCycleId),
 *  never means "forever" by omission. */
export function isEntitlementActive(record: EntitlementRecord | null, now: Date): boolean {
  if (record === null) return false;
  if (record.source === 'store' && (!record.grant || !record.productId)) return false;
  if (record.expiresAt === undefined) return true;
  const boundary = new Date(record.graceUntil ?? record.expiresAt);
  if (Number.isNaN(boundary.getTime())) return record.source === 'preview';
  return boundary.getTime() > now.getTime();
}

export const ENTITLEMENT_EMPTY_BLOB_STRING = serializeEntitlements(EMPTY_BLOB.records);
