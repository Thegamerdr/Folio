export type TransactionSplitCategory =
  | 'food'
  | 'transport'
  | 'fun'
  | 'bills'
  | 'shopping'
  | 'income'
  | 'other';

export type TransactionSplit = Readonly<{
  id: string;
  label: string;
  amount: number;
  category: TransactionSplitCategory;
}>;

function toMinor(amount: number): number {
  if (!Number.isFinite(amount)) throw new Error('Split amounts must be finite.');
  const minor = Math.round(amount * 100);
  if (Math.abs(amount * 100 - minor) > 0.000_001) {
    throw new Error('Split amounts cannot use fractions smaller than one penny.');
  }
  return minor;
}

export function normaliseTransactionSplits(
  parentAmount: number,
  splits: readonly TransactionSplit[],
): readonly TransactionSplit[] {
  if (splits.length === 0) return [];
  if (splits.length < 2) throw new Error('A split transaction needs at least two parts.');
  const parentMinor = toMinor(parentAmount);
  if (parentMinor === 0) throw new Error('A zero-value transaction cannot be split.');
  const seenIds = new Set<string>();
  const normalised = splits.map((split, index) => {
    const id = split.id.trim();
    const label = split.label.trim();
    if (!id || seenIds.has(id)) throw new Error('Every split needs a unique ID.');
    if (!label) throw new Error('Every split needs a label.');
    seenIds.add(id);
    const amountMinor = toMinor(split.amount);
    if (amountMinor === 0 || Math.sign(amountMinor) !== Math.sign(parentMinor)) {
      throw new Error('Every split must keep the transaction direction and be greater than zero.');
    }
    return {
      id,
      label,
      amount: amountMinor / 100,
      category: split.category,
      order: index,
    };
  });
  const totalMinor = normalised.reduce((total, split) => total + toMinor(split.amount), 0);
  if (totalMinor !== parentMinor) {
    throw new Error('Split parts must add up exactly to the transaction amount.');
  }
  return normalised.map(({ order: _order, ...split }) => split);
}

export function transactionSplitsAuditValue(splits: readonly TransactionSplit[]): string {
  if (splits.length === 0) return 'Not split';
  return splits
    .map((split) => `${split.label}: ${split.amount.toFixed(2)} (${split.category})`)
    .join(' | ');
}
