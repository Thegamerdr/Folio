import { describe, expect, it } from 'vitest';

import { SCREEN_IDS } from '../../types';

import { businessTabForScreen, screenForBusinessTab } from './businessNavigation';

describe('business navigation', () => {
  it.each([
    ['today', 'today'],
    ['business-money', 'money'],
    ['business-runway', 'money'],
    ['business-clients', 'money'],
    ['business-invoices', 'money'],
    ['business-vat', 'money'],
    ['business-deductions', 'money'],
    ['calendar', 'money'],
    ['plans', 'money'],
    ['review', 'review'],
    ['business-review-item', 'review'],
    ['timeline', 'review'],
    ['intake-history', 'review'],
    ['business-obligations', 'more'],
    ['business-filings', 'more'],
    ['business-filing-vat', 'more'],
    ['business-filing-sa', 'more'],
    ['business-filing-ct', 'more'],
    ['business-filing-cs', 'more'],
    ['business-filing-accounts', 'more'],
    ['business-filing-payroll', 'more'],
    ['business-insights', 'money'],
    ['melo', 'more'],
    ['money-sources', 'more'],
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

  it('assigns every current native ScreenId to one primary tab', () => {
    expect(SCREEN_IDS.map((screen) => businessTabForScreen(screen))).toHaveLength(
      SCREEN_IDS.length,
    );
  });
});
