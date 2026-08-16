import { describe, it, expect } from 'vitest';

import type { CandidateMoneyItem } from './importSheet';
import { reconcileStatement } from './reconcileStatement';

/** Minimal valid candidate — reconcileStatement only reads `amount` (signed pounds). */
function cand(amount: number): CandidateMoneyItem {
  return {
    id: `c-${amount}`,
    source: 'pdf',
    kind: amount >= 0 ? 'income' : 'spend',
    merchant: 'Row',
    amount,
    confidence: 'low',
    note: 'test',
  };
}

describe('reconcileStatement', () => {
  it('OK — extracted rows explain the opening→closing balance movement', () => {
    const result = reconcileStatement([cand(3000), cand(-1000)], {
      openingPounds: 2500,
      closingPounds: 4500, // 2500 + 3000 − 1000
    });
    expect(result.status).toBe('ok');
    expect(result.failedChecks).toBe(0);
  });

  it('OK — extracted totals match the statement’s own stated totals', () => {
    const result = reconcileStatement([cand(3000), cand(-1000)], {
      openingPounds: 2500,
      closingPounds: 4500,
      statedTotalCreditsPounds: 3000,
      statedTotalDebitsPounds: 1000,
    });
    expect(result.status).toBe('ok');
  });

  it('MISMATCH — rows do not add up to the closing balance', () => {
    const result = reconcileStatement([cand(3000), cand(-1000)], {
      openingPounds: 2500,
      closingPounds: 5000, // rows only reach 4500
    });
    expect(result.status).toBe('mismatch');
    expect(result.failedChecks).toBe(1);
    expect(result.message).toContain('closing balance');
  });

  it('MISMATCH — extracted money-out differs from the stated total debits', () => {
    const result = reconcileStatement([cand(-50)], {
      closingPounds: 2000,
      statedTotalCreditsPounds: 0,
      statedTotalDebitsPounds: 500, // we only extracted £50 out
    });
    expect(result.status).toBe('mismatch');
    expect(result.message).toContain('money out');
  });

  it('UNVERIFIED — no statement totals to check against', () => {
    expect(reconcileStatement([cand(-50)], null).status).toBe('unverified');
  });

  it('UNVERIFIED — only a closing balance, no opening or stated totals', () => {
    const result = reconcileStatement([cand(-50)], { closingPounds: 1000 });
    expect(result.status).toBe('unverified');
    expect(result.failedChecks).toBe(0);
  });

  it('tolerates a 1p rounding difference', () => {
    const result = reconcileStatement([cand(10.005)], {
      openingPounds: 0,
      closingPounds: 10, // 10.005 rounds to 1001p vs 1000p closing → within 1p
    });
    expect(result.status).toBe('ok');
  });
});
