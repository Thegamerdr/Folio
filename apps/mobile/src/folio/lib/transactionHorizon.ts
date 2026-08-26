import type { Transaction } from '../store';

function cutoffIso(todayIso: string, months: number): string {
  const year = Number(todayIso.slice(0, 4));
  const monthIndex = Number(todayIso.slice(5, 7)) - 1;
  return new Date(Date.UTC(year, monthIndex - months, 1)).toISOString().slice(0, 10);
}

/** Recent-history projection for baselines and recurring-signal detection. The complete ledger is
 * retained. A canonical newest-first ledger stops at the cutoff; unsorted fixture input safely
 * falls back to a full linear filter. */
export function recentTransactionHorizon(
  transactions: readonly Transaction[],
  todayIso: string,
  months = 24,
): Transaction[] {
  if (transactions.length === 0) return [];
  const cutoff = cutoffIso(todayIso, months);
  const newestFirst = transactions.length < 2 || transactions[0]!.when >= transactions.at(-1)!.when;
  if (!newestFirst)
    return transactions.filter((transaction) => transaction.when.slice(0, 10) >= cutoff);
  let end = 0;
  while (end < transactions.length && transactions[end]!.when.slice(0, 10) >= cutoff) end += 1;
  return transactions.slice(0, end);
}
