import { bankAnalyticsTransactions, type Account, type Transaction } from '../store';
import { isAccountInLaunchMoneyPicture } from './accountPolicy';
import type { DerivedEvent } from './calendarEvents';

const DAY_MS = 86_400_000;
const HISTORY_WINDOW_DAYS = 90;
const MIN_RUNWAY_HISTORY_DAYS = 14;
const MIN_RUNWAY_EXPENSE_ROWS = 3;

export type BusinessCashPosition = Readonly<{
  cashBalance: number;
  liabilityBalance: number;
  netPosition: number;
  confirmedIncome30Days: number;
  confirmedExpense30Days: number;
  upcomingIncome: number;
  upcomingCommitments: number;
  projectedCash: number;
  nextCommitmentDate: string | null;
  runwayDays: number | null;
  runwayHistoryDays: number;
  runwayExpenseRows: number;
}>;

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/**
 * Build the Business Today position from confirmed local records only.
 *
 * The runway is deliberately unavailable until at least three confirmed expenses span fourteen
 * days. A single receipt must never be annualised into a confident-looking business forecast.
 * Future cash uses only dated calendar events supplied by the caller; it never invents invoices,
 * tax, bills or income.
 */
export function buildBusinessCashPosition(
  input: Readonly<{
    accounts: readonly Account[];
    transactions: readonly Transaction[];
    upcomingEvents: readonly DerivedEvent[];
    now: Date;
  }>,
): BusinessCashPosition {
  const activeAccounts = input.accounts.filter(isAccountInLaunchMoneyPicture);
  const cashTransactions = bankAnalyticsTransactions({
    accounts: input.accounts,
    transactions: input.transactions,
  });
  const cashBalance = activeAccounts
    .filter((account) => !account.isLiability)
    .reduce((total, account) => total + account.balanceMinor, 0);
  const liabilityBalance = activeAccounts
    .filter((account) => account.isLiability)
    .reduce((total, account) => total + Math.max(0, account.balanceMinor), 0);

  const today = startOfUtcDay(input.now);
  const last30Start = new Date(today.getTime() - 29 * DAY_MS);
  const historyStart = new Date(today.getTime() - (HISTORY_WINDOW_DAYS - 1) * DAY_MS);
  let confirmedIncome30Days = 0;
  let confirmedExpense30Days = 0;
  const runwayExpenses: Readonly<{ at: Date; amount: number }>[] = cashTransactions.flatMap(
    (transaction) => {
      const at = parseDate(transaction.when);
      if (at === null || at < historyStart || at > input.now || transaction.amount >= 0) return [];
      return [{ at, amount: Math.abs(transaction.amount) }];
    },
  );

  for (const transaction of cashTransactions) {
    const at = parseDate(transaction.when);
    if (at === null || at < last30Start || at > input.now) continue;
    if (transaction.amount >= 0) confirmedIncome30Days += transaction.amount;
    else confirmedExpense30Days += Math.abs(transaction.amount);
  }

  let upcomingIncome = 0;
  let upcomingCommitments = 0;
  let nextCommitmentDate: string | null = null;
  for (const event of input.upcomingEvents) {
    if (typeof event.amount !== 'number') continue;
    if (event.amount >= 0) upcomingIncome += event.amount;
    else {
      upcomingCommitments += Math.abs(event.amount);
      if (nextCommitmentDate === null || event.date < nextCommitmentDate) {
        nextCommitmentDate = event.date;
      }
    }
  }

  const oldestExpense = runwayExpenses.reduce<Date | null>(
    (oldest, expense) => (oldest === null || expense.at < oldest ? expense.at : oldest),
    null,
  );
  const runwayHistoryDays =
    oldestExpense === null
      ? 0
      : Math.min(
          HISTORY_WINDOW_DAYS,
          Math.max(
            1,
            Math.floor((today.getTime() - startOfUtcDay(oldestExpense).getTime()) / DAY_MS) + 1,
          ),
        );
  const runwaySpend = runwayExpenses.reduce((total, expense) => total + expense.amount, 0);
  const runwayReady =
    runwayExpenses.length >= MIN_RUNWAY_EXPENSE_ROWS &&
    runwayHistoryDays >= MIN_RUNWAY_HISTORY_DAYS &&
    runwaySpend > 0;
  const dailyExpense = runwayReady ? runwaySpend / runwayHistoryDays : 0;
  const runwayDays =
    runwayReady && dailyExpense > 0 ? Math.max(0, Math.floor(cashBalance / dailyExpense)) : null;

  return {
    cashBalance,
    liabilityBalance,
    netPosition: cashBalance - liabilityBalance,
    confirmedIncome30Days,
    confirmedExpense30Days,
    upcomingIncome,
    upcomingCommitments,
    projectedCash: cashBalance + upcomingIncome - upcomingCommitments,
    nextCommitmentDate,
    runwayDays,
    runwayHistoryDays,
    runwayExpenseRows: runwayExpenses.length,
  };
}
