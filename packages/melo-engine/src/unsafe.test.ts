import { describe, expect, it } from 'vitest';

import { lintCopy } from './copy.js';
import { assessUnsafe, type UnsafeInputs, type UnsafeOption } from './unsafe.js';

/**
 * Base sits EXACTLY on the structural boundary: balance 700.00 = shielded 600.00 +
 * essentials £10/day × 10 days — the cycle just closes, so structural is false.
 * Overrides push it under and light up options one at a time.
 */
const base = (over: Partial<UnsafeInputs> = {}): UnsafeInputs => ({
  todayISO: '2026-03-02',
  payday: '2026-03-12',
  incomePence: 200_000,
  balancePence: 70_000,
  shieldedBillsPence: 60_000,
  essentialsPerDayPence: 1_000,
  daysToPayday: 10,
  bills: [],
  structuralCycleCount: 0,
  ...over,
});

const cycleBills = [
  { name: 'Rent', amountPence: 60_000, dueDate: '2026-03-08' },
  { name: 'Phone', amountPence: 2_500, dueDate: '2026-03-05' },
];

const optionIds = (inputs: UnsafeInputs): UnsafeOption['id'][] =>
  assessUnsafe(inputs).options.map((o) => o.id);

const mustOption = (inputs: UnsafeInputs, id: UnsafeOption['id']): UnsafeOption => {
  const option = assessUnsafe(inputs).options.find((o) => o.id === id);
  if (!option)
    throw new Error(`expected option ${id}, got ${optionIds(inputs).join(',') || 'none'}`);
  return option;
};

describe('assessUnsafe — the structural boundary', () => {
  it('a cycle that exactly closes is not structural: gap 0, no options, no signpost', () => {
    expect(assessUnsafe(base())).toEqual({
      structural: false,
      gapPence: 0,
      options: [],
      signpost: false,
      signpostLines: [],
    });
  });

  it('one pence under the boundary is structural, and the gap is that one pence', () => {
    const state = assessUnsafe(base({ balancePence: 69_999 }));
    expect(state.structural).toBe(true);
    expect(state.gapPence).toBe(1);
  });

  it('the gap is exact pence arithmetic: shielded + essentials × days − balance', () => {
    const state = assessUnsafe(base({ balancePence: 40_000 }));
    expect(state.gapPence).toBe(30_000); // 60_000 + 1_000 × 10 − 40_000
  });
});

describe('assessUnsafe — shiftBill', () => {
  it('names the actual bill and its amount when moving it closes at least a quarter of the gap', () => {
    const option = mustOption(base({ balancePence: 40_000, bills: cycleBills }), 'shiftBill');
    expect(option).toEqual({
      id: 'shiftBill',
      title: 'Move one bill past payday',
      body: 'Rent (£600) is due before payday. Providers will usually move a due date if you ask — shifting it to after payday keeps that £600 in this cycle.',
    });
  });

  it('a bill due after payday cannot be shifted past it — the option never appears', () => {
    const bills = [{ name: 'Rent', amountPence: 60_000, dueDate: '2026-03-15' }];
    expect(optionIds(base({ balancePence: 40_000, bills }))).not.toContain('shiftBill');
  });

  it('a bill closing under a quarter of the gap is not worth naming', () => {
    const bills = [{ name: 'Phone', amountPence: 2_500, dueDate: '2026-03-05' }];
    // gap 30_000; 2_500 × 4 = 10_000 < 30_000 — shift stays quiet (pause may still speak).
    expect(optionIds(base({ balancePence: 40_000, bills }))).not.toContain('shiftBill');
  });

  it('fires exactly at the quarter-gap boundary and not one pence below it', () => {
    // shielded 40_000 + essentials 10_000 − balance 40_000 → gap 10_000; quarter = 2_500.
    const at = base({
      shieldedBillsPence: 40_000,
      balancePence: 40_000,
      bills: [{ name: 'Gym', amountPence: 2_500, dueDate: '2026-03-06' }],
    });
    expect(optionIds(at)).toContain('shiftBill');
    const under = base({
      shieldedBillsPence: 40_000,
      balancePence: 40_000,
      bills: [{ name: 'Gym', amountPence: 2_499, dueDate: '2026-03-06' }],
    });
    expect(optionIds(under)).not.toContain('shiftBill');
  });
});

