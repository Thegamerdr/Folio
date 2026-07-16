import { describe, expect, it } from 'vitest';

import {
  createWorkspaceScopedRowRepository,
  normaliseWorkspaceRowPatch,
  normaliseWorkspaceRows,
  PERSISTED_WORKSPACE_ROW_COLLECTIONS,
  requireWorkspaceRows,
  TRANSIENT_WORKSPACE_ROW_COLLECTIONS,
} from './workspaceRows';
import { createPersonalWorkspaceRoot, PERSONAL_WORKSPACE_ID } from './workspaceRoot';

function everyCollectionState(): Record<string, unknown> {
  return Object.fromEntries(
    [...PERSISTED_WORKSPACE_ROW_COLLECTIONS, ...TRANSIENT_WORKSPACE_ROW_COLLECTIONS].map(
      (collection, index) => [collection, [{ id: `${collection}-${index}` }]],
    ),
  );
}

describe('production workspace-owned rows', () => {
  it('stamps every persisted and transient production row collection', () => {
    const normalised = normaliseWorkspaceRows(everyCollectionState(), PERSONAL_WORKSPACE_ID);

    for (const collection of [
      ...PERSISTED_WORKSPACE_ROW_COLLECTIONS,
      ...TRANSIENT_WORKSPACE_ROW_COLLECTIONS,
    ]) {
      expect(normalised[collection]).toEqual([
        expect.objectContaining({ workspaceId: PERSONAL_WORKSPACE_ID }),
      ]);
    }
  });

  it('normalises only collections present in a store patch and preserves unrelated values', () => {
    const patch = { transactions: [{ id: 'transaction-1' }], nextYouNote: 'keep me' };

    expect(normaliseWorkspaceRowPatch(patch, PERSONAL_WORKSPACE_ID)).toEqual({
      transactions: [{ id: 'transaction-1', workspaceId: PERSONAL_WORKSPACE_ID }],
      nextYouNote: 'keep me',
    });
  });

  it('never overwrites a conflicting Business owner during migration or writes', () => {
    expect(() =>
      normaliseWorkspaceRows(
        {
          transactions: [{ id: 'cross-workspace', workspaceId: 'workspace_business_injected' }],
        },
        PERSONAL_WORKSPACE_ID,
      ),
    ).toThrow(/belongs to workspace workspace_business_injected/);
  });

  it('fails a query before returning any collection when one row lacks ownership', () => {
    const root = createPersonalWorkspaceRoot();
    const state = { ...root, transactions: [{ id: 'legacy-row-without-owner' }] };

    expect(() => requireWorkspaceRows(state, PERSONAL_WORKSPACE_ID)).toThrow(
      /legacy-row-without-owner is not owned/,
    );
  });

  it('builds a scoped repository only after root and complete-row checks pass', () => {
    const root = createPersonalWorkspaceRoot();
    const transactions = [
      { id: 'transaction-1', workspaceId: PERSONAL_WORKSPACE_ID },
      { id: 'transaction-2', workspaceId: PERSONAL_WORKSPACE_ID },
    ];
    const state = normaliseWorkspaceRows({ ...root, transactions }, PERSONAL_WORKSPACE_ID);
    const repository = createWorkspaceScopedRowRepository(state, PERSONAL_WORKSPACE_ID);

    expect(repository.workspaceId).toBe(PERSONAL_WORKSPACE_ID);
    expect(repository.list('transactions')).toBe(transactions);
    expect(repository.get('transactions', 'transaction-2')).toBe(transactions[1]);
    expect(() =>
      createWorkspaceScopedRowRepository(
        state,
        'workspace_business_injected' as typeof PERSONAL_WORKSPACE_ID,
      ),
    ).toThrow(/unavailable/);
  });

  it('does not hide a cross-workspace row by filtering it from the repository result', () => {
    const root = createPersonalWorkspaceRoot();
    const state = {
      ...root,
      transactions: [
        { id: 'personal', workspaceId: PERSONAL_WORKSPACE_ID },
        { id: 'leak', workspaceId: 'workspace_business_injected' },
      ],
    };

    expect(() => createWorkspaceScopedRowRepository(state, PERSONAL_WORKSPACE_ID)).toThrow(
      /transactions\/leak is not owned/,
    );
  });
});
