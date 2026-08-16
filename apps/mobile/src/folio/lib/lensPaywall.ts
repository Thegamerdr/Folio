/**
 * @rn-lib
 * Paywall guard — a single gate every upsell surface calls before rendering
 * a Plus lock, banner, or trial CTA.
 *
 * RN port of folio-melo (design-main) `src/lib/lens/paywall.ts`, verbatim.
 * Named `lensPaywall.ts` rather than nesting under a `lens/` directory
 * alongside `lens.ts` — the port target given for this round is the single
 * file `lib/lens.ts`, so this companion sits next to it as a sibling file
 * instead of colliding a file and a directory of the same name.
 *
 * The vision is that Folio never sells to a user who is having a bad money
 * moment. So we suppress upsells in:
 *   - storm / rainy weather   (the app is in bad news mode)
 *   - active Recovery         (they're mid-triage)
 *   - unsafe Safe Zone (< £0) (they can't afford the ask honestly)
 *   - fog weather             (we don't know enough yet)
 *   - Quiet Mode              (the user opted out of character + noise)
 *
 * Any surface that would show "unlock with Plus", a trial CTA, or a
 * teaser tile must gate on `canShowUpsell`. This is a rule, not a nudge.
 */
import type { MeloWeather } from './modes/types';
import { useMemo } from 'react';

import { deriveModeState, type MoneyMode } from './modes';
import { safeZoneMath } from './modes/safeZone';
import { useRoute } from './storeRoute';
import { useAppStore } from '../store';

export type PaywallInputs = {
  weather: MeloWeather;
  /** True while the user is inside the Recovery flow. */
  recoveryActive: boolean;
  /** Current Safe Zone total (£). Negative = unsafe. */
  safeZoneTotal: number;
  /** User's Quiet Mode preference. */
  quietMode: boolean;
};

export function canShowUpsell(i: PaywallInputs): boolean {
  if (i.quietMode) return false;
  if (i.recoveryActive) return false;
  if (i.safeZoneTotal < 0) return false;
  if (i.weather === 'storm' || i.weather === 'rainy' || i.weather === 'fog') return false;
  return true;
}

/** Short honest reason a caller can log or surface for debugging. */
export function upsellSuppressionReason(i: PaywallInputs): string | null {
  if (i.quietMode) return 'quiet-mode';
  if (i.recoveryActive) return 'recovery-active';
  if (i.safeZoneTotal < 0) return 'safe-zone-negative';
  if (i.weather === 'storm') return 'weather-storm';
  if (i.weather === 'rainy') return 'weather-rainy';
  if (i.weather === 'fog') return 'weather-fog';
  return null;
}

/** Reactive adapter so every paid-lock and trial surface reads the same guard inputs. */
export function useLensUpsellGuard(): {
  canShow: boolean;
  reason: string | null;
  inputs: PaywallInputs;
} {
  const moneyMode = useAppStore((state) => (state.moneyMode ?? 'survival') as MoneyMode);
  const currentBalance = useAppStore((state) => state.currentBalance);
  const onboarding = useAppStore((state) => state.onboarding);
  const pots = useAppStore((state) => state.pots);
  const subs = useAppStore((state) => state.subs);
  const subPaused = useAppStore((state) => state.subPaused);
  const spendHold = useAppStore((state) => state.spendHold ?? null);
  const quietMode = useAppStore((state) => state.melo?.quietMode ?? false);
  const now = useMemo(() => new Date(), []);
  const route = useRoute(now);

  return useMemo(() => {
    const engineInputs = {
      currentBalance,
      onboarding,
      pots,
      subs,
      subPaused,
      tightestSpare: route.tightPoint.amount,
      tightestDate: route.tightPoint.date,
      ritualCompletedRecently: false,
    };
    const inputs: PaywallInputs = {
      weather: deriveModeState(moneyMode, engineInputs).weather,
      recoveryActive: spendHold !== null,
      safeZoneTotal: safeZoneMath(engineInputs).total,
      quietMode,
    };
    return {
      canShow: canShowUpsell(inputs),
      reason: upsellSuppressionReason(inputs),
      inputs,
    };
  }, [currentBalance, moneyMode, onboarding, pots, quietMode, route, spendHold, subPaused, subs]);
}
