import { describe, expect, it } from 'vitest';
import { delayUntilNextLocalDay, localDayKey, utcMidnightForLocalDay } from './dayClock';

describe('shared day clock', () => {
  it('uses the local calendar day at month/year boundaries', () => {
    expect(localDayKey(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31');
    expect(localDayKey(new Date(2027, 0, 1, 0, 0, 1))).toBe('2027-01-01');
  });

  it('schedules the next local midnight, including the current payday boundary', () => {
    const now = new Date(2026, 7, 28, 23, 59, 59, 500);
    expect(delayUntilNextLocalDay(now)).toBe(500);
    expect(localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))).toBe(
      '2026-08-29',
    );
  });

  it('keeps a local day stable for UTC-sliced calendar engines', () => {
    const local = new Date(2026, 8, 5, 15, 30);
    expect(utcMidnightForLocalDay(local).toISOString()).toBe('2026-09-05T00:00:00.000Z');
  });
});
