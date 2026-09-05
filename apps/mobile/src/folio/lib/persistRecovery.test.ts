// persist.ts recovery-matrix tests — the do-not-destroy contract for the user's ONLY copy of
// their financial data (staged atomic writes, `.bak.json` backup, `.unreadable.json` parking,
// tmp-file crash recovery). `persist.test.ts` deliberately covers only the pure blob helpers
// (persist.ts imports expo-file-system, so it isn't Node-safe on its own); THIS file drives the
// real `loadPersisted()` against a mocked filesystem to exercise every branch of that recovery
// matrix end-to-end. Plan 102.
//
// MOCK PATTERN — copied from ./billing/entitlements.test.ts: `vi.hoisted` state + `vi.mock`
// factories, real store, mocked filesystem. Two things this file needs beyond that exemplar:
//
//   1. persist.ts's imports resolve through the `@/*` path alias (`@/folio/store`,
//      `@/folio/lib/cryptoBlob`, `@/folio/lib/vaultKey`, `@/folio/lib/export`), which this repo's `vitest.config.ts`
//      does NOT resolve (no alias/tsconfig-paths plugin — confirmed empirically: importing
//      persist.ts unmocked fails with "Cannot find package '@/folio/store'"). The fix is to
//      `vi.mock` those exact `@/...` specifiers (matching literally what persist.ts imports) with
//      factories that re-export the REAL modules via the relative path this test file can already
//      resolve (`../store`, `./cryptoBlob`) — vi.mock intercepts by the raw specifier string
//      before Vite's normal resolution runs, so this works even though the alias itself is
//      unconfigured. `./cryptoBlob` is pure `@noble/ciphers` JS (no native module), so it is used
//      REAL, unmocked — every blob in this file is plaintext (never `FVE1:`-prefixed), so
//      encrypt/decrypt is never actually exercised, only imported.
//   2. persist.ts also imports `expo-crypto` directly (for its own `startPersisting` nonce) and,
//      transitively through the real `@/folio/lib/vaultKey`, `expo-secure-store`. Both are real
//      native modules whose JS entry pulls in `expo-modules-core` -> `react-native`, whose
//      `index.js` uses Flow syntax Rollup/Vite cannot parse (confirmed empirically: unmocked, the
//      probe import fails with a Rollup parse error inside `node_modules/react-native/index.js`).
//      `expo-crypto` is mocked directly (enumerated: only `getRandomBytesAsync`, unused by any
//      scenario here since `startPersisting` is never called). `@/folio/lib/vaultKey` is replaced
//      wholesale with a stub `getVaultKey` returning a fixed key — this also means the real
//      vaultKey.ts file (and its `expo-secure-store` import) is never loaded, so that native
//      module needs no mock of its own.
//
// The filesystem mock is a single `Map<uri, string>` (`fsState`) that every mocked
// expo-file-system/legacy function reads/writes — each scenario is just seeding the map (or
// leaving keys absent) before calling `loadPersisted()`, then asserting both the returned
// `getHydrationOutcome()` and the map's resulting shape.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceId } from '@folio/domain';

import type {
  NativeCanonicalSnapshotLoad,
  NativeWorkspaceVaultLoad,
} from '../../local/nativeWorkspaceStateStore';

// ---------------------------------------------------------------------------
// Hoisted mock state — a Map<uri, string> standing in for the document
// directory, plus a one-shot flag used only by scenario (h) to force
// `consumeLoadDegraded()` to report true without needing an actual store
// throw (see that scenario for why: post-101, every array field in load() is
// Array.isArray-guarded, so no shape reachable through the public
// hydrateFromBlob API still throws — confirmed by store.test.ts's own
// "load() degraded-path hardening" suite, which explicitly hands this case to
// this file).
// ---------------------------------------------------------------------------
const {
  fsState,
  FS,
  forceDegraded,
  saveLocalLedgerState,
  clearLocalLedgerStorage,
  loadNativeCanonicalSnapshotForGeneration,
  loadNativeWorkspaceStateGenerations,
  loadNativeWorkspaceManifestGenerations,
  saveNativeWorkspaceStateGeneration,
  saveNativeWorkspaceManifestGeneration,
  quarantineNativeWorkspaceVault,
  clearAllMeloNotifications,
  saveNotifyRuntimeState,
} = vi.hoisted(() => {
  const fsState = new Map<string, string>();
  type MoveCopyArgs = { from: string; to: string };
  const FS = {
    documentDirectory: 'file://doc/',
    cacheDirectory: null,
    EncodingType: { UTF8: 'utf8' },
    readDirectoryAsync: vi.fn(async (): Promise<string[]> => {
      throw new Error('directory enumeration unavailable');
    }),
    getInfoAsync: vi.fn(async (uri: string) => ({ exists: fsState.has(uri) })),
    readAsStringAsync: vi.fn(async (uri: string) => {
      if (!fsState.has(uri)) throw new Error(`ENOENT (mock): ${uri}`);
      return fsState.get(uri) as string;
    }),
    writeAsStringAsync: vi.fn(async (uri: string, content: string) => {
      fsState.set(uri, content);
    }),
    copyAsync: vi.fn(async ({ from, to }: MoveCopyArgs) => {
      if (!fsState.has(from)) throw new Error(`ENOENT (mock): ${from}`);
      fsState.set(to, fsState.get(from) as string);
    }),
    moveAsync: vi.fn(async ({ from, to }: MoveCopyArgs) => {
      if (!fsState.has(from)) throw new Error(`ENOENT (mock): ${from}`);
      fsState.set(to, fsState.get(from) as string);
      fsState.delete(from);
    }),
    deleteAsync: vi.fn(async (uri: string) => {
      fsState.delete(uri); // idempotent: matches `{ idempotent: true }` callers — never throws.
    }),
  };
  const forceDegraded = { next: false };
  return {
    fsState,
    FS,
    forceDegraded,
    saveLocalLedgerState: vi.fn(async () => undefined),
    clearLocalLedgerStorage: vi.fn(async () => undefined),
    loadNativeCanonicalSnapshotForGeneration: vi.fn(
      async (): Promise<NativeCanonicalSnapshotLoad> => ({ status: 'unbound' }),
    ),
    loadNativeWorkspaceStateGenerations: vi.fn(
      async (): Promise<NativeWorkspaceVaultLoad> => ({
        status: 'absent',
        generations: [],
      }),
    ),
    loadNativeWorkspaceManifestGenerations: vi.fn(
      async (): Promise<NativeWorkspaceVaultLoad> => ({
        status: 'absent',
        generations: [],
      }),
    ),
    saveNativeWorkspaceStateGeneration: vi.fn(async () => ({ generation: 1 })),
    saveNativeWorkspaceManifestGeneration: vi.fn(async () => ({ generation: 1 })),
    quarantineNativeWorkspaceVault: vi.fn(async () => ({
      moved: ['file://db.unreadable'],
      parkedMainUri: 'file://db.unreadable',
    })),
    clearAllMeloNotifications: vi.fn(async () => undefined),
    saveNotifyRuntimeState: vi.fn(async () => undefined),
  };
});

vi.mock('expo-file-system/legacy', () => FS);
vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

// Enumerated per the mock-pattern gotcha: a vi.mock factory's namespace proxy throws on access to
// any export not defined here. persist.ts touches only `getRandomBytesAsync` (inside
// `startPersisting`, never called by this file's scenarios), but it is included for completeness.
vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn(async (length: number) => new Uint8Array(length)),
}));

// Real store, loaded via the relative path this file can already resolve, re-exported under the
// literal `@/folio/store` specifier persist.ts imports — see file header point 1.
vi.mock('@/folio/store', async () => {
  const actual = await import('../store');
  return {
    ...actual,
    // Wrapped so scenario (h) can force a single "degraded" read without needing a real store
    // throw (which post-101 guards make unreachable through the public API). Every other test
    // passes straight through to the real, read-once `consumeLoadDegraded`.
    consumeLoadDegraded: (): boolean => {
      if (forceDegraded.next) {
        forceDegraded.next = false;
        return true;
      }
      return actual.consumeLoadDegraded();
    },
  };
});

// Pure @noble/ciphers JS, no native module — real, unmocked, just re-exported under the alias
// specifier persist.ts imports. See file header point 1.
vi.mock('@/folio/lib/cryptoBlob', async () => await import('./cryptoBlob'));

// Wholesale stub: the real vaultKey.ts imports expo-secure-store (native), which this replacement
// avoids ever loading. No scenario here reaches an encrypted blob, so the exact key value is
// irrelevant beyond being a valid 32-byte Uint8Array.
vi.mock('@/folio/lib/vaultKey', () => ({
  getVaultKey: vi.fn(async () => new Uint8Array(32)),
}));

