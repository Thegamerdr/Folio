// renewalMath — pure-logic coverage for nextRenewalDaysAwayFrom (lib/renewalMath.ts).
//
// Pins the money-safety fix: BillCaughtSheet/SubCaughtSheet used to hardcode
// nextRenewalDaysAway: 30 on confirm, ignoring the detected cadence + lastDate. This locks in the
// honest day-count derived from those two facts instead.

import { describe, expect, it } from 'vitest';

import { daysUntilDayOfMonth, nextRenewalDaysAwayFrom } from './renewalMath';

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
