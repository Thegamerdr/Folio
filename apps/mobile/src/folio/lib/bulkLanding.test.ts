import { describe, expect, it } from 'vitest';

import {
  bulkSummaryLine,
  closingBalanceOfferLine,
  isBulkStatement,
  nextBulkLandingOffer,
  type BulkLandingOffer,
} from './bulkLanding';
import type { AddStatementAsHistoryResult } from '../store';

describe('isBulkStatement', () => {
  it('is false for zero or one candidate', () => {
    expect(isBulkStatement(0)).toBe(false);
    expect(isBulkStatement(1)).toBe(false);
  });

  it('is true for more than one candidate', () => {
    expect(isBulkStatement(2)).toBe(true);
    expect(isBulkStatement(37)).toBe(true);
  });
});

describe('bulkSummaryLine', () => {
  it('renders the count, date range, and in/out totals', () => {
    const summary: AddStatementAsHistoryResult = {
      added: 12,
      dateRange: { fromISO: '2026-06-01', toISO: '2026-06-26' },
      totalInPence: 218000,
      totalOutPence: 42000,
    };
    expect(bulkSummaryLine(summary)).toBe(
      'Found 12 transactions · 1 Jun–26 Jun · £2,180 in / £420 out',
    );
  });

  it('uses singular "transaction" for exactly one', () => {
    const summary: AddStatementAsHistoryResult = {
      added: 1,
      dateRange: { fromISO: '2026-06-26', toISO: '2026-06-26' },
      totalInPence: 0,
      totalOutPence: 4200,
    };
    expect(bulkSummaryLine(summary)).toContain('Found 1 transaction ');
  });

  it('omits the date segment when no candidate carried a date', () => {
    const summary: AddStatementAsHistoryResult = {
      added: 3,
      dateRange: null,
      totalInPence: 0,
      totalOutPence: 1000,
    };
    expect(bulkSummaryLine(summary)).toBe('Found 3 transactions · £0 in / £10 out');
  });

  // ---------------------------------------------------------------------------
  // History-trim honesty (task: HISTORY TRIM HONESTY) — the trim sentence only
  // appears when something was actually dropped, and never fires on the
  // default/omitted-argument call sites the pre-add preview screen uses.
  // ---------------------------------------------------------------------------
  it('says nothing about trimming when droppedCount is omitted', () => {
    const summary: AddStatementAsHistoryResult = {
      added: 5,
      dateRange: null,
      totalInPence: 100,
      totalOutPence: 0,
    };
    expect(bulkSummaryLine(summary)).toBe('Found 5 transactions · £1 in / £0 out');
  });

  it('says nothing about trimming when droppedCount is explicitly 0', () => {
    const summary: AddStatementAsHistoryResult = {
      added: 5,
      dateRange: null,
      totalInPence: 100,
      totalOutPence: 0,
    };
    expect(bulkSummaryLine(summary, 0)).toBe('Found 5 transactions · £1 in / £0 out');
  });

  it('appends the trim sentence, plural, when droppedCount is positive', () => {
    const summary: AddStatementAsHistoryResult = {
      added: 50,
      dateRange: null,
      totalInPence: 100,
      totalOutPence: 0,
    };
    expect(bulkSummaryLine(summary, 12)).toBe(
      'Found 50 transactions · £1 in / £0 out · 12 older items trimmed to keep things fast — your export keeps everything',
    );
  });

  it('uses singular "item" when exactly one row was trimmed', () => {
    const summary: AddStatementAsHistoryResult = {
      added: 50,
      dateRange: null,
      totalInPence: 100,
      totalOutPence: 0,
    };
    expect(bulkSummaryLine(summary, 1)).toContain('1 older item trimmed');
    expect(bulkSummaryLine(summary, 1)).not.toContain('1 older items trimmed');
  });

  it('reads the trim delta straight off a post-add AddStatementAsHistoryResult', () => {
    const postAdd: AddStatementAsHistoryResult = {
      added: 10,
      dateRange: { fromISO: '2026-06-01', toISO: '2026-06-10' },
      totalInPence: 0,
      totalOutPence: 500,
      droppedTransactionCount: 8,
    };
    expect(bulkSummaryLine(postAdd, postAdd.droppedTransactionCount ?? 0)).toContain(
      '8 older items trimmed to keep things fast — your export keeps everything',
    );
  });

  // ---------------------------------------------------------------------------
  // Re-import dedup honesty (task: statement re-import correctness) — the summary line reports
  // duplicatesSkipped when a re-import found rows already in Folio.
  // ---------------------------------------------------------------------------
  it('says nothing about duplicates when duplicatesSkipped is absent or zero', () => {
    const noField: AddStatementAsHistoryResult = {
      added: 5,
      dateRange: null,
      totalInPence: 100,
      totalOutPence: 0,
    };
    expect(bulkSummaryLine(noField)).toBe('Found 5 transactions · £1 in / £0 out');

    const zeroField: AddStatementAsHistoryResult = { ...noField, duplicatesSkipped: 0 };
    expect(bulkSummaryLine(zeroField)).toBe('Found 5 transactions · £1 in / £0 out');
  });

  it('honestly reports duplicates already in Folio when duplicatesSkipped is positive', () => {
    const summary: AddStatementAsHistoryResult = {
      added: 2,
      dateRange: { fromISO: '2026-06-01', toISO: '2026-06-02' },
      totalInPence: 0,
      totalOutPence: 500,
      duplicatesSkipped: 3,
    };
    expect(bulkSummaryLine(summary)).toBe(
      'Added 2 new transactions · 3 already in Melo · 1 Jun–2 Jun · £0 in / £5 out',
    );
  });

  it('reports zero genuinely-new rows honestly on a full re-import of an already-landed statement', () => {
    const allDuplicates: AddStatementAsHistoryResult = {
      added: 0,
      dateRange: null,
      totalInPence: 0,
      totalOutPence: 0,
      duplicatesSkipped: 14,
    };
    expect(bulkSummaryLine(allDuplicates)).toBe(
      'Added 0 new transactions · 14 already in Melo · £0 in / £0 out',
    );
  });
});

