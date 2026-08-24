import type { PotLedgerEntry, Sub } from '@/folio/store';

/**
 * Commitment copy stays close to the native money objects. These helpers describe payment facts and
 * balances only; they do not infer whether a service is useful or whether a pot is "good" progress.
 */
export function formatAvailableAfterSetAside(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '−' : '';
  return `${sign}£${Math.abs(rounded).toLocaleString('en-GB')}`;
}

export function subscriptionCadence(sub: Pick<Sub, 'renewalPeriodDays'>): string {
  switch (sub.renewalPeriodDays) {
    case 7:
      return 'Repeats weekly';
    case 14:
      return 'Repeats fortnightly';
    case 365:
      return 'Repeats yearly';
    default:
      return 'Repeats monthly';
  }
}

export function subscriptionStatusLine(
  sub: Pick<Sub, 'renewalPeriodDays' | 'cost'>,
  paused: boolean,
): string {
  if (paused) return `Paused · £${sub.cost.toFixed(2)} back this month`;
  return subscriptionCadence(sub);
}

/** Annualised payment cost from the stored renewal period. This is a payment projection, not a
 * usage or value judgement. Legacy rows without a period retain the monthly convention. */
export function subscriptionAnnualCost(sub: Pick<Sub, 'renewalPeriodDays' | 'cost'>): number {
  switch (sub.renewalPeriodDays) {
    case 7:
      return sub.cost * 52;
    case 14:
      return sub.cost * 26;
    case 365:
      return sub.cost;
    default:
      return sub.cost * 12;
  }
}

/** Confidence in the next charge's date anchor. The store only guarantees an exact date when the
 * durable ISO anchor exists; otherwise the day count is an estimate retained for compatibility. */
export function subscriptionConfidence(
  sub: Pick<Sub, 'nextRenewalISO'>,
): 'date anchored' | 'estimated' {
  return sub.nextRenewalISO ? 'date anchored' : 'estimated';
}

export type PotLedgerSummary = {
  contributed: number;
  borrowed: number;
  repaid: number;
  withdrawn: number;
  /** Signed impact on available cash: deposits reduce available; borrows/withdrawals restore it. */
  availableEffect: number;
};

/** Canonical pot-ledger accounting. Repayment clears an owed marker but does not move saved cash,
 * matching `repayToPot`; it therefore has no available-cash effect. */
export function summarisePotLedger(
  entries: readonly PotLedgerEntry[],
  potIds?: ReadonlySet<string>,
): PotLedgerSummary {
  const summary: PotLedgerSummary = {
    contributed: 0,
    borrowed: 0,
    repaid: 0,
    withdrawn: 0,
    availableEffect: 0,
  };
  for (const entry of entries) {
    if (potIds && !potIds.has(entry.potId)) continue;
    const amount = Math.max(0, entry.amount);
    if (entry.kind === 'deposit') {
      summary.contributed += amount;
      summary.availableEffect -= amount;
    } else if (entry.kind === 'borrow') {
      summary.borrowed += amount;
      summary.availableEffect += amount;
    } else if (entry.kind === 'repay') {
      summary.repaid += amount;
    } else if (entry.kind === 'withdraw') {
      summary.withdrawn += amount;
      summary.availableEffect += amount;
    }
  }
  return summary;
}
