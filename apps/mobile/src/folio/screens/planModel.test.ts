import { describe, expect, it } from 'vitest';

import type { DerivedEvent } from '@/folio/lib/calendarEvents';
import { buildPlanTightPoint, buildPlanUpcoming, shortPlanDay } from './planModel';

function event(patch: Partial<DerivedEvent>): DerivedEvent {
  return {
    id: 'event',
    date: '2026-09-01',
    kind: 'out',
    title: 'Council Tax',
    amount: -162,
    source: 'manual',
    ...patch,
  };
}

describe('pinned Plan Hub model', () => {
  it('keeps every negative outgoing in engine order, including dates after payday', () => {
    const rows = buildPlanUpcoming([
      event({ id: 'before', date: '2026-08-22', amount: -118.4, note: 'Variable' }),
      event({ id: 'payday', date: '2026-08-28', kind: 'in', amount: 2600 }),
      event({ id: 'review', date: '2026-09-01', kind: 'review' }),
      event({ id: 'after', date: '2026-09-11', title: 'Rent', amount: -540 }),
    ]);

    expect(rows).toEqual([
      {
        id: 'before',
        date: '2026-08-22',
        name: 'Council Tax',
        amount: 118.4,
        note: 'Variable',
      },
      { id: 'after', date: '2026-09-11', name: 'Rent', amount: 540, note: '' },
    ]);
  });

  it('uses the source short weekday-and-day label', () => {
    expect(shortPlanDay('2026-09-01')).toBe('Tue 1');
  });

  it('projects the pinned Plan tight point from displayed balance and calendar events', () => {
    expect(
      buildPlanTightPoint(
        [
          event({ id: 'council', date: '2026-08-20', amount: -120 }),
          event({ id: 'buffer', date: '2026-08-21', amount: -30 }),
          event({ id: 'holiday', date: '2026-08-21', amount: -45 }),
          event({ id: 'energy', date: '2026-08-22', amount: -68 }),
          event({ id: 'payday', date: '2026-08-28', kind: 'in', amount: 2600 }),
        ],
        1480,
      ),
    ).toEqual({ date: '2026-08-22', amount: 1217 });
  });
});
