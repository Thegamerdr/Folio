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
//      `@/folio/lib/cryptoBlob`, `@/folio/lib/vaultKey`), which this repo's `vitest.config.ts`
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
const { fsState, FS, forceDegraded } = vi.hoisted(() => {
  const fsState = new Map<string, string>();
  type MoveCopyArgs = { from: string; to: string };
  const FS = {
    documentDirectory: 'file://doc/',
    EncodingType: { UTF8: 'utf8' },
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
  return { fsState, FS, forceDegraded };
});

vi.mock('expo-file-system/legacy', () => FS);

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

import { getPersistBlob, getState, resetAll, resetToEmpty, setPartial } from '../store';
import { getHydrationOutcome, loadPersisted } from './persist';

const DOC_DIR = 'file://doc/';
const mainUri = `${DOC_DIR}folio.state.v3.json`;
const tmpUri = `${DOC_DIR}folio.state.v3.json.tmp`;
const backupUri = `${DOC_DIR}folio.state.v3.bak.json`;
const parkedUri = `${DOC_DIR}folio.state.v3.unreadable.json`;

beforeEach(() => {
  fsState.clear();
  vi.clearAllMocks();
  forceDegraded.next = false;
  resetAll();
});

describe('loadPersisted — scaffold sanity', () => {
  it('the mocked filesystem + real store wire together (trivial first-run load)', async () => {
    await loadPersisted();
    expect(getHydrationOutcome()).toBe('first-run');
  });
});

describe('loadPersisted — recovery matrix', () => {
  it('a. first run (no files on disk) -> first-run, no writes', async () => {
    await loadPersisted();

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

    await loadPersisted();

    expect(getHydrationOutcome()).toBe('ok');
    expect(fsState.get(backupUri)).toBe(fsState.get(mainUri));
  });

  it('c. healthy main, EMPTY state (no user data) -> ok, backup NOT written', async () => {
    resetToEmpty();
    const blob = getPersistBlob();
    fsState.set(mainUri, blob);

    await loadPersisted();

    expect(getHydrationOutcome()).toBe('ok');
    expect(fsState.has(backupUri)).toBe(false);
  });

  it('d. corrupt main + good backup -> recovered-backup, main PARKED with original bytes preserved', async () => {
    const corruptMain = 'not valid json {{{';
    fsState.set(mainUri, corruptMain);

    setPartial({ tightPointGoal: 555 });
    const backupBlob = getPersistBlob();
    fsState.set(backupUri, backupBlob);

    await loadPersisted();

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

    await loadPersisted();

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

    await loadPersisted();

    expect(getHydrationOutcome()).toBe('ok');
    expect(fsState.get(mainUri)).toBe(blob);
    expect(fsState.has(tmpUri)).toBe(false); // promoted, not copied — tmp is gone.
    expect(getState().tightPointGoal).toBe(42);
  });

  it('g. main missing + backup good -> recovered-backup', async () => {
    setPartial({ tightPointGoal: 7 });
    const blob = getPersistBlob();
    fsState.set(backupUri, blob);

    await loadPersisted();

    expect(getHydrationOutcome()).toBe('recovered-backup');
    expect(getState().tightPointGoal).toBe(7);
    expect(fsState.has(mainUri)).toBe(false); // no promotion into main on this path.
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

    await loadPersisted();

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

    await loadPersisted();

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
