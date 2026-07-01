// vaultKey tests — the get-or-create logic for the at-rest data key, exercised through the injectable
// KeyStore + randomBytes seams (no real Keychain/CSPRNG). Node-safe. Proves: a 32-byte key is created
// and persisted on first run, and the SAME key is returned on later calls (stable across restarts).

import { describe, expect, it } from 'vitest';
import { bytesToHex } from '@noble/ciphers/utils.js';

import { VAULT_KEY_ID, getOrCreateVaultKey, type KeyStore } from './vaultKeyLogic';

function fakeStore(
  initial: Record<string, string> = {},
): KeyStore & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItemAsync: (key) => Promise.resolve(data[key] ?? null),
    setItemAsync: (key, value) => {
      data[key] = value;
      return Promise.resolve();
    },
  };
}

const fixedRandom = (length: number): Promise<Uint8Array> =>
  Promise.resolve(new Uint8Array(length).fill(5));

describe('getOrCreateVaultKey', () => {
  it('creates a 32-byte key on first run and persists it (hex) in the keystore', async () => {
    const store = fakeStore();
    const key = await getOrCreateVaultKey(store, fixedRandom);

    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
    expect(store.data[VAULT_KEY_ID]).toBe(bytesToHex(key));
  });

  it('returns the SAME key on the next call (stable across restarts — ignores fresh randomness)', async () => {
    const store = fakeStore();
    const first = await getOrCreateVaultKey(store, fixedRandom);
    // A second call with DIFFERENT randomness must still return the stored key, not a new one.
    const second = await getOrCreateVaultKey(store, (n) =>
      Promise.resolve(new Uint8Array(n).fill(9)),
    );

    expect(bytesToHex(second)).toBe(bytesToHex(first));
  });

  it('regenerates when the stored value is the wrong length (defensive)', async () => {
    const store = fakeStore({ [VAULT_KEY_ID]: 'abcd' }); // 2 bytes — too short
    const key = await getOrCreateVaultKey(store, fixedRandom);

    expect(key.length).toBe(32);
    expect(store.data[VAULT_KEY_ID]).toBe(bytesToHex(key));
  });
});
