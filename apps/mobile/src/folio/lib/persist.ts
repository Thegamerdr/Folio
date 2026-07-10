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

import {
  applyMeloImportIfEmpty,
  getPersistBlob,
  getState,
  hasAnyUserData,
  hydrateFromBlob,
  subscribeStore,
  type MeloImportBlob,
} from '@/folio/store';
import { GCM_NONCE_BYTES, decryptBlob, encryptBlob, isEncryptedBlob } from '@/folio/lib/cryptoBlob';
import { getVaultKey } from '@/folio/lib/vaultKey';

/** The on-disk file holding the serialized store state. `v3` tracks the store's
 *  CURRENT_SCHEMA_VERSION so a future schema bump can adopt a new file name
 *  without colliding with an older binary's blob. */
const STATE_FILENAME = 'folio.state.v3.json';
/** Write staging file — every write lands here first, then renames over the main file, so a crash
 *  mid-write can only ever leave a stale-but-complete main blob plus a partial tmp, never a
 *  half-written main blob. */
const STATE_TMP_FILENAME = 'folio.state.v3.json.tmp';
/** One-generation backup, refreshed from the main blob only AFTER it has been read + decrypted +
 *  hydrated successfully (proven good) — never from an unverified write. */
const STATE_BACKUP_FILENAME = 'folio.state.v3.bak.json';
/** Where an unreadable main blob is PARKED (renamed, byte-for-byte) before the app continues with
 *  defaults. Parking is the do-not-destroy guarantee: the next debounced write recreates a fresh
 *  main file, and the user's original bytes survive here for recovery/support instead of being
 *  encrypted over. */
const STATE_PARKED_FILENAME = 'folio.state.v3.unreadable.json';

/** How the last `loadPersisted()` ended. `first-run` = nothing on disk; `ok` = main blob hydrated;
 *  `recovered-backup` = main blob unreadable (parked), the backup hydrated instead — recent
 *  changes may be missing; `unreadable` = neither main nor backup could be read — the app runs on
 *  defaults and the original file is parked, untouched. The shell reads this once at mount to show
 *  a visible notice for the two loss states — silence must never look identical to success. */
export type HydrationOutcome = 'first-run' | 'ok' | 'recovered-backup' | 'unreadable';
let hydrationOutcome: HydrationOutcome = 'first-run';
export function getHydrationOutcome(): HydrationOutcome {
  return hydrationOutcome;
}

/** The archived Melo surface's own encrypted blob (apps/mobile/src/melo,
 *  removed at commit eb34425). Read once, one-time, for data continuity — see
 *  `importMeloBlobIfPresent` below and `store.ts`'s melo-import section. */
const MELO_STATE_FILENAME = 'melo.state.v1.json';
/** Renamed target once the melo blob has been read (successfully or not) so a
 *  future launch never re-attempts the import. The rename itself is the
 *  "never re-import" latch — there is no separate flag to fall out of sync. */
const MELO_STATE_IMPORTED_FILENAME = 'melo.state.v1.imported.json';

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

/** Decode a raw on-disk blob to plaintext JSON, or null when it can't be read. Ciphertext blobs
 *  decrypt with the keystore vault key (GCM auth means a success is also an integrity proof);
 *  legacy plaintext blobs pass through unchanged (migrate-on-read — the next write re-encrypts). */
async function decodeBlob(raw: string): Promise<string | null> {
  if (isEncryptedBlob(raw)) return decryptBlob(raw, await vaultKey());
  return raw;
}

/** True when `plain` is a JSON object `hydrateFromBlob` will actually apply. hydrateFromBlob
 *  swallows malformed input as a silent no-op, so recovery decisions here pre-validate instead of
 *  trusting the call. */
function isHydratable(plain: string): boolean {
  try {
    const parsed: unknown = JSON.parse(plain);
    return parsed !== null && typeof parsed === 'object';
  } catch {
    return false;
  }
}

/** Try one on-disk blob: read → decode → validate → hydrate. Returns true on success. Any
 *  read/keystore/decode failure is a false, never a throw. */
async function tryHydrateFile(uri: string): Promise<boolean> {
  try {
    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const plain = await decodeBlob(raw);
    if (plain === null || !isHydratable(plain)) return false;
    hydrateFromBlob(plain);
    return true;
  } catch {
    return false;
  }
}

