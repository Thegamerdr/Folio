import type { ScreenId } from '@/folio/types';

export type BusinessPrimaryTab = 'today' | 'money' | 'review' | 'more';

const MONEY_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'business-money',
  'business-runway',
  'business-clients',
  'business-invoices',
  'business-vat',
  'business-insights',
  'business-deductions',
  'calendar',
  'plans',
]);

const REVIEW_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'review',
  'business-review-item',
  'timeline',
  'intake-history',
]);

/** Current Business workspace IA: Today / Money / Review / More. */
export function businessTabForScreen(screen: ScreenId): BusinessPrimaryTab {
  if (screen === 'today') return 'today';
  if (MONEY_SCREENS.has(screen)) return 'money';
  if (REVIEW_SCREENS.has(screen)) return 'review';
  return 'more';
}

export function screenForBusinessTab(tab: BusinessPrimaryTab): ScreenId {
  if (tab === 'money') return 'business-money';
  if (tab === 'review') return 'review';
  if (tab === 'more') return 'more';
  return 'today';
}