// Pure export contract, re-exported under the alias used by persist.ts. Persistence only needs the
// stable CSV filename list so local-data deletion can remove every app-owned plaintext export.
vi.mock('@/folio/lib/export', async () => await import('./export'));
vi.mock('@/local/localLedger', async () => await import('../../local/localLedger'));
vi.mock('@/local/nativeLedgerStore', () => ({
  saveLocalLedgerState,
  clearLocalLedgerStorage,
}));
vi.mock('@/local/nativeWorkspaceStateStore', () => ({
  loadNativeCanonicalSnapshotForGeneration,
  loadNativeWorkspaceStateGenerations,
  loadNativeWorkspaceManifestGenerations,
  saveNativeWorkspaceStateGeneration,
  saveNativeWorkspaceManifestGeneration,
  quarantineNativeWorkspaceVault,
}));
vi.mock('./notifications', () => ({ clearAllMeloNotifications }));
vi.mock('./notifyRuntimeState', () => ({
  EMPTY_NOTIFY_RUNTIME_STATE: {
    version: 1,
    localDay: '',
    sentToday: 0,
    dangerSentToday: 0,
    lastSnapshot: null,
  },
  saveNotifyRuntimeState,
}));

import {
  addEvidenceDocument,
  addTransaction,
  createEmptyWorkspacePartition,
  getPersistBlob,
  getState,
  resetAll,
  resetToEmpty,
  setPartial,
} from '../store';
import {
  archivePersistedBusinessWorkspace,
  clearPersistedLocalUserDataArtifacts,
  commitCloudSyncProjection,
  createAndActivatePersistedBusinessWorkspace,
  createPersistedBusinessWorkspace,
  getHydrationOutcome,
  getMoneyHydrationAuthority,
  loadPersisted,
  loadPersistedActiveWorkspace,
  persistEmptyWorkspaceSetAfterLocalClear,
  persistCurrentStateNow,
  quiescePersistenceWrites,
  readWorkspaceManifest,
  recoverAndActivatePersistedBusinessWorkspace,
  reconcileEvidenceFilesystem,
  reconcileMissingEvidenceFiles,
  renamePersistedBusinessWorkspace,
  restorePersistedBusinessWorkspace,
  restorePersistedWorkspacePayload,
  startPersisting,
  switchPersistedWorkspace,
} from './persist';
import { createCloudSyncLocalState } from './cloudSyncLocal';
import { createShareableCloudSyncProjection } from './cloudSyncProjection';
import { serializeCloudSyncLocalState } from './cloudSyncLocal';
import { workspaceBackupRef } from './cloudBackup';
import { workspaceEvidenceFilename, workspacePartitionFilenames } from './workspacePartition';
import { createBusinessWorkspace, PERSONAL_WORKSPACE_ID } from './workspaceRoot';
import {
  classifyPersistenceDiagnostic,
  getPersistenceRuntimeState,
  resetPersistenceRuntimeState,
} from './persistenceRuntime';
import { snapshotPendingAppStateCommands } from './typedCommandBridge';
import { createCanonicalAppStateProjectionFromPayload } from './canonicalStateProjection';
import { readCanonicalAppStateMoneyProjection } from './canonicalAppStateReadProjection';

const DOC_DIR = 'file://doc/';
const mainUri = `${DOC_DIR}folio.state.v3.json`;
const tmpUri = `${DOC_DIR}folio.state.v3.json.tmp`;
const backupUri = `${DOC_DIR}folio.state.v3.bak.json`;
const parkedUri = `${DOC_DIR}folio.state.v3.unreadable.json`;
const partitionNames = workspacePartitionFilenames(PERSONAL_WORKSPACE_ID);
const partitionMainUri = `${DOC_DIR}${partitionNames.main}`;
const partitionTmpUri = `${DOC_DIR}${partitionNames.temporary}`;
const partitionBackupUri = `${DOC_DIR}${partitionNames.backup}`;
const partitionParkedUri = `${DOC_DIR}${partitionNames.parked}`;
const manifestUri = `${DOC_DIR}melo.workspace-manifest.v1.json`;
const manifestTmpUri = `${DOC_DIR}melo.workspace-manifest.v1.tmp.json`;

beforeEach(() => {
  fsState.clear();
  vi.clearAllMocks();
  loadNativeWorkspaceStateGenerations.mockResolvedValue({
    status: 'absent',
    generations: [],
  });
  loadNativeCanonicalSnapshotForGeneration.mockResolvedValue({ status: 'unbound' });
  loadNativeWorkspaceManifestGenerations.mockResolvedValue({
    status: 'absent',
    generations: [],
  });
  saveNativeWorkspaceStateGeneration.mockResolvedValue({ generation: 1 });
  saveNativeWorkspaceManifestGeneration.mockResolvedValue({ generation: 1 });
  forceDegraded.next = false;
  resetPersistenceRuntimeState();
  resetAll();
});

describe('loadPersisted — scaffold sanity', () => {
  it('the mocked filesystem + real store wire together (trivial first-run load)', async () => {
    await loadPersisted(PERSONAL_WORKSPACE_ID);
    expect(getHydrationOutcome()).toBe('first-run');
  });

  it('refuses an unprovisioned Business partition before reading any file', async () => {
    await expect(
      loadPersisted('workspace_business_injected' as typeof PERSONAL_WORKSPACE_ID),
    ).rejects.toThrow(/not provisioned/i);
    expect(FS.getInfoAsync).not.toHaveBeenCalled();
  });
});

