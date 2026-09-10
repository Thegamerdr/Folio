import type { FinancialPlanResult } from '@folio/finance-engine';
import { formatMoney } from '../lib/financialPresentation';

/** Reviewing imported history records an entry; it does not post another live cash movement. */
export function reviewHistoryPresentation(
  plan: Pick<FinancialPlanResult, 'currentBalanceMinor'>,
  amount: number,
  flow: 'in' | 'out',
  isBusiness = false,
) {
  const cash = formatMoney(plan.currentBalanceMinor / 100);
  const kind = flow === 'out' ? (isBusiness ? 'expense' : 'spend') : 'income';
  return {
    cash,
    entry: `${formatMoney(amount)} ${kind}`,
    detail: `Adds ${formatMoney(amount)} to ${isBusiness ? 'Business activity' : 'your history'}. Tracked cash stays ${cash}.`,
  };
}
