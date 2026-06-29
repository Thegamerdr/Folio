// Folio Calendar derivation tests — pure-logic coverage for the derivation at
// apps/mobile/src/folio/lib/calendarEvents.ts.
//
// Every case pins an explicit `now` so the 35-day window, the on/after payday
// rule, and the engine-resolved pot cadence are all deterministic regardless of
// when the suite runs. Payday/bill day-of-month math and pot top-ups now go
// through the pure engines (`resolvePayday`, `resolveNextTopUp`), which emit
// pure-UTC ISO dates — so the date expectations are exact literals, not a
// local→UTC slide. No DOM, no react-native runtime — a plain `.test.ts`
// collected by the apps/**/*.test.ts runner. Types + fixtures come from the
// data spine (../store), the same module `@/folio/store` aliases to.

import { describe, expect, it } from 'vitest';

import type { Sub, Onboarding, CalendarEvent, Pot } from '../store';
import {
  type DerivedEvent,
  computeSpareAndTightest,
  deriveCalendarEvents,
  formatDayHeader,
  groupByDay,
  previewSubNudge,
} from './calendarEvents';

// A stable onboarding seed — payday on the 25th, £2,180/mo income.
const ONBOARDING: Onboarding = { done: true, name: 'Test', payday: 25, monthlyIncome: 2180 };

// Pin "now" to local midday so deriving `nowIso`/`windowEndIso` (the UTC
// toISOString slice in isoDay) never straddles a day boundary in the runner.
function at(local: string): Date {
  return new Date(`${local}T12:00:00`);
}

function ids(events: DerivedEvent[]): string[] {
  return events.map((e) => e.id);
}

describe('deriveCalendarEvents — window membership', () => {
  it('renders payday, a bill, and a sub renewal all inside the 35-day window', () => {
    const now = at('2026-07-01');
    const subs: Sub[] = [
      { name: 'Spotify', cost: 11, nextRenewalDaysAway: 5, lastUsedDaysAgo: 0, usesPerMonth: 28 },
    ];
    const events = deriveCalendarEvents({
      subs,
      subPaused: {},
      onboarding: ONBOARDING,
      manualEvents: [],
      now,
    });

    // Payday rule = 25th, +£2,180 in. The payday engine clamps off weekends
    // (weekend-previous): 25 Jul 2026 is a Saturday, so it resolves to Fri 24 Jul
    // — emitted as the pure-UTC literal, no local→UTC slide.
    const payday = events.find((e) => e.source === 'payday');
    expect(payday).toBeDefined();
    expect(payday?.date).toBe('2026-07-24');
    expect(payday?.kind).toBe('in');
    expect(payday?.amount).toBe(2180);

    // A recurring bill appears as money out.
    const bill = events.find((e) => e.source === 'bill');
    expect(bill).toBeDefined();
    expect(bill?.kind).toBe('out');
    expect(bill?.amount).toBeLessThan(0);

    // The non-paused sub renews 5 days out, tagged for the one-tap Pause.
    const sub = events.find((e) => e.source === 'sub');
    expect(sub).toBeDefined();
    expect(sub?.date).toBe('2026-07-06');
    expect(sub?.amount).toBe(-11);
    expect(sub?.subName).toBe('Spotify');
  });

  it('omits a sub whose renewal falls beyond the window and skips paused subs', () => {
    const now = at('2026-07-01');
    const subs: Sub[] = [
      { name: 'FarOff', cost: 5, nextRenewalDaysAway: 99, lastUsedDaysAgo: 0, usesPerMonth: 1 },
      { name: 'Paused', cost: 8, nextRenewalDaysAway: 3, lastUsedDaysAgo: 0, usesPerMonth: 1 },
    ];
    const events = deriveCalendarEvents({
      subs,
      subPaused: { Paused: true },
      onboarding: ONBOARDING,
      manualEvents: [],
      now,
    });
    const subNames = events.filter((e) => e.source === 'sub').map((e) => e.subName);
    expect(subNames).not.toContain('FarOff');
    expect(subNames).not.toContain('Paused');
  });
});

