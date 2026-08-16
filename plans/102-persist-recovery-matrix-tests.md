# Plan 102: Test the persistence recovery matrix (the file that guards the user's only data copy)

> **Executor instructions**: Follow step by step; verify each step; STOP conditions binding.
> Do NOT update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5cea944..HEAD -- apps/mobile/src/folio/lib/persist.ts`
> Plan 101 DELIBERATELY changes persist.ts (adds a `consumeLoadDegraded` check in
> `tryHydrateFile`) — that change is EXPECTED, not drift. Any OTHER change = compare and STOP
> on mismatch.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (test-only)
- **Depends on**: plans/101-hydration-degraded-path.md (DONE required)
- **Category**: tests
- **Planned at**: commit `5cea944`, 2026-07-11

## Why this matters

`lib/persist.ts` decides whether a user's financial data survives corruption: staged atomic
writes, `.bak.json` backup, `.unreadable.json` parking, tmp-file recovery. Its recovery
matrix has ZERO test coverage (`persist.test.ts` deliberately tests only the pure blob
helpers because persist.ts imports expo-file-system). Plan 101's data-loss bug is exactly
the class this gap lets through.

## Current state

- `apps/mobile/src/folio/lib/persist.ts` — read it fully. Key paths (line refs ~pre-101):
  main missing → tmp orphan promote → 'ok'; main missing + backup good → 'recovered-backup';
  main missing + nothing → 'first-run'; main hydrates ok → 'ok' + backup refresh gated on
  `hasAnyUserData(getState())`; main unreadable → park to `.unreadable.json` FIRST, then
  backup → 'recovered-backup' | 'unreadable'; after 101: main hydrates but
  `consumeLoadDegraded()` true → treated as unreadable. `getHydrationOutcome()` exposes the
  outcome. `startPersisting` owns the staged write chain (tmp write → delete main → rename).
- MOCK PATTERN — copy exactly from `apps/mobile/src/folio/lib/billing/entitlements.test.ts`:
  `vi.hoisted` fns + `vi.mock('expo-file-system/legacy', () => ({...}))`. CRITICAL GOTCHA:
  a vi.mock factory's namespace proxy THROWS on access to any export you didn't define —
  enumerate EVERY symbol persist.ts touches (read its import + every `FileSystem.X` use:
  expect `documentDirectory`, `EncodingType`, `getInfoAsync`, `readAsStringAsync`,
  `writeAsStringAsync`, `copyAsync`, `moveAsync`, `deleteAsync`, possibly more — grep the
  file). `documentDirectory: 'file://doc/'`.
- persist.ts also imports the store (`hydrateFromBlob`, `getState`, `getPersistBlob`,
  `hasAnyUserData`, after 101 `consumeLoadDegraded`) — the store is Node-safe and REAL in
  tests (same style as entitlements.test.ts: real store, mocked filesystem). Use
  `resetAll()` between tests. Also read `lib/vaultKey.ts` usage inside persist.ts — if blob
  encryption runs through a native module, check how tryHydrateFile obtains plaintext; if
  encryption is unavoidable in the path, mock the vault module the same hoisted way (find
  what persist imports and mirror it). If the encryption seam cannot be satisfied with
  mocks in ≤2 attempts — STOP and report the exact import chain.

## Commands

From repo root; pnpm broken — direct binaries:
tests `node node_modules/vitest/vitest.mjs run apps/mobile/src/folio/lib/persistRecovery.test.ts`;
full suite `node node_modules/vitest/vitest.mjs run`;
typecheck from `apps\mobile`: `..\..\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json`.

## Scope

**In scope**: `apps/mobile/src/folio/lib/persistRecovery.test.ts` (create — new file; do
NOT extend persist.test.ts, its header documents a pure-only scope).
**Out of scope**: persist.ts itself (NO production changes — if a scenario reveals a real
bug, STOP and report it as a finding instead of fixing), store.ts, vaultKey.ts.

## Git workflow

Conventional commit: `test(persist): recovery-matrix coverage`. No push.

## Steps

1. Build the mock scaffold (above) + a `fileSystemState` helper: a Map<uri,string> your
   mocked getInfoAsync/read/write/copy/move/delete operate on, so each scenario is just
   seeding the map. Verify: the file runs with 1 trivial test.
2. Scenarios (one `it` each) — after each `loadPersisted()` call assert BOTH
   `getHydrationOutcome()` AND the resulting file map:
   a. first run (no files) → 'first-run', no writes.
   b. healthy main with real user data → 'ok' AND backup refreshed (map[backup]=map[main]).
   c. healthy main, EMPTY state (no user data) → 'ok' AND backup NOT written.
   d. corrupt main (unparseable string) + good backup → 'recovered-backup', main PARKED at
   `.unreadable.json` (original bytes preserved), state = backup's.
   e. corrupt main + corrupt backup → 'unreadable', main parked, backup untouched.
   f. main missing + orphaned good tmp → promoted, 'ok'.
   g. main missing + backup good → 'recovered-backup'.
   h. (post-101) main parses but load() degrades (seed a blob whose shape makes load throw —
   e.g. `subs` as a number IF that still throws post-101 guards; if the guards make it
   unthrowable, use whatever shape 101's own tests used; if none exists, assert instead
   that a degraded flag scenario is unreachable and note it) → treated as unreadable path
   (parked + backup recovery).
3. Full suite + typecheck green.

## Done criteria

- [ ] New file with ≥7 passing scenarios; full suite green; typecheck exit 0.
- [ ] Scenario (d) asserts the PARK happened (unreadable bytes preserved) — not just the outcome enum.
- [ ] Zero production files modified (`git status`).

## STOP conditions

- persist.ts's import chain needs an unmockable native seam (report the chain).
- Any scenario exposes a REAL recovery bug (report as finding; do not fix).
- Plan 101 not merged (its `consumeLoadDegraded` missing from persist.ts).

## Maintenance notes

- Future persist.ts changes must keep this suite green — it is the data-safety contract.
