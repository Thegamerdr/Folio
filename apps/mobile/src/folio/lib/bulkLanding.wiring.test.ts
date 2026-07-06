// Bulk-landing WIRING contract — the store-level sequence `BulkStatementLanding.tsx` composes on
// "Add all as history" (bulkLanding.ts owns the pure decision math; this pins the composition
// against the REAL store, since the screen itself is a .tsx the Node vitest runner never collects
// — see VisualizerScreen.addAll.test.ts for the identical split-testing rationale).
//
// Pins three load-bearing promises (task: BULK ADD-AS-HISTORY):
//   1. A multi-candidate read is routed to bulk (`isBulkStatement`); a single candidate is not.
//   2. The bulk CTA's ONE write (`addStatementAsHistory`) actually lands every candidate and
//      returns the offers `BulkStatementLanding` sequences.
//   3. The two offers gate correctly: closing-balance only when the reader supplied one, income
//      only when a real signal exists and hasn't already been declared/dismissed.

import { beforeEach, describe, expect, it } from 'vitest';

import { isBulkStatement, nextBulkLandingOffer } from './bulkLanding';
import type { CandidateMoneyItem } from './importSheet';
import { addStatementAsHistory, getState, resetToEmpty } from '../store';

beforeEach(() => {
  // Clean-empty so the offer gating below is never polluted by seed transactions/income/debts.
  resetToEmpty();
});

describe('isBulkStatement routing', () => {
  it('routes a multi-candidate read to bulk', () => {
    expect(isBulkStatement(2)).toBe(true);
  });

  it('does not route a single-candidate read to bulk', () => {
    expect(isBulkStatement(1)).toBe(false);
    expect(isBulkStatement(0)).toBe(false);
  });
});

describe('bulk CTA -> addStatementAsHistory', () => {
  it('lands every candidate as a posted transaction in one call', () => {
    const candidates: CandidateMoneyItem[] = [
      {
        id: 'r1',
        source: 'pdf',
        kind: 'spend',
        merchant: 'Tesco',
        amount: -42,
        date: '2026-06-10',
        confidence: 'high',
      },
      {
        id: 'r2',
        source: 'pdf',
        kind: 'income',
        merchant: 'Salary — Whitstone Ltd',
        amount: 2180,
        date: '2026-06-25',
        confidence: 'high',
      },
      {
        id: 'r3',
        source: 'pdf',
        kind: 'bill',
        merchant: 'Octopus Energy',
        amount: -118,
        date: '2026-06-15',
        confidence: 'high',
      },
    ];

    const txnsBefore = getState().transactions.length;
    const summary = addStatementAsHistory(candidates);

    expect(summary.added).toBe(3);
    expect(summary.totalInPence).toBe(218000);
    expect(summary.totalOutPence).toBe(16000);

    const after = getState();
    expect(after.transactions.length).toBe(txnsBefore + 3);
    for (const c of candidates) {
      const posted = after.transactions.find((t) => t.merchant === c.merchant);
      expect(posted).toBeDefined();
      expect(posted?.amount).toBe(c.amount);
    }
  });

  it('is a no-op-safe zeroed summary on an empty batch', () => {
    const txnsBefore = getState().transactions.length;
    const summary = addStatementAsHistory([]);
    expect(summary.added).toBe(0);
    expect(summary.incomeSignal).toBeUndefined();
    expect(summary.closingBalanceOffer).toBeUndefined();
    expect(getState().transactions.length).toBe(txnsBefore);
  });
});

describe('post-import offer gating', () => {
  it('offers a closing balance only when the reader supplied one', () => {
    const candidates: CandidateMoneyItem[] = [
      { id: 'a', source: 'pdf', kind: 'spend', merchant: 'Tesco', amount: -10, confidence: 'high' },
      { id: 'b', source: 'pdf', kind: 'spend', merchant: 'Boots', amount: -5, confidence: 'high' },
    ];

    const withoutBalance = addStatementAsHistory(candidates);
    expect(withoutBalance.closingBalanceOffer).toBeUndefined();
    expect(nextBulkLandingOffer(withoutBalance, new Set())).not.toBe('closing-balance');

    resetToEmpty();
    const withBalance = addStatementAsHistory(candidates, {
      amount: 196,
      asOfISO: '2026-06-30',
    });
    expect(withBalance.closingBalanceOffer).toEqual({
      amountPence: 19600,
      asOfISO: '2026-06-30',
      accountId: 'acct-main',
    });
    expect(nextBulkLandingOffer(withBalance, new Set())).toBe('closing-balance');
  });

  it('offers income only when a real unmatched signal is detected over the landed ledger', () => {
    // A single spend batch with no recurring-credit pattern — no income signal to offer.
    const spendOnly: CandidateMoneyItem[] = [
      { id: 'a', source: 'pdf', kind: 'spend', merchant: 'Tesco', amount: -10, confidence: 'high' },
      { id: 'b', source: 'pdf', kind: 'spend', merchant: 'Boots', amount: -5, confidence: 'high' },
    ];
    const noSignal = addStatementAsHistory(spendOnly);
    expect(noSignal.incomeSignal).toBeUndefined();
    expect(nextBulkLandingOffer(noSignal, new Set())).toBeNull();
  });

  it('walks closing-balance before income, then falls to null once both are shown', () => {
    const summary = {
      added: 1,
      dateRange: null,
      totalInPence: 0,
      totalOutPence: 0,
      incomeSignal: {
        merchant: 'Acme',
        cadence: 'monthly' as const,
        medianAmount: 1000,
        occurrences: 3,
        lastSeenISO: '2026-06-01',
        anchorISO: '2026-06-01',
        confidence: 'strong' as const,
      },
      closingBalanceOffer: { amountPence: 1000, asOfISO: '2026-06-01' },
    };
    expect(nextBulkLandingOffer(summary, new Set())).toBe('closing-balance');
    expect(nextBulkLandingOffer(summary, new Set(['closing-balance']))).toBe('income');
    expect(nextBulkLandingOffer(summary, new Set(['closing-balance', 'income']))).toBeNull();
  });
});
