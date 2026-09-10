import type { AppState } from '../store';
import { transitionDebtPayment, type DebtPaymentTransaction } from './debtPaymentLedger';
import { buildFinancialPlanFromState } from './financialPlan';
import { formatMoney } from './financialPresentation';

/** Uses exactly the same transition as posting, correction and removal; this never writes state. */
export function previewDebtPaymentChange(
  state: AppState,
  before: DebtPaymentTransaction | undefined,
  requested: DebtPaymentTransaction | undefined,
  at: string,
) {
  // The posting command does not replay balances for description/date/note-only corrections.
  // Preserve that behavior even when a historical account is closed or its debt is no longer tracked.
  const metadataOnly =
    before !== undefined &&
    requested !== undefined &&
    before.amount === requested.amount &&
    before.financialAction.debtId === requested.financialAction.debtId &&
    before.accountId === requested.accountId;
  const transition = metadataOnly
    ? { patch: {}, transaction: requested }
    : transitionDebtPayment(state, before, requested, at);
  const after = { ...state, ...transition.patch };
  const beforePlan = buildFinancialPlanFromState(state, { now: new Date(at) });
  const afterPlan = buildFinancialPlanFromState(after, { now: new Date(at) });
  const debtId = requested?.financialAction.debtId ?? before?.financialAction.debtId;
  const debtBefore = state.debts?.find((debt) => debt.id === debtId);
  const debtAfter = after.debts?.find((debt) => debt.id === debtId);
  const rows = [
    {
      label: 'Tracked cash',
      before: beforePlan.currentBalanceMinor / 100,
      after: afterPlan.currentBalanceMinor / 100,
    },
    ...(debtBefore
      ? [{ label: debtBefore.name, before: debtBefore.balance, after: debtAfter?.balance ?? 0 }]
      : []),
    {
      label: 'After recorded costs',
      before: beforePlan.safeToSpendMinor / 100,
      after: afterPlan.safeToSpendMinor / 100,
    },
  ];
  return {
    rows,
    afterPlan,
    transaction: transition.transaction,
    text: rows
      .map(
        (row) => `${row.label}: ${formatMoney(row.before, true)} → ${formatMoney(row.after, true)}`,
      )
      .join('\n'),
  };
}
