// detectAccountName — ACCOUNTS_MODEL.md §3 step 1/5 best-effort account-name/kind detection.
//
// WHY THIS EXISTS. When a statement lands via BulkStatementLanding, the owner spec calls for a calm
// "Which account is this?" step that DEFAULTS to a detected name/kind rather than always asking cold.
// This module is that detection's pure, testable core — never touches the store, never touches
// react-native.
//
// HONESTY CONTRACT (matches every other lib/*.ts engine in this codebase — never invent a fact):
// today's `CandidateMoneyItem` (lib/importSheet.ts) and the reader's `StatementClosingBalance`
// (src/local/statementReaderParse.ts) carry NO institution/bank-name field at all — the LLM reader
// extracts money movements + an optional closing balance, not the statement's header/letterhead text.
// So `detectAccountName` cannot honestly guess "Monzo" vs "Amex" from candidates alone today; doing so
// would be exactly the kind of fabricated confidence ACCOUNTS_MODEL.md §3 step 5 warns against
// ("always let the user confirm/override... rather than silently guessing wrong"). Extending the
// reader to capture header text is flagged in ACCOUNTS_MODEL.md as a separate, larger change (a
// reader-prompt change + live statement test) — out of scope for this pass. This helper is written so
// that change slots in later without a signature break: it already accepts an optional `headerText`
// hint parameter for exactly that future wiring.
//
// What it DOES do honestly today:
//   - `kind` detection: a conservative heuristic over merchant/note text for well-known card-issuer
//     patterns (a real, if narrow, signal already present in candidates today) — never defaults to
//     'credit-card' on a guess; only flips away from 'bank' when a pattern actually matches.
//   - `name`: `null` unless `headerText` is supplied (future reader wiring) — never fabricates an
//     institution name from a candidate's merchant list (a Tesco spend row is not evidence the
//     account itself is "Tesco Bank"). Returning `null` is the honest "ask the user" signal that
//     BulkStatementLanding's account-picker step reads to decide whether to prefill a name or show a
//     blank "Name this account" prompt.

import type { CandidateMoneyItem } from './importSheet';
import type { AccountKind } from '../store';

export type AccountNameDetection = {
  /** Best-effort institution/account label, e.g. "Monzo Current". `null` when nothing can be
   *  honestly inferred — the caller should prompt the user to name the account rather than prefill a
   *  guess. Only ever non-null when `headerText` was supplied (future reader wiring); never derived
   *  from candidate merchants/amounts alone. */
  name: string | null;
  /** Best-effort account kind. Defaults to `'bank'` — only flips to `'credit-card'` when a
   *  conservative pattern match actually fires (see `CARD_HINT_PATTERNS`). Never 'savings'/'cash' —
   *  this helper only ever distinguishes "is this obviously a card statement", matching
   *  ACCOUNTS_MODEL.md §3 step 5's bank-vs-card detection scope. */
  kind: AccountKind;
  /** True when `kind: 'credit-card'` was actually detected from a real signal (not just the
   *  default) — lets the caller decide whether to pre-select the credit-card toggle or leave it at
   *  the bank default. Always `false` when `kind === 'bank'`. */
  kindDetected: boolean;
};

/** Conservative, case-insensitive substring patterns that suggest a CARD statement rather than a bank
 *  current account — matched against candidate merchant text and (when present) free-text notes/
 *  category guesses, and against an optional header hint. Deliberately narrow: a false 'bank' default
 *  is always safe (the user confirms/overrides at account-creation time per §3 step 5); a false
 *  'credit-card' flip is the one this list must avoid, so only strong, unambiguous phrases are here. */
const CARD_HINT_PATTERNS: readonly RegExp[] = [
  /credit\s*card/i,
  /\bcard\s*statement\b/i,
  /\bamex\b/i,
  /american express/i,
  /\bvisa\s*card\b/i,
  /\bmastercard\b/i,
  /\bminimum payment\b/i,
  /\bpayment due\b/i,
  /\bcredit limit\b/i,
];

function textHintsCard(text: string | undefined): boolean {
  if (text === undefined || text.trim().length === 0) return false;
  return CARD_HINT_PATTERNS.some((pattern) => pattern.test(text));
}

/** Best-effort account name + kind detection for one statement's candidates (ACCOUNTS_MODEL.md §3
 *  step 1/5). Pure — never reads or writes the store, never fabricates an institution name (see the
 *  module doc's honesty contract).
 *
 *  `headerText` is an OPTIONAL hint for a future reader that captures the statement's header/
 *  letterhead text — today's reader doesn't produce one, so every real caller omits it and `name`
 *  comes back `null`. Passing it (once available) lets this function extract a plausible institution
 *  name via a light heuristic (first line / known-bank-name match) instead of always asking. */
export function detectAccountName(
  candidates: readonly CandidateMoneyItem[],
  headerText?: string,
): AccountNameDetection {
  const cardHintFromCandidates = candidates.some(
    (c) => textHintsCard(c.merchant) || textHintsCard(c.note) || textHintsCard(c.category),
  );
  const cardHintFromHeader = textHintsCard(headerText);
  const kindDetected = cardHintFromCandidates || cardHintFromHeader;

  return {
    name: detectNameFromHeader(headerText),
    kind: kindDetected ? 'credit-card' : 'bank',
    kindDetected,
  };
}

/** Extract a plausible institution name from header text, when supplied. Very conservative: returns
 *  the first non-empty line, trimmed, capped to a reasonable label length — never invents a name when
 *  `headerText` is absent or blank. This is the seam a future reader-prompt change wires into; nothing
 *  in this codebase calls it with a real `headerText` yet. */
function detectNameFromHeader(headerText: string | undefined): string | null {
  if (headerText === undefined) return null;
  const firstLine = headerText.split('\n').find((line) => line.trim().length > 0);
  if (firstLine === undefined) return null;
  const trimmed = firstLine.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > 40 ? `${trimmed.slice(0, 40).trim()}…` : trimmed;
}
