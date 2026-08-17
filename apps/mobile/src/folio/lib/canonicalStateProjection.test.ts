import { describe, expect, it } from 'vitest';

import { DEFAULT_ACCOUNT_ID, getState, resetToEmpty, type AppState } from '../store';
import { PERSONAL_WORKSPACE_ID, type PersistedWorkspace } from './workspaceRoot';
import { canonicalAccountIdForSource } from '../../local/canonicalLedgerAdapter';

import {
  createCanonicalAppStateProjection,
  createCanonicalAppStateProjectionFromPayload,
} from './canonicalStateProjection';

function emptyState(): AppState {
  resetToEmpty();
  return structuredClone(getState());
}

function personalWorkspace(state: AppState): PersistedWorkspace {
  const workspace = state.workspaces.find((candidate) => candidate.id === PERSONAL_WORKSPACE_ID);
  if (workspace === undefined) throw new Error('Personal workspace fixture is missing.');
  return workspace;
}

describe('canonical AppState projection', () => {
  it('preserves account ownership, balances, accepted facts and review-before-truth proposals', () => {
    const base = emptyState();
    const workspace = personalWorkspace(base);
    const state: AppState = {
      ...base,
      currentBalance: {
        amount: 1_500,
        source: 'corrected',
        confidence: 'corrected',
        setAt: '2026-07-16T07:00:00.000Z',
      },
      accounts: [
        {
          id: DEFAULT_ACCOUNT_ID,
          name: 'Current',
          kind: 'bank',
          isLiability: false,
          balanceMinor: 1_000,
          balanceAsOfISO: '2026-07-16T07:00:00.000Z',
          addedAt: '2026-07-01T07:00:00.000Z',
        },
        {
          id: 'acct-savings',
          name: 'Savings',
          kind: 'savings',
          isLiability: false,
          balanceMinor: 500,
          balanceAsOfISO: '2026-07-16T07:00:00.000Z',
          addedAt: '2026-07-01T07:00:00.000Z',
        },
        {
          id: 'acct-card',
          name: 'Card',
          kind: 'credit-card',
          isLiability: true,
          balanceMinor: 300,
          balanceAsOfISO: '2026-07-16T07:00:00.000Z',
          addedAt: '2026-07-01T07:00:00.000Z',
        },
      ],
      transactions: [
        {
          id: 'bank-row',
          when: '2026-07-16T08:00:00.000Z',
          merchant: 'Groceries',
          amount: -10.25,
          category: 'food',
          source: 'bank',
          accountId: DEFAULT_ACCOUNT_ID,
        },
        {
          id: 'card-row',
          when: '2026-07-16T08:30:00.000Z',
          merchant: 'Train',
          amount: -5,
          category: 'transport',
          source: 'manual',
          accountId: 'acct-card',
        },
      ],
      reviewQueue: [
        {
          id: 'review-row',
          source: 'bank',
          merchant: 'Needs approval',
          amount: -12.34,
          accountId: 'acct-savings',
          externalId: 'provider-review-row',
          lifecycleStatus: 'pending',
          providerUpdatedAt: '2026-07-16T08:44:00.000Z',
          addedAt: '2026-07-16T08:45:00.000Z',
        },
      ],
    };

    const projection = createCanonicalAppStateProjection(
      state,
      workspace,
      '2026-07-16T09:00:00.000Z',
    );
    const mainId = canonicalAccountIdForSource(workspace.id, DEFAULT_ACCOUNT_ID);
    const cardId = canonicalAccountIdForSource(workspace.id, 'acct-card');

    expect(projection.mobileSnapshot.validation).toEqual({ valid: true, issues: [] });
    expect(projection.mobileSnapshot.accounts).toHaveLength(4);
    expect(
      projection.mobileSnapshot.balanceObservations.every(
        (observation) => observation.observationKind === 'current-balance',
      ),
    ).toBe(true);
    expect(
      projection.mobileSnapshot.currentBalances.map((balance) => balance.balance.minorUnits),
    ).toEqual(expect.arrayContaining([100_000, 50_000, 30_000]));
    expect(projection.mobileSnapshot.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: mainId,
          amount: { minorUnits: -1_025, currency: 'GBP' },
          sourceKind: 'open_banking',
          sourceTransactionId: 'bank-row',
          sourceOrdinal: 0,
          bookedAt: '2026-07-16T08:00:00.000Z',
          splits: [expect.objectContaining({ categoryId: 'food' })],
        }),
        expect.objectContaining({
          accountId: cardId,
          amount: { minorUnits: -500, currency: 'GBP' },
        }),
      ]),
    );
    expect(projection.mobileSnapshot.importDrafts).toHaveLength(1);
    expect(
      projection.repositorySnapshot.collections.transactionIntelligenceStates[0]?.reviewQueue[0],
    ).toMatchObject({
      id: 'review-row',
      lifecycleStatus: 'pending',
      providerUpdatedAt: '2026-07-16T08:44:00.000Z',
    });
    expect(projection.mobileSnapshot.transactions).toHaveLength(2);
    expect(projection.mobileSnapshot.availablePositionSnapshots[0]).toMatchObject({
      openingBalance: { minorUnits: 150_000, currency: 'GBP' },
      actualNet: { minorUnits: -1_025, currency: 'GBP' },
      availableBalance: { minorUnits: 148_975, currency: 'GBP' },
    });
    expect(projection.repositorySnapshot.collections.accounts).toHaveLength(4);
  });

  it('projects the exact serialized payload and adds an estimated account for unresolved legacy rows', () => {
    const base = emptyState();
    const workspace = personalWorkspace(base);
    const state: AppState = {
      ...base,
      currentBalance: {
        amount: 20,
        source: 'user-entered',
        confidence: 'rough',
        setAt: '2026-07-16T07:00:00.000Z',
      },
      accounts: [
        {
          id: 'acct-custom',
          name: 'Custom',
          kind: 'bank',
          isLiability: false,
          balanceMinor: 20,
          balanceAsOfISO: '2026-07-16T07:00:00.000Z',
          addedAt: '2026-07-16T07:00:00.000Z',
        },
      ],
      transactions: [
        {
          id: 'legacy-row',
          when: '2026-07-16T08:00:00.000Z',
          merchant: 'Legacy',
          amount: -1,
          category: 'other',
          source: 'manual',
        },
      ],
    };
    const payload = JSON.stringify(state);
    const projection = createCanonicalAppStateProjectionFromPayload(
      payload,
      workspace,
      '2026-07-16T09:00:00.000Z',
    );

    expect(projection.mobileSnapshot.accounts.map((account) => account.name)).toEqual([
      'Custom',
      'Unallocated balance reconciliation',
      'Main (legacy rows)',
    ]);
    expect(projection.mobileSnapshot.transactions[0]?.accountId).toBe(
      canonicalAccountIdForSource(workspace.id, DEFAULT_ACCOUNT_ID),
    );
  });

  it('fails closed when a row belongs to another workspace', () => {
    const state = emptyState();
    const workspace = personalWorkspace(state);
    const invalid: AppState = {
      ...state,
      transactions: [
        {
          id: 'wrong-owner',
          workspaceId: 'workspace_elsewhere' as typeof PERSONAL_WORKSPACE_ID,
          when: '2026-07-16T08:00:00.000Z',
          merchant: 'Wrong owner',
          amount: -1,
          category: 'other',
          source: 'manual',
        },
      ],
    };

    expect(() =>
      createCanonicalAppStateProjection(invalid, workspace, '2026-07-16T09:00:00.000Z'),
    ).toThrow(/outside the canonical appstate workspace/i);
  });

  it('quarantines restored foreign accounts and their rows from the GBP canonical projection', () => {
    const base = emptyState();
    const workspace = personalWorkspace(base);
    const state: AppState = {
      ...base,
      currentBalance: {
        ...base.currentBalance,
        amount: 10_499,
        setAt: '2026-07-16T07:00:00.000Z',
      },
      accounts: [
        {
          id: DEFAULT_ACCOUNT_ID,
          name: 'Current',
          kind: 'bank',
          isLiability: false,
          balanceMinor: 500,
          balanceAsOfISO: '2026-07-16T07:00:00.000Z',
          addedAt: '2026-07-01T07:00:00.000Z',
          currency: 'GBP',
        },
        {
          id: 'acct-eur',
          name: 'Euro account',
          kind: 'bank',
          isLiability: false,
          balanceMinor: 9_999,
          balanceAsOfISO: '2026-07-16T07:00:00.000Z',
          addedAt: '2026-07-01T07:00:00.000Z',
          currency: 'EUR',
        },
      ],
      transactions: [
        {
          id: 'txn-gbp',
          when: '2026-07-16T08:00:00.000Z',
          merchant: 'GBP row',
          amount: -10,
          category: 'other',
          source: 'manual',
          accountId: DEFAULT_ACCOUNT_ID,
        },
        {
          id: 'txn-eur',
          when: '2026-07-16T08:05:00.000Z',
          merchant: 'EUR row',
          amount: -20,
          category: 'other',
          source: 'manual',
          accountId: 'acct-eur',
        },
      ],
    };

    const projection = createCanonicalAppStateProjection(
      state,
      workspace,
      '2026-07-16T09:00:00.000Z',
    );

    expect(projection.mobileSnapshot.accounts.map((account) => account.name)).not.toContain(
      'Euro account',
    );
    expect(projection.mobileSnapshot.transactions).toHaveLength(1);
    expect(projection.mobileSnapshot.transactions[0]?.sourceTransactionId).toBe('txn-gbp');
    expect(projection.mobileSnapshot.availablePositionSnapshots[0]?.openingBalance).toEqual({
      minorUnits: 50_000,
      currency: 'GBP',
    });
  });

  it('retains closed and excluded account history but removes it from current available money', () => {
    const base = emptyState();
    const workspace = personalWorkspace(base);
    const at = '2026-07-16T07:00:00.000Z';
    const state: AppState = {
      ...base,
      currentBalance: {
        amount: 1_000,
        source: 'corrected',
        confidence: 'corrected',
        setAt: at,
      },
      accounts: [
        {
          id: DEFAULT_ACCOUNT_ID,
          name: 'Current',
          kind: 'bank',
          isLiability: false,
          balanceMinor: 1_000,
          balanceAsOfISO: at,
          addedAt: at,
        },
        {
          id: 'acct-closed',
          name: 'Closed account',
          kind: 'bank',
          isLiability: false,
          balanceMinor: 500,
          balanceAsOfISO: at,
          addedAt: at,
          closed: true,
        },
        {
          id: 'acct-excluded',
          name: 'Excluded account',
          kind: 'bank',
          isLiability: false,
          balanceMinor: 300,
          balanceAsOfISO: at,
          addedAt: at,
          excludedFromTotals: true,
        },
      ],
      transactions: [
        {
          id: 'txn-current',
          when: '2026-07-16T08:00:00.000Z',
          merchant: 'Current row',
          amount: -10,
          category: 'other',
          source: 'manual',
          accountId: DEFAULT_ACCOUNT_ID,
        },
        {
          id: 'txn-closed',
          when: '2026-07-16T08:05:00.000Z',
          merchant: 'Closed history',
          amount: -20,
          category: 'other',
          source: 'manual',
          accountId: 'acct-closed',
        },
        {
          id: 'txn-excluded',
          when: '2026-07-16T08:10:00.000Z',
          merchant: 'Excluded history',
          amount: -30,
          category: 'other',
          source: 'manual',
          accountId: 'acct-excluded',
        },
      ],
    };

    const projection = createCanonicalAppStateProjection(
      state,
      workspace,
      '2026-07-16T09:00:00.000Z',
    );

    expect(projection.mobileSnapshot.transactions).toHaveLength(3);
    expect(
      projection.mobileSnapshot.accounts.find(
        (candidate) => candidate.id === canonicalAccountIdForSource(workspace.id, 'acct-closed'),
      )?.state,
    ).toBe('closed');
    expect(
      projection.mobileSnapshot.accounts.find(
        (candidate) => candidate.id === canonicalAccountIdForSource(workspace.id, 'acct-excluded'),
      )?.state,
    ).toBe('archived');
    expect(projection.mobileSnapshot.availablePositionSnapshots[0]).toMatchObject({
      openingBalance: { minorUnits: 100_000, currency: 'GBP' },
      actualNet: { minorUnits: -1_000, currency: 'GBP' },
      availableBalance: { minorUnits: 99_000, currency: 'GBP' },
    });
  });

  it('round-trips lifecycle, refund, reversal and transfer links without counting pending actuals', () => {
    const base = emptyState();
    const workspace = personalWorkspace(base);
    const at = '2026-07-16T07:00:00.000Z';
    const state: AppState = {
      ...base,
      currentBalance: { amount: 1_000, source: 'corrected', confidence: 'corrected', setAt: at },
      accounts: [
        {
          id: DEFAULT_ACCOUNT_ID,
          name: 'Current',
          kind: 'bank',
          isLiability: false,
          balanceMinor: 1_000,
          balanceAsOfISO: at,
          addedAt: at,
        },
        {
          id: 'acct-savings',
          name: 'Savings',
          kind: 'savings',
          isLiability: false,
          balanceMinor: 0,
          balanceAsOfISO: at,
          addedAt: at,
        },
      ],
      transactions: [
        {
          id: 'purchase',
          when: '2026-07-16T08:00:00.000Z',
          merchant: 'Purchase',
          amount: -100,
          category: 'shopping',
          source: 'manual',
          accountId: DEFAULT_ACCOUNT_ID,
          lifecycleStatus: 'posted',
          manuallyCorrectedAt: '2026-07-16T08:30:00.000Z',
        },
        {
          id: 'refund',
          when: '2026-07-16T09:00:00.000Z',
          merchant: 'Refund',
          amount: 25,
          category: 'shopping',
          source: 'manual',
          accountId: DEFAULT_ACCOUNT_ID,
          lifecycleStatus: 'posted',
          moneyMovementKind: 'refund',
          refundOfId: 'purchase',
        },
        {
          id: 'pending',
          when: '2026-07-16T09:10:00.000Z',
          merchant: 'Pending',
          amount: -30,
          category: 'other',
          source: 'bank',
          accountId: DEFAULT_ACCOUNT_ID,
          lifecycleStatus: 'pending',
          providerUpdatedAt: '2026-07-16T09:11:00.000Z',
        },
        {
          id: 'transfer-out',
          when: '2026-07-16T09:20:00.000Z',
          merchant: 'Move',
          amount: -200,
          category: 'other',
          source: 'manual',
          accountId: DEFAULT_ACCOUNT_ID,
          lifecycleStatus: 'posted',
          moneyMovementKind: 'transfer',
          transferLinkId: 'move-1',
        },
        {
          id: 'transfer-in',
          when: '2026-07-16T09:20:00.000Z',
          merchant: 'Move',
          amount: 200,
          category: 'other',
          source: 'manual',
          accountId: 'acct-savings',
          lifecycleStatus: 'posted',
          moneyMovementKind: 'transfer',
          transferLinkId: 'move-1',
        },
      ],
    };

    const projection = createCanonicalAppStateProjection(
      state,
      workspace,
      '2026-07-16T10:00:00.000Z',
    );

    expect(
      projection.mobileSnapshot.transactions.find((row) => row.sourceTransactionId === 'pending')
        ?.status,
    ).toBe('pending');
    expect(
      projection.mobileSnapshot.transactions.find((row) => row.sourceTransactionId === 'refund'),
    ).toMatchObject({
      movementKind: 'refund',
    });
    expect(
      projection.mobileSnapshot.transactions.find(
        (row) => row.sourceTransactionId === 'transfer-out',
      ),
    ).toMatchObject({
      movementKind: 'transfer',
      sourceTransferLinkId: 'move-1',
    });
    expect(projection.mobileSnapshot.availablePositionSnapshots[0]?.actualNet.minorUnits).toBe(
      -7_500,
    );
  });
});
