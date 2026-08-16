# Plan 008: Publish the authoritative repository and reconcile navigation

> **Executor instructions**: Execute only after plans 001-007 are DONE and their commits are present
> in this worktree. This plan includes DOCS-01; do not create a separate documentation workstream.
> Work only in `C:\dev\melo-phase-d-work`. Do not create or copy into another repository. Follow
> every step and verification gate, and update `advisor-plans/README.md` when done unless a reviewer
> owns the index.
>
> **Drift check (run first)**:
> `git diff --stat f7b91c7..HEAD -- STATUS.md plans/README.md .github/pull_request_template.md docs/convergence/2026-08-15/MELO_ONE_APP_AUTHORITY.md apps/mobile/src/folio/ui/PersonalBottomNav.tsx apps/mobile/src/folio/ui/BusinessBottomNav.tsx apps/mobile/src/folio/lib/navigation/businessNavigation.ts apps/mobile/src/folio/lib/navigation/businessNavigation.test.ts apps/mobile/src/folio/shell/FolioShell.tsx apps/mobile/src/folio/types.ts`
> Plans 001-007 are expected to move persistence, tests and trust copy. Reconcile those changes. Stop
> if this worktree is no longer the one-app Melo runtime, if the branch contains an unrelated product
> fork, or if any earlier safety plan is not DONE.

## Status

- **Execution status**: DONE; published by normal push after an owner-authorized clean replay
- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans 001-007
- **Category**: authority, navigation, documentation, delivery
- **Planned at**: commit `f7b91c7`, 2026-08-16
- **Includes**: `AUTHORITY-01` and `DOCS-01`

## Execution evidence — 2026-08-16

- Navigation commit: `88a5ae320265dd0d5c6ffa486db1f74920147ad0`.
- Authority/documentation commit: `ad84793c714890ea2da3087972512c91f6c6ad60`.
- Focused navigation suite: 3 files, 37 tests passed.
- `pnpm typecheck`: passed.
- `pnpm run ci`: passed with 239 Vitest files / 2,776 tests, all 45 companion tests and both
  source-package validators.
- Normal publication failed before the remote branch was created. GitHub rejected historical
  branch objects containing multiple APK/AAB artifacts over 100 MB; the largest reported file was
  132.07 MB. Deleting those files in a new tip commit would not remove the rejected history.
- The remote branch remains absent. Completing publication requires explicit owner approval for a
  history migration to Git LFS or a clean replay branch. Both change the approved lineage, so this
  plan stopped instead of rewriting or force-pushing history.

## Publication resolution — 2026-08-17

- The owner authorized a one-time clean replay while requiring the original tip and untracked
  evidence to remain preserved.
- Original tip `71caffc5978d23e5ce68a15aee0f243575f54872` remains at
  `backup/melo-one-app-convergence-pre-publication-2026-08-17`.
- The replay is based directly on `origin/master`, retains every reviewed source/test/migration/doc
  change, and excludes exactly 63 enumerated Android build products, signatures and symbol files.
  See `docs/convergence/2026-08-17/MELO_CLEAN_PUBLICATION_REPLAY.md`.
- Replay CI passed with 239 Vitest files / 2,776 tests, all 45 companion tests, all typechecks and
  both source-package validators.
- Clean publication tip `c60db2edf12d6e523a6b19e506aa03258326fa40` was pushed normally to
  `origin/codex/melo-one-app-convergence-2026-08-15`; that upstream now tracks the local intended
  branch. No force-push, merge, default-branch change or deployment occurred.

## Why this matters

`C:\dev\melo-phase-d-work` already contains the native one-app Melo implementation, but the master
delivery document incorrectly says no authoritative repository was found, repository-local status
still points at an older branch, and navigation copy disagrees across two authority documents and
the running app. Publishing an ambiguous branch would preserve that contradiction. This plan makes
the existing repository explicitly authoritative, implements the selected Personal and Business tab
contracts, and publishes the reviewed branch without manufacturing another lineage.

## Current state

- Git HEAD is `f7b91c7` on `codex/melo-one-app-convergence-2026-08-15`; at planning time it is 180
  commits ahead of `origin/master` and has no upstream branch.
- `origin` is `https://github.com/Thegamerdr/Folio.git`. The plan publishes to that existing remote;
  it never creates a repository or force-pushes.
