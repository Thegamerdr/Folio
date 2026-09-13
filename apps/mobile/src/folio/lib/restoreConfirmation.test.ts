import { describe, expect, it, vi } from 'vitest';

import { restoreFailureMessage, runConfirmedRestore } from './restoreConfirmation';

describe('confirmed restore async boundary', () => {
  it('reports a successful restore only after apply resolves', async () => {
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const result = {
      workspaceId: 'workspace_personal_local',
      status: 'degraded' as const,
      degraded: true,
      attemptedTransactionCount: 0,
      restoredTransactionCount: 0,
      intactTransactionCount: 0,
      notRestoredTransactionCount: 0,
      restoredAccountCount: 0,
      changedAccountCount: 0,
      changedDebtCount: 0,
      changedSubscriptionCount: 0,
      changedPotCount: 0,
      restoredOriginalFileCount: 0,
      missingOriginalFileCount: 0,
      unlinkedRecordCount: 0,
      unlinkedStatementRecordCount: 0,
      restoredTransactionIds: [],
      missingTransactionIds: [],
      droppedTransactionCount: 0,
      duplicateTransactionIdCount: 0,
      changedTransactionIds: [],
      missingOriginalTransactionIds: [],
    };

    await runConfirmedRestore(async () => result, onSuccess, onFailure);

    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledWith(result);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('routes an apply rejection to the existing failure dialog with its error message', async () => {
    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    await runConfirmedRestore(
      async () => {
        throw new Error('SQLCipher restore failed');
      },
      onSuccess,
      onFailure,
    );

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenCalledWith('SQLCipher restore failed');
  });

  it('uses the device fallback for non-Error rejection values', () => {
    expect(restoreFailureMessage('cancelled by native bridge')).toBe(
      'Restore could not finish on this device.',
    );
  });
});
