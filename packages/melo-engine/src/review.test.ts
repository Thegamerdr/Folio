import { describe, expect, it } from 'vitest';

import { lintCopy } from './copy.js';
import { buildWeekReview, type ReviewBill, type WeekReviewInputs, type WeekWin } from './review.js';
import type { SpendEntry } from './spend.js';

const TODAY = '2026-07-02'; // Thursday; window = [2026-06-26, 2026-07-02]

const e = (id: string, amountPence: number, atISO: string): SpendEntry => ({
  id,
  amountPence,
  atISO,
});

const w = (id: string, atISO: string | null): WeekWin => ({ id, atISO });

const bill = (name: string, amountPence: number, dueDate: string): ReviewBill => ({
  name,
  amountPence,
  dueDate,
});

const inputs = (overrides: Partial<WeekReviewInputs> = {}): WeekReviewInputs => ({
  todayISO: TODAY,
  spendLog: [],
  perDayPence: 1_000,
  checksThisWeek: 0,
  wins: [],
  billsAhead: [],
  safeZonePence: 18_400,
  daysToPayday: 10,
  ...overrides,
});

describe('buildWeekReview — the shape of the week', () => {
  it('an empty log is all quiet days, no biggest day, and a headline that invites rather than scolds', () => {
    const review = buildWeekReview(inputs());
    expect(review.weekStartISO).toBe('2026-06-26');
    expect(review.spentPence).toBe(0);
    expect(review.plannedPence).toBe(7_000);
    expect(review.deltaPence).toBe(7_000);
    expect(review.loggedDays).toBe(0);
    expect(review.quietDays).toBe(7);
    expect(review.biggestDay).toBeNull();
    expect(review.newWinIds).toEqual([]);
    expect(review.billsDueNextWeek).toEqual([]);
    expect(lintCopy(review.headline)).toEqual([]);
    expect(lintCopy(review.subline)).toEqual([]);
  });

  it('under plan: exact pence math and the quiet-pride headline', () => {
    const review = buildWeekReview(
      inputs({ spendLog: [e('a', 2_000, '2026-06-28'), e('b', 2_500, '2026-07-01')] }),
    );
    expect(review.spentPence).toBe(4_500);
    expect(review.plannedPence).toBe(7_000);
    expect(review.deltaPence).toBe(2_500);
    expect(review.headline).toBe('Under plan by £25 — the quiet kind of good week.');
    expect(lintCopy(review.headline)).toEqual([]);
  });

  it('over plan: exact pence math, an honest headline with no exclamation and no "again"', () => {
    const review = buildWeekReview(
      inputs({ spendLog: [e('a', 6_000, '2026-06-27'), e('b', 4_100, '2026-06-30')] }),
    );
    expect(review.spentPence).toBe(10_100);
    expect(review.deltaPence).toBe(-3_100);
    expect(review.headline).toBe('£31 past the plan. Noticing it is the work.');
    expect(review.headline).not.toMatch(/!/);
    expect(review.headline).not.toMatch(/\bagain\b/i);
    expect(lintCopy(review.headline)).toEqual([]);
  });

  it('an entry exactly 6 days ago is inside the window', () => {
    const review = buildWeekReview(inputs({ spendLog: [e('edge', 1_500, '2026-06-26')] }));
    expect(review.spentPence).toBe(1_500);
    expect(review.loggedDays).toBe(1);
  });

  it('an entry exactly 7 days ago is outside the window', () => {
    const review = buildWeekReview(inputs({ spendLog: [e('old', 1_500, '2026-06-25')] }));
    expect(review.spentPence).toBe(0);
    expect(review.loggedDays).toBe(0);
    expect(review.biggestDay).toBeNull();
  });

  it('several entries on one day count as ONE logged day', () => {
    const review = buildWeekReview(
      inputs({
        spendLog: [e('a', 300, '2026-07-01'), e('b', 400, '2026-07-01'), e('c', 500, '2026-07-02')],
      }),
    );
    expect(review.loggedDays).toBe(2);
    expect(review.quietDays).toBe(5);
    expect(review.spentPence).toBe(1_200);
  });

  it('biggestDay sums a day’s entries and picks the highest', () => {
    const review = buildWeekReview(
      inputs({
        spendLog: [
          e('a', 300, '2026-07-01'),
          e('b', 400, '2026-07-01'), // 700 on the 1st
          e('c', 600, '2026-06-29'),
        ],
      }),
    );
    expect(review.biggestDay).toEqual({ atISO: '2026-07-01', amountPence: 700 });
  });

  it('a biggestDay tie goes to the EARLIEST day', () => {
    const review = buildWeekReview(
      inputs({ spendLog: [e('late', 900, '2026-07-01'), e('early', 900, '2026-06-28')] }),
    );
    expect(review.biggestDay).toEqual({ atISO: '2026-06-28', amountPence: 900 });
  });

  it('wins: null atISO excluded, out-of-window excluded, in-window kept in order', () => {
    const review = buildWeekReview(
      inputs({
        wins: [
          w('first-check', '2026-06-26'), // boundary — in
          w('first-safe-zone', null), // never
          w('storm-passed', '2026-06-25'), // too old — out
          w('buffer-500', TODAY), // today — in
        ],
      }),
    );
    expect(review.newWinIds).toEqual(['first-check', 'buffer-500']);
  });

  it('bills: due today excluded, due today+7 included, due today+8 excluded', () => {
    const review = buildWeekReview(
      inputs({
        billsAhead: [
          bill('rent-today', 60_000, '2026-07-02'),
          bill('energy', 8_000, '2026-07-09'),
          bill('phone', 2_500, '2026-07-10'),
          bill('water', 3_000, '2026-07-05'),
        ],
      }),
    );
    expect(review.billsDueNextWeek.map((b) => b.name)).toEqual(['energy', 'water']);
  });

  it('checksCount and win count are woven into a single-sentence subline', () => {
    const review = buildWeekReview(
      inputs({
        spendLog: [e('a', 500, '2026-07-01'), e('b', 500, '2026-07-02')],
        checksThisWeek: 3,
        wins: [w('first-check', '2026-06-30'), w('five-checks-week', '2026-07-01')],
      }),
    );
    expect(review.checksCount).toBe(3);
    expect(review.subline).toBe(
      'Logged 2 of 7 days, checked before buying 3 times, and 2 new wins noticed.',
    );
    // One sentence: exactly one full stop, and it is the last character.
    expect(review.subline.match(/\./g)).toHaveLength(1);
    expect(review.subline.endsWith('.')).toBe(true);
    expect(lintCopy(review.subline)).toEqual([]);
  });

  it('subline stays quiet about checks and wins when there are none', () => {
    const review = buildWeekReview(inputs({ spendLog: [e('a', 500, '2026-07-01')] }));
    expect(review.subline).toBe('Logged 1 of 7 days.');
    expect(lintCopy(review.subline)).toEqual([]);
  });

  it('rejects fractional pence in a logged spend', () => {
    expect(() => buildWeekReview(inputs({ spendLog: [e('a', 10.5, '2026-07-01')] }))).toThrow(
      /integer pence/,
    );
  });

  it('rejects a fractional per-day plan', () => {
    expect(() => buildWeekReview(inputs({ perDayPence: 999.5 }))).toThrow(/integer pence/);
  });
});