describe('deriveCalendarEvents — recurring occurrences', () => {
  it('renders two monthly paydays when both fall inside the window', () => {
    // now = 24 Jul, payday = 25th. Both fall in the 35-day window. The payday
    // engine clamps off weekends (weekend-previous): 25 Jul 2026 is a Saturday,
    // so it shifts to Fri 24 Jul; 25 Aug 2026 is a Monday, so it stays put. The
    // engine emits pure-UTC ISO dates, so these are exact literals (no local→UTC
    // slide), unlike the prototype's raw JS-Date day-of-month math.
    const now = at('2026-07-24');
    const events = deriveCalendarEvents({
      subs: [],
      subPaused: {},
      onboarding: ONBOARDING,
      manualEvents: [],
      now,
    });
    const paydays = events.filter((e) => e.source === 'payday');
    expect(paydays).toHaveLength(2);
    expect(paydays.map((e) => e.date)).toEqual(['2026-07-24', '2026-08-25']);
  });

  it('places a cadence-less pot top-up on the next payday (after-payday default)', () => {
    const now = at('2026-07-01'); // a Wednesday
    // No `cadence` -> the engine defaults to `after-payday`, anchored to the
    // resolved payday (25 Jul 2026 is a Saturday -> weekend-previous = Fri 24).
    // One concrete dated top-up replaces the prototype's weekly Friday fill.
    const pots: Pot[] = [
      { id: 'holiday', name: 'Holiday', saved: 0, goal: 1000, perWeek: 35, accent: true },
    ];
    const events = deriveCalendarEvents({
      subs: [],
      subPaused: {},
      onboarding: ONBOARDING,
      manualEvents: [],
      pots,
      now,
    });
    const potEvents = events.filter((e) => e.source === 'pot');
    expect(potEvents).toHaveLength(1);
    expect(potEvents[0]?.amount).toBe(-35);
    expect(potEvents[0]?.date).toBe('2026-07-24');
  });

  it('follows an explicit weekly pot cadence onto the chosen weekday', () => {
    const now = at('2026-07-01'); // a Wednesday
    // weekday 5 = Friday: the engine resolves the next Friday on/after `now`,
    // and that single dated top-up lands inside the window.
    const pots: Pot[] = [
      {
        id: 'holiday',
        name: 'Holiday',
        saved: 0,
        goal: 1000,
        perWeek: 35,
        accent: true,
        cadence: { kind: 'weekly', weekday: 5 },
      },
    ];
    const events = deriveCalendarEvents({
      subs: [],
      subPaused: {},
      onboarding: ONBOARDING,
      manualEvents: [],
      pots,
      now,
    });
    const potEvents = events.filter((e) => e.source === 'pot');
    expect(potEvents).toHaveLength(1);
    expect(potEvents[0]?.amount).toBe(-35);
    // The resolved date is a Friday (UTC weekday 5, matching the engine's space).
    expect(new Date(`${potEvents[0]?.date}T00:00:00Z`).getUTCDay()).toBe(5);
  });
});

describe('nextPayday — strict-< rule', () => {
  it('rolls to next month when this month`s resolved payday is before now', () => {
    // now = 25 Jul @ 12:00. July`s engine-resolved payday is Fri 24 Jul (25th is
    // a Saturday -> weekend-previous), which is strictly before now, so the
    // resolver rolls forward to August. 25 Aug 2026 is a Monday, so it stays the
    // 25th — emitted as the pure-UTC literal 2026-08-25.
    const now = at('2026-07-25');
    const events = deriveCalendarEvents({
      subs: [],
      subPaused: {},
      onboarding: ONBOARDING,
      manualEvents: [],
      now,
    });
    const firstPayday = events.find((e) => e.source === 'payday');
    expect(firstPayday?.date).toBe('2026-08-25');
  });

  it('keeps this month`s payday when now sits exactly on the resolved payday', () => {
    // The engine resolves July`s 25th-rule payday to Fri 24 Jul (weekend-previous).
    // Pin `now` to UTC midnight of that resolved day so `nowIso` is deterministically
    // 2026-07-24 in every timezone. The resolver`s on/after compare keeps the day
    // (resolved payday >= now), proving the rule is `>=`, not strict `>`.
    const now = new Date('2026-07-24T00:00:00Z');
    const events = deriveCalendarEvents({
      subs: [],
      subPaused: {},
      onboarding: ONBOARDING,
      manualEvents: [],
      now,
    });
    const firstPayday = events.find((e) => e.source === 'payday');
    expect(firstPayday?.date).toBe('2026-07-24');
  });
});

