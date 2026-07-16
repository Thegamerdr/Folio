import { requireNativeModule } from 'expo-modules-core';

export type NativeVaultQuarantine = Readonly<{
  moved: readonly string[];
  parkedMainUri: string;
}>;

type FolioLocalVaultNativeModule = {
  quarantineDatabaseFamily(databaseName: string): Promise<NativeVaultQuarantine>;
  clearQuarantinedDatabaseFamily(databaseName: string): Promise<void>;
};

let nativeModule: FolioLocalVaultNativeModule | null = null;
try {
  nativeModule = requireNativeModule<FolioLocalVaultNativeModule>('FolioLocalVault');
} catch {
  nativeModule = null;
}

/**
 * Copy, hash-verify and then remove an unreadable Android private database family. This throws
 * when the native bridge is unavailable: recovery must leave the live bytes untouched rather than
 * pretending an unsafe rebuild occurred.
 */
export async function quarantinePrivateDatabaseFamily(
  databaseName: string,
): Promise<NativeVaultQuarantine> {
  if (nativeModule === null) {
    throw new Error('The native local-vault quarantine bridge is unavailable.');
  }
  return nativeModule.quarantineDatabaseFamily(databaseName);
}

/** Remove the parked family as part of the user's explicit account-wide local-data deletion. */
export async function clearQuarantinedPrivateDatabaseFamily(databaseName: string): Promise<void> {
  if (nativeModule === null) {
    throw new Error('The native local-vault quarantine bridge is unavailable.');
  }
  await nativeModule.clearQuarantinedDatabaseFamily(databaseName);
}
