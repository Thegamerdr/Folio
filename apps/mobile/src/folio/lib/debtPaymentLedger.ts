import type { Account, AppState, Debt, Transaction } from '../store';
import type { FinancialAction } from '@folio/domain';

export type DebtPaymentAction = Extract<FinancialAction, { kind: 'debt-payment' }>;
export type DebtPaymentTransaction = Transaction & { financialAction: DebtPaymentAction };

export function isDebtPayment(
  transaction: Pick<Transaction, 'financialAction'>,
): transaction is DebtPaymentTransaction {
  return transaction.financialAction?.kind === 'debt-payment';
}
function minor(value: number, label: string): number {
  const result = Math.round(value * 100);
  if (
    !Number.isFinite(value) ||
    !Number.isSafeInteger(result) ||
    Math.abs(result / 100 - value) > 1e-8
  )
    throw new Error(label + ' must be a finite amount with at most two decimal places.');
  return result;
}
function nonnegative(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error('The saved debt payment effects are invalid.');
  return value;
}

/** Reverse the selected posting, apply its replacement and replay affected later principal caps.
 * Current balances may contain other confirmed corrections: only differences in recorded payment
 * effects are applied. The historical ceiling stops later debt increases being consumed by edits
 * to earlier overpayments. Cash moves only for the selected row. The caller commits one mutation. */
