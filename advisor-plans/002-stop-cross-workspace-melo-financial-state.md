# Plan 002: Keep financial Melo state inside its owning workspace

> **Executor instructions**: Execute only after plan 001 is DONE. Follow every step and verification
> gate. Stop on any condition listed below; do not invent a broader workspace architecture. Update
> `advisor-plans/README.md` when done unless a reviewer owns the index.
>
> **Drift check (run first)**:
> `git diff --stat f7b91c7..HEAD -- apps/mobile/src/folio/lib/sharedWorkspaceState.ts apps/mobile/src/folio/lib/sharedWorkspaceState.test.ts apps/mobile/src/folio/lib/persist.ts apps/mobile/src/folio/lib/persistRecovery.test.ts apps/mobile/src/folio/store.ts apps/mobile/src/folio/store.test.ts apps/mobile/src/folio/lib/melo/oneMove.ts apps/mobile/src/folio/lib/melo/memory.ts`
> Plan 001 is expected to change persistence files. Reconcile those changes; stop if its write interlock
> is absent or the current excerpts no longer describe the shared-state copy.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: MED
- **Depends on**: `advisor-plans/001-block-future-schema-overwrite.md`
- **Category**: correctness, security, migration
- **Planned at**: commit `f7b91c7`, 2026-08-16

## Why this matters

Workspace switching currently copies financial companion history and observed memory from Personal
to Business and back, then persists it inside the target encrypted partition. That breaks the product
rule that Personal and Business data, memory, events and Melo context cannot leak. The smallest safe
boundary is to share only global presentation/preferences and keep all event-derived or money-derived
Melo records workspace-owned.

## Current state

- `apps/mobile/src/folio/lib/sharedWorkspaceState.ts:3-18` calls the list non-financial but includes
  `oneMoveHistory`, `meloMoves`, dismissals, memory and forgotten-memory tombstones.
- `apps/mobile/src/folio/lib/melo/oneMove.ts:27-41` shows `OneMoveRecord` contains `amount`, `targetId`,
  `baselinePathSpare` and `baselineTightPoint`.
- `apps/mobile/src/folio/lib/melo/memory.ts:23-63` derives memory from wins and cycle outcomes.
- `apps/mobile/src/folio/lib/persist.ts:1303-1328` picks the source shared state, loads the target,
  applies the shared patch and persists the target partition.
- `apps/mobile/src/folio/lib/sharedWorkspaceState.test.ts:6-39` asserts only absent top-level ledger
  keys; it blesses the leaking companion keys and never inspects nested values.
- `apps/mobile/src/folio/lib/persistRecovery.test.ts:1329-1377` is the end-to-end workspace-switch
  pattern with real partition save/load assertions.
- Safe global fields already identified by the code are the intro acknowledgement fields,
  presentation-only `melo` settings (`quietMode`, wardrobe, tone, sound), and `chartStyle`.

## Commands you will need

| Purpose       | Command                                                                                                                                                                                                                                                                                         | Expected on success |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Focused tests | `pnpm exec vitest run apps/mobile/src/folio/lib/sharedWorkspaceState.test.ts apps/mobile/src/folio/lib/persistRecovery.test.ts apps/mobile/src/folio/store.test.ts --passWithNoTests`                                                                                                           | exit 0              |
| Typecheck     | `pnpm typecheck`                                                                                                                                                                                                                                                                                | exit 0              |
| Contracts     | `pnpm validate:contracts`                                                                                                                                                                                                                                                                       | exit 0              |
| Formatting    | `pnpm exec prettier --check apps/mobile/src/folio/lib/sharedWorkspaceState.ts apps/mobile/src/folio/lib/sharedWorkspaceState.test.ts apps/mobile/src/folio/lib/persist.ts apps/mobile/src/folio/lib/persistRecovery.test.ts apps/mobile/src/folio/store.ts apps/mobile/src/folio/store.test.ts` | exit 0              |

## Scope

**In scope**:

- `apps/mobile/src/folio/lib/sharedWorkspaceState.ts`
- `apps/mobile/src/folio/lib/sharedWorkspaceState.test.ts`
- `apps/mobile/src/folio/lib/persist.ts`
- `apps/mobile/src/folio/lib/persistRecovery.test.ts`
- `apps/mobile/src/folio/store.ts`
- `apps/mobile/src/folio/store.test.ts`

**Read-only references**:

- `apps/mobile/src/folio/lib/melo/oneMove.ts`
- `apps/mobile/src/folio/lib/melo/memory.ts`
- `docs/adr/0014-phase13-business-workspace-boundaries.md`

**Out of scope**:

- Merging Personal and Business partitions.
- Adding a global companion database or new storage service.
- Rewriting the store or persistence layer.
- Sharing transaction-derived memory after redaction; the source event itself remains workspace-owned.
- Multiple Business workspaces.

## Git workflow

