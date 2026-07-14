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

import type { Sub, Onboarding, CalendarEvent, Pot, IncomeSource, Transaction } from '../store';
import {
  type DerivedEvent,
  computeSpareAndTightest,
  deriveCalendarEvents,
  deriveHistoricalDayEvents,
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

// ---------------------------------------------------------------------------
// incomeSources — the income-cadence model (lib/income.ts) generalises the
// single monthly `onboarding.payday`/`monthlyIncome` lump into per-cadence
// sources. CONSTRAINT: additive — a monthly-only user (no incomeSources
// declared) must see byte-IDENTICAL output to before this feature existed.
// ---------------------------------------------------------------------------
describe('deriveCalendarEvents — legacy fallback (no incomeSources)', () => {
  it('does not invent a zero-value payday for an unconfigured user', () => {
    const events = deriveCalendarEvents({
      subs: [],
      subPaused: {},
      subOverrides: {},
      onboarding: { done: false, name: '', payday: 0, monthlyIncome: 0 },
      manualEvents: [],
      pots: [],
      now: new Date('2026-07-14T00:00:00.000Z'),
      includeSampleBills: false,
    });

    expect(events.filter((event) => event.source === 'payday')).toEqual([]);
  });

  it('is byte-identical to the pre-existing single-payday derivation when incomeSources is omitted', () => {
    const now = at('2026-07-01');
    const subs: Sub[] = [
      { name: 'Spotify', cost: 11, nextRenewalDaysAway: 5, lastUsedDaysAgo: 0, usesPerMonth: 28 },
    ];
    const withoutField = deriveCalendarEvents({
      subs,
      subPaused: {},
      onboarding: ONBOARDING,
      manualEvents: [],
      now,
    });
    const withEmptyArray = deriveCalendarEvents({
      subs,
      subPaused: {},
      onboarding: ONBOARDING,
      manualEvents: [],
      incomeSources: [],
      now,
    });
    expect(withEmptyArray).toEqual(withoutField);

    // And it still produces exactly the legacy single monthly payday shape.
    const paydays = withoutField.filter((e) => e.source === 'payday');
    expect(paydays.length).toBeGreaterThan(0);
    expect(paydays[0]!.title).toBe('Payday');
    expect(paydays[0]!.id).toMatch(/^payday-\d{4}-\d{2}-\d{2}$/);
  });
});

describe('deriveCalendarEvents — income-cadence sources', () => {
  it('projects every occurrence of a weekly source inside the window, replacing the monthly lump', () => {
    const now = at('2026-07-01');
    const weekly: IncomeSource = {
      id: 'wage',
      label: 'Weekly wage',
      cadence: 'weekly',
      anchorISO: '2026-07-03',
      amount: 300,
      source: 'manual',
    };
    const events = deriveCalendarEvents({
      subs: [],
      subPaused: {},
      onboarding: ONBOARDING,
      manualEvents: [],
      incomeSources: [weekly],
      now,
    });

    const paydays = events.filter((e) => e.source === 'payday');
    // 35-day window from Jul 1 anchored Jul 3 weekly -> 5 occurrences (3,10,17,24,31).
    expect(paydays.map((e) => e.date)).toEqual([
      '2026-07-03',
      '2026-07-10',
      '2026-07-17',
      '2026-07-24',
      '2026-07-31',
    ]);
    expect(paydays.every((e) => e.amount === 300 && e.title === 'Weekly wage')).toBe(true);
    // The legacy monthly-payday-derived id shape must NOT appear.
    expect(events.some((e) => e.id === 'payday-2026-07-25')).toBe(false);
  });

  it('merges multiple income sources into the derived timeline, sorted with everything else', () => {
    const now = at('2026-07-01');
    const weekly: IncomeSource = {
      id: 'wage',
      label: 'Weekly wage',
      cadence: 'weekly',
      anchorISO: '2026-07-03',
      amount: 300,
      source: 'manual',
    };
    const sideGig: IncomeSource = {
      id: 'side',
      label: 'Side gig',
      cadence: 'monthly',
      dayOfMonth: 15,
      amount: 150,
      source: 'manual',
    };
    const events = deriveCalendarEvents({
      subs: [],
      subPaused: {},
      onboarding: ONBOARDING,
      manualEvents: [],
      incomeSources: [weekly, sideGig],
      now,
    });
    const paydayDates = events.filter((e) => e.source === 'payday').map((e) => e.date);
    expect(paydayDates).toContain('2026-07-15'); // side gig
    expect(paydayDates).toContain('2026-07-03'); // weekly wage
    // Output stays globally sorted by date.
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.date >= events[i - 1]!.date).toBe(true);
    }
  });

  it('anchors pot after-payday top-ups to the source-driven earliest income event', () => {
    const now = at('2026-07-01');
    const weekly: IncomeSource = {
      id: 'wage',
      label: 'Weekly wage',
      cadence: 'weekly',
      anchorISO: '2026-07-03',
      amount: 300,
      source: 'manual',
    };
    const pots: Pot[] = [
      { id: 'buffer', name: 'Buffer', saved: 0, goal: 500, perWeek: 20, accent: false },
    ];
    const events = deriveCalendarEvents({
      subs: [],
      subPaused: {},
      onboarding: ONBOARDING,
      manualEvents: [],
      incomeSources: [weekly],
      pots,
      now,
    });
    const potTopUp = events.find((e) => e.source === 'pot');
    expect(potTopUp).toBeDefined();
    // after-payday defaults to the FIRST income event, which is the weekly wage's
    // first in-window occurrence (Jul 3), not a monthly-derived date.
    expect(potTopUp?.date).toBe('2026-07-03');
  });
});

