import { describe, expect, it } from 'vitest';

import { lintCopy } from './copy.js';
import { diffChanges, type WhatChangedContext, type WhatChangedSnapshot } from './whatChanged.js';

const snap = (over: Partial<WhatChangedSnapshot> = {}): WhatChangedSnapshot => ({
  balancePence: 10_000,
  dangerDaysAway: null,
  safeZonePence: 20_000,
  ...over,
});

const ctx = (over: Partial<WhatChangedContext> = {}): WhatChangedContext => ({
  runRatePence: null,
  billLandedName: null,
  ...over,
});

describe('diffChanges — first run and quiet days', () => {
  it('returns [] when prev is null — nothing to compare yet', () => {
    expect(diffChanges(null, snap(), ctx())).toEqual([]);
  });

  it('returns [] when nothing real moved', () => {
    expect(diffChanges(snap(), snap(), ctx())).toEqual([]);
  });

  it('stays quiet on a balance wobble at or under the £25 threshold', () => {
    expect(
      diffChanges(snap({ balancePence: 10_000 }), snap({ balancePence: 12_500 }), ctx()),
    ).toEqual([]);
  });
});

describe('diffChanges — balance moved', () => {
  it('reports a rise over £25', () => {
    const items = diffChanges(
      snap({ balancePence: 10_000 }),
      snap({ balancePence: 13_000 }),
      ctx(),
    );
    expect(items).toEqual([{ id: 'balanceMoved', line: 'Balance is up £30, now £130.' }]);
  });

  it('reports a fall over £25', () => {
    const items = diffChanges(
      snap({ balancePence: 13_000 }),
      snap({ balancePence: 10_000 }),
      ctx(),
    );
    expect(items).toEqual([{ id: 'balanceMoved', line: 'Balance is down £30, now £100.' }]);
  });

  it('fires one pence above the threshold', () => {
    const items = diffChanges(
      snap({ balancePence: 10_000 }),
      snap({ balancePence: 12_501 }),
      ctx(),
    );
    expect(items[0]?.id).toBe('balanceMoved');
  });
});

describe('diffChanges — danger date', () => {
  it('reports a danger day appearing', () => {
    const items = diffChanges(snap({ dangerDaysAway: null }), snap({ dangerDaysAway: 3 }), ctx());
    expect(items).toEqual([
      { id: 'dangerAppeared', line: 'A tight day now shows up, 3 days away.' },
    ]);
  });

  it('uses singular "day" for exactly one day away', () => {
    const items = diffChanges(snap({ dangerDaysAway: null }), snap({ dangerDaysAway: 1 }), ctx());
    expect(items[0]?.line).toBe('A tight day now shows up, 1 day away.');
  });

  it('reports a danger day clearing', () => {
    const items = diffChanges(snap({ dangerDaysAway: 3 }), snap({ dangerDaysAway: null }), ctx());
    expect(items).toEqual([{ id: 'dangerCleared', line: 'The tight day cleared off the map.' }]);
  });

  it('reports the danger day moving earlier', () => {
    const items = diffChanges(snap({ dangerDaysAway: 5 }), snap({ dangerDaysAway: 2 }), ctx());
    expect(items).toEqual([
      { id: 'dangerMovedEarlier', line: 'The tight day moved closer, now 2 days away.' },
    ]);
  });

  it('reports the danger day moving later', () => {
    const items = diffChanges(snap({ dangerDaysAway: 2 }), snap({ dangerDaysAway: 5 }), ctx());
    expect(items).toEqual([
      { id: 'dangerMovedLater', line: 'The tight day moved further out, now 5 days away.' },
    ]);
  });
});

describe('diffChanges — safe zone crossing zero', () => {
  it('reports dropping below zero', () => {
    const items = diffChanges(snap({ safeZonePence: 500 }), snap({ safeZonePence: -500 }), ctx());
    expect(items).toEqual([
      { id: 'safeZoneCrossedZero', line: 'The safe zone dropped below zero.' },
    ]);
  });

  it('reports rising back above zero', () => {
    const items = diffChanges(snap({ safeZonePence: -500 }), snap({ safeZonePence: 700 }), ctx());
    expect(items).toEqual([
      { id: 'safeZoneCrossedZero', line: 'The safe zone is back above zero, at £7.' },
    ]);
  });

  it('stays quiet when both sides are negative (no crossing)', () => {
    expect(
      diffChanges(snap({ safeZonePence: -100 }), snap({ safeZonePence: -900 }), ctx()),
    ).toEqual([]);
  });
});

describe('diffChanges — bill landed', () => {
  it('reports a named bill landing from ctx', () => {
    const items = diffChanges(snap(), snap(), ctx({ billLandedName: 'Energy' }));
    expect(items).toEqual([{ id: 'billLanded', line: 'Energy landed.' }]);
  });

  it('says nothing when no bill landed', () => {
    expect(diffChanges(snap(), snap(), ctx({ billLandedName: null }))).toEqual([]);
  });
});

describe('diffChanges — combined and copy law', () => {
  it('reports every real change together, in order', () => {
    const items = diffChanges(
      snap({ balancePence: 10_000, dangerDaysAway: null, safeZonePence: -100 }),
      snap({ balancePence: 13_500, dangerDaysAway: 3, safeZonePence: 400 }),
      ctx({ billLandedName: 'Rent' }),
    );
    expect(items.map((i) => i.id)).toEqual([
      'balanceMoved',
      'dangerAppeared',
      'safeZoneCrossedZero',
      'billLanded',
    ]);
  });

  it('every produced line passes lintCopy', () => {
    const items = diffChanges(
      snap({ balancePence: 10_000, dangerDaysAway: 5, safeZonePence: -100 }),
      snap({ balancePence: 13_500, dangerDaysAway: 2, safeZonePence: 400 }),
      ctx({ billLandedName: 'Rent' }),
    );
    for (const item of items) expect(lintCopy(item.line)).toEqual([]);
  });
});

describe('diffChanges — integer pence discipline', () => {
  it('fractional pence throws', () => {
    expect(() => diffChanges(snap({ balancePence: 100.5 }), snap(), ctx())).toThrow(
      /integer pence/,
    );
    expect(() => diffChanges(snap(), snap({ safeZonePence: 10.1 }), ctx())).toThrow(
      /integer pence/,
    );
    expect(() => diffChanges(snap(), snap(), ctx({ runRatePence: 9.9 }))).toThrow(/integer pence/);
  });
});
