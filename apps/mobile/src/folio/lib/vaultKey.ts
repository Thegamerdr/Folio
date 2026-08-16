// Vault data key — device ADAPTERS for the pure get-or-create logic in ./vaultKeyLogic. The key is a
// 32-byte AES key (cryptoBlob.ts) held in the OS keystore (Keychain on iOS / Keystore on Android) via
// expo-secure-store, device-only (WHEN_UNLOCKED_THIS_DEVICE_ONLY) so it never leaves the device and
// never lives in JS storage — the "native key boundary" (DATA_FLOW_AND_TRUST_BOUNDARIES.md #2). Random
// bytes come from the OS CSPRNG (expo-crypto).
//
// This file imports native modules, so — exactly like persist.ts — it is NOT Node-imported by vitest
// (expo's source is not rollup-parseable). The LOGIC it wraps is tested via ./vaultKeyLogic; this thin
// adapter is verified by typecheck + on-device.
//
// Device-bound by design: the key does NOT sync to a cloud keychain, so ciphertext on this device can
// only be read on this device. Cross-device recovery is the user's export (D6) / a future cloud vault
// (§16), not this key.

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { getOrCreateVaultKey, type KeyStore } from './vaultKeyLogic';

/** The real, device-only keystore (Keychain / Keystore). Device-bound: never synced to a cloud keychain. */
const secureStore: KeyStore = {
  getItemAsync: (key) => SecureStore.getItemAsync(key),
  setItemAsync: (key, value) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
};

/** Cryptographically-secure random bytes from the OS CSPRNG (expo-crypto). */
async function secureRandomBytes(length: number): Promise<Uint8Array> {
  return Uint8Array.from(await Crypto.getRandomBytesAsync(length));
}

/** Get (or create on first run) the device vault key from the OS keystore + CSPRNG. */
export function getVaultKey(): Promise<Uint8Array> {
  return getOrCreateVaultKey(secureStore, secureRandomBytes);
}