describe('buildWeekReview — copy lints across the input grid', () => {
  const scenarios: readonly [string, WeekReviewInputs][] = [
    ['nothing logged', inputs()],
    [
      'nothing logged but checks and wins happened',
      inputs({ checksThisWeek: 5, wins: [w('first-check', TODAY)] }),
    ],
    [
      'well under plan',
      inputs({ spendLog: [e('a', 100, '2026-06-28'), e('b', 100, '2026-07-01')] }),
    ],
    ['exactly on plan', inputs({ spendLog: [e('a', 7_000, '2026-06-29')] })],
    ['slightly over plan', inputs({ spendLog: [e('a', 7_150, '2026-06-30')], checksThisWeek: 1 })],
    [
      'far over plan with one win',
      inputs({
        spendLog: [e('a', 30_000, '2026-06-27'), e('b', 5_000, '2026-07-02')],
        wins: [w('first-spend-logged', '2026-07-02')],
        checksThisWeek: 2,
      }),
    ],
    [
      'busy week — every day logged, bills ahead',
      inputs({
        spendLog: [
          '2026-06-26',
          '2026-06-27',
          '2026-06-28',
          '2026-06-29',
          '2026-06-30',
          '2026-07-01',
          '2026-07-02',
        ].map((day, i) => e(`d${i}`, 1_000, day)),
        billsAhead: [bill('energy', 8_000, '2026-07-06')],
        checksThisWeek: 4,
      }),
    ],
  ];

  it.each(scenarios)('headline and subline pass lintCopy: %s', (_name, scenarioInputs) => {
    const review = buildWeekReview(scenarioInputs);
    expect(lintCopy(review.headline)).toEqual([]);
    expect(lintCopy(review.subline)).toEqual([]);
    expect(review.headline.length).toBeGreaterThan(0);
    expect(review.subline.length).toBeGreaterThan(0);
  });
});
