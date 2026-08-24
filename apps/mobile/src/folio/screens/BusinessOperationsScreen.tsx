import { Text } from 'react-native';
import type { Nav, ScreenId } from '@/folio/types';
import { useTheme } from '@/folio/theme';
import { BusinessCard, BusinessPrimaryAction, BusinessScreenFrame } from './business/BusinessUi';
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
  BusinessObligationsScreen,
  BusinessRunwayScreen,
  BusinessVatScreen,
} from './business/BusinessMoneyScreens';
import { businessSurface } from './business/businessSurfaceRegistry';

export function BusinessOperationsScreen({ nav, screen }: { nav: Nav; screen: ScreenId }) {
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
  if (screen === 'business-deductions') return <BusinessDeductionsScreen nav={nav} />;
  // Keep an explicit recoverable state for a stale/deep-linked route. A silent Deductions
  // fallback makes route coverage look complete while sending the user to the wrong authority.
  return <BusinessSurfaceNotFoundScreen nav={nav} screen={screen} />;
}

function BusinessSurfaceNotFoundScreen({ nav, screen }: { nav: Nav; screen: ScreenId }) {
  const t = useTheme();
  const surface = businessSurface(screen);
  return (
    <BusinessScreenFrame
      eyebrow="Business"
      headline="That business view is unavailable."
      intro="This link is stale, so Melo has kept your saved business data untouched."
      onBack={nav.back}
    >
      <BusinessCard tone="inset">
        <Text style={{ color: t.muted }}>
          {surface
            ? `${surface.label} could not be opened right now.`
            : 'The requested view could not be found.'}
        </Text>
      </BusinessCard>
      <BusinessPrimaryAction label="Back to Business today" onPress={() => nav.go('today')} />
    </BusinessScreenFrame>
  );
}
