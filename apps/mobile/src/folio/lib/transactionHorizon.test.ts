import { describe, expect, it } from 'vitest';

import type { Transaction } from '../store';
import { recentTransactionHorizon } from './transactionHorizon';

function row(id: string, day: string): Transaction {
  return {
    id,
    when: `${day}T00:00:00.000Z`,
    merchant: id,
    amount: -1,
    category: 'other',
    source: 'manual',
  };
}

describe('recentTransactionHorizon', () => {
  it('returns the recent prefix from a newest-first canonical ledger', () => {
    const rows = [row('new', '2026-08-01'), row('mid', '2025-01-01'), row('old', '2020-01-01')];
    expect(recentTransactionHorizon(rows, '2026-08-26', 24).map((item) => item.id)).toEqual([
      'new',
      'mid',
    ]);
  });

  it('remains correct for unsorted fixture input', () => {
    const rows = [row('old', '2020-01-01'), row('new', '2026-08-01'), row('mid', '2025-01-01')];
    expect(recentTransactionHorizon(rows, '2026-08-26', 24).map((item) => item.id)).toEqual([
      'new',
      'mid',
    ]);
  });
});