describe('nextBulkLandingOffer', () => {
  const both: AddStatementAsHistoryResult = {
    added: 5,
    dateRange: null,
    totalInPence: 100,
    totalOutPence: 100,
    incomeSignal: {
      merchant: 'Acme Ltd',
      cadence: 'monthly',
      medianAmount: 2000,
      occurrences: 3,
      lastSeenISO: '2026-06-25',
      anchorISO: '2026-06-25',
      confidence: 'strong',
    },
    closingBalanceOffer: { amountPence: 19600, asOfISO: '2026-06-30' },
  };

  it('offers closing-balance first when both are present', () => {
    expect(nextBulkLandingOffer(both, new Set())).toBe('closing-balance');
  });

  it('offers income once closing-balance has been shown', () => {
    expect(nextBulkLandingOffer(both, new Set<BulkLandingOffer>(['closing-balance']))).toBe(
      'income',
    );
  });

  it('returns null once both have been shown', () => {
    expect(
      nextBulkLandingOffer(both, new Set<BulkLandingOffer>(['closing-balance', 'income'])),
    ).toBeNull();
  });

  it('skips straight to income when there is no closing-balance offer', () => {
    const { closingBalanceOffer: _omit, ...incomeOnly } = both;
    expect(nextBulkLandingOffer(incomeOnly, new Set())).toBe('income');
  });

  it('returns null when neither offer is present', () => {
    const neither: AddStatementAsHistoryResult = {
      added: 2,
      dateRange: null,
      totalInPence: 0,
      totalOutPence: 500,
    };
    expect(nextBulkLandingOffer(neither, new Set())).toBeNull();
  });
});

describe('closingBalanceOfferLine', () => {
  it('formats the one-tap confirm line', () => {
    expect(closingBalanceOfferLine({ amountPence: 19600, asOfISO: '2026-06-30' })).toBe(
      'Your balance looks like £196 as of 30 Jun — use it?',
    );
  });
});
