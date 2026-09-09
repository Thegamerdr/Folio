import type { RouteResult } from './moneyPath';

/** Recovery uses current cash after obligations, living costs and the protected buffer.
 * `spare` is forecast closing cash ON payday, including that future receipt, so it cannot fund
 * discretionary spending before payday. Round a displayed gap up and a daily allowance down.
 */
export function deriveShortfallBudget(route: RouteResult | null) {
  const headroom = route?.safeToSpend ?? route?.tightPoint.amount ?? 0;
  const gap = Math.max(0, Math.ceil(-headroom));
  const daysLeft = route ? route.daysToPayday : 0;
  return {
    gap,
    daysLeft,
    dailyCap: Math.max(0, Math.floor(headroom / Math.max(1, daysLeft))),
  };
}
