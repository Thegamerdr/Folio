import type { AppState, Sub } from '../store';
import { routeFromStore } from './storeRoute';
import type { RoutePoint } from './moneyPath';

export const RECOVERY_BILL_NUDGE_DAYS = 5;
export const RECOVERY_HOLD_DAYS = 3;

const HOLD_LOOKBACK_DAYS = 30;
const DAY_MS = 86_400_000;
const DISCRETIONARY: ReadonlySet<string> = new Set([
  'fun',
  'shopping',
]);

/** Names that describe protected household obligations, not optional subscriptions. */
const PROTECTED_SUBSCRIPTION_TERMS = [
  'rent',
  'mortgage',
  'housing',
  'utility',
  'utilities',
  'council tax',
  'childcare',
  'child care',
  'energy',
  'electric',
  'gas',
  'water',
  'insurance',
  'essential',
  'priority',
  'bill',
  'transport',
  'travel',
  'phone',
  'mobile',
  'child maintenance',
  'maintenance',
  'tax',
  'loan',
];
const OPTIONAL_SUBSCRIPTION_TERMS = [
  'entertainment',
  'streaming',
  'netflix',
  'spotify',
  'disney',
  'prime video',
  'youtube',
  'audible',
  'music',
  'gaming',
  'game',
  'playstation',
  'xbox',
  'nintendo',
  'cinema',
  'gym',
];

export type RecoveryRoutePreview = Readonly<{
  baseTight: number;
  hasMoneyPicture: boolean;
  hasShortfall: boolean;
  shortfall: number;
  flexibleBill: Sub | null;
  pausableSubscription: Sub | null;
  billLift: number;
  subscriptionLift: number;
  holdDailyCap: number;
  holdLift: number;
  /** The real projected route, to payday and beyond, before any move is selected. */
  basePoints: readonly RoutePoint[];
  /** Real candidate routes for moves that change dated commitments. Holds stay estimated. */
  candidatePoints: Readonly<Record<string, readonly RoutePoint[]>>;
  /** Index of payday in basePoints, so visual previews can stop at the same horizon as Today. */
  paydayIndex: number;
}>;

/** A recovery move may pause a subscription only when its existing name explicitly signals an
 * optional service. Protected terms always win, and an ambiguous name is withheld from automatic
 * recovery suggestions so the user can review it manually in Subscriptions. */
export function isDiscretionarySubscription(subscription: Sub): boolean {
  const name = subscription.name.trim().toLocaleLowerCase();
  if (name.length === 0 || PROTECTED_SUBSCRIPTION_TERMS.some((term) => name.includes(term)))
    return false;
  return OPTIONAL_SUBSCRIPTION_TERMS.some((term) => name.includes(term));
}

function nearestActiveSubscription(
  subs: readonly Sub[],
  subPaused: Readonly<Record<string, boolean>>,
): Sub | null {
  const active = subs.filter(
    (subscription) => !subPaused[subscription.name] && isDiscretionarySubscription(subscription),
  );
  if (active.length === 0) return null;
  return (
    [...active].sort((left, right) => left.nextRenewalDaysAway - right.nextRenewalDaysAway)[0] ??
    null
  );
}

function averageDailyDiscretionary(state: AppState, nowMs: number): number {
  const since = nowMs - HOLD_LOOKBACK_DAYS * DAY_MS;
  let total = 0;
  for (const transaction of state.transactions) {
    if (transaction.amount >= 0 || !DISCRETIONARY.has(transaction.category)) continue;
    const when = new Date(transaction.when).getTime();
    if (!Number.isFinite(when) || when < since || when > nowMs) continue;
    total += -transaction.amount;
  }
  return total / HOLD_LOOKBACK_DAYS;
}

function liftFromRoute(base: number, candidateState: AppState, now: Date): number {
  const candidateRoute = routeFromStore(candidateState, now);
  const candidate = candidateRoute.safeToSpend ?? candidateRoute.tightPoint.amount;
  return Math.max(0, Math.round(candidate - base));
}

/** Pure preview shared by RecoveryScreen and Melo. It never mutates the supplied state. */
export function buildRecoveryRoutePreview(state: AppState, now: Date): RecoveryRoutePreview {
  const baseRoute = routeFromStore(state, now);
  // Recovery's shortfall is spendable headroom after the protected buffer, while the plotted
  // points remain raw closing cash for the path visual. This keeps recovery verdicts aligned with
  // Safe Zone/affordability without changing the geometry contract.
  const baseTight = baseRoute.safeToSpend ?? baseRoute.tightPoint.amount;
  // Match MeloSnapshot's honest gate: shipped sample balance/seed activity is presentation data,
  // not evidence that this user has a real shortfall to recover from. A manually entered,
  // imported, or corrected balance (or any non-seed transaction) is sufficient evidence.
  const hasMoneyPicture =
    state.currentBalance.source !== 'sample' ||
    state.transactions.some((transaction) => transaction.source !== 'seed');
  const hasShortfall = hasMoneyPicture && baseTight < 0;
  const flexibleBill = nearestActiveSubscription(state.subs, state.subPaused);
  const pausableSubscription = nearestActiveSubscription(state.subs, state.subPaused);
  const billLift = flexibleBill
    ? liftFromRoute(
        baseTight,
        {
          ...state,
          subOverrides: {
            ...state.subOverrides,
            [flexibleBill.name]:
              (state.subOverrides[flexibleBill.name] ?? 0) + RECOVERY_BILL_NUDGE_DAYS,
          },
        },
        now,
      )
    : 0;
  const subscriptionLift = pausableSubscription
    ? liftFromRoute(
        baseTight,
        {
          ...state,
          subPaused: { ...state.subPaused, [pausableSubscription.name]: true },
        },
        now,
      )
    : 0;
  const candidatePoints: Record<string, readonly RoutePoint[]> = {};
  if (flexibleBill) {
    candidatePoints['move-bill'] = routeFromStore(
      {
        ...state,
        subOverrides: {
          ...state.subOverrides,
          [flexibleBill.name]:
            (state.subOverrides[flexibleBill.name] ?? 0) + RECOVERY_BILL_NUDGE_DAYS,
        },
      },
      now,
    ).points;
  }
  if (pausableSubscription) {
    candidatePoints['pause-sub'] = routeFromStore(
      {
        ...state,
        subPaused: { ...state.subPaused, [pausableSubscription.name]: true },
      },
      now,
    ).points;
  }
  const averageDaily = averageDailyDiscretionary(state, now.getTime());
  const holdDailyCap = averageDaily > 0 ? Math.max(1, Math.round(averageDaily * 0.5)) : 0;
  const holdLift = Math.max(0, Math.round((averageDaily - holdDailyCap) * RECOVERY_HOLD_DAYS));
  return {
    baseTight,
    hasMoneyPicture,
    hasShortfall,
    shortfall: hasShortfall ? Math.round(-baseTight) : 0,
    flexibleBill,
    pausableSubscription,
    billLift,
    subscriptionLift,
    holdDailyCap,
    holdLift,
    basePoints: baseRoute.points,
    candidatePoints,
    paydayIndex: baseRoute.daysToPayday,
  };
}
