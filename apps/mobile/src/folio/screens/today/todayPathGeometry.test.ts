import { describe, expect, it } from 'vitest';

import { buildTodayPathGeometry } from './todayPathGeometry.js';

describe('buildTodayPathGeometry', () => {
  it('clips a long route at payday so a one-day horizon keeps endpoints legible', () => {
    const route = Array.from({ length: 36 }, (_, index) => ({
      date: `2026-08-${String(index + 24).padStart(2, '0')}`,
      y: index === 0 ? 1800 : index === 1 ? 2200 : 1000,
    }));

    const geometry = buildTodayPathGeometry(route, 1, 134);

    expect(geometry.points).toHaveLength(2);
    expect(geometry.points.map((point) => point.x)).toEqual([30, 370]);
    expect(geometry.points.map((point) => point.label)).toEqual(['today', 'payday']);
    expect(geometry.lowIndex).toBe(0);
  });

  it('keeps a middle lowest-point label while endpoint labels remain unique', () => {
    const route = [
      { date: '2026-08-24', y: 1800 },
      { date: '2026-08-25', y: 2200 },
      { date: '2026-08-26', y: 900 },
      { date: '2026-08-27', y: 2100 },
    ];

    const geometry = buildTodayPathGeometry(route, 3, 134);

    expect(geometry.points.map((point) => point.label)).toEqual(['today', '', 'lowest', 'payday']);
  });

  it('uses the payday-clipped low point when a later route sample is lower', () => {
    const route = [
      { date: '2026-08-24', y: 1800 },
      { date: '2026-08-25', y: 900 },
      { date: '2026-08-26', y: -400 },
    ];

    const geometry = buildTodayPathGeometry(route, 1, 134);

    expect(geometry.points).toHaveLength(2);
    expect(geometry.lowIndex).toBe(1);
    expect(geometry.lowPoint).toEqual(route[1]);
    expect(geometry.lowPoint).not.toEqual(route[2]);
  });
});
