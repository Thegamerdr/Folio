import type { ScreenId } from '@/folio/types';

export type BusinessPrimaryTab = 'today' | 'money' | 'review' | 'more';

const MONEY_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'business-money',
  'business-runway',
  'business-invoices',
  'business-vat',
  'business-obligations',
  'business-insights',
]);

/** Current Business workspace IA: Today / Money / Review / More. */
export function businessTabForScreen(screen: ScreenId): BusinessPrimaryTab {
  if (screen === 'today') return 'today';
  if (MONEY_SCREENS.has(screen)) return 'money';
  if (screen === 'review') return 'review';
  return 'more';
}

export function screenForBusinessTab(tab: BusinessPrimaryTab): ScreenId {
  if (tab === 'money') return 'business-money';
  if (tab === 'review') return 'review';
  if (tab === 'more') return 'more';
  return 'today';
}
