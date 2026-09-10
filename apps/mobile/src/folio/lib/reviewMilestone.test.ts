import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addCycle,
  getPersistBlob,
  getState,
  hydrateFromBlob,
  resetToEmpty,
  setPartial,
  type CycleRecord,
} from '../store';
import { tinyWinMessage, WIN_COPY, type TinyWin } from './wins';
import { deriveMeloMemory } from './melo/memory';

function cycle(day: string, patch: Partial<CycleRecord> = {}): CycleRecord {
  return {
    closedAt: `2026-09-${day}`,
    label: `Review ${day}`,
    spare: 200,
    tightPoint: 20,
    setAside: 0,
    note: '',
    ...patch,
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));
  resetToEmpty();
});
afterEach(() => {
  resetToEmpty();
  vi.useRealTimers();
});

describe('recorded forecast review milestone', () => {
  it('does not award from three reconstructed cycles and one actual review', () => {
    setPartial({ cycles: ['01', '02', '03'].map((day) => cycle(day, { reconstructed: true })) });
    addCycle(cycle('04'));
    expect(getState().tinyWins ?? []).toEqual([]);
  });
  it('awards once for four qualifying recorded reviews and preserves the badge through restart', () => {
    setPartial({ cycles: [cycle('03'), cycle('02'), cycle('01')] });
    addCycle(cycle('04'));
    const wins = getState().tinyWins;
    expect(wins).toHaveLength(1);
    expect(wins![0]).toMatchObject({
      kind: 'four-week-green-streak',
      message: WIN_COPY['four-week-green-streak'],
    });
    expect(tinyWinMessage(wins![0]!)).toBe(
      'Four recorded reviews in a row with forecast balances of £0 or above.',
    );
    addCycle(cycle('05'));
    expect(getState().tinyWins).toEqual(wins);
    hydrateFromBlob(getPersistBlob());
    expect(getState().tinyWins).toEqual(wins);
  });
  it('uses date order and excludes a reconstructed negative row without losing valid recorded reviews', () => {
    setPartial({
      cycles: [
        cycle('01'),
        cycle('03'),
        cycle('05', { reconstructed: true, tightPoint: -10 }),
        cycle('02'),
      ],
    });
    addCycle(cycle('04'));
    expect(getState().tinyWins).toHaveLength(1);
  });
  it('does not award when a real negative forecast interrupts the run', () => {
    setPartial({ cycles: [cycle('03', { tightPoint: -1 }), cycle('02'), cycle('01')] });
    addCycle(cycle('04'));
    expect(getState().tinyWins ?? []).toEqual([]);
  });
  it('neutralizes old persisted safety claims without changing saved milestone identity or text', () => {
    const legacy: TinyWin = {
      id: 'old-award',
      kind: 'four-week-green-streak',
      awardedAt: '2026-08-01T12:00:00Z',
      message: 'Four green cycles in a row. Quiet rhythm.',
    };
    setPartial({ tinyWins: [legacy] });
    hydrateFromBlob(getPersistBlob());
    const stored = getState().tinyWins![0]!;
    expect(stored).toMatchObject(legacy);
    const beforeDisplay = JSON.stringify(stored);
    expect(tinyWinMessage(stored)).toBe('Recorded forecast review milestone.');
    expect(deriveMeloMemory([stored], [])[0]?.line).toBe('Recorded forecast review milestone.');
    expect(JSON.stringify(getState().tinyWins![0])).toBe(beforeDisplay);
  });
  it('does not claim an external subscription was cancelled when its tracking was removed', () => {
    const legacy: TinyWin = {
      id: 'removed',
      kind: 'first-sub-cancelled',
      awardedAt: '2026-08-01T12:00:00Z',
      message: 'One subscription stopped. That saving keeps going.',
    };
    expect(tinyWinMessage(legacy)).toBe(
      'One recurring bill removed from Melo. Its provider schedule is unchanged.',
    );
    expect(deriveMeloMemory([legacy], [])[0]?.line).toBe(tinyWinMessage(legacy));
    expect(legacy.message).toBe('One subscription stopped. That saving keeps going.');
  });
});
