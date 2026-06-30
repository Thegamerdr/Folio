// IMPORT DE-DUPE engine — `proposeMatches`. Pure, deterministic, no I/O, no
// react-native imports, no UI. A plain TS module collected by the
// apps/**\/*.test.ts vitest runner via its colocated dedupe.test.ts.
//
// PURPOSE (OPEN_BANKING_DEDUPE_RESEARCH.md §3, §7; ENGINES.md §8): when a user's
// MANUAL money item later shows up via bank import / OCR / PDF / CSV / Open
// Banking, Folio must never silently double-count it and never silently destroy
// the user's own record. This engine only ever PROPOSES; it mutates nothing.
// "Accept is the only thing that mutates" — that lives in the accept path, not
// here. The default no-op is "keep both".
//
// The honesty rule is structural: the output union (`MatchKind`) carries no
// "merge"/"remove"/"delete" verb, so an automatic-destruction claim is
// unrepresentable. Every entry is a reversible proposal (Actual Budget's
// un-match safeguard, research §2/§6).
//
// HARD RULES (per the build task + sibling engines subSignals.ts / importSheet.ts):
//   • Pure & deterministic. NO Date.now(), NO Math.random(); any "now" is an input.
//   • exactOptionalPropertyTypes + noUncheckedIndexedAccess ON: optional fields
//     are omitted (conditional spread), never set to `undefined`; every index /
//     array access is guarded.
//   • No `any`. Types are intentionally local; no app-type imports.
//   • Money: compare MINOR units (pence) only, never float-compare. Inputs are
//     GBP pounds (spend negative, credit/return positive — the store
//     convention), converted with Math.round(Math.abs(amount) * 100).
//
// Match order (research §3 "provider id first, fuzzy second"):
//   1. link-by-provider — import↔import exact link via pending id(s). Never a
//      second row; a list (Tink PENDING_IDS) may map one pending → many bookings.
//   2. propose-link / propose-amount-changed — fuzzy manual↔import: amount-exact
//      (or hold-drift) + within the date window + payee similarity.
//   3. propose-transfer — equal-and-opposite across the user's own accounts.
//   4. propose-refund — opposite sign, same merchant, incoming dated later.
//   5. expire-pending — a pending import older than the auth-hold window with no
//      posting, relative to `now` — allowed to disappear, not stranded.
// A given existing item links to AT MOST one incoming item (the one-match guard).

// ---------------------------------------------------------------------------
// Public input / output contracts (local types only).
// ---------------------------------------------------------------------------

export type MatchableItem = {
  id: string;
  /** GBP. Spend negative, income/return positive. */
  amount: number;
  /** ISO YYYY-MM-DD. Manual items may be dated wrong; imports carry the posted date. */
  date: string;
  merchant: string;
  /** Provider linkage (import↔import only). A booked import may carry the id of the pending it settles. */
  pendingTransactionId?: string; // single pending it books (Plaid pending_transaction_id)
  pendingIds?: string[]; // several pendings it books (Tink PENDING_IDS; split/merge)
  /** This item's own provider id (so a posted import can reference an existing pending's id). */
  providerId?: string;
  /** 'manual' (user typed it, no provider id) vs 'import' (csv/ocr/pdf/open-banking). */
  origin?: 'manual' | 'import';
  /**
   * The pre-edit imported amount (GBP). When present, de-dupe matches against
   * THIS, not the user-edited surface — research note "compare against that
   * payload, not the user-edited surface" (D4). Lets a user's later edit (e.g.
   * −12 → −14) still link to the incoming −12 import.
   */
  originalAmount?: number;
};

export type MatchKind =
  | 'propose-link' // fuzzy manual↔import: amount-exact, within window, payee match
  | 'propose-amount-changed' // hold-drift (fuel/restaurant/hotel): posted >= pending, payee high, amount differs
  | 'propose-transfer' // equal-and-opposite across the user's own accounts
  | 'propose-refund' // opposite sign, same merchant, later date
  | 'link-by-provider' // import↔import: pendingTransactionId / pendingIds present -> exact link, replace in place
  | 'expire-pending'; // a pending that never posted within the auth-hold window -> allowed to disappear

export type MatchConfidence = 'high' | 'medium' | 'low';

