// Debt amortization engine tests — pure-logic coverage for the AddEntry "debt"
// path engine at apps/mobile/src/folio/lib/debt.ts (BUILD_PLAN §3,
// `@rn-engine debt-engine`).
//
// Every case pins an explicit `now` (ISO date) so the cadence stepping, the
// on/after first-due rule, and the clamp/weekend shift are all deterministic
// regardless of when the suite runs. The engine emits pure-UTC ISO dates via
// the shared `resolvePayday` clamp, so date expectations are exact literals —
// and the weekend/clamp cases assert directly against `resolvePayday` so the
// debt schedule and the payday engine can never drift. No DOM, no react-native
// runtime — a plain `.test.ts` collected by the apps/**/*.test.ts runner.
// Relative engine import like the sibling potCadence.test.ts / payday.test.ts.

import { describe, expect, it } from 'vitest';

import { buildDebtSchedule, type DebtInput } from './debt';
import { resolvePayday } from './payday';

// A canonical Klarna-style debt: £540 over 6 monthly payments, due on the 12th.
function klarna(overrides: Partial<DebtInput> = {}): DebtInput {
  return {
    name: 'Klarna sofa',
    balance: 540,
    dueDay: 12,
    cadence: 'monthly',
    paymentsLeft: 6,
    amount: 90,
    ...overrides,
  };
}