// ---------------------------------------------------------------------------
// deriveHistoricalDayEvents — DATA_INTELLIGENCE.md phase ④(B) past-month real-data enrichment.
// Independent from deriveCalendarEvents's forward projection; grouped separately here.
// ---------------------------------------------------------------------------

function txn(when: string, merchant: string, amount: number): Transaction {
  return {
    id: `t-${when}-${merchant}`,
    when,
    merchant,
    amount,
    category: 'other',
    source: 'manual',
  };
}

describe('deriveHistoricalDayEvents — past-day real-transaction grouping', () => {
  const TODAY_ISO = '2026-07-06';

  it('groups past transactions by their calendar day, keyed on the date portion of `when`', () => {
    const byDay = deriveHistoricalDayEvents(
      [
        txn('2026-07-01T09:00:00.000Z', 'Tesco', -42),
        txn('2026-07-01T18:00:00.000Z', 'Netflix', -8),
        txn('2026-07-02T00:00:00.000Z', 'Wages', 2000),
      ],
      TODAY_ISO,
    );
    expect(Object.keys(byDay).sort()).toEqual(['2026-07-01', '2026-07-02']);
    expect(byDay['2026-07-01']).toHaveLength(2);
    expect(byDay['2026-07-02']).toHaveLength(1);
  });

  it("never includes today or any future transaction — those stay the forward projection's territory", () => {
    const byDay = deriveHistoricalDayEvents(
      [
        txn('2026-07-06T09:00:00.000Z', 'Coffee', -3), // today — excluded
        txn('2026-07-07T09:00:00.000Z', 'Future', -3), // future — excluded
        txn('2026-07-05T09:00:00.000Z', 'Yesterday', -3), // past — included
      ],
      TODAY_ISO,
    );
    expect(Object.keys(byDay)).toEqual(['2026-07-05']);
  });

  it('maps kind by amount sign — negative amount is "out", non-negative is "in"', () => {
    const byDay = deriveHistoricalDayEvents(
      [
        txn('2026-07-01T09:00:00.000Z', 'Rent', -540),
        txn('2026-07-01T10:00:00.000Z', 'Refund', 20),
      ],
      TODAY_ISO,
    );
    const day = byDay['2026-07-01']!;
    expect(day.find((e) => e.title === 'Rent')?.kind).toBe('out');
    expect(day.find((e) => e.title === 'Refund')?.kind).toBe('in');
  });

  it('tags every event source: "history" — never actionable like a sub/manual event', () => {
    const byDay = deriveHistoricalDayEvents(
      [txn('2026-07-01T09:00:00.000Z', 'Tesco', -42)],
      TODAY_ISO,
    );
    expect(byDay['2026-07-01']![0]!.source).toBe('history');
  });

  it('preserves the transaction amount and merchant as the event amount/title', () => {
    const byDay = deriveHistoricalDayEvents(
      [txn('2026-07-01T09:00:00.000Z', 'Tesco', -42.5)],
      TODAY_ISO,
    );
    const event = byDay['2026-07-01']![0]!;
    expect(event.amount).toBe(-42.5);
    expect(event.title).toBe('Tesco');
  });

  it('returns an empty object when there are no past transactions', () => {
    expect(deriveHistoricalDayEvents([], TODAY_ISO)).toEqual({});
    expect(
      deriveHistoricalDayEvents([txn('2026-07-06T09:00:00.000Z', 'Today', -1)], TODAY_ISO),
    ).toEqual({});
  });

  it('is pure — never mutates the input transactions array', () => {
    const input = [txn('2026-07-01T09:00:00.000Z', 'Tesco', -42)];
    const snapshot = JSON.parse(JSON.stringify(input));
    deriveHistoricalDayEvents(input, TODAY_ISO);
    expect(input).toEqual(snapshot);
  });
});
