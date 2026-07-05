/**
 * Debt amortisation engine — pure functions, no store reads.
 *
 * RN port of folio-melo (design-main) `src/lib/modes/debtEngine.ts`, verbatim.
 * Feeds the Debt lens strategy and the Debt HERO panel. Standard
 * loan math: monthly compounding, fixed payment. Closed-form
 * payoff-month formula:
 *   n = -ln(1 - r*B/P) / ln(1 + r)
 * where r = apr/12/100, B = balance, P = monthly payment.
 *
 * Edge cases handled explicitly:
 *   - apr === 0 → n = ceil(B / P)                     (interest-free)
 *   - P <= r*B  → payoff impossible, returns Infinity (drowning)
 *   - B === 0   → n = 0
 */
import type { Debt } from '../../store';

/** Closed-form payoff months. Returns `Infinity` when the payment
 *  never covers the interest (the balance grows). */
export function payoffMonths(balance: number, apr: number, monthlyPayment: number): number {
  if (balance <= 0) return 0;
  if (monthlyPayment <= 0) return Infinity;
  if (apr <= 0) return Math.ceil(balance / monthlyPayment);
  const r = apr / 12 / 100;
  const interestOnly = r * balance;
  if (monthlyPayment <= interestOnly) return Infinity;
  const n = -Math.log(1 - (r * balance) / monthlyPayment) / Math.log(1 + r);
  return Math.ceil(n);
}

/** Total interest paid over the payoff. Infinity for drowning debts. */
export function totalInterest(balance: number, apr: number, monthlyPayment: number): number {
  const n = payoffMonths(balance, apr, monthlyPayment);
  if (!isFinite(n)) return Infinity;
  return Math.max(0, monthlyPayment * n - balance);
}

/** Balance-weighted APR across the whole portfolio. £-weighted so a
 *  large 0% BNPL doesn't drown out a small high-APR card. */
export function weightedApr(debts: Debt[]): number {
  const total = debts.reduce((s, d) => s + d.balance, 0);
  if (total <= 0) return 0;
  return debts.reduce((s, d) => s + (d.apr * d.balance) / total, 0);
}

/** Avalanche: highest APR first (cheapest total interest). */
export function orderAvalanche(debts: Debt[]): Debt[] {
  return [...debts].sort((a, b) => b.apr - a.apr || a.balance - b.balance);
}

/** Snowball: smallest balance first (fastest wins for morale). */
export function orderSnowball(debts: Debt[]): Debt[] {
  return [...debts].sort((a, b) => a.balance - b.balance || b.apr - a.apr);
}

/** Days until the soonest due-day from today. Wraps to next month
 *  when today has already passed all dueDoms. */
export function daysToNextDue(debts: Debt[], today: Date = new Date()): number | null {
  if (debts.length === 0) return null;
  const dom = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const soonest = Math.min(
    ...debts.map((d) => {
      const clamped = Math.min(d.dueDom, daysInMonth);
      return clamped >= dom ? clamped - dom : daysInMonth - dom + clamped;
    }),
  );
  return soonest;
}

/** The single debt with the soonest due date. Ties broken by higher APR. */
export function nextDueDebt(debts: Debt[], today: Date = new Date()): Debt | null {
  if (debts.length === 0) return null;
  const dom = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const withDays = debts.map((d) => {
    const clamped = Math.min(d.dueDom, daysInMonth);
    const days = clamped >= dom ? clamped - dom : daysInMonth - dom + clamped;
    return { debt: d, days };
  });
  withDays.sort((a, b) => a.days - b.days || b.debt.apr - a.debt.apr);
  return withDays[0]?.debt ?? null;
}

export type DebtSummary = {
  total: number;
  minSum: number;
  weightedApr: number;
  /** Portfolio-wide payoff at the sum of minimums (uses the highest
   *  APR as the effective rate — a conservative honest estimate that
   *  never under-promises months, since mixing rates compounds worse
   *  than a single-rate loan). */
  monthsAtMin: number;
  /** Payoff with `extraPerMonth` on top of minimums, using avalanche
   *  (the extra applied to the highest-APR debt first). */
  monthsWithExtra: number;
  /** Total interest saved vs min-only, over the whole portfolio. */
  interestSaved: number;
  /** Nearest due date (days from today), or null when no debts. */
  daysToNextDue: number | null;
  /** The specific debt that lands next, or null. */
  nextDue: Debt | null;
};

/** Portfolio-level summary — the numbers the HERO panel + strategy read. */
export function summarise(
  debts: Debt[],
  extraPerMonth: number = 0,
  today: Date = new Date(),
): DebtSummary {
  const total = debts.reduce((s, d) => s + d.balance, 0);
  const minSum = debts.reduce((s, d) => s + d.minPayment, 0);
  const wApr = weightedApr(debts);
  const worstApr = debts.reduce((m, d) => Math.max(m, d.apr), 0);
  const monthsAtMin = payoffMonths(total, worstApr, minSum);
  const monthsWithExtra = payoffMonths(total, worstApr, minSum + Math.max(0, extraPerMonth));
  const intMin = totalInterest(total, worstApr, minSum);
  const intExtra = totalInterest(total, worstApr, minSum + Math.max(0, extraPerMonth));
  const interestSaved = isFinite(intMin) && isFinite(intExtra) ? Math.max(0, intMin - intExtra) : 0;
  return {
    total,
    minSum,
    weightedApr: wApr,
    monthsAtMin,
    monthsWithExtra,
    interestSaved,
    daysToNextDue: daysToNextDue(debts, today),
    nextDue: nextDueDebt(debts, today),
  };
}
