import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: null,
  EncodingType: { UTF8: 'utf8' },
}));

import type { CalendarEvent } from '../store';
import { buildCalendarReminderRequests, reminderFireDate } from './calendarReminders';
import { DEFAULT_REMINDERS_SETTINGS } from './notifySettings';
import { PERSONAL_WORKSPACE_ID } from './workspaceRoot';

const enabled = { ...DEFAULT_REMINDERS_SETTINGS, remindersEnabled: true };

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'deadline-1',
    date: '2026-08-20',
    time: '14:30',
    kind: 'deadline',
    title: 'Private tax detail',
    reminderOffsetMinutes: 24 * 60,
    workspaceId: PERSONAL_WORKSPACE_ID,
    ...overrides,
  };
}

describe('reminderFireDate', () => {
  it('uses device-local date/time and subtracts the requested lead', () => {
    const fireAt = reminderFireDate(event());
    expect(fireAt).not.toBeNull();
    expect(fireAt?.getFullYear()).toBe(2026);
    expect(fireAt?.getMonth()).toBe(7);
    expect(fireAt?.getDate()).toBe(19);
    expect(fireAt?.getHours()).toBe(14);
    expect(fireAt?.getMinutes()).toBe(30);
  });

  it('uses 09:00 for an all-day event and rejects malformed dates/offsets', () => {
    const { time: _time, ...allDay } = event({ reminderOffsetMinutes: 0 });
    const fireAt = reminderFireDate(allDay);
    expect(fireAt?.getHours()).toBe(9);
    expect(reminderFireDate(event({ date: '2026-02-31' }))).toBeNull();
    expect(reminderFireDate(event({ reminderOffsetMinutes: -1 }))).toBeNull();
  });
});

describe('buildCalendarReminderRequests', () => {
  it('defaults to generic lock-screen copy and never includes event content in metadata IDs', () => {
    const requests = buildCalendarReminderRequests(
      PERSONAL_WORKSPACE_ID,
      [event()],
      enabled,
      new Date(2026, 6, 1, 12, 0),
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.title).toBe('Melo reminder');
    expect(requests[0]?.body).toBe('A reminder you chose is due.');
    expect(requests[0]?.logicalId).not.toContain('Private tax detail');
  });

  it('shows the event title only after explicit sensitive-preview opt-in', () => {
    const requests = buildCalendarReminderRequests(
      PERSONAL_WORKSPACE_ID,
      [event()],
      { ...enabled, sensitivePreviews: true },
      new Date(2026, 6, 1, 12, 0),
    );
    expect(requests[0]?.title).toBe('Private tax detail');
    expect(requests[0]?.body).toContain('tomorrow');
  });

  it('skips past reminders and caps critical reminders to three on one day', () => {
    const sameDay = Array.from({ length: 5 }, (_, index) =>
      event({ id: `event-${index}`, time: `1${index}:00`, reminderOffsetMinutes: 0 }),
    );
    expect(
      buildCalendarReminderRequests(
        PERSONAL_WORKSPACE_ID,
        sameDay,
        enabled,
        new Date(2026, 6, 1, 12, 0),
      ),
    ).toHaveLength(3);
    expect(
      buildCalendarReminderRequests(
        PERSONAL_WORKSPACE_ID,
        [event({ date: '2026-01-01' })],
        enabled,
        new Date(2026, 6, 1, 12, 0),
      ),
    ).toEqual([]);
  });

  it('does nothing on a fresh install or when the critical class is disabled', () => {
    expect(
      buildCalendarReminderRequests(PERSONAL_WORKSPACE_ID, [event()], DEFAULT_REMINDERS_SETTINGS),
    ).toEqual([]);
    expect(
      buildCalendarReminderRequests(PERSONAL_WORKSPACE_ID, [event()], {
        ...enabled,
        classEnabled: { ...enabled.classEnabled, critical_deadline: false },
      }),
    ).toEqual([]);
  });

  it('rejects a mixed or unowned calendar collection before scheduling anything', () => {
    expect(() =>
      buildCalendarReminderRequests(
        PERSONAL_WORKSPACE_ID,
        [event({ workspaceId: 'workspace_business_test' as never })],
        enabled,
      ),
    ).toThrow(/not owned/i);
  });
});
