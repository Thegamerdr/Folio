import { describe, expect, it } from 'vitest';

import type { Account, Transaction } from '../store';
import type { DerivedEvent } from './calendarEvents';
import { buildBusinessCashPosition } from './businessCashPosition';

const NOW = new Date('2026-07-15T12:00:00.000Z');

function account(input: Partial<Account> & Pick<Account, 'id' | 'name'>): Account {
  return {
    ...input,
    id: input.id,
    name: input.name,
    kind: input.kind ?? 'bank',
    isLiability: input.isLiability ?? false,
    balanceMinor: input.balanceMinor ?? 0,
    balanceAsOfISO: input.balanceAsOfISO ?? NOW.toISOString(),
    addedAt: input.addedAt ?? NOW.toISOString(),
  };
}

function transaction(when: string, amount: number, accountId?: string): Transaction {
  return {
    id: `txn-${when}-${amount}`,
    when,
    merchant: 'Confirmed record',
    amount,
    category: amount >= 0 ? 'income' : 'other',
    source: 'manual',
    ...(accountId === undefined ? {} : { accountId }),
  };
}

function event(date: string, amount: number): DerivedEvent {
  return {
    id: `event-${date}-${amount}`,
    date,
    kind: amount >= 0 ? 'in' : 'out',
    source: 'manual',
    title: 'Confirmed dated event',
    amount,
    manual: true,
  };
}

describe('buildBusinessCashPosition', () => {
  it('separates cash, liabilities and dated commitments without inventing data', () => {
    const result = buildBusinessCashPosition({
      accounts: [
        account({ id: 'bank', name: 'Business current', balanceMinor: 2_000 }),
        account({
          id: 'card',
          name: 'Business card',
          kind: 'credit-card',
          isLiability: true,
          balanceMinor: 350,
        }),
      ],
      transactions: [
        transaction('2026-07-10T00:00:00.000Z', 900),
        transaction('2026-07-11T00:00:00.000Z', -125),
      ],
      upcomingEvents: [event('2026-07-20', -400), event('2026-07-25', 750)],
      now: NOW,
    });

    expect(result).toMatchObject({
      cashBalance: 2_000,
      liabilityBalance: 350,
      netPosition: 1_650,
      confirmedIncome30Days: 900,
      confirmedExpense30Days: 125,
      upcomingIncome: 750,
      upcomingCommitments: 400,
      projectedCash: 2_350,
      nextCommitmentDate: '2026-07-20',
      runwayDays: null,
    });
  });

  it('withholds runway until expense history spans fourteen days and has three rows', () => {
    const sparse = buildBusinessCashPosition({
      accounts: [account({ id: 'bank', name: 'Business current', balanceMinor: 1_400 })],
      transactions: [
        transaction('2026-07-01T00:00:00.000Z', -100),
        transaction('2026-07-15T00:00:00.000Z', -50),
      ],
      upcomingEvents: [],
      now: NOW,
    });
    expect(sparse.runwayHistoryDays).toBe(15);
    expect(sparse.runwayExpenseRows).toBe(2);
    expect(sparse.runwayDays).toBeNull();

    const ready = buildBusinessCashPosition({
      accounts: [account({ id: 'bank', name: 'Business current', balanceMinor: 1_400 })],
      transactions: [
        transaction('2026-07-01T00:00:00.000Z', -100),
        transaction('2026-07-08T00:00:00.000Z', -50),
        transaction('2026-07-15T00:00:00.000Z', -60),
      ],
      upcomingEvents: [],
      now: NOW,
    });
    expect(ready.runwayHistoryDays).toBe(15);
    expect(ready.runwayExpenseRows).toBe(3);
    expect(ready.runwayDays).toBe(100);
  });

  it('keeps a genuinely empty workspace at zero with no fake runway', () => {
    expect(
      buildBusinessCashPosition({ accounts: [], transactions: [], upcomingEvents: [], now: NOW }),
    ).toEqual({
      cashBalance: 0,
      liabilityBalance: 0,
      netPosition: 0,
      confirmedIncome30Days: 0,
      confirmedExpense30Days: 0,
      upcomingIncome: 0,
      upcomingCommitments: 0,
      projectedCash: 0,
      nextCommitmentDate: null,
      runwayDays: null,
      runwayHistoryDays: 0,
      runwayExpenseRows: 0,
    });
  });

  it('excludes card, closed, foreign and owner-excluded rows from cashflow and runway', () => {
    const result = buildBusinessCashPosition({
      accounts: [
        account({ id: 'bank', name: 'Business current', balanceMinor: 2_000 }),
        account({
          id: 'card',
          name: 'Business card',
          kind: 'credit-card',
          isLiability: true,
          balanceMinor: 350,
        }),
        account({ id: 'closed', name: 'Closed current', balanceMinor: 4_000, closed: true }),
        account({
          id: 'excluded',
          name: 'Excluded current',
          balanceMinor: 5_000,
          excludedFromTotals: true,
        }),
        account({
          id: 'foreign',
          name: 'Euro current',
          balanceMinor: 9_000,
          currency: 'EUR',
        }),
      ],
      transactions: [
        transaction('2026-07-01T00:00:00.000Z', -100, 'bank'),
        transaction('2026-07-08T00:00:00.000Z', -50, 'bank'),
        transaction('2026-07-15T00:00:00.000Z', -60, 'bank'),
        transaction('2026-07-12T00:00:00.000Z', -500, 'card'),
        transaction('2026-07-12T00:00:00.000Z', -600, 'closed'),
        transaction('2026-07-12T00:00:00.000Z', 700, 'excluded'),
        transaction('2026-07-12T00:00:00.000Z', 800, 'foreign'),
      ],
      upcomingEvents: [],
      now: NOW,
    });

    expect(result).toMatchObject({
      cashBalance: 2_000,
      liabilityBalance: 350,
      netPosition: 1_650,
      confirmedIncome30Days: 0,
      confirmedExpense30Days: 210,
      runwayExpenseRows: 3,
      runwayHistoryDays: 15,
      runwayDays: 142,
    });
  });
});
