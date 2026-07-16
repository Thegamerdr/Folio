# Plan 101: Make a throwing hydrate recover from backup instead of silently swapping real data for demo seeds

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Do NOT update `plans/README.md` — your reviewer
> maintains the index.
>
> **Drift check (run first)**: `git diff --stat 5cea944..HEAD -- apps/mobile/src/folio/store.ts apps/mobile/src/folio/lib/persist.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (defensive-only; happy path byte-identical)
- **Depends on**: none
- **Category**: bug (data-loss)
- **Planned at**: commit `5cea944`, 2026-07-11

## Why this matters

This app stores ALL user financial data in one encrypted blob. `load()` in
`apps/mobile/src/folio/store.ts` wraps its entire migrate+field-mapping pipeline in one
try/catch; ANY throw returns the seeded `DEFAULTS` constant (demo Spotify/Netflix data).
Because `hasAnyUserData()` is true for that seeded state, the backup-refresh gate in
`apps/mobile/src/folio/lib/persist.ts` then copies the very blob that just failed over the
last-good backup. Net effect: one malformed field in a real user's blob silently replaces
their money data with demo data, reports a healthy hydrate, and destroys the only recovery
copy. This plan turns that scenario into the DESIGNED corrupt-main path (park the bad main
file, restore the backup, show the recovery notice) — machinery that already exists.

## Current state

- `apps/mobile/src/folio/store.ts` — the single store. `load()` (~line 1384) maps
  `migrated.X ?? fallback` for many array fields WITHOUT `Array.isArray` checks
  (`pots`, `subs`, `cycles`, `transactions`, `edits`, `calendarEvents`, `debts`, `plans`,
  `tinyWins`, `timelineEvents`, `incomeSources`, `dismissedIncomeSignals`,
  `dismissedBillSignals`, `dismissedAnnualSignals`), while three fields a few lines below
  already use the correct pattern:
  `reviewQueue: Array.isArray(migrated.reviewQueue) ? migrated.reviewQueue : []`.
  A present-but-wrong-shaped field (e.g. `subs: "oops"`) throws downstream (e.g. inside
  `reanchorRenewals(...)` which calls `.map`) and lands in the catch below.
- `store.ts:1473-1475` — the catch:
  ```ts
  } catch {
    return DEFAULTS;
  }
  ```
  `DEFAULTS` (~line 895) unconditionally carries seed pots/subs/cycles/debts/transactions.
- `store.ts:3448-3450`:
  ```ts
  export function hasAnyUserData(s: AppState): boolean {
    return (
      s.transactions.length > 0 || s.pots.length > 0 || s.subs.length > 0 || s.cycles.length > 0
    );
  }
  ```
  This is TRUE for seeded `DEFAULTS` (proven by the existing test
  `store.test.ts` — "hasAnyUserData is true on the seeded demo state").
- `apps/mobile/src/folio/lib/persist.ts:207-223` — the backup gate whose premise is broken:
  ```ts
  if (await tryHydrateFile(uri)) {
    hydrationOutcome = 'ok';
    // Refresh the backup ONLY when the hydrate produced real user state. ...
    try {
      if (hasAnyUserData(getState())) {
        await FileSystem.copyAsync({ from: uri, to: backupUri });
      }
    } catch {
      /* best-effort */
    }
    return;
  }
  // Main blob exists but is unreadable — park it FIRST ... then fall back to the backup.
  ```
  The park-and-recover path below this (parking to `.unreadable.json`, backup restore,
  `hydrationOutcome = 'recovered-backup'`) is exactly what we want a throwing hydrate to hit.
- `persist.ts` has a `tryHydrateFile(fileUri)` helper (search for its definition) that reads
  the file, calls the store's `hydrateFromBlob(raw)`, and returns whether hydration succeeded.
  `hydrateFromBlob` (store.ts ~1510) routes through `load()` — so a throw inside `load()` is
  currently INVISIBLE to `tryHydrateFile` (the catch swallows it and returns DEFAULTS).
- Conventions: TypeScript strict; comments explain constraints, not narration; tests are
  vitest in the Node runner, colocated `*.test.ts`. Match the existing
  `Array.isArray(...) ? ... : []` pattern exactly.

## Commands you will need

Run from the repo root (`C:\dev\folio-v2-greenfield\.claude\worktrees\melo-mvp`) unless noted.
This is a pnpm monorepo but pnpm is BROKEN on this machine — use the direct binaries below.

| Purpose          | Command                                                                         | Expected on success     |
| ---------------- | ------------------------------------------------------------------------------- | ----------------------- |
| Tests (full)     | `node node_modules/vitest/vitest.mjs run`                                       | all pass (2,279+ tests) |
| Tests (one file) | `node node_modules/vitest/vitest.mjs run apps/mobile/src/folio/store.test.ts`   | all pass                |
| Typecheck        | from `apps\mobile`: `..\..\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json` | exit 0, no output       |
| Format           | `node_modules\.bin\prettier.cmd --write <files>`                                | exit 0                  |

Fresh worktrees share git history but not node_modules — if binaries are missing, run
`npm install --no-save` NO — STOP instead (see STOP conditions): the main worktree's
node_modules is expected to resolve because vitest/tsc live at the monorepo root. Try the
commands first; only report if they cannot run.

## Scope

**In scope** (the only files you should modify):

- `apps/mobile/src/folio/store.ts`
- `apps/mobile/src/folio/lib/persist.ts`
- `apps/mobile/src/folio/store.test.ts` (add tests)

**Out of scope** (do NOT touch):

- `hasAnyUserData` itself — other callers rely on its current semantics.
- `DEFAULTS` / seed contents — demo seeding is deliberate for dev builds.
- `lib/persist.test.ts` — the full recovery-matrix suite is Plan 102, not this plan.
- Any UI file.

## Git workflow

- Work on the current branch of the worktree you were given. Commit style: conventional
  commits (`fix: ...`), e.g. `fix(store): degraded hydrate recovers from backup instead of seeding demo data`.
- Do NOT push.

## Steps

### Step 1: Add the missing `Array.isArray` guards in `load()`

In `store.ts` `load()`, for each of these field mappings, wrap with the existing repo
pattern (see `reviewQueue` a few lines below for the exemplar):
`pots`, `subs`, `cycles`, `transactions`, `edits`, `calendarEvents`, `debts`, `plans`,
`tinyWins`, `timelineEvents`, `incomeSources`, `dismissedIncomeSignals`,
`dismissedBillSignals`, `dismissedAnnualSignals`.

Shape: `Array.isArray(migrated.pots) ? migrated.pots : DEFAULTS.pots` (keep each field's
CURRENT fallback — some fall back to `[]`, some to a `DEFAULT_*` constant; preserve exactly
what the `??` currently falls back to). NOTE for `subs`: the mapping currently wraps in
`reanchorRenewals(...)` — apply the isArray guard INSIDE, i.e.
`reanchorRenewals(Array.isArray(migrated.subs) ? migrated.subs : DEFAULTS.subs, ...)`.

**Verify**: `node node_modules/vitest/vitest.mjs run apps/mobile/src/folio/store.test.ts` → all pass.

### Step 2: Make a degraded load observable and non-seeded

In `store.ts`:

1. Add a module-level flag near `load()`:
   ```ts
   /** True when the LAST load()'s pipeline threw and the state degraded to defaults —
    *  persist.ts reads this (consumeLoadDegraded) to treat the source file as unreadable
    *  and run the designed park-and-recover path instead of trusting the degraded state. */
   let loadDegraded = false;
   export function consumeLoadDegraded(): boolean {
     const was = loadDegraded;
     loadDegraded = false;
     return was;
   }
   ```
2. In `load()`'s try block FIRST line, reset `loadDegraded = false;`.
3. In the catch: set `loadDegraded = true;` and keep returning `DEFAULTS` (callers other
   than persist still need a usable state; persist will discard it).

**Verify**: typecheck (command table) → exit 0.

### Step 3: Honor the flag in `persist.ts`

In `tryHydrateFile` (persist.ts), after the call to `hydrateFromBlob(raw)` succeeds,
add:

```ts
if (consumeLoadDegraded()) return false; // load() threw internally — treat as unreadable.
```

Import `consumeLoadDegraded` from `../store` alongside the existing store imports.
This makes a throwing hydrate fall through to the EXISTING park-main + restore-backup path,
producing `hydrationOutcome = 'recovered-backup'` (or `'unreadable'` when no backup) and
never running the backup-refresh copy.

Also extend the comment at the backup gate (persist.ts ~209) to note the flag now closes the
"degrades to seeded DEFAULTS which passes hasAnyUserData" hole.

**Verify**: typecheck → exit 0.

### Step 4: Tests

In `store.test.ts`, add a describe `load() degraded-path hardening`:

1. `hydrateFromBlob` with a blob where `subs` is a string (e.g.
   `JSON.stringify({ ...validBlobFields, subs: 'corrupt' })`) → the store does NOT throw,
   and `consumeLoadDegraded()` returns false BUT the subs field fell back to defaults
   (guarded — Step 1 means this no longer throws at all). Assert `getState().subs` is an array.
2. A blob crafted to throw DESPITE the guards (e.g. `subs: [{ nextRenewalISO: 123 }]` only
   if that actually throws — check `reanchorRenewals`; if you cannot craft a throwing blob
   through the public API, test the flag mechanics directly: monkeypatching is NOT available,
   so instead assert `consumeLoadDegraded()` is false after a clean `hydrateFromBlob`, and
   document in the test why the throw path is covered by Step 3's persist behavior).
3. Existing tests must stay green — especially the v7→v8 migration tests and
   `hasAnyUserData` tests (unchanged semantics).

## Done criteria

- [ ] Typecheck exits 0.
- [ ] `node node_modules/vitest/vitest.mjs run` → all pass, including new tests.
- [ ] In `load()`, every field listed in Step 1 uses an `Array.isArray` guard.
- [ ] `consumeLoadDegraded` exists in store.ts and is called in persist.ts's `tryHydrateFile`.
- [ ] `git status` shows only the three in-scope files modified.

## STOP conditions

- The excerpts in "Current state" don't match the live code (drift).
- `tryHydrateFile` in persist.ts doesn't exist or has a materially different shape than
  described (read the file first; report what you found).
- A verification fails twice after a reasonable fix attempt.
- The fix appears to require touching `hasAnyUserData` semantics or any out-of-scope file.
- Test/typecheck commands cannot run in your worktree (missing node_modules) — report, don't install.

## Maintenance notes

- Plan 102 (persist recovery-matrix tests) builds directly on this — its corrupt-main
  scenarios should include the "decrypts+parses but load() throws" case via this flag.
- Reviewers: scrutinize that the happy path is byte-identical (no behavior change when the
  blob is healthy) and that `consumeLoadDegraded` cannot leak `true` across loads (reset at
  try start).
