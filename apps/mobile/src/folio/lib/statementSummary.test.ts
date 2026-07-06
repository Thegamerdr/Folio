// statementSummary — pure-logic coverage for buildStatementSummary / candidateToTransactionDraft /
// resolveCandidateCategory (lib/statementSummary.ts). Task: BULK ADD-AS-HISTORY.
//
// Node-safe: no react-native, no DOM, no store mutation — plain `.test.ts` collected by the
// apps/**/*.test.ts runner, exactly like caughtIncome.test.ts / historyCycles.test.ts.

import { describe, expect, it } from 'vitest';

import type { CandidateMoneyItem } from './importSheet';
import {
  buildStatementSummary,
  candidateToTransactionDraft,
  resolveCandidateCategory,
} from './statementSummary';

function candidate(over: Partial<CandidateMoneyItem> = {}): CandidateMoneyItem {
  return {
    id: 'cand-1',
    source: 'pdf',
    kind: 'spend',
    merchant: 'Tesco',
    amount: -10,
    confidence: 'low',
    ...over,
  };
}

describe('resolveCandidateCategory', () => {
  it('resolves an income-kind candidate to "income" regardless of any free-text category guess', () => {
    expect(
      resolveCandidateCategory(candidate({ kind: 'income', amount: 200, category: 'Payroll' })),
    ).toBe('income');
    expect(resolveCandidateCategory(candidate({ kind: 'income', amount: 200 }))).toBe('income');
  });

  it('resolves a positive-amount candidate to "income" even if kind was mis-tagged', () => {
    expect(resolveCandidateCategory(candidate({ kind: 'spend', amount: 50 }))).toBe('income');
  });

  it('never resolves an income row to "food" — the diagnosed defect', () => {
    const result = resolveCandidateCategory(
      candidate({ kind: 'income', amount: 215.51, category: 'Groceries' }),
    );
    expect(result).not.toBe('food');
    expect(result).toBe('income');
  });

  it('maps a recognised free-text spend category through the alias table', () => {
    expect(resolveCandidateCategory(candidate({ category: 'Bills & Utilities' }))).toBe('bills');
    expect(resolveCandidateCategory(candidate({ category: 'Rent' }))).toBe('bills');
    expect(resolveCandidateCategory(candidate({ category: 'Groceries' }))).toBe('food');
    expect(resolveCandidateCategory(candidate({ category: 'Shopping' }))).toBe('shopping');
  });

  it('falls back to "other" for an unrecognised spend category, never invents a bucket', () => {
    expect(resolveCandidateCategory(candidate({ category: 'Something Unknown' }))).toBe('other');
    expect(resolveCandidateCategory(candidate())).toBe('other');
  });
});

describe('candidateToTransactionDraft', () => {
  it('carries the signed amount verbatim and the resolved category', () => {
    const draft = candidateToTransactionDraft(
      candidate({ merchant: 'Salary', amount: 1800, kind: 'income' }),
    );
    expect(draft.amount).toBe(1800);
    expect(draft.category).toBe('income');
    expect(draft.source).toBe('manual');
  });

  it('carries the candidate date as an ISO timestamp when present, omits `when` otherwise', () => {
    const withDate = candidateToTransactionDraft(candidate({ date: '2026-03-03' }));
    expect(withDate.when).toBe('2026-03-03T00:00:00.000Z');

    const withoutDate = candidateToTransactionDraft(candidate());
    expect(withoutDate.when).toBeUndefined();
  });

  it('falls back to "Unnamed" for a blank merchant, never a blank row', () => {
    expect(candidateToTransactionDraft(candidate({ merchant: '   ' })).merchant).toBe('Unnamed');
  });
});

describe('buildStatementSummary', () => {
  it('returns a zeroed summary for an empty candidate list', () => {
    expect(buildStatementSummary([])).toEqual({
      added: 0,
      dateRange: null,
      totalInPence: 0,
      totalOutPence: 0,
    });
  });

  it('sums in/out totals in pence, avoiding float drift', () => {
    const summary = buildStatementSummary([
      candidate({ amount: -42.1 }),
      candidate({ amount: -7.99 }),
      candidate({ amount: 215.51 }),
    ]);
    expect(summary.added).toBe(3);
    expect(summary.totalOutPence).toBe(5009); // 42.10 + 7.99 = 50.09
    expect(summary.totalInPence).toBe(21551);
  });

  it('computes the date range from the earliest and latest dated candidates', () => {
    const summary = buildStatementSummary([
      candidate({ date: '2026-03-12' }),
      candidate({ date: '2026-03-03' }),
      candidate({ date: '2026-03-25' }),
    ]);
    expect(summary.dateRange).toEqual({ fromISO: '2026-03-03', toISO: '2026-03-25' });
  });

  it('returns a null dateRange when no candidate carries a date', () => {
    const summary = buildStatementSummary([candidate()]);
    expect(summary.dateRange).toBeNull();
  });

  it('matches the real Monzo-page fixture totals (14 rows, live gateway 2026-07-06)', () => {
    const monzoPage: CandidateMoneyItem[] = [
      candidate({ amount: 30, date: '2021-03-03' }),
      candidate({ amount: -29, date: '2021-03-04' }),
      candidate({ amount: 215.51, date: '2021-03-12' }),
      candidate({ amount: 250, date: '2021-03-12' }),
      candidate({ amount: -450, date: '2021-03-12' }),
      candidate({ amount: -15, date: '2021-03-15' }),
      candidate({ amount: 52.5, date: '2021-03-22' }),
      candidate({ amount: -52.5, date: '2021-03-24' }),
      candidate({ amount: 5, date: '2021-03-25' }),
      candidate({ amount: -7.99, date: '2021-03-25' }),
      candidate({ amount: -9.99, date: '2021-03-25' }),
      candidate({ amount: 10, date: '2021-03-29' }),
      candidate({ amount: 453, date: '2021-03-29' }),
      candidate({ amount: -450, date: '2021-03-29' }),
    ];
    const summary = buildStatementSummary(monzoPage);
    expect(summary.added).toBe(14);
    expect(summary.dateRange).toEqual({ fromISO: '2021-03-03', toISO: '2021-03-29' });
    // in: 30 + 215.51 + 250 + 52.5 + 5 + 10 + 453 = 1016.01
    expect(summary.totalInPence).toBe(101601);
    // out: 29 + 450 + 15 + 52.5 + 7.99 + 9.99 + 450 = 1014.48
    expect(summary.totalOutPence).toBe(101448);
  });
});
