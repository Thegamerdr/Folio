// Recurring-charge detection — the pure heuristic behind the SubCaught sheet ("Folio spotted a
// likely recurring charge"). It looks at the user's own confirmed spends and asks a careful
// question: does one merchant keep charging a similar amount, about once a month, that is NOT
// already a subscription? If so, it surfaces ONE candidate the user can confirm or wave away.
//
// This is a SUGGESTION, never a claim of certainty — the copy says "Looks like", and a candidate is
// only ever a prompt to the user, who decides. Pure function: no engine, no store, no mutation, no
// React. Money stays in integer minor units (pence).

import type { LocalLedgerTransaction } from './localLedger';

// The candidate the SubCaught sheet renders. Field names mirror the Lovable prototype's Candidate
// ({ name, amount, seen, lastDate, category }) but in the RN engine's vocabulary: money in minor
// units, and the date pre-formatted as the short label the sheet shows ("Last: 12 Jun").
export type RecurringChargeCandidate = Readonly<{
  name: string;
  amountMinor: number;
  // How many times this merchant has been seen charging (the "Seen N months in a row" line).
  seen: number;
  // The short, human label of the most recent charge's date, e.g. "12 Jun".
  lastDateLabel: string;
  category: string;
}>;

// Only an object with a name is needed to exclude an already-tracked subscription — kept structural
// so the caller can pass the domain Subscription array (or anything name-bearing) without coupling.
type NamedSubscription = Readonly<{ name: string }>;

// Tuning constants for "looks like a monthly charge". Deliberately conservative: better to stay
// quiet than to wrongly flag a one-off.
const MIN_OCCURRENCES = 3; // a merchant must be seen at least this many times
const AMOUNT_TOLERANCE = 0.1; // amounts must be within ±10% of the group's typical charge
const MIN_MONTHLY_GAP_DAYS = 25; // roughly-monthly spacing: lower bound between charges
const MAX_MONTHLY_GAP_DAYS = 35; // ...and upper bound
const MS_PER_DAY = 86_400_000;

/**
 * Find the single strongest likely-recurring charge among the user's confirmed spends, or null.
 *
 * Heuristic: group confirmed SPEND transactions (negative amounts) by normalized merchant title; a
 * candidate is a merchant seen >= MIN_OCCURRENCES times with similar amounts (within ±10% of the
 * group median) at roughly-monthly spacing (every charge-to-charge gap ~25–35 days), and NOT already
 * present in existingSubscriptions (matched by normalized name). Of all qualifying merchants, the
 * one with the most-recent latest charge wins; ties break toward the more-frequently-seen merchant.
 */
export function detectRecurringChargeCandidate(
  transactions: readonly LocalLedgerTransaction[],
  existingSubscriptions: readonly NamedSubscription[],
): RecurringChargeCandidate | null {
  const subscribedNames = new Set(
    existingSubscriptions.map((subscription) => normalizeMerchant(subscription.name)),
  );

  const groups = groupConfirmedSpendsByMerchant(transactions);
  let best: RecurringChargeCandidate | null = null;
  let bestLatestDate = '';
  let bestSeen = 0;

  for (const group of groups.values()) {
    if (subscribedNames.has(group.key)) continue;
    const candidate = candidateFromGroup(group);
    if (candidate === null) continue;

    // Prefer the most-recent strongest candidate; on equal recency, prefer the one seen more often.
    const latestDate = group.latestDate;
    if (
      best === null ||
      latestDate > bestLatestDate ||
      (latestDate === bestLatestDate && candidate.seen > bestSeen)
    ) {
      best = candidate;
      bestLatestDate = latestDate;
      bestSeen = candidate.seen;
    }
  }

  return best;
}

type MerchantGroup = Readonly<{
  key: string;
  displayName: string;
  // Each occurrence's absolute charge in minor units and its ISO date, kept in chronological order.
  charges: readonly Readonly<{ amountMinor: number; date: string }>[];
  latestDate: string;
}>;

function groupConfirmedSpendsByMerchant(
  transactions: readonly LocalLedgerTransaction[],
): Map<string, MerchantGroup> {
  const buckets = new Map<
    string,
    { key: string; displayName: string; charges: { amountMinor: number; date: string }[] }
  >();

  for (const transaction of transactions) {
    // Only the user's confirmed real spends count — needs-review rows and incomes are ignored.
    if (transaction.status !== 'confirmed') continue;
    if (transaction.amountMinor >= 0) continue;
    const key = normalizeMerchant(transaction.title);
    if (key.length === 0) continue;
    const bucket = buckets.get(key);
    const charge = { amountMinor: Math.abs(transaction.amountMinor), date: transaction.date };
    if (bucket === undefined) {
      buckets.set(key, { key, displayName: transaction.title.trim(), charges: [charge] });
    } else {
      bucket.charges.push(charge);
    }
  }

  const groups = new Map<string, MerchantGroup>();
  for (const bucket of buckets.values()) {
    const charges = [...bucket.charges].sort((left, right) => left.date.localeCompare(right.date));
    groups.set(bucket.key, {
      key: bucket.key,
      displayName: bucket.displayName,
      charges,
      latestDate: charges[charges.length - 1]?.date ?? '',
    });
  }
  return groups;
}

function candidateFromGroup(group: MerchantGroup): RecurringChargeCandidate | null {
  const charges = group.charges;
  if (charges.length < MIN_OCCURRENCES) return null;

  // Similar amounts: every charge within ±10% of the group's median charge.
  const median = medianMinor(charges.map((charge) => charge.amountMinor));
  if (median <= 0) return null;
  const amountsSimilar = charges.every(
    (charge) => Math.abs(charge.amountMinor - median) <= median * AMOUNT_TOLERANCE,
  );
  if (!amountsSimilar) return null;

  // Roughly-monthly spacing: every consecutive charge-to-charge gap sits in [25, 35] days.
  for (let index = 1; index < charges.length; index += 1) {
    const previous = charges[index - 1];
    const current = charges[index];
    if (previous === undefined || current === undefined) return null;
    const gap = isoDaysBetween(previous.date, current.date);
    if (gap < MIN_MONTHLY_GAP_DAYS || gap > MAX_MONTHLY_GAP_DAYS) return null;
  }

  const latest = charges[charges.length - 1];
  if (latest === undefined) return null;

  return {
    name: group.displayName,
    amountMinor: median,
    seen: charges.length,
    lastDateLabel: shortDateLabel(latest.date),
    category: 'other',
  };
}

function normalizeMerchant(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function medianMinor(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  const lower = sorted[middle - 1] ?? 0;
  const upper = sorted[middle] ?? 0;
  return Math.round((lower + upper) / 2);
}

function isoDaysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.POSITIVE_INFINITY;
  return Math.round((to - from) / MS_PER_DAY);
}

function shortDateLabel(iso: string): string {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