- `docs/convergence/2026-08-15/MELO_ONE_APP_AUTHORITY.md:13-28` correctly names
  `apps/mobile` as the sole runtime and rejects parallel apps, but lines 44-45 freeze outdated tab
  contracts.
- The attached 2026-08-16 master plan says no authoritative native repository was found. That claim
  is now disproved by this worktree and must be superseded explicitly, not silently edited out of an
  external attachment.
- `STATUS.md:3-9` still identifies `codex/melo-native-ux` as active.
- `plans/README.md:3-17` labels an older July backlog ACTIVE and includes machine-specific worktree
  guidance.
- `.github/pull_request_template.md:1` is headed “Folio V2”, and the repository has no concise root
  `README.md` that identifies the Melo runtime or its validation command.
- `PersonalBottomNav.tsx` implements Today / Talk to Melo / More. Plan and Review are currently
  reachable only through the More subtree in `FolioShell.tsx:244-271`.
- `BusinessBottomNav.tsx` and `businessNavigation.ts` implement Today / Money / Filings / More.
- The selected stable contracts are Personal Today / Plan / Review / More and Business Today / Money
  / Review / More. Melo remains a persistent contextual companion action, not a bottom tab.

## Commands you will need

| Purpose                  | Command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Expected on success                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Confirm lineage          | `git rev-parse --show-toplevel && git branch --show-current && git rev-parse HEAD && git remote -v`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | this repository, expected branch/commit and existing `origin` |
| Check remote collision   | `git ls-remote --heads origin codex/melo-one-app-convergence-2026-08-15`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | empty, or the exact expected commit after publication         |
| Focused navigation tests | `pnpm exec vitest run apps/mobile/src/folio/lib/navigation/businessNavigation.test.ts apps/mobile/src/folio/lib/navigation/personalNavigation.test.ts apps/mobile/src/folio/ui/BottomNavigation.test.tsx --passWithNoTests`                                                                                                                                                                                                                                                                                                                                                                                                                                                       | exit 0; all three files collected                             |
| Typecheck                | `pnpm typecheck`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | exit 0                                                        |
| Full gate                | `pnpm run ci`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | exit 0, including plan 007's companion suite                  |
| Formatting               | `pnpm exec prettier --check README.md STATUS.md plans/README.md .github/pull_request_template.md docs/convergence/2026-08-15/MELO_ONE_APP_AUTHORITY.md docs/convergence/2026-08-16/MELO_REPOSITORY_AND_NAVIGATION_AUTHORITY.md apps/mobile/src/folio/ui/PersonalBottomNav.tsx apps/mobile/src/folio/ui/BusinessBottomNav.tsx apps/mobile/src/folio/ui/BottomNavigation.test.tsx apps/mobile/src/folio/lib/navigation/businessNavigation.ts apps/mobile/src/folio/lib/navigation/businessNavigation.test.ts apps/mobile/src/folio/lib/navigation/personalNavigation.ts apps/mobile/src/folio/lib/navigation/personalNavigation.test.ts apps/mobile/src/folio/shell/FolioShell.tsx` | exit 0 without reformatting unrelated files                   |

## Scope

**In scope**:

- `README.md`
- `STATUS.md`
- `plans/README.md`
- `.github/pull_request_template.md`
- `docs/convergence/2026-08-15/MELO_ONE_APP_AUTHORITY.md`
- `docs/convergence/2026-08-16/MELO_REPOSITORY_AND_NAVIGATION_AUTHORITY.md` (new)
- `apps/mobile/src/folio/ui/PersonalBottomNav.tsx`
- `apps/mobile/src/folio/ui/BusinessBottomNav.tsx`
- `apps/mobile/src/folio/ui/BottomNavigation.test.tsx` (new)
- `apps/mobile/src/folio/lib/navigation/businessNavigation.ts`
- `apps/mobile/src/folio/lib/navigation/businessNavigation.test.ts`
- `apps/mobile/src/folio/lib/navigation/personalNavigation.ts` (new)
- `apps/mobile/src/folio/lib/navigation/personalNavigation.test.ts` (new)
- `apps/mobile/src/folio/shell/FolioShell.tsx`

**Read-only references**:

- `apps/mobile/src/folio/types.ts`
- `docs/adr/0014-phase13-business-workspace-boundaries.md`
- the attached 2026-08-16 master product and delivery plan

**Out of scope**:

- Creating another repository, app shell, runtime or design-system fork.
- Rewriting the app or changing the encrypted persistence architecture.
- Splitting `apps/mobile/src/folio/store.ts`; measure it before any structural project.
- Changing the remote default branch, merging a pull request or deleting old branches automatically.
- Adding a fifth bottom tab or turning Melo into a bottom tab.
- Reopening feature, visual-design or product-copy decisions unrelated to the two selected tab contracts.
- A separate DOCS-01 project; its necessary corrections are part of this plan.

## Git workflow

- Branch: continue `codex/melo-one-app-convergence-2026-08-15` after plans 001-007 are reviewed and
  committed in order.
- Commit the product/navigation changes separately from the authority/documentation changes when
  practical:
  - `fix(mobile): align Melo workspace navigation`
  - `docs: publish Melo repository authority`
- Do not stage the existing untracked screenshots, XML dumps or `tmp/` evidence unless an explicit
  documentation reference requires one and a reviewer approves it.
- Do not force-push. Do not rewrite history. Do not merge or change the GitHub default branch as part
  of unattended execution.

## Steps

### Step 1: Prove and record the one-app repository authority

Before editing, capture the repository root, branch, HEAD, remote and ahead/behind counts in the
executor notes. Confirm `apps/mobile` is still the only shipping runtime.

Create `docs/convergence/2026-08-16/MELO_REPOSITORY_AND_NAVIGATION_AUTHORITY.md` as a short decision
record with these exact outcomes:

1. The authoritative implementation repository is this existing repository, materialized locally at
   `C:\dev\melo-phase-d-work` for this delivery.
2. The authoritative shipping runtime is `apps/mobile`; design experiments are not parallel apps.
3. The “no authoritative native repository found” statement in section 3.3 of the 2026-08-16 master
   plan is superseded by repository evidence as of this commit.
4. The 2026-08-15 navigation subsection is superseded only for the selected contracts: Personal is
   Today / Plan / Review / More, Business is Today / Money / Review / More, and Melo remains a
   contextual companion action.
5. This correction does not invalidate unrelated scope, safety or beta gates in either authority
   document.

Add a visible superseded-note and link near the old navigation section in
`MELO_ONE_APP_AUTHORITY.md`; do not rewrite its historical date or erase the old decision.

### Step 2: Make the root handoff point at the real runtime

Add a concise `README.md` that states:

- what Melo is and that `apps/mobile` is the shipping runtime;
- the supported package manager and the minimum setup/run commands already defined by the repo;
- `pnpm run ci` as the release validation entry point;
- links to the current authority record, `STATUS.md`, and release evidence;
- the explicit one-repository/no-parallel-app rule.

Update `STATUS.md` to the current branch and authority record. Reclassify the older material listed
in `plans/README.md` as historical or superseded; do not delete it. Remove machine-specific active
worktree instructions from the historical index. Rename the PR template from Folio V2 to Melo and
make its checklist point to `pnpm run ci`, migrations, privacy boundaries and release evidence.

### Step 3: Implement Personal Today / Plan / Review / More

Add `personalNavigation.ts` with a typed four-tab contract and pure mappings between `ScreenId` and
the active tab. Use the existing `plans` and `review` screens; More owns its existing child/settings
screens. Decide the active tab from screen identity in one place rather than adding more booleans to
`FolioShell`.

Change `PersonalBottomNav` to four ordinary accessible tabs. Remove Melo-specific mood/pose props
and the elevated nav entry. Keep the component small and data-driven, matching Business nav where
that reduces duplication without introducing a new navigation framework.

In `FolioShell`, route the new Plan and Review tabs to the existing screens. Preserve Melo as the
existing contextual companion/chat action elsewhere in the shell; prove at least one reachable,
labelled Melo entry remains on all relevant Personal surfaces. Do not create a duplicate chat screen.

### Step 4: Implement Business Today / Money / Review / More

Replace `filings` with `review` in `BusinessPrimaryTab`. Map the Review tab to the existing `review`
screen only after confirming it reads the active encrypted workspace and does not assume Personal
state. Keep every `business-filing-*` screen under More for tab-selection purposes; filings remain
reachable from existing More or Business surfaces but are not a primary tab.

