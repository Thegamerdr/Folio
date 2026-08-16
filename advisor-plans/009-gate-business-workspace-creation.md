# Plan 009: Keep Business creation behind a fail-closed beta gate

> **Executor instructions**: Execute after plans 002 and 008 are DONE. This gate controls new
> Business workspace creation only; it must not strand or hide an existing Business workspace. Follow
> every step and verification gate. Leave the public flag disabled while any required beta blocker is
> open. Update `advisor-plans/README.md` when done unless a reviewer owns the index.
>
> **Drift check (run first)**:
> `git diff --stat f7b91c7..HEAD -- apps/mobile/app.config.ts apps/mobile/eas.json apps/mobile/package.json apps/mobile/src/folio/sheets/WorkspaceSheet.tsx apps/mobile/src/folio/lib/persist.ts packages/business-workspace/src/index.ts packages/business-workspace/test/business-workspace.test.ts tooling/config/release-blockers.json tooling/scripts/check-release-blockers.mjs docs/release-evidence/C13-business-workspace.md`
> Plans 002 and 008 are expected to change workspace isolation and navigation. Reconcile them. Stop
> if workspace creation has moved to another entry point or Business isolation is not proven.

## Status

- **Execution status**: DONE; published with the flag disabled and blocker unchanged
- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: `advisor-plans/002-stop-cross-workspace-melo-financial-state.md`,
  `advisor-plans/008-publish-authority-and-reconcile-navigation.md`
- **Category**: release safety, feature gate, Business beta
- **Planned at**: commit `f7b91c7`, 2026-08-16

## Why this matters

The current workspace sheet always offers “Add a business workspace” when none exists, although the
repository's release register still marks Business tax/legal beta approval blocked. That exposes a
high-consequence surface before its legal, support, accessibility, entitlement and isolation gates
are complete. The smallest safe change is a build-time, fail-closed creation flag tied to the release
blocker register. Existing Business users retain access to their partition and records.

## Current state

- `apps/mobile/src/folio/sheets/WorkspaceSheet.tsx:293-312` renders the Business creation control
  whenever `business === undefined`; no readiness or feature flag is consulted.
- The same component's `saveEditor` calls `createAndActivatePersistedBusinessWorkspace` when mode is
  `create`.
- `apps/mobile/src/folio/lib/persist.ts:1228-1281` owns persisted Business creation and activation.
  It is also used directly by recovery tests and should not be coupled to Expo configuration.
- `packages/business-workspace/src/index.ts:1191-1237` already aggregates detailed Business beta
  readiness with `evaluateBusinessBetaGate`, but it is currently evidence/test logic, not a runtime
  remote flag.
- `tooling/config/release-blockers.json` marks `RB-BUSINESS-TAX-BETA` as `blocked` with
  `beta_blocking` impact.
- `docs/release-evidence/C13-business-workspace.md` records the remaining tax/legal and beta
  operations gaps.
- `apps/mobile/app.config.ts` already exposes public build configuration through `extra` and uses
  exact environment names. There is no general remote feature-flag system to extend.

## Commands you will need

| Purpose            | Command                                                                                                                                                                                                                                                                                                                                                                                           | Expected on success                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Gate unit tests    | `pnpm exec vitest run apps/mobile/src/folio/lib/businessBeta.test.ts apps/mobile/src/folio/sheets/WorkspaceSheet.test.tsx tooling/scripts/check-business-beta-exposure.test.mjs --passWithNoTests`                                                                                                                                                                                                | exit 0; all files collected                      |
| Closed-gate check  | `Remove-Item Env:EXPO_PUBLIC_MELO_BUSINESS_BETA -ErrorAction SilentlyContinue; pnpm check:business-beta-exposure`                                                                                                                                                                                                                                                                                 | exit 0 and reports disabled                      |
| Blocked-open check | `$env:EXPO_PUBLIC_MELO_BUSINESS_BETA='true'; pnpm check:business-beta-exposure; $code=$LASTEXITCODE; Remove-Item Env:EXPO_PUBLIC_MELO_BUSINESS_BETA; exit $code`                                                                                                                                                                                                                                  | non-zero while `RB-BUSINESS-TAX-BETA` is blocked |
| Typecheck          | `pnpm typecheck`                                                                                                                                                                                                                                                                                                                                                                                  | exit 0                                           |
| Full gate          | `pnpm run ci`                                                                                                                                                                                                                                                                                                                                                                                     | exit 0 with the public flag absent/false         |
| Formatting         | `pnpm exec prettier --check package.json apps/mobile/app.config.ts apps/mobile/package.json apps/mobile/src/folio/lib/businessBeta.ts apps/mobile/src/folio/lib/businessBeta.test.ts apps/mobile/src/folio/sheets/WorkspaceSheet.tsx apps/mobile/src/folio/sheets/WorkspaceSheet.test.tsx tooling/scripts/check-business-beta-exposure.mjs tooling/scripts/check-business-beta-exposure.test.mjs` | exit 0                                           |

