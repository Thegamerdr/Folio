// Pure calendar-event → local-notification planning. The native adapter lives in notifications.ts;
// this module can be tested without React Native, permissions, or an emulator.

import type { CalendarEvent } from '../store';
import type { WorkspaceId } from '@folio/domain';
import type { ScheduledLocalNotification } from './notificationRequests';
import type { RemindersSettings } from './notifySettings';

const DEFAULT_ALL_DAY_TIME = '09:00';
const MAX_CRITICAL_REMINDERS_PER_DAY = 3;
const MAX_PENDING_REMINDERS = 50; // stays below iOS's 64 pending-notification ceiling.
const MAX_OFFSET_MINUTES = 366 * 24 * 60;

function parseLocalDateTime(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (dateMatch === null || timeMatch === null) return null;
  const [, yearRaw = '', monthRaw = '', dayRaw = ''] = dateMatch;
  const [, hourRaw = '', minuteRaw = ''] = timeMatch;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (month < 1 || month > 12 || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const value = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    value.getFullYear() !== year ||
    value.getMonth() !== month - 1 ||
    value.getDate() !== day ||
    value.getHours() !== hour ||
    value.getMinutes() !== minute
  ) {
    return null;
  }
  return value;
}

export function reminderFireDate(event: CalendarEvent): Date | null {
  const offset = event.reminderOffsetMinutes;
  if (
    !Number.isInteger(offset) ||
    offset === undefined ||
    offset < 0 ||
    offset > MAX_OFFSET_MINUTES
  ) {
    return null;
  }
  const due = parseLocalDateTime(event.date, event.time ?? DEFAULT_ALL_DAY_TIME);
  return due === null ? null : new Date(due.getTime() - offset * 60_000);
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function timingBody(event: CalendarEvent): string {
  const time = event.time ?? DEFAULT_ALL_DAY_TIME;
  if (event.reminderOffsetMinutes === 0) return `Due today at ${time}.`;
  if (event.reminderOffsetMinutes === 60) return `Due in one hour at ${time}.`;
  if (event.reminderOffsetMinutes === 24 * 60) return `Due tomorrow at ${time}.`;
  if (event.reminderOffsetMinutes === 7 * 24 * 60) return `Due in one week at ${time}.`;
  return `Due at ${time}.`;
}

/**
 * Build the future critical-deadline schedule. Stable logical IDs plus owned replacement in the
 * adapter provide same-event deduplication across edits and restarts.
 */
export function buildCalendarReminderRequests(
  workspaceId: WorkspaceId,
  events: readonly CalendarEvent[],
  settings: RemindersSettings,
  now = new Date(),
): ScheduledLocalNotification[] {
  if (
    !settings.remindersEnabled ||
    !settings.classEnabled.critical_deadline ||
    events.length === 0
  ) {
    return [];
  }
  for (const event of events) {
    if (String(event.workspaceId ?? '') !== String(workspaceId)) {
      throw new Error(`Calendar event ${event.id} is not owned by the active workspace.`);
    }
  }

  const candidates = events
    .map((event) => ({ event, fireAt: reminderFireDate(event) }))
    .filter(
      (candidate): candidate is { event: CalendarEvent; fireAt: Date } =>
        candidate.fireAt !== null && candidate.fireAt.getTime() > now.getTime(),
    )
    .sort((left, right) => left.fireAt.getTime() - right.fireAt.getTime());

  const perDay = new Map<string, number>();
  const output: ScheduledLocalNotification[] = [];
  for (const { event, fireAt } of candidates) {
    const day = localDayKey(fireAt);
    const used = perDay.get(day) ?? 0;
    if (used >= MAX_CRITICAL_REMINDERS_PER_DAY) continue;
    perDay.set(day, used + 1);
    const time = event.time ?? DEFAULT_ALL_DAY_TIME;
    output.push({
      workspaceId,
      logicalId: `calendar:${event.id}:${event.date}:${time}:${event.reminderOffsetMinutes}`,
      owner: 'calendar',
      notificationClass: 'critical_deadline',
      title: settings.sensitivePreviews ? event.title : 'Melo reminder',
      body: settings.sensitivePreviews ? timingBody(event) : 'A reminder you chose is due.',
      fireAt,
      eventId: event.id,
    });
    if (output.length >= MAX_PENDING_REMINDERS) break;
  }
  return output;
}
