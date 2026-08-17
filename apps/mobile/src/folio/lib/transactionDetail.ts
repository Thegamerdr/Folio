import { accountIdOf, type Transaction } from '../store';
import { isCashEffectiveTransaction } from './transactionPolicy';

export function outstandingRefundAmount(
  transaction: Transaction,
  transactions: readonly Transaction[],
): number {
  if (transaction.amount >= 0 || !isCashEffectiveTransaction(transaction)) return 0;
  const refunded = transactions
    .filter(
      (candidate) =>
        candidate.refundOfId === transaction.id && isCashEffectiveTransaction(candidate),
    )
    .reduce((sum, candidate) => sum + Math.max(0, candidate.amount), 0);
  return Math.max(0, Math.round((Math.abs(transaction.amount) - refunded) * 100) / 100);
}

export function ownTransferCandidates(
  transaction: Transaction,
  transactions: readonly Transaction[],
): readonly Transaction[] {
  if (!isCashEffectiveTransaction(transaction) || transaction.transferLinkId !== undefined)
    return [];
  return transactions.filter(
    (candidate) =>
      candidate.id !== transaction.id &&
      isCashEffectiveTransaction(candidate) &&
      candidate.transferLinkId === undefined &&
      candidate.refundOfId === undefined &&
      candidate.reversalOfId === undefined &&
      candidate.workspaceId === transaction.workspaceId &&
      accountIdOf(candidate) !== accountIdOf(transaction) &&
      Math.abs(candidate.amount + transaction.amount) < 0.000_001,
  );
}

export function relatedTransactions(
  transaction: Transaction,
  transactions: readonly Transaction[],
): readonly Readonly<{ relation: string; transaction: Transaction }>[] {
  const directIds = new Map<string, string>([
    ...(transaction.refundOfId ? [[transaction.refundOfId, 'Original payment'] as const] : []),
    ...(transaction.reversalOfId ? [[transaction.reversalOfId, 'Original record'] as const] : []),
    ...(transaction.duplicateOfId ? [[transaction.duplicateOfId, 'Original record'] as const] : []),
    ...(transaction.replacesId ? [[transaction.replacesId, 'Replaced record'] as const] : []),
    ...(transaction.replacedById
      ? [[transaction.replacedById, 'Replacement record'] as const]
      : []),
  ]);
  const seen = new Set<string>();
  const result: Array<Readonly<{ relation: string; transaction: Transaction }>> = [];
  for (const candidate of transactions) {
    if (candidate.id === transaction.id || seen.has(candidate.id)) continue;
    let relation = directIds.get(candidate.id);
    if (candidate.refundOfId === transaction.id) relation = 'Refund';
    else if (candidate.reversalOfId === transaction.id) relation = 'Reversal';
    else if (candidate.duplicateOfId === transaction.id) relation = 'Marked duplicate';
    else if (candidate.replacesId === transaction.id) relation = 'Replacement';
    else if (candidate.replacedById === transaction.id) relation = 'Replaced record';
    else if (
      transaction.transferLinkId !== undefined &&
      candidate.transferLinkId === transaction.transferLinkId
    ) {
      relation = 'Other transfer leg';
    }
    if (relation === undefined) continue;
    seen.add(candidate.id);
    result.push({ relation, transaction: candidate });
  }
  return result;
}
