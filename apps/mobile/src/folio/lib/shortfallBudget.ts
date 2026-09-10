import type { RouteResult } from './moneyPath';

/** Recovery uses current cash after obligations, living costs and the protected buffer.
 * `spare` is forecast closing cash ON payday, including that future receipt, so it cannot fund
 * discretionary spending before payday. Keep the gap exact; only the approximate daily guide rounds down.
 */
export function deriveShortfallBudget(route: RouteResult | null) {
  const headroom = route?.safeToSpend ?? route?.tightPoint.amount ?? 0;
  const gap = Math.max(0, Math.round(-headroom * 100) / 100);
  const daysLeft = route ? route.daysToPayday : 0;
  return {
    gap,
    daysLeft,
    dailyCap: Math.max(0, Math.floor(headroom / Math.max(1, daysLeft))),
  };
}