// Sum of a schedule's payment amounts, rounded to whole pence to compare exactly.
function sumPayments(amounts: number[]): number {
  return Math.round(amounts.reduce((a, b) => a + b, 0) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Schedule length === paymentsLeft
// ---------------------------------------------------------------------------
describe('buildDebtSchedule — schedule length', () => {
  it('produces exactly `paymentsLeft` dated rows', () => {
    const s = buildDebtSchedule(klarna({ paymentsLeft: 6 }), { now: '2026-07-01' });
    expect(s.payments).toHaveLength(6);
    expect(s.remaining).toBe(6);
  });

  it('honours a different remaining count', () => {
    const s = buildDebtSchedule(klarna({ paymentsLeft: 12, balance: 1080 }), { now: '2026-07-01' });
    expect(s.payments).toHaveLength(12);
    expect(s.remaining).toBe(12);
  });

  it('returns an empty, honest plan when nothing is left to pay', () => {
    const s = buildDebtSchedule(klarna({ paymentsLeft: 0 }), { now: '2026-07-01' });
    expect(s.payments).toEqual([]);
    expect(s.remaining).toBe(0);
    expect(s.payoffDate).toBeNull();
    expect(s.finalPayment).toBe(0);
  });

  it('sanitises a negative / NaN payment count to an empty plan (never crashes)', () => {
    const neg = buildDebtSchedule(klarna({ paymentsLeft: -3 }), { now: '2026-07-01' });
    expect(neg.payments).toEqual([]);
    const nan = buildDebtSchedule(klarna({ paymentsLeft: Number.NaN }), { now: '2026-07-01' });
    expect(nan.payments).toEqual([]);
  });

  it('truncates a fractional payment count to whole rows', () => {
    const s = buildDebtSchedule(klarna({ paymentsLeft: 6.9 }), { now: '2026-07-01' });
    expect(s.payments).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// Dates honour cadence + dueDay
// ---------------------------------------------------------------------------
describe('buildDebtSchedule — monthly cadence + dueDay', () => {
  it('places each payment on the dueDay, one month apart, starting on/after now', () => {
    // now = 1 Jul 2026; dueDay = 12. First due is 12 Jul (a Sunday) -> the
    // payday clamp shifts weekend-previous to Fri 10 Jul. Each subsequent month
    // re-resolves the 12th independently.
    const s = buildDebtSchedule(klarna({ paymentsLeft: 3 }), { now: '2026-07-01' });
    expect(s.payments.map((p) => p.date)).toEqual([
      resolvePayday({ dayOfMonth: 12, weekendRule: 'previous' }, '2026-07'),
      resolvePayday({ dayOfMonth: 12, weekendRule: 'previous' }, '2026-08'),
      resolvePayday({ dayOfMonth: 12, weekendRule: 'previous' }, '2026-09'),
    ]);
    // The 1-based index ladder is intact.
    expect(s.payments.map((p) => p.index)).toEqual([1, 2, 3]);
  });

  it('rolls the first payment into next month once this month`s dueDay has passed', () => {
    // now = 20 Jul 2026; dueDay = 12 already passed this month -> first due is
    // August's 12th, then September's.
    const s = buildDebtSchedule(klarna({ paymentsLeft: 2 }), { now: '2026-07-20' });
    expect(s.payments.map((p) => p.date)).toEqual([
      resolvePayday({ dayOfMonth: 12, weekendRule: 'previous' }, '2026-08'),
      resolvePayday({ dayOfMonth: 12, weekendRule: 'previous' }, '2026-09'),
    ]);
  });

  it('keeps the payment on the resolved dueDay when now sits exactly on it', () => {
    // The 12th of July resolves to Fri 10 Jul (weekend-previous). Pin now to that
    // resolved date at UTC midnight — the on/after rule keeps it as payment 1.
    const firstDue = resolvePayday({ dayOfMonth: 12, weekendRule: 'previous' }, '2026-07');
    const s = buildDebtSchedule(klarna({ paymentsLeft: 1, balance: 90 }), { now: firstDue });
    expect(s.payments[0]?.date).toBe(firstDue);
  });
});

describe('buildDebtSchedule — yearly cadence', () => {
  it('steps the dueDay one YEAR apart', () => {
    const s = buildDebtSchedule(
      klarna({ cadence: 'yearly', paymentsLeft: 3, dueDay: 15, balance: 300, amount: 100 }),
      { now: '2026-07-01' },
    );
    expect(s.payments.map((p) => p.date)).toEqual([
      resolvePayday({ dayOfMonth: 15, weekendRule: 'previous' }, '2026-07'),
      resolvePayday({ dayOfMonth: 15, weekendRule: 'previous' }, '2027-07'),
      resolvePayday({ dayOfMonth: 15, weekendRule: 'previous' }, '2028-07'),
    ]);
  });
});

describe('buildDebtSchedule — weekly cadence', () => {
  it('steps by whole weeks (7 days), anchored to the agreed weekday', () => {
    // First due is the clamped/weekend-shifted dueDay, then +7 days each step.
    const s = buildDebtSchedule(
      klarna({ cadence: 'weekly', paymentsLeft: 4, dueDay: 8, balance: 200, amount: 50 }),
      { now: '2026-07-01' },
    );
    const dates = s.payments.map((p) => p.date);
    // Each subsequent date is exactly 7 days after the previous (UTC arithmetic).
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(`${dates[i - 1]}T00:00:00Z`).getTime();
      const cur = new Date(`${dates[i]}T00:00:00Z`).getTime();
      expect((cur - prev) / 86_400_000).toBe(7);
    }
    // The first date is on/after now.
    expect(dates[0]! >= '2026-07-01').toBe(true);
  });

  it('keeps a stable weekday across the weekly schedule', () => {
    const s = buildDebtSchedule(
      klarna({ cadence: 'weekly', paymentsLeft: 5, dueDay: 8, balance: 250, amount: 50 }),
      { now: '2026-07-01' },
    );
    const weekdays = s.payments.map((p) => new Date(`${p.date}T00:00:00Z`).getUTCDay());
    // Every payment shares the same UTC weekday (a true weekly cadence).
    expect(new Set(weekdays).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Final payment clears the balance (exactly, to the penny)
// ---------------------------------------------------------------------------
describe('buildDebtSchedule — clears the balance', () => {
  it('sums to the balance exactly when it divides evenly', () => {
    // £540 / 6 = £90 exactly.
    const s = buildDebtSchedule(klarna(), { now: '2026-07-01' });
    expect(sumPayments(s.payments.map((p) => p.amount))).toBe(540);
    // Every row is the agreed £90, and the balance runs to 0.
    expect(s.payments.every((p) => p.amount === 90)).toBe(true);
    expect(s.payments.at(-1)?.balanceAfter).toBe(0);
    expect(s.finalPayment).toBe(90);
  });

  it('absorbs the residual into the final payment when it does NOT divide evenly', () => {
    // £100 over 3 payments of £33.33 -> 33.33 + 33.33 + residual 33.34 = 100.00.
    const s = buildDebtSchedule(klarna({ balance: 100, paymentsLeft: 3, amount: 33.33 }), {
      now: '2026-07-01',
    });
    expect(s.payments.map((p) => p.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(sumPayments(s.payments.map((p) => p.amount))).toBe(100);
    expect(s.payments.at(-1)?.balanceAfter).toBe(0);
    expect(s.finalPayment).toBe(33.34);
  });

  it('clears early when the instalment is larger than the remaining balance', () => {
    // £50 owed but a £90 instalment over a nominal 6 -> the first row clears it,
    // the rest are £0 placeholders, and the balance never goes negative.
    const s = buildDebtSchedule(klarna({ balance: 50, paymentsLeft: 6, amount: 90 }), {
      now: '2026-07-01',
    });
    expect(s.payments[0]?.amount).toBe(50);
    expect(s.payments[0]?.balanceAfter).toBe(0);
    expect(s.payments.slice(1).every((p) => p.amount === 0)).toBe(true);
    expect(sumPayments(s.payments.map((p) => p.amount))).toBe(50);
  });

  it('reports the payoffDate as the final payment`s date', () => {
    const s = buildDebtSchedule(klarna({ paymentsLeft: 6 }), { now: '2026-07-01' });
    expect(s.payoffDate).toBe(s.payments.at(-1)?.date);
    expect(s.payoffDate).toBe(
      resolvePayday({ dayOfMonth: 12, weekendRule: 'previous' }, '2026-12'),
    );
  });

  it('runs the balanceAfter ladder monotonically down to zero', () => {
    const s = buildDebtSchedule(klarna(), { now: '2026-07-01' });
    const balances = s.payments.map((p) => p.balanceAfter);
    // 450, 360, 270, 180, 90, 0.
    expect(balances).toEqual([450, 360, 270, 180, 90, 0]);
  });
});

// ---------------------------------------------------------------------------
// Weekend / clamp consistency with payday.ts
// ---------------------------------------------------------------------------
describe('buildDebtSchedule — weekend + clamp match payday.ts', () => {
  it('clamps a dueDay of 31 into February (never March), exactly like payday', () => {
    // Monthly, dueDay 31, starting Jan 2026. February has 28 days in 2026, so the
    // Feb instalment clamps into February — identical to resolvePayday.
    const s = buildDebtSchedule(
      klarna({ dueDay: 31, paymentsLeft: 3, balance: 300, amount: 100 }),
      { now: '2026-01-01' },
    );
    expect(s.payments.map((p) => p.date)).toEqual([
      resolvePayday({ dayOfMonth: 31, weekendRule: 'previous' }, '2026-01'),
      resolvePayday({ dayOfMonth: 31, weekendRule: 'previous' }, '2026-02'),
      resolvePayday({ dayOfMonth: 31, weekendRule: 'previous' }, '2026-03'),
    ]);
    // Concretely: the February row is in February, not March.
    expect(s.payments[1]?.date.slice(0, 7)).toBe('2026-02');
  });

  it('shifts a weekend dueDay to the previous working day by default', () => {
    // 12 Jul 2026 is a Sunday; weekend-previous moves it to Fri 10 Jul.
    const s = buildDebtSchedule(klarna({ paymentsLeft: 1, balance: 90 }), { now: '2026-07-01' });
    const expected = resolvePayday({ dayOfMonth: 12, weekendRule: 'previous' }, '2026-07');
    expect(s.payments[0]?.date).toBe(expected);
    expect(new Date(`${expected}T00:00:00Z`).getUTCDay()).toBe(5); // Friday
  });

  it('honours an explicit `next` weekendRule, matching payday`s `next`', () => {
    const s = buildDebtSchedule(klarna({ paymentsLeft: 1, balance: 90 }), {
      now: '2026-07-01',
      weekendRule: 'next',
    });
    expect(s.payments[0]?.date).toBe(
      resolvePayday({ dayOfMonth: 12, weekendRule: 'next' }, '2026-07'),
    );
  });

  it('honours an explicit `exact` weekendRule (no shift), matching payday`s `exact`', () => {
    const s = buildDebtSchedule(klarna({ paymentsLeft: 1, balance: 90 }), {
      now: '2026-07-01',
      weekendRule: 'exact',
    });
    expect(s.payments[0]?.date).toBe(
      resolvePayday({ dayOfMonth: 12, weekendRule: 'exact' }, '2026-07'),
    );
    expect(s.payments[0]?.date).toBe('2026-07-12');
  });
});

// ---------------------------------------------------------------------------
// Determinism + boundary parsing
// ---------------------------------------------------------------------------
describe('buildDebtSchedule — determinism + boundaries', () => {
  it('is referentially stable across repeated calls', () => {
    const a = buildDebtSchedule(klarna(), { now: '2026-07-01' });
    const b = buildDebtSchedule(klarna(), { now: '2026-07-01' });
    expect(a).toEqual(b);
  });

  it('throws on a malformed `now` (engine boundary fails fast)', () => {
    expect(() => buildDebtSchedule(klarna(), { now: 'nope' })).toThrow(/YYYY-MM-DD/);
  });

  it('crosses a year boundary correctly for a long monthly plan', () => {
    // 12 monthly payments from Jul 2026 land Jul 2026 .. Jun 2027.
    const s = buildDebtSchedule(klarna({ paymentsLeft: 12, balance: 1080, amount: 90 }), {
      now: '2026-07-01',
    });
    expect(s.payments).toHaveLength(12);
    expect(s.payoffDate).toBe(
      resolvePayday({ dayOfMonth: 12, weekendRule: 'previous' }, '2027-06'),
    );
    expect(s.payments.at(-1)?.balanceAfter).toBe(0);
  });
});
