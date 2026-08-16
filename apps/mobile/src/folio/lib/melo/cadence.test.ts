import { beforeEach, describe, expect, it } from 'vitest';

import {
  __resetMeloCadence,
  heroSlotAvailable,
  releaseCelebrateSlotForNewCycle,
  takeCelebrateSlot,
  takeHeroSlot,
} from './cadence';

beforeEach(__resetMeloCadence);

describe('Melo cadence', () => {
  it('grants two hero moments per session', () => {
    expect(takeHeroSlot()).toBe(true);
    expect(takeHeroSlot()).toBe(true);
    expect(heroSlotAvailable()).toBe(false);
    expect(takeHeroSlot()).toBe(false);
  });

  it('grants one celebration until a new cycle releases it', () => {
    expect(takeCelebrateSlot('cycle-a')).toBe(true);
    expect(takeCelebrateSlot('cycle-a')).toBe(false);
    expect(takeCelebrateSlot('cycle-b')).toBe(false);
    releaseCelebrateSlotForNewCycle();
    expect(takeCelebrateSlot('cycle-b')).toBe(true);
  });
});
