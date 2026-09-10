import { describe, expect, it } from 'vitest';
import { paymentAmountShortcuts, initialAffordAmount } from './financialActionInputs';
describe('financial amount drafts', () => {
  it('retains exact pennies for minimum and full-balance shortcuts', () => {
    expect(paymentAmountShortcuts({ balance: 320.47, minPayment: 40.25 })).toEqual({
      minimum: '40.25',
      full: '320.47',
    });
  });
  it('caps the minimum shortcut at the remaining balance without changing manual overpayment', () => {
    expect(paymentAmountShortcuts({ balance: 20.17, minPayment: 40 })).toEqual({
      minimum: '20.17',
      full: '20.17',
    });
  });
  it.each([
    undefined,
    { balance: 0, minPayment: 40 },
    { balance: -1, minPayment: 40 },
    { balance: NaN, minPayment: 40 },
    { balance: 10.999, minPayment: 1 },
  ])('disables shortcuts for missing, cleared or invalid balances', (debt) => {
    expect(paymentAmountShortcuts(debt)).toEqual({ minimum: null, full: null });
  });
  it('keeps the full balance available when the minimum is unknown or invalid', () => {
    expect(paymentAmountShortcuts({ balance: 100.99, minPayment: 0 })).toEqual({
      minimum: null,
      full: '100.99',
    });
  });
  it('passes a preview to the editable draft and rejects invalid initial values', () => {
    expect(initialAffordAmount(65)).toBe('65');
    expect(initialAffordAmount(0)).toBe('0');
    expect(initialAffordAmount(65.75)).toBe('65.75');
    expect(initialAffordAmount(undefined)).toBe('');
    expect(initialAffordAmount(NaN)).toBe('');
    expect(initialAffordAmount(-1)).toBe('');
  });
});