describe('SQLCipher workspace authority', () => {
  function generation(payload: string, generationNumber = 1) {
    return {
      generation: generationNumber,
      workspaceId: String(PERSONAL_WORKSPACE_ID),
      schemaVersion: 11,
      payload,
      payloadSha256: 'a'.repeat(64),
      committedAt: '2026-07-16T04:00:00.000Z',
    };
  }

  it('preserves a newer local edit that arrives during a remote projection commit', async () => {
    setPartial({
      onboarding: { done: true, name: 'Replay race', payday: 23, monthlyIncome: 2400 },
      nextYouNote: 'local before replay',
    });
    const before = getPersistBlob(PERSONAL_WORKSPACE_ID);
    const beforeProjection = createShareableCloudSyncProjection(before, PERSONAL_WORKSPACE_ID);
    const nextProjection = createShareableCloudSyncProjection(
      JSON.stringify({ ...JSON.parse(before), nextYouNote: 'remote replay' }),
      PERSONAL_WORKSPACE_ID,
    );
    const local = {
      ...createCloudSyncLocalState('a'.repeat(64), beforeProjection, 1, 'b'.repeat(64)),
      enabled: true,
      baselineProjection: nextProjection,
    };
    let release!: () => void;
    const saveGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    saveNativeWorkspaceStateGeneration.mockImplementationOnce(async () => {
      await saveGate;
      return { generation: 2 };
    });
    const commit = commitCloudSyncProjection(
      PERSONAL_WORKSPACE_ID,
      nextProjection,
      local,
      () => true,
    );
    await vi.waitFor(() => expect(saveNativeWorkspaceStateGeneration).toHaveBeenCalled());
    setPartial({ nextYouNote: 'newer local edit' });
    release();
    const result = await commit;
    expect(getState().nextYouNote).toBe('newer local edit');
    expect(result.conflictRecords).toHaveLength(1);
    expect(result.conflictRecords[0]?.remoteState).toContain('remote replay');
    expect(saveNativeWorkspaceStateGeneration).toHaveBeenCalledTimes(2);
  });

  it('coalesces never-sent ordinary-save intents from the first durable base', async () => {
    setPartial({
      onboarding: { done: true, name: 'Coalesce', payday: 23, monthlyIncome: 2400 },
      nextYouNote: 'base',
    });
    const workspaceRef = workspaceBackupRef(PERSONAL_WORKSPACE_ID);
    const basePayload = getPersistBlob(PERSONAL_WORKSPACE_ID);
    const baseProjection = createShareableCloudSyncProjection(basePayload, PERSONAL_WORKSPACE_ID);
    let durablePayload = basePayload;
    let durableSync = serializeCloudSyncLocalState({
      ...createCloudSyncLocalState(workspaceRef, baseProjection, 1, 'b'.repeat(64)),
      enabled: true,
    });
    saveNativeWorkspaceStateGeneration.mockImplementation(async (...args: any[]) => {
      const builder = args[5] as
        | ((input: {
            previousPayload: string;
            previousSyncStatePayload: string;
            nextPayload: string;
          }) => string | undefined)
        | undefined;
      if (builder !== undefined) {
        const nextSync = builder({
          previousPayload: durablePayload,
          previousSyncStatePayload: durableSync,
          nextPayload: args[1],
        });
        if (nextSync !== undefined) durableSync = nextSync;
      }
      durablePayload = args[1] as string;
      return { generation: 1 };
    });
    setPartial({ nextYouNote: 'first edit' });
    await persistCurrentStateNow(PERSONAL_WORKSPACE_ID);
    const first = JSON.parse(durableSync) as {
      pendingDeltas: Array<{ deviceSequence: number }>;
      pendingBaseProjection: string | null;
      nextSequence: number;
    };
    expect(first.pendingDeltas).toHaveLength(1);
    expect(first.pendingBaseProjection).toBe(baseProjection);
    expect(first.pendingDeltas[0]?.deviceSequence).toBe(1);
    setPartial({ nextYouNote: 'second edit' });
    await persistCurrentStateNow(PERSONAL_WORKSPACE_ID);
    const second = JSON.parse(durableSync) as {
      pendingDeltas: Array<{ deviceSequence: number; plaintext: string }>;
      pendingBaseProjection: string | null;
      nextSequence: number;
    };
    expect(second.pendingDeltas).toHaveLength(1);
    expect(second.pendingDeltas[0]?.deviceSequence).toBe(1);
    expect(second.nextSequence).toBe(2);
    expect(second.pendingBaseProjection).toBe(baseProjection);
    expect(second.pendingDeltas[0]?.plaintext).toContain('second edit');
  });

  it('hydrates the newest verified SQLCipher generation without consulting a stale file', async () => {
    setPartial({
      onboarding: { done: true, name: 'SQLCipher truth', payday: 23, monthlyIncome: 2400 },
      currentBalance: {
        amount: 2468,
        source: 'user-entered',
        confidence: 'corrected',
        setAt: '2026-07-16T04:00:00.000Z',
      },
    });
    const nativePayload = getPersistBlob(PERSONAL_WORKSPACE_ID);
    resetToEmpty();
    fsState.set(partitionMainUri, 'stale-and-unreadable-file-copy');
    loadNativeWorkspaceStateGenerations.mockResolvedValue({
      status: 'ok',
      generations: [generation(nativePayload)],
      invalidGenerationCount: 0,
    });

    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('ok');
    expect(getMoneyHydrationAuthority()).toBe('exact-app-state');
    expect(getState().onboarding.name).toBe('SQLCipher truth');
    expect(getState().currentBalance.amount).toBe(2468);
    expect(FS.readAsStringAsync).not.toHaveBeenCalledWith(partitionMainUri, expect.anything());
  });

  it('adopts the canonical money read only when it is bound and parity-equal to exact AppState', async () => {
    resetToEmpty();
    setPartial({
      onboarding: { done: true, name: 'Canonical reader', payday: 23, monthlyIncome: 2400 },
      currentBalance: {
        amount: 2468.13,
        source: 'pdf-derived',
        confidence: 'statement-derived',
        setAt: '2026-07-16T04:00:00.000Z',
      },
    });
    const nativePayload = getPersistBlob(PERSONAL_WORKSPACE_ID);
    const workspace = getState().workspaces[0]!;
    const snapshot = createCanonicalAppStateProjectionFromPayload(
      nativePayload,
      workspace,
      '2026-07-16T04:00:00.000Z',
    ).repositorySnapshot;
    const selected = generation(nativePayload);
    resetToEmpty();
    loadNativeWorkspaceStateGenerations.mockResolvedValue({
      status: 'ok',
      generations: [selected],
      invalidGenerationCount: 0,
    });
    loadNativeCanonicalSnapshotForGeneration.mockResolvedValue({
      status: 'ok',
      generation: selected.generation,
      canonicalSnapshotSha256: 'b'.repeat(64),
      snapshot,
    });

    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(loadNativeCanonicalSnapshotForGeneration).toHaveBeenCalledWith(workspace, selected);
    expect(readCanonicalAppStateMoneyProjection(snapshot, String(PERSONAL_WORKSPACE_ID))).toEqual({
      currentBalance: getState().currentBalance,
      accounts: getState().accounts,
      transactions: getState().transactions,
      pots: getState().pots,
      potLedger: getState().potLedger,
      subs: getState().subs,
      cancelledSubs: getState().cancelledSubs,
      subPaused: getState().subPaused,
      subOverrides: getState().subOverrides,
      cycles: getState().cycles,
      debts: getState().debts,
      onboarding: getState().onboarding,
      nextYouNote: getState().nextYouNote,
      tightPointGoal: getState().tightPointGoal,
      droppedTransactionCount: getState().droppedTransactionCount,
      moneyMode: getState().moneyMode,
      bufferAmount: getState().bufferAmount,
      modeExtras: getState().modeExtras,
      household: getState().household,
      spendHold: getState().spendHold,
      whatIfHolds: getState().whatIfHolds,
      business: getState().business,
      calendarEvents: getState().calendarEvents,
      incomeSources: getState().incomeSources,
      plans: getState().plans,
      edits: getState().edits,
      ignoredReviewSigs: getState().ignoredReviewSigs,
      aiReads: getState().aiReads,
      aiReadCache: getState().aiReadCache,
      whatChangedSeenISO: getState().whatChangedSeenISO,
      lens: getState().lens,
      melo: getState().melo,
      tinyWins: getState().tinyWins,
      meloPrimerSeen: getState().meloPrimerSeen,
      lastOpenedAt: getState().lastOpenedAt,
      oneMoveHistory: getState().oneMoveHistory,
      meloDismissLog: getState().meloDismissLog,
      ignoredBankExternalIds: getState().ignoredBankExternalIds,
      dismissedIncomeSignals: getState().dismissedIncomeSignals,
      dismissedBillSignals: getState().dismissedBillSignals,
      dismissedDriftSignals: getState().dismissedDriftSignals,
      dismissedAnnualSignals: getState().dismissedAnnualSignals,
      merchantCategories: getState().merchantCategories,
      statementImports: getState().statementImports,
      evidenceDocuments: getState().evidenceDocuments,
      timelineEvents: getState().timelineEvents,
      reviewQueue: getState().reviewQueue,
      reviewQueueSpillover: getState().reviewQueueSpillover,
    });
    expect(getMoneyHydrationAuthority()).toBe('canonical-sqlcipher');
    expect(getState().currentBalance).toEqual({
      amount: 2468.13,
      source: 'pdf-derived',
      confidence: 'statement-derived',
      setAt: '2026-07-16T04:00:00.000Z',
    });
  });

  it('does not expose the canonical binding account inside an intentionally empty Business workspace', async () => {
    resetToEmpty();
    const business = await createPersistedBusinessWorkspace('Empty Studio');
    await switchPersistedWorkspace(business.id);
    expect(getState().accounts).toEqual([]);

    const nativePayload = getPersistBlob(business.id);
    const snapshot = createCanonicalAppStateProjectionFromPayload(
      nativePayload,
      business,
      '2026-07-16T04:00:00.000Z',
    ).repositorySnapshot;
    const selected = generation(nativePayload);
    loadNativeWorkspaceStateGenerations.mockResolvedValue({
      status: 'ok',
      generations: [selected],
      invalidGenerationCount: 0,
    });
    loadNativeCanonicalSnapshotForGeneration.mockResolvedValue({
      status: 'ok',
      generation: selected.generation,
      canonicalSnapshotSha256: 'd'.repeat(64),
      snapshot,
    });

    await loadPersisted(business.id);

    expect(getMoneyHydrationAuthority()).toBe('canonical-sqlcipher');
    expect(getState().activeWorkspaceId).toBe(business.id);
    expect(getState().accounts).toEqual([]);
  });

  it('keeps exact AppState authority when a bound canonical snapshot is not money-parity equal', async () => {
    resetToEmpty();
    setPartial({
      onboarding: { done: true, name: 'Parity guard', payday: 23, monthlyIncome: 2400 },
      currentBalance: {
        amount: 999,
        source: 'user-entered',
        confidence: 'corrected',
        setAt: '2026-07-16T04:00:00.000Z',
      },
    });
    const workspace = getState().workspaces[0]!;
    const mismatchedSnapshot = createCanonicalAppStateProjectionFromPayload(
      getPersistBlob(PERSONAL_WORKSPACE_ID),
      workspace,
      '2026-07-16T04:00:00.000Z',
    ).repositorySnapshot;
    setPartial({
      currentBalance: {
        amount: 123,
        source: 'user-entered',
        confidence: 'corrected',
        setAt: '2026-07-16T04:00:00.000Z',
      },
    });
    const selected = generation(getPersistBlob(PERSONAL_WORKSPACE_ID));
    resetToEmpty();
    loadNativeWorkspaceStateGenerations.mockResolvedValue({
      status: 'ok',
      generations: [selected],
      invalidGenerationCount: 0,
    });
    loadNativeCanonicalSnapshotForGeneration.mockResolvedValue({
      status: 'ok',
      generation: selected.generation,
      canonicalSnapshotSha256: 'c'.repeat(64),
      snapshot: mismatchedSnapshot,
    });

    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getMoneyHydrationAuthority()).toBe('exact-app-state');
    expect(getState().currentBalance.amount).toBe(123);
  });

  it('surfaces recovery when SQLCipher falls back to its previous verified generation', async () => {
    setPartial({
      onboarding: { done: true, name: 'Previous SQL generation', payday: 23, monthlyIncome: 2100 },
    });
    const previousPayload = getPersistBlob(PERSONAL_WORKSPACE_ID);
    resetToEmpty();
    loadNativeWorkspaceStateGenerations.mockResolvedValue({
      status: 'recovered',
      generations: [generation(previousPayload, 4)],
      invalidGenerationCount: 1,
    });

    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('recovered-backup');
    expect(getMoneyHydrationAuthority()).toBe('exact-app-state');
    expect(getState().onboarding.name).toBe('Previous SQL generation');
  });

  it('recovers from authenticated files when SQLCipher is unreadable and recommits exact state', async () => {
    resetToEmpty();
    setPartial({
      onboarding: { done: true, name: 'Rollback copy', payday: 21, monthlyIncome: 1900 },
      currentBalance: {
        amount: 913,
        source: 'user-entered',
        confidence: 'rough',
        setAt: '2026-07-16T04:00:00.000Z',
      },
    });
    const expectedPayload = getPersistBlob(PERSONAL_WORKSPACE_ID);
    await persistCurrentStateNow(PERSONAL_WORKSPACE_ID);
    vi.clearAllMocks();
    loadNativeWorkspaceStateGenerations.mockResolvedValue({
      status: 'unreadable',
      generations: [],
      invalidGenerationCount: 1,
    });
    loadNativeWorkspaceManifestGenerations.mockResolvedValue({
      status: 'unreadable',
      generations: [],
      invalidGenerationCount: 1,
    });
    resetToEmpty();

    await expect(loadPersistedActiveWorkspace()).resolves.toBe(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('recovered-file');
    expect(getState().onboarding.name).toBe('Rollback copy');
    expect(getState().currentBalance.amount).toBe(913);
    expect(saveNativeWorkspaceStateGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ id: PERSONAL_WORKSPACE_ID }),
      getPersistBlob(PERSONAL_WORKSPACE_ID),
      expect.objectContaining({
        workspaceId: PERSONAL_WORKSPACE_ID,
        collections: expect.objectContaining({ workspaces: expect.any(Array) }),
      }),
      [],
    );
    expect(JSON.parse(getPersistBlob(PERSONAL_WORKSPACE_ID))).toEqual(JSON.parse(expectedPayload));
    expect(saveNativeWorkspaceManifestGeneration).toHaveBeenCalledTimes(1);
  });

  it('parks a corrupt SQLCipher family only after verified fallback and failed in-place repair', async () => {
    resetToEmpty();
    setPartial({
      onboarding: { done: true, name: 'Corruption recovery', payday: 20, monthlyIncome: 1800 },
      tightPointGoal: 77,
    });
    await persistCurrentStateNow(PERSONAL_WORKSPACE_ID);
    vi.clearAllMocks();
    loadNativeWorkspaceStateGenerations.mockResolvedValue({
      status: 'unreadable',
      generations: [],
      invalidGenerationCount: 1,
    });
    loadNativeWorkspaceManifestGenerations.mockResolvedValue({
      status: 'unreadable',
      generations: [],
      invalidGenerationCount: 1,
    });
    saveNativeWorkspaceStateGeneration
      .mockRejectedValueOnce(new Error('file is not a database'))
      .mockResolvedValue({ generation: 1 });
    resetToEmpty();

    await expect(loadPersistedActiveWorkspace()).resolves.toBe(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('recovered-file');
    expect(getState().onboarding.name).toBe('Corruption recovery');
    expect(getState().tightPointGoal).toBe(77);
    expect(quarantineNativeWorkspaceVault).toHaveBeenCalledTimes(1);
    expect(saveNativeWorkspaceStateGeneration).toHaveBeenCalledTimes(2);
    expect(getPersistenceRuntimeState()).toMatchObject({ status: 'saved' });
  });

  it('does not advance the rollback file when the authoritative SQLCipher save fails', async () => {
    saveNativeWorkspaceStateGeneration.mockRejectedValueOnce(new Error('SQLITE_FULL'));

    await expect(persistCurrentStateNow(PERSONAL_WORKSPACE_ID)).rejects.toThrow(/SQLITE_FULL/);

    expect(saveNativeWorkspaceManifestGeneration).not.toHaveBeenCalled();
    expect(FS.writeAsStringAsync).not.toHaveBeenCalled();
    expect(getPersistenceRuntimeState()).toMatchObject({ status: 'failed' });
  });

  it('does not demote a verified SQLCipher commit when the rollback file cannot refresh', async () => {
    FS.writeAsStringAsync.mockRejectedValueOnce(new Error('rollback copy unavailable'));

    await expect(persistCurrentStateNow(PERSONAL_WORKSPACE_ID)).resolves.toBeUndefined();

    expect(saveNativeWorkspaceStateGeneration).toHaveBeenCalledTimes(1);
    expect(saveNativeWorkspaceManifestGeneration).toHaveBeenCalledTimes(1);
    expect(getPersistenceRuntimeState()).toMatchObject({ status: 'saved' });
  });
});

