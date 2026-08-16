import {
  clearCloudBackupLocalSecrets,
  deleteCloudAccountData,
  type CloudAccountDeletionResponse,
} from './cloudBackupNative';
import {
  deleteOpenBankingAccountData,
  type OpenBankingAccountDeletionResponse,
} from './openBankingNative';
import { getState } from '../store';

export type RemoteAccountDeletionResult = Readonly<{
  cloud: CloudAccountDeletionResponse;
  banking: OpenBankingAccountDeletionResponse;
  localCloudSecretsCleared: boolean;
}>;

export type RemoteAccountDeletionStage = 'remote-data' | 'identity';

export class RemoteAccountDeletionError extends Error {
  readonly stage: RemoteAccountDeletionStage;
  readonly completedRemoteScopes: readonly ('cloud-backup' | 'bank-connections')[];

  constructor(
    message: string,
    stage: RemoteAccountDeletionStage,
    completedRemoteScopes: readonly ('cloud-backup' | 'bank-connections')[],
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'RemoteAccountDeletionError';
    this.stage = stage;
    this.completedRemoteScopes = completedRemoteScopes;
  }
}

type DeletionDependencies = Readonly<{
  deleteCloudData: (token: string) => Promise<CloudAccountDeletionResponse>;
  deleteBankData: (token: string) => Promise<OpenBankingAccountDeletionResponse>;
  clearLocalCloudSecrets: () => Promise<void>;
}>;

const DEFAULT_DEPENDENCIES: DeletionDependencies = {
  deleteCloudData: deleteCloudAccountData,
  deleteBankData: deleteOpenBankingAccountData,
  clearLocalCloudSecrets: () =>
    clearCloudBackupLocalSecrets(getState().workspaces.map((workspace) => workspace.id)),
};

/**
 * Delete remote Melo data before deleting the identity that authorises those deletion calls.
 * Local financial data deliberately remains untouched; the device clear is a separate, gated flow.
 */
export async function deleteRemoteMeloAccount(
  token: string,
  deleteIdentity: () => Promise<void>,
  dependencies: DeletionDependencies = DEFAULT_DEPENDENCIES,
): Promise<RemoteAccountDeletionResult> {
  if (token.trim().length === 0) {
    throw new RemoteAccountDeletionError(
      'Sign in again before deleting your Melo account.',
      'remote-data',
      [],
    );
  }

  // Both independent stores are attempted so a temporary failure in one cannot prevent a useful
  // purge in the other. Identity deletion remains fail-closed until both services confirm deletion.
  const [bankingOutcome, cloudOutcome] = await Promise.allSettled([
    dependencies.deleteBankData(token),
    dependencies.deleteCloudData(token),
  ]);
  const completedRemoteScopes: ('cloud-backup' | 'bank-connections')[] = [];
  if (bankingOutcome.status === 'fulfilled') completedRemoteScopes.push('bank-connections');
  if (cloudOutcome.status === 'fulfilled') completedRemoteScopes.push('cloud-backup');

  if (bankingOutcome.status === 'rejected' || cloudOutcome.status === 'rejected') {
    const partial =
      completedRemoteScopes.length > 0
        ? ` ${completedRemoteScopes.join(' and ')} data was deleted, but the remaining remote data was not.`
        : '';
    const cause =
      bankingOutcome.status === 'rejected'
        ? bankingOutcome.reason
        : cloudOutcome.status === 'rejected'
          ? cloudOutcome.reason
          : undefined;
    throw new RemoteAccountDeletionError(
      `Melo could not confirm deletion across every remote service.${partial} Your sign-in remains so you can retry.`,
      'remote-data',
      completedRemoteScopes,
      { cause },
    );
  }

  let localCloudSecretsCleared = true;
  try {
    await dependencies.clearLocalCloudSecrets();
  } catch {
    // The remote ciphertext is already gone. A stale recovery code/device ID is not financial data
    // and must not strand an otherwise deletable account; surface it as a post-delete warning.
    localCloudSecretsCleared = false;
  }

  try {
    await deleteIdentity();
  } catch (cause: unknown) {
    throw new RemoteAccountDeletionError(
      'Melo deleted its cloud and bank-service data, but the sign-in provider did not delete the account. Your local money is unchanged. Retry account deletion while signed in.',
      'identity',
      completedRemoteScopes,
      { cause },
    );
  }

  return {
    cloud: cloudOutcome.value,
    banking: bankingOutcome.value,
    localCloudSecretsCleared,
  };
}
