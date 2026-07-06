// Statement-summary engine — the pure math half of `addStatementAsHistory` (store.ts).
//
// WHY THIS EXISTS. The bulk "add all as history" flow (task: BULK ADD-AS-HISTORY) needs one honest
// summary of what landed — a date range, totals in/out, and (later) whatever income/closing-balance
// offers the caller wants to make — computed straight from the candidates being landed, without
// touching the store. Kept pure and Node-testable (no react-native, no store mutation), matching the
// split discipline every other lib/*.ts engine in this codebase already follows (historyCycles.ts,
// caughtIncome.ts, merchantMemory.ts, ...).
//
// SIGN + CATEGORY CONTRACT: a `CandidateMoneyItem`'s `amount` is already signed (spend negative,
// income positive — see importSheet.ts / statementReaderParse.ts). This module trusts that sign
// verbatim; it never re-derives it from `kind`. Category is resolved kind-correctly: an `income`-kind
// candidate always becomes `Transaction['category'] = 'income'`, regardless of any free-text
// `category` guess the reader attached (mirrors ReviewScreen.tsx's income-category fix — a bulk
// import must get the same honesty guarantee a one-at-a-time Review confirm gets). A `spend`-kind
// candidate's free-text category guess is mapped onto the known Transaction buckets when it matches
// one; otherwise it falls back to 'other' — never invented, never coerced onto an unrelated bucket.

import type { CandidateMoneyItem } from './importSheet';
import type { Transaction } from '../store';

// ---------------------------------------------------------------------------
// Candidate -> Transaction mapping
// ---------------------------------------------------------------------------

/** The known Transaction category buckets a free-text candidate `category` guess can land on. */
const KNOWN_CATEGORY_BUCKETS: ReadonlySet<Transaction['category']> = new Set([
  'food',
  'transport',
  'fun',
  'bills',
  'shopping',
  'income',
  'other',
]);

/** Loose aliasing for common reader/model category spellings onto the app's fixed bucket set —
 *  mirrors the spirit of ReviewScreen.tsx's CATEGORIES chips (Groceries/Eating out -> food, etc.) so
 *  a bulk import's free-text guesses land on sensible buckets instead of universally falling to
 *  'other'. Deliberately small and conservative: an unrecognised guess still falls to 'other' rather
 *  than being force-fit onto the wrong bucket. */
const CATEGORY_ALIASES: Readonly<Record<string, Transaction['category']>> = {
  food: 'food',
  groceries: 'food',
  grocery: 'food',
  'eating out': 'food',
  restaurant: 'food',
  restaurants: 'food',
  dining: 'food',
  transport: 'transport',
  transportation: 'transport',
  travel: 'transport',
  fun: 'fun',
  entertainment: 'fun',
  leisure: 'fun',
  bills: 'bills',
  'bills & utilities': 'bills',
  utilities: 'bills',
  utility: 'bills',
  rent: 'bills',
  subscription: 'bills',
  subscriptions: 'bills',
  'mobile phone': 'bills',
  shopping: 'shopping',
  income: 'income',
  salary: 'income',
  payroll: 'income',
  wages: 'income',
  transfer: 'other',
  other: 'other',
};

/** Resolve a candidate's `Transaction['category']`, kind-correct and never coerced to 'food' for an
 *  income row (the exact defect ReviewScreen.tsx's categoryFor had before the income-category fix).
 *  `income`-kind ALWAYS resolves to 'income' — the free-text guess (if any) is ignored for the
 *  bucket decision, since the sign/kind is the fact and the guess is only ever a hint. A `spend`-kind
 *  (or any other kind) candidate maps its free-text guess through `CATEGORY_ALIASES` when
 *  recognised, else falls to 'other'. Already-canonical buckets (`category` exactly matching a known
 *  bucket, case-sensitive) pass straight through before the alias table is consulted. */
