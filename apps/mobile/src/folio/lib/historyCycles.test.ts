// historyCycles — pure-logic coverage for synthesizeHistoryCycles /
// latestLivedCycle (lib/historyCycles.ts). DATA_INTELLIGENCE.md phase ④(B).
//
// Node-safe: touches only the pure functions (no react-native, no DOM, no
// store mutation), so it is a plain `.test.ts` collected by the
// apps/**/*.test.ts runner — exactly like caughtIncome.test.ts.

import { describe, expect, it } from 'vitest';

import type { CycleRecord, Transaction } from '../store';
import {
  capMergedCycles,
  latestLivedCycle,
  synthesizeHistoryCycles,
  type ReconstructedCycleRecord,
} from './historyCycles';

const TODAY = '2026-07-06';

function txn(
  when: string,
  merchant: string,
  amount: number,
  over: Partial<Transaction> = {},
): Transaction {
  return {
    id: `t-${when}-${merchant}`,
    when,
    merchant,
    amount,
    category: 'other',
    source: 'manual',
    ...over,
  };
}

function fiveRowsIn(monthPrefix: string): Transaction[] {
  return Array.from({ length: 5 }, (_, i) =>
    txn(`${monthPrefix}-0${i + 1}T00:00:00.000Z`, `M${i}`, -10),
  );
}

