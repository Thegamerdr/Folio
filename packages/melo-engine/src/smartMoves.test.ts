import { describe, expect, it } from 'vitest';

import { lintCopy } from './copy.js';
import { pickSmartMove, type SmartMove, type SmartMoveInputs } from './smartMoves.js';

/** Calm baseline — no rule applies, pickSmartMove returns null. Overrides light up one rule. */
const base = (over: Partial<SmartMoveInputs> = {}): SmartMoveInputs => ({
  todayISO: '2026-03-02',
  safeZonePence: 30_000,
  perDayPence: 1_000,
  daysToPayday: 10,
  bufferPence: 2_000,
  savingsPence: 5_000,
  bills: [],
  dangerDaysAway: null,
  runRatePence: null,
  essentialsPerDayPence: 1_000,
  ...over,
});

const clusterBills = [
  { name: 'Rent', amountPence: 60_000, dueDate: '2026-03-08' },
  { name: 'Energy', amountPence: 8_000, dueDate: '2026-03-10' },
  { name: 'Phone', amountPence: 2_500, dueDate: '2026-03-14' },
];

const mustMove = (inputs: SmartMoveInputs): SmartMove => {
  const move = pickSmartMove(inputs);
  if (move === null) throw new Error('expected a smart move, got null');
  return move;
};

describe('pickSmartMove — danger (rule 1)', () => {
  it('names the exact per-day that keeps it dry: floor(zone / daysToPayday)', () => {
    const move = pickSmartMove(base({ dangerDaysAway: 3, safeZonePence: 6_000 }));
    expect(move).toEqual({
      id: 'danger',
      title: 'One move keeps it dry',
      body: 'Keep to £6/day from here and the £60 you have lasts to payday. That is the whole move.',
    });
  });

  it('the per-day figure floors in the user’s favour, never rounds up', () => {
    // 9999 / 4 = 2499.75p — the honest ask is £24/day, not £25.
    const move = mustMove(base({ dangerDaysAway: 1, safeZonePence: 9_999, daysToPayday: 4 }));
    expect(move.id).toBe('danger');
    expect(move.body).toContain('£24/day');
    expect(move.body).toContain('£99');
  });
});

describe('pickSmartMove — pace (rule 2)', () => {
  it('shows both figures, observed vs plan, with no scolding', () => {
    const move = pickSmartMove(base({ runRatePence: 800, essentialsPerDayPence: 400 }));
    expect(move).toEqual({
      id: 'pace',
      title: 'A quick pace check',
      body: 'Spending is running at £8/day against the £4/day plan. No drama — just worth knowing while there is time to steer.',
    });
  });

  it('stays quiet at exactly 1.25x the plan — the guard is strictly greater-than', () => {
    expect(pickSmartMove(base({ runRatePence: 500, essentialsPerDayPence: 400 }))).toBeNull();
  });

  it('fires one pence above 1.25x the plan', () => {
    const move = mustMove(base({ runRatePence: 501, essentialsPerDayPence: 400 }));
    expect(move.id).toBe('pace');
  });

  it('never speaks about pace when the run-rate is not known yet', () => {
    expect(pickSmartMove(base({ runRatePence: null, essentialsPerDayPence: 1 }))).toBeNull();
  });
});

describe('pickSmartMove — billCluster (rule 3)', () => {
  it('names the cluster week and suggests spreading due dates', () => {
    const move = pickSmartMove(base({ bills: clusterBills }));
    expect(move).toEqual({
      id: 'billCluster',
      title: 'A crowded week for bills',
      body: '3 of your bills land in the week starting 8 March. Providers will usually move a due date if you ask — spreading them out makes that week lighter.',
    });
  });

  it('three bills spread across more than 7 days are not a cluster', () => {
    const spread = [
      { name: 'Rent', amountPence: 60_000, dueDate: '2026-03-08' },
      { name: 'Energy', amountPence: 8_000, dueDate: '2026-03-10' },
      { name: 'Phone', amountPence: 2_500, dueDate: '2026-03-15' },
    ];
    expect(pickSmartMove(base({ bills: spread }))).toBeNull();
  });

  it('counts every bill inside the window, not just three', () => {
    const four = [...clusterBills, { name: 'Water', amountPence: 3_000, dueDate: '2026-03-09' }];
    const move = mustMove(base({ bills: four }));
    expect(move.body).toContain('4 of your bills');
    expect(move.body).toContain('week starting 8 March');
  });
});