export type MatchProposal = {
  existingId: string;
  incomingId: string;
  kind: MatchKind;
  confidence: MatchConfidence;
  /** Short machine reason code, e.g. 'provider-id' | 'amount-date-payee' | 'hold-drift' | 'transfer' | 'refund' | 'auth-hold-expired'. */
  reasonCode: string;
};

export type ProposeOptions = {
  /** ISO YYYY-MM-DD "now" — enables the expire-pending check. Omit to skip it. */
  now?: string;
};

// ---------------------------------------------------------------------------
// Tuning constants — grounded in research §3/§4.
// ---------------------------------------------------------------------------

const MINOR = 100;
const DAY_MS = 86_400_000;

/**
 * Fuzzy date window: a manual item may be dated up to this many days EITHER side
 * of the imported posted date. Actual uses 5 (lookback), YNAB uses 10; the
 * research recommends ±5d default ("within 5d"). Outside this → no proposal.
 */
const DATE_WINDOW_DAYS = 5;

/**
 * Auth-hold expiry: a pending with no posting older than this many days (Plaid's
 * ~14-day rare-case ceiling) relative to `now` is allowed to disappear.
 */
const AUTH_HOLD_DAYS = 14;

/**
 * Payee similarity threshold (token-overlap, 0..1). High amount+date match but
 * payee below this → no proposal (Actual: "multiple transactions of the same
 * amount all with different payees"). 0.5 accepts "Tesco" vs "TESCO STORES 2913"
 * (shared token "tesco") and "Shell" vs "SHELL FUEL", and rejects "Spotify" vs
 * "Netflix" (no shared token).
 */
const PAYEE_MATCH_THRESHOLD = 0.5;

/**
 * Hold-drift needs a HIGH payee match (the amount already disagrees, so the
 * payee must carry the link), above the plain-link threshold.
 */
const PAYEE_HIGH_THRESHOLD = 0.5;

/**
 * Transfer dates must be within this many days of each other (≈ same date) — an
 * internal transfer posts on or about the same day on both sides.
 */
const TRANSFER_WINDOW_DAYS = 3;

/**
 * "Filler" tokens stripped before payee comparison — generic descriptors and the
 * import suffixes that drift pending→posted (TrueLayer name drift, §4). Keeping
 * the brand token is what carries the match.
 */
const PAYEE_STOPWORDS = new Set<string>([
  'the',
  'ltd',
  'limited',
  'plc',
  'inc',
  'co',
  'uk',
  'gb',
  'stores',
  'store',
  'fuel',
  'refund',
  'payment',
  'card',
  'purchase',
  'transfer',
  'transaction',
  'pos',
  'visa',
  'mastercard',
  'contactless',
]);

// ---------------------------------------------------------------------------
// Small pure helpers.
// ---------------------------------------------------------------------------

function toMs(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime();
}

function calendarDaysBetween(aIso: string, bIso: string): number {
  return Math.round((toMs(bIso) - toMs(aIso)) / DAY_MS);
}

/** Absolute magnitude of a GBP amount in minor units (pence). Never float-compare. */
function magnitudeMinor(item: MatchableItem): number {
  const gbp = item.originalAmount ?? item.amount;
  return Math.round(Math.abs(gbp) * MINOR);
}

/** Sign of the user-visible amount (−1 spend, +1 income, 0 zero). */
function signOf(item: MatchableItem): number {
  if (item.amount < 0) return -1;
  if (item.amount > 0) return 1;
  return 0;
}

/**
 * Normalise a merchant string into comparable tokens: lowercase, strip
 * punctuation and store numbers (digit-only chunks), drop generic stopwords.
 * Hard normalisation per research §4 ("normalise hard before similarity").
 */
function payeeTokens(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((tok) => tok.length > 0)
    .filter((tok) => !/^[0-9]+$/.test(tok)) // drop store numbers ("2913")
    .filter((tok) => !PAYEE_STOPWORDS.has(tok));
}

/**
 * Payee similarity in [0,1] — token overlap (Jaccard-style: shared tokens over
 * the smaller token set, so a long import descriptor that contains the manual
 * brand still scores 1). Both empty → 0 (cannot vouch for a match).
 */
function payeeSimilarity(a: string, b: string): number {
  const ta = payeeTokens(a);
  const tb = payeeTokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setB = new Set(tb);
  let shared = 0;
  const seen = new Set<string>();
  for (const tok of ta) {
    if (seen.has(tok)) continue;
    seen.add(tok);
    if (setB.has(tok)) shared += 1;
  }
  const smaller = Math.min(new Set(ta).size, setB.size);
  return smaller === 0 ? 0 : shared / smaller;
}

