# Melo advisor implementation plans

Self-contained execution plans for the 2026-08-16 Melo safety and authority work, produced from the
repository at commit `f7b91c7` on `codex/melo-one-app-convergence-2026-08-15`.

These are advisory artifacts. No application source, repository history, remote branch, deployment
or release state was changed while preparing them.

## Required order

| Order | Work ID                | Plan                                                                                                              | Priority | Effort | Risk | Status |
| ----: | ---------------------- | ----------------------------------------------------------------------------------------------------------------- | :------: | :----: | :--: | :----: |
|     1 | MIGRATION-01           | [001 — Block every write when persisted data is newer than the app](001-block-future-schema-overwrite.md)         |    P0    |   M    | HIGH |  DONE  |
|     2 | ISOLATION-01           | [002 — Keep financial Melo state inside its owning workspace](002-stop-cross-workspace-melo-financial-state.md)   |    P0    |   M    | MED  |  DONE  |
|     3 | TRUST-01               | [003 — Remove unsupported confidence claims and restore CI](003-remove-unsupported-confidence-claims.md)          |    P1    |   M    | MED  |  DONE  |
|     4 | SECURITY-01            | [004 — Remove plaintext picker files from the app cache](004-remove-plaintext-picker-cache.md)                    |    P1    |   M    | MED  |  DONE  |
|     5 | IMPORT-01              | [005 — Preserve legitimate repeated transactions during import](005-preserve-legitimate-repeated-transactions.md) |    P1    |   M    | MED  |  TODO  |
|     6 | CALENDAR-01            | [006 — Use workspace-local dates for financial events](006-use-workspace-local-financial-dates.md)                |    P2    |   M    | MED  |  TODO  |
|     7 | TEST-01                | [007 — Run the shipping companion test suite in root CI](007-run-companion-tests-in-ci.md)                        |    P2    |   S    | LOW  |  TODO  |
|     8 | AUTHORITY-01 + DOCS-01 | [008 — Publish repository authority and reconcile navigation](008-publish-authority-and-reconcile-navigation.md)  |    P1    |   M    | MED  |  TODO  |
|     9 | BETA-01                | [009 — Keep Business creation behind a fail-closed beta gate](009-gate-business-workspace-creation.md)            |    P1    |   S    | MED  |  TODO  |
|    10 | SECURITY-02            | [010 — Harden Play verification before public reachability](010-harden-public-play-verification.md)               |    P1    |   M    | HIGH |  TODO  |

DOCS-01 is intentionally folded into plan 008. It does not have a separate branch, status line or
large workstream.

## Dependency and release gates

- Plan 001 is the first write-safety boundary.
- Plan 002 executes on plan 001's safe persistence result.
- Plan 003 executes after plans 001-002 because it may migrate persisted trusted-core fields.
- Plan 004 has no technical dependency on trust work but remains fourth to preserve the requested
  review and implementation sequence.
- Plan 005 follows plan 004 because both touch document/transaction intake paths.
- Plan 006 follows plan 005 because both touch import and financial date creation behavior.
- Plan 007 is technically independent but remains seventh.
- Plan 008 starts only after plans 001-007 are green, then publishes the reviewed existing branch.
- Plan 009 requires workspace isolation and the authoritative navigation result. The Business beta
  flag must remain off until `RB-BUSINESS-TAX-BETA` is explicitly closed.
- Plan 010 is scheduled last. Play verification must remain independently disabled until its body
  bound, abuse controls, operator resources and monitoring evidence are approved.

## Binding execution rules

1. Work only in the existing repository at `C:\dev\melo-phase-d-work`. Do not create a repository,
   app fork, parallel runtime or replacement lineage.
2. Run each plan's drift check before editing. The source snapshot is `f7b91c7`; reconcile reviewed
   preceding-plan changes, and stop on unrelated architectural drift.
3. Implement and review in the order above. Each executor starts from the accepted result of required
   predecessors, uses the branch/commit guidance in its plan, and updates this table from TODO only
   after every done criterion passes.
4. Preserve encrypted workspace partitions and existing transaction IDs. Do not turn a targeted fix
   into a persistence rewrite.
5. Do not split the 8,975-line store as preparatory cleanup. First measure startup/hydration time,
   write amplification, render subscriptions and test/build cost on representative data. A split
   needs a separate evidence-backed plan only if a measured bottleneck remains.
6. Do not force-push, rewrite history, merge a PR, change a remote default branch, deploy a Worker,
   enable a public gate or set external secrets unless the relevant plan and operator authorization
   explicitly permit it.
7. Existing untracked screenshots, XML captures and `tmp/` evidence predate these plans. Do not stage,
   delete or move them as part of implementation.
8. Format owned files only. Do not mass-normalize unrelated CRLF files to make Prettier green.

## Survey baseline

At the planning snapshot:

- `pnpm typecheck` passed.
- The primary Vitest run passed 235 files and 2,719 tests.
- The separately invoked shipping companion suite passed 45 tests but was not reached by root `test`;
  plan 007 composes it into CI.
- Source-package contract validation passed.
- `pnpm run ci` was red at the confidence-claim gate; plan 003 removes the unsupported user-facing
  contract and restores the gate.
- Repository-wide Prettier reported many untouched CRLF files. That baseline is not authority to
  rewrite unrelated files.

Re-run the relevant baseline after every accepted plan; do not carry these counts forward as proof.

## Minimal design choices

The plans deliberately choose the smallest seam that fixes each root cause:

- a future-schema write interlock, not a storage rewrite;
- a reduced shared-state allowlist, not a new global companion database;
- removal of unsupported confidence presentation, not cosmetic renaming of every internal parser
  uncertainty field;
- an app-owned staging directory with deterministic cleanup, not a broad cache purge;
- stable source-row identity, not natural-key deletion or fuzzy duplicate matching;
- one timezone-to-LocalDate helper, not a calendar framework;
- composition of the existing Node companion suite, not migration to another test runner;
- one repository authority correction with DOCS-01 included, not another master-plan hierarchy;
- one build-distributed Business creation flag tied to the existing blocker register, not a remote
  feature-flag platform;
- native Cloudflare rate-limit bindings plus a bounded reader, not a new gateway or dependency.

## Explicitly rejected

- Creating a new repository or rewriting the Melo app.
- Splitting the store before measurement.
- Replacing the encrypted persistence layer while fixing migration rollback.
- Silently dropping same-date/same-amount/same-description transactions.
- Broadly deleting cache files the app does not own.
- Treating internal parser uncertainty as a user-facing confidence promise.
- Publishing navigation documents that disagree with the running app.
- Exposing Business creation while its beta blocker is open.
- Relying on CORS, a client secret, raw purchase tokens or an IP-only limiter to protect Play
  verification.
- Automatically pushing unrelated evidence, force-pushing, merging, changing the default branch or
  deploying public services.

## Completion handoff

For each plan, record:

- final commit and branch;
- commands run with exit status and collected test counts;
- migration/relaunch or adversarial evidence required by that plan;
- any STOP condition encountered and the owner needed to unblock it;
- remaining rollout action that was deliberately not automated.

When plan 008 is complete, its dated repository authority record supersedes only the incorrect “no
repository” claim and the conflicting navigation contract; it does not erase the historical source
documents or waive later Business and billing gates.
