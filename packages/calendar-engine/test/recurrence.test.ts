import { describe, expect, it } from 'vitest';

import { expandBoundedRecurrence, localDateTimeToUtc, parseRRule } from '../src/index.js';

describe('bounded recurrence expansion', () => {
  it('parses a conservative RRULE subset', () => {
    expect(parseRRule('FREQ=WEEKLY;COUNT=2;INTERVAL=1')).toEqual({
      frequency: 'WEEKLY',
      count: 2,
      interval: 1,
    });
    expect(() => parseRRule('FREQ=WEEKLY;BYDAY=MO')).toThrow(/Unsupported RRULE key/);
  });

  it('expands daily rules inside a bounded count', () => {
    const occurrences = expandBoundedRecurrence({
      dtstart: '2026-06-20T10:15:00',
      timeZone: 'Europe/London',
      rrule: 'FREQ=DAILY;COUNT=3',
    });

    expect(occurrences.map((occurrence) => occurrence.local)).toEqual([
      '2026-06-20T10:15:00',
      '2026-06-21T10:15:00',
      '2026-06-22T10:15:00',
    ]);
  });

  it('applies RDATE and EXDATE without escaping the materialized bound', () => {
    const occurrences = expandBoundedRecurrence({
      dtstart: '2026-06-20T09:00:00',
      timeZone: 'Europe/London',
      rrule: 'FREQ=WEEKLY;COUNT=2',
      rdate: ['2026-06-24T09:00:00'],
      exdate: ['2026-06-27T09:00:00'],
      maxOccurrences: 3,
    });

    expect(occurrences.map((occurrence) => occurrence.local)).toEqual([
      '2026-06-20T09:00:00',
      '2026-06-24T09:00:00',
    ]);
  });

  it('keeps local time stable across the provided Europe/London DST vector', () => {
    const occurrences = expandBoundedRecurrence({
      dtstart: '2026-03-22T09:00:00',
      timeZone: 'Europe/London',
      rrule: 'FREQ=WEEKLY;COUNT=2',
    });

    expect(
      occurrences.map((occurrence) => ({
        local: occurrence.local,
        utc: occurrence.utc,
      })),
    ).toEqual([
      { local: '2026-03-22T09:00:00', utc: '2026-03-22T09:00:00Z' },
      { local: '2026-03-29T09:00:00', utc: '2026-03-29T08:00:00Z' },
    ]);
    expect(localDateTimeToUtc({ local: '2026-03-29T09:00:00', timeZone: 'Europe/London' })).toBe(
      '2026-03-29T08:00:00Z',
    );
  });

  it('rejects unbounded recurrence expansion', () => {
    expect(() =>
      expandBoundedRecurrence({
        dtstart: '2026-06-20T09:00:00',
        timeZone: 'Europe/London',
        rrule: 'FREQ=WEEKLY',
      }),
    ).toThrow(/Unbounded recurrence/);
  });
});
