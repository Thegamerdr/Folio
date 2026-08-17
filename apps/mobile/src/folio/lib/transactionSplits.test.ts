import { describe, expect, it } from 'vitest';

import { normaliseTransactionSplits, transactionSplitsAuditValue } from './transactionSplits';

describe('transaction splits', () => {
  it('accepts exact, same-direction parts and produces a stable audit value', () => {
    const result = normaliseTransactionSplits(-42, [
      { id: 'food', label: 'Groceries', amount: -30, category: 'food' },
      { id: 'home', label: 'Household', amount: -12, category: 'shopping' },
    ]);
    expect(result).toEqual([
      { id: 'food', label: 'Groceries', amount: -30, category: 'food' },
      { id: 'home', label: 'Household', amount: -12, category: 'shopping' },
    ]);
    expect(transactionSplitsAuditValue(result)).toBe(
      'Groceries: -30.00 (food) | Household: -12.00 (shopping)',
    );
  });

  it('rejects mismatched totals, mixed directions, sub-penny values and duplicate IDs', () => {
    expect(() =>
      normaliseTransactionSplits(-42, [
        { id: 'a', label: 'A', amount: -30, category: 'food' },
        { id: 'b', label: 'B', amount: -11, category: 'other' },
      ]),
    ).toThrow('add up exactly');
    expect(() =>
      normaliseTransactionSplits(-42, [
        { id: 'a', label: 'A', amount: -43, category: 'food' },
        { id: 'b', label: 'B', amount: 1, category: 'other' },
      ]),
    ).toThrow('keep the transaction direction');
    expect(() =>
      normaliseTransactionSplits(-42, [
        { id: 'a', label: 'A', amount: -20.001, category: 'food' },
        { id: 'b', label: 'B', amount: -21.999, category: 'other' },
      ]),
    ).toThrow('fractions smaller than one penny');
    expect(() =>
      normaliseTransactionSplits(-42, [
        { id: 'same', label: 'A', amount: -20, category: 'food' },
        { id: 'same', label: 'B', amount: -22, category: 'other' },
      ]),
    ).toThrow('unique ID');
  });
});
