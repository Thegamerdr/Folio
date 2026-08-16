import { describe, expect, it } from 'vitest';

import { businessTabForScreen, screenForBusinessTab } from './businessNavigation';

describe('business navigation', () => {
  it.each([
    ['today', 'today'],
    ['business-money', 'money'],
    ['business-runway', 'money'],
    ['business-invoices', 'money'],
    ['business-vat', 'money'],
    ['business-obligations', 'money'],
    ['review', 'review'],
    ['business-filings', 'more'],
    ['business-filing-vat', 'more'],
    ['business-filing-sa', 'more'],
    ['business-filing-ct', 'more'],
    ['business-filing-cs', 'more'],
    ['business-filing-accounts', 'more'],
    ['business-filing-payroll', 'more'],
    ['business-clients', 'more'],
    ['business-insights', 'money'],
    ['melo', 'more'],
  ] as const)('maps %s to the %s tab', (screen, tab) => {
    expect(businessTabForScreen(screen)).toBe(tab);
  });

  it.each([
    ['today', 'today'],
    ['money', 'business-money'],
    ['review', 'review'],
    ['more', 'more'],
  ] as const)('maps the %s tab to %s', (tab, screen) => {
    expect(screenForBusinessTab(tab)).toBe(screen);
  });
});
