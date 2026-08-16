import { describe, expect, it } from 'vitest';

import type { Sub } from '../../store';
import { subDueForCheckIn } from './checkIn';

const sub = (name: string, cost: number, renewalCount: number): Sub => ({
  name,
  cost,
  renewalCount,
  nextRenewalDaysAway: 10,
  lastUsedDaysAgo: 0,
  usesPerMonth: 4,
});

describe('subDueForCheckIn', () => {
  it('selects the priciest active subscription on every third renewal', () => {
    expect(
      subDueForCheckIn(
        [sub('Music', 10, 3), sub('Films', 15, 6), sub('Cloud', 20, 4)],
        {},
        {},
        '2026-07-19',
      ),
    ).toEqual({
      name: 'Films',
      cost: 15,
      renewalCount: 6,
      paidSoFar: 90,
    });
  });

  it('skips paused and recently checked subscriptions', () => {
    expect(
      subDueForCheckIn(
        [sub('Music', 10, 3), sub('Films', 15, 6)],
        { Films: true },
        { Music: '2026-07-01' },
        '2026-07-19',
      ),
    ).toBeNull();
  });
});
