import type { ScreenId } from '@/folio/types';

export type PersonalPrimaryTab = 'today' | 'plan' | 'review' | 'more';

const TODAY_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'today',
  'today-mode',
  'today-stability',
  'today-after',
  'insights',
]);

const PLAN_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'plans',
  'calendar',
  'whatif',
  'recovery',
  'shortfall',
  'subs',
  'pots',
  'ritual',
  'add-bill',
  'add-debt',
]);

const REVIEW_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'review',
  'timeline',
  'decision-history',
  'visualizer',
  'intake-history',
]);

/**
 * Full-focus Personal routes temporarily hide the tab bar and return to their explicit origin.
 * They must not become the remembered destination of More (the old default mapping made a later
 * More press reopen onboarding/import success instead of the settings hub).
 */
export const PERSONAL_TRANSIENT_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'start',
  'first-answer',
  'guided',
  'intake',
  'pdf-success',
  'pdf-fallback',
  'image-success',
  'image-fallback',
  'paste-success',
  'add-bill',
  'add-debt',
]);

/** Current Personal workspace IA: Today / Plan / Review / More. */
export function personalTabForScreen(screen: ScreenId): PersonalPrimaryTab {
  if (TODAY_SCREENS.has(screen)) return 'today';
  if (PLAN_SCREENS.has(screen)) return 'plan';
  if (REVIEW_SCREENS.has(screen)) return 'review';
  return 'more';
}

export function isPersonalTransientScreen(screen: ScreenId): boolean {
  return PERSONAL_TRANSIENT_SCREENS.has(screen);
}

export function screenForPersonalTab(tab: PersonalPrimaryTab): ScreenId {
  if (tab === 'plan') return 'plans';
  if (tab === 'review') return 'review';
  if (tab === 'more') return 'more';
  return 'today';
}
