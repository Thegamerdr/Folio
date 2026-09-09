/** Explicit test-only fixture. Never import this module from production application code. */
import {
  createEmptyWorkspacePartition,
  hydrateFromBlob,
  resetToEmpty,
  setPartial,
  type Transaction,
} from '../store';
import { createPersonalWorkspaceRoot, PERSONAL_WORKSPACE_ID } from '../lib/workspaceRoot';
import {
  LEGACY_SAMPLE_BALANCE,
  LEGACY_SAMPLE_CYCLES,
  LEGACY_SAMPLE_DEBTS,
  LEGACY_SAMPLE_PLANS,
  LEGACY_SAMPLE_POTS,
  LEGACY_SAMPLE_SUBS,
} from '../lib/legacySampleData';

function seedTransactions(): Transaction[] {
  const now = Date.now();
  const day = 86_400_000;
  const t = (
    d: number,
    merchant: string,
    amount: number,
    category: Transaction['category'],
  ): Transaction => ({
    id: `seed-${merchant}-${d}`.toLowerCase().replace(/\s+/g, '-'),
    when: new Date(now - d * day).toISOString(),
    merchant,
    amount,
    category,
    source: 'seed',
  });
  return [
    t(0, 'Pret', -4.2, 'food'),
    t(0, 'Tube', -2.8, 'transport'),
    t(1, 'Tesco', -42.1, 'food'),
    t(2, 'Pub', -18.5, 'fun'),
    t(3, 'Coffee', -3.2, 'food'),
    t(4, 'Amazon', -27.99, 'shopping'),
    t(5, 'Spotify', -11.0, 'bills'),
    t(6, 'Uber', -14.3, 'transport'),
    t(7, 'Tesco', -36.4, 'food'),
    t(8, 'Cinema', -16.0, 'fun'),
    t(11, 'Salary', 1840.0, 'income'),
  ];
}

/** Reset the isolated Node test store and explicitly install the old visual fixture. */
export function resetSampleFixture(): void {
  resetToEmpty();
  const empty = createEmptyWorkspacePartition(
    createPersonalWorkspaceRoot(),
    PERSONAL_WORKSPACE_ID,
    '2026-06-27T00:00:00.000Z',
  );
  hydrateFromBlob(JSON.stringify(empty), PERSONAL_WORKSPACE_ID);
  setPartial(
    JSON.parse(
      JSON.stringify({
        bufferAmount: 100,
        pots: LEGACY_SAMPLE_POTS,
        subs: LEGACY_SAMPLE_SUBS,
        cycles: LEGACY_SAMPLE_CYCLES,
        debts: LEGACY_SAMPLE_DEBTS,
        plans: LEGACY_SAMPLE_PLANS,
        onboarding: { done: false, name: '', payday: 25, monthlyIncome: 2180 },
        currentBalance: LEGACY_SAMPLE_BALANCE,
        accounts: [
          {
            id: 'acct-main',
            name: 'Main',
            kind: 'bank',
            isLiability: false,
            balanceMinor: LEGACY_SAMPLE_BALANCE.amount,
            balanceAsOfISO: LEGACY_SAMPLE_BALANCE.setAt,
            addedAt: LEGACY_SAMPLE_BALANCE.setAt,
          },
        ],
        transactions: seedTransactions(),
      }),
    ),
  );
}
