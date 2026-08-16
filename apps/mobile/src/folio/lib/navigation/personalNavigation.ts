import type { ScreenId } from '@/folio/types';

export type PersonalPrimaryTab = 'today' | 'plan' | 'review' | 'more';

const TODAY_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'today',
  'today-mode',
  'today-stability',
  'today-after',
]);

/** Current Personal workspace IA: Today / Plan / Review / More. */
export function personalTabForScreen(screen: ScreenId): PersonalPrimaryTab {
  if (TODAY_SCREENS.has(screen)) return 'today';
  if (screen === 'plans') return 'plan';
  if (screen === 'review') return 'review';
  return 'more';
}

export function screenForPersonalTab(tab: PersonalPrimaryTab): ScreenId {
  if (tab === 'plan') return 'plans';
  if (tab === 'review') return 'review';
  if (tab === 'more') return 'more';
  return 'today';
}