Update `BusinessBottomNav`, `businessNavigation.ts`, `FolioShell` callbacks and comments together.
Do not rename Business filing route IDs or remove filing functionality.

### Step 5: Lock the contracts with focused tests

Add pure mapping tests covering:

- every primary tab's destination;
- Plan/Review and Business Review active selection;
- representative More child screens;
- every Business filing child mapping to More;
- unknown/non-primary screens falling back to More, not Today.

Add one lightweight component test for the visible tab labels, roles, selection state and press
callbacks in both navs. Assert Personal has no “Talk to Melo” tab and Business has no “Filings” tab.
Add a shell-level assertion or focused source contract that a labelled Melo companion action remains
reachable; do not rely only on a screenshot.

### Step 6: Validate before publishing

Run the focused navigation suite, typecheck and full root CI. Review `git diff --check` and the staged
file list. The full gate must include the companion tests added by plan 007 and the confidence gate
repaired by plan 003.

Do not fix broad pre-existing CRLF/Prettier findings by mass-formatting the repository. Format only
the files owned by this plan.

### Step 7: Publish the reviewed branch without changing repository history

Only after plans 001-007 and this plan are implemented, reviewed, committed and green, re-run the
remote collision check. If the remote branch is absent, publish with:

```powershell
git push --set-upstream origin codex/melo-one-app-convergence-2026-08-15
```

If the remote branch already exists, require that its tip is an ancestor of local HEAD before a
normal push. Stop on divergence; never add `--force` or `--force-with-lease` automatically.

Record the remote branch URL and final commit in the authority document or release handoff. If GitHub
credentials and policy permit, open a PR to the existing default branch with the repository template;
do not merge it, change the default branch or delete branches without an operator's explicit approval.

## Test plan

- Unit: complete Personal and Business screen-to-tab/tab-to-screen mappings.
- Component: exact four-tab labels, roles, selected states and callbacks for both workspaces.
- Integration: shell routes to existing Plan and Review screens and retains an accessible contextual
  Melo entry.
- Documentation: every active status/index link resolves inside this repository; old records are
  labelled historical/superseded rather than erased.
- Delivery: `pnpm run ci` passes before publication; remote branch tip matches the reviewed local
  commit after publication.

## Done criteria

- The existing repository and `apps/mobile` are named as the current Melo authorities in a dated,
  repository-local decision record.
- The incorrect “no authoritative native repository found” claim is explicitly superseded.
- Personal shows Today / Plan / Review / More; Business shows Today / Money / Review / More.
- Melo remains reachable contextually and is not a primary bottom tab.
- Filing functionality remains reachable but does not own a Business primary tab.
- Root README, status, historical plan index, PR template and convergence authority agree.
- All focused tests, typecheck and `pnpm run ci` pass.
- Publication uses the existing `origin`, a normal push and the reviewed branch; no new repository or
  rewritten history exists.

## STOP conditions

- Any plan 001-007 dependency is not DONE or full CI is red.
- `git rev-parse --show-toplevel` does not resolve to this repository, `origin` is not the expected
  existing repository, or the working branch contains an unrelated fork.
- The existing `review` screen is not workspace-partitioned in Business mode. Keep Business Review
  unexposed until ISOLATION-01 is extended and verified; do not route around the boundary.
- Removing the Melo nav entry would leave no accessible contextual companion action.
- The remote branch exists with non-ancestor commits, authentication targets another account, or a
  push would require history rewriting.
- Publication would include unrelated untracked evidence or secrets.
- An executor is asked to create a new repository, merge/default-promote automatically, rewrite the
  app, or split the store without measurement and a separately approved plan.

## Maintenance notes

- Treat `MELO_REPOSITORY_AND_NAVIGATION_AUTHORITY.md` as the small routing document; keep detailed
  release evidence in its existing evidence files rather than growing another master plan.
- When navigation changes, update the pure mapping tests and both authority records in the same PR.
- “Promote” means establish reviewed repository/branch authority and present it for integration. A
  remote default-branch change remains a deliberate operator action.
- Once merged, replace branch-specific status wording with the immutable merge commit or release tag.