## Scope

**In scope**:

- `package.json`
- `apps/mobile/app.config.ts`
- `apps/mobile/package.json`
- `apps/mobile/src/folio/lib/businessBeta.ts` (new)
- `apps/mobile/src/folio/lib/businessBeta.test.ts` (new)
- `apps/mobile/src/folio/sheets/WorkspaceSheet.tsx`
- `apps/mobile/src/folio/sheets/WorkspaceSheet.test.tsx` (new)
- `tooling/scripts/check-business-beta-exposure.mjs` (new)
- `tooling/scripts/check-business-beta-exposure.test.mjs` (new)

**Read-only references**:

- `apps/mobile/src/folio/lib/persist.ts`
- `packages/business-workspace/src/index.ts`
- `packages/business-workspace/test/business-workspace.test.ts`
- `tooling/config/release-blockers.json`
- `docs/release-evidence/C13-business-workspace.md`

**Out of scope**:

- Enabling the Business beta or changing `RB-BUSINESS-TAX-BETA` to ready.
- Hiding, deleting or migrating an existing Business workspace.
- Replacing the release register with a remote feature-flag service.
- Adding multiple Business workspaces, new entitlements, tax claims or compliance features.
- Moving build configuration into the store or persistence layer.
- Rewriting workspace creation or the app.

## Git workflow

- Branch: `advisor/009-business-creation-gate`, based on the reviewed result of plan 008.
- Commit example: `fix(mobile): gate Business workspace creation`.
- Do not push, deploy, enable the flag or update external blocker evidence unless separately instructed.

## Steps

### Step 1: Define one strict public flag contract

Add `EXPO_PUBLIC_MELO_BUSINESS_BETA` to `apps/mobile/app.config.ts` under `extra`. Treat only the exact
trimmed, lowercase string `true` as enabled. Missing, empty, `1`, `yes`, mixed case and all other
values are disabled. Do not add a hardcoded true fallback in any build profile.

Create `businessBeta.ts` with a small pure parser plus a resolver that follows existing mobile
precedent: `process.env` first, then `Constants.expoConfig.extra`. Export a semantically named
`isBusinessWorkspaceCreationEnabled()` function; do not expose raw strings throughout UI code.

This is a build-distributed gate, not a security boundary and not a dynamic rollout system. Document
that changing it requires a reviewed build/update after the release blocker is closed.

### Step 2: Gate creation without gating existing Business access

In `WorkspaceSheet`, resolve the creation gate once. Render “Add a business workspace” only when:

1. there is no existing Business workspace, and
2. the strict gate is enabled.

Also reject `mode.kind === 'create'` inside `saveEditor` when the gate is disabled, before calling
persistence. Reset to list mode with a neutral unavailable message. This defensive check prevents a
stale test state or future alternate entry path inside the sheet from bypassing visibility.

Do not apply the flag to workspace listing, activation, rename, archive or restore. A user who already
has a Business partition must be able to open and manage it while new creation is disabled.

Do not change `createPersistedBusinessWorkspace` solely to read Expo configuration. That lower-level
function is part of persistence recovery tests and may be needed by controlled migration/tooling;
the product exposure boundary belongs at the UI/use-case edge.

### Step 3: Tie enabled builds to the authoritative blocker register

Add `tooling/scripts/check-business-beta-exposure.mjs`. It must:

- parse the flag with the same exact-true contract;
- resolve `tooling/config/release-blockers.json` relative to the repository/script, never the caller's
  current directory;
