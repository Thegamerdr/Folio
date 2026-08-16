// Review de-dupe wiring — ENGINES.md §8 / OPEN_BANKING_DEDUPE_RESEARCH.md §7. Runs the PURE
// `proposeMatches` engine over the one Review candidate vs the user's existing transactions, so the
// Review surface can PROPOSE (never auto-merge) "This looks like something you already added." with
// Link · Keep both · Ignore · Edit. Pure, deterministic, no react-native — the surface renders the
// result and only "Keep both" (a deliberate Add) ever mutates; "Link" adds nothing, so it can never
// double-count and nothing is destroyed (trivially reversible: the user re-adds).
//
// Types come from the data spine `@/folio/store` and the pure engine `./dedupe`.

import { proposeMatches, type MatchProposal } from './dedupe';
import type { Transaction } from '../store';

/** The minimal shape Review hands the de-dupe for the incoming candidate under review. */
export type ReviewMatchInput = {
  id: string;
  /** Signed £ — spend negative, income positive (store convention). */
  amount: number;
  /** ISO `YYYY-MM-DD`. */
  dateIso: string;
  merchant: string;
};

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/**
 * Resolve a Review card date to an ISO `YYYY-MM-DD`. Accepts an ISO date directly, or a display date
 * like "26 June" resolved against `year`. Returns null when it can't be read as a date — the caller
 * then SKIPS de-dupe (a candidate whose date we can't compare is never merged on a guess).
 */
export function reviewDateToIso(date: string, year: number): string | null {
  const trimmed = date.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dm = /^(\d{1,2})\s+([A-Za-z]+)$/.exec(trimmed);
  if (dm) {
    const day = Number(dm[1]);
    const monthIdx = MONTHS.indexOf((dm[2] ?? '').toLowerCase());
    if (monthIdx >= 0 && day >= 1 && day <= 31) {
      const mm = String(monthIdx + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `${year}-${mm}-${dd}`;
    }
  }
  return null;
}

/**
 * Find the de-dupe proposal for one Review candidate against the user's existing transactions, or
 * null when there is no honest match. The candidate is the INCOMING import; the existing transactions
 * are the user's own rows (manual origin — no provider id, so manual↔import is always a *proposal*,
 * never an auto-merge). Returns the first proposal for THIS candidate. Pure.
 */
export function reviewMatch(
  candidate: ReviewMatchInput,
  transactions: readonly Transaction[],
  nowIso: string,
): MatchProposal | null {
  const existing = transactions.map((t) => ({
    id: t.id,
    amount: t.amount,
    date: t.when.slice(0, 10),
    merchant: t.merchant,
    origin: 'manual' as const,
  }));
  const incoming = {
    id: candidate.id,
    amount: candidate.amount,
    date: candidate.dateIso,
    merchant: candidate.merchant,
    origin: 'import' as const,
  };
  const proposals = proposeMatches(existing, [incoming], { now: nowIso });
  return proposals.find((p) => p.incomingId === candidate.id) ?? null;
}

/** Calm, non-judgemental sub-line for a proposal kind (§5 language gate — no "reconcile"/"duplicate
 *  removed"; nothing implies Folio changed the user's record on its own). */
export function reviewMatchSubline(proposal: MatchProposal): string {
  switch (proposal.kind) {
    case 'propose-amount-changed':
      return 'The amount changed since you added it.';
    case 'propose-refund':
      return 'This looks like a refund of something you added.';
    case 'propose-transfer':
      return 'This looks like money moving between your own accounts.';
    case 'link-by-provider':
    case 'propose-link':
    default:
      return 'Same amount, around the same day.';
  }
}
