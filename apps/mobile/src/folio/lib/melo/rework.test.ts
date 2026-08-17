import { describe, expect, it, vi } from 'vitest';

import type { Nav } from '../../types';
import type { CycleRecord } from '../../store';
import { makeWin } from '../wins';
import { isDampened } from './dismissReasons';
import { deriveMeloMemory } from './memory';
import { deriveOneMove } from './oneMove';
import { computeGreenStreak } from '../streaks';
import { poseForContext } from './poseForContext';

function nav(): Nav {
  return {
    go: vi.fn(),
    back: vi.fn(),
    openSheet: vi.fn(),
    openMelo: vi.fn(),
    setPressure: vi.fn(),
  };
}

function cycle(closedAt: string, tightPoint: number, spare: number): CycleRecord {
  return {
    closedAt,
    label: closedAt,
    tightPoint,
    spare,
    setAside: 0,
    note: '',
  };
}

describe('Melo rework engines', () => {
  it('ranks review ahead of recovery and stays quiet after a matching dismissal', () => {
    const movement = deriveOneMove({
      reviewCount: 2,
      tightPoint: -10,
      cycleOverdueDays: 3,
      caughtSubName: 'Music',
      nav: nav(),
    });
    expect(movement?.key).toBe('review');
    expect(movement?.kind).toBe('wait');

    const dampened = deriveOneMove({
      reviewCount: 2,
      tightPoint: 40,
      cycleOverdueDays: 0,
      caughtSubName: null,
      nav: nav(),
      now: new Date('2026-07-19T10:00:00.000Z'),
      dismissLog: [
        {
          kind: 'review',
          reason: 'just-no',
          at: '2026-07-18T10:00:00.000Z',
        },
      ],
    });
    expect(dampened).toBeNull();
  });

  it('applies reason-specific dismissal windows', () => {
    const log = [
      {
        kind: 'review',
        reason: 'not-now' as const,
        at: '2026-07-15T10:00:00.000Z',
      },
    ];
    expect(isDampened('review', log, new Date('2026-07-17T09:00:00.000Z'))).toBe(true);
    expect(isDampened('review', log, new Date('2026-07-19T10:00:00.000Z'))).toBe(false);
  });

  it('builds memory only from proven wins and cycles, newest first', () => {
    const win = {
      ...makeWin('first-sub-cancelled'),
      awardedAt: '2026-07-18T08:00:00.000Z',
    };
    const memory = deriveMeloMemory(
      [win],
      [cycle('2026-07-17', 20, 10), cycle('2026-07-16', -5, 2)],
    );
    expect(memory.map((event) => event.kind)).toEqual(['win', 'cycle-green', 'cycle-red']);
  });

  it('counts only the uninterrupted newest safe-zone run', () => {
    expect(
      computeGreenStreak([
        cycle('2026-07-18', 10, 20),
        cycle('2026-07-17', 1, 2),
        cycle('2026-07-16', -1, 10),
        cycle('2026-07-15', 20, 20),
      ]),
    ).toBe(2);
  });

  it('uses the refrozen context pose authority, including quiet and runway thresholds', () => {
    expect(poseForContext('recovery')).toEqual({ mood: 'protect', asleep: false });
    expect(poseForContext('insights')).toEqual({ mood: 'think', asleep: false });
    expect(poseForContext('today', { pathBendPct: 0.11, cleanStreakDays: 8 })).toEqual({
      mood: 'concern',
      asleep: false,
    });
    expect(poseForContext('biz-runway', { runwayDays: 90 })).toEqual({
      mood: 'cheer',
      asleep: false,
    });
    expect(poseForContext('today', { quietMode: true })).toEqual({
      mood: 'calm',
      asleep: true,
    });
  });
});