- Branch: `advisor/002-workspace-melo-isolation`, based on the reviewed result of plan 001.
- Commit example: `fix(mobile): isolate Melo financial history by workspace`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Reduce the shared-state contract to presentation-only fields

Change `SHARED_WORKSPACE_STATE_KEYS` to include only:

- `meloPrimerSeen`
- `meloPrimerBeat`
- `meloPrimerSeenAt`
- `melo`
- `chartStyle`

Remove `oneMoveHistory`, `meloMoves`, `meloDismissLog`, `meloMemoryThread`, and
`meloForgottenMemoryIds`. Keep `pickSharedWorkspaceState` explicit rather than using an unreviewable
generic object spread.

Rewrite `sharedWorkspaceState.test.ts` so it seeds nested financial companion values and proves none
are returned. Also assert the exact safe allow-list so a later addition is reviewed deliberately.

**Verify**:
`pnpm exec vitest run apps/mobile/src/folio/lib/sharedWorkspaceState.test.ts --passWithNoTests`
→ exit 0.

### Step 2: Add a migration for already-contaminated Business partitions

After plan 001, add the next sequential schema migration (expected `18 -> 19`; if the live version is
not 18 before this plan's migration, stop and reconcile numbering). For partitions whose
`dataWorkspaceId` resolves to a Business workspace, clear these five companion-financial fields:

- `oneMoveHistory`
- `meloMoves`
- `meloDismissLog`
- `meloMemoryThread`
- `meloForgottenMemoryIds`

Do not clear them from Personal. There is no provenance capable of distinguishing copied Business
history from native Business history, so clearing the Business copies is an explicit privacy-first
one-time trade-off. Preserve global presentation preferences. Update the migration comments and
schema-version assertions.

Add store migration tests for Personal preservation, Business clearing, idempotent reload and a
legacy partition missing the fields.

**Verify**: `pnpm exec vitest run apps/mobile/src/folio/store.test.ts --passWithNoTests` → exit 0.

### Step 3: Prove physical partition isolation across switches and relaunch

Extend the existing `persistRecovery.test.ts` switch suite:

1. seed Personal with an amount-bearing one-move record, dismissal and money-derived memory line;
2. create and switch to Business;
3. assert all five financial companion collections are empty in memory and in the persisted Business
   payload;
4. create distinct Business companion history;
5. switch to Personal and prove Personal values are unchanged and Business values did not appear;
6. switch back and relaunch from persisted Business data, proving only Business values return;
7. verify `melo` preferences and `chartStyle` still follow the user in both directions.

Assertions must inspect nested amounts/text, not merely top-level account/transaction keys.

**Verify**:
`pnpm exec vitest run apps/mobile/src/folio/lib/persistRecovery.test.ts --passWithNoTests`
→ exit 0.

### Step 4: Run the complete boundary checks

Run focused tests, typecheck and contract validation. Inspect `git diff` for any attempt to share a
new companion field. Do not refactor `switchPersistedWorkspace` beyond what is required to apply the
narrow allow-list safely.

**Verify**: `git diff --check` → no whitespace errors.

## Test plan

- Exact allow-list and nested-value tests in `sharedWorkspaceState.test.ts`.
- Schema migration tests in `store.test.ts` for Personal and Business partitions.
- Encrypted partition round-trip and rapid-switch tests in `persistRecovery.test.ts`.
- Regression fixtures must contain a real `amount`, `baselinePathSpare`, a cycle-derived memory line,
  and a Business-specific value so false positives are visible.

## Done criteria

- [x] No money/event-derived Melo field is part of `SharedWorkspaceState`.
- [x] Existing Business partitions are privacy-cleaned once; Personal history remains intact.
- [x] Target partitions never receive the source workspace's financial companion state.
- [x] Global Melo presentation preferences still follow the user.
- [x] Focused tests, typecheck and contract validation pass.
- [x] No new global store, service or broad store refactor was introduced.

## Execution evidence

- `CURRENT_SCHEMA_VERSION` advanced from 18 to 19 with a Business-only, privacy-first cleanup of the
  five formerly shared financial companion collections.
- Focused shared-state, migration and encrypted partition suites: 334 tests passed.
- The switch/relaunch regression inspects nested Personal and Business amounts, targets, dismissals
  and memory text, plus the plaintext passed to the native encrypted-generation boundary.
- `pnpm typecheck`, source-package contract validation, targeted Prettier and `git diff --check`:
  passed.

## STOP conditions

- Plan 001's future-schema write interlock is not present and tested.
- The executor cannot determine the active partition kind during migration.
- A proposed solution copies then redacts financial memory instead of keeping it workspace-owned.
- Fixing the leak appears to require changing encryption keys or merging partition files.
- A second Business workspace is introduced.

## Maintenance notes

Any future field proposed for `SHARED_WORKSPACE_STATE_KEYS` needs a privacy review and a test proving it
cannot encode money, events, analytics or workspace-specific Melo context. This plan intentionally
accepts loss of existing Business companion history because the records lack trustworthy origin
provenance; do not attempt heuristic recovery.
