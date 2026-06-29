// Payday-clamp engine tests — acceptance criteria for ENGINES.md §6
// "Payday — overflow + weekends + holidays" (and §7 @rn-engine payday-clamp).
//
// Pure, deterministic, Node-safe: this exercises only date arithmetic on plain
// strings/numbers (no Date overflow, no react-native, no DOM), so it is a plain
// `.test.ts` collected by the apps/**/*.test.ts runner. Relative import of the
// engine module like the sibling store.test.ts (the runner has no @ alias).
//
// Contract under test:
//   resolvePayday(rule, yearMonth) -> ISO "YYYY-MM-DD"
//     rule = { dayOfMonth: 1..31, weekendRule?: 'previous'|'next'|'exact' }
//   (1) clamp dayOfMonth to the last valid day of the month (never overflow);
//   (2) if the clamped date is Sat/Sun, shift per weekendRule (default 'previous');
//   (3) isBusinessDay(date) — weekends-only for now (UK bank holidays post-MVP).

import { describe, expect, it } from 'vitest';

import { isBusinessDay, resolvePayday } from './payday';

// ---------------------------------------------------------------------------
// (1) Month-overflow clamp — invalid day-of-month -> last valid day of month
// ---------------------------------------------------------------------------
describe('resolvePayday — month-overflow clamp', () => {
  it('Feb 31 in a non-leap year clamps to Feb 28 (never Mar 3)', () => {
    // 2026-02 has 28 days. weekendRule 'exact' isolates the clamp from the
    // weekend shift (2026-02-28 is a Saturday).
    expect(resolvePayday({ dayOfMonth: 31, weekendRule: 'exact' }, '2026-02')).toBe(
      '2026-02-28',
    );
  });

  it('Feb 31 in a leap year clamps to Feb 29 (never Mar 2)', () => {
    // 2024 is a leap year -> Feb has 29 days. 2024-02-29 is a Thursday, so the
    // default 'previous' weekend rule leaves it unchanged.
    expect(resolvePayday({ dayOfMonth: 31 }, '2024-02')).toBe('2024-02-29');
  });

  it('30th in February clamps to the last valid Feb day', () => {
    expect(resolvePayday({ dayOfMonth: 30, weekendRule: 'exact' }, '2026-02')).toBe(
      '2026-02-28',
    );
    expect(resolvePayday({ dayOfMonth: 30 }, '2024-02')).toBe('2024-02-29');
  });

  it('31st in a 30-day month clamps to the 30th (April -> Apr 30)', () => {
    // 2026-04-30 is a Thursday — no weekend shift.
    expect(resolvePayday({ dayOfMonth: 31 }, '2026-04')).toBe('2026-04-30');
  });

  it('a valid day-of-month is left exactly where it lands (no clamp)', () => {
    // 2026-03-15 is a Sunday; isolate clamp behaviour with 'exact'.
    expect(resolvePayday({ dayOfMonth: 15, weekendRule: 'exact' }, '2026-03')).toBe(
      '2026-03-15',
    );
  });
});

