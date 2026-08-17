// Caught-annual bridge — DATA_INTELLIGENCE.md phase ⑥ item 5 ("annual-bill radar"). Turns
// lib/historyStats.ts's `detectAnnualCandidates` DETECTION engine into the confirmation-surface
// candidate shape for `AnnualCaughtSheet`, filtered to merchants not already dismissed AND not already
// in the subs catalog (see "ANNUAL-SUBS GUARD" below).
//
// ANNUAL-SUBS GUARD (task: mirrors caughtBills.ts's own DOUBLE-PROPOSE GUARD exactly — normalise-and-
// exclude): a merchant already present in `subs[]` is excluded here. `detectAnnualCandidates` has no
// notion of "already tracked as a recurring outflow" — it only sees the transaction ledger, so a
// merchant a user has ALREADY declared as a Sub (e.g. TV Licensing, added via AddEntryScreen or a
// prior BillCaughtSheet confirm) would otherwise be proposed a SECOND time here as if it were a fresh
// annual find. That's the same collision caughtBills.ts's guard exists to prevent, one entity type
// over: the user seeing "TV Licensing" proposed as an annual radar hit when they already track it as a
// recurring Sub. Unlike caughtBills' guard (which excludes only the ONE merchant currently offered as a
// sub, because every other qualifying merchant must stay free to surface as a bill), this guard
// excludes the FULL subs catalog — there's no equivalent "annual candidates would go permanently empty"
// risk here, since `detectAnnualCandidates`'s own ~365-day-cadence classification is a much narrower
// slice than "every recurring debit" (subSignals.ts's weekly/fortnightly/monthly detector), so most
// subs were never going to double as annual candidates anyway.
//
// SURFACE CHOICE (task brief: "pick the honest minimal surface that fits existing patterns, document
// choice"): InsightsScreen and CalendarScreen are both FROZEN 1:1 web ports (see their own doc-block
// `@copy FROZEN` / "VOICE is FROZEN" notes) — inserting a new row into either would violate that
// contract. The honest minimal surface is a NEW quiet card appended to InsightsScreen's existing
// "extra, non-frozen" block (it already grew a weekly-digest card + a tiny-wins card the same way,
// neither of which exists in the original web source) that opens this confirmation sheet on tap —
// same propose-and-confirm shape as every other caught-* sheet, never an auto-added calendar event.
//
// HONESTY: payment-facts-only. `AnnualCandidate` has no "cancel this" / "you're overpaying" verdict —
// this module only reads the engine's amount/occurrences/lastSeen facts, and the sheet's own copy
// hedges ("around", "usually") per the task brief.
//
// Split discipline (matches caughtBills.ts / caughtIncome.ts / caughtDrift.ts): `findCaughtAnnual` is
// pure and Node-testable (no react-native, no DOM, no store mutation) — collected by the
// apps/**\/*.test.ts vitest runner via caughtAnnual.test.ts. `useCaughtAnnual` is the thin React hook
// that wires the live ledger into that pure function for the sheet/card.

import { useMemo } from 'react';

import { useAppStore, bankAnalyticsTransactions, type Transaction } from '../store';
import { detectAnnualCandidates, type AnnualCandidate } from './historyStats';

// ---------------------------------------------------------------------------
// Candidate shape — mirrors AnnualCandidate exactly (same detector, same
// facts); kept as a distinct exported type so the sheet/card imports from this
// bridge module rather than reaching into lib/historyStats.ts directly,
// matching every sibling caught-* bridge's convention.
// ---------------------------------------------------------------------------

export type AnnualCaughtCandidate = AnnualCandidate;

function normaliseMerchant(raw: string): string {
  return raw.trim().toLowerCase();
}

/** The month name (English, deterministic, no Intl dependence) an annual candidate is "usually"
 *  expected in — the calendar month of its most recent charge, one year on. Node-safe, mirrors the
 *  MONTHS_SHORT-style tables already used by caughtBills.ts / IncomeCaughtSheet.tsx, but spelled out
 *  in full since this reads in prose ("usually October"), not a compact date chip. */
const MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** "2026-06-12" -> "June". Pure, UTC-based, no locale. */
export function expectedMonthLabel(lastSeenIso: string): string {
  const ms = Date.parse(`${lastSeenIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(ms)) return '';
  return MONTHS_FULL[new Date(ms).getUTCMonth()] ?? '';
}

/** The next occurrence of this annual bill — one year on from the last-seen charge, same
 *  day-of-month (calendar-correct: clamps into a shorter target month, same convention as
 *  lib/renewalMath.ts's `addCalendarMonths`). Used to date the confirm-added calendar event. */
export function nextAnnualOccurrenceIso(lastSeenIso: string): string {
  const [y, m, d] = lastSeenIso.slice(0, 10).split('-').map(Number);
  const year = (y ?? 1970) + 1;
  const month = (m ?? 1) - 1; // 0-11
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d ?? 1, lastDayOfTargetMonth);
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// Public pure API.
// ---------------------------------------------------------------------------

/**
 * Run the annual-candidate detector over the ledger and return every candidate not already dismissed
 * AND not already in the subs catalog (see module header "ANNUAL-SUBS GUARD"). Pure + deterministic:
 * never mutates `transactions`/`knownSubNames`, same input -> same output.
 *
 * @param transactions the ledger (store `transactions`)
 * @param dismissedMerchants normalised merchant keys already dismissed (store `dismissedAnnualSignals`)
 * @param knownSubNames the catalog of subs the user already has (`subs[].name`) — excluded so an
 *        already-tracked recurring outflow is never proposed a second time as a fresh annual find
 */
export function findCaughtAnnual(
  transactions: readonly Transaction[],
  dismissedMerchants: readonly string[] = [],
  knownSubNames: readonly string[] = [],
): AnnualCaughtCandidate[] {
  if (transactions.length === 0) return [];
  const dismissed = new Set(dismissedMerchants.map(normaliseMerchant));
  const known = new Set(knownSubNames.map(normaliseMerchant));
  return detectAnnualCandidates(transactions).filter(
    (c) =>
      !dismissed.has(normaliseMerchant(c.merchant)) && !known.has(normaliseMerchant(c.merchant)),
  );
}

// ---------------------------------------------------------------------------
// React hook — wires the live store into the pure detector for the card/sheet.
// ---------------------------------------------------------------------------

/** Live annual candidates derived from the current ledger, excluding anything already dismissed OR
 *  already in the subs catalog (see module header "ANNUAL-SUBS GUARD"). Recomputed only when
 *  transactions/dismissedAnnualSignals/subs change.
 *
 *  BANK-ONLY (ACCOUNTS_MODEL.md §2.4): detection runs over `bankTransactions(state)` — a credit-card's
 *  annual-cadence charge shouldn't be caught as a bank-side annual bill. Inert on a single-account
 *  (migrated) install. */
export function useCaughtAnnual(): AnnualCaughtCandidate[] {
  const rawTransactions = useAppStore((state) => state.transactions);
  const accounts = useAppStore((state) => state.accounts);
  const dismissedAnnualSignals = useAppStore((state) => state.dismissedAnnualSignals ?? []);
  const subs = useAppStore((state) => state.subs);
  const transactions = useMemo(
    () => bankAnalyticsTransactions({ transactions: rawTransactions, accounts }),
    [rawTransactions, accounts],
  );

  return useMemo(
    () =>
      findCaughtAnnual(
        transactions,
        dismissedAnnualSignals,
        subs.map((s) => s.name),
      ),
    [transactions, dismissedAnnualSignals, subs],
  );
}