describe('retained evidence filesystem reconciliation', () => {
  const evidenceId = 'evidence_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

  function addLinkedEvidence() {
    addEvidenceDocument({
      id: evidenceId,
      filename: 'statement.pdf',
      mediaType: 'application/pdf',
      byteSize: 1024,
      addedAtISO: '2026-07-15T12:00:00.000Z',
      sourceType: 'document',
      extractionStatus: 'read',
      storageState: 'encrypted-device-vault',
    });
    addTransaction({
      merchant: 'Linked row',
      amount: -12,
      category: 'other',
      source: 'manual',
      sourceEvidenceId: evidenceId,
    });
  }

  it('prunes missing metadata and links but keeps confirmed money records', async () => {
    addLinkedEvidence();

    await expect(reconcileMissingEvidenceFiles(PERSONAL_WORKSPACE_ID)).resolves.toBe(1);
    expect(getState().evidenceDocuments).toEqual([]);
    expect(getState().transactions.find((row) => row.merchant === 'Linked row')).not.toHaveProperty(
      'sourceEvidenceId',
    );
  });

  it('keeps metadata and links when the opaque encrypted original exists', async () => {
    addLinkedEvidence();
    fsState.set(
      `${DOC_DIR}${workspaceEvidenceFilename(PERSONAL_WORKSPACE_ID, evidenceId)}`,
      'FVB1:opaque',
    );

    await expect(reconcileMissingEvidenceFiles(PERSONAL_WORKSPACE_ID)).resolves.toBe(0);
    expect(getState().evidenceDocuments).toHaveLength(1);
    expect(getState().transactions.find((row) => row.merchant === 'Linked row')).toMatchObject({
      sourceEvidenceId: evidenceId,
    });
  });

  it('cleans active-workspace import crash orphans without touching another workspace', async () => {
    addLinkedEvidence();
    const linkedFilename = workspaceEvidenceFilename(PERSONAL_WORKSPACE_ID, evidenceId);
    const orphanId = 'evidence_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const orphanFilename = workspaceEvidenceFilename(PERSONAL_WORKSPACE_ID, orphanId);
    const otherWorkspaceFilename = workspaceEvidenceFilename(
      'workspace_business_import_recovery',
      'evidence_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    fsState.set(`${DOC_DIR}${linkedFilename}`, 'FVB1:linked');
    fsState.set(`${DOC_DIR}${linkedFilename}.tmp`, 'FVB1:interrupted-replacement');
    fsState.set(`${DOC_DIR}${orphanFilename}`, 'FVB1:promoted-before-metadata');
    fsState.set(`${DOC_DIR}${otherWorkspaceFilename}`, 'FVB1:other-workspace');
    FS.readDirectoryAsync.mockResolvedValueOnce([
      linkedFilename,
      `${linkedFilename}.tmp`,
      orphanFilename,
      otherWorkspaceFilename,
    ]);

    await expect(reconcileEvidenceFilesystem(PERSONAL_WORKSPACE_ID)).resolves.toEqual({
      removedMetadata: 0,
      removedOrphanFiles: 2,
    });
    expect(fsState.get(`${DOC_DIR}${linkedFilename}`)).toBe('FVB1:linked');
    expect(fsState.has(`${DOC_DIR}${linkedFilename}.tmp`)).toBe(false);
    expect(fsState.has(`${DOC_DIR}${orphanFilename}`)).toBe(false);
    expect(fsState.get(`${DOC_DIR}${otherWorkspaceFilename}`)).toBe('FVB1:other-workspace');
  });

  it('retains possible orphan bytes when directory enumeration is unavailable', async () => {
    const orphanFilename = workspaceEvidenceFilename(
      PERSONAL_WORKSPACE_ID,
      'evidence_cccccccccccccccccccccccccccccccc',
    );
    fsState.set(`${DOC_DIR}${orphanFilename}`, 'FVB1:retain-on-error');

    await expect(reconcileEvidenceFilesystem(PERSONAL_WORKSPACE_ID)).resolves.toEqual({
      removedMetadata: 0,
      removedOrphanFiles: 0,
    });
    expect(fsState.get(`${DOC_DIR}${orphanFilename}`)).toBe('FVB1:retain-on-error');
  });

  it('uses live evidence metadata as the deletion fallback when directory enumeration fails', async () => {
    addLinkedEvidence();
    const filename = workspaceEvidenceFilename(PERSONAL_WORKSPACE_ID, evidenceId);
    fsState.set(`${DOC_DIR}${filename}`, 'FVB1:opaque');

    const result = await clearPersistedLocalUserDataArtifacts(PERSONAL_WORKSPACE_ID);

    expect(result.failed).toEqual([]);
    expect(result.removed).toContain(filename);
    expect(fsState.has(`${DOC_DIR}${filename}`)).toBe(false);
  });
});

describe('loadPersisted — recovery matrix', () => {
  it('a. first run (no files on disk) -> first-run, no writes', async () => {
    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('first-run');
    expect(fsState.size).toBe(0);
    expect(FS.writeAsStringAsync).not.toHaveBeenCalled();
    expect(FS.copyAsync).not.toHaveBeenCalled();
    expect(FS.moveAsync).not.toHaveBeenCalled();
  });

  it('b. healthy main with real user data -> ok, backup refreshed from main', async () => {
    // Real (user-created) transaction + pot — non-seed source, mirrors persist.test.ts's own
    // round-trip technique so purgeSeedIfReal has nothing ambiguous to strip.
    setPartial({
      transactions: [
        {
          id: 'rec-1',
          when: '2026-07-01T00:00:00.000Z',
          merchant: 'Real Merchant',
          amount: -12.5,
          category: 'fun',
          source: 'manual',
        },
      ],
      pots: [{ id: 'rec-pot', name: 'Real Pot', saved: 10, goal: 100, perWeek: 5, accent: false }],
    });
    const blob = getPersistBlob();
    fsState.set(mainUri, blob);

    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('ok');
    expect(fsState.get(backupUri)).toBe(fsState.get(mainUri));
  });

  it('c. healthy main, EMPTY state (no user data) -> ok, backup NOT written', async () => {
    resetToEmpty();
    const blob = getPersistBlob();
    fsState.set(mainUri, blob);

    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('ok');
    expect(fsState.has(backupUri)).toBe(false);
  });

  it('d. corrupt main + good backup -> recovered-backup, main PARKED with original bytes preserved', async () => {
    const corruptMain = 'not valid json {{{';
    fsState.set(mainUri, corruptMain);

    setPartial({ tightPointGoal: 555 });
    const backupBlob = getPersistBlob();
    fsState.set(backupUri, backupBlob);

    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('recovered-backup');
    // The PARK happened — not just the outcome enum: the corrupt main's original bytes must
    // survive, byte-for-byte, at the parked filename, and main itself must be gone (moved, not
    // copied).
    expect(fsState.get(parkedUri)).toBe(corruptMain);
    expect(fsState.has(mainUri)).toBe(false);
    // State came from the backup.
    expect(getState().tightPointGoal).toBe(555);
  });

  it('e. corrupt main + corrupt backup -> unreadable, main parked, backup left untouched', async () => {
    const corruptMain = 'not valid json main';
    const corruptBackup = 'not valid json backup';
    fsState.set(mainUri, corruptMain);
    fsState.set(backupUri, corruptBackup);

    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('unreadable');
    expect(fsState.get(parkedUri)).toBe(corruptMain);
    expect(fsState.has(mainUri)).toBe(false);
    // Backup was read (attempted) but never written to — still its original, still-corrupt bytes.
    expect(fsState.get(backupUri)).toBe(corruptBackup);
  });

  it('f. main missing + orphaned good tmp -> promoted to main, ok', async () => {
    setPartial({ tightPointGoal: 42 });
    const blob = getPersistBlob();
    fsState.set(tmpUri, blob);

    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('ok');
    expect(fsState.get(mainUri)).toBe(blob);
    expect(fsState.has(tmpUri)).toBe(false); // promoted, not copied — tmp is gone.
    expect(getState().tightPointGoal).toBe(42);
  });

  it('g. main missing + backup good -> recovered-backup', async () => {
    setPartial({ tightPointGoal: 7 });
    const blob = getPersistBlob();
    fsState.set(backupUri, blob);

    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('recovered-backup');
    expect(getState().tightPointGoal).toBe(7);
    expect(fsState.has(mainUri)).toBe(false); // no promotion into main on this path.
  });

  it('g2. unreadable orphaned tmp with no backup is preserved and never misclassified as first-run', async () => {
    const corruptTmp = 'truncated staged generation';
    fsState.set(tmpUri, corruptTmp);

    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('unreadable');
    expect(fsState.get(parkedUri)).toBe(corruptTmp);
    expect(fsState.has(tmpUri)).toBe(false);
    expect(fsState.has(mainUri)).toBe(false);
  });

  it('g3. good staged generation wins when main and backup are both corrupt', async () => {
    setPartial({ tightPointGoal: 314 });
    const goodTmp = getPersistBlob();
    const corruptMain = 'corrupt main generation';
    const corruptBackup = 'corrupt backup generation';
    fsState.set(mainUri, corruptMain);
    fsState.set(tmpUri, goodTmp);
    fsState.set(backupUri, corruptBackup);

    resetAll();
    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('ok');
    expect(getState().tightPointGoal).toBe(314);
    expect(fsState.get(parkedUri)).toBe(corruptMain);
    expect(fsState.get(mainUri)).toBe(goodTmp);
    expect(fsState.has(tmpUri)).toBe(false);
    expect(fsState.get(backupUri)).toBe(corruptBackup);
  });

  it('g3a. newer good staged generation wins over an older good backup after main corruption', async () => {
    setPartial({ tightPointGoal: 271 });
    const goodBackup = getPersistBlob();
    setPartial({ tightPointGoal: 314 });
    const goodTmp = getPersistBlob();
    fsState.set(mainUri, 'corrupt main generation');
    fsState.set(tmpUri, goodTmp);
    fsState.set(backupUri, goodBackup);

    resetAll();
    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('ok');
    expect(getState().tightPointGoal).toBe(314);
    expect(fsState.get(mainUri)).toBe(goodTmp);
    expect(fsState.get(backupUri)).toBe(goodBackup);
  });

  it('g3b. falls back to a good backup when corrupt main and staged generations coexist', async () => {
    setPartial({ tightPointGoal: 808 });
    const goodBackup = getPersistBlob();
    const corruptMain = 'corrupt main generation';
    const corruptTmp = 'corrupt staged generation';
    fsState.set(mainUri, corruptMain);
    fsState.set(tmpUri, corruptTmp);
    fsState.set(backupUri, goodBackup);

    resetAll();
    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('recovered-backup');
    expect(getState().tightPointGoal).toBe(808);
    expect(fsState.get(parkedUri)).toBe(corruptMain);
    expect(fsState.get(tmpUri)).toBe(corruptTmp);
  });

  it('g3c. parks a corrupt orphaned stage then falls back when main is missing', async () => {
    setPartial({ tightPointGoal: 909 });
    const goodBackup = getPersistBlob();
    const corruptTmp = 'corrupt staged generation';
    fsState.set(tmpUri, corruptTmp);
    fsState.set(backupUri, goodBackup);

    resetAll();
    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('recovered-backup');
    expect(getState().tightPointGoal).toBe(909);
    expect(fsState.get(parkedUri)).toBe(corruptTmp);
    expect(fsState.has(tmpUri)).toBe(false);
  });

  it('g3d. reports unreadable while preserving every corrupt generation when none recover', async () => {
    const corruptMain = 'corrupt main generation';
    const corruptTmp = 'corrupt staged generation';
    const corruptBackup = 'corrupt backup generation';
    fsState.set(mainUri, corruptMain);
    fsState.set(tmpUri, corruptTmp);
    fsState.set(backupUri, corruptBackup);

    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('unreadable');
    expect(fsState.get(parkedUri)).toBe(corruptMain);
    expect(fsState.get(tmpUri)).toBe(corruptTmp);
    expect(fsState.get(backupUri)).toBe(corruptBackup);
  });

  it('g4. healthy user-data main replaces a corrupt backup with the verified generation', async () => {
    setPartial({
      transactions: [
        {
          id: 'backup-repair-row',
          when: '2026-07-16T04:00:00.000Z',
          merchant: 'Backup repair',
          amount: -8,
          category: 'other',
          source: 'manual',
        },
      ],
    });
    const goodMain = getPersistBlob();
    fsState.set(mainUri, goodMain);
    fsState.set(backupUri, 'corrupt backup');

    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('ok');
    expect(fsState.get(backupUri)).toBe(goodMain);
    expect(getState().transactions.map((row) => row.id)).toContain('backup-repair-row');
  });

  // ---------------------------------------------------------------------------
  // Scenario (h), post-101: main parses but load() degrades internally.
  //
  // Per the plan's fallback chain: try a wrong-shaped `subs` field first: it no longer throws
  // (guarded), which store.test.ts's own "load() degraded-path hardening" suite already
  // documents ("this suite cannot craft a blob that throws THROUGH the public hydrateFromBlob
  // API") and explicitly hands the end-to-end wiring test to THIS file. So (h) is split in two:
  // h1 confirms the guard (documents the shape is unreachable, doesn't just assert and stop),
  // h2 forces `consumeLoadDegraded()` via the hoisted override to exercise persist.ts's actual
  // wiring — the exact bug 101 fixed (a throwing-but-swallowed load() looking like a healthy
  // 'ok' and clobbering the backup with the just-corrupted main).
  // ---------------------------------------------------------------------------

  it('h1. a wrong-shaped subs field no longer throws load() (Array.isArray guard) — confirms the shape is unreachable', async () => {
    const blob = JSON.parse(getPersistBlob()) as Record<string, unknown>;
    blob.subs = 42; // pre-101 this reached load()'s catch; the Step-1 guard degrades it in place.
    fsState.set(mainUri, JSON.stringify(blob));

    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('ok');
    expect(fsState.has(parkedUri)).toBe(false);
  });

  it('h2. consumeLoadDegraded()===true after a syntactically-valid main is treated as unreadable: parked + backup recovery, backup NOT clobbered', async () => {
    const mainBlob = getPersistBlob(); // valid JSON, hydrates cleanly on its own.
    fsState.set(mainUri, mainBlob);

    setPartial({ tightPointGoal: 99 });
    const goodBackupBlob = getPersistBlob();
    fsState.set(backupUri, goodBackupBlob);

    forceDegraded.next = true; // simulates load() having thrown internally during this hydrate.

    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('recovered-backup');
    // Main was syntactically fine but still parked, original bytes intact — proves persist.ts
    // treats the degraded flag as unreadable rather than trusting the hydrate.
    expect(fsState.get(parkedUri)).toBe(mainBlob);
    expect(fsState.has(mainUri)).toBe(false);
    // The bug 101 fixed: the backup must NOT be overwritten with the just-degraded main.
    expect(fsState.get(backupUri)).toBe(goodBackupBlob);
    expect(getState().tightPointGoal).toBe(99); // hydrated from the backup, not the degraded main.
  });
});

describe('save failure visibility and retry', () => {
  it('acknowledges only typed receipts included in a successful native commit', async () => {
    resetToEmpty();
    addTransaction({
      id: 'txn-command-retry',
      when: '2026-07-16T11:00:00.000Z',
      merchant: 'Retry private merchant',
      amount: -17.25,
      category: 'other',
      source: 'manual',
    });
    const queued = snapshotPendingAppStateCommands(PERSONAL_WORKSPACE_ID);
    expect(queued).toHaveLength(1);
    saveNativeWorkspaceStateGeneration.mockRejectedValueOnce(new Error('native write failed'));

    await expect(persistCurrentStateNow(PERSONAL_WORKSPACE_ID)).rejects.toThrow(/native write/i);
    expect(snapshotPendingAppStateCommands(PERSONAL_WORKSPACE_ID)).toEqual(queued);

    await persistCurrentStateNow(PERSONAL_WORKSPACE_ID);
    expect(snapshotPendingAppStateCommands(PERSONAL_WORKSPACE_ID)).toEqual([]);
    expect(saveNativeWorkspaceStateGeneration).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: PERSONAL_WORKSPACE_ID }),
      expect.any(String),
      expect.objectContaining({ workspaceId: PERSONAL_WORKSPACE_ID }),
      queued,
    );
  });

  it('leaves a command queued when it arrives during an in-flight native save', async () => {
    resetToEmpty();
    addTransaction({
      id: 'txn-before-save',
      when: '2026-07-16T11:05:00.000Z',
      merchant: 'Before save',
      amount: -2,
      category: 'other',
      source: 'manual',
    });
    const atSaveStart = snapshotPendingAppStateCommands(PERSONAL_WORKSPACE_ID);
    saveNativeWorkspaceStateGeneration.mockImplementationOnce(async () => {
      addTransaction({
        id: 'txn-during-save',
        when: '2026-07-16T11:06:00.000Z',
        merchant: 'During save',
        amount: -3,
        category: 'other',
        source: 'manual',
      });
      return { generation: 1 };
    });

    await persistCurrentStateNow(PERSONAL_WORKSPACE_ID);

    expect(snapshotPendingAppStateCommands(PERSONAL_WORKSPACE_ID)).toMatchObject([
      { command: { input: { commandId: expect.any(String) } } },
    ]);
    expect(snapshotPendingAppStateCommands(PERSONAL_WORKSPACE_ID)[0]?.changedEntityIds).toEqual([
      'txn-during-save',
    ]);
    expect(saveNativeWorkspaceStateGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ id: PERSONAL_WORKSPACE_ID }),
      expect.any(String),
      expect.any(Object),
      atSaveStart,
    );
  });

  it('keeps the last complete generation, reports ENOSPC and clears the failure after retry', async () => {
    resetToEmpty();
    setPartial({ tightPointGoal: 40 });
    await persistCurrentStateNow(PERSONAL_WORKSPACE_ID);
    const lastGoodGeneration = fsState.get(partitionMainUri);

    setPartial({ tightPointGoal: 75 });
    saveNativeWorkspaceStateGeneration.mockRejectedValueOnce(
      Object.assign(new Error('No space left on device'), { code: 'ENOSPC' }),
    );

    await expect(persistCurrentStateNow(PERSONAL_WORKSPACE_ID)).rejects.toThrow(/no space/i);
    expect(fsState.get(partitionMainUri)).toBe(lastGoodGeneration);
    expect(getPersistenceRuntimeState()).toMatchObject({
      status: 'failed',
      failureKind: 'storage',
      consecutiveFailures: 1,
    });

    await persistCurrentStateNow(PERSONAL_WORKSPACE_ID);
    expect(getPersistenceRuntimeState()).toMatchObject({
      status: 'saved',
      failureKind: null,
      consecutiveFailures: 0,
    });
    expect(fsState.get(partitionMainUri)).not.toBe(lastGoodGeneration);

    resetAll();
    await loadPersisted(PERSONAL_WORKSPACE_ID);
    expect(getState().tightPointGoal).toBe(75);
  });

  it('reduces native persistence failures to value-free diagnostic codes', () => {
    expect(classifyPersistenceDiagnostic(new Error('database is locked'))).toBe('database-locked');
    expect(classifyPersistenceDiagnostic(new Error('no such column: private_value'))).toBe(
      'database-schema',
    );
    expect(
      classifyPersistenceDiagnostic(
        new Error('SQLCipher canonical projection failed exact readback verification.'),
      ),
    ).toBe('canonical-projection');
    expect(classifyPersistenceDiagnostic(new Error('owner amount 123.45'))).toBe('unknown');
  });
});