/** Move `from` over `to`, replacing any existing target (moveAsync errors on an existing
 *  destination on some platforms, so the target is deleted first — idempotent). Failures are the
 *  caller's to tolerate. */
async function replaceFile(from: string, to: string): Promise<void> {
  await FileSystem.deleteAsync(to, { idempotent: true });
  await FileSystem.moveAsync({ from, to });
}

/**
 * Read the persisted blob off disk (if any) and hydrate the store from it. Call once, before
 * first render. A missing file is the normal first-run case. Failure handling (the do-not-destroy
 * contract):
 *   1. Main blob hydrates → outcome 'ok', and the backup is refreshed from the just-proven-good
 *      main file (the backup is only ever a verified generation, never an unverified write).
 *   2. Main blob exists but can't be read (wrong keystore key after a device restore, tamper,
 *      disk corruption) → it is PARKED under STATE_PARKED_FILENAME — renamed, never deleted,
 *      never written over — then the backup is tried. Backup hydrates → 'recovered-backup'.
 *   3. Neither reads → 'unreadable': the app starts from defaults, the user's original bytes
 *      survive in the parked file, and the shell shows a visible notice (silent empty boot that
 *      then encrypts empty state OVER the old blob was the exact failure this replaces).
 *   4. Main file missing but a tmp/backup exists (crash inside a write's delete→rename window) →
 *      recover from tmp, then backup, before declaring first-run.
 */
export async function loadPersisted(): Promise<void> {
  const dir = FileSystem.documentDirectory;
  const uri = stateFileUri();
  if (uri === null || dir === null) return; // no document directory on this device.
  const tmpUri = `${dir}${STATE_TMP_FILENAME}`;
  const backupUri = `${dir}${STATE_BACKUP_FILENAME}`;
  const parkedUri = `${dir}${STATE_PARKED_FILENAME}`;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      // Crash-window recovery: a write that died between delete(main) and rename(tmp→main) leaves
      // a complete tmp; an older good generation may also sit in the backup. Only after both miss
      // is this a genuine first run.
      if (await tryHydrateFile(tmpUri)) {
        hydrationOutcome = 'ok';
        try {
          await replaceFile(tmpUri, uri); // promote the orphaned-but-good tmp back to main.
        } catch {
          /* promotion failed — next debounced write recreates main anyway. */
        }
        return;
      }
      const backupInfo = await FileSystem.getInfoAsync(backupUri);
      if (backupInfo.exists && (await tryHydrateFile(backupUri))) {
        hydrationOutcome = 'recovered-backup';
        return;
      }
      hydrationOutcome = 'first-run';
      return;
    }

    if (await tryHydrateFile(uri)) {
      hydrationOutcome = 'ok';
      // Refresh the backup ONLY when the hydrate produced real user state. `hydrateFromBlob`
      // can't signal a deep failure: the store's own load() swallows a migrate() throw into
      // DEFAULTS, so a blob that decrypts and parses but breaks migration would read as "ok" here
      // — and copying THAT main file over the backup would clobber the last good generation with
      // a bad one. Gating on hasAnyUserData means a degraded-to-defaults hydrate never overwrites
      // the backup (a genuinely-empty new install has nothing worth backing up anyway).
      try {
        if (hasAnyUserData(getState())) {
          await FileSystem.copyAsync({ from: uri, to: backupUri });
        }
      } catch {
        /* backup refresh is best-effort — never blocks a successful load. */
      }
      return;
    }

    // Main blob exists but is unreadable — park it FIRST so nothing can write over the user's
    // bytes, then fall back to the backup.
    try {
      await replaceFile(uri, parkedUri);
    } catch {
      /* even a failed park keeps going — recovery matters more than the rename. */
    }
    const backupInfo = await FileSystem.getInfoAsync(backupUri);
    if (backupInfo.exists && (await tryHydrateFile(backupUri))) {
      hydrationOutcome = 'recovered-backup';
      return;
    }
    hydrationOutcome = 'unreadable';
  } catch {
    // Unexpected read/keystore failure with a file possibly present: report it visibly rather
    // than letting a silent default boot masquerade as a fresh install.
    hydrationOutcome = 'unreadable';
  }
}

