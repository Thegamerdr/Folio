// Caught-subs bridge — turns the recurring-charge DETECTION engine
// (`detectRecurring`, lib/subSignals.ts) into the SubCaught sheet's candidate
// shape, filtered to merchants the subscription catalog does NOT already hold.
//
// HONESTY (ENGINES.md §6 "Subs — usage decay" / engine #7): this module is
// payment-facts-only. It maps `RecurringSignal` → `SubCandidate` carrying just
// the merchant name, the charge amount, and the recurrence facts (how many
// times it was charged, when it was last charged). It NEVER asserts usage,
// value, waste, decay, or a cancel recommendation — banking data proves a
// payment recurred, it cannot prove a product was used. The source engine has
// no usage/value/cancel field by construction; we keep that guarantee here by
// only reading payment-derived fields off the signal.
//
// Split discipline: `findCaughtSubs` is pure and Node-testable (no react-native,
// no DOM, no store mutation) — collected by the apps/**\/*.test.ts vitest runner
// via caughtSubs.test.ts. `useCaughtSubs` is the thin React hook that wires the
// live ledger from the store into that pure function for the sheet.

import { useMemo } from 'react';

import { useAppStore, type Transaction } from '../store';
import { detectRecurring, type Cadence, type Charge, type RecurringSignal } from './subSignals';

// ---------------------------------------------------------------------------
// Candidate shape — mirrors SubCaughtSheet's `SubCandidate` exactly so the
// sheet can consume it without a translation layer. Payment facts only:
//   • name     — the detected merchant (display spelling)
//   • amount   — the recurring charge in £ (the upper observed bound, a fact)
//   • seen     — how many times it was charged (signal.occurrences, a fact)
//   • lastDate — human label for the most recent charge (signal.lastSeen)
//   • category — neutral placeholder for the future Sub categorisation; NEVER a
//                usage/value verdict. Always 'other' here — detection can't and
//                won't classify what the money was "for".
// ---------------------------------------------------------------------------

export type CaughtSubCandidate = {
  name: string;
  amount: number;
  seen: number;
  lastDate: string;
  /** ISO `YYYY-MM-DD` of the last confirmed charge (`RecurringSignal.lastSeen`, unformatted).
   *  Carried alongside the human `lastDate` label so the confirm path can derive an honest
   *  `nextRenewalDaysAway` from the real cadence + last-charge date (lib/renewalMath.ts) instead
   *  of a hardcoded constant — `lastDate` alone ("12 Jun") is display-only and not parseable. */
  lastDateIso: string;
  category: string;
  /** The detected cadence (DATA_INTELLIGENCE.md phase ⑤ "weekly-cadence unlock") —
   *  a payment fact, carried so the sheet can render cadence-aware copy ("Looks
   *  like a weekly charge") instead of always assuming monthly. */
  cadence: Cadence;
};

// The cadences this sheet surfaces. Previously hardcoded to 'monthly' only —
// DATA_INTELLIGENCE.md phase ⑤(A) "un-hardcode SHEET_CADENCE": `detectRecurring`
// already classifies weekly/fortnightly confirmed series correctly, but they
// were silently thrown away at this filter. Quarterly/yearly stay excluded —
// a different mental bucket (annual renewals read more like a bill/subscription
// review moment than a "spotted a recurring charge" catch, and the sheet's
// copy/framing isn't built for that cadence yet).
const SHEET_CADENCES: ReadonlySet<Cadence> = new Set<Cadence>(['weekly', 'fortnightly', 'monthly']);

const MINOR = 100;

// Short month labels for the human `lastDate`. Deterministic + Node-safe (no
// locale/Intl dependence), so the pure function and its tests never drift.
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

// ---------------------------------------------------------------------------
// Pure mapping helpers.
// ---------------------------------------------------------------------------

/** Lowercase + trim a name for catalog comparison (matches the sheet's
 *  duplicate-skip check and the store's name-keyed maps). */
