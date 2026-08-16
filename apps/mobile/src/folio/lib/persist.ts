// Native persistence adapter — the thin platform layer that makes the PURE
// store (../store) survive an app restart. ENGINES.md §7 store-migration /
// RN_PORT "Store migration".
//
// The store itself stays Node-testable and touches no I/O: it exposes
// `getPersistBlob()` (serialize), `hydrateFromBlob()` (deserialize → migrate →
// publish) and `subscribeStore()` (the non-React change seam). This file is
// where the platform lives. SQLCipher stores the lossless workspace partition and Personal root;
// authenticated document-directory files remain migration/rollback generations.
//
// HARD CONSTRAINTS:
//   • The store stays pure: this file does the side effects, the store does the
//     serialization. No store logic leaks in here.
//   • ENCRYPTED AT REST: the serialized blob is AES-256-GCM encrypted (./cryptoBlob) with a 32-byte
//     data key held in the OS keystore (./vaultKey → expo-secure-store, device-only) BEFORE it
//     touches disk — so the rollback file is ciphertext, not plaintext. A legacy plaintext blob
//     (written before encryption landed) is migrated on read. SQLCipher via OP-SQLite is the Android
//     authority for the exact schema-v11 workspace state and root. Canonical schema v8 now mirrors
//     every durable AppState field and is adopted only after generation binding + inverse parity.
//   • This persists the user's own state to their own device's document directory. Not synced.

import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { createDataVersion, createWorkspaceId, type WorkspaceId } from '@folio/domain';
import { AppState as NativeAppState } from 'react-native';

import {
  applyMeloImportIfEmpty,
  consumeLoadDegraded,
  createEmptyWorkspacePartition,
  getPersistBlob,
  getState,
  hasAnyUserData,
  hydrateFromBlob,
  recordWorkspaceOwnerTransferLeg,
  removeEvidenceDocument,
  rollbackWorkspaceOwnerTransferLeg,
  serializeWorkspacePartition,
  setPartial,
  subscribeStore,
  type AppState,
  type MeloImportBlob,
} from '@/folio/store';
import { GCM_NONCE_BYTES, decryptBlob, encryptBlob, isEncryptedBlob } from '@/folio/lib/cryptoBlob';
import { getVaultKey } from '@/folio/lib/vaultKey';
import { EXPORT_CSV_FILES } from '@/folio/lib/export';
import { assertCanonicalAppStateMoneyProjectionParity } from './canonicalAppStateReadProjection';
import { createCanonicalAppStateProjectionFromPayload } from './canonicalStateProjection';
import {
  acknowledgePendingAppStateCommands,
  snapshotPendingAppStateCommands,
} from './typedCommandBridge';
import { createEmptyLocalLedgerState } from '@/local/localLedger';
import { clearLocalLedgerStorage, saveLocalLedgerState } from '@/local/nativeLedgerStore';
import {
  loadNativeCanonicalSnapshotForGeneration,
  loadNativeWorkspaceManifestGenerations,
  loadNativeWorkspaceStateGenerations,
  quarantineNativeWorkspaceVault,
  saveNativeWorkspaceManifestGeneration,
  saveNativeWorkspaceStateGeneration,
  type NativeWorkspaceVaultGeneration,
} from '@/local/nativeWorkspaceStateStore';
import {
  createWorkspaceManifest,
  deriveWorkspacePartitionKey,
  parseWorkspaceManifest,
  workspacePartitionAssociatedData,
  workspaceEvidenceFilename,
  workspacePartitionRef,
  workspacePartitionFilenames,
  type WorkspaceManifest,
} from './workspacePartition';
import {
  createBusinessWorkspace,
  createPersonalWorkspaceRoot,
  PERSONAL_WORKSPACE_ID,
  type WorkspaceRoot,
} from './workspaceRoot';
import { pickSharedWorkspaceState } from './sharedWorkspaceState';
import type { PersistedWorkspace } from './workspaceRoot';
import {
  getPersistenceRuntimeState,
  classifyPersistenceFailure,
  markPersistenceFailed,
  markPersistenceSaved,
  markPersistenceSaving,
} from './persistenceRuntime';

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
const MANIFEST_FILENAME = 'melo.workspace-manifest.v1.json';
const MANIFEST_TMP_FILENAME = 'melo.workspace-manifest.v1.tmp.json';
const MANIFEST_ASSOCIATED_DATA = new TextEncoder().encode('melo.workspace-manifest.v1');

/** How the last `loadPersisted()` ended. `first-run` = nothing on disk; `ok` = main blob hydrated;
 *  `recovered-backup` = main blob unreadable (parked), the backup hydrated instead — recent
 *  changes may be missing; `recovered-legacy` = an interrupted partition migration was recovered
 *  from the last complete pre-partition copy; `unreadable` = no complete generation could be read —
 *  the app runs on defaults and the original file is parked, untouched. The shell reads this once
 *  at mount to show a visible notice for recovery/loss states — silence must never look identical
 *  to success. */
export type HydrationOutcome =
  | 'first-run'
  | 'ok'
  | 'recovered-backup'
  | 'recovered-legacy'
  | 'recovered-file'
  | 'unreadable';
let hydrationOutcome: HydrationOutcome = 'first-run';
type HydrationSource = 'none' | 'sqlcipher' | 'scoped' | 'legacy';
let hydrationSource: HydrationSource = 'none';
export type MoneyHydrationAuthority = 'exact-app-state' | 'canonical-sqlcipher';
let moneyHydrationAuthority: MoneyHydrationAuthority = 'exact-app-state';
const nativeStateUnreadableWorkspaces = new Set<string>();
export function getHydrationOutcome(): HydrationOutcome {
  return hydrationOutcome;
}
export function getMoneyHydrationAuthority(): MoneyHydrationAuthority {
  return moneyHydrationAuthority;
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
const WRITE_RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000] as const;

let activePersistenceRetry: (() => void) | null = null;
let activePersistenceQuiesce: (() => Promise<() => void>) | null = null;

/** Ask the live persistence controller to retry immediately. */
export function requestPersistenceRetry(): boolean {
  if (activePersistenceRetry === null) return false;
  activePersistenceRetry();
  return true;
}

/**
 * Stop the live debounced writer, cancel its timers and wait for its current SQL transaction before
 * an explicit multi-store operation such as local deletion begins. Store changes made while paused
 * are flushed once the returned idempotent resume function runs.
 */
export async function quiescePersistenceWrites(): Promise<() => void> {
  if (activePersistenceQuiesce === null) return () => undefined;
  return activePersistenceQuiesce();
}

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

function requirePersistWorkspace(workspaceId: WorkspaceId): WorkspaceId {
  const checked = createWorkspaceId(String(workspaceId));
  const workspace = getState().workspaces.find(
    (candidate) => String(candidate.id) === String(checked),
  );
  if (workspace === undefined || workspace.archivedAt !== null) {
    throw new Error(`Local file persistence for workspace ${String(checked)} is not provisioned.`);
  }
  return checked;
}

function legacyStateFileUri(workspaceId: WorkspaceId): string | null {
  requirePersistWorkspace(workspaceId);
  const dir = FileSystem.documentDirectory;
  if (dir === null) return null;
  return `${dir}${STATE_FILENAME}`;
}

type StateFileUris = Readonly<{
  main: string;
  temporary: string;
  backup: string;
  parked: string;
}>;

