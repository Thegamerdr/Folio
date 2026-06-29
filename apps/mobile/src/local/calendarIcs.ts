/**
 * Pure ICS (RFC 5545) serializer for the RN Calendar. Mirrors the web src/lib/ics.ts shape (all-day
 * VEVENTs, DTSTART;VALUE=DATE) but reads the RN DerivedCalendarEvent (integer minor amounts). No I/O —
 * the native share / file-save sheet that hands this string to the OS is Phase 2.
 */
import { formatMinorAmount } from './localLedger.js';
import type { DerivedCalendarEvent } from './calendarEvents.js';

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

// ICS VALUE=DATE format: YYYYMMDD (strip the dashes off an ISO day).
function dateOnly(dateIso: string): string {
  return dateIso.replace(/-/g, '');
}

function dtStamp(now: Date): string {
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  );
}

// RFC 5545 TEXT escaping: backslash, newline, comma, semicolon.
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function summaryFor(event: DerivedCalendarEvent): string {
  const tag =
    event.kind === 'in'
      ? '↑'
      : event.kind === 'out'
        ? '↓'
        : event.kind === 'deadline'
          ? '•'
          : event.kind === 'review'
            ? '?'
            : '·';
  const amount =
    typeof event.amountMinor === 'number'
      ? ` · ${event.amountMinor >= 0 ? '+' : '−'}${formatMinorAmount(Math.abs(event.amountMinor))}`
      : '';
  return `${tag} ${event.title}${amount}`;
}

/**
 * Serialize derived calendar events to an ICS string. `now` is injectable so the DTSTAMP is
 * deterministic in tests; it defaults to the current instant in production.
 */
export function buildIcs(events: readonly DerivedCalendarEvent[], now: Date = new Date()): string {
  const stamp = dtStamp(now);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Folio//Money Path//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Folio · what\'s coming',
    'X-WR-CALDESC:The dates that move your money. From Folio.',
  ];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@folio.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dateOnly(event.dateIso)}`,
      `SUMMARY:${escapeText(summaryFor(event))}`,
      `DESCRIPTION:${escapeText(event.note ?? '')}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  // RFC 5545 prefers CRLF line endings and a trailing CRLF.
  return lines.join('\r\n') + '\r\n';
}
