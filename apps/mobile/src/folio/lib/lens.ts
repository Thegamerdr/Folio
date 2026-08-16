/**
 * The ten Melo lenses and their frozen Free / Plus / Pro access bands.
 *
 * Source of truth: the frozen web `src/lib/lens/index.ts` plus the post-freeze
 * `src/lib/lens/paywall.ts` contract. Pro is a superset of Plus. A single
 * one-cycle trial opens every paid lens and is cleared only by the explicit
 * payday-cycle close; elapsed wall-clock time never ends it.
 */
import { acknowledgeTrialEnd, startLensTrial, useAppStore, type IncomeSource } from '../store';
import { nextIncomeDate } from './income';
import type { MoneyMode } from './modes/types';
import { MODE_LABEL } from './modes/types';
import { resolvePayday } from './payday';

export type LensTier = 'free' | 'plus' | 'pro';

export const FREE_LENSES: readonly MoneyMode[] = ['survival', 'stability'] as const;
export const PLUS_LENSES: readonly MoneyMode[] = [
  'growth',
  'reset',
  'optimizer',
  'planning',
] as const;
export const PRO_LENSES: readonly MoneyMode[] = [
  'lowVis',
  'irregular',
  'debt',
  'household',
] as const;

export const LENS_LABEL = MODE_LABEL;

export function isFreeLens(mode: MoneyMode): boolean {
  return FREE_LENSES.includes(mode);
}

export function isPlusLens(mode: MoneyMode): boolean {
  return PLUS_LENSES.includes(mode);
}

export function isProLens(mode: MoneyMode): boolean {
  return PRO_LENSES.includes(mode);
}

export function tierOf(mode: MoneyMode): LensTier {
  if (isFreeLens(mode)) return 'free';
  if (isProLens(mode)) return 'pro';
  return 'plus';
}

export type LensAccess = {
  plusUnlocked: boolean;
  proUnlocked: boolean;
  trialActive: boolean;
};

/** Pure access rule used by UI and entitlement tests. */
export function canAccessLens(mode: MoneyMode, access: LensAccess): boolean {
  const tier = tierOf(mode);
  if (tier === 'free' || access.trialActive || access.proUnlocked) return true;
  return tier === 'plus' && access.plusUnlocked;
}

function yearMonthOf(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nextPaydayDate(from: Date, dayOfMonth: number): Date {
  const thisMonthIso = resolvePayday({ dayOfMonth }, yearMonthOf(from));
  const thisMonth = new Date(`${thisMonthIso}T00:00:00`);
  if (thisMonth.getTime() >= from.getTime()) return thisMonth;
  const nextMonth = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  return new Date(`${resolvePayday({ dayOfMonth }, yearMonthOf(nextMonth))}T00:00:00`);
}

/**
 * Estimated close date for countdown copy only. This does not end the trial.
 * The actual relock is the explicit `endLensTrial()` call at payday ritual close.
 */
export function trialEndIsoFor(
  trialStartIso: string,
  sources: readonly IncomeSource[],
  paydayDom: number,
): string {
  const start = new Date(`${trialStartIso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return trialStartIso;
  const afterStart = new Date(start.getTime() + 86_400_000);
  const seekIso = isoDate(afterStart);
  try {
    const cadenced = nextIncomeDate(sources, seekIso);
    if (cadenced !== null) return cadenced;
  } catch {
    // Corrupt optional cadence data falls back to the legacy payday rule.
  }
  return isoDate(nextPaydayDate(afterStart, paydayDom || 25));
}

const EMPTY_INCOME_SOURCES: IncomeSource[] = [];

export function useLens() {
  const active = useAppStore((state) => state.moneyMode ?? 'survival');
  const plusUnlocked = useAppStore((state) => state.lens?.plusUnlocked ?? false);
  const proUnlocked = useAppStore((state) => state.lens?.proUnlocked ?? false);
  const trialCycleId = useAppStore((state) => state.lens?.trialCycleId ?? null);
  const trialEndedCycleId = useAppStore((state) => state.lens?.trialEndedCycleId ?? null);
  const trialEndAcknowledged = useAppStore((state) => state.lens?.trialEndAcknowledged ?? true);
  const paydayDom = useAppStore((state) => state.onboarding.payday);
  const incomeSources = useAppStore((state) => state.incomeSources ?? EMPTY_INCOME_SOURCES);

  const paidTier: LensTier = proUnlocked ? 'pro' : plusUnlocked ? 'plus' : 'free';
  const trialActive = trialCycleId !== null;
  const canAccess = (mode: MoneyMode) =>
    canAccessLens(mode, { plusUnlocked, proUnlocked, trialActive });

  const startTrial = () => {
    if (trialCycleId !== null || trialEndedCycleId !== null) return;
    startLensTrial(isoDate(new Date()));
  };

  const trialDaysLeft: number | null = (() => {
    if (trialCycleId === null) return null;
    const closeIso = trialEndIsoFor(trialCycleId, incomeSources, paydayDom || 25);
    const close = new Date(`${closeIso}T00:00:00`);
    if (Number.isNaN(close.getTime())) return 0;
    return Math.max(0, Math.ceil((close.getTime() - Date.now()) / 86_400_000));
  })();

  const trialEndPending =
    Boolean(trialEndedCycleId) && !trialEndAcknowledged && !plusUnlocked && !proUnlocked;
  const canOfferTrial =
    !plusUnlocked && !proUnlocked && trialCycleId === null && trialEndedCycleId === null;

  return {
    active,
    isPlus: isPlusLens(active),
    isPro: isProLens(active),
    tier: tierOf(active),
    paidTier,
    plusUnlocked,
    proUnlocked,
    paidUnlocked: plusUnlocked || proUnlocked,
    trialCycleId,
    trialEndedCycleId,
    trialDaysLeft,
    trialEndPending,
    canOfferTrial,
    acknowledgeTrialEnd,
    canAccess,
    tierFor: tierOf,
    startTrial,
  };
}
