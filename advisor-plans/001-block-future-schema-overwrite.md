# Plan 001: Block every write when persisted data is newer than the app

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report; do not
> improvise. When done, update this plan's row in `advisor-plans/README.md` unless a reviewer says it
> owns the index.
>
> **Drift check (run first)**:
> `git diff --stat f7b91c7..HEAD -- apps/mobile/src/folio/store.ts apps/mobile/src/folio/lib/persist.ts apps/mobile/src/folio/lib/persistRecovery.test.ts apps/mobile/src/folio/store.test.ts apps/mobile/src/folio/shell/FolioShell.tsx`
> If an in-scope file changed, compare the excerpts below with live code. Stop on a semantic mismatch.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: none
- **Category**: migration, correctness
- **Planned at**: commit `f7b91c7`, 2026-08-16

## Why this matters

The current migration path treats a payload with `schemaVersion` greater than the running binary as
a successful load of defaults. The native persistence layer can then save those defaults over the
newer encrypted generation when the app backgrounds. A rollback or stale OTA can therefore destroy
valid data without any user edit. The required invariant is simple: unfamiliar future data remains
byte-for-byte recoverable and the old binary performs zero writes for that workspace.

## Current state

- `apps/mobile/src/folio/store.ts:1640-1657` detects a future schema, parks it only in the process-local
  `futureBlobs` object, and returns `DEFAULTS`:

  ```ts
  if (startVersion > CURRENT_SCHEMA_VERSION) {
    futureBlobs[`${KEY}.future.${startVersion}`] = parsed;
    return { ...DEFAULTS };
  }
  ```

- `apps/mobile/src/folio/store.ts:1874-1881` exposes only a `loadDegraded` flag for thrown loads. The
  future-schema branch does not set it.
- `apps/mobile/src/folio/lib/persist.ts:299-309` treats hydration as successful when
  `consumeLoadDegraded()` is false.
- `apps/mobile/src/folio/lib/persist.ts:736-771` persists on store changes and every transition away
  from the active app.
- `apps/mobile/src/folio/lib/persistRecovery.test.ts:994-1014` is the recovery-test pattern: it uses
  the mocked native filesystem, asserts the exact parked bytes, and proves the backup is not clobbered.
- `apps/mobile/src/folio/shell/FolioShell.tsx:842-901` renders hydration outcomes. Ordinary recovery
  notices are dismissible; future-schema incompatibility must instead block editing.
- Storage conventions: preserve authenticated generations, expose recovery state visibly, and fail
  closed. Do not silently reinterpret defaults as user money.

## Commands you will need

| Purpose       | Command                                                                                                                                                                                                                           | Expected on success                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Focused tests | `pnpm exec vitest run apps/mobile/src/folio/store.test.ts apps/mobile/src/folio/lib/persistRecovery.test.ts --passWithNoTests`                                                                                                    | exit 0; both files pass                                                        |
| Typecheck     | `pnpm typecheck`                                                                                                                                                                                                                  | exit 0, no errors                                                              |
| Product gate  | `pnpm check:product-gates`                                                                                                                                                                                                        | exit 0 after plan 003; before plan 003 the known confidence failure may remain |
| Formatting    | `pnpm exec prettier --check apps/mobile/src/folio/store.ts apps/mobile/src/folio/lib/persist.ts apps/mobile/src/folio/lib/persistRecovery.test.ts apps/mobile/src/folio/store.test.ts apps/mobile/src/folio/shell/FolioShell.tsx` | exit 0                                                                         |

