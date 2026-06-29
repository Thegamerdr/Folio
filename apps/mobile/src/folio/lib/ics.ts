/**
 * Minimal ICS (RFC 5545) serializer — faithful 1:1 RN port of the web design's
 * `src/lib/ics.ts`. Pure function, no I/O. This is the REAL serializer: the
 * exact same VCALENDAR/VEVENT shape, all-day events (DTSTART;VALUE=DATE), CRLF
 * line endings, escaped text.
 *
 * The web original also shipped a `downloadIcs(filename, ics)` that built a
 * Blob + clicked an <a download>. There is no `window`/`document`/`Blob` in RN,
 * so that browser-only download path is intentionally NOT ported here; a native
 * share intent / file-save sheet hands this string to the OS instead (UI layer).
 */
import type { DerivedEvent } from './calendarEvents';

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dateOnly(iso: string): string {
  // ICS VALUE=DATE format: YYYYMMDD
  return iso.replace(/-/g, '');
}

function dtstamp(): string {
  const d = new Date();
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function summaryFor(e: DerivedEvent): string {
  const tag =
    e.kind === 'in'
      ? '↑'
      : e.kind === 'out'
        ? '↓'
        : e.kind === 'deadline'
          ? '•'
          : e.kind === 'review'
            ? '?'
            : '·';
  const amt =
    typeof e.amount === 'number'
      ? ` · ${e.amount >= 0 ? '+' : '−'}£${Math.abs(e.amount).toFixed(2)}`
      : '';
  return `${tag} ${e.title}${amt}`;
}

export function eventsToIcs(events: DerivedEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Folio//Money Path//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    "X-WR-CALNAME:Folio · what's coming",
    'X-WR-CALDESC:The dates that move your money. From Folio.',
  ];
  for (const e of events) {
    const d = dateOnly(e.date);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@folio.local`,
      `DTSTAMP:${dtstamp()}`,
      `DTSTART;VALUE=DATE:${d}`,
      `SUMMARY:${escapeText(summaryFor(e))}`,
      `DESCRIPTION:${escapeText(e.note ?? '')}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  // RFC 5545 prefers CRLF line endings.
  return lines.join('\r\n') + '\r\n';
}
