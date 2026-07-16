import type { AppState, Sub } from '../store';
import { routeFromStore } from './storeRoute';

export const RECOVERY_BILL_NUDGE_DAYS = 5;
export const RECOVERY_HOLD_DAYS = 3;
export const RECOVERY_HOLD_FLOOR = 60;

const HOLD_LOOKBACK_DAYS = 30;
const DAY_MS = 86_400_000;
const DISCRETIONARY: ReadonlySet<string> = new Set([
  'food',
  'fun',
  'shopping',
  'transport',
  'other',
]);

export type RecoveryRoutePreview = Readonly<{
  baseTight: number;
  hasMoneyPicture: boolean;
  hasShortfall: boolean;
  shortfall: number;
  flexibleBill: Sub | null;
  pausableSubscription: Sub | null;
  billLift: number;
  subscriptionLift: number;
  holdLift: number;
}>;

function nearestActiveSubscription(
  subs: readonly Sub[],
  subPaused: Readonly<Record<string, boolean>>,
): Sub | null {
  const active = subs.filter((subscription) => !subPaused[subscription.name]);
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
  const candidate = routeFromStore(candidateState, now).tightPoint.amount;
  return Math.max(0, Math.round(candidate - base));
}

/** Pure preview shared by RecoveryScreen and Melo. It never mutates the supplied state. */
export function buildRecoveryRoutePreview(state: AppState, now: Date): RecoveryRoutePreview {
  const baseTight = routeFromStore(state, now).tightPoint.amount;
  const hasMoneyPicture =
    state.onboarding.done ||
    state.transactions.length > 0 ||
    state.currentBalance.amount !== 0 ||
    state.onboarding.monthlyIncome > 0 ||
    (state.incomeSources?.length ?? 0) > 0;
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
  const holdLift = Math.max(
    0,
    Math.round(averageDailyDiscretionary(state, now.getTime()) * RECOVERY_HOLD_DAYS),
  );
  return {
    baseTight,
    hasMoneyPicture,
    hasShortfall,
    shortfall: hasShortfall ? Math.round(-baseTight) : 0,
    flexibleBill,
    pausableSubscription,
    billLift,
    subscriptionLift,
    holdLift,
  };
}
