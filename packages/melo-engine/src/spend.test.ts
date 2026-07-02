import { describe, expect, it } from 'vitest';

import {
  dayOfWeek,
  observedRunRatePence,
  recoveryMovePence,
  shiftWeekendToFriday,
  type SpendEntry,
} from './spend.js';

const e = (id: string, amountPence: number, atISO: string): SpendEntry => ({
  id,
  amountPence,
  atISO,
});

describe('observedRunRatePence', () => {
  it('is null when nothing has been logged — the engine never pretends to know', () => {
    expect(observedRunRatePence([], '2026-07-02')).toBeNull();
  });

  it('a single same-day spend reads as that day’s rate', () => {
    expect(observedRunRatePence([e('a', 1_200, '2026-07-02')], '2026-07-02')).toBe(1_200);
  });

  it('averages over the observed span, not the full window', () => {
    // £30 across 3 observed days (oldest is 2 days old) → £10/day, not £30/7.
    const entries = [
      e('a', 1_000, '2026-06-30'),
      e('b', 1_000, '2026-07-01'),
      e('c', 1_000, '2026-07-02'),
    ];
    expect(observedRunRatePence(entries, '2026-07-02')).toBe(1_000);
  });

  it('ignores entries older than the window and future-dated entries', () => {
    const entries = [
      e('old', 99_900, '2026-06-20'),
      e('future', 99_900, '2026-07-05'),
      e('now', 700, '2026-07-02'),
    ];
    expect(observedRunRatePence(entries, '2026-07-02')).toBe(700);
  });

  it('rounds the rate UP — conservative against the user’s favourite optimism', () => {
    // £10 over 3 days = 333.33… → 334.
    expect(observedRunRatePence([e('a', 1_000, '2026-06-30')], '2026-07-02')).toBe(334);
  });

  it('rejects fractional pence', () => {
    expect(() => observedRunRatePence([e('a', 10.5, '2026-07-02')], '2026-07-02')).toThrow(
      /integer pence/,
    );
  });
});

describe('weekend payday shift (UK: paid the Friday before)', () => {
  it('knows its weekdays', () => {
    expect(dayOfWeek('2026-07-02')).toBe(4); // Thursday
    expect(dayOfWeek('2026-07-04')).toBe(6); // Saturday
    expect(dayOfWeek('2026-07-05')).toBe(0); // Sunday
  });

  it('Saturday payday pays Friday', () => {
    expect(shiftWeekendToFriday('2026-07-04')).toBe('2026-07-03');
  });

  it('Sunday payday pays Friday', () => {
    expect(shiftWeekendToFriday('2026-07-05')).toBe('2026-07-03');
  });

  it('weekdays are untouched', () => {
    expect(shiftWeekendToFriday('2026-07-02')).toBe('2026-07-02');
  });

  it('shifts across month boundaries', () => {
    // 2026-08-01 is a Saturday → 2026-07-31.
    expect(shiftWeekendToFriday('2026-08-01')).toBe('2026-07-31');
  });
});

describe('recoveryMovePence — the one move today, derived', () => {
  it('is the £5 floor when the zone is not negative', () => {
    expect(recoveryMovePence(1_200, 10)).toBe(5_00);
  });

  it('closes the overshoot by payday, rounded to a clean pound', () => {
    // £23 over, 5 days → £4.60/day → £5 (floor keeps it achievable and clean).
    expect(recoveryMovePence(-2_300, 5)).toBe(5_00);
    // £80 over, 10 days → £8/day.
    expect(recoveryMovePence(-8_000, 10)).toBe(8_00);
  });

  it('caps at £20 — a plan, never a punishment', () => {
    expect(recoveryMovePence(-100_000, 3)).toBe(20_00);
  });

  it('survives zero days to payday', () => {
    expect(recoveryMovePence(-2_000, 0)).toBe(20_00);
  });
});
