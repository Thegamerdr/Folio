// Pot top-up cadence engine — acceptance criteria for ENGINES.md §6
// "Pot top-up cadence — after income arrives" (and §7 @rn-engine pot-cadence).
//
// Pure, deterministic, Node-safe: this exercises only date arithmetic on plain
// ISO strings (no Date overflow reliance, no react-native, no DOM), so it is a
// plain `.test.ts` collected by the apps/**/*.test.ts runner. Relative imports
// of the engine module + sibling payday engine like the sibling store.test.ts /
// payday.test.ts (the runner has no `@` alias).
//
// Contract under test:
//   resolveNextTopUp(cadence, ctx) -> TopUpResolution
//     cadence = { kind:'after-payday' }
//             | { kind:'weekly',  weekday: 0..6 }
//             | { kind:'monthly', dayOfMonth: 1..31 }
//             | { kind:'custom',  nextDate: 'YYYY-MM-DD' }
//     ctx     = { now: 'YYYY-MM-DD'; nextPayday?: 'YYYY-MM-DD' }
//   (1) after-payday -> the next payday date (from ctx.nextPayday);
//       when no payday is known -> the ASK_USER sentinel (never a guessed date,
//       never silently Friday);
//   (2) weekly  -> the next occurrence of `weekday` on/after now;
//   (3) monthly -> next occurrence of `dayOfMonth`, clamped via the payday
//       engine's clamp rule (Feb 31 -> Feb 28/29, never March);
//   (4) custom  -> the user-picked nextDate verbatim.

import { describe, expect, it } from 'vitest';

import { resolvePayday } from './payday';
import { ASK_USER, resolveNextTopUp } from './potCadence';

// ---------------------------------------------------------------------------
// (1) after-payday — the only honest default: money moves to pots after it lands
// ---------------------------------------------------------------------------
describe('resolveNextTopUp — after-payday', () => {
  it('resolves to the next payday date when a payday is known', () => {
    const res = resolveNextTopUp(
      { kind: 'after-payday' },
      { now: '2026-07-01', nextPayday: '2026-07-25' },
    );
    expect(res).toEqual({ kind: 'date', date: '2026-07-25' });
  });

  it('returns the ASK_USER sentinel when no payday is known (never guesses, never Friday)', () => {
    const res = resolveNextTopUp({ kind: 'after-payday' }, { now: '2026-07-01' });
    expect(res).toEqual(ASK_USER);
    expect(res.kind).toBe('ask-user');
  });

  it('returns ASK_USER when nextPayday is explicitly undefined', () => {
    const res = resolveNextTopUp(
      { kind: 'after-payday' },
      { now: '2026-07-01', nextPayday: undefined },
    );
    expect(res).toEqual(ASK_USER);
  });
});

// ---------------------------------------------------------------------------
// (2) weekly — next occurrence of the user-picked weekday (0 = Sun .. 6 = Sat)
// ---------------------------------------------------------------------------
describe('resolveNextTopUp — weekly', () => {
  it('jumps forward to the next given weekday later this week', () => {
    // 2026-07-01 is a Wednesday (3). Next Friday (5) is 2026-07-03.
    const res = resolveNextTopUp({ kind: 'weekly', weekday: 5 }, { now: '2026-07-01' });
    expect(res).toEqual({ kind: 'date', date: '2026-07-03' });
  });

  it('does NOT hardcode Friday — a Monday cadence resolves to the next Monday', () => {
    // 2026-07-01 (Wed, 3). Next Monday (1) is 2026-07-06.
    const res = resolveNextTopUp({ kind: 'weekly', weekday: 1 }, { now: '2026-07-01' });
    expect(res).toEqual({ kind: 'date', date: '2026-07-06' });
  });

  it('returns today when today already IS the chosen weekday', () => {
    // 2026-07-01 is a Wednesday (3); asking for Wednesday returns today.
    const res = resolveNextTopUp({ kind: 'weekly', weekday: 3 }, { now: '2026-07-01' });
    expect(res).toEqual({ kind: 'date', date: '2026-07-01' });
  });

  it('rolls into the next calendar week when the weekday already passed', () => {
    // 2026-07-03 is a Friday (5). Asking for Wednesday (3) -> 2026-07-08.
    const res = resolveNextTopUp({ kind: 'weekly', weekday: 3 }, { now: '2026-07-03' });
    expect(res).toEqual({ kind: 'date', date: '2026-07-08' });
  });

  it('crosses a month boundary when the next weekday lands in the next month', () => {
    // 2026-07-30 is a Thursday (4). Next Sunday (0) is 2026-08-02.
    const res = resolveNextTopUp({ kind: 'weekly', weekday: 0 }, { now: '2026-07-30' });
    expect(res).toEqual({ kind: 'date', date: '2026-08-02' });
  });
});

