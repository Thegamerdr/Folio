// Bulk landing engine — the pure decision/format layer behind the "add all as history" flow
// (task: BULK ADD-AS-HISTORY). Kept Node-testable (no react-native, no store mutation) so the
// routing decision and the summary/offer copy can be pinned without mounting a screen — matching
// the split discipline every other lib/*.ts engine in this codebase follows.
//
// WHY THIS EXISTS. Three success screens (Pdf/Image/Paste) each need the SAME two decisions:
//   1. Is this read a STATEMENT (many candidates) or a single item? A statement gets the bulk
//      summary + "Add all as history" landing; a lone item keeps going straight to the existing
//      per-row Review screen (unchanged — see each screen's own routing).
//   2. After a bulk land, in what order do the post-import offers (closing balance, then income)
//      get presented, and what does each offer's confirm line say? Both are OFFERED, never
//      auto-applied (review-before-truth extends past the add itself) — see store.ts's
//      `addStatementAsHistory` doc for the full contract this consumes.
//
// This module owns ONLY the decision + copy — the actual store writes
// (`addStatementAsHistory`, `setCurrentBalance`) stay in the screen, which is what the owner's
// "nothing auto-applies silently" review-before-truth expectation keeps visible in the render
// layer, not buried in a pure helper.

import type { AddStatementAsHistoryResult } from '../store';

// A statement is "multiple candidates" — the plain threshold the owner's spec draws between "a
// statement" (bulk landing) and "a single item" (straight to per-row Review). Exactly 1 candidate
// is deliberately NOT bulk: a lone item has no meaningful summary line, and the existing per-row
// Review flow already handles it well (unchanged).
export function isBulkStatement(candidateCount: number): boolean {
  return candidateCount > 1;
}

// ---------------------------------------------------------------------------
// Bulk summary line — 'Found {N} transactions · {from}–{to} · £{in} in / £{out} out'
// ---------------------------------------------------------------------------

/** £ (from pence) -> whole-pound label, no decimals, thousands grouped — matches the success
 *  screens' existing `formatMagnitude`/`formatSignedAmount` whole-pound convention. Pence-level
 *  precision isn't needed for a summary headline; the per-row list below it still shows exact
 *  amounts (unaffected by this module). */
function poundsFromPence(pence: number): string {
  const pounds = Math.round(pence / 100);
  return pounds.toLocaleString('en-GB');
}

/** "2026-06-26" -> "26 Jun" — the short date form the summary line's range uses. Pure, no locale,
 *  mirrors caughtIncome.ts / caughtBills.ts's own `shortDateLabel` helpers so date formatting stays
 *  consistent across the codebase rather than re-inventing a third convention. */
function shortDateLabel(iso: string): string {
  const MONTHS_SHORT = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ] as const;
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(ms)) return iso;
  const d = new Date(ms);
  const day = d.getUTCDate();
  const month = MONTHS_SHORT[d.getUTCMonth()] ?? '';
  return `${day} ${month}`.trim();
}

/** Build the bulk-landing headline: 'Found {N} transactions · {from}–{to} · £{in} in / £{out}
 *  out'. When no candidate carried a date (`dateRange` is null), the date segment is omitted
 *  entirely rather than showing a fabricated range — honest-minimal, matching
 *  `buildStatementSummary`'s own "never invented" discipline for `dateRange`. Singular/plural on
 *  "transaction" mirrors every other count label in this codebase (PdfSuccessScreen's
 *  `foundLabel`, etc).
 *
 * HISTORY-TRIM HONESTY (task: HISTORY TRIM HONESTY): `droppedCount` is the number of OLDER
 * transactions THIS specific import caused `TRANSACTION_CAP` retention (store.ts) to evict — a
 * caller with a post-add `AddStatementAsHistoryResult` in hand should pass
 * `result.droppedTransactionCount ?? 0` (that field is already the correct per-import delta, see
 * `addStatementAsHistory`'s doc — never the store's running lifetime total, which would
 * double-count every prior import's drops on every subsequent summary line). A pre-add PREVIEW
 * summary (`buildStatementSummary` alone, before anything has landed) has no such field yet —
 * omit the argument there; nothing has been trimmed by an import that hasn't happened. Omitting it
 * (or passing `0`) makes the line read exactly as before, with no trailing sentence — never a
 * fabricated "0 trimmed" disclosure for an import that didn't trim anything. When positive, a
 * second sentence is appended so the calm import headline still tells the whole truth: the app
 * kept things fast by capping on-device history, but the export the statement came from is
 * untouched — nothing is lost, only not all of it is kept ON DEVICE. */
export function bulkSummaryLine(summary: AddStatementAsHistoryResult, droppedCount = 0): string {
  const noun = summary.added === 1 ? 'transaction' : 'transactions';
  const countPart = `Found ${summary.added} ${noun}`;
  const datePart =
    summary.dateRange !== null
      ? ` · ${shortDateLabel(summary.dateRange.fromISO)}–${shortDateLabel(summary.dateRange.toISO)}`
      : '';
  const moneyPart = ` · £${poundsFromPence(summary.totalInPence)} in / £${poundsFromPence(summary.totalOutPence)} out`;
  const trimPart =
    droppedCount > 0
      ? ` · ${droppedCount} older ${droppedCount === 1 ? 'item' : 'items'} trimmed to keep things fast — your export keeps everything`
      : '';
  return `${countPart}${datePart}${moneyPart}${trimPart}`;
}

// ---------------------------------------------------------------------------
// Post-import offer sequencing — closing balance, then income; each skippable.
// ---------------------------------------------------------------------------

/** The two post-import offers a completed `addStatementAsHistory` call can hand back, named so a
 *  caller can drive a simple one-at-a-time sequencer without re-deriving which offers exist. */
export type BulkLandingOffer = 'closing-balance' | 'income' | null;

/** Decide the NEXT offer to show given what has already been shown/skipped. Order is
 *  closing-balance first, then income (owner spec: "each one after the other, each skippable") —
 *  `shown` names every offer already resolved (confirmed OR skipped) so calling this repeatedly
 *  walks the sequence to completion without re-showing anything. Returns `null` once both offers
 *  in `summary` are exhausted (or never existed) — the caller then routes onward (Today, or the
 *  existing bill/drift/annual caught-sheet chain `addStatementAsHistory`'s ordering doc already
 *  describes for parity with ReviewScreen's onAdd). */
export function nextBulkLandingOffer(
  summary: AddStatementAsHistoryResult,
  shown: ReadonlySet<BulkLandingOffer>,
): BulkLandingOffer {
  if (summary.closingBalanceOffer !== undefined && !shown.has('closing-balance')) {
    return 'closing-balance';
  }
  if (summary.incomeSignal !== undefined && !shown.has('income')) {
    return 'income';
  }
  return null;
}

/** The closing-balance offer's confirm line: 'Your balance looks like £X as of {date} — use it?'.
 *  Pure formatting only — the actual `setCurrentBalance` write happens in the screen on confirm,
 *  never here (this module never touches the store). */
export function closingBalanceOfferLine(offer: { amountPence: number; asOfISO: string }): string {
  return `Your balance looks like £${poundsFromPence(offer.amountPence)} as of ${shortDateLabel(offer.asOfISO)} — use it?`;
}
