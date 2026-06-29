import { describe, expect, it } from 'vitest';

import { buildIcs } from './calendarIcs.js';
import type { DerivedCalendarEvent } from './calendarEvents.js';

const FIXED_NOW = new Date('2026-06-21T10:00:00.000Z');

const events: readonly DerivedCalendarEvent[] = [
  {
    id: 'payday-salary',
    dateIso: '2026-06-26',
    kind: 'in',
    source: 'payday',
    title: 'Acme Payroll salary',
    note: 'Money in',
    amountMinor: 184_000,
    recurring: 'monthly',
  },
  {
    id: 'bill-rent',
    dateIso: '2026-07-01',
    kind: 'out',
    source: 'bill',
    title: 'Rent; flat',
    amountMinor: -87_500,
  },
];

describe('buildIcs', () => {
  it('emits one valid VEVENT per event with VALUE=DATE DTSTART', () => {
    const ics = buildIcs(events, FIXED_NOW);
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    const veventCount = ics.split('BEGIN:VEVENT').length - 1;
    expect(veventCount).toBe(2);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260626');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260701');
    expect(ics).toContain('UID:payday-salary@folio.local');
    expect(ics).toContain('VERSION:2.0');
  });

  it('uses CRLF line endings and a deterministic DTSTAMP from the injected now', () => {
    const ics = buildIcs(events, FIXED_NOW);
    expect(ics.includes('\r\n')).toBe(true);
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics).toContain('DTSTAMP:20260621T100000Z');
  });

  it('escapes RFC 5545 special characters in the summary', () => {
    const ics = buildIcs(events, FIXED_NOW);
    // The semicolon in "Rent; flat" must be backslash-escaped in the SUMMARY value.
    expect(ics).toContain('Rent\\; flat');
  });

  it('produces a balanced VCALENDAR with matching BEGIN/END VEVENT counts', () => {
    const ics = buildIcs(events, FIXED_NOW);
    const begins = ics.split('BEGIN:VEVENT').length - 1;
    const ends = ics.split('END:VEVENT').length - 1;
    expect(begins).toBe(ends);
  });
});