export function resolveCandidateCategory(candidate: CandidateMoneyItem): Transaction['category'] {
  if (candidate.kind === 'income' || candidate.amount > 0) return 'income';

  const raw = candidate.category?.trim();
  if (raw === undefined || raw.length === 0) return 'other';

  if (KNOWN_CATEGORY_BUCKETS.has(raw as Transaction['category'])) {
    return raw as Transaction['category'];
  }
  const aliased = CATEGORY_ALIASES[raw.toLowerCase()];
  return aliased ?? 'other';
}

/** One candidate -> one `Transaction` row shape (minus `id`/`when` defaults, which
 *  `addTransactionsBatch` stamps) — signed amount verbatim, kind-correct category, `source:
 *  'statement'`-flavoured provenance folded into a note-free row (Transaction has no note field, so
 *  provenance lives only in the candidate/Review layer upstream — this mapping is money-path only). */
export type StatementTransactionDraft = Pick<Transaction, 'merchant' | 'amount' | 'category'> & {
  source: Transaction['source'];
  /** Preserves the candidate's own date when present, so the landed row's `when` reflects the real
   *  transaction date rather than "now" — `addTransactionsBatch` only defaults `when` when omitted. */
  when?: string;
};

/** Map one candidate into a transaction draft ready for `addTransactionsBatch`. Pure — never reads
 *  or writes the store. `source: 'manual'` matches every other confirmed-by-the-user landing path
 *  (ReviewScreen.tsx's onAdd) — a bulk "add all" is still a user-confirmed action, not a background
 *  sync. */
export function candidateToTransactionDraft(
  candidate: CandidateMoneyItem,
): StatementTransactionDraft {
  const draft: StatementTransactionDraft = {
    merchant: candidate.merchant.trim() || 'Unnamed',
    amount: candidate.amount,
    category: resolveCandidateCategory(candidate),
    source: 'manual',
  };
  if (candidate.date !== undefined) {
    draft.when = `${candidate.date}T00:00:00.000Z`;
  }
  return draft;
}

// ---------------------------------------------------------------------------
// Summary math
// ---------------------------------------------------------------------------

export type StatementDateRange = { fromISO: string; toISO: string };

/** The honest summary of one bulk "add all as history" landing — pure math over the candidates
 *  being landed, computed BEFORE they touch the store. `totalInPence`/`totalOutPence` are always
 *  non-negative (direction is implied by the field name, matching `PotLedgerEntry`'s "always
 *  positive, kind implies sign" convention elsewhere in this codebase). Money fields are pence
 *  (integers) to avoid floating-point drift when summing many rows — callers divide by 100 to
 *  display pounds. `dateRange` is `null` when no candidate carries a date (nothing to range over). */
export type StatementSummary = {
  added: number;
  dateRange: StatementDateRange | null;
  totalInPence: number;
  totalOutPence: number;
};

/** £ -> integer pence, rounded to the nearest penny (avoids float drift when summing many rows). */
function toPence(pounds: number): number {
  return Math.round(pounds * 100);
}

/** Pure summary math for a batch of statement candidates — the testable core `addStatementAsHistory`
 *  wraps with the actual store writes. Never mutates `candidates`. `added` is simply
 *  `candidates.length` (every candidate passed in is assumed already filtered to what the caller
 *  intends to land — this function does not itself decide inclusion/exclusion). */
export function buildStatementSummary(candidates: readonly CandidateMoneyItem[]): StatementSummary {
  let totalInPence = 0;
  let totalOutPence = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const candidate of candidates) {
    const pence = toPence(candidate.amount);
    if (pence >= 0) totalInPence += pence;
    else totalOutPence += -pence;

    if (candidate.date !== undefined) {
      if (minDate === null || candidate.date < minDate) minDate = candidate.date;
      if (maxDate === null || candidate.date > maxDate) maxDate = candidate.date;
    }
  }

  return {
    added: candidates.length,
    dateRange: minDate !== null && maxDate !== null ? { fromISO: minDate, toISO: maxDate } : null,
    totalInPence,
    totalOutPence,
  };
}
