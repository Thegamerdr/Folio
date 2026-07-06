// Caught-bills bridge — DATA_INTELLIGENCE.md phase ⑤(B). Mirrors caughtSubs.ts line-for-line: turns
// the SAME recurring-charge DETECTION engine (`detectRecurring`, lib/subSignals.ts) into a "this
// looks like a recurring bill" candidate, filtered to merchants not already in the subs catalog and
// not the one merchant SubCaughtSheet is currently offering (see "DOUBLE-PROPOSE GUARD" below).
//
// REAL BILL ENTITY DECISION (DATA_INTELLIGENCE.md phase ⑤(B) build note, recorded here per the task
// brief "investigate and pick the real seam, document the decision"): the live folio spine has no
// separate bill entity. `calendarEvents.ts`'s RECURRING_BILLS is demo-hardcoded scaffolding
// (`includeSampleBills` gate, zero relation to user data); `CalendarEvent` (store.ts) is a single
// DATED entry with no cadence field, so it cannot honestly represent "this recurs" the way a Sub can.
// The app's own real answer to "how does a user add a recurring bill" is `AddEntryScreen`
// (`kind: 'bill'`), and its `@writes` doc is unambiguous: `setSubs (for bills)`. A `Sub` is not
// subscription-only in this codebase — it is the recurring-outflow record, full stop (its own doc:
// "user's own recurring bills come through `subs` [Add a bill → setSubs], not this const"). So a
// caught BILL confirms into the exact same `subs[]` catalog a caught SUB does; the only real
// distinction this module adds is presentation ("this looks like a recurring bill" vs "recurring
// charge") plus the double-propose guard below. If a dedicated Bill entity is added later, this
// module's write target is the one seam that needs to move — everything else (detection, dismissal,
// candidate shape) stays.
//
// DOUBLE-PROPOSE GUARD (subs take precedence, per task brief): a merchant is excluded here when it is
// (a) already in the subs catalog, OR (b) the merchant SubCaughtSheet is CURRENTLY OFFERING (i.e.
// findCaughtSubs's first/currently-shown candidate — see caughtSubs.ts's own "resolved = caught[0]"
// convention, mirrored by every caught-sheet). Note this is deliberately NOT "every merchant
// findCaughtSubs could theoretically also classify as a sub": `detectRecurring` has no notion of
// "subscription-shaped" vs "bill-shaped" money — EVERY confirmed non-catalog recurring debit clears
// findCaughtSubs's own filter by construction, so excluding the FULL set here would make this module
// permanently empty (there would be nothing left for a bill to ever catch). Excluding only the one
// candidate actually visible on screen right now is the real collision this guard prevents — the
// user seeing "Octopus Energy" proposed as a charge AND a bill in the same sitting — while still
// letting every other qualifying merchant surface as a bill.
//
// HONESTY (mirrors caughtSubs.ts): payment-facts-only. `RecurringSignal` has no usage/value/cancel/
// decay field by construction; this module only reads payment-derived fields off the signal.
//
// Split discipline (matches caughtSubs.ts): `findCaughtBills` is pure and Node-testable (no
// react-native, no DOM, no store mutation) — collected by the apps/**\/*.test.ts vitest runner via
// caughtBills.test.ts. `useCaughtBills` is the thin React hook that wires the live ledger + subs
// catalog from the store into that pure function for the sheet.

import { useMemo } from 'react';

import { useAppStore, bankTransactions, type Transaction } from '../store';
import { detectRecurring, type Cadence, type Charge, type RecurringSignal } from './subSignals';
import { findCaughtSubs } from './caughtSubs';

// ---------------------------------------------------------------------------
// Candidate shape — mirrors CaughtSubCandidate exactly (same detector, same
// facts) so BillCaughtSheet can share SubCaughtSheet's rendering conventions
// without a translation layer. Payment facts only — see module header.
// ---------------------------------------------------------------------------

export type CaughtBillCandidate = {
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
  cadence: Cadence;
};

// The cadences this sheet surfaces — identical scope to caughtSubs.ts's SHEET_CADENCES (same
// reasoning: quarterly/yearly are a different mental bucket, out of scope for a "spotted a recurring
// bill" catch today).
const SHEET_CADENCES: ReadonlySet<Cadence> = new Set<Cadence>(['weekly', 'fortnightly', 'monthly']);

const MINOR = 100;

