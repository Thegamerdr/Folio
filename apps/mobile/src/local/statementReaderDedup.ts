// PURE de-duplication for chunked statement reads. No expo/react-native imports — unit-testable in
// plain Node.
//
// WHY THIS EXISTS. Chunked reading (see pdfChunkSplitter.ts + extractStatementCandidatesChunked in
// statementReaderClient.ts) sends OVERLAPPING page context to the model per chunk (each chunk is a
// clean page range with no overlap by construction — see PAGES_PER_CHUNK), but a transaction that
// SPANS a page break (rare, but the model may re-read a boundary row from the previous/next page's
// context, or a statement generator may repeat a summary row at a page top/bottom) can appear twice
// across adjacent chunks. Silently keeping both would double-count real money. We de-dupe on the
// natural key of a bank-statement row: same date + amount + merchant appearing in more than one
// chunk is almost certainly the same movement, not two — a real user rarely has two identical
// transactions (same merchant, same exact amount, same day) back-to-back on a statement, and even
// when they do, review-before-truth means the user still sees at least one candidate and can add
// the second by hand; silently OVER-counting would be the worse failure.

import type { CandidateMoneyItem } from '@/folio/lib/importSheet';

/** Build the natural de-dupe key for one candidate: date (or 'no-date') + amount + a normalised
 *  merchant string (lowercased, whitespace-collapsed) so trivial formatting differences between two
 *  chunks' reads of the same row ("Tesco  " vs "Tesco") still collide.
 *
 *  Exported so other de-dupe boundaries (store.ts's `addStatementAsHistory`, landing an import
 *  against the EXISTING persisted ledger rather than against sibling chunks of the same read) can
 *  reuse the exact same normalisation instead of re-implementing a second, subtly different key.
 *  Same known ambiguity applies at every call site: two genuinely identical real-world rows (same
 *  merchant/amount/day) collide onto the same key and only one survives whichever de-dupe pass reads
 *  them first — see each caller's own doc for how it lives with that. */
export function dedupeKey(candidate: CandidateMoneyItem): string {
  const date = candidate.date ?? 'no-date';
  const merchant = candidate.merchant.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${date}|${candidate.amount}|${merchant}`;
}

/**
 * Merge candidates from multiple chunks (in chunk order) into one de-duplicated list. The FIRST
 * occurrence of a natural key wins (earliest chunk keeps the row); later duplicates are dropped.
 * Order is preserved: output is a stable concatenation of each chunk's surviving candidates, in the
 * order the chunks were supplied.
 *
 * Pure — no I/O, no randomness (candidate ids come from the parser and are already deterministic
 * per chunk index, so no id collisions from the merge itself).
 */
export function mergeChunkCandidates(
  chunks: readonly (readonly CandidateMoneyItem[])[],
): CandidateMoneyItem[] {
  const seen = new Set<string>();
  const merged: CandidateMoneyItem[] = [];
  for (const chunk of chunks) {
    for (const candidate of chunk) {
      const key = dedupeKey(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(candidate);
    }
  }
  return merged;
}