describe('pickSmartMove — buffer (rule 4)', () => {
  it('prices the top-up exactly, rounded up because it is a cost', () => {
    const move = pickSmartMove(base({ bufferPence: 500, safeZonePence: 15_000 }));
    expect(move).toEqual({
      id: 'buffer',
      title: 'Make the early warning real',
      body: 'Moving £15 across tops the buffer up to £20. It costs little of the £150 zone and makes the early warning real.',
    });
  });

  it('a buffer already at £20 needs nothing', () => {
    expect(pickSmartMove(base({ bufferPence: 2_000, safeZonePence: 100_000 }))).toBeNull();
  });

  it('stays quiet when the zone is one pence too thin to cover ten times the gap', () => {
    // gap = 1p, threshold = 10p of zone: 9p stays silent, 10p speaks.
    expect(pickSmartMove(base({ bufferPence: 1_999, safeZonePence: 9 }))).toBeNull();
    const move = mustMove(base({ bufferPence: 1_999, safeZonePence: 10 }));
    expect(move.id).toBe('buffer');
  });
});

describe('pickSmartMove — firstSaving (rule 5)', () => {
  it('offers the first £10 only when the zone genuinely has room', () => {
    const move = pickSmartMove(base({ savingsPence: 0, safeZonePence: 2_000 }));
    expect(move).toEqual({
      id: 'firstSaving',
      title: 'A first £10 put aside',
      body: 'The zone has room: £20 across 10 days. Even £10 set aside makes the next storm one size smaller.',
    });
  });

  it('respects every guard: zone room, savings at zero, days remaining', () => {
    // One pence under the £2/day threshold (2000 * 10 / 10 = 2000p).
    expect(pickSmartMove(base({ savingsPence: 0, safeZonePence: 1_999 }))).toBeNull();
    // Any savings at all means the first £10 already happened.
    expect(pickSmartMove(base({ savingsPence: 1, safeZonePence: 2_000 }))).toBeNull();
    // Payday today — this cycle is over.
    expect(
      pickSmartMove(base({ savingsPence: 0, safeZonePence: 100_000, daysToPayday: 0 })),
    ).toBeNull();
  });
});

describe('pickSmartMove — ranking', () => {
  it('danger beats pace when both apply', () => {
    const move = mustMove(
      base({ dangerDaysAway: 2, runRatePence: 2_000, essentialsPerDayPence: 400 }),
    );
    expect(move.id).toBe('danger');
  });

  it('pace beats billCluster when both apply', () => {
    const move = mustMove(
      base({ runRatePence: 2_000, essentialsPerDayPence: 400, bills: clusterBills }),
    );
    expect(move.id).toBe('pace');
  });

  it('billCluster beats buffer when both apply', () => {
    const move = mustMove(base({ bills: clusterBills, bufferPence: 500, safeZonePence: 15_000 }));
    expect(move.id).toBe('billCluster');
  });

  it('buffer beats firstSaving when both apply', () => {
    const move = mustMove(base({ bufferPence: 500, safeZonePence: 15_000, savingsPence: 0 }));
    expect(move.id).toBe('buffer');
  });
});

describe('pickSmartMove — nothing needs fixing', () => {
  it('returns null on a calm day — the common answer', () => {
    expect(pickSmartMove(base())).toBeNull();
  });
});

describe('pickSmartMove — integer pence discipline', () => {
  it('fractional pence throws, whichever field carries it', () => {
    expect(() => pickSmartMove(base({ safeZonePence: 100.5 }))).toThrow(/integer pence/);
    expect(() => pickSmartMove(base({ runRatePence: 10.5 }))).toThrow(/integer pence/);
    expect(() =>
      pickSmartMove(base({ bills: [{ name: 'Rent', amountPence: 9.99, dueDate: '2026-03-08' }] })),
    ).toThrow(/integer pence/);
  });
});

describe('smart move copy obeys the law', () => {
  const firing: readonly [SmartMove['id'], SmartMoveInputs][] = [
    ['danger', base({ dangerDaysAway: 3 })],
    ['pace', base({ runRatePence: 2_000 })],
    ['billCluster', base({ bills: clusterBills })],
    ['buffer', base({ bufferPence: 500, safeZonePence: 15_000 })],
    ['firstSaving', base({ savingsPence: 0, safeZonePence: 2_000 })],
  ];

  it.each(firing)('%s renders clean and within the title budget', (id, inputs) => {
    const move = mustMove(inputs);
    expect(move.id).toBe(id);
    expect(lintCopy(move.title)).toEqual([]);
    expect(lintCopy(move.body)).toEqual([]);
    expect(move.title.length).toBeLessThanOrEqual(40);
  });
});
