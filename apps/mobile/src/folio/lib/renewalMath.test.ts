// renewalMath — pure-logic coverage for nextRenewalDaysAwayFrom (lib/renewalMath.ts).
//
// Pins the money-safety fix: BillCaughtSheet/SubCaughtSheet used to hardcode
// nextRenewalDaysAway: 30 on confirm, ignoring the detected cadence + lastDate. This locks in the
// honest day-count derived from those two facts instead.

import { describe, expect, it } from 'vitest';

import {
  anchorIsoFor,
  daysUntilDayOfMonth,
  nextRenewalDaysAwayFrom,
  reanchorRenewals,
  renewalPeriodDaysFor,
  type AnchoredRenewal,
} from './renewalMath';

describe('nextRenewalDaysAwayFrom', () => {
  it('weekly charged 2 days ago -> 5 days away', () => {
    // today 2026-07-06, last charge 2026-07-04 (2 days ago) -> next renewal 2026-07-11 -> 5 days away
    expect(nextRenewalDaysAwayFrom('weekly', '2026-07-04', '2026-07-06')).toBe(5);
  });

  it('fortnightly charged 20 days ago -> 8 days away', () => {
    // 20 days elapsed > one 14-day period, so it steps forward one period: next renewal at day 28
    // from lastDate -> 28 - 20 = 8 days away from today.
    expect(nextRenewalDaysAwayFrom('fortnightly', '2026-06-16', '2026-07-06')).toBe(8);
  });

  it('monthly charged 40 days ago -> anchors to next same-day-of-month', () => {
    // last charge 2026-05-27, today 2026-07-06 (40 days later). One calendar month forward from
    // 2026-05-27 is 2026-06-27 (already past today), so it steps to 2026-07-27 -> 21 days away.
    expect(nextRenewalDaysAwayFrom('monthly', '2026-05-27', '2026-07-06')).toBe(21);
  });

  it('today-charged -> full period away', () => {
    expect(nextRenewalDaysAwayFrom('weekly', '2026-07-06', '2026-07-06')).toBe(7);
    expect(nextRenewalDaysAwayFrom('fortnightly', '2026-07-06', '2026-07-06')).toBe(14);
    // Calendar-anchored: 2026-07-06 -> 2026-08-06 spans 31 days (July has 31 days), not a flat 30.
    expect(nextRenewalDaysAwayFrom('monthly', '2026-07-06', '2026-07-06')).toBe(31);
  });

  it('never returns negative even for a far-past lastDate', () => {
    const result = nextRenewalDaysAwayFrom('monthly', '2020-01-31', '2026-07-06');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('monthly anchor clamps to the last day of a shorter month', () => {
    // Charged on the 31st; stepping one month from 2026-01-31 lands on 2026-02-28 (clamped, not
    // an invalid Feb 31). Today is 2026-02-01, so 27 days away.
    expect(nextRenewalDaysAwayFrom('monthly', '2026-01-31', '2026-02-01')).toBe(27);
  });

  it('fortnightly charged exactly one period ago -> due today (0 days away)', () => {
    expect(nextRenewalDaysAwayFrom('fortnightly', '2026-06-22', '2026-07-06')).toBe(0);
  });
});

describe('daysUntilDayOfMonth — seeding a declared monthly bill from its day-of-month', () => {
  // Pins the 2026-07-10 device-smoke fix: AddEntryScreen used to write the day-of-month LITERAL
  // as nextRenewalDaysAway ("12th" -> due in 12 days). These lock in the honest translation.

  it('a day later this month counts the actual gap ("12th" on the 10th -> 2, not 12)', () => {
    expect(daysUntilDayOfMonth(12, '2026-07-10')).toBe(2);
  });

  it("today's own day-of-month reads as due today (0), matching the <= 0 = due convention", () => {
    expect(daysUntilDayOfMonth(10, '2026-07-10')).toBe(0);
  });

  it('a day already past this month rolls to next month ("3rd" on 10 Jul -> 3 Aug = 24 days)', () => {
    expect(daysUntilDayOfMonth(3, '2026-07-10')).toBe(24);
  });

  it('the 31st clamps to short months ("Last day" in Feb 2026 -> 28 Feb)', () => {
    expect(daysUntilDayOfMonth(31, '2026-02-10')).toBe(18);
  });

  it('the 31st on the last day of a short month is due today', () => {
    expect(daysUntilDayOfMonth(31, '2026-02-28')).toBe(0);
  });

  it('rolling past a short month anchors on the raw day, not the clamped one (31st on 1 Mar -> 31 Mar)', () => {
    expect(daysUntilDayOfMonth(31, '2026-03-01')).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Date-anchored renewals — the Phase-2 rot fix
// ---------------------------------------------------------------------------

describe('anchorIsoFor', () => {
  it('turns a relative day count into the concrete due date', () => {
    expect(anchorIsoFor(5, '2026-07-10')).toBe('2026-07-15');
    expect(anchorIsoFor(0, '2026-07-10')).toBe('2026-07-10');
  });

  it('floors negative counts at today (overdue reads as due now)', () => {
    expect(anchorIsoFor(-3, '2026-07-10')).toBe('2026-07-10');
  });
});

describe('renewalPeriodDaysFor', () => {
  it('maps fixed-step cadences to their day periods', () => {
    expect(renewalPeriodDaysFor('weekly')).toBe(7);
    expect(renewalPeriodDaysFor('fortnightly')).toBe(14);
    expect(renewalPeriodDaysFor('yearly')).toBe(365);
  });

  it('maps monthly to undefined — the calendar day-of-month roll', () => {
    expect(renewalPeriodDaysFor('monthly')).toBeUndefined();
  });
});

describe('reanchorRenewals — the rot fix itself', () => {
  const sub = (overrides: Partial<AnchoredRenewal>): AnchoredRenewal => ({
    nextRenewalDaysAway: 10,
    ...overrides,
  });

  it('synthesizes an anchor for a legacy entry without touching its day count', () => {
    const { items, changed } = reanchorRenewals([sub({ nextRenewalDaysAway: 12 })], '2026-07-10');
    expect(changed).toBe(true);
    expect(items[0]).toEqual({ nextRenewalDaysAway: 12, nextRenewalISO: '2026-07-22' });
  });

  it('re-derives the day count from a future anchor — the core anti-rot behaviour', () => {
    // Written as "12 days away" on 2026-07-01 (anchor 13 Jul); opened a week later — the stored
    // relative count is stale by 7 days and gets corrected to the honest 3.
    const stale = sub({ nextRenewalDaysAway: 12, nextRenewalISO: '2026-07-13' });
    const { items, changed } = reanchorRenewals([stale], '2026-07-10');
    expect(changed).toBe(true);
    expect(items[0]!.nextRenewalDaysAway).toBe(3);
    expect(items[0]!.nextRenewalISO).toBe('2026-07-13');
  });

  it('an anchor due today reads 0 and is NOT rolled — <= 0 still means due', () => {
    const due = sub({ nextRenewalDaysAway: 5, nextRenewalISO: '2026-07-10' });
    const { items } = reanchorRenewals([due], '2026-07-10');
    expect(items[0]!.nextRenewalDaysAway).toBe(0);
    expect(items[0]!.nextRenewalISO).toBe('2026-07-10');
  });

  it('rolls a past fixed-period anchor forward by whole periods', () => {
    // Weekly anchor lapsed 10 days ago: rolls 2 periods to land on/after today (4 days out).
    const lapsed = sub({
      nextRenewalDaysAway: 0,
      nextRenewalISO: '2026-06-30',
      renewalPeriodDays: 7,
    });
    const { items } = reanchorRenewals([lapsed], '2026-07-10');
    expect(items[0]!.nextRenewalISO).toBe('2026-07-14');
    expect(items[0]!.nextRenewalDaysAway).toBe(4);
  });

  it('rolls a past monthly anchor to the same day-of-month next month', () => {
    const lapsed = sub({ nextRenewalDaysAway: 0, nextRenewalISO: '2026-06-12' });
    const { items } = reanchorRenewals([lapsed], '2026-07-10');
    expect(items[0]!.nextRenewalISO).toBe('2026-07-12');
    expect(items[0]!.nextRenewalDaysAway).toBe(2);
  });

  it('monthly rolling keeps the ORIGINAL day-of-month through short months (31st never drifts to 28th)', () => {
    // Anchor 31 Jan, app closed until 5 Mar. Feb's 31st clamps to the 28th (already past),
    // so the roll lands on 31 Mar — the original day, not February's clamped 28th carried forward.
    const lapsed = sub({ nextRenewalDaysAway: 0, nextRenewalISO: '2026-01-31' });
    const { items } = reanchorRenewals([lapsed], '2026-03-05');
    expect(items[0]!.nextRenewalISO).toBe('2026-03-31');
    expect(items[0]!.nextRenewalDaysAway).toBe(26);
  });

  it('returns the same array instance (changed=false) when nothing needed re-anchoring', () => {
    const fresh = [sub({ nextRenewalDaysAway: 3, nextRenewalISO: '2026-07-13' })];
    const result = reanchorRenewals(fresh, '2026-07-10');
    expect(result.changed).toBe(false);
    expect(result.items).toBe(fresh);
  });

  it('is idempotent — a second pass on the same day changes nothing', () => {
    const first = reanchorRenewals(
      [
        sub({ nextRenewalDaysAway: 12 }),
        sub({ nextRenewalDaysAway: 0, nextRenewalISO: '2026-06-30', renewalPeriodDays: 7 }),
      ],
      '2026-07-10',
    );
    const second = reanchorRenewals(first.items, '2026-07-10');
    expect(second.changed).toBe(false);
    expect(second.items).toBe(first.items);
  });

  it('preserves every other field on the entry (structural passthrough)', () => {
    const rich = { nextRenewalDaysAway: 12, name: 'Spotify', cost: 11 };
    const { items } = reanchorRenewals([rich], '2026-07-10');
    expect(items[0]).toMatchObject({ name: 'Spotify', cost: 11 });
  });
});