// ---------------------------------------------------------------------------
// (2) Weekend shift — per weekendRule, default 'previous' (UK payroll)
// ---------------------------------------------------------------------------
describe('resolvePayday — weekend shift', () => {
  // Saturday 2026-02-28 is the clamped Feb payday for dayOfMonth 31.
  it("Saturday payday shifts to the previous Friday by default ('previous')", () => {
    // 2026-02-28 (Sat) -> 2026-02-27 (Fri).
    expect(resolvePayday({ dayOfMonth: 31 }, '2026-02')).toBe('2026-02-27');
  });

  it("a payday landing on a Saturday shifts to the previous Friday (explicit 'previous')", () => {
    // 2026-08-15 is a Saturday -> previous working day 2026-08-14 (Friday).
    expect(resolvePayday({ dayOfMonth: 15, weekendRule: 'previous' }, '2026-08')).toBe(
      '2026-08-14',
    );
  });

  it("a payday landing on a Sunday shifts to the previous Friday ('previous')", () => {
    // 2026-03-15 is a Sunday -> previous working day 2026-03-13 (Friday).
    expect(resolvePayday({ dayOfMonth: 15, weekendRule: 'previous' }, '2026-03')).toBe(
      '2026-03-13',
    );
  });

  it("'next' shifts a Saturday forward to the following Monday", () => {
    // 2026-08-15 (Sat) -> 2026-08-17 (Mon).
    expect(resolvePayday({ dayOfMonth: 15, weekendRule: 'next' }, '2026-08')).toBe(
      '2026-08-17',
    );
  });

  it("'next' shifts a Sunday forward to the following Monday", () => {
    // 2026-03-15 (Sun) -> 2026-03-16 (Mon).
    expect(resolvePayday({ dayOfMonth: 15, weekendRule: 'next' }, '2026-03')).toBe(
      '2026-03-16',
    );
  });

  it("'next' from a month-end Saturday crosses into the next month", () => {
    // 2026-10-31 is a Saturday -> 'next' -> 2026-11-02 (Monday).
    expect(resolvePayday({ dayOfMonth: 31, weekendRule: 'next' }, '2026-10')).toBe(
      '2026-11-02',
    );
  });

  it("'exact' passes a weekend date straight through with no shift", () => {
    // 2026-02-28 (Sat) stays put under 'exact'.
    expect(resolvePayday({ dayOfMonth: 31, weekendRule: 'exact' }, '2026-02')).toBe(
      '2026-02-28',
    );
    // 2026-03-15 (Sun) stays put under 'exact'.
    expect(resolvePayday({ dayOfMonth: 15, weekendRule: 'exact' }, '2026-03')).toBe(
      '2026-03-15',
    );
  });

  it('a weekday payday is unaffected by any weekend rule', () => {
    // 2026-06-15 is a Monday.
    expect(resolvePayday({ dayOfMonth: 15, weekendRule: 'previous' }, '2026-06')).toBe(
      '2026-06-15',
    );
    expect(resolvePayday({ dayOfMonth: 15, weekendRule: 'next' }, '2026-06')).toBe(
      '2026-06-15',
    );
    expect(resolvePayday({ dayOfMonth: 15, weekendRule: 'exact' }, '2026-06')).toBe(
      '2026-06-15',
    );
  });

  it("clamp then shift compose: 'previous' from a month-end Saturday stays in-month", () => {
    // 2026-10-31 (Sat) -> clamp is a no-op (Oct has 31 days) -> 'previous' ->
    // 2026-10-30 (Friday).
    expect(resolvePayday({ dayOfMonth: 31, weekendRule: 'previous' }, '2026-10')).toBe(
      '2026-10-30',
    );
  });
});

// ---------------------------------------------------------------------------
// (3) isBusinessDay — weekends only for now (UK bank holidays post-MVP)
// ---------------------------------------------------------------------------
describe('isBusinessDay', () => {
  it('returns true for Monday through Friday', () => {
    expect(isBusinessDay('2026-06-15')).toBe(true); // Mon
    expect(isBusinessDay('2026-06-16')).toBe(true); // Tue
    expect(isBusinessDay('2026-06-17')).toBe(true); // Wed
    expect(isBusinessDay('2026-06-18')).toBe(true); // Thu
    expect(isBusinessDay('2026-06-19')).toBe(true); // Fri
  });

  it('returns false for Saturday and Sunday', () => {
    expect(isBusinessDay('2026-06-20')).toBe(false); // Sat
    expect(isBusinessDay('2026-06-21')).toBe(false); // Sun
  });

  it('does not yet treat a UK bank holiday as non-business (post-MVP)', () => {
    // 2025-12-25 (Christmas Day) is a Thursday — a bank holiday, but the
    // weekends-only MVP rule still reports it as a business day.
    expect(isBusinessDay('2025-12-25')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Determinism — same inputs always yield the same output
// ---------------------------------------------------------------------------
describe('resolvePayday — determinism', () => {
  it('is referentially stable across repeated calls', () => {
    const a = resolvePayday({ dayOfMonth: 31 }, '2026-02');
    const b = resolvePayday({ dayOfMonth: 31 }, '2026-02');
    expect(a).toBe(b);
  });
});
