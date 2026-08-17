import { describe, expect, it } from 'vitest';

import {
  assertLaunchCurrency,
  detectUnsupportedDocumentCurrency,
  detectUnsupportedRowCurrency,
  displayCurrency,
  isLaunchCurrency,
  normalizedCurrencyCode,
} from './launchCurrency';

describe('GBP-only launch currency boundary', () => {
  it('keeps absent legacy currency as GBP and canonicalises explicit GBP', () => {
    expect(isLaunchCurrency(undefined)).toBe(true);
    expect(normalizedCurrencyCode(' gbp ')).toBe('GBP');
    expect(assertLaunchCurrency('sterling')).toBe('GBP');
    expect(displayCurrency('')).toBe('unknown currency');
  });

  it('rejects an explicit foreign or malformed account currency', () => {
    expect(isLaunchCurrency('EUR')).toBe(false);
    expect(isLaunchCurrency('')).toBe(false);
    expect(() => assertLaunchCurrency('usd')).toThrow(/GBP only/u);
  });

  it('detects foreign structured rows without rejecting bare or GBP amounts', () => {
    expect(detectUnsupportedRowCurrency({ amountCells: ['-42.00'] })).toBeNull();
    expect(detectUnsupportedRowCurrency({ amountCells: ['GBP -42.00'] })).toBeNull();
    expect(detectUnsupportedRowCurrency({ amountCells: ['£42.00'] })).toBeNull();
    expect(
      detectUnsupportedRowCurrency({ currencyCell: 'EUR', amountCells: ['42.00'] }),
    ).toMatchObject({ label: 'EUR', source: 'currency-column' });
    expect(detectUnsupportedRowCurrency({ amountCells: ['$42.00'] })).toMatchObject({
      label: '$ currency',
      source: 'amount-cell',
    });
  });

  it('uses explicit document currency and conservative repeated-symbol detection', () => {
    expect(
      detectUnsupportedDocumentCurrency('Statement currency: EUR\n01/01/2026 Shop 10.00'),
    ).toMatchObject({ label: 'EUR' });
    expect(
      detectUnsupportedDocumentCurrency('Account currency GBP\nMerchant charged €10.00'),
    ).toBeNull();
    expect(detectUnsupportedDocumentCurrency('Shop €10.00')).toBeNull();
    expect(detectUnsupportedDocumentCurrency('Shop €10.00\nCafe €4.00')).toMatchObject({
      label: 'EUR',
    });
    expect(
      detectUnsupportedDocumentCurrency('TOTAL €10.00', { singleMoneySymbolIsEnough: true }),
    ).toMatchObject({ label: 'EUR' });
  });
});