function normaliseName(raw: string): string {
  return raw.trim().toLowerCase();
}

/** "2026-06-12" → "12 Jun". Pure, UTC-based, no locale. */
function shortDateLabel(iso: string): string {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(ms)) return iso;
  const d = new Date(ms);
  const day = d.getUTCDate();
  const month = MONTHS_SHORT[d.getUTCMonth()] ?? '';
  return `${day} ${month}`.trim();
}

/** The recurring charge in £ — the upper observed bound (a payment fact; for a
 *  fixed sub lower === upper). Minor units (pence) → pounds. */
function candidateAmountPounds(signal: RecurringSignal): number {
  return signal.amount.upperMinor / MINOR;
}

/** Map one payment-derived signal to the sheet's candidate shape. */
function toCandidate(signal: RecurringSignal): CaughtSubCandidate {
  return {
    name: signal.merchant,
    amount: candidateAmountPounds(signal),
    seen: signal.occurrences,
    lastDate: shortDateLabel(signal.lastSeen),
    lastDateIso: signal.lastSeen,
    // Neutral by construction — detection never classifies usage or value.
    category: 'other',
    cadence: signal.cadence,
  };
}

/** Project a store `Transaction` onto a detector `Charge`. Income rows are
 *  irrelevant to recurring-spend detection but harmless (positive amounts are
 *  treated as credits/returns by the engine). */
function toCharge(txn: Transaction): Charge {
  return { merchant: txn.merchant, amount: txn.amount, date: txn.when.slice(0, 10) };
}

// ---------------------------------------------------------------------------
// Public pure API.
// ---------------------------------------------------------------------------

/**
 * Run the recurring-charge detector over the ledger and return the CONFIRMED
 * series (weekly/fortnightly/monthly — see SHEET_CADENCES) whose merchant is
 * NOT already in the subscription catalog, mapped to the SubCaught candidate
 * shape.
 *
 * Pure + deterministic: never mutates the inputs, same inputs → same output.
 * Payment facts only (see module header) — no usage/value/cancel/decay.
 *
 * @param transactions the ledger (store `transactions`)
 * @param knownSubNames the catalog of subs the user already has (`subs[].name`)
 * @param now optional ISO `YYYY-MM-DD`; only forwarded to the engine for parity
 *            (it doesn't change which series are surfaced here)
 */
export function findCaughtSubs(
  transactions: readonly Transaction[],
  knownSubNames: readonly string[],
  now?: string,
): CaughtSubCandidate[] {
  if (transactions.length === 0) return [];

  const charges = transactions
    .filter(
      (transaction) =>
        transaction.financialAction?.kind !== 'transfer' &&
        transaction.financialAction?.kind !== 'refund',
    )
    .map(toCharge);
  const signals = detectRecurring(charges, now === undefined ? {} : { now });

  const known = new Set(knownSubNames.map(normaliseName));

  return (
    signals
      // Only confirmed series, only the cadences this sheet is framed for.
      .filter((s) => s.status === 'series' && SHEET_CADENCES.has(s.cadence))
      // Drop anything already in the catalog (case/space-insensitive).
      .filter((s) => !known.has(normaliseName(s.merchant)))
      .map(toCandidate)
  );
}

// ---------------------------------------------------------------------------
// React hook — wires the live store into the pure detector for the sheet.
// ---------------------------------------------------------------------------

/**
 * Live caught-sub candidates derived from the current ledger, excluding any
 * merchant already in the subscription catalog. Recomputed only when the
 * transactions or the subs list change (so re-renders don't re-run detection).
 */
export function useCaughtSubs(): CaughtSubCandidate[] {
  const transactions = useAppStore((state) => state.transactions);
  const subs = useAppStore((state) => state.subs);

  return useMemo(
    () =>
      findCaughtSubs(
        transactions,
        subs.map((s) => s.name),
      ),
    [transactions, subs],
  );
}
