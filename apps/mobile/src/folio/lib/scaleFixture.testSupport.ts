/** Deterministic test/dev-only scale corpus. Never imported by the production bundle. */
import type { CandidateMoneyItem } from './importSheet';
import type { CalendarEvent, Debt, Pot, Sub, Transaction } from '../store';

export type ScaleFixture = Readonly<{
  candidates: readonly CandidateMoneyItem[];
  transactions: readonly Transaction[];
  subs: readonly Sub[];
  debts: readonly Debt[];
  pots: readonly Pot[];
  calendarEvents: readonly CalendarEvent[];
}>;

function isoDay(index: number): string {
  return new Date(Date.UTC(2014, 0, 1 + (index % 4_380))).toISOString().slice(0, 10);
}

export function buildScaleFixture(transactionCount: number): ScaleFixture {
  const candidates: CandidateMoneyItem[] = [];
  const transactions: Transaction[] = [];
  for (let index = 0; index < transactionCount; index += 1) {
    const source = (['pdf', 'csv', 'photo', 'paste'] as const)[index % 4]!;
    const date = isoDay(index);
    const income = index % 13 === 0;
    const transfer = !income && index % 31 === 0;
    const unknown = !income && !transfer && index % 37 === 0;
    const amount = income ? 1_800 + (index % 5) : -((index % 180) + 1) - 0.25;
    const merchant = income ? `Employer ${index % 5}` : `Merchant ${index % 541}`;
    candidates.push({
      id: `scale-candidate-${index}`,
      source,
      kind: income
        ? 'income'
        : transfer
          ? 'transfer'
          : unknown
            ? 'unknown'
            : index % 17 === 0
              ? 'subscription'
              : index % 19 === 0
                ? 'bill'
                : index % 23 === 0
                  ? 'debt-payment'
                  : 'spend',
      merchant,
      amount,
      date,
      confidence: index % 29 === 0 ? 'low' : index % 7 === 0 ? 'medium' : 'high',
    });
    transactions.push({
      id: `scale-transaction-${index}`,
      when: `${date}T12:00:00.000Z`,
      merchant,
      amount,
      category: income ? 'income' : 'other',
      source: 'manual',
      accountId: `scale-account-${index % 3}`,
    });
  }

  const subs: Sub[] = Array.from({ length: 24 }, (_, index) => ({
    name: `Subscription ${index}`,
    cost: 2.99 + index,
    nextRenewalDaysAway: index % 31,
    nextRenewalISO: `2026-09-${String((index % 28) + 1).padStart(2, '0')}`,
    lastUsedDaysAgo: index % 60,
    usesPerMonth: index % 20,
  }));
  const debts: Debt[] = Array.from({ length: 8 }, (_, index) => ({
    id: `scale-debt-${index}`,
    name: `Debt ${index}`,
    kind: index % 2 === 0 ? 'card' : 'loan',
    balance: 1_000 + index * 350,
    apr: 5 + index,
    minPayment: 40 + index * 5,
    dueDom: (index % 28) + 1,
    addedAt: `2025-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
  }));
  const pots: Pot[] = Array.from({ length: 12 }, (_, index) => ({
    id: `scale-pot-${index}`,
    name: `Pot ${index}`,
    saved: index * 75,
    goal: 1_000 + index * 250,
    perWeek: 5 + index,
    accent: index === 0,
    cadence: { kind: 'after-payday' },
  }));
  const calendarEvents: CalendarEvent[] = Array.from({ length: 120 }, (_, index) => ({
    id: `scale-event-${index}`,
    date: new Date(Date.UTC(2026, 7, 1 + index)).toISOString().slice(0, 10),
    kind: index % 5 === 0 ? 'in' : 'out',
    title: `Calendar ${index}`,
    amount: index % 5 === 0 ? 500 : -(10 + index),
  }));
  return { candidates, transactions, subs, debts, pots, calendarEvents };
}
