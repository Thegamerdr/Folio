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
    ['business-filings', 'filings'],
    ['business-filing-vat', 'filings'],
    ['business-filing-accounts', 'filings'],
    ['business-clients', 'more'],
    ['business-insights', 'money'],
    ['melo', 'more'],
  ] as const)('maps %s to the %s tab', (screen, tab) => {
    expect(businessTabForScreen(screen)).toBe(tab);
  });

  it.each([
    ['today', 'today'],
    ['money', 'business-money'],
    ['filings', 'business-filings'],
    ['more', 'more'],
  ] as const)('maps the %s tab to %s', (tab, screen) => {
    expect(screenForBusinessTab(tab)).toBe(screen);
  });
});