describe('workspace partition migration', () => {
  function businessRecoveryFixture() {
    const business = createBusinessWorkspace({
      id: createWorkspaceId('workspace_business_recovery_test'),
      name: 'Recovered Studio',
      encryptedSubkeyId: 'workspace-subkey-business-recovery-test-v1',
    });
    const partition = createEmptyWorkspacePartition(
      {
        workspaces: [getState().workspaces[0]!, business],
        activeWorkspaceId: business.id,
        dataWorkspaceId: business.id,
      },
      business.id,
      '2026-09-05T12:00:00.000Z',
    );
    return {
      business,
      raw: JSON.stringify({ ...partition, nextYouNote: 'Recovered Business only' }),
    };
  }

  it('clean Business recovery activates durable data without replacing existing Personal', async () => {
    resetToEmpty();
    setPartial({ nextYouNote: 'Keep Personal' });
    const { business, raw } = businessRecoveryFixture();
    await recoverAndActivatePersistedBusinessWorkspace(raw, business.id);
    expect(getState().activeWorkspaceId).toBe(business.id);
    expect(getState().nextYouNote).toBe('Recovered Business only');
    expect(getHydrationOutcome()).not.toBe('unreadable');
    await switchPersistedWorkspace(PERSONAL_WORKSPACE_ID);
    expect(getState().nextYouNote).toBe('Keep Personal');
    expect(getState().workspaces).toHaveLength(2);
    const personalBackup = JSON.parse(getPersistBlob(PERSONAL_WORKSPACE_ID));
    personalBackup.workspaces = [getState().workspaces[0]!];
    personalBackup.nextYouNote = 'Restored Personal';
    await restorePersistedWorkspacePayload(JSON.stringify(personalBackup), PERSONAL_WORKSPACE_ID);
    expect(getState().workspaces).toHaveLength(2);
    await switchPersistedWorkspace(business.id);
    expect(getState().nextYouNote).toBe('Recovered Business only');
    await switchPersistedWorkspace(PERSONAL_WORKSPACE_ID);
    expect(getState().nextYouNote).toBe('Restored Personal');
  });

  it('clean Business recovery retains staged bytes after a post-manifest switch failure', async () => {
    resetToEmpty();
    setPartial({ nextYouNote: 'Keep Personal' });
    const { business, raw } = businessRecoveryFixture();
    saveNativeWorkspaceStateGeneration
      .mockResolvedValueOnce({ generation: 1 })
      .mockResolvedValueOnce({ generation: 1 })
      .mockRejectedValueOnce(new Error('synthetic disk failure after manifest'));
    await expect(recoverAndActivatePersistedBusinessWorkspace(raw, business.id)).rejects.toThrow(
      /disk failure/,
    );
    expect(getState().activeWorkspaceId).toBe(PERSONAL_WORKSPACE_ID);
    expect(getState().nextYouNote).toBe('Keep Personal');
    expect(fsState.get(`${DOC_DIR}${workspacePartitionFilenames(business.id).main}`)).toMatch(
      /^FVE1:/,
    );
    expect(clearLocalLedgerStorage).not.toHaveBeenCalled();
    await expect(readWorkspaceManifest()).resolves.toMatchObject({
      workspaces: [{ kind: 'personal' }, { id: business.id }],
    });
    await switchPersistedWorkspace(business.id);
    expect(getState().nextYouNote).toBe('Recovered Business only');
  });
  it('migrates a complete legacy Personal generation only after encrypted partition readback', async () => {
    resetToEmpty();
    setPartial({
      transactions: [
        {
          id: 'legacy-migration-row',
          when: '2026-07-16T04:15:00.000Z',
          merchant: 'Legacy migration',
          amount: -21,
          category: 'other',
          source: 'manual',
        },
      ],
    });
    fsState.set(mainUri, getPersistBlob());
    resetAll();

    await expect(loadPersistedActiveWorkspace()).resolves.toBe(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('ok');
    expect(getState().transactions.map((row) => row.id)).toContain('legacy-migration-row');
    expect(fsState.get(partitionMainUri)).toMatch(/^FVE1:/u);
    expect(fsState.get(manifestUri)).toMatch(/^FVE1:/u);
    expect(fsState.has(mainUri)).toBe(false);
    expect(fsState.has(tmpUri)).toBe(false);
    expect(fsState.has(backupUri)).toBe(false);
  });

  it('recovers an interrupted migration from legacy, parks the corrupt staged bytes and self-heals', async () => {
    resetToEmpty();
    setPartial({ tightPointGoal: 271 });
    fsState.set(mainUri, getPersistBlob());
    const corruptScopedTmp = 'truncated encrypted partition';
    fsState.set(partitionTmpUri, corruptScopedTmp);
    resetAll();

    await expect(loadPersistedActiveWorkspace()).resolves.toBe(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('recovered-legacy');
    expect(getState().tightPointGoal).toBe(271);
    expect(fsState.get(partitionParkedUri)).toBe(corruptScopedTmp);
    expect(fsState.get(partitionMainUri)).toMatch(/^FVE1:/u);
    expect(fsState.get(manifestUri)).toMatch(/^FVE1:/u);
    expect(fsState.has(mainUri)).toBe(false);

    resetAll();
    await expect(loadPersistedActiveWorkspace()).resolves.toBe(PERSONAL_WORKSPACE_ID);
    expect(getHydrationOutcome()).toBe('ok');
    expect(getState().tightPointGoal).toBe(271);
  });

  it('keeps legacy data after migration ENOSPC and retries through the serialized writer', async () => {
    resetToEmpty();
    setPartial({ tightPointGoal: 919 });
    fsState.set(mainUri, getPersistBlob());
    resetAll();
    saveNativeWorkspaceStateGeneration.mockRejectedValueOnce(
      Object.assign(new Error('No space left on device'), { code: 'ENOSPC' }),
    );

    await expect(loadPersistedActiveWorkspace()).resolves.toBe(PERSONAL_WORKSPACE_ID);
    expect(getState().tightPointGoal).toBe(919);
    expect(getPersistenceRuntimeState()).toMatchObject({
      status: 'failed',
      failureKind: 'storage',
    });
    expect(fsState.has(mainUri)).toBe(true);

    const stop = startPersisting(PERSONAL_WORKSPACE_ID);
    await vi.waitFor(() => {
      expect(getPersistenceRuntimeState().status).toBe('saved');
    });
    stop();

    expect(fsState.get(partitionMainUri)).toMatch(/^FVE1:/u);
    expect(fsState.get(manifestUri)).toMatch(/^FVE1:/u);
    expect(fsState.has(mainUri)).toBe(false);
  });

  it('quiesces the live writer across an explicit SQL operation and flushes the paused reset', async () => {
    const stop = startPersisting(PERSONAL_WORKSPACE_ID);
    const resume = await quiescePersistenceWrites();
    setPartial({ tightPointGoal: 606 });
    await Promise.resolve();

    expect(saveNativeWorkspaceStateGeneration).not.toHaveBeenCalled();

    resume();
    resume();
    await vi.waitFor(() => {
      expect(saveNativeWorkspaceStateGeneration).toHaveBeenCalledTimes(1);
    });
    stop();
  });

  it('recovers a complete encrypted staged generation when scoped main and backup are corrupt', async () => {
    resetToEmpty();
    setPartial({ tightPointGoal: 161 });
    await persistCurrentStateNow(PERSONAL_WORKSPACE_ID);
    const completeStaged = fsState.get(partitionMainUri)!;
    const corruptMain = 'corrupt encrypted main';
    fsState.set(partitionMainUri, corruptMain);
    fsState.set(partitionTmpUri, completeStaged);
    fsState.set(partitionBackupUri, 'corrupt encrypted backup');
    resetAll();

    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('ok');
    expect(getState().tightPointGoal).toBe(161);
    expect(fsState.get(partitionParkedUri)).toBe(corruptMain);
    expect(fsState.get(partitionMainUri)).toBe(completeStaged);
    expect(fsState.has(partitionTmpUri)).toBe(false);
  });

  it('recovers a corrupt manifest from its valid staged generation and promotes it', async () => {
    resetToEmpty();
    await persistCurrentStateNow(PERSONAL_WORKSPACE_ID);
    const completeManifest = fsState.get(manifestUri)!;
    fsState.set(manifestUri, 'corrupt manifest');
    fsState.set(manifestTmpUri, completeManifest);

    await expect(readWorkspaceManifest()).resolves.toMatchObject({
      activeWorkspaceId: PERSONAL_WORKSPACE_ID,
    });
    expect(fsState.get(manifestUri)).toBe(completeManifest);
    expect(fsState.has(manifestTmpUri)).toBe(false);
  });

  it('rebuilds an unreadable manifest from the verified Personal partition', async () => {
    resetToEmpty();
    setPartial({ tightPointGoal: 808 });
    await persistCurrentStateNow(PERSONAL_WORKSPACE_ID);
    fsState.set(manifestUri, 'corrupt manifest main');
    fsState.set(manifestTmpUri, 'corrupt manifest tmp');
    resetAll();

    await expect(loadPersistedActiveWorkspace()).resolves.toBe(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('ok');
    expect(getState().tightPointGoal).toBe(808);
    expect(fsState.get(manifestUri)).toMatch(/^FVE1:/u);
    expect(fsState.has(manifestTmpUri)).toBe(false);
    await expect(readWorkspaceManifest()).resolves.toMatchObject({
      activeWorkspaceId: PERSONAL_WORKSPACE_ID,
    });
  });

  it('writes encrypted opaque Personal state plus an encrypted manifest, then loads that partition', async () => {
    resetToEmpty();
    setPartial({ tightPointGoal: 42 });

    await persistCurrentStateNow(PERSONAL_WORKSPACE_ID);

    expect(fsState.get(partitionMainUri)).toMatch(/^FVE1:/u);
    expect(fsState.get(partitionMainUri)).not.toContain('tightPointGoal');
    expect(fsState.get(manifestUri)).toMatch(/^FVE1:/u);
    expect(partitionMainUri).not.toContain(String(PERSONAL_WORKSPACE_ID));
    expect(fsState.has(mainUri)).toBe(false);

    setPartial({ tightPointGoal: 99 });
    await loadPersisted(PERSONAL_WORKSPACE_ID);

    expect(getHydrationOutcome()).toBe('ok');
    expect(getState().tightPointGoal).toBe(42);
  });

  it('stages one empty Business file before activation and switches without cross-partition rows', async () => {
    resetToEmpty();
    setPartial({
      transactions: [
        {
          id: 'personal-only-row',
          when: '2026-07-15T20:00:00.000Z',
          merchant: 'Personal only',
          amount: -12,
          category: 'other',
          source: 'manual',
        },
      ],
    });

    const business = await createPersistedBusinessWorkspace('Studio Ltd');
    const businessFiles = workspacePartitionFilenames(business.id);
    expect(getState().activeWorkspaceId).toBe(PERSONAL_WORKSPACE_ID);
    expect(getState().workspaces).toHaveLength(2);
    expect(fsState.get(`${DOC_DIR}${businessFiles.main}`)).toMatch(/^FVE1:/u);
    expect([...fsState.keys()].join('\n')).not.toContain(String(business.id));
    expect(saveLocalLedgerState).toHaveBeenCalledWith(
      business,
      expect.objectContaining({ transactions: [], importDrafts: [], rejectedImports: [] }),
    );

    await switchPersistedWorkspace(business.id);
    expect(getState().activeWorkspaceId).toBe(business.id);
    expect(getState().transactions).toEqual([]);
    expect(getState().accounts).toEqual([]);
    setPartial({ nextYouNote: 'Business only' });
    await persistCurrentStateNow(business.id);

    await switchPersistedWorkspace(PERSONAL_WORKSPACE_ID);
    expect(getState().transactions.map((row) => row.id)).toEqual(['personal-only-row']);
    expect(getState().nextYouNote).toBe('');

    await switchPersistedWorkspace(business.id);
    expect(getState().transactions).toEqual([]);
    expect(getState().nextYouNote).toBe('Business only');
    await expect(readWorkspaceManifest()).resolves.toMatchObject({
      activeWorkspaceId: business.id,
      workspaces: [{ kind: 'personal' }, { kind: 'business', name: 'Studio Ltd' }],
    });
  });

  it('serializes the UI create-and-open flow against the live background writer', async () => {
    resetToEmpty();
    let writesInFlight = 0;
    let maximumConcurrentWrites = 0;
    saveNativeWorkspaceStateGeneration.mockImplementation(async () => {
      writesInFlight += 1;
      maximumConcurrentWrites = Math.max(maximumConcurrentWrites, writesInFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      writesInFlight -= 1;
      return { generation: 1 };
    });

    const stop = startPersisting(PERSONAL_WORKSPACE_ID);
    try {
      const business = await createAndActivatePersistedBusinessWorkspace('Studio Ltd');
      expect(getState().activeWorkspaceId).toBe(business.id);
      expect(maximumConcurrentWrites).toBe(1);
      expect(getPersistenceRuntimeState().status).not.toBe('failed');
    } finally {
      stop();
      saveNativeWorkspaceStateGeneration.mockImplementation(async () => ({ generation: 1 }));
    }
  });

  it('rolls back staged Business files and registry metadata when native provisioning fails', async () => {
    resetToEmpty();
    saveLocalLedgerState.mockRejectedValueOnce(new Error('SQLCipher unavailable'));

    await expect(createPersistedBusinessWorkspace('Studio Ltd')).rejects.toThrow(
      /SQLCipher unavailable/,
    );

    expect(getState().workspaces).toHaveLength(1);
    expect(getState().activeWorkspaceId).toBe(PERSONAL_WORKSPACE_ID);
    expect(
      [...fsState.keys()].some((uri) => /melo\.workspace\..+\.state\.v1\.json$/u.test(uri)),
    ).toBe(false);
    expect(clearLocalLedgerStorage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'business', name: 'Studio Ltd' }),
    );
  });

  it('treats the encrypted manifest as the commit record after a pre-commit creation crash', async () => {
    resetToEmpty();
    setPartial({
      transactions: [
        {
          id: 'personal-survives-precommit',
          when: '2026-07-15T20:00:00.000Z',
          merchant: 'Personal truth',
          amount: -9,
          category: 'other',
          source: 'manual',
        },
      ],
    });
    await persistCurrentStateNow(PERSONAL_WORKSPACE_ID);
    const committedPersonalManifest = fsState.get(manifestUri)!;

    await createPersistedBusinessWorkspace('Studio Ltd');
    // Simulate power loss before the new manifest rename: staged Business and the newer Personal
    // registry exist, but the last committed manifest still names Personal only.
    fsState.set(manifestUri, committedPersonalManifest);
    resetAll();

    await expect(loadPersistedActiveWorkspace()).resolves.toBe(PERSONAL_WORKSPACE_ID);
    expect(getState().workspaces).toHaveLength(1);
    expect(getState().transactions.map((row) => row.id)).toEqual(['personal-survives-precommit']);
    expect(getHydrationOutcome()).toBe('ok');
  });

  it('commits empty encrypted generations for every retained workspace after a local clear', async () => {
    resetToEmpty();
    const business = await createPersistedBusinessWorkspace('Studio Ltd');
    await switchPersistedWorkspace(business.id);
    setPartial({ nextYouNote: 'remove me' });

    resetToEmpty();
    await persistEmptyWorkspaceSetAfterLocalClear();

    const personalFiles = workspacePartitionFilenames(PERSONAL_WORKSPACE_ID);
    const businessFiles = workspacePartitionFilenames(business.id);
    expect(fsState.get(`${DOC_DIR}${personalFiles.main}`)).toMatch(/^FVE1:/u);
    expect(fsState.get(`${DOC_DIR}${businessFiles.main}`)).toMatch(/^FVE1:/u);
    await expect(readWorkspaceManifest()).resolves.toMatchObject({
      activeWorkspaceId: business.id,
      workspaces: [{ kind: 'personal' }, { kind: 'business' }],
    });

    await switchPersistedWorkspace(PERSONAL_WORKSPACE_ID);
    expect(getState().transactions).toEqual([]);
    await switchPersistedWorkspace(business.id);
    expect(getState().nextYouNote).toBe('');
    expect(getState().transactions).toEqual([]);
  });

  it('renames, archives and restores Business without losing its isolated data', async () => {
    resetToEmpty();
    const business = await createPersistedBusinessWorkspace('Studio Ltd');
    await expect(
      renamePersistedBusinessWorkspace(business.id, '  Studio Ops  '),
    ).resolves.toMatchObject({ name: 'Studio Ops', archivedAt: null });

    await switchPersistedWorkspace(business.id);
    expect(getState().workspaces[1]?.name).toBe('Studio Ops');
    setPartial({ nextYouNote: 'Retained while archived' });

    const archivedAt = '2026-07-15T21:00:00.000Z';
    await expect(archivePersistedBusinessWorkspace(business.id, archivedAt)).resolves.toMatchObject(
      { name: 'Studio Ops', archivedAt },
    );
    expect(getState().activeWorkspaceId).toBe(PERSONAL_WORKSPACE_ID);
    await expect(switchPersistedWorkspace(business.id)).rejects.toThrow(/not provisioned/i);
    expect(clearAllMeloNotifications).toHaveBeenCalledWith(business.id);
    expect(saveNotifyRuntimeState).toHaveBeenCalledWith(
      business.id,
      expect.objectContaining({ version: 1 }),
    );

    await expect(restorePersistedBusinessWorkspace(business.id)).resolves.toMatchObject({
      name: 'Studio Ops',
      archivedAt: null,
    });
    await switchPersistedWorkspace(business.id);
    expect(getState().nextYouNote).toBe('Retained while archived');
    expect(getState().workspaces[1]).toMatchObject({ name: 'Studio Ops', archivedAt: null });
  });
});
