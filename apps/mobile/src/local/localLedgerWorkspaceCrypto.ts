import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';

import { deriveWorkspacePartitionKey } from '../folio/lib/workspacePartition.js';
import type { PersistedWorkspace } from '../folio/lib/workspaceRoot.js';

/** Pure SQLCipher subkey derivation kept outside React Native so it is directly attack-testable. */
export function deriveLocalLedgerWorkspaceEncryptionKey(
  masterKeyHex: string,
  workspace: Pick<PersistedWorkspace, 'id' | 'encryptedSubkeyId'>,
): string {
  let masterKey: Uint8Array;
  try {
    masterKey = hexToBytes(masterKeyHex);
  } catch {
    throw new Error('Local ledger master key is not valid hexadecimal.');
  }
  return bytesToHex(deriveWorkspacePartitionKey(masterKey, workspace, 'sqlite'));
}
