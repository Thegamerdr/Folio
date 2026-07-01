// Vault-key get-or-create LOGIC — pure and Node-testable (no expo, no react-native). The device
// adapters (Keychain/Keystore + CSPRNG) live in ./vaultKey and are INJECTED here as `store` +
// `randomBytes`, so this file never imports a native module and vitest can parse + exercise it — the
// same pure/native split persist.ts uses to stay Node-safe. See ./vaultKey for the boundary rationale.

import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';

import { VAULT_KEY_BYTES } from './cryptoBlob';

/** The keystore item id for the vault key. Versioned so a future rotation can adopt a new slot. */
export const VAULT_KEY_ID = 'folio.vaultKey.v1';

/** The minimal keystore surface (get / set a string secret) — the injectable seam. */
export interface KeyStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

/**
 * Get the vault key, creating + persisting it on first run. Returns the 32-byte key. A stored value of
 * the wrong length is treated as absent and regenerated (defensive). Pure given its injected `store`
 * and `randomBytes`.
 */
export async function getOrCreateVaultKey(
  store: KeyStore,
  randomBytes: (length: number) => Promise<Uint8Array>,
): Promise<Uint8Array> {
  const existing = await store.getItemAsync(VAULT_KEY_ID);
  if (existing !== null && existing.length > 0) {
    const bytes = Uint8Array.from(hexToBytes(existing));
    if (bytes.length === VAULT_KEY_BYTES) return bytes;
  }
  const key = await randomBytes(VAULT_KEY_BYTES);
  await store.setItemAsync(VAULT_KEY_ID, bytesToHex(key));
  return key;
}