- locate exactly one blocker with ID `RB-BUSINESS-TAX-BETA`;
- exit 0 immediately when the flag is disabled;
- exit non-zero when the flag is enabled and the blocker is missing, duplicated, malformed, or not
  explicitly ready/closed under the register's actual status vocabulary;
- print blocker IDs and states, never secrets or the complete environment.

Add `check:business-beta-exposure` to root scripts and compose it into `lint` before broad release
checks. Add an `eas-build-pre-install` script in `apps/mobile/package.json` that invokes the same root
checker so an EAS build cannot bypass root CI merely by setting the environment flag.

Do not make the checker infer readiness from prose in `C13-business-workspace.md` or call
`evaluateBusinessBetaGate` with fabricated inputs. The release blocker register is the machine gate;
the detailed evaluator and evidence explain why an operator may close it.

### Step 4: Prove fail-closed and non-destructive behavior

Unit-test the parser/resolver with environment and Expo-extra precedence. Clear and restore environment
variables in every test so local developer state cannot leak between cases.

Component-test the workspace sheet with:

- no Business + absent flag: creation control absent;
- no Business + false/malformed flag: absent;
- no Business + exact true: creation control present;
- existing active or archived Business + disabled flag: workspace remains listed and its allowed
  actions remain reachable;
- a forced stale create mode + disabled flag: persistence creator is not called.

Test the checker in a temporary fixture/register or through exported pure functions. Prove enabled +
blocked fails and disabled + blocked passes. Do not mutate the real blocker register in tests.

### Step 5: Leave the release default closed

Run focused tests, the disabled and deliberately blocked command checks, typecheck and full CI. Leave
the repository, EAS profiles and checked-in environment examples with the flag absent or false.

Add a short note to the existing Business release evidence identifying the flag name and linking the
machine gate. Do not claim beta readiness and do not close the blocker as part of implementation.

## Test plan

- Unit: exact boolean parsing, environment precedence, malformed configuration and missing config.
- Component: creation hidden/shown correctly and existing Business management unaffected.
- Negative integration: stale create state cannot call persistence while disabled.
- Tooling: enabled builds fail on blocked/missing/duplicate/malformed blocker; disabled builds pass.
- Regression: Business workspace persistence/isolation tests from plan 002 remain green.
- Full: `pnpm run ci` passes with no public Business beta flag.

## Done criteria

- [x] Business creation defaults disabled and only exact `true` enables it.
- [x] Both the visible creation control and its save path enforce the gate.
- [x] Existing Business workspaces remain visible, openable and manageable when creation is disabled.
- [x] Root CI and EAS builds fail if someone enables exposure while `RB-BUSINESS-TAX-BETA` is not
      explicitly closed/ready.
- [x] Tests cover absent, malformed, enabled, blocked and existing-workspace cases.
- [x] The real release blocker remains blocked and no product readiness claim is added.
- [x] Full CI passes with the closed default.

## Execution evidence — 2026-08-17

- Focused gate suite: 3 files / 15 tests passed.
- Mobile typecheck and the disabled machine-gate command passed.
- The deliberate enabled-build check exited non-zero with
  `RB-BUSINESS-TAX-BETA=blocked`, without changing the real register.
- Full `pnpm run ci` passed with 242 Vitest files / 2,791 tests, all 45 companion Node tests and
  both source-package validators.
- The public flag remains absent from checked-in build profiles, resolves to false by default, and
  the blocker remains `blocked`.

## STOP conditions

- Plan 002 isolation is not proven, or plan 008's Business Review surface is not workspace-safe.
- More than one product entry point can create a Business workspace and one cannot be gated at its
  use-case boundary.
- The blocker register has no unambiguous machine state for closed/ready. Extend its validated schema
  first; do not parse human prose.
- A release owner asks to set the flag true before tax/legal, accessibility, support, entitlement and
  operations evidence is approved.
- Gating creation would hide or disable access to an existing Business partition.
- The only proposed solution requires a remote flag dependency, store rewrite or new repository.

## Maintenance notes

- Remove the gate only through a separately reviewed decision after the blocker is closed; do not
  leave an always-true compatibility flag indefinitely.
- If a second Business creation entry is introduced, make the use-case guard reusable rather than
  copying raw environment parsing.
- Keep the detailed `evaluateBusinessBetaGate` as evidence aggregation. The public exposure flag and
  machine blocker check answer a narrower question: may this build offer creation at all?
