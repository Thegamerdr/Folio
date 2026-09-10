import type { Debt } from '../store';
const moneyValue = (value: number) =>
  Number.isFinite(value) && value > 0 && Math.abs(Math.round(value * 100) / 100 - value) < 1e-8;
/** Shortcuts only fill a draft. They never post a payment or discard pennies. */
export function paymentAmountShortcuts(debt: Pick<Debt, 'balance' | 'minPayment'> | undefined) {
  if (!debt || !moneyValue(debt.balance)) return { minimum: null, full: null };
  return {
    minimum: moneyValue(debt.minPayment)
      ? Math.min(debt.balance, debt.minPayment).toFixed(2)
      : null,
    full: debt.balance.toFixed(2),
  };
}
/** Opening an affordability sheet supplies an unchecked draft, never a verdict. */
export function initialAffordAmount(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value >= 0
    ? (Math.round(value * 100) / 100).toString()
    : '';
}
