// AI statement-read allowance — pure LOGIC, Node-testable (no expo, no react-native).
//
// AI statement reads are the app's only
// per-use marginal cost (each read is a real gateway/model call). The model prices that honestly:
// every tier gets ACCURATE reads (quality is never degraded), tiers differ only in QUANTITY —
// Free gets a small monthly allowance, Plus a bigger one, and Pro unlimited (the tier whose
// subscription exists to cover exactly this cost).
//
// RULES the counters enforce:
//   • The allowance is per CALENDAR MONTH ('YYYY-MM' key) and resets lazily — the first read (or
//     readsLeft call) in a new month sees a fresh counter. No timers, no scheduled job.
//   • Only a read that actually YIELDED candidates counts. A failed/empty read never burns
//     allowance — punishing a user for a network blip or an unreadable page would be dishonest
//     pricing (the tradeoff: rare empty reads cost us a call without counting; acceptable).
//   • A repeat read of a file Folio has read before is served from the on-device cache (see
//     `statementCacheKey` + the store's aiReadCache) — costs nothing, counts nothing.
//   • The one-cycle lens TRIAL does not raise the allowance. The trial trials lenses (software,
//     zero marginal cost); reads cost real money per use, so allowance follows OWNERSHIP only.
//
// This module is deliberately client-side v1: it makes the money model real in the product today.
// Server-side metering (the gateway enforcing per-user quotas) is the hardening step that ships
// with accounts/billing — this file's tier maths carries over unchanged.

/** Read-allowance tier. Mirrors the live paywall: Pro is the unlimited superset. */
export type ReadTier = 'free' | 'plus' | 'pro';

/** Monthly read allowances. One place to change. */
export const READ_ALLOWANCE: Readonly<Record<'free' | 'plus', number>> = {
  free: 3,
  plus: 10,
};

/** The monthly allowance for a tier — `null` means unlimited Pro. */
export function allowanceFor(tier: ReadTier): number | null {
  return tier === 'pro' ? null : READ_ALLOWANCE[tier];
}

/** Persisted counter shape (store's `aiReads` slice). `monthKey` anchors the lazy monthly reset. */
export type AiReadsState = Readonly<{ monthKey: string; used: number }>;

/** Calendar-month key, e.g. '2026-07'. Local time on purpose — the user's own month. */
export function monthKeyOf(now: Date): string {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return `${y}-${m < 10 ? '0' : ''}${m}`;
}

/** Reads used in the CURRENT month. A counter from an earlier month reads as 0 (lazy reset). */
export function readsUsed(state: AiReadsState | undefined, currentMonthKey: string): number {
  if (!state || state.monthKey !== currentMonthKey) return 0;
  return Math.max(0, state.used);
}

/** Reads remaining this month — `null` means unlimited Pro. Never negative. */
export function readsLeft(
  state: AiReadsState | undefined,
  tier: ReadTier,
  currentMonthKey: string,
): number | null {
  const allowance = allowanceFor(tier);
  if (allowance === null) return null;
  return Math.max(0, allowance - readsUsed(state, currentMonthKey));
}

/** Whether a NEW gateway read may start right now. Cached repeats bypass this entirely. */
export function canReadNow(
  state: AiReadsState | undefined,
  tier: ReadTier,
  currentMonthKey: string,
): boolean {
  const left = readsLeft(state, tier, currentMonthKey);
  return left === null || left > 0;
}

// ---------------------------------------------------------------------------
// Read-cache key — same file, same result, zero cost
// ---------------------------------------------------------------------------

/**
 * Cache key for a picked statement file's base64 payload: two independent 32-bit FNV-1a passes
 * (different seeds) plus the length. NOT cryptographic — this is a cache key for the user's OWN
 * files on their OWN device (worst case a collision serves the wrong cached rows into the Review
 * screen, where every row is user-confirmed before it becomes truth). Two seeds + length pushes
 * accidental collision odds far below relevance for a cache that holds a handful of entries.
 * Pure JS so it's Node-testable and adds no native dependency; one pass over a 1MB string is a
 * few milliseconds.
 */
export function statementCacheKey(base64: string): string {
  const h1 = fnv1a32(base64, 0x811c9dc5);
  const h2 = fnv1a32(base64, 0x01000193);
  return `${h1.toString(16)}-${h2.toString(16)}-${base64.length.toString(16)}`;
}

function fnv1a32(input: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply, split to stay in integer range.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

/** How many cached reads the store keeps (oldest evicted first). Small on purpose — entries carry
 *  full candidate lists and live inside the encrypted persist blob, so every extra entry taxes
 *  every save. A handful covers the real pattern (re-picking the same statement to re-review). */
export const READ_CACHE_MAX_ENTRIES = 4;

/** Don't cache monster reads — a cached entry above this many candidate rows would bloat every
 *  subsequent persist write more than the saved gateway call is worth. */
export const READ_CACHE_MAX_CANDIDATES = 1200;

/** Oldest-first eviction, pure: returns the keys to DROP so the map fits `max` entries after
 *  adding one more. `at` is the entry's ISO write time. */
export function readCacheEvictions(
  entries: Readonly<Record<string, { at: string }>>,
  max: number = READ_CACHE_MAX_ENTRIES,
): string[] {
  const keys = Object.keys(entries);
  const excess = keys.length - (max - 1);
  if (excess <= 0) return [];
  return keys.sort((a, b) => (entries[a]!.at < entries[b]!.at ? -1 : 1)).slice(0, excess);
}
