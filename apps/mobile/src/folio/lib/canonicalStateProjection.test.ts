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
          source: 'pdf',
          merchant: 'Needs approval',
          amount: -12.34,
          accountId: 'acct-savings',
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
});