/** Build a proposal object (kept tiny so callers read as a rule table). */
function proposal(
  existingId: string,
  incomingId: string,
  kind: MatchKind,
  confidence: MatchConfidence,
  reasonCode: string,
): MatchProposal {
  return { existingId, incomingId, kind, confidence, reasonCode };
}

// ---------------------------------------------------------------------------
// proposeMatches — the engine.
// ---------------------------------------------------------------------------

/**
 * Propose (never auto-apply) links between EXISTING items and INCOMING items.
 * Pure: neither input array nor its elements are mutated; same input → same
 * output. The result is a flat list of proposals the surface renders.
 *
 * @param existing items already in the ledger (manual rows, accepted imports, pendings)
 * @param incoming newly imported items to reconcile against `existing`
 * @param options  `now` (ISO) enables the expire-pending auth-hold check
 */
export function proposeMatches(
  existing: readonly MatchableItem[],
  incoming: readonly MatchableItem[],
  options: ProposeOptions = {},
): MatchProposal[] {
  const proposals: MatchProposal[] = [];
  // One-match guard: an existing item links to at most one incoming item.
  const matchedExisting = new Set<string>();

  // --- 1. Provider id first (import↔import exact link) ---------------------
  // An incoming booked import may reference one pending (pendingTransactionId)
  // or several (pendingIds, a LIST — split/merge; never assume 1:1). Each
  // referenced pending whose providerId/id matches emits one link-by-provider.
  // The pending is linked in place and is NOT consumed by the one-match guard,
  // so two bookings of the same pending (F5) both link it without duplicating
  // it as a row.
  for (const inc of incoming) {
    const referenced = collectReferencedPendingIds(inc);
    if (referenced.size === 0) continue;
    for (const ex of existing) {
      const exProviderId = ex.providerId ?? ex.id;
      if (referenced.has(exProviderId) || referenced.has(ex.id)) {
        proposals.push(proposal(ex.id, inc.id, 'link-by-provider', 'high', 'provider-id'));
      }
    }
  }

  // --- 2. Fuzzy manual↔import (proposal only, never auto-merge) ------------
  // Walk incoming imports; for each, find the best existing candidate by
  // amount(minor)+date-window+payee. Hold-drift (posted ≥ pending, payee high)
  // yields propose-amount-changed; exact amount yields propose-link.
  for (const inc of incoming) {
    if (inc.origin === 'import' && hasProviderLink(inc)) continue; // handled in pass 1

    const incMinor = magnitudeMinor(inc);
    const incSign = signOf(inc);

    let bestExisting: MatchableItem | null = null;
    let bestKind: 'propose-link' | 'propose-amount-changed' | null = null;
    let bestConfidence: MatchConfidence = 'low';
    let bestPayee = -1;

    for (const ex of existing) {
      if (matchedExisting.has(ex.id)) continue; // one-match guard
      if (ex.id === inc.id) continue;
      if (signOf(ex) !== incSign || incSign === 0) continue; // same direction only (transfers/refunds handled later)

      const dayGap = Math.abs(calendarDaysBetween(ex.date, inc.date));
      if (dayGap > DATE_WINDOW_DAYS) continue; // outside the window → no proposal (F8)

      const sim = payeeSimilarity(ex.merchant, inc.merchant);
      const exMinor = magnitudeMinor(ex);

      if (exMinor === incMinor) {
        // Amount-exact: propose-link when payee clears the threshold.
        if (sim >= PAYEE_MATCH_THRESHOLD && sim > bestPayee) {
          bestExisting = ex;
          bestKind = 'propose-link';
          bestConfidence = dayGap <= 1 && sim >= 0.99 ? 'high' : 'medium';
          bestPayee = sim;
        }
      } else if (incMinor >= exMinor && sim >= PAYEE_HIGH_THRESHOLD) {
        // Hold-drift: posted magnitude ≥ pending, payee high, amount differs.
        // Only take it if nothing amount-exact already beat it on this incoming.
        if (bestKind !== 'propose-link' && sim > bestPayee) {
          bestExisting = ex;
          bestKind = 'propose-amount-changed';
          bestConfidence = 'medium';
          bestPayee = sim;
        }
      }
    }

    if (bestExisting !== null && bestKind !== null) {
      const reason = bestKind === 'propose-link' ? 'amount-date-payee' : 'hold-drift';
      proposals.push(proposal(bestExisting.id, inc.id, bestKind, bestConfidence, reason));
      matchedExisting.add(bestExisting.id);
    }
  }

  // --- 3. Transfers (equal-and-opposite across the user's own accounts) ----
  for (const inc of incoming) {
    if (hasProviderLink(inc)) continue;
    const incMinor = magnitudeMinor(inc);
    const incSign = signOf(inc);
    if (incSign === 0) continue;

    for (const ex of existing) {
      if (matchedExisting.has(ex.id)) continue;
      if (ex.id === inc.id) continue;
      if (signOf(ex) !== -incSign) continue; // opposite sign
      if (magnitudeMinor(ex) !== incMinor) continue; // equal magnitude
      const dayGap = Math.abs(calendarDaysBetween(ex.date, inc.date));
      if (dayGap > TRANSFER_WINDOW_DAYS) continue; // ≈ same date
      proposals.push(proposal(ex.id, inc.id, 'propose-transfer', 'medium', 'transfer'));
      matchedExisting.add(ex.id);
      break;
    }
  }

  // --- 4. Refunds (opposite sign, same merchant, incoming dated later) -----
  for (const inc of incoming) {
    if (hasProviderLink(inc)) continue;
    const incMinor = magnitudeMinor(inc);
    const incSign = signOf(inc);
    if (incSign === 0) continue;

    for (const ex of existing) {
      if (matchedExisting.has(ex.id)) continue;
      if (ex.id === inc.id) continue;
      if (signOf(ex) !== -incSign) continue; // opposite sign
      if (magnitudeMinor(ex) !== incMinor) continue; // equal magnitude
      const later = calendarDaysBetween(ex.date, inc.date); // >0 → incoming is later
      if (later <= 0) continue;
      if (payeeSimilarity(ex.merchant, inc.merchant) < PAYEE_MATCH_THRESHOLD) continue; // SAME merchant
      proposals.push(proposal(ex.id, inc.id, 'propose-refund', 'medium', 'refund'));
      matchedExisting.add(ex.id);
      break;
    }
  }

  // --- 5. Expire pending (auth hold that never posted) ---------------------
  // A pending import (origin import, carries a providerId) that no incoming
  // booking referenced, older than the auth-hold window relative to `now`, is
  // allowed to disappear rather than be stranded. existingId = the pending;
  // incomingId = the same id (no posting exists). Requires `now`.
  const now = options.now;
  if (now !== undefined) {
    const linkedPendingIds = collectAllReferencedPendingIds(incoming);
    for (const ex of existing) {
      if (ex.origin !== 'import') continue;
      if (ex.providerId === undefined) continue;
      if (matchedExisting.has(ex.id)) continue;
      if (linkedPendingIds.has(ex.providerId) || linkedPendingIds.has(ex.id)) continue; // it posted
      const age = calendarDaysBetween(ex.date, now);
      if (age <= AUTH_HOLD_DAYS) continue; // still inside the hold window
      proposals.push(proposal(ex.id, ex.id, 'expire-pending', 'high', 'auth-hold-expired'));
      matchedExisting.add(ex.id);
    }
  }

  return proposals;
}

// ---------------------------------------------------------------------------
// Provider-link helpers.
// ---------------------------------------------------------------------------

/** Does this incoming item reference any pending via provider linkage? */
function hasProviderLink(item: MatchableItem): boolean {
  if (item.pendingTransactionId !== undefined) return true;
  return item.pendingIds !== undefined && item.pendingIds.length > 0;
}

/** The set of pending ids a single incoming item books (single + list, deduped). */
function collectReferencedPendingIds(item: MatchableItem): Set<string> {
  const ids = new Set<string>();
  if (item.pendingTransactionId !== undefined) ids.add(item.pendingTransactionId);
  if (item.pendingIds !== undefined) {
    for (const id of item.pendingIds) ids.add(id);
  }
  return ids;
}

/** The union of all pending ids referenced across an incoming batch. */
function collectAllReferencedPendingIds(incoming: readonly MatchableItem[]): Set<string> {
  const all = new Set<string>();
  for (const inc of incoming) {
    for (const id of collectReferencedPendingIds(inc)) all.add(id);
  }
  return all;
}
