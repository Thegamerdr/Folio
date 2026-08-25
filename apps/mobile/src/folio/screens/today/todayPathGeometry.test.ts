import { describe, expect, it } from 'vitest';

import {
  buildTodayJourneyEvents,
  buildTodayJourneyGeometry,
  buildTodayPathGeometry,
  summarizeTodayCycleFlows,
} from './todayPathGeometry.js';

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

describe('Today source-authoritative journey', () => {
  const now = new Date('2026-08-18T00:00:00');

  it('uses one vertical scale and the same full-window tight amount as the hero', () => {
    const points = buildTodayJourneyGeometry({
      now,
      todayAmount: 1500,
      tightAmount: 325,
      tightDate: '2026-09-10',
      paydayAmount: 2925,
    });

    expect(points.map((point) => point.label)).toEqual(['today', 'tightest', 'payday']);
    expect(points[1]?.value).toBe('£325');
    expect(points[1]?.y).toBeGreaterThan(points[0]?.y ?? 0);
    expect(points[1]?.y).toBeGreaterThan(points[2]?.y ?? 0);
    expect(points[1]?.x).toBeGreaterThan(70);
  });

  it('selects the two largest real pre-payday movements and preserves their labels', () => {
    const movements = buildTodayJourneyEvents(
      [
        { date: '2026-08-21', title: 'Council Tax', amount: -120 },
        { date: '2026-08-23', title: 'Energy', amount: -68 },
        { date: '2026-08-24', title: 'Coffee', amount: -4 },
        { date: '2026-08-29', title: 'After payday', amount: -999 },
      ],
      now,
      '2026-08-28',
      320,
    );

    expect(movements.map((event) => event.label)).toEqual(['Council Tax', 'Energy']);
    expect(movements.map((event) => event.amount)).toEqual([-120, -68]);
  });

  it('summarizes projected incoming and outgoing movements through payday', () => {
    expect(
      summarizeTodayCycleFlows(
        [
          { date: '2026-08-20', amount: -120 },
          { date: '2026-08-22', amount: -68 },
          { date: '2026-08-28', amount: 2600 },
          { date: '2026-08-29', amount: -999 },
        ],
        '2026-08-28',
      ),
    ).toEqual({ incoming: 2600, outgoing: 188 });
  });
});