function legacyStateFileUris(workspaceId: WorkspaceId): StateFileUris | null {
  if (String(workspaceId) !== String(PERSONAL_WORKSPACE_ID)) return null;
  const main = legacyStateFileUri(workspaceId);
  const dir = FileSystem.documentDirectory;
  return main === null || dir === null
    ? null
    : {
        main,
        temporary: `${dir}${STATE_TMP_FILENAME}`,
        backup: `${dir}${STATE_BACKUP_FILENAME}`,
        parked: `${dir}${STATE_PARKED_FILENAME}`,
      };
}

function partitionFileUris(workspaceId: WorkspaceId): StateFileUris | null {
  const dir = FileSystem.documentDirectory;
  if (dir === null) return null;
  const names = workspacePartitionFilenames(workspaceId);
  return {
    main: `${dir}${names.main}`,
    temporary: `${dir}${names.temporary}`,
    backup: `${dir}${names.backup}`,
    parked: `${dir}${names.parked}`,
  };
}

/** The at-rest vault key, fetched from the OS keystore once and cached for the session so a debounced
 *  write never round-trips the keystore. Cleared only by a full app restart. */
let cachedVaultKey: Uint8Array | null = null;
async function vaultKey(): Promise<Uint8Array> {
  if (cachedVaultKey === null) cachedVaultKey = await getVaultKey();
  return cachedVaultKey;
}

function workspaceMetadata(workspaceId: WorkspaceId): PersistedWorkspace {
  const workspace = getState().workspaces.find(
    (candidate) => String(candidate.id) === String(workspaceId),
  );
  if (workspace === undefined || workspace.archivedAt !== null) {
    throw new Error(`Workspace ${String(workspaceId)} is unavailable for persistence.`);
  }
  return workspace;
}

async function workspaceStateKey(workspace: PersistedWorkspace): Promise<Uint8Array> {
  return deriveWorkspacePartitionKey(await vaultKey(), workspace, 'state');
}

/** Decode a raw on-disk blob to plaintext JSON, or null when it can't be read. Ciphertext blobs
 *  decrypt with the keystore vault key (GCM auth means a success is also an integrity proof);
 *  legacy plaintext blobs pass through unchanged (migrate-on-read — the next write re-encrypts). */
async function decodeLegacyBlob(raw: string): Promise<string | null> {
  if (isEncryptedBlob(raw)) return decryptBlob(raw, await vaultKey());
  return raw;
}