describe('groupByDay', () => {
  it('groups events sharing an ISO day into one bucket and preserves order', () => {
    const now = at('2026-07-20');
    const manualEvents: CalendarEvent[] = [
      { id: 'm1', date: '2026-07-22', kind: 'out', title: 'Dentist', amount: -60 },
      { id: 'm2', date: '2026-07-22', kind: 'review', title: 'Check standing order' },
    ];
    const events = deriveCalendarEvents({
      subs: [],
      subPaused: {},
      onboarding: ONBOARDING,
      manualEvents,
      now,
    });
    const groups = groupByDay(events);
    const jul22 = groups.find((g) => g.date === '2026-07-22');
    expect(jul22).toBeDefined();
    expect(ids(jul22!.events)).toEqual(expect.arrayContaining(['m1', 'm2']));
    // Each day appears exactly once.
    const dates = groups.map((g) => g.date);
    expect(new Set(dates).size).toBe(dates.length);
  });
});

describe('computeSpareAndTightest', () => {
  it('runs the balance down day-by-day and names the tightest day', () => {
    const groups = [
      { date: '2026-07-02', events: [{ amount: -100 } as DerivedEvent] },
      { date: '2026-07-05', events: [{ amount: -50 } as DerivedEvent] },
      { date: '2026-07-09', events: [{ amount: +200 } as DerivedEvent] },
    ];
    const result = computeSpareAndTightest(groups, 120);
    // 120 -> 20 (Jul 2) -> -30 (Jul 5, tightest) -> 170 (Jul 9).
    expect(result.spareByDay['2026-07-02']).toBe(20);
    expect(result.spareByDay['2026-07-05']).toBe(-30);
    expect(result.spareByDay['2026-07-09']).toBe(170);
    expect(result.tightestDate).toBe('2026-07-05');
    expect(result.tightestSpare).toBe(-30);
  });

  it('falls back to the starting spare when there are no groups', () => {
    const result = computeSpareAndTightest([], 500);
    expect(result.tightestDate).toBeNull();
    expect(result.tightestSpare).toBe(500);
  });
});

describe('previewSubNudge', () => {
  it('returns the £ lift to the tight day from sliding a sub later', () => {
    const now = at('2026-07-01');
    // One bill on the 12th creates a dip; a £40 sub renewing on the same kind of
    // day deepens it. Nudging the sub later should lift the tightest point by
    // roughly the sub's cost (it moves off the tightest day).
    const subs: Sub[] = [
      { name: 'Gym', cost: 40, nextRenewalDaysAway: 11, lastUsedDaysAgo: 0, usesPerMonth: 8 },
    ];
    const delta = previewSubNudge({
      subName: 'Gym',
      deltaDays: 7,
      subs,
      subPaused: {},
      subOverrides: {},
      onboarding: ONBOARDING,
      manualEvents: [],
      startingSpare: 1000,
      now,
    });
    // Pure integer £ delta — a lift is non-negative, and it is rounded.
    expect(typeof delta).toBe('number');
    expect(Number.isInteger(delta)).toBe(true);
    expect(delta).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 when the nudge changes nothing (sub already outside the window)', () => {
    const now = at('2026-07-01');
    const subs: Sub[] = [
      { name: 'Faraway', cost: 9, nextRenewalDaysAway: 200, lastUsedDaysAgo: 0, usesPerMonth: 1 },
    ];
    const delta = previewSubNudge({
      subName: 'Faraway',
      deltaDays: 3,
      subs,
      subPaused: {},
      subOverrides: {},
      onboarding: ONBOARDING,
      manualEvents: [],
      startingSpare: 1000,
      now,
    });
    expect(delta).toBe(0);
  });
});

describe('formatDayHeader', () => {
  it('formats an ISO day as "WEEKDAY · D MON"', () => {
    expect(formatDayHeader('2026-07-08')).toBe('WED · 8 JUL');
  });
});
