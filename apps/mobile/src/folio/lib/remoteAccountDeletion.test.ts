import { describe, expect, it, vi } from 'vitest';

// The orchestration is dependency-injected below; keep its default Expo adapters out of the
// Node-only runner while still proving the production control flow.
vi.mock('./cloudBackupNative', () => ({
  clearCloudBackupLocalSecrets: vi.fn(),
  deleteCloudAccountData: vi.fn(),
}));
vi.mock('./openBankingNative', () => ({
  deleteOpenBankingAccountData: vi.fn(),
}));

import { deleteRemoteMeloAccount, RemoteAccountDeletionError } from './remoteAccountDeletion';

const cloudResult = { deleted: true as const, scope: 'account-cloud-data' as const };
const bankResult = {
  deletedConnections: 2,
  futureAccessStopped: true as const,
  providerSecretsDeleted: true as const,
  providerRevocationSupported: false as const,
  pendingCallbackMetadataExpiresWithinSeconds: 1200,
};

function dependencies() {
  return {
    deleteCloudData: vi.fn().mockResolvedValue(cloudResult),
    deleteBankData: vi.fn().mockResolvedValue(bankResult),
    clearLocalCloudSecrets: vi.fn().mockResolvedValue(undefined),
  };
}

describe('remote Melo account deletion', () => {
  it('purges both remote stores before deleting the identity and preserves local money by design', async () => {
    const deps = dependencies();
    const deleteIdentity = vi.fn().mockResolvedValue(undefined);

    await expect(deleteRemoteMeloAccount('session-token', deleteIdentity, deps)).resolves.toEqual({
      cloud: cloudResult,
      banking: bankResult,
      localCloudSecretsCleared: true,
    });
    expect(deps.deleteCloudData).toHaveBeenCalledWith('session-token');
    expect(deps.deleteBankData).toHaveBeenCalledWith('session-token');
    expect(deps.clearLocalCloudSecrets).toHaveBeenCalledTimes(1);
    expect(deleteIdentity).toHaveBeenCalledTimes(1);
  });

  it('keeps the identity when either remote service cannot confirm deletion', async () => {
    const deps = dependencies();
    deps.deleteCloudData.mockRejectedValueOnce(new Error('vault unavailable'));
    const deleteIdentity = vi.fn();

    await expect(
      deleteRemoteMeloAccount('session-token', deleteIdentity, deps),
    ).rejects.toMatchObject({
      name: 'RemoteAccountDeletionError',
      stage: 'remote-data',
      completedRemoteScopes: ['bank-connections'],
    });
    expect(deps.deleteBankData).toHaveBeenCalledTimes(1);
    expect(deps.clearLocalCloudSecrets).not.toHaveBeenCalled();
    expect(deleteIdentity).not.toHaveBeenCalled();
  });

  it('reports an identity-provider failure after the remote purge without claiming local deletion', async () => {
    const deps = dependencies();
    const deleteIdentity = vi.fn().mockRejectedValue(new Error('Clerk rejected deletion'));

    await expect(deleteRemoteMeloAccount('session-token', deleteIdentity, deps)).rejects.toEqual(
      expect.objectContaining<Partial<RemoteAccountDeletionError>>({
        stage: 'identity',
        completedRemoteScopes: ['bank-connections', 'cloud-backup'],
      }),
    );
  });

  it('does not strand deletion when only stale local recovery material cannot be removed', async () => {
    const deps = dependencies();
    deps.clearLocalCloudSecrets.mockRejectedValueOnce(new Error('secure store unavailable'));
    const deleteIdentity = vi.fn().mockResolvedValue(undefined);

    await expect(deleteRemoteMeloAccount('session-token', deleteIdentity, deps)).resolves.toEqual(
      expect.objectContaining({ localCloudSecretsCleared: false }),
    );
    expect(deleteIdentity).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty session token before calling any destructive dependency', async () => {
    const deps = dependencies();
    const deleteIdentity = vi.fn();

    await expect(deleteRemoteMeloAccount('  ', deleteIdentity, deps)).rejects.toMatchObject({
      stage: 'remote-data',
      completedRemoteScopes: [],
    });
    expect(deps.deleteCloudData).not.toHaveBeenCalled();
    expect(deps.deleteBankData).not.toHaveBeenCalled();
    expect(deleteIdentity).not.toHaveBeenCalled();
  });
});