describe('assessUnsafe — trimEssentials', () => {
  // Essentials £20/day for 10 days: a 15% trim is £3/day, £30 across the stretch.
  const trimBase = (over: Partial<UnsafeInputs> = {}): UnsafeInputs =>
    base({ shieldedBillsPence: 20_000, essentialsPerDayPence: 2_000, ...over });

  it('states both per-day figures exactly and what the trim frees', () => {
    const option = mustOption(trimBase({ balancePence: 36_000 }), 'trimEssentials'); // gap 4_000
    expect(option).toEqual({
      id: 'trimEssentials',
      title: 'Trim the daily essentials',
      body: 'Essentials are planned at £20/day. Trimming to £17/day until payday frees £30 toward the gap.',
    });
  });

  it('fires exactly where the trim covers a quarter of the gap, and not one pence past it', () => {
    // Trim total 3_000 → quarter-gap threshold is gap ≤ 12_000.
    expect(optionIds(trimBase({ balancePence: 28_000 }))).toContain('trimEssentials'); // gap 12_000
    expect(optionIds(trimBase({ balancePence: 27_999 }))).not.toContain('trimEssentials'); // gap 12_001
  });

  it('stays quiet when the trim closes under a quarter of the gap', () => {
    expect(optionIds(base({ balancePence: 40_000 }))).not.toContain('trimEssentials');
    // gap 30_000; trim total 1_500 → 6_000 < 30_000.
  });
});

describe('assessUnsafe — pauseSmallest', () => {
  it('names the smallest in-cycle bill when it fits inside the gap', () => {
    const option = mustOption(base({ balancePence: 40_000, bills: cycleBills }), 'pauseSmallest');
    expect(option).toEqual({
      id: 'pauseSmallest',
      title: 'Pause the smallest bill',
      body: 'Phone (£25) is the smallest bill this cycle. Pausing it for one cycle is a real option — providers would rather hear from you than not.',
    });
  });

  it('a smallest bill larger than the gap is never offered — pausing it would be theatre', () => {
    const bills = [{ name: 'Rent', amountPence: 60_000, dueDate: '2026-03-08' }];
    const ids = optionIds(base({ balancePence: 40_000, bills })); // gap 30_000 < 60_000
    expect(ids).toContain('shiftBill');
    expect(ids).not.toContain('pauseSmallest');
  });
});

describe('assessUnsafe — option ordering by impact', () => {
  it('largest gap-closer speaks first: shift £60 > trim £30 > pause £5', () => {
    const inputs = base({
      shieldedBillsPence: 20_000,
      essentialsPerDayPence: 2_000,
      balancePence: 36_000, // gap 4_000
      bills: [
        { name: 'Rent', amountPence: 6_000, dueDate: '2026-03-08' },
        { name: 'Water', amountPence: 500, dueDate: '2026-03-05' },
      ],
    });
    expect(optionIds(inputs)).toEqual(['shiftBill', 'trimEssentials', 'pauseSmallest']);
  });

  it('when the trim outweighs the shiftable bill, the trim leads; ties keep shift ahead of pause', () => {
    const inputs = base({
      shieldedBillsPence: 20_000,
      essentialsPerDayPence: 10_000, // trim: £15/day × 10 = 15_000
      balancePence: 100_000, // gap 20_000
      bills: [{ name: 'Rent', amountPence: 6_000, dueDate: '2026-03-08' }], // shift 6_000 = pause 6_000
    });
    expect(optionIds(inputs)).toEqual(['trimEssentials', 'shiftBill', 'pauseSmallest']);
  });

  it('never offers more than three moves, and none at all when nothing real qualifies', () => {
    const all = base({
      shieldedBillsPence: 20_000,
      essentialsPerDayPence: 2_000,
      balancePence: 36_000,
      bills: [
        { name: 'Rent', amountPence: 6_000, dueDate: '2026-03-08' },
        { name: 'Water', amountPence: 500, dueDate: '2026-03-05' },
      ],
    });
    expect(assessUnsafe(all).options).toHaveLength(3);
    // Structural with no bills and a trim too small to matter: honesty over noise.
    expect(assessUnsafe(base({ balancePence: 40_000 })).options).toEqual([]);
  });
});

