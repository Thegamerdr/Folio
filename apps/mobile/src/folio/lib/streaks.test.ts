import { describe, expect, it } from 'vitest';
import type { CycleRecord } from '../store';
import { computeGreenStreak } from './streaks';

function cycle(closedAt: string, tightPoint = 20, spare = 200): CycleRecord {
  return { closedAt, label: closedAt, tightPoint, spare, setAside: 0, note: '' };
}

describe('recorded forecast review streak', () => {
  it('never awards a completed review from reconstructed history', () => {
    expect(computeGreenStreak([{ ...cycle('2026-09-30'), reconstructed: true }])).toBe(0);
  });
  it('ignores reconstructed history between recorded reviews without counting or breaking the run', () => {
    expect(
      computeGreenStreak([
        cycle('2026-09-10'),
        { ...cycle('2026-08-31', -100, -20), reconstructed: true },
        cycle('2026-08-10'),
      ]),
    ).toBe(2);
  });
  it('sorts review dates and stops at the first recorded negative forecast', () => {
    const cycles = [cycle('2026-07-10'), cycle('2026-09-10'), cycle('2026-08-10', -1)];
    expect(computeGreenStreak(cycles)).toBe(1);
    expect(cycles[0]?.closedAt).toBe('2026-07-10');
  });
  it('counts zero as a non-negative forecast without asserting financial safety', () => {
    expect(computeGreenStreak([cycle('2026-09-10', 0, 0)])).toBe(1);
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    'does not count an invalid forecast (%s)',
    (value) => {
      expect(computeGreenStreak([cycle('2026-09-10', value)])).toBe(0);
      expect(computeGreenStreak([cycle('2026-09-10', 20, value)])).toBe(0);
    },
  );
});
