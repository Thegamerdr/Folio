// PURE de-duplication for chunked statement reads. No expo/react-native imports — unit-testable in
// plain Node.
//
// WHY THIS EXISTS. Chunked reading (see pdfChunkSplitter.ts + extractStatementCandidatesChunked in
// statementReaderClient.ts) sends OVERLAPPING page context to the model per chunk (each chunk is a
// clean page range with no overlap by construction — see PAGES_PER_CHUNK), but a transaction that
// SPANS a page break can appear twice across adjacent chunks. Only the parser's deterministic row
// identity is safe deletion authority: two real rows can legitimately share date, amount and
// merchant. Ambiguous natural-key matches therefore remain visible for review instead of being
// silently discarded.

import type { CandidateMoneyItem } from '@/folio/lib/importSheet';

/** Build the natural similarity key for one candidate: date (or 'no-date') + amount + a normalised
 *  merchant string (lowercased, whitespace-collapsed) so trivial formatting differences between two
 *  chunks' reads of the same row ("Tesco  " vs "Tesco") still collide.
 *
 *  Exported so landed transaction IDs can include consistent normalized facts alongside the
 *  authoritative source-row ID. This key may support Review hints, but must never delete a row. */
export function dedupeKey(candidate: CandidateMoneyItem): string {
  const date = candidate.date ?? 'no-date';
  const merchant = candidate.merchant.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${date}|${candidate.amount}|${merchant}`;
}

/**
 * Merge candidates from multiple chunks (in chunk order). The FIRST occurrence of an exact
 * deterministic candidate ID wins; distinct IDs survive even when their natural facts match. Order
 * remains a stable concatenation of each chunk's surviving candidates.
 *
 * Pure — no I/O and no randomness.
 */
export function mergeChunkCandidates(
  chunks: readonly (readonly CandidateMoneyItem[])[],
): CandidateMoneyItem[] {
  const seen = new Set<string>();
  const merged: CandidateMoneyItem[] = [];
  for (const chunk of chunks) {
    for (const candidate of chunk) {
      if (seen.has(candidate.id)) continue;
      seen.add(candidate.id);
      merged.push(candidate);
    }
  }
  return merged;
}
