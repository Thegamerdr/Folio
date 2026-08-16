import type { Nav, ScreenId } from '@/folio/types';
import {
  BusinessFilingWorkingCopyScreen,
  BusinessFilingsScreen,
} from './business/BusinessFilingScreens';
import {
  BusinessCompaniesHouseScreen,
  BusinessCorpTaxScreen,
  BusinessDividendsScreen,
  BusinessDlaScreen,
  BusinessPayrollScreen,
} from './business/BusinessLtdScreens';
import {
  BusinessClientsScreen,
  BusinessDeductionsScreen,
  BusinessInsightsScreen,
  BusinessInvoicesScreen,
  BusinessMoneyHubScreen,
  BusinessObligationsScreen,
  BusinessRunwayScreen,
  BusinessVatScreen,
} from './business/BusinessMoneyScreens';

export function BusinessOperationsScreen({ nav, screen }: { nav: Nav; screen: ScreenId }) {
  if (screen === 'business-money') return <BusinessMoneyHubScreen nav={nav} />;
  if (screen === 'business-runway') return <BusinessRunwayScreen nav={nav} />;
  if (screen === 'business-clients') return <BusinessClientsScreen nav={nav} />;
  if (screen === 'business-invoices') return <BusinessInvoicesScreen nav={nav} />;
  if (screen === 'business-obligations') return <BusinessObligationsScreen nav={nav} />;
  if (screen === 'business-vat') return <BusinessVatScreen nav={nav} />;
  if (screen === 'business-corp-tax') return <BusinessCorpTaxScreen nav={nav} />;
  if (screen === 'business-payroll') return <BusinessPayrollScreen nav={nav} />;
  if (screen === 'business-dividends') return <BusinessDividendsScreen nav={nav} />;
  if (screen === 'business-dla') return <BusinessDlaScreen nav={nav} />;
  if (screen === 'business-companies-house') {
    return <BusinessCompaniesHouseScreen nav={nav} />;
  }
  if (screen === 'business-filings') return <BusinessFilingsScreen nav={nav} />;
  if (
    screen === 'business-filing-vat' ||
    screen === 'business-filing-sa' ||
    screen === 'business-filing-ct' ||
    screen === 'business-filing-cs' ||
    screen === 'business-filing-accounts' ||
    screen === 'business-filing-payroll'
  ) {
    return <BusinessFilingWorkingCopyScreen nav={nav} route={screen} />;
  }
  if (screen === 'business-insights') return <BusinessInsightsScreen nav={nav} />;
  return <BusinessDeductionsScreen nav={nav} />;
}