// ---------------------------------------------------------------------------
// (3) monthly — clamp via the payday engine (Feb 31 -> Feb 28/29, never March)
// ---------------------------------------------------------------------------
describe('resolveNextTopUp — monthly', () => {
  it('uses the day-of-month later this month when it is still ahead', () => {
    // 2026-07-01: the 15th of this month is still ahead.
    const res = resolveNextTopUp({ kind: 'monthly', dayOfMonth: 15 }, { now: '2026-07-01' });
    expect(res).toEqual({ kind: 'date', date: resolvePayday({ dayOfMonth: 15 }, '2026-07') });
  });

  it('rolls to next month once this month’s day-of-month has passed', () => {
    // 2026-07-20: the 15th already passed -> resolve August's 15th.
    const res = resolveNextTopUp({ kind: 'monthly', dayOfMonth: 15 }, { now: '2026-07-20' });
    expect(res).toEqual({ kind: 'date', date: resolvePayday({ dayOfMonth: 15 }, '2026-08') });
  });

  it('clamps Feb 31 to the last valid Feb day in a non-leap year (never March)', () => {
    // 2026-02 has 28 days. dayOfMonth 31 must clamp into February, not overflow.
    const res = resolveNextTopUp({ kind: 'monthly', dayOfMonth: 31 }, { now: '2026-02-01' });
    expect(res).toEqual({ kind: 'date', date: resolvePayday({ dayOfMonth: 31 }, '2026-02') });
    // And concretely: the resolved date is in February, never March.
    if (res.kind === 'date') {
      expect(res.date.slice(0, 7)).toBe('2026-02');
    }
  });

  it('clamps Feb 31 to Feb 29 in a leap year (never March)', () => {
    // 2024-02 has 29 days (leap). dayOfMonth 31 clamps to the 29th.
    const res = resolveNextTopUp({ kind: 'monthly', dayOfMonth: 31 }, { now: '2024-02-01' });
    expect(res).toEqual({ kind: 'date', date: resolvePayday({ dayOfMonth: 31 }, '2024-02') });
    if (res.kind === 'date') {
      expect(res.date.slice(0, 7)).toBe('2024-02');
    }
  });

  it('returns today when the clamped day-of-month resolves to exactly today', () => {
    // resolvePayday({ dayOfMonth: 15 }, '2026-07') is the in-month anchor; pin
    // `now` to that exact resolved date and expect it returned (on/after rule).
    const anchor = resolvePayday({ dayOfMonth: 15 }, '2026-07');
    const res = resolveNextTopUp({ kind: 'monthly', dayOfMonth: 15 }, { now: anchor });
    expect(res).toEqual({ kind: 'date', date: anchor });
  });
});

// ---------------------------------------------------------------------------
// (4) custom — the user re-picks each time; return their date verbatim
// ---------------------------------------------------------------------------
describe('resolveNextTopUp — custom', () => {
  it('returns the user-picked nextDate verbatim', () => {
    const res = resolveNextTopUp({ kind: 'custom', nextDate: '2026-09-04' }, { now: '2026-07-01' });
    expect(res).toEqual({ kind: 'date', date: '2026-09-04' });
  });

  it('returns a past custom date verbatim (the engine does not second-guess the user)', () => {
    const res = resolveNextTopUp({ kind: 'custom', nextDate: '2026-06-01' }, { now: '2026-07-01' });
    expect(res).toEqual({ kind: 'date', date: '2026-06-01' });
  });
});

// ---------------------------------------------------------------------------
// Determinism — same inputs always yield the same output
// ---------------------------------------------------------------------------
describe('resolveNextTopUp — determinism', () => {
  it('is referentially stable across repeated calls', () => {
    const a = resolveNextTopUp({ kind: 'weekly', weekday: 5 }, { now: '2026-07-01' });
    const b = resolveNextTopUp({ kind: 'weekly', weekday: 5 }, { now: '2026-07-01' });
    expect(a).toEqual(b);
  });
});
