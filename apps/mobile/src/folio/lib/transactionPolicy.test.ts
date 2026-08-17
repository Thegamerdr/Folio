import { describe, expect, it } from 'vitest';

import {
  isAnalyticsIncomeTransaction,
  isCashEffectiveTransaction,
  mergeProviderTransaction,
  transactionAnalyticsRows,
  transactionLifecycleStatusOf,
  type TransactionPolicyInput,
} from './transactionPolicy';

type Row = TransactionPolicyInput & { merchant: string };

function row(input: Partial<Row> & Pick<Row, 'id' | 'amount'>): Row {
  return { when: '2026-08-01T00:00:00.000Z', merchant: input.id, ...input };
}

describe('transaction lifecycle policy', () => {
  it('treats legacy rows as posted while pending/reversed/void do not become actuals', () => {
    expect(transactionLifecycleStatusOf(row({ id: 'legacy', amount: -10 }))).toBe('posted');
    expect(
      isCashEffectiveTransaction(row({ id: 'pending', amount: -10, lifecycleStatus: 'pending' })),
    ).toBe(false);
    expect(
      isCashEffectiveTransaction(row({ id: 'reversed', amount: -10, lifecycleStatus: 'reversed' })),
    ).toBe(false);
    expect(
      isCashEffectiveTransaction(row({ id: 'void', amount: -10, lifecycleStatus: 'void' })),
    ).toBe(false);
  });

  it('excludes own transfers and linked refunds from income while netting refunds against spend', () => {
    const rows = [
      row({ id: 'spend', amount: -100 }),
      row({ id: 'refund', amount: 30, moneyMovementKind: 'refund', refundOfId: 'spend' }),
      row({
        id: 'transfer-out',
        amount: -200,
        moneyMovementKind: 'transfer',
        transferLinkId: 'move-1',
      }),
      row({
        id: 'transfer-in',
        amount: 200,
        moneyMovementKind: 'transfer',
        transferLinkId: 'move-1',
      }),
      row({ id: 'pay', amount: 1_000 }),
    ];

    expect(transactionAnalyticsRows(rows).map(({ id, amount }) => ({ id, amount }))).toEqual([
      { id: 'spend', amount: -70 },
      { id: 'pay', amount: 1_000 },
    ]);
    expect(isAnalyticsIncomeTransaction(rows[1]!)).toBe(false);
    expect(isAnalyticsIncomeTransaction(rows[4]!)).toBe(true);
  });

  it('keeps an unlinked refund out of inferred income until the original is identified', () => {
    const refund = row({
      id: 'unlinked-refund',
      amount: 25,
      moneyMovementKind: 'refund',
    });

    expect(isAnalyticsIncomeTransaction(refund)).toBe(false);
    expect(transactionAnalyticsRows([refund])).toEqual([]);
  });

  it('nets a full reversal without erasing the auditable rows', () => {
    const rows = [
      row({ id: 'original', amount: -42 }),
      row({ id: 'reversal', amount: 42, reversalOfId: 'original' }),
    ];
    expect(transactionAnalyticsRows(rows)).toEqual([]);
    expect(rows).toHaveLength(2);
  });

  it('advances pending to posted but protects a newer manual correction from stale provider detail', () => {
    const corrected = row({
      id: 'bank-row',
      amount: -12,
      merchant: 'Corrected shop',
      lifecycleStatus: 'pending',
      manuallyCorrectedAt: '2026-08-10T12:00:00.000Z',
    });
    const merged = mergeProviderTransaction(corrected, {
      lifecycleStatus: 'posted',
      providerUpdatedAt: '2026-08-09T12:00:00.000Z',
      when: '2026-08-02T00:00:00.000Z',
      amount: -13,
      merchant: 'Provider shop',
    });

    expect(merged).toMatchObject({
      lifecycleStatus: 'posted',
      amount: -12,
      merchant: 'Corrected shop',
      providerUpdatedAt: '2026-08-09T12:00:00.000Z',
    });
  });

  it('accepts newer provider detail after an older manual correction', () => {
    const corrected = row({
      id: 'bank-row',
      amount: -12,
      merchant: 'Earlier correction',
      lifecycleStatus: 'pending',
      manuallyCorrectedAt: '2026-08-09T12:00:00.000Z',
    });
    const merged = mergeProviderTransaction(corrected, {
      lifecycleStatus: 'posted',
      providerUpdatedAt: '2026-08-10T12:00:00.000Z',
      when: '2026-08-02T00:00:00.000Z',
      amount: -13,
      merchant: 'Final provider name',
    });

    expect(merged).toMatchObject({
      lifecycleStatus: 'posted',
      amount: -13,
      merchant: 'Final provider name',
    });
  });
});
