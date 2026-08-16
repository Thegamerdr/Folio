import { describe, expect, it } from 'vitest';

import { SAMPLE_CONTEXT, lintCopy } from './copy.js';
import { inQuietHours, planNotification, type NotifyContext, type NotifyInputs } from './notify.js';
import { resolveState, type StateInputs, type StateView } from './states.js';

const ctx: NotifyContext = {
  ...SAMPLE_CONTEXT,
  previousDangerDay: 'Thu',
  shortfallIfUsual: '£38',
};

const mkInputs = (over: Partial<StateInputs> = {}): StateInputs => ({
  safeZonePence: 18_400,
  perDayPence: 1_533,
  comfortablePerDayPence: 800,
  daysToPayday: 12,
  runwayDays: null,
  dangerDaysAway: null,
  overdraft: false,
  dataAgeHours: 1,
  paydayToday: false,
  paydayTomorrow: false,
  billsDueNext7: 1,
  billsTotalCycle: 4,
  allBillsShielded: false,
  bufferIntact: false,
  cyclesEndedPositive: 0,
  savingsGrowing: false,
  daysSinceRecoveryEnd: null,
  greenDaysStreak: 0,
  daysSinceOverdraftEvent: null,
  milestoneReached: false,
  returnedAfterAbsence: false,
  ...over,
});

function view(over: Partial<StateInputs> = {}): StateView {
  return resolveState(null, mkInputs(over), '2026-07-01').view;
}

const base: NotifyInputs = {
  prev: view(),
  next: view(),
  prevDangerDaysAway: null,
  nextDangerDaysAway: null,
  hour: 12,
  sentToday: 0,
  dangerSentToday: 0,
  recoveryCheckinDue: false,
  hardCycle: true,
};

describe('quiet hours', () => {
  it('spans 21:00 to 08:00', () => {
    expect(inQuietHours(21)).toBe(true);
    expect(inQuietHours(2)).toBe(true);
    expect(inQuietHours(7)).toBe(true);
    expect(inQuietHours(8)).toBe(false);
    expect(inQuietHours(20)).toBe(false);
  });

  it('honours a user-configured window, including a same-hour disabled window', () => {
    expect(inQuietHours(19, 18, 9)).toBe(true);
    expect(inQuietHours(10, 18, 9)).toBe(false);
    expect(inQuietHours(2, 0, 0)).toBe(false);
  });

  it('suppresses everything — even danger — at night (§13: no 2am panic)', () => {
    const i: NotifyInputs = {
      ...base,
      hour: 23,
      next: view({ dangerDaysAway: 2, runwayDays: 2 }),
      nextDangerDaysAway: 2,
    };
    expect(planNotification(i, ctx)).toBeNull();
  });
});

describe('transitions, never states', () => {
  it('a calm day produces silence — calm earns silence', () => {
    expect(planNotification(base, ctx)).toBeNull();
  });

  it('entering warning notifies with the shortfall AND the way out, information-complete', () => {
    const n = planNotification(
      {
        ...base,
        next: view({ dangerDaysAway: 5, runwayDays: 5 }),
        nextDangerDaysAway: 5,
      },
      ctx,
    );
    expect(n?.key).toBe('dangerEntered');
    expect(n?.body).toContain('£38 short');
    expect(n?.body).toContain('£9/day');
  });

  it('REMAINING in warning the next day is silence, not a repeat', () => {
    const warning = view({ dangerDaysAway: 5, runwayDays: 5 });
    const n = planNotification(
      {
        ...base,
        prev: warning,
        next: warning,
        prevDangerDaysAway: 5,
        nextDangerDaysAway: 5,
      },
      ctx,
    );
    expect(n).toBeNull();
  });

  it('the danger date moving AWAY is the flagship good-news ping', () => {
    const n = planNotification(
      {
        ...base,
        prev: view({ dangerDaysAway: 4, runwayDays: 4 }),
        next: view({ dangerDaysAway: 7, runwayDays: 7 }),
        prevDangerDaysAway: 4,
        nextDangerDaysAway: 7,
      },
      ctx,
    );
    expect(n?.key).toBe('dangerDateMoved');
    expect(n?.body).toBe('Whatever you did this week — it worked.');
  });
});

describe('the daily budget', () => {
  it('holds at one per day', () => {
    const n = planNotification({ ...base, sentToday: 1, next: view({ paydayToday: true }) }, ctx);
    expect(n).toBeNull();
  });

  it('danger entry may break the budget exactly once', () => {
    const enter = {
      ...base,
      sentToday: 1,
      next: view({ dangerDaysAway: 2, runwayDays: 2 }),
      nextDangerDaysAway: 2,
    };
    expect(planNotification(enter, ctx)?.key).toBe('dangerEntered');
    expect(planNotification({ ...enter, dangerSentToday: 1 }, ctx)).toBeNull();
  });
});

describe('celebration pings', () => {
  it('payday morning gets its ping', () => {
    const n = planNotification({ ...base, next: view({ paydayToday: true }) }, ctx);
    expect(n?.key).toBe('payday');
  });

  it('payday eve asks for nothing — and only after a hard cycle', () => {
    const n = planNotification({ ...base, next: view({ paydayTomorrow: true }) }, ctx);
    expect(n?.key).toBe('paydayEve');
    expect(n?.body).toBe('You made it.');

    const easyCycle = planNotification(
      { ...base, hardCycle: false, next: view({ paydayTomorrow: true }) },
      ctx,
    );
    expect(easyCycle).toBeNull();
  });
});

describe('every notification obeys the copy law', () => {
  const cases: NotifyInputs[] = [
    { ...base, next: view({ dangerDaysAway: 5, runwayDays: 5 }), nextDangerDaysAway: 5 },
    {
      ...base,
      prev: view({ dangerDaysAway: 4, runwayDays: 4 }),
      next: view({ dangerDaysAway: 7, runwayDays: 7 }),
      prevDangerDaysAway: 4,
      nextDangerDaysAway: 7,
    },
    { ...base, next: view({ paydayToday: true }) },
    { ...base, next: view({ paydayTomorrow: true }) },
    { ...base, next: view({ billsDueNext7: 3 }) },
    { ...base, next: view({ dataAgeHours: 100 }) },
    { ...base, next: view({ milestoneReached: true }) },
  ];

  it.each(cases.map((c, i) => [i, c] as const))('case %d renders clean', (_i, c) => {
    const n = planNotification(c, ctx);
    if (n === null) return;
    // The payday 🎉 is one of the two sanctioned emoji moments (§10.1) — exempt the title.
    const text = n.key === 'payday' ? n.body : `${n.title} ${n.body}`;
    expect(lintCopy(text)).toEqual([]);
  });
});