async function decodePartitionBlob(
  raw: string,
  workspace: PersistedWorkspace,
): Promise<string | null> {
  if (!isEncryptedBlob(raw)) return null;
  return decryptBlob(
    raw,
    await workspaceStateKey(workspace),
    workspacePartitionAssociatedData(workspace, 'state'),
  );
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

/** Apply one already-integrity-checked plaintext generation through the canonical store migration
 * boundary. SQLCipher and authenticated file recovery share this exact validation path. */
function tryHydratePlaintext(plain: string, workspaceId: WorkspaceId): boolean {
  try {
    if (!isHydratable(plain)) return false;
    hydrateFromBlob(plain, workspaceId);
    if (consumeLoadDegraded()) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Replace only the shipping money slice with its normalized SQLCipher read when that snapshot is
 * bound to this exact generation and reconstructs byte-for-byte equivalent AppState meaning. Any
 * old install, rollback generation, interrupted write, damaged canonical table, or future schema
 * mismatch silently retains the already-verified exact AppState authority.
 */
async function tryApplyBoundCanonicalMoneyProjection(
  workspace: PersistedWorkspace,
  generation: NativeWorkspaceVaultGeneration,
): Promise<boolean> {
  try {
    const canonical = await loadNativeCanonicalSnapshotForGeneration(workspace, generation);
    if (canonical.status !== 'ok') return false;
    const exactState = getState();
    const projection = assertCanonicalAppStateMoneyProjectionParity(
      exactState,
      canonical.snapshot,
      String(workspace.id),
    );
    // Canonical storage requires an account row to bind even a zero balance. That storage-only
    // row must not turn a deliberately empty Business partition into a visible "Main" account on
    // restart. Preserve the exact empty account collection while adopting every other parity-equal
    // canonical field.
    setPartial(
      (exactState.accounts ?? []).length === 0 ? { ...projection, accounts: [] } : projection,
    );
    moneyHydrationAuthority = 'canonical-sqlcipher';
    return true;
  } catch {
    return false;
  }
}

/** Try one on-disk blob: read → decode → validate → hydrate. Returns true on success. Any
 *  read/keystore/decode failure is a false, never a throw. */
async function tryHydrateFile(
  uri: string,
  workspaceId: WorkspaceId,
  decode: (raw: string) => Promise<string | null>,
): Promise<boolean> {
  try {
    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const plain = await decode(raw);
    return plain !== null && tryHydratePlaintext(plain, workspaceId);
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
export async function loadPersisted(workspaceId: WorkspaceId): Promise<void> {
  requirePersistWorkspace(workspaceId);
  const workspace = workspaceMetadata(workspaceId);
  hydrationSource = 'none';
  moneyHydrationAuthority = 'exact-app-state';
  nativeStateUnreadableWorkspaces.delete(String(workspaceId));
  let nativeUnreadable = false;
  const native = await loadNativeWorkspaceStateGenerations(workspace).catch(() => ({
    status: 'unreadable' as const,
    generations: [] as const,
    invalidGenerationCount: 1,
  }));
  if (native.status === 'ok' || native.status === 'recovered') {
    for (const [index, generation] of native.generations.entries()) {
      if (!tryHydratePlaintext(generation.payload, workspaceId)) continue;
      await tryApplyBoundCanonicalMoneyProjection(workspace, generation);
      hydrationSource = 'sqlcipher';
      hydrationOutcome = native.status === 'recovered' || index > 0 ? 'recovered-backup' : 'ok';
      if (
        getState().activeWorkspaceId === workspaceId &&
        (await reconcileMissingEvidenceFiles(workspaceId)) > 0
      ) {
        await persistCurrentStateNow(workspaceId);
      }
      return;
    }
    nativeUnreadable = true;
    nativeStateUnreadableWorkspaces.add(String(workspaceId));
  } else if (native.status === 'unreadable') {
    nativeUnreadable = true;
    nativeStateUnreadableWorkspaces.add(String(workspaceId));
  }

  // Migration/rollback path: authenticated files remain readable until the SQLCipher generation
  // and root manifest have both been committed and exact-readback verified.
  const scoped = partitionFileUris(workspaceId);
  const legacy = legacyStateFileUris(workspaceId);
  if (scoped === null) {
    hydrationOutcome = nativeUnreadable ? 'unreadable' : 'first-run';
    return;
  }
  const hasScopedGeneration = await anyFileExists([scoped.main, scoped.temporary, scoped.backup]);
  const hasLegacyGeneration =
    legacy !== null && (await anyFileExists([legacy.main, legacy.temporary, legacy.backup]));

  if (hasScopedGeneration) {
    hydrationSource = 'scoped';
    hydrationOutcome = await loadPersistedFileSet(scoped, workspaceId, (raw) =>
      decodePartitionBlob(raw, workspace),
    );

    // A crashed first migration can leave only a truncated scoped tmp. That is not a first run and
    // must not hide the last complete pre-partition copy. Recover it, then let the app-start wrapper
    // rewrite a verified scoped generation before removing the complete legacy generations.
    if (hydrationOutcome === 'unreadable' && legacy !== null && hasLegacyGeneration) {
      const legacyOutcome = await loadPersistedFileSet(legacy, workspaceId, decodeLegacyBlob);
      if (legacyOutcome === 'ok' || legacyOutcome === 'recovered-backup') {
        hydrationSource = 'legacy';
        hydrationOutcome = 'recovered-legacy';
      }
    }
  } else if (legacy !== null && hasLegacyGeneration) {
    hydrationSource = 'legacy';
    hydrationOutcome = await loadPersistedFileSet(legacy, workspaceId, decodeLegacyBlob);
  } else {
    hydrationOutcome = nativeUnreadable ? 'unreadable' : 'first-run';
  }
  if (nativeUnreadable && hydrationOutcome !== 'unreadable' && hydrationOutcome !== 'first-run') {
    hydrationOutcome = 'recovered-file';
  }
  if (
    hydrationOutcome !== 'unreadable' &&
    getState().activeWorkspaceId === workspaceId &&
    (await reconcileEvidenceFilesystem(workspaceId)).removedMetadata > 0
  ) {
    // Persist the repaired referential state immediately. Boot has not started the debounced writer
    // yet, so relying on a future unrelated edit could leave stale metadata across another restart.
    await persistCurrentStateNow(workspaceId);
  }
}

/** Remove source metadata/links only when the active workspace's opaque encrypted file is proven
 *  absent. Filesystem errors are not absence and therefore never destroy metadata. This makes a
 *  same-device restore keep its evidence while a cross-device state restore cannot expose dead
 *  “Open source” controls for files that were never part of that backup. */
export async function reconcileMissingEvidenceFiles(workspaceId: WorkspaceId): Promise<number> {
  const checked = requirePersistWorkspace(workspaceId);
  const current = getState();
  if (current.activeWorkspaceId !== checked || current.dataWorkspaceId !== checked) {
    throw new Error(`Workspace ${String(checked)} is not the active data partition.`);
  }
  const dir = FileSystem.documentDirectory;
  if (dir === null) return 0;
  let removed = 0;
  for (const document of current.evidenceDocuments ?? []) {
    let exists: boolean;
    try {
      exists = (
        await FileSystem.getInfoAsync(`${dir}${workspaceEvidenceFilename(checked, document.id)}`)
      ).exists;
    } catch {
      continue;
    }
    if (!exists && removeEvidenceDocument(document.id)) removed++;
  }
  return removed;
}

export type EvidenceFilesystemReconciliation = Readonly<{
  removedMetadata: number;
  removedOrphanFiles: number;
}>;

/**
 * Heal both sides of the encrypted-source relationship after a process kill.
 *
 * A kill before the source file is complete can leave a `.tmp`; a kill after file promotion but
 * before the AppState generation commits can leave an unreferenced encrypted main. At boot the
 * active workspace partition is fully loaded and no import writer is running, so both are safe to
 * remove. Files for every other workspace are left untouched because their metadata partition is
 * not necessarily loaded. Directory-enumeration/deletion failures fail closed and retain bytes.
 */
export async function reconcileEvidenceFilesystem(
  workspaceId: WorkspaceId,
): Promise<EvidenceFilesystemReconciliation> {
  const checked = requirePersistWorkspace(workspaceId);
  const removedMetadata = await reconcileMissingEvidenceFiles(checked);
  const current = getState();
  const dir = FileSystem.documentDirectory;
  if (dir === null) return { removedMetadata, removedOrphanFiles: 0 };

  let filenames: string[];
  try {
    filenames = await FileSystem.readDirectoryAsync(dir);
  } catch {
    return { removedMetadata, removedOrphanFiles: 0 };
  }

  const prefix = `melo.evidence.${workspacePartitionRef(checked)}.`;
  const expected = new Set(
    (current.evidenceDocuments ?? [])
      .filter((document) => document.workspaceId === checked)
      .map((document) => workspaceEvidenceFilename(checked, document.id)),
  );
  let removedOrphanFiles = 0;
  for (const filename of filenames) {
    if (!filename.startsWith(prefix)) continue;
    const opaqueSuffix = filename.slice(prefix.length);
    if (!/^[a-f0-9]{64}\.v1\.fve(?:\.tmp)?$/u.test(opaqueSuffix)) continue;
    if (!filename.endsWith('.tmp') && expected.has(filename)) continue;
    try {
      await FileSystem.deleteAsync(`${dir}${filename}`, { idempotent: true });
      removedOrphanFiles++;
    } catch {
      // Retain unverified bytes. A later boot can retry after the filesystem becomes writable.
    }
  }
  return { removedMetadata, removedOrphanFiles };
}

async function loadPersistedFileSet(
  files: StateFileUris,
  workspaceId: WorkspaceId,
  decode: (raw: string) => Promise<string | null>,
): Promise<HydrationOutcome> {
  try {
    const info = await FileSystem.getInfoAsync(files.main);
    if (!info.exists) {
      // Crash-window recovery: a write that died between delete(main) and rename(tmp→main) leaves
      // a complete tmp; an older good generation may also sit in the backup. Only after both miss
      // is this a genuine first run.
      const temporaryInfo = await FileSystem.getInfoAsync(files.temporary);
      if (temporaryInfo.exists) {
        if (await tryHydrateFile(files.temporary, workspaceId, decode)) {
          try {
            await replaceFile(files.temporary, files.main); // promote the orphaned-but-good tmp.
          } catch {
            /* promotion failed — next debounced write recreates main anyway. */
          }
          return 'ok';
        }
        // Preserve the incomplete staged bytes instead of silently overwriting them on the next
        // retry. If a corrupt main is already parked, that main remains the more important record;
        // this branch has no main, so the staged file can safely occupy the one-generation slot.
        try {
          await replaceFile(files.temporary, files.parked);
        } catch {
          /* a failed park still leaves the original tmp bytes in place. */
        }
      }
      const backupInfo = await FileSystem.getInfoAsync(files.backup);
      if (backupInfo.exists && (await tryHydrateFile(files.backup, workspaceId, decode))) {
        return 'recovered-backup';
      }
      return temporaryInfo.exists || backupInfo.exists ? 'unreadable' : 'first-run';
    }

    if (await tryHydrateFile(files.main, workspaceId, decode)) {
      // Refresh the backup ONLY when the hydrate produced real user state. `hydrateFromBlob`
      // can't signal a deep failure: the store's own load() swallows a migrate() throw into
      // DEFAULTS, so a blob that decrypts and parses but breaks migration would read as "ok" here
      // — and copying THAT main file over the backup would clobber the last good generation with
      // a bad one. Gating on hasAnyUserData means a degraded-to-defaults hydrate never overwrites
      // the backup (a genuinely-empty new install has nothing worth backing up anyway). The
      // consumeLoadDegraded() check above tryHydrateFile's `return true` closes the remaining
      // hole: seeded DEFAULTS passes hasAnyUserData (its demo pots/subs/cycles/transactions are
      // non-empty), so without that check a throwing load() would still look like a healthy 'ok'
      // hydrate here and overwrite the backup with the just-corrupted main file. Now a throwing
      // load() makes tryHydrateFile return false before this block ever runs, so it falls through
      // to the park-main + restore-backup path below instead.
      try {
        if (hasAnyUserData(getState())) {
          await FileSystem.copyAsync({ from: files.main, to: files.backup });
        }
      } catch {
        /* backup refresh is best-effort — never blocks a successful load. */
      }
      return 'ok';
    }

    // Main blob exists but is unreadable — park it FIRST so nothing can write over the user's
    // bytes, then fall back to the backup.
    try {
      await replaceFile(files.main, files.parked);
    } catch {
      /* even a failed park keeps going — recovery matters more than the rename. */
    }
    // A complete tmp is newer than both the just-parked main and the backup: it was fully written
    // before a crash interrupted replacement. Prefer and promote it before falling back a
    // generation. This also recovers the only good copy when main + backup are both corrupt.
    if (await tryHydrateFile(files.temporary, workspaceId, decode)) {
      try {
        await replaceFile(files.temporary, files.main);
      } catch {
        /* the hydrated tmp remains usable for this launch and can be rewritten on the next save. */
      }
      return 'ok';
    }
    const backupInfo = await FileSystem.getInfoAsync(files.backup);
    if (backupInfo.exists && (await tryHydrateFile(files.backup, workspaceId, decode))) {
      return 'recovered-backup';
    }
    return 'unreadable';
  } catch {
    // Unexpected read/keystore failure with a file possibly present: report it visibly rather
    // than letting a silent default boot masquerade as a fresh install.
    return 'unreadable';
  }
}

async function anyFileExists(uris: readonly string[]): Promise<boolean> {
  for (const uri of uris) {
    try {
      if ((await FileSystem.getInfoAsync(uri)).exists) return true;
    } catch {
      // Continue probing the other complete generations before falling back to legacy storage.
    }
  }
  return false;
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
export async function importMeloBlobIfPresent(workspaceId: WorkspaceId): Promise<void> {
  requirePersistWorkspace(workspaceId);
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
export function startPersisting(initialWorkspaceId: WorkspaceId): () => void {
  requirePersistWorkspace(initialWorkspaceId);
  // Writes are SERIALIZED on a promise chain as well as debounced: the staged delete→rename
  // sequence must never interleave with a second in-flight write (write A could delete the main
  // blob, write B could steal A's tmp, and a crash in that window loses the newest generation —
  // the single-call write this replaced could never delete main at all). The chain never rejects
  // (each link swallows its own failure), so one bad write can't wedge every later one.
  let writeChain: Promise<void> = Promise.resolve();
  let stopped = false;
  let pauseDepth = 0;
  let changedWhilePaused = false;
  let retryHandle: ReturnType<typeof setTimeout> | null = null;

  const clearRetry = () => {
    if (retryHandle !== null) {
      clearTimeout(retryHandle);
      retryHandle = null;
    }
  };

  const scheduleRetry = () => {
    if (stopped || retryHandle !== null) return;
    const failures = Math.max(1, getPersistenceRuntimeState().consecutiveFailures);
    const delay = WRITE_RETRY_DELAYS_MS[Math.min(failures - 1, WRITE_RETRY_DELAYS_MS.length - 1)]!;
    retryHandle = setTimeout(() => {
      retryHandle = null;
      writeNow();
    }, delay);
  };

  const writeNow = () => {
    if (stopped || pauseDepth > 0) return;
    const workspaceId = getState().activeWorkspaceId;
    requirePersistWorkspace(workspaceId);
    // Encrypt-then-write, STAGED: the ciphertext lands in the tmp file first and only a complete
    // tmp is renamed over the main blob, so a crash mid-write can never leave a half-written main
    // file (the pre-crash generation survives; loadPersisted also recovers an orphaned tmp from
    // the delete→rename window). Async (the keystore + CSPRNG are async), with failure visibility
    // and bounded retry below. A fresh random GCM nonce is drawn per write.
    writeChain = writeChain.then(async () => {
      try {
        await persistCurrentStateNow(workspaceId);
        clearRetry();
      } catch {
        // The previous complete generation remains intact because writes stage to `.tmp` first.
        // Keep the failure visible and retry even if no further user action occurs.
        scheduleRetry();
      }
    });
  };

  const debounced = makeDebounced(writeNow, WRITE_DEBOUNCE_MS);
  const onStoreChange = () => {
    if (pauseDepth > 0) {
      changedWhilePaused = true;
      return;
    }
    clearRetry();
    debounced.run();
  };
  const unsubscribe = subscribeStore(onStoreChange);
  const flushOnBackground = NativeAppState.addEventListener('change', (status) => {
    if (status === 'active') return;
    clearRetry();
    debounced.cancel();
    writeNow();
  });
  const retryNow = () => {
    clearRetry();
    debounced.cancel();
    writeNow();
  };
  activePersistenceRetry = retryNow;
  const quiesce = async (): Promise<() => void> => {
    pauseDepth += 1;
    clearRetry();
    debounced.cancel();
    await writeChain;
    let resumed = false;
    return () => {
      if (resumed) return;
      resumed = true;
      pauseDepth = Math.max(0, pauseDepth - 1);
      if (pauseDepth === 0 && changedWhilePaused) {
        changedWhilePaused = false;
        writeNow();
      }
    };
  };
  activePersistenceQuiesce = quiesce;
  // Boot-time migration/manifest healing can fail before the controller exists. Retry that visible
  // failure immediately once the normal serialized writer is active; any repeat failure enters the
  // same bounded backoff as an ordinary edit.
  if (getPersistenceRuntimeState().status === 'failed') writeNow();

  return () => {
    stopped = true;
    clearRetry();
    debounced.cancel();
    unsubscribe();
    flushOnBackground.remove();
    if (activePersistenceRetry === retryNow) activePersistenceRetry = null;
    if (activePersistenceQuiesce === quiesce) activePersistenceQuiesce = null;
  };
}

const LOCAL_USER_DATA_FILES = new Set<string>([
  STATE_FILENAME,
  STATE_TMP_FILENAME,
  STATE_BACKUP_FILENAME,
  STATE_PARKED_FILENAME,
  MANIFEST_FILENAME,
  MANIFEST_TMP_FILENAME,
  MELO_STATE_FILENAME,
  MELO_STATE_IMPORTED_FILENAME,
  'folio-export.json',
  'melo-personal-export.json',
  'melo-business-export.json',
  ...EXPORT_CSV_FILES,
  ...EXPORT_CSV_FILES.flatMap((filename) => [
    `melo-personal-${filename}`,
    `melo-business-${filename}`,
  ]),
  'corrections.csv',
  'folio.ics',
  'folio-calendar.ics',
  'folio.widget-snapshot.v1.json',
  'reminders.runtime.v1.json',
]);

function isLocalUserDataFile(filename: string): boolean {
  return (
    LOCAL_USER_DATA_FILES.has(filename) ||
    /^folio-local-export-.*\.json$/u.test(filename) ||
    /^melo-(?:personal|business)-(?:export\.json|.+\.csv)$/u.test(filename) ||
    /^melo\.workspace\.[a-f0-9]{64}\.state\.v1\.(?:json|tmp\.json|bak\.json|unreadable\.json)$/u.test(
      filename,
    ) ||
    /^melo\.evidence\.[a-f0-9]{64}\.[a-f0-9]{64}\.v1\.fve(?:\.tmp)?$/u.test(filename) ||
    /^reminders\.runtime\.v1\.json\.workspace_[a-z0-9_-]+\.json$/u.test(filename)
  );
}

/**
 * Remove every app-owned file that may contain local money/history, including verified backups,
 * parked unreadable ciphertext, plaintext exports, calendar exports and the widget snapshot.
 * Preferences, purchases, the anonymous install meter and cloud-recovery material are separate
 * controls and deliberately remain.
 */
export type ClearLocalArtifactsResult = Readonly<{
  removed: readonly string[];
  failed: readonly string[];
}>;

export async function clearPersistedLocalUserDataArtifacts(
  workspaceId: WorkspaceId,
): Promise<ClearLocalArtifactsResult> {
  requirePersistWorkspace(workspaceId);
  const scopedRuntimeFilenames = getState().workspaces.map(
    (workspace) => `reminders.runtime.v1.json.${String(workspace.id)}.json`,
  );
  const scopedEvidenceFilenames = getState().workspaces.flatMap((workspace) =>
    (getState().evidenceDocuments ?? [])
      .filter((document) => document.workspaceId === workspace.id)
      .flatMap((document) => {
        const filename = workspaceEvidenceFilename(workspace.id, document.id);
        return [filename, `${filename}.tmp`];
      }),
  );
  const dir = FileSystem.documentDirectory;
  if (dir === null) return { removed: [], failed: [] };
  const removed: string[] = [];
  const failed: string[] = [];
  let filenames: string[] = [];
  try {
    filenames = await FileSystem.readDirectoryAsync(dir);
  } catch {
    // Fall back to the complete known list so a directory-enumeration failure does not skip them.
    filenames = [...LOCAL_USER_DATA_FILES, ...scopedRuntimeFilenames, ...scopedEvidenceFilenames];
  }
  for (const filename of filenames.filter(isLocalUserDataFile)) {
    try {
      await FileSystem.deleteAsync(`${dir}${filename}`, { idempotent: true });
      removed.push(filename);
    } catch {
      failed.push(filename);
    }
  }
  const cache = FileSystem.cacheDirectory;
  if (cache !== null && cache !== undefined) {
    try {
      const cacheFilenames = await FileSystem.readDirectoryAsync(cache);
      for (const filename of cacheFilenames.filter((name) =>
        name.startsWith('melo-evidence-view-'),
      )) {
        try {
          await FileSystem.deleteAsync(`${cache}${filename}`, { idempotent: true });
          removed.push(`cache:${filename}`);
        } catch {
          failed.push(`cache:${filename}`);
        }
      }
    } catch {
      // Cache cleanup is best-effort; encrypted originals in documentDirectory remain authoritative.
    }
  }
  return { removed, failed };
}

/** Persist the current in-memory state immediately, using the same encrypted staged write as boot. */
export async function persistCurrentStateNow(workspaceId: WorkspaceId): Promise<void> {
  const files = partitionFileUris(workspaceId);
  const workspace = workspaceMetadata(workspaceId);
  const plaintext = getPersistBlob(workspaceId);
  const persistedAt = new Date().toISOString();
  const canonicalProjection = createCanonicalAppStateProjectionFromPayload(
    plaintext,
    workspace,
    persistedAt,
  );
  // Capture after serializing the exact state. JavaScript mutation is synchronous, so this is the
  // matching command set for that payload; receipts queued while the native write is in flight are
  // excluded and will be handled by the next subscribed save.
  const pendingCommands = snapshotPendingAppStateCommands(workspaceId);
  const manifest = createWorkspaceManifest(getState(), persistedAt);
  markPersistenceSaving(workspaceId, persistedAt);
  try {
    // SQLCipher is the authoritative commit path. The exact current partition is hash-checked and
    // read back inside its transaction before the Personal root is allowed to select it.
    await saveNativeWorkspaceStateGeneration(
      workspace,
      plaintext,
      canonicalProjection.repositorySnapshot,
      pendingCommands,
    );
    // The exact state, canonical mirror, and typed audits are now one read-verified SQL commit.
    // A later manifest/rollback-copy failure must not cause these IDs to be inserted twice.
    acknowledgePendingAppStateCommands(
      workspaceId,
      pendingCommands.map((receipt) => receipt.id),
    );
    await saveNativeWorkspaceManifestGeneration(workspaceMetadata(PERSONAL_WORKSPACE_ID), manifest);
    if (files !== null) {
      try {
        // Keep the authenticated files as rollback/downgrade generations during normalized-table
        // adoption. Their manifest remains last so it never points at a partially replaced copy.
        await writeEncryptedFileSet(
          files,
          plaintext,
          await workspaceStateKey(workspace),
          workspacePartitionAssociatedData(workspace, 'state'),
        );
        await writeWorkspaceManifest(manifest);
        await removeVerifiedLegacyCompleteGenerations(workspaceId, plaintext);
      } catch {
        // The exact SQLCipher state and root are already committed and read-verified. A stale
        // rollback file is retried on the next ordinary save but is never allowed to demote truth.
      }
    }
    markPersistenceSaved(workspaceId, new Date().toISOString());
  } catch (reason: unknown) {
    markPersistenceFailed(workspaceId, reason, new Date().toISOString());
    throw reason;
  }
}

/** Remove complete pre-partition generations only after the just-written scoped main decrypts back
 *  to the exact plaintext that was committed. Keep the legacy parked file: it may contain newer
 *  unreadable bytes preserved for support/recovery. Cleanup is best-effort and never turns a
 *  successful current-format save into a failure. */
async function removeVerifiedLegacyCompleteGenerations(
  workspaceId: WorkspaceId,
  expectedPlaintext: string,
): Promise<void> {
  if (String(workspaceId) !== String(PERSONAL_WORKSPACE_ID)) return;
  const legacy = legacyStateFileUris(workspaceId);
  const scoped = partitionFileUris(workspaceId);
  if (legacy === null || scoped === null) return;
  try {
    const workspace = workspaceMetadata(workspaceId);
    const raw = await FileSystem.readAsStringAsync(scoped.main, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const verified = await decodePartitionBlob(raw, workspace);
    if (verified !== expectedPlaintext) return;
    await Promise.allSettled(
      [legacy.main, legacy.temporary, legacy.backup].map((uri) =>
        FileSystem.deleteAsync(uri, { idempotent: true }),
      ),
    );
  } catch {
    // Retaining a redundant legacy generation is safer than deleting one without verified readback.
  }
}

async function writeEncryptedFileSet(
  files: StateFileUris,
  plaintext: string,
  key: Uint8Array,
  associatedData: Uint8Array,
): Promise<void> {
  const iv = Uint8Array.from(await Crypto.getRandomBytesAsync(GCM_NONCE_BYTES));
  const encoded = encryptBlob(plaintext, key, iv, associatedData);
  await FileSystem.writeAsStringAsync(files.temporary, encoded, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await FileSystem.deleteAsync(files.main, { idempotent: true });
  await FileSystem.moveAsync({ from: files.temporary, to: files.main });
}

async function writeWorkspaceManifest(
  committedManifest?: WorkspaceManifest,
): Promise<WorkspaceManifest | null> {
  const dir = FileSystem.documentDirectory;
  if (dir === null) return null;
  const manifest =
    committedManifest ?? createWorkspaceManifest(getState(), new Date().toISOString());
  const key = await vaultKey();
  const iv = Uint8Array.from(await Crypto.getRandomBytesAsync(GCM_NONCE_BYTES));
  const encoded = encryptBlob(JSON.stringify(manifest), key, iv, MANIFEST_ASSOCIATED_DATA);
  const temporary = `${dir}${MANIFEST_TMP_FILENAME}`;
  const main = `${dir}${MANIFEST_FILENAME}`;
  await FileSystem.writeAsStringAsync(temporary, encoded, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await FileSystem.deleteAsync(main, { idempotent: true });
  await FileSystem.moveAsync({ from: temporary, to: main });
  return manifest;
}

export async function readWorkspaceManifest(): Promise<WorkspaceManifest | null> {
  const dir = FileSystem.documentDirectory;
  if (dir === null) return null;
  const main = `${dir}${MANIFEST_FILENAME}`;
  const temporary = `${dir}${MANIFEST_TMP_FILENAME}`;
  for (const uri of [main, temporary]) {
    try {
      if (!(await FileSystem.getInfoAsync(uri)).exists) continue;
      const raw = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (!isEncryptedBlob(raw)) continue;
      const plaintext = decryptBlob(raw, await vaultKey(), MANIFEST_ASSOCIATED_DATA);
      if (plaintext === null) continue;
      const manifest = parseWorkspaceManifest(plaintext);
      if (manifest === null) continue;
      if (uri === temporary) {
        try {
          await replaceFile(temporary, main);
        } catch {
          // The parsed temporary generation is still usable for this launch.
        }
      }
      return manifest;
    } catch {
      // Try the other staged generation before treating the manifest as absent.
    }
  }
  return null;
}

type WorkspaceManifestResolution = Readonly<{
  manifest: WorkspaceManifest | null;
  source: 'sqlcipher' | 'file' | 'none';
  recovered: boolean;
  nativeUnreadable: boolean;
}>;

/** Resolve the root from Personal SQLCipher first. The authenticated file is a migration/rollback
 * source only; a valid file result is recommitted to SQLCipher after its selected partition loads. */
async function readAuthoritativeWorkspaceManifest(): Promise<WorkspaceManifestResolution> {
  const personal = createPersonalWorkspaceRoot().workspaces[0]!;
  const native = await loadNativeWorkspaceManifestGenerations(personal).catch(() => ({
    status: 'unreadable' as const,
    generations: [] as const,
    invalidGenerationCount: 1,
  }));
  if (native.status === 'ok' || native.status === 'recovered') {
    for (const [index, generation] of native.generations.entries()) {
      const manifest = parseWorkspaceManifest(generation.payload);
      if (manifest === null) continue;
      return {
        manifest,
        source: 'sqlcipher',
        recovered: native.status === 'recovered' || index > 0,
        nativeUnreadable: false,
      };
    }
  }
  const nativeUnreadable = native.status !== 'absent' && native.status !== 'unavailable';
  const fileManifest = await readWorkspaceManifest();
  if (fileManifest !== null) {
    return {
      manifest: fileManifest,
      source: 'file',
      recovered: nativeUnreadable,
      nativeUnreadable,
    };
  }
  return { manifest: null, source: 'none', recovered: false, nativeUnreadable };
}

/** Commit the active registry to Personal SQLCipher, then refresh the authenticated rollback copy. */
async function commitWorkspaceManifest(): Promise<WorkspaceManifest> {
  const manifest = createWorkspaceManifest(getState(), new Date().toISOString());
  await saveNativeWorkspaceManifestGeneration(workspaceMetadata(PERSONAL_WORKSPACE_ID), manifest);
  try {
    await writeWorkspaceManifest(manifest);
  } catch {
    // SQLCipher already committed the root. The authenticated file is a rollback copy and must not
    // make a successful workspace switch look failed or roll memory away from durable authority.
  }
  return manifest;
}

/**
 * Finish the Personal pre-partition -> schema-v11 partition migration. `persistCurrentStateNow`
 * performs exact encrypted readback before removing complete legacy generations. A failure leaves
 * them available for the next launch; the normal persistence controller retries once it starts.
 */
async function healSqlCipherAuthorityAfterFallbackLoad(
  workspaceId: WorkspaceId,
  manifestUnreadable: boolean,
): Promise<void> {
  try {
    await persistCurrentStateNow(workspaceId);
    nativeStateUnreadableWorkspaces.delete(String(workspaceId));
    return;
  } catch (reason: unknown) {
    // Full disk and key-storage failures are not database corruption. Preserve every byte and let
    // the normal persistence controller retry without moving the live database family.
    if (classifyPersistenceFailure(reason) !== 'unknown') return;
  }

  const workspaces = new Map<string, PersistedWorkspace>();
  if (nativeStateUnreadableWorkspaces.has(String(workspaceId))) {
    const workspace = workspaceMetadata(workspaceId);
    workspaces.set(String(workspace.id), workspace);
  }
  if (manifestUnreadable) {
    const personal = workspaceMetadata(PERSONAL_WORKSPACE_ID);
    workspaces.set(String(personal.id), personal);
  }
  if (workspaces.size === 0) return;

  try {
    let movedAny = false;
    for (const workspace of workspaces.values()) {
      const parked = await quarantineNativeWorkspaceVault(workspace);
      movedAny ||= parked.moved.length > 0;
      nativeStateUnreadableWorkspaces.delete(String(workspace.id));
    }
    if (!movedAny) return;
    await persistCurrentStateNow(workspaceId);
  } catch {
    // The authenticated rollback files and any parked database family remain intact. The runtime
    // save notice owns retry guidance; boot never turns a failed repair into blank truth.
  }
}

/** Load the manifest-selected partition, falling back to Personal without exposing a partial root. */
export async function loadPersistedActiveWorkspace(): Promise<WorkspaceId> {
  const manifestResolution = await readAuthoritativeWorkspaceManifest();
  const manifest = manifestResolution.manifest;
  if (manifest === null) {
    await loadPersisted(PERSONAL_WORKSPACE_ID);
    if (hydrationOutcome !== 'unreadable' && hydrationSource !== 'none') {
      if (manifestResolution.nativeUnreadable && hydrationOutcome === 'ok') {
        hydrationOutcome = 'recovered-file';
      }
      await healSqlCipherAuthorityAfterFallbackLoad(
        PERSONAL_WORKSPACE_ID,
        manifestResolution.nativeUnreadable,
      );
    }
    return PERSONAL_WORKSPACE_ID;
  }

  // Make the target metadata available to key derivation while the current Personal partition is
  // still intact. This changes registry metadata only; active/data ownership does not move here.
  if (getState().activeWorkspaceId === PERSONAL_WORKSPACE_ID) {
    setPartial({ workspaces: manifest.workspaces });
  }
  const target = manifest.activeWorkspaceId;
  await loadPersisted(target);
  if (hydrationOutcome !== 'unreadable') {
    const loaded = getState();
    if (loaded.activeWorkspaceId === target && loaded.dataWorkspaceId === target) {
      // The manifest is the commit record. A crash before its final rename may leave a newer
      // registry copy inside an otherwise valid partition; reconcile metadata without discarding
      // the verified workspace-owned rows.
      if (!workspaceStateMatchesManifest(loaded, manifest)) {
        setPartial({ workspaces: manifest.workspaces });
      }
      if (workspaceStateMatchesManifest(getState(), manifest)) {
        const needsAuthorityHeal =
          manifestResolution.source !== 'sqlcipher' ||
          manifestResolution.recovered ||
          hydrationSource !== 'sqlcipher' ||
          hydrationOutcome === 'recovered-backup';
        if (manifestResolution.recovered && hydrationOutcome === 'ok') {
          hydrationOutcome =
            manifestResolution.source === 'sqlcipher' ? 'recovered-backup' : 'recovered-file';
        }
        if (needsAuthorityHeal) {
          await healSqlCipherAuthorityAfterFallbackLoad(
            target,
            manifestResolution.nativeUnreadable,
          );
        }
        return target;
      }
    }
  }

  // A manifest must never make an unreadable/mismatched Business partition look like empty truth.
  // Recover the last Personal generation and keep the visible hydration warning.
  await loadPersisted(PERSONAL_WORKSPACE_ID);
  hydrationOutcome = 'unreadable';
  return PERSONAL_WORKSPACE_ID;
}

export async function createPersistedBusinessWorkspace(name: string): Promise<PersistedWorkspace> {
  return runWithQuiescedPersistence(async () => {
    const current = getState();
    if (current.activeWorkspaceId !== PERSONAL_WORKSPACE_ID) {
      throw new Error('Create the Business workspace from Personal.');
    }
    if (current.workspaces.some((workspace) => workspace.kind === 'business')) {
      throw new Error('Melo supports one Business workspace.');
    }
    const random = Uint8Array.from(await Crypto.getRandomBytesAsync(16));
    const suffix = Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const business = createBusinessWorkspace({
      id: createWorkspaceId(`workspace_business_${suffix}`),
      name,
      encryptedSubkeyId: `workspace-subkey-business-${suffix}-v1`,
    });
    const workspaces = [...current.workspaces, business];
    const businessRoot: WorkspaceRoot = {
      workspaces,
      activeWorkspaceId: business.id,
      dataWorkspaceId: business.id,
    };
    const createdAt = new Date().toISOString();
    const partition = createEmptyWorkspacePartition(businessRoot, business.id, createdAt);

    const previousWorkspaces = current.workspaces;
    try {
      // Stage both physical stores before the registry/manifest can make Business addressable.
      await writePartitionState(business, serializeWorkspacePartition(partition, business.id));
      await saveLocalLedgerState(business, createEmptyLocalLedgerState(createdAt.slice(0, 10)));
      setPartial({ workspaces });
      await persistCurrentStateNow(PERSONAL_WORKSPACE_ID);
    } catch (reason: unknown) {
      setPartial({ workspaces: previousWorkspaces });
      await Promise.allSettled([
        deletePartitionStateFiles(business.id),
        clearLocalLedgerStorage(business),
      ]);
      throw reason;
    }
    return business;
  });
}

/** Provision and open Business as one serialized operation from the workspace UI. */
export async function createAndActivatePersistedBusinessWorkspace(
  name: string,
): Promise<PersistedWorkspace> {
  return runWithQuiescedPersistence(async () => {
    const business = await createPersistedBusinessWorkspace(name);
    await switchPersistedWorkspace(business.id);
    return business;
  });
}

/**
 * After an account-wide local clear, stage one genuinely empty encrypted generation for every
 * retained workspace and commit their manifest last. Keeping the stable workspace IDs prevents
 * still-separate cloud backups or bank consents from becoming orphaned.
 */
export async function persistEmptyWorkspaceSetAfterLocalClear(): Promise<void> {
  const current = getState();
  const createdAt = new Date().toISOString();
  for (const workspace of current.workspaces) {
    const root: WorkspaceRoot = {
      workspaces: current.workspaces,
      activeWorkspaceId: workspace.id,
      dataWorkspaceId: workspace.id,
    };
    const empty = createEmptyWorkspacePartition(root, workspace.id, createdAt);
    await writePartitionState(workspace, serializeWorkspacePartition(empty, workspace.id));
  }
  await commitWorkspaceManifest();
}

export async function switchPersistedWorkspace(workspaceId: WorkspaceId): Promise<void> {
  await runWithQuiescedPersistence(async () => {
    const checked = requirePersistWorkspace(workspaceId);
    const before = getState();
    const sharedState = pickSharedWorkspaceState(before);
    const currentWorkspaceId = before.activeWorkspaceId;
    const expectedWorkspaces = before.workspaces;
    if (checked === currentWorkspaceId) return;
    await persistCurrentStateNow(currentWorkspaceId);
    await loadPersisted(checked);
    if (
      hydrationOutcome === 'unreadable' ||
      getState().activeWorkspaceId !== checked ||
      getState().dataWorkspaceId !== checked
    ) {
      await loadPersisted(currentWorkspaceId);
      setPartial({ workspaces: expectedWorkspaces });
      throw new Error(`Workspace ${String(checked)} could not be opened safely.`);
    }
    setPartial(sharedState);
    // Registry metadata (rename/archive/version) is manifest-owned. Inactive partition blobs may
    // carry an older copy, so reconcile it before the next manifest is committed.
    setPartial({ workspaces: expectedWorkspaces });
    try {
      await persistCurrentStateNow(checked);
      await commitWorkspaceManifest();
    } catch (reason: unknown) {
      await loadPersisted(currentWorkspaceId);
      setPartial({ workspaces: expectedWorkspaces });
      throw reason;
    }
  });
}

export type PersistedOwnerTransferKind =
  | 'draw'
  | 'salary'
  | 'dividend'
  | 'capital-contribution'
  | 'loan-repayment';

export type PersistedOwnerTransferInput = Readonly<{
  direction: 'business-to-personal' | 'personal-to-business';
  amount: number;
  kind: PersistedOwnerTransferKind;
  note?: string;
}>;

/**
 * Write a paired owner transfer to the encrypted Business and Personal partitions.
 *
 * Each leg updates its local cash account and transaction history atomically. If the second
 * partition cannot commit, the first leg is compensated before the original Business workspace is
 * restored. This is deliberately a user-confirmed operation; the companion cannot call it.
 */
export async function recordPersistedOwnerTransfer(
  input: PersistedOwnerTransferInput,
): Promise<Readonly<{ transferId: string }>> {
  if (!(input.amount > 0) || !Number.isFinite(input.amount)) {
    throw new Error('Owner transfer amount must be positive.');
  }
  const initial = getState();
  const business = initial.workspaces.find(
    (workspace) => workspace.id === initial.activeWorkspaceId,
  );
  if (business?.kind !== 'business') {
    throw new Error('Open the Business workspace before moving owner money.');
  }
  const personal = initial.workspaces.find(
    (workspace) => workspace.kind === 'personal' && workspace.archivedAt === null,
  );
  if (!personal) throw new Error('The Personal workspace is unavailable.');

  const transferId = `owner-transfer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const when = new Date().toISOString();
  const note = input.note?.trim();
  const kindLabel = input.kind.replaceAll('-', ' ');
  const businessDirection = input.direction === 'business-to-personal' ? 'out' : 'in';
  const personalDirection = input.direction === 'business-to-personal' ? 'in' : 'out';
  let businessTransactionId: string | null = null;
  let personalTransactionId: string | null = null;

  try {
    businessTransactionId = recordWorkspaceOwnerTransferLeg({
      transferId,
      label:
        input.direction === 'business-to-personal'
          ? `Owner transfer · ${kindLabel} · to Personal${note ? ` · ${note}` : ''}`
          : `Owner transfer · ${kindLabel} · from Personal${note ? ` · ${note}` : ''}`,
      amount: input.amount,
      direction: businessDirection,
      when,
    }).transactionId;
    await persistCurrentStateNow(business.id);

    await switchPersistedWorkspace(personal.id);
    personalTransactionId = recordWorkspaceOwnerTransferLeg({
      transferId,
      label:
        input.direction === 'business-to-personal'
          ? `From Business · ${kindLabel}${note ? ` · ${note}` : ''}`
          : `To Business · ${kindLabel}${note ? ` · ${note}` : ''}`,
      amount: input.amount,
      direction: personalDirection,
      when,
    }).transactionId;
    await persistCurrentStateNow(personal.id);
    await switchPersistedWorkspace(business.id);
    return { transferId };
  } catch (reason: unknown) {
    try {
      if (getState().activeWorkspaceId === personal.id && personalTransactionId) {
        rollbackWorkspaceOwnerTransferLeg(personalTransactionId);
        await persistCurrentStateNow(personal.id);
      }
      if (getState().activeWorkspaceId !== business.id) {
        await switchPersistedWorkspace(business.id);
      }
      if (businessTransactionId) {
        rollbackWorkspaceOwnerTransferLeg(businessTransactionId);
        await persistCurrentStateNow(business.id);
      }
    } catch {
      // Keep the original failure. Durable generation/readback will expose any compensation failure
      // rather than silently claiming the transfer completed.
    }
    if (getState().activeWorkspaceId !== business.id) {
      await switchPersistedWorkspace(business.id).catch(() => undefined);
    }
    throw reason;
  }
}

export async function renamePersistedBusinessWorkspace(
  workspaceId: WorkspaceId,
  name: string,
): Promise<PersistedWorkspace> {
  return runWithQuiescedPersistence(async () => {
    const current = getState();
    const business = requireBusinessWorkspace(current.workspaces, workspaceId, false);
    const validated = createBusinessWorkspace({
      id: business.id,
      name,
      encryptedSubkeyId: business.encryptedSubkeyId,
    });
    const updated = reviseBusinessWorkspace(business, {
      name: validated.name,
      archivedAt: business.archivedAt,
    });
    await commitWorkspaceMetadata(current.workspaces, updated);
    return updated;
  });
}

export async function archivePersistedBusinessWorkspace(
  workspaceId: WorkspaceId,
  archivedAt = new Date().toISOString(),
): Promise<PersistedWorkspace> {
  if (
    !Number.isFinite(Date.parse(archivedAt)) ||
    new Date(archivedAt).toISOString() !== archivedAt
  ) {
    throw new Error('Business archive time must be an ISO date.');
  }
  return runWithQuiescedPersistence(async () => {
    const initial = getState();
    const business = requireBusinessWorkspace(initial.workspaces, workspaceId, false);
    if (initial.activeWorkspaceId === business.id) {
      await switchPersistedWorkspace(PERSONAL_WORKSPACE_ID);
    }
    const current = getState();
    const latest = requireBusinessWorkspace(current.workspaces, workspaceId, false);
    const updated = reviseBusinessWorkspace(latest, { name: latest.name, archivedAt });
    await commitWorkspaceMetadata(current.workspaces, updated);
    await clearArchivedWorkspaceRuntime(updated.id);
    return updated;
  });
}

export async function restorePersistedBusinessWorkspace(
  workspaceId: WorkspaceId,
): Promise<PersistedWorkspace> {
  return runWithQuiescedPersistence(async () => {
    const current = getState();
    const business = requireBusinessWorkspace(current.workspaces, workspaceId, true);
    const updated = reviseBusinessWorkspace(business, { name: business.name, archivedAt: null });
    await commitWorkspaceMetadata(current.workspaces, updated);
    return updated;
  });
}

async function runWithQuiescedPersistence<T>(operation: () => Promise<T>): Promise<T> {
  const resumePersistence = await quiescePersistenceWrites();
  try {
    return await operation();
  } finally {
    resumePersistence();
  }
}

async function commitWorkspaceMetadata(
  previous: readonly PersistedWorkspace[],
  updatedBusiness: PersistedWorkspace,
): Promise<void> {
  const workspaces = previous.map((workspace) =>
    workspace.id === updatedBusiness.id ? updatedBusiness : workspace,
  );
  setPartial({ workspaces });
  try {
    await persistCurrentStateNow(getState().activeWorkspaceId);
  } catch (reason: unknown) {
    setPartial({ workspaces: previous });
    throw reason;
  }
}

function requireBusinessWorkspace(
  workspaces: readonly PersistedWorkspace[],
  workspaceId: WorkspaceId,
  mustBeArchived: boolean,
): PersistedWorkspace {
  const checked = createWorkspaceId(String(workspaceId));
  const workspace = workspaces.find((candidate) => candidate.id === checked);
  if (workspace === undefined || workspace.kind !== 'business') {
    throw new Error(`Business workspace ${String(checked)} is unavailable.`);
  }
  if (mustBeArchived ? workspace.archivedAt === null : workspace.archivedAt !== null) {
    throw new Error(
      mustBeArchived
        ? `Business workspace ${String(checked)} is not archived.`
        : `Business workspace ${String(checked)} is already archived.`,
    );
  }
  return workspace;
}

function reviseBusinessWorkspace(
  workspace: PersistedWorkspace,
  update: Pick<PersistedWorkspace, 'name' | 'archivedAt'>,
): PersistedWorkspace {
  const revision = workspace.version.revision + 1;
  return {
    ...workspace,
    ...update,
    version: {
      revision,
      dataVersion: createDataVersion(`workspace:business:metadata:v${revision}`),
    },
  };
}

async function clearArchivedWorkspaceRuntime(workspaceId: WorkspaceId): Promise<void> {
  try {
    const [{ clearAllMeloNotifications }, runtime] = await Promise.all([
      import('./notifications'),
      import('./notifyRuntimeState'),
    ]);
    await Promise.all([
      clearAllMeloNotifications(workspaceId),
      runtime.saveNotifyRuntimeState(workspaceId, runtime.EMPTY_NOTIFY_RUNTIME_STATE),
    ]);
  } catch {
    // Archival is already committed; runtime cleanup is scoped, idempotent and retried by deletion.
  }
}

async function writePartitionState(workspace: PersistedWorkspace, blob: string): Promise<void> {
  const files = partitionFileUris(workspace.id);
  const canonicalProjection = createCanonicalAppStateProjectionFromPayload(blob, workspace);
  await saveNativeWorkspaceStateGeneration(workspace, blob, canonicalProjection.repositorySnapshot);
  if (files !== null) {
    try {
      await writeEncryptedFileSet(
        files,
        blob,
        await workspaceStateKey(workspace),
        workspacePartitionAssociatedData(workspace, 'state'),
      );
    } catch {
      // SQLCipher is durable; the rollback copy can be refreshed after the workspace is committed.
    }
  }
}

async function deletePartitionStateFiles(workspaceId: WorkspaceId): Promise<void> {
  const files = partitionFileUris(workspaceId);
  if (files === null) return;
  await Promise.all(
    [files.main, files.temporary, files.backup, files.parked].map((uri) =>
      FileSystem.deleteAsync(uri, { idempotent: true }),
    ),
  );
}

function workspaceStateMatchesManifest(state: AppState, manifest: WorkspaceManifest): boolean {
  return (
    state.activeWorkspaceId === manifest.activeWorkspaceId &&
    state.dataWorkspaceId === manifest.activeWorkspaceId &&
    JSON.stringify(state.workspaces) === JSON.stringify(manifest.workspaces)
  );
}