/**
 * One-time data-continuity migration: if the archived Melo surface left its
 * own encrypted blob on disk (`melo.state.v1.json`), and the folio store is
 * still effectively empty (see `store.ts` `isEmptyForMeloImport`), decrypt it
 * and fold the user's payday/income/bills/balance into the folio store. The
 * blob is then RENAMED to `melo.state.v1.imported.json` (whether or not the
 * import actually applied) so this never re-runs — the rename is the latch,
 * not a separate persisted flag. Call once, AFTER `loadPersisted()`, so the
 * emptiness check reads the real hydrated folio state, not fresh defaults.
 *
 * Fully defensive: a missing file, a decrypt failure, a malformed blob, or a
 * failed rename are all silent no-ops. A failed one-time import must never
 * crash the app or block launch — worst case the user's melo data is lost
 * exactly as it already would have been with no migration at all.
 */
export async function importMeloBlobIfPresent(): Promise<void> {
  const dir = FileSystem.documentDirectory;
  if (dir === null) return; // no document directory on this device.
  const uri = `${dir}${MELO_STATE_FILENAME}`;
  const importedUri = `${dir}${MELO_STATE_IMPORTED_FILENAME}`;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return; // nothing to import — already imported, or never existed.
    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const plain = isEncryptedBlob(raw) ? decryptBlob(raw, await vaultKey()) : raw;
    if (plain !== null) {
      const parsed = JSON.parse(plain) as MeloImportBlob;
      if (parsed !== null && typeof parsed === 'object') {
        applyMeloImportIfEmpty(parsed);
      }
    }
  } catch {
    /* decrypt / parse / apply failure — fall through to the rename below so
     * a corrupt or unreadable blob still never re-attempts on next launch. */
  } finally {
    try {
      const stillThere = await FileSystem.getInfoAsync(uri);
      if (stillThere.exists) {
        await FileSystem.moveAsync({ from: uri, to: importedUri });
      }
    } catch {
      /* rename failure — worst case this re-attempts next launch, which is
       * safe: applyMeloImportIfEmpty is itself guarded by isEmptyForMeloImport
       * so a successful prior import can never be double-applied. */
    }
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
  // Writes are SERIALIZED on a promise chain as well as debounced: the staged delete→rename
  // sequence must never interleave with a second in-flight write (write A could delete the main
  // blob, write B could steal A's tmp, and a crash in that window loses the newest generation —
  // the single-call write this replaced could never delete main at all). The chain never rejects
  // (each link swallows its own failure), so one bad write can't wedge every later one.
  let writeChain: Promise<void> = Promise.resolve();
  const writeNow = () => {
    const dir = FileSystem.documentDirectory;
    const uri = stateFileUri();
    if (uri === null || dir === null) return;
    const blob = getPersistBlob();
    // Encrypt-then-write, STAGED: the ciphertext lands in the tmp file first and only a complete
    // tmp is renamed over the main blob, so a crash mid-write can never leave a half-written main
    // file (the pre-crash generation survives; loadPersisted also recovers an orphaned tmp from
    // the delete→rename window). Async (the keystore + CSPRNG are async), fire-and-forget — a
    // disk / quota / keystore failure is swallowed and retried on the next change. A fresh random
    // GCM nonce is drawn per write (GCM requires a unique nonce per key).
    writeChain = writeChain.then(async () => {
      try {
        const key = await vaultKey();
        const iv = Uint8Array.from(await Crypto.getRandomBytesAsync(GCM_NONCE_BYTES));
        const encoded = encryptBlob(blob, key, iv);
        const tmpUri = `${dir}${STATE_TMP_FILENAME}`;
        await FileSystem.writeAsStringAsync(tmpUri, encoded, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await FileSystem.deleteAsync(uri, { idempotent: true });
        await FileSystem.moveAsync({ from: tmpUri, to: uri });
      } catch {
        /* disk / quota / keystore failure — swallow, retry next change. */
      }
    });
  };

  const debounced = makeDebounced(writeNow, WRITE_DEBOUNCE_MS);
  const unsubscribe = subscribeStore(debounced.run);

  return () => {
    debounced.cancel();
    unsubscribe();
  };
}