// ---------------------------------------------------------------------------
// synthesizeHistoryCycles — grouping / thresholds
// ---------------------------------------------------------------------------
describe('synthesizeHistoryCycles — grouping', () => {
  it('keeps refund cash in the cycle net without treating internal transfers as spend or income', () => {
    const rows = fiveRowsIn('2026-05');
    rows.push(
      txn('2026-05-07', 'Refund', 20, {
        financialAction: { kind: 'refund', originalTransactionId: rows[0]!.id },
      }),
    );
    rows.push(
      txn('2026-05-08', 'Transfer', -999, {
        financialAction: {
          kind: 'transfer',
          transferId: 't',
          direction: 'out',
          pairedTransactionId: 'other',
        },
      }),
    );
    expect(synthesizeHistoryCycles(rows, [], [], TODAY)[0]?.spare).toBe(-30);
  });
  it('returns existingCycles unchanged when there are no transactions', () => {
    const existing: CycleRecord[] = [
      { closedAt: '2026-05-25', label: 'May', spare: 10, tightPoint: 5, setAside: 0, note: 'n' },
    ];
    const result = synthesizeHistoryCycles([], [], existing, TODAY);
    expect(result).toEqual(existing);
  });

  it('does not synthesize a month with fewer than 5 transactions', () => {
    const rows = [
      txn('2026-01-01T00:00:00.000Z', 'A', -10),
      txn('2026-01-02T00:00:00.000Z', 'B', -10),
      txn('2026-01-03T00:00:00.000Z', 'C', -10),
      txn('2026-01-04T00:00:00.000Z', 'D', -10),
    ];
    const result = synthesizeHistoryCycles(rows, [], [], TODAY);
    expect(result).toEqual([]);
  });

  it('synthesizes a month with exactly 5 transactions (the threshold, inclusive)', () => {
    const rows = fiveRowsIn('2026-01');
    const result = synthesizeHistoryCycles(rows, [], [], TODAY);
    expect(result.length).toBe(1);
    expect(result[0]!.closedAt).toBe('2026-01-31');
  });

  it('groups multiple qualifying months into separate cycle records', () => {
    const rows = [...fiveRowsIn('2026-01'), ...fiveRowsIn('2026-02')];
    const result = synthesizeHistoryCycles(rows, [], [], TODAY);
    expect(result.length).toBe(2);
    const closedDates = result.map((c) => c.closedAt).sort();
    expect(closedDates).toEqual(['2026-01-31', '2026-02-28']);
  });

  it('never synthesizes the current calendar month, even with plenty of rows', () => {
    const rows = fiveRowsIn('2026-07'); // TODAY = 2026-07-06, same month
    const result = synthesizeHistoryCycles(rows, [], [], TODAY);
    expect(result).toEqual([]);
  });

  it('never synthesizes a future month', () => {
    const rows = fiveRowsIn('2026-08');
    const result = synthesizeHistoryCycles(rows, [], [], TODAY);
    expect(result).toEqual([]);
  });

  it('labels a reconstructed month as "Month YYYY" (year-qualified, never bare)', () => {
    const rows = fiveRowsIn('2026-06');
    const result = synthesizeHistoryCycles(rows, [], [], TODAY);
    expect(result[0]!.label).toBe('June 2026');
  });

  it('tags every synthesized record reconstructed: true', () => {
    const rows = fiveRowsIn('2026-01');
    const result = synthesizeHistoryCycles(rows, [], [], TODAY);
    expect((result[0] as ReconstructedCycleRecord).reconstructed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// synthesizeHistoryCycles — tight-point / spare approximation (pinned)
// ---------------------------------------------------------------------------
describe('synthesizeHistoryCycles — approximation math (pinned)', () => {
  it('tightPoint = max(0, spend - income); spare = income - spend', () => {
    const rows = [
      txn('2026-01-01T00:00:00.000Z', 'Pay', 2000),
      txn('2026-01-05T00:00:00.000Z', 'Rent', -800),
      txn('2026-01-10T00:00:00.000Z', 'Groceries', -300),
      txn('2026-01-15T00:00:00.000Z', 'Netflix', -12),
      txn('2026-01-20T00:00:00.000Z', 'Coffee', -8),
    ];
    // spend = 800+300+12+8 = 1120; income = 2000
    const result = synthesizeHistoryCycles(rows, [], [], TODAY);
    expect(result[0]!.spare).toBe(880); // 2000 - 1120
    expect(result[0]!.tightPoint).toBe(0); // spend < income -> floored at 0
  });

  it('floors tightPoint at 0 rather than going negative when income exceeds spend', () => {
    const rows = [
      txn('2026-01-01T00:00:00.000Z', 'Pay', 2000),
      txn('2026-01-05T00:00:00.000Z', 'Rent', -100),
      txn('2026-01-10T00:00:00.000Z', 'Groceries', -50),
      txn('2026-01-15T00:00:00.000Z', 'Netflix', -12),
      txn('2026-01-20T00:00:00.000Z', 'Coffee', -8),
    ];
    // spend = 170, income = 2000 -> spend - income is deeply negative, floored to 0
    const result = synthesizeHistoryCycles(rows, [], [], TODAY);
    expect(result[0]!.tightPoint).toBe(0);
  });

  it('tightPoint reflects spend outrunning income when the month ran hot', () => {
    const rows = [
      txn('2026-01-01T00:00:00.000Z', 'Pay', 500),
      txn('2026-01-05T00:00:00.000Z', 'Rent', -800),
      txn('2026-01-10T00:00:00.000Z', 'Groceries', -300),
      txn('2026-01-15T00:00:00.000Z', 'Netflix', -12),
      txn('2026-01-20T00:00:00.000Z', 'Coffee', -8),
    ];
    // spend = 1120, income = 500 -> tightPoint = 620, spare = -620
    const result = synthesizeHistoryCycles(rows, [], [], TODAY);
    expect(result[0]!.tightPoint).toBe(620);
    expect(result[0]!.spare).toBe(-620);
  });

  it('setAside is always 0 (pot-linked transfers are not identifiable from plain rows)', () => {
    const rows = fiveRowsIn('2026-01');
    const result = synthesizeHistoryCycles(rows, [], [], TODAY);
    expect(result[0]!.setAside).toBe(0);
  });

  it('note honestly states this is an estimate, not a lived ritual', () => {
    const rows = fiveRowsIn('2026-01');
    const result = synthesizeHistoryCycles(rows, [], [], TODAY);
    expect(result[0]!.note).toMatch(/estimate/i);
    expect(result[0]!.note).not.toMatch(/ritual-sealed/i);
  });
});

// ---------------------------------------------------------------------------
// synthesizeHistoryCycles — lived-wins, idempotency, upsert
// ---------------------------------------------------------------------------
describe('synthesizeHistoryCycles — merge rules', () => {
  it('never overwrites a LIVED cycle for the same month', () => {
    const lived: CycleRecord = {
      closedAt: '2026-01-28',
      label: 'January (lived)',
      spare: 999,
      tightPoint: 1,
      setAside: 50,
      note: 'ritual-sealed',
    };
    const rows = fiveRowsIn('2026-01');
    const result = synthesizeHistoryCycles(rows, [], [lived], TODAY);
    expect(result).toEqual([lived]); // untouched, no reconstructed duplicate
  });

  it('passes through lived cycles for months with no transaction history at all', () => {
    const lived: CycleRecord = {
      closedAt: '2025-11-30',
      label: 'November (lived)',
      spare: 10,
      tightPoint: 5,
      setAside: 0,
      note: 'n',
    };
    const result = synthesizeHistoryCycles([], [], [lived], TODAY);
    expect(result).toEqual([lived]);
  });

  it('is idempotent — re-running over the identical inputs produces the identical output', () => {
    const rows = [...fiveRowsIn('2026-01'), ...fiveRowsIn('2026-02')];
    const first = synthesizeHistoryCycles(rows, [], [], TODAY);
    const second = synthesizeHistoryCycles(rows, [], first, TODAY);
    expect(second).toEqual(first);
    expect(second.length).toBe(2); // never duplicated
  });

  it('upserts a reconstructed month in place as more history for it lands, never duplicating', () => {
    const firstPass = synthesizeHistoryCycles(fiveRowsIn('2026-01'), [], [], TODAY);
    const grown = [...fiveRowsIn('2026-01'), txn('2026-01-28T00:00:00.000Z', 'BigOne', -500)];
    const secondPass = synthesizeHistoryCycles(grown, [], firstPass, TODAY);

    expect(secondPass.length).toBe(1); // still exactly one January entry
    expect(secondPass[0]!.tightPoint).toBeGreaterThan(firstPass[0]!.tightPoint); // refreshed
  });

  it('a reconstructed entry for a month that no longer has transactions is dropped on re-run', () => {
    // Re-running with a narrower transaction set (e.g. a corrected re-import)
    // should not keep stale reconstructed months forever — only months
    // present in the CURRENT `transactions` input get (re-)synthesized.
    const firstPass = synthesizeHistoryCycles(
      [...fiveRowsIn('2026-01'), ...fiveRowsIn('2026-02')],
      [],
      [],
      TODAY,
    );
    expect(firstPass.length).toBe(2);
    const secondPass = synthesizeHistoryCycles(fiveRowsIn('2026-01'), [], firstPass, TODAY);
    expect(secondPass.length).toBe(1);
    expect(secondPass[0]!.closedAt).toBe('2026-01-31');
  });

  it('sorts the merged result newest-first by closedAt', () => {
    const lived: CycleRecord = {
      closedAt: '2025-12-31',
      label: 'December (lived)',
      spare: 1,
      tightPoint: 1,
      setAside: 0,
      note: 'n',
    };
    const rows = [...fiveRowsIn('2026-01'), ...fiveRowsIn('2026-02')];
    const result = synthesizeHistoryCycles(rows, [], [lived], TODAY);
    const closedDates = result.map((c) => c.closedAt);
    expect(closedDates).toEqual(['2026-02-28', '2026-01-31', '2025-12-31']);
  });
});

// ---------------------------------------------------------------------------
// latestLivedCycle — ritual-offer guard helper
// ---------------------------------------------------------------------------
describe('latestLivedCycle', () => {
  it('returns null when cycles is empty', () => {
    expect(latestLivedCycle([])).toBeNull();
  });

  it('returns null when every cycle is reconstructed', () => {
    const reconstructed: ReconstructedCycleRecord = {
      closedAt: '2026-01-31',
      label: 'January 2026',
      spare: 0,
      tightPoint: 0,
      setAside: 0,
      note: 'n',
      reconstructed: true,
    };
    expect(latestLivedCycle([reconstructed])).toBeNull();
  });

  it('returns the lived cycle when it is the only entry', () => {
    const lived: CycleRecord = {
      closedAt: '2026-05-25',
      label: 'May',
      spare: 1,
      tightPoint: 1,
      setAside: 0,
      note: 'n',
    };
    expect(latestLivedCycle([lived])).toEqual(lived);
  });

  it('picks the lived cycle with the latest closedAt, ignoring array order', () => {
    const older: CycleRecord = {
      closedAt: '2026-04-25',
      label: 'April',
      spare: 1,
      tightPoint: 1,
      setAside: 0,
      note: 'n',
    };
    const newer: CycleRecord = {
      closedAt: '2026-05-25',
      label: 'May',
      spare: 1,
      tightPoint: 1,
      setAside: 0,
      note: 'n',
    };
    // Older placed first — the helper must not just trust cycles[0].
    expect(latestLivedCycle([older, newer])).toEqual(newer);
  });

  it('never lets a reconstructed cycle shadow a lived one, even when it closes later', () => {
    const lived: CycleRecord = {
      closedAt: '2026-05-25',
      label: 'May (lived)',
      spare: 1,
      tightPoint: 1,
      setAside: 0,
      note: 'n',
    };
    const reconstructed: ReconstructedCycleRecord = {
      closedAt: '2026-06-30', // closes LATER than the lived cycle
      label: 'June 2026',
      spare: 0,
      tightPoint: 0,
      setAside: 0,
      note: 'n',
      reconstructed: true,
    };
    // Reconstructed sits ahead in the array (as a real cycles[] could have it
    // after a backfill) — must still resolve to the lived May cycle.
    expect(latestLivedCycle([reconstructed, lived])).toEqual(lived);
  });
});

// ---------------------------------------------------------------------------
// synthesizeHistoryCycles — PARTIAL FIRST MONTH guard (DATA_INTELLIGENCE.md phase ④)
// ---------------------------------------------------------------------------
describe('synthesizeHistoryCycles — partial first month', () => {
  it('skips the earliest month when its earliest transaction starts mid-month', () => {
    // The import range's first row lands on the 18th — this is clearly a mid-month statement
    // start, so January's true start (and total) is unknown.
    const rows = [
      txn('2026-01-18T00:00:00.000Z', 'A', -10),
      txn('2026-01-19T00:00:00.000Z', 'B', -10),
      txn('2026-01-20T00:00:00.000Z', 'C', -10),
      txn('2026-01-25T00:00:00.000Z', 'D', -10),
      txn('2026-01-28T00:00:00.000Z', 'E', -10),
    ];
    const result = synthesizeHistoryCycles(rows, [], [], TODAY);
    expect(result).toEqual([]);
  });

  it('still reconstructs the earliest month when its earliest row starts on the 1st', () => {
    const rows = fiveRowsIn('2026-01'); // rows start on the 1st
    const result = synthesizeHistoryCycles(rows, [], [], TODAY);
    expect(result.length).toBe(1);
    expect(result[0]!.closedAt).toBe('2026-01-31');
  });

  it('still reconstructs the earliest month when its earliest row starts within the grace window (day 4)', () => {
    const rows = [
      txn('2026-01-04T00:00:00.000Z', 'A', -10),
      txn('2026-01-10T00:00:00.000Z', 'B', -10),
      txn('2026-01-15T00:00:00.000Z', 'C', -10),
      txn('2026-01-20T00:00:00.000Z', 'D', -10),
      txn('2026-01-28T00:00:00.000Z', 'E', -10),
    ];
    const result = synthesizeHistoryCycles(rows, [], [], TODAY);
    expect(result.length).toBe(1);
  });

  it('a genuinely sparse-but-full month (>=5 rows, starts near the 1st) still reconstructs — the guard is about the START, not row count', () => {
    const rows = [
      txn('2026-01-02T00:00:00.000Z', 'A', -10),
      txn('2026-01-09T00:00:00.000Z', 'B', -10),
      txn('2026-01-16T00:00:00.000Z', 'C', -10),
      txn('2026-01-23T00:00:00.000Z', 'D', -10),
      txn('2026-01-30T00:00:00.000Z', 'E', -10),
    ];
    const result = synthesizeHistoryCycles(rows, [], [], TODAY);
    expect(result.length).toBe(1);
  });

  it('only guards the EARLIEST month of the range — a later month starting mid-month range-wise still reconstructs normally', () => {
    // February is the second month in this range; its "earliest row" being on the 20th does not
    // mean Feb started mid-month — Feb is bounded by January being fully covered before it. Only
    // the range's overall earliest month (January) needs the guard.
    const rows = [
      ...fiveRowsIn('2026-01'), // Jan starts on the 1st — fully covered
      txn('2026-02-20T00:00:00.000Z', 'F', -10),
      txn('2026-02-21T00:00:00.000Z', 'G', -10),
      txn('2026-02-22T00:00:00.000Z', 'H', -10),
      txn('2026-02-23T00:00:00.000Z', 'I', -10),
      txn('2026-02-24T00:00:00.000Z', 'J', -10),
    ];
    const result = synthesizeHistoryCycles(rows, [], [], TODAY);
    expect(result.length).toBe(2);
    const closedDates = result.map((c) => c.closedAt).sort();
    expect(closedDates).toEqual(['2026-01-31', '2026-02-28']);
  });

  it('re-running with more history that fills in the true start of the earliest month lets it reconstruct', () => {
    // First pass: only late-month rows exist for January — skipped as partial.
    const midMonthOnly = [
      txn('2026-01-18T00:00:00.000Z', 'A', -10),
      txn('2026-01-19T00:00:00.000Z', 'B', -10),
      txn('2026-01-20T00:00:00.000Z', 'C', -10),
      txn('2026-01-25T00:00:00.000Z', 'D', -10),
      txn('2026-01-28T00:00:00.000Z', 'E', -10),
    ];
    const firstPass = synthesizeHistoryCycles(midMonthOnly, [], [], TODAY);
    expect(firstPass).toEqual([]);

    // Second pass: a later import backfills the true start of January (a row on the 1st).
    const backfilled = [txn('2026-01-01T00:00:00.000Z', 'Z', -10), ...midMonthOnly];
    const secondPass = synthesizeHistoryCycles(backfilled, [], firstPass, TODAY);
    expect(secondPass.length).toBe(1);
    expect(secondPass[0]!.closedAt).toBe('2026-01-31');
  });
});

// ---------------------------------------------------------------------------
// capMergedCycles — CYCLES RETENTION cap (DATA_INTELLIGENCE.md phase ④)
// ---------------------------------------------------------------------------
describe('capMergedCycles', () => {
  function livedAt(closedAt: string): CycleRecord {
    return { closedAt, label: closedAt, spare: 1, tightPoint: 1, setAside: 0, note: 'lived' };
  }
  function reconstructedAt(closedAt: string): ReconstructedCycleRecord {
    return {
      closedAt,
      label: closedAt,
      spare: 0,
      tightPoint: 0,
      setAside: 0,
      note: 'estimate',
      reconstructed: true,
    };
  }

  it('passes an already-under-cap list through unchanged', () => {
    const cycles = [livedAt('2026-05-31'), reconstructedAt('2026-04-30')];
    expect(capMergedCycles(cycles, 60)).toEqual(cycles);
  });

  it('evicts the OLDEST reconstructed entries first once the cap is exceeded', () => {
    // 3 lived + 5 reconstructed, cap of 6 -> exactly 3 reconstructed must be evicted (the 3 oldest).
    const lived = [livedAt('2026-12-31'), livedAt('2026-11-30'), livedAt('2026-10-31')];
    const reconstructed = [
      reconstructedAt('2026-09-30'),
      reconstructedAt('2026-08-31'),
      reconstructedAt('2026-07-31'),
      reconstructedAt('2026-06-30'),
      reconstructedAt('2026-05-31'), // oldest
    ];
    const merged = [...lived, ...reconstructed];
    const result = capMergedCycles(merged, 6);

    expect(result.length).toBe(6);
    // All 3 lived cycles survive untouched.
    expect(lived.every((l) => result.some((r) => r.closedAt === l.closedAt))).toBe(true);
    // Only the 3 NEWEST reconstructed entries survive; the 2 oldest are evicted.
    const survivingReconstructed = result
      .filter((c) => (c as ReconstructedCycleRecord).reconstructed)
      .map((c) => c.closedAt)
      .sort();
    expect(survivingReconstructed).toEqual(['2026-07-31', '2026-08-31', '2026-09-30']);
  });

  it('never evicts a lived cycle even when lived cycles alone exceed the cap', () => {
    const lived = Array.from({ length: 8 }, (_, i) => livedAt(`202${i}-01-31`));
    const result = capMergedCycles(lived, 6);
    expect(result.length).toBe(8); // passed through in full, not trimmed
    expect(result).toEqual(lived);
  });

  it('defaults the cap to 60', () => {
    const lived = [livedAt('2026-12-31')];
    const reconstructed = Array.from({ length: 65 }, (_, i) =>
      reconstructedAt(
        `20${String(20 + Math.floor(i / 12)).padStart(2, '0')}-${String((i % 12) + 1).padStart(2, '0')}-28`,
      ),
    );
    const result = capMergedCycles([...lived, ...reconstructed]);
    expect(result.length).toBe(60);
  });

  it('preserves newest-first ordering of the input in the output', () => {
    const merged = [
      livedAt('2026-12-31'),
      reconstructedAt('2026-11-30'),
      livedAt('2026-10-31'),
      reconstructedAt('2026-09-30'),
    ];
    const result = capMergedCycles(merged, 3);
    // Cap 3: 2 lived kept always; reconstructed budget = 1 -> keep the newer reconstructed entry.
    expect(result.map((c) => c.closedAt)).toEqual(['2026-12-31', '2026-11-30', '2026-10-31']);
  });
});
