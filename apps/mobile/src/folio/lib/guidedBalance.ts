import type { CurrentBalance } from '../store';

/** A first check-in starts at zero; only an existing real balance may prefill it. */
export function guidedBalanceDraft(balance: Pick<CurrentBalance, 'source' | 'amount'>): string {
  return balance.source === 'sample' || !Number.isFinite(balance.amount)
    ? '0'
    : String(Math.max(0, Math.round(balance.amount)));
}