describe('assessUnsafe — the signpost', () => {
  it('one structural cycle is weather, not a pattern: no signpost at count 1', () => {
    const state = assessUnsafe(base({ balancePence: 40_000, structuralCycleCount: 1 }));
    expect(state.signpost).toBe(false);
    expect(state.signpostLines).toEqual([]);
  });

  it('at the second structural cycle, free help is named: StepChange and Citizens Advice', () => {
    const state = assessUnsafe(base({ balancePence: 40_000, structuralCycleCount: 2 }));
    expect(state.signpost).toBe(true);
    expect(state.signpostLines).toHaveLength(2);
    const joined = state.signpostLines.join(' ');
    expect(joined).toContain('StepChange');
    expect(joined).toContain('0800 138 1111');
    expect(joined).toContain('stepchange.org');
    expect(joined).toContain('Citizens Advice');
    expect(joined).toContain('free');
  });

  it('a cycle that fits shows no signpost, whatever the history says', () => {
    const state = assessUnsafe(base({ structuralCycleCount: 5 }));
    expect(state.signpost).toBe(false);
    expect(state.signpostLines).toEqual([]);
  });
});

describe('assessUnsafe — every user-facing string obeys the copy law', () => {
  it('all three option titles and bodies lint clean, within the title budget', () => {
    const state = assessUnsafe(
      base({
        shieldedBillsPence: 20_000,
        essentialsPerDayPence: 2_000,
        balancePence: 36_000,
        bills: [
          { name: 'Rent', amountPence: 6_000, dueDate: '2026-03-08' },
          { name: 'Water', amountPence: 500, dueDate: '2026-03-05' },
        ],
      }),
    );
    expect(state.options).toHaveLength(3);
    for (const option of state.options) {
      expect(lintCopy(option.title)).toEqual([]);
      expect(lintCopy(option.body)).toEqual([]);
      expect(option.title.length).toBeLessThanOrEqual(40);
    }
  });

  it('both signpost lines lint clean', () => {
    const state = assessUnsafe(base({ balancePence: 40_000, structuralCycleCount: 3 }));
    expect(state.signpostLines).toHaveLength(2);
    for (const line of state.signpostLines) {
      expect(lintCopy(line)).toEqual([]);
    }
  });
});

describe('assessUnsafe — integer pence discipline', () => {
  it('fractional pence throws, whichever field carries it', () => {
    expect(() => assessUnsafe(base({ balancePence: 100.5 }))).toThrow(/integer pence/);
    expect(() => assessUnsafe(base({ incomePence: 1.5 }))).toThrow(/integer pence/);
    expect(() => assessUnsafe(base({ shieldedBillsPence: 0.5 }))).toThrow(/integer pence/);
    expect(() => assessUnsafe(base({ essentialsPerDayPence: 10.5 }))).toThrow(/integer pence/);
    expect(() =>
      assessUnsafe(base({ bills: [{ name: 'Rent', amountPence: 9.99, dueDate: '2026-03-08' }] })),
    ).toThrow(/integer pence/);
  });

  it('a malformed date fails fast', () => {
    expect(() => assessUnsafe(base({ todayISO: 'not-a-date' }))).toThrow(/invalid ISO date/);
  });
});