Use `pnpm run ci`, never bare `pnpm ci` (the latter is pnpm's clean-install command).

## Scope

**In scope**:

- `apps/mobile/app/index.tsx`
- `apps/mobile/src/folio/store.ts`
- `apps/mobile/src/folio/store.test.ts`
- `apps/mobile/src/folio/lib/localDataDeletion.ts`
- `apps/mobile/src/folio/lib/localDataDeletion.test.ts`
- `apps/mobile/src/folio/lib/persist.ts`
- `apps/mobile/src/folio/lib/persistRecovery.test.ts`
- `apps/mobile/src/folio/lib/restoreNative.ts`
- `apps/mobile/src/folio/shell/FolioShell.tsx`

The startup, deletion and restore seams were added during execution because the write lock cannot be
complete if boot side effects still run, deletion cannot explicitly clear the lock, or backup
restore can misclassify a newer schema. This is a bounded safety expansion, not an architecture
change.

**Out of scope**:

- Changing `CURRENT_SCHEMA_VERSION` or adding a data-shape migration.
- Rewriting SQLCipher, the canonical repository, or the 8,975-line store.
- Deleting or downgrading a future generation.
- Loading an older backup and then allowing it to supersede the future generation.
- Cloud restore, account sync, or a general recovery-center redesign.

## Git workflow

- Branch: `advisor/001-future-schema-write-lock`, based on the current authoritative convergence branch.
- Use conventional commits, for example `fix(mobile): block writes for future schema data`.
- Do not push or open a PR unless the operator explicitly requests it.

## Steps

### Step 1: Make store hydration report future-schema incompatibility explicitly

Replace the process-local `futureBlobs` success-looking path with a typed result that distinguishes:

- valid current/older data;
- malformed/degraded data;
- future-schema data, including the encountered version.

The public hydration boundary must allow `persist.ts` to read this result directly. Do not rely on a
console warning or a flag that can be consumed by an unrelated call. A future-schema hydrate must not
publish `DEFAULTS` as a valid workspace state or emit a normal store change.

Add store tests proving a blob at `CURRENT_SCHEMA_VERSION + 1`:

- is classified as incompatible;
- does not replace a previously loaded state with first-run defaults;
- preserves the future version in the result;
- remains distinct from malformed/degraded data.

**Verify**:
`pnpm exec vitest run apps/mobile/src/folio/store.test.ts --passWithNoTests`
→ exit 0 and the new future-schema cases pass.

### Step 2: Add a workspace-scoped persistence write interlock

In `persist.ts`, make the plaintext hydrate helper return a discriminated result instead of `boolean`.
When any authoritative generation is future-schema:

1. set `hydrationOutcome` to a new explicit value such as `incompatible-future-schema`;
2. record the workspace in a write-blocked set for the lifetime of the process;
3. retain the authoritative encrypted generation in place; if an existing byte-for-byte parking copy
   is required by the current storage path, create it without deleting or replacing the original;
4. stop fallback selection. Do not hydrate an older backup as writable truth;
5. make `persistCurrentStateNow`, retry handling, reconciliation saves, workspace-switch saves, and
   background flushes reject or no-op before touching disk for that workspace.

Clear the interlock only after a compatible generation has been successfully loaded, or after the
existing explicit local-data deletion flow has removed the incompatible data. Do not add a hidden
developer bypass.

**Verify**:
`pnpm exec vitest run apps/mobile/src/folio/lib/persistRecovery.test.ts --passWithNoTests`
→ exit 0.

### Step 3: Prove rollback and relaunch safety end to end

Extend `persistRecovery.test.ts` using its in-memory filesystem and native-generation mocks. Cover:

- future-schema main with an older valid backup;
- future-schema native/SQLCipher generation;
- app background immediately after load;
- an attempted store mutation followed by background;
- persistence retry and reconciliation paths;
- simulated relaunch with the same future bytes.

For every case, assert the future bytes are unchanged, provider/native write mocks were not called,
the older backup was not promoted, and the hydration outcome remains incompatible. Include a control
case showing a current-schema payload still persists normally.

**Verify**:
`pnpm exec vitest run apps/mobile/src/folio/lib/persistRecovery.test.ts --passWithNoTests`
→ all new rollback cases pass.

### Step 4: Block the product shell instead of showing an editable blank slate

Add explicit copy for the new hydration outcome in `FolioShell.tsx`. It must explain that the saved
data was created by a newer Melo version, remains protected, and requires updating/reinstalling the
newer app. Render a non-dismissible blocking state; do not mount normal money routes over defaults.
Keep recovery notices for corrupt/backup cases unchanged.

Add a small pure test if the shell copy/state mapping can be extracted without introducing a new UI
framework. Otherwise cover the outcome through the existing shell test pattern available at execution
time and document the required device check.

**Verify**: `pnpm typecheck` → exit 0.

### Step 5: Run the complete safety gate

Run targeted tests, typecheck, and targeted formatting. Then run `pnpm run ci`. At this plan's point in
the sequence, the pre-existing `canonical.fake_confidence` failure is allowed only if plan 003 has not
landed; no new failure is allowed. On the current Windows checkout, do not mass-format unrelated CRLF
files.

**Verify**: `git diff --check` → no whitespace errors in changed files.

## Test plan

- Add store-level classification tests in `apps/mobile/src/folio/store.test.ts`.
- Add persistence matrix tests in `apps/mobile/src/folio/lib/persistRecovery.test.ts`, modeled on the
  existing `h2` parked-main test at lines 994-1014.
- Required regression assertion: after a future-schema Personal generation loads and the mocked app
  backgrounds, every persisted byte is exactly equal to its pre-launch value.
- Required control assertion: current-schema state still saves and recovers.

## Done criteria

- [x] A future schema is an explicit hydration outcome, never `ok`, `first-run`, or ordinary `unreadable`.
- [x] No future-schema path publishes defaults as editable truth.
- [x] All save entry points are blocked for the affected workspace.
- [x] Future encrypted bytes survive background, retry, switch attempts, and relaunch unchanged.
- [x] Current-schema persistence still works.
- [x] Focused tests and `pnpm typecheck` exit 0.
- [x] Only in-scope files plus `advisor-plans/README.md` changed.

## Execution evidence

- Focused store, persistence recovery, deletion and restore suites: 341 tests passed.
- `pnpm typecheck`: passed.
- Targeted Prettier check and `git diff --check`: passed.
- `pnpm run ci`: reached the known plan-003 `canonical.fake_confidence` gate and failed only on its
  11 pre-existing `packages/domain/src/trustedCore.ts` findings; no MIGRATION-01 failure preceded it.

## STOP conditions

- The executor cannot identify every call path into `persistCurrentStateNow` and `startPersisting`.
- Preserving the future generation would require deleting, decrypting, or rewriting it.
- A proposed fix relies only on an in-memory copy after removing the durable original.
- The UI would remain editable while displaying defaults.
- The change appears to require a schema bump; schema changes belong to later plans.

## Maintenance notes

Every future persistence backend must preserve the same incompatible-version interlock. Reviewers
should trace all writes, including repair, retry, background and workspace-switch paths. This plan is
the prerequisite for plans 002 and 003 because those plans may introduce newer persisted schemas.
