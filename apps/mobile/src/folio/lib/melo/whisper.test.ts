import { describe, expect, it } from 'vitest';

import type { CycleRecord, Sub } from '../../store';
import { deriveWhisper } from './whisper';

const cycles: CycleRecord[] = [
  { closedAt: '2026-07-01', label: 'July', spare: 20, tightPoint: 5, setAside: 0, note: '' },
  { closedAt: '2026-06-01', label: 'June', spare: 20, tightPoint: 5, setAside: 0, note: '' },
  { closedAt: '2026-05-01', label: 'May', spare: 20, tightPoint: 5, setAside: 0, note: '' },
];
const subs: Sub[] = [
  {
    name: 'Music',
    cost: 10,
    nextRenewalDaysAway: 5,
    lastUsedDaysAgo: 0,
    usesPerMonth: 4,
  },
  {
    name: 'Films',
    cost: 15,
    nextRenewalDaysAway: 8,
    lastUsedDaysAgo: 0,
    usesPerMonth: 4,
  },
];

describe('deriveWhisper', () => {
  it('uses the live signal precedence on Sunday', () => {
    expect(
      deriveWhisper({
        now: new Date('2026-07-19T12:00:00'),
        quietMode: false,
        subs,
        subPaused: { Music: true, Films: true },
        tightestSpare: 300,
        cycles,
      }),
    ).toEqual({
      key: 'streak-3',
      line: 'Three cycles in the safe zone. Quiet, steady, yours.',
    });
  });

  it('stays silent outside Sun/Mon and in Quiet Mode', () => {
    const base = {
      subs,
      subPaused: {},
      tightestSpare: 300,
      cycles: [],
    };
    expect(
      deriveWhisper({ ...base, now: new Date('2026-07-21T12:00:00'), quietMode: false }),
    ).toBeNull();
    expect(
      deriveWhisper({ ...base, now: new Date('2026-07-19T12:00:00'), quietMode: true }),
    ).toBeNull();
  });
});
