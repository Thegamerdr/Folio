import type { FinancialPlanResult } from '@folio/finance-engine';
import { formatMoney } from '../lib/financialPresentation';

/** Reviewing imported history records an entry; it does not post another live cash movement. */
export function reviewHistoryPresentation(
  plan: Pick<FinancialPlanResult, 'currentBalanceMinor'>,
  amount: number,
  flow: 'in' | 'out',
  isBusiness = false,
  hasDuplicateProposal = false,
) {
  const cash = formatMoney(plan.currentBalanceMinor / 100);
  const kind = flow === 'out' ? (isBusiness ? 'expense' : 'spend') : 'income';
  const history = isBusiness ? 'Business activity' : 'your history';
  return {
    cash,
    entry: `${formatMoney(amount)} ${kind}`,
    detail: hasDuplicateProposal
      ? `Link them keeps your original entry. Keep both adds another ${formatMoney(amount)} to ${history}. Tracked cash stays ${cash}.`
      : `Adds ${formatMoney(amount)} to ${history}. Tracked cash stays ${cash}.`,
  };
}
