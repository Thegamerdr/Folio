import { describe, expect, it } from 'vitest';

import type { AppState, Pot, PotLedgerEntry, Transaction } from '@/folio/store';

import { computeRitualLedgerActuals } from './potLedgerActuals';

const NOW = new Date('2026-08-26T12:00:00.000Z');

function pot(id: string): Pot {
  return { id, name: `${id} pot`, saved: 0, goal: 100, perWeek: 10, accent: false };
}

function transaction(id: string, amount: number, merchant: string): Transaction {
  return {
    id,
    when: '2026-08-10T12:00:00.000Z',
    merchant,
    amount,
    category: 'other',
    source: 'bank',
  };
}

function ledger(id: string, potId: string, amount: number): PotLedgerEntry {
  return {
    id,
    potId,
    at: '2026-08-10T12:00:00.000Z',
    kind: 'deposit',
    amount,
    source: 'statement-import',
  };
}

function actuals(
  pots: Pot[] = [],
  transactions: Transaction[] = [],
  potLedger: PotLedgerEntry[] = [],
) {
  const state = { pots, transactions, potLedger } as Pick<
    AppState,
    'pots' | 'transactions' | 'potLedger'
  >;
  return computeRitualLedgerActuals(state, NOW);
}

describe('Payday Ritual canonical pot actuals', () => {
  it('does not turn transfers or orphan ledger rows into set-aside when no pots exist', () => {
    expect(
      actuals(
        [],
        [transaction('transfer', 75, 'Transfer to savings')],
        [ledger('orphan', 'deleted-pot', 25)],
      ),
    ).toEqual({ spent: 0, setAside: 0 });
  });

  it('keeps statement-import transactions separate from pot movement when no pots exist', () => {
    expect(actuals([], [transaction('statement', -12, 'Savings Pot Transfer')])).toEqual({
      spent: 12,
      setAside: 0,
    });
  });

  it('ignores an unrelated transfer even when another real pot exists', () => {
    expect(actuals([pot('holiday')], [transaction('transfer', 100, 'Bank transfer')])).toEqual({
      spent: 0,
      setAside: 0,
    });
  });

  it('counts only a deposit linked to a real canonical pot', () => {
    expect(actuals([pot('holiday')], [], [ledger('linked', 'holiday', 18.5)])).toEqual({
      spent: 0,
      setAside: 19,
    });
  });
});
