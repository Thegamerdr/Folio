import type { CurrentBalance } from '../store';

/** Fresh check-ins require an entry; confirmed real balances may prefill the field. */
export function guidedBalanceDraft(
  balance: Pick<CurrentBalance, 'source' | 'amount'>,
  setupConfirmed = false,
): string {
  return balance.source === 'sample' ||
    !Number.isFinite(balance.amount) ||
    (!setupConfirmed && balance.amount === 0)
    ? ''
    : String(Math.max(0, Math.round(balance.amount * 100) / 100));
}
