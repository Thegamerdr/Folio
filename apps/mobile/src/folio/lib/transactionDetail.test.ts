import { describe, expect, it } from 'vitest';
import { createWorkspaceId } from '@folio/domain';

import type { Transaction } from '../store';
import {
  outstandingRefundAmount,
  ownTransferCandidates,
  relatedTransactions,
} from './transactionDetail';

const base: Transaction = {
  id: 'purchase',
  merchant: 'Market',
  amount: -100,
  when: '2026-08-01',
  category: 'food',
  source: 'manual',
  accountId: 'current',
  workspaceId: createWorkspaceId('workspace_personal'),
};

describe('transaction detail truth', () => {
  it('calculates the remaining refundable amount from posted linked refunds only', () => {
    expect(
      outstandingRefundAmount(base, [
        base,
        { ...base, id: 'refund', amount: 30, refundOfId: base.id, lifecycleStatus: 'posted' },
        { ...base, id: 'pending', amount: 20, refundOfId: base.id, lifecycleStatus: 'pending' },
      ]),
    ).toBe(70);
  });

  it('offers only an equal opposite posted leg in another account and workspace', () => {
    const match = { ...base, id: 'credit', amount: 100, accountId: 'savings' };
    expect(
      ownTransferCandidates(base, [
        base,
        match,
        { ...match, id: 'same-account', accountId: 'current' },
        {
          ...match,
          id: 'wrong-workspace',
          workspaceId: createWorkspaceId('workspace_business'),
        },
        { ...match, id: 'pending', lifecycleStatus: 'pending' },
      ]).map((candidate) => candidate.id),
    ).toEqual(['credit']);
  });

  it('describes refunds, reversals and the other transfer leg without duplication', () => {
    const transfer = { ...base, transferLinkId: 'move-1' };
    expect(
      relatedTransactions(transfer, [
        transfer,
        { ...base, id: 'other-leg', amount: 100, accountId: 'savings', transferLinkId: 'move-1' },
        { ...base, id: 'refund', amount: 20, refundOfId: transfer.id },
        { ...base, id: 'reversal', amount: 100, reversalOfId: transfer.id },
      ]).map(({ relation }) => relation),
    ).toEqual(['Other transfer leg', 'Refund', 'Reversal']);
  });
});