export function transitionDebtPayment(
  state: AppState,
  before: DebtPaymentTransaction | undefined,
  requested: DebtPaymentTransaction | undefined,
  at: string,
  restoreStoredEffects = false,
): { patch: Partial<AppState>; transaction?: DebtPaymentTransaction } {
  const accounts: Account[] = (state.accounts ?? []).map((account) => ({ ...account }));
  const debts: Debt[] = (state.debts ?? []).map((debt) => ({ ...debt }));
  const debtDeltas = new Map<string, number>();
  const linkedDeltas = new Map<string, number>();
  const existingPayments = state.transactions.filter(isDebtPayment);
  const order =
    before?.financialAction.postingOrder ??
    requested?.financialAction.postingOrder ??
    Math.max(
      state.debtPaymentSequence ?? 0,
      ...existingPayments.map((row) => row.financialAction.postingOrder ?? 0),
    ) + 1;
  const later = existingPayments
    .filter((row) => row.id !== before?.id && (row.financialAction.postingOrder ?? 0) > order)
    .sort((a, b) => a.financialAction.postingOrder! - b.financialAction.postingOrder!);
  const replacements = new Map<string, DebtPaymentTransaction>();

  function ownedAccount(id: string, liability: boolean, applying: boolean): Account {
    const account = accounts.find((candidate) => candidate.id === id);
    if (
      account === undefined ||
      account.isLiability !== liability ||
      (applying && account.closed === true) ||
      (account.workspaceId !== undefined && account.workspaceId !== state.activeWorkspaceId)
    )
      throw new Error('The debt payment account is unavailable in this workspace.');
    return account;
  }
  function ownedDebt(id: string): Debt {
    const debt = debts.find((candidate) => candidate.id === id);
    if (
      debt === undefined ||
      (debt.workspaceId !== undefined && debt.workspaceId !== state.activeWorkspaceId)
    )
      throw new Error(
        'The linked debt is unavailable. Restore the debt before correcting this payment.',
      );
    return debt;
  }
  function changeAccount(account: Account, delta: number) {
    const next = minor(account.balanceMinor, 'Account balance') + delta;
    if (!Number.isSafeInteger(next))
      throw new Error('The account balance is outside the supported range.');
    account.balanceMinor = next / 100;
    account.balanceAsOfISO = at;
  }
  function changeDebt(id: string, delta: number) {
    const debt = ownedDebt(id);
    const value = minor(debt.balance, 'Debt balance') + delta;
    if (!Number.isSafeInteger(value))
      throw new Error('The debt balance is outside the supported range.');
    debt.balance = value / 100;
    debtDeltas.set(id, (debtDeltas.get(id) ?? 0) + delta);
  }
  function changeLinked(id: string, delta: number) {
    changeAccount(ownedAccount(id, true, false), delta);
    linkedDeltas.set(id, (linkedDeltas.get(id) ?? 0) + delta);
  }
  function paid(row: DebtPaymentTransaction): number {
    const amount = -minor(row.amount, 'Payment amount');
    if (amount <= 0) throw new Error('A debt payment must be a positive outgoing payment.');
    return amount;
  }

  if (before !== undefined) {
    const action = before.financialAction;
    const amount = paid(before);
    if (nonnegative(action.principalAppliedMinor) > amount)
      throw new Error('The saved debt payment effects are invalid.');
    changeAccount(ownedAccount(before.accountId ?? 'acct-main', false, false), amount);
    changeDebt(action.debtId, action.principalAppliedMinor);
    if (action.linkedAccountId !== undefined)
      changeLinked(action.linkedAccountId, nonnegative(action.linkedAccountAppliedMinor ?? 0));
  }

  let transaction: DebtPaymentTransaction | undefined;
  if (requested !== undefined) {
    if (requested.workspaceId !== undefined && requested.workspaceId !== state.activeWorkspaceId)
      throw new Error('The payment belongs to a different workspace.');
    const amount = paid(requested);
    const debt = ownedDebt(requested.financialAction.debtId);
    const sameDebt = before?.financialAction.debtId === debt.id;
    const available = nonnegative(
      (sameDebt
        ? before!.financialAction.principalAvailableMinor
        : restoreStoredEffects
          ? requested.financialAction.principalAvailableMinor
          : undefined) ??
        minor(debt.balance, 'Debt balance') +
          later
            .filter((row) => row.financialAction.debtId === debt.id)
            .reduce((sum, row) => sum + row.financialAction.principalAppliedMinor, 0),
    );
    const principal = restoreStoredEffects
      ? nonnegative(requested.financialAction.principalAppliedMinor)
      : Math.min(amount, available);
    if (principal > amount || principal > available)
      throw new Error('The saved debt payment effects are invalid.');
    changeAccount(ownedAccount(requested.accountId ?? 'acct-main', false, true), -amount);
    changeDebt(debt.id, -principal);
    const linkedId = restoreStoredEffects
      ? requested.financialAction.linkedAccountId
      : debt.linkedAccountId;
    let linkedAvailable: number | undefined;
    let linkedReduction: number | undefined;
    if (linkedId !== undefined) {
      const linked = ownedAccount(linkedId, true, true);
      linkedAvailable = nonnegative(
        (sameDebt && before?.financialAction.linkedAccountId === linkedId
          ? before.financialAction.linkedAccountAvailableMinor
          : restoreStoredEffects
            ? requested.financialAction.linkedAccountAvailableMinor
            : undefined) ??
          minor(linked.balanceMinor, 'Linked account balance') +
            later
              .filter((row) => row.financialAction.linkedAccountId === linkedId)
              .reduce((sum, row) => sum + (row.financialAction.linkedAccountAppliedMinor ?? 0), 0),
      );
      linkedReduction = restoreStoredEffects
        ? nonnegative(requested.financialAction.linkedAccountAppliedMinor ?? 0)
        : Math.min(amount, linkedAvailable);
      if (linkedReduction > amount || linkedReduction > linkedAvailable)
        throw new Error('The saved linked account effect is invalid.');
      changeLinked(linkedId, -linkedReduction);
    }
    transaction = {
      ...requested,
      financialAction: {
        kind: 'debt-payment',
        debtId: debt.id,
        principalAppliedMinor: principal,
        principalAvailableMinor: available,
        postingOrder: order,
        ...(linkedId === undefined
          ? {}
          : {
              linkedAccountId: linkedId,
              linkedAccountAppliedMinor: linkedReduction!,
              linkedAccountAvailableMinor: linkedAvailable!,
            }),
      },
    };
  }

  for (const row of later) {
    const action = row.financialAction;
    const debtDelta = debtDeltas.get(action.debtId) ?? 0;
    const linkedDelta =
      action.linkedAccountId === undefined ? 0 : (linkedDeltas.get(action.linkedAccountId) ?? 0);
    if (debtDelta === 0 && linkedDelta === 0) continue;
    if (
      action.principalAvailableMinor === undefined ||
      (linkedDelta !== 0 && action.linkedAccountAvailableMinor === undefined)
    )
      throw new Error(
        'A later payment lacks its original balance. Reconcile that payment before changing this one.',
      );
    const available = nonnegative(action.principalAvailableMinor + debtDelta);
    const principal = Math.min(paid(row), available);
    changeDebt(action.debtId, action.principalAppliedMinor - principal);
    let linkedAvailable = action.linkedAccountAvailableMinor;
    let linkedReduction = action.linkedAccountAppliedMinor;
    if (action.linkedAccountId !== undefined && linkedDelta !== 0) {
      linkedAvailable = nonnegative(action.linkedAccountAvailableMinor! + linkedDelta);
      linkedReduction = Math.min(paid(row), linkedAvailable);
      changeLinked(
        action.linkedAccountId,
        (action.linkedAccountAppliedMinor ?? 0) - linkedReduction,
      );
    }
    replacements.set(row.id, {
      ...row,
      financialAction: {
        ...action,
        principalAvailableMinor: available,
        principalAppliedMinor: principal,
        ...(linkedAvailable === undefined ? {} : { linkedAccountAvailableMinor: linkedAvailable }),
        ...(linkedReduction === undefined ? {} : { linkedAccountAppliedMinor: linkedReduction }),
      },
    });
  }
  if (
    debts.some((debt) => debt.balance < 0) ||
    accounts.some((account) => account.isLiability && account.balanceMinor < 0)
  )
    throw new Error(
      'The balances changed after this payment. Reconcile the outstanding debt before correcting it.',
    );
  const cash = accounts
    .filter((account) => !account.isLiability && account.closed !== true)
    .reduce((sum, account) => sum + minor(account.balanceMinor, 'Account balance'), 0);
  if (!Number.isSafeInteger(cash)) throw new Error('Combined cash is outside the supported range.');
  let transactions = state.transactions
    .filter((row) => row.id !== before?.id)
    .map((row) => replacements.get(row.id) ?? row);
  if (transaction !== undefined) {
    if (before === undefined) transactions = [transaction, ...transactions];
    else
      transactions = state.transactions.map((row) =>
        row.id === before.id ? transaction! : (replacements.get(row.id) ?? row),
      );
  }
  return {
    patch: {
      accounts,
      debts,
      transactions,
      debtPaymentSequence: Math.max(state.debtPaymentSequence ?? 0, order),
      currentBalance: {
        ...state.currentBalance,
        amount: cash / 100,
        source: 'corrected',
        confidence: 'corrected',
        setAt: at,
      },
    },
    ...(transaction === undefined ? {} : { transaction }),
  };
}
