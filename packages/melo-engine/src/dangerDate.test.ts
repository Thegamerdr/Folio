import { describe, expect, it } from 'vitest';

import { projectDangerDate, runwayDays } from './dangerDate.js';

const base = {
  safeZonePence: 18_400,
  runRatePence: 1_500,
  today: '2026-06-30',
  payday: '2026-07-12',
};

describe('projectDangerDate', () => {
  it('returns null when not spending — nothing runs out', () => {
    expect(projectDangerDate({ ...base, runRatePence: 0 })).toBeNull();
  });

  it('danger is today when the safe zone is already gone', () => {
    const r = projectDangerDate({ ...base, safeZonePence: -100 });
    expect(r).toEqual({ date: '2026-06-30', daysAway: 0, confidence: 'high' });
  });

  it('returns null when money outlasts the cycle (boundary: lasts exactly to payday)', () => {
    // 18_400 / 1_500 = 12.26 → floor 12 = daysToPayday → survives the cycle
    expect(projectDangerDate(base)).toBeNull();
  });

  it('projects the storm cell date at the observed run-rate', () => {
    const r = projectDangerDate({ ...base, safeZonePence: 9_000 });
    expect(r).toEqual({ date: '2026-07-06', daysAway: 6, confidence: 'approx' });
  });

  it('confidence hardens within two days', () => {
    const r = projectDangerDate({ ...base, safeZonePence: 3_000 });
    expect(r).toEqual({ date: '2026-07-02', daysAway: 2, confidence: 'high' });
  });

  it('returns null on payday itself — the cycle is over', () => {
    expect(projectDangerDate({ ...base, today: '2026-07-12' })).toBeNull();
  });
});

describe('runwayDays', () => {
  it('is null when not spending', () => {
    expect(runwayDays(18_400, 0)).toBeNull();
  });

  it('is 0 when the zone is already empty', () => {
    expect(runwayDays(-50, 1_500)).toBe(0);
  });

  it('floors the days of runway left', () => {
    expect(runwayDays(9_000, 1_500)).toBe(6);
    expect(runwayDays(9_100, 1_500)).toBe(6);
  });
});