// Short month labels for the human `lastDate`. Deterministic + Node-safe (no locale/Intl dependence),
// identical table to caughtSubs.ts so the two sheets format dates the same way.
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
// Pure mapping helpers — identical to caughtSubs.ts (kept local/duplicated
// deliberately, mirroring that module's own stated convention for sibling
// bridges rather than adding a shared-helpers third module).
// ---------------------------------------------------------------------------

/** Lowercase + trim a name for catalog comparison. */
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
 *  fixed bill lower === upper). Minor units (pence) → pounds. */
function candidateAmountPounds(signal: RecurringSignal): number {
  return signal.amount.upperMinor / MINOR;
}

/** Map one payment-derived signal to the sheet's candidate shape. */
function toCandidate(signal: RecurringSignal): CaughtBillCandidate {
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

/** Project a store `Transaction` onto a detector `Charge`. */
function toCharge(txn: Transaction): Charge {
  return { merchant: txn.merchant, amount: txn.amount, date: txn.when.slice(0, 10) };
}

// ---------------------------------------------------------------------------
// Public pure API.
// ---------------------------------------------------------------------------

/**
 * Run the recurring-charge detector over the ledger and return the CONFIRMED
 * series (weekly/fortnightly/monthly) whose merchant is NOT already in the
 * subscription catalog, is NOT the merchant SubCaughtSheet is currently
 * offering (subs take precedence — see module header "DOUBLE-PROPOSE GUARD"),
 * and has NOT been dismissed, mapped to the BillCaught candidate shape.
 *
 * Pure + deterministic: never mutates the inputs, same inputs → same output.
 * Payment facts only (see module header) — no usage/value/cancel/decay.
 *
 * @param transactions the ledger (store `transactions`)
 * @param knownSubNames the catalog of subs the user already has (`subs[].name`)
 * @param dismissedMerchants normalised merchant keys the user already said
 *        "not this one" to (store `dismissedBillSignals`)
 * @param now optional ISO `YYYY-MM-DD`; only forwarded to the engine for parity
 *            (it doesn't change which series are surfaced here)
 */
export function findCaughtBills(
  transactions: readonly Transaction[],
  knownSubNames: readonly string[],
  dismissedMerchants: readonly string[] = [],
  now?: string,
): CaughtBillCandidate[] {
  if (transactions.length === 0) return [];

  const charges = transactions.map(toCharge);
  const signals = detectRecurring(charges, now === undefined ? {} : { now });

  const known = new Set(knownSubNames.map(normaliseName));
  const dismissed = new Set(dismissedMerchants.map(normaliseName));

  // Subs take precedence over the ONE merchant currently on screen as a sub candidate — see the
  // module header's "DOUBLE-PROPOSE GUARD" note on why this is `caught[0]`, not the full set.
  const currentlyOfferedAsSub = findCaughtSubs(transactions, knownSubNames, now)[0]?.name;
  const claimedBySub =
    currentlyOfferedAsSub !== undefined ? normaliseName(currentlyOfferedAsSub) : null;

  return signals
    .filter((s) => s.status === 'series' && SHEET_CADENCES.has(s.cadence))
    .filter((s) => !known.has(normaliseName(s.merchant)))
    .filter((s) => normaliseName(s.merchant) !== claimedBySub)
    .filter((s) => !dismissed.has(normaliseName(s.merchant)))
    .map(toCandidate);
}

// ---------------------------------------------------------------------------
// React hook — wires the live store into the pure detector for the sheet.
// ---------------------------------------------------------------------------

/**
 * Live caught-bill candidates derived from the current ledger, excluding any
 * merchant already in the subscription catalog, the one merchant currently
 * offered as a sub candidate, or already dismissed. Recomputed only when
 * transactions/subs/dismissedBillSignals change.
 *
 * BANK-ONLY (ACCOUNTS_MODEL.md §2.4): detection runs over `bankTransactions(state)` — a card
 * statement's recurring merchant pattern shouldn't be caught as a bank-side recurring bill. Inert on
 * a single-account (migrated) install.
 */
export function useCaughtBills(): CaughtBillCandidate[] {
  const rawTransactions = useAppStore((state) => state.transactions);
  const accounts = useAppStore((state) => state.accounts);
  const subs = useAppStore((state) => state.subs);
  const dismissedBillSignals = useAppStore((state) => state.dismissedBillSignals ?? []);
  const transactions = useMemo(
    () => bankTransactions({ transactions: rawTransactions, accounts }),
    [rawTransactions, accounts],
  );

  return useMemo(
    () =>
      findCaughtBills(
        transactions,
        subs.map((s) => s.name),
        dismissedBillSignals,
      ),
    [transactions, subs, dismissedBillSignals],
  );
}
