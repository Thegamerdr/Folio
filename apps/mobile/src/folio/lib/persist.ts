// Native persistence adapter — the thin platform layer that makes the PURE
// store (../store) survive an app restart. ENGINES.md §7 store-migration /
// RN_PORT "Store migration".
//
// The store itself stays Node-testable and touches no I/O: it exposes
// `getPersistBlob()` (serialize), `hydrateFromBlob()` (deserialize → migrate →
// publish) and `subscribeStore()` (the non-React change seam). This file is
// where the platform lives — it reads/writes that blob to the app's document
// directory with expo-file-system, exactly like the established native pattern
// (lib/exportNative.ts: `expo-file-system/legacy` `documentDirectory` +
// read/write string async).
//
// HARD CONSTRAINTS:
//   • The store stays pure: this file does the side effects, the store does the
//     serialization. No store logic leaks in here.
//   • ENCRYPTED AT REST: the serialized blob is AES-256-GCM encrypted (./cryptoBlob) with a 32-byte
//     data key held in the OS keystore (./vaultKey → expo-secure-store, device-only) BEFORE it
//     touches disk — so the document-directory file is ciphertext, not plaintext. A legacy plaintext
//     blob (written before encryption landed) is migrated on read. This realises the local at-rest +
//     native-key boundary in DATA_FLOW_AND_TRUST_BOUNDARIES.md; full encrypted-SQLite (SQLCipher via
//     op-sqlite) stays the longer-term target, but the plaintext-on-disk gap is closed now.
//   • This persists the user's own state to their own device's document directory. Not synced.

import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import { getPersistBlob, hydrateFromBlob, subscribeStore } from '@/folio/store';
import { GCM_NONCE_BYTES, decryptBlob, encryptBlob, isEncryptedBlob } from '@/folio/lib/cryptoBlob';
import { getVaultKey } from '@/folio/lib/vaultKey';

/** The on-disk file holding the serialized store state. `v3` tracks the store's
 *  CURRENT_SCHEMA_VERSION so a future schema bump can adopt a new file name
 *  without colliding with an older binary's blob. */
const STATE_FILENAME = 'folio.state.v3.json';

/** Debounce window for disk writes. State can change in bursts (a ritual close
 *  touches several slices); coalescing them into one write keeps disk churn low
 *  without a meaningful loss window. */
const WRITE_DEBOUNCE_MS = 400;

/** Pure debounce — returns a wrapper that delays `fn` until `ms` has elapsed
 *  since the last call, plus a `cancel()` to drop a pending call. No React,
 *  no expo: safe to unit-test in Node. `setTimeout`/`clearTimeout` are global
 *  in both RN (Hermes) and Node, so this needs no platform shim. */
export function makeDebounced(fn: () => void, ms: number): { run: () => void; cancel: () => void } {
  let handle: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (handle !== null) {
      clearTimeout(handle);
      handle = null;
    }
  };
  const run = () => {
    cancel();
    handle = setTimeout(() => {
      handle = null;
      fn();
    }, ms);
  };
  return { run, cancel };
}

function stateFileUri(): string | null {
  const dir = FileSystem.documentDirectory;
  if (dir === null) return null;
  return `${dir}${STATE_FILENAME}`;
}

/** The at-rest vault key, fetched from the OS keystore once and cached for the session so a debounced
 *  write never round-trips the keystore. Cleared only by a full app restart. */
let cachedVaultKey: Uint8Array | null = null;
async function vaultKey(): Promise<Uint8Array> {
  if (cachedVaultKey === null) cachedVaultKey = await getVaultKey();
  return cachedVaultKey;
}

/**
 * Read the persisted blob off disk (if any) and hydrate the store from it.
 * A missing file is the normal first-run case — left as a no-op so the store
 * keeps its freshly-seeded defaults. Any read/parse failure is swallowed
 * (matches the store's own tolerant `load()`): a corrupt blob must never block
 * app launch. Call once, before first render.
 */
export async function loadPersisted(): Promise<void> {
  const uri = stateFileUri();
  if (uri === null) return; // no document directory on this device.
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return; // first run — nothing persisted yet.
    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (isEncryptedBlob(raw)) {
      // Ciphertext — decrypt with the keystore vault key, then hydrate. A decrypt failure (wrong key
      // on a restored device / a tampered or corrupt file) keeps the seeded defaults, exactly like the
      // store's tolerant load: the loss surfaces as an empty picture, never garbage and never a crash.
      const plain = decryptBlob(raw, await vaultKey());
      if (plain !== null) hydrateFromBlob(plain);
    } else {
      // Legacy PLAINTEXT blob written before encryption landed — hydrate it once; the next state
      // change re-writes it as ciphertext (migrate-on-read). One-time upgrade path.
      hydrateFromBlob(raw);
    }
  } catch {
    /* read/parse/keystore failure — keep defaults, never block launch. */
  }
}

/**
 * Subscribe to the store and persist its serialized blob to disk on every
 * change, debounced. Returns an unsubscribe function that also cancels any
 * pending write. Call once, after `loadPersisted()`, when the app mounts.
 *
 * Wiring matches the store's own pub/sub: `subscribeStore` fires on every
 * `setPartial`, and `getPersistBlob()` does the serialization at write time.
 */
export function startPersisting(): () => void {
  const writeNow = () => {
    const uri = stateFileUri();
    if (uri === null) return;
    const blob = getPersistBlob();
    // Encrypt-then-write. Async (the keystore + CSPRNG are async), fire-and-forget exactly like the
    // prior plain write — a disk / quota / keystore failure is swallowed and retried on the next
    // change. A fresh random GCM nonce is drawn per write (GCM requires a unique nonce per key).
    void (async () => {
      try {
        const key = await vaultKey();
        const iv = Uint8Array.from(await Crypto.getRandomBytesAsync(GCM_NONCE_BYTES));
        const encoded = encryptBlob(blob, key, iv);
        await FileSystem.writeAsStringAsync(uri, encoded, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch {
        /* disk / quota / keystore failure — swallow, retry next change. */
      }
    })();
  };

  const debounced = makeDebounced(writeNow, WRITE_DEBOUNCE_MS);
  const unsubscribe = subscribeStore(debounced.run);

  return () => {
    debounced.cancel();
    unsubscribe();
  };
}
