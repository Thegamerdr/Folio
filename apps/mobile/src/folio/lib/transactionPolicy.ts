export type TransactionLifecycleStatus = 'pending' | 'posted' | 'reversed' | 'void';

export type TransactionLifecycleReason =
  | 'declined'
  | 'duplicate'
  | 'user-voided'
  | 'provider-expired'
  | 'other';

export type TransactionMoneyMovementKind = 'ordinary' | 'transfer' | 'refund';

/** Structural shape keeps this policy independent of the singleton Folio store. */
export type TransactionPolicyInput = Readonly<{
  id: string;
  when: string;
  amount: number;
  accountId?: string;
  lifecycleStatus?: TransactionLifecycleStatus;
  lifecycleReason?: TransactionLifecycleReason;
  moneyMovementKind?: TransactionMoneyMovementKind;
  transferLinkId?: string;
  refundOfId?: string;
  reversalOfId?: string;
  duplicateOfId?: string;
  manuallyCorrectedAt?: string;
  providerUpdatedAt?: string;
}>;

export function transactionLifecycleStatusOf(
  transaction: Pick<TransactionPolicyInput, 'lifecycleStatus'>,
): TransactionLifecycleStatus {
  return transaction.lifecycleStatus ?? 'posted';
}

/** Only posted facts affect realised balances and historical actuals. */
export function isCashEffectiveTransaction(
  transaction: Pick<TransactionPolicyInput, 'lifecycleStatus'>,
): boolean {
  return transactionLifecycleStatusOf(transaction) === 'posted';
}

export function isPendingTransaction(
  transaction: Pick<TransactionPolicyInput, 'lifecycleStatus'>,
): boolean {
  return transactionLifecycleStatusOf(transaction) === 'pending';
}

export function isOwnAccountTransfer(
  transaction: Pick<TransactionPolicyInput, 'moneyMovementKind' | 'transferLinkId'>,
): boolean {
  return transaction.moneyMovementKind === 'transfer' && Boolean(transaction.transferLinkId);
}

export function isLinkedRefund(
  transaction: Pick<TransactionPolicyInput, 'moneyMovementKind' | 'refundOfId'>,
): boolean {
  return transaction.moneyMovementKind === 'refund' && Boolean(transaction.refundOfId);
}

export function isAnalyticsIncomeTransaction(transaction: TransactionPolicyInput): boolean {
  return (
    isCashEffectiveTransaction(transaction) &&
    transaction.amount > 0 &&
    !isOwnAccountTransfer(transaction) &&
    transaction.moneyMovementKind !== 'refund' &&
    transaction.reversalOfId === undefined
  );
}

/**
 * Realised rows for income/spend analytics. Transfers disappear; linked refunds and reversals
 * adjust the original row on the original date, so a late refund does not become income or make the
 * refund month look artificially cheap. The returned rows retain the caller's shape.
 */
export function transactionAnalyticsRows<T extends TransactionPolicyInput>(
  transactions: readonly T[],
): T[] {
  const posted = transactions.filter(isCashEffectiveTransaction);
  const byId = new Map(posted.map((transaction) => [transaction.id, transaction]));
  const offsets = new Map<string, number>();
  const linkedRowIds = new Set<string>();

  for (const transaction of posted) {
    if (isOwnAccountTransfer(transaction)) continue;
    const targetId = transaction.refundOfId ?? transaction.reversalOfId;
    if (targetId === undefined || !byId.has(targetId)) continue;
    offsets.set(targetId, (offsets.get(targetId) ?? 0) + transaction.amount);
    linkedRowIds.add(transaction.id);
  }

  return posted.flatMap((transaction) => {
    if (
      isOwnAccountTransfer(transaction) ||
      linkedRowIds.has(transaction.id) ||
      (transaction.moneyMovementKind === 'refund' && transaction.refundOfId === undefined)
    ) {
      return [];
    }
    const offset = offsets.get(transaction.id) ?? 0;
    if (offset === 0) return [transaction];
    const adjusted = transaction.amount + offset;
    // A provider anomaly must not turn a refunded debit into income (or vice versa).
    const bounded =
      transaction.amount < 0
        ? Math.min(0, adjusted)
        : transaction.amount > 0
          ? Math.max(0, adjusted)
          : 0;
    if (bounded === 0) return [];
    // A linked partial refund changes the realised parent amount, but there is no truthful basis for
    // guessing which user-authored split absorbed it. Do not expose a stale split total on the
    // analytics projection; the immutable source transaction still retains the original breakdown.
    const { splits: _sourceSplits, ...withoutSplits } = transaction as T & {
      splits?: unknown;
    };
    return [{ ...withoutSplits, amount: bounded } as T];
  });
}

export type ProviderTransactionUpdate = Readonly<{
  lifecycleStatus: 'pending' | 'posted';
  providerUpdatedAt: string;
  when: string;
  amount: number;
  merchant: string;
  accountId?: string;
}>;

/**
 * Reconciles a stable provider row without allowing stale provider detail to overwrite a newer user
 * correction. A posted fact never regresses to pending; lifecycle can still advance independently
 * of editable merchant/amount/date fields.
 */
export function mergeProviderTransaction<
  T extends TransactionPolicyInput & {
    merchant: string;
  },
>(existing: T, update: ProviderTransactionUpdate): T {
  const existingStatus = transactionLifecycleStatusOf(existing);
  const lifecycleStatus =
    existingStatus === 'posted' || update.lifecycleStatus === 'posted' ? 'posted' : 'pending';
  const manualTime = parseInstant(existing.manuallyCorrectedAt);
  const providerTime = parseInstant(update.providerUpdatedAt);
  const providerMayReplaceDetails =
    manualTime === null || (providerTime !== null && providerTime > manualTime);

  return {
    ...existing,
    ...(providerMayReplaceDetails
      ? {
          when: update.when,
          amount: update.amount,
          merchant: update.merchant,
          ...(update.accountId === undefined ? {} : { accountId: update.accountId }),
        }
      : {}),
    lifecycleStatus,
    lifecycleChangedAt:
      lifecycleStatus === existingStatus
        ? (existing as T & { lifecycleChangedAt?: string }).lifecycleChangedAt
        : update.providerUpdatedAt,
    providerUpdatedAt: update.providerUpdatedAt,
  } as T;
}

function parseInstant(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
