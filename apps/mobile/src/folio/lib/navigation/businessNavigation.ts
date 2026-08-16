import type { ScreenId } from '@/folio/types';

export type BusinessPrimaryTab = 'today' | 'money' | 'filings' | 'more';

const MONEY_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'business-money',
  'business-runway',
  'business-invoices',
  'business-vat',
  'business-obligations',
  'business-insights',
]);

const FILING_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'business-filings',
  'business-filing-vat',
  'business-filing-sa',
  'business-filing-ct',
  'business-filing-cs',
  'business-filing-accounts',
  'business-filing-payroll',
]);

/** Current Business workspace IA: Today / Money / Filings / More. */
export function businessTabForScreen(screen: ScreenId): BusinessPrimaryTab {
  if (screen === 'today') return 'today';
  if (MONEY_SCREENS.has(screen)) return 'money';
  if (FILING_SCREENS.has(screen)) return 'filings';
  return 'more';
}

export function screenForBusinessTab(tab: BusinessPrimaryTab): ScreenId {
  if (tab === 'money') return 'business-money';
  if (tab === 'filings') return 'business-filings';
  if (tab === 'more') return 'more';
  return 'today';
}
