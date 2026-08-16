# Plan 007: Run the shipping companion test suite in root CI

> **Executor instructions**: This is intentionally small. Do not migrate the `.mjs` companion engine
> or replace its runner. Run every command and update `advisor-plans/README.md` when done.
>
> **Drift check (run first)**:
> `git diff --stat f7b91c7..HEAD -- package.json packages/melo-companion-engine/package.json vitest.config.ts .github/workflows/ci.yml apps/mobile/src/folio/companion/MeloCompanionHost.tsx`
> Stop if root CI no longer invokes `pnpm run ci` or the companion package is no longer shipped.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none; execute seventh in the requested sequence
- **Category**: tests, CI
- **Planned at**: commit `f7b91c7`, 2026-08-16

## Why this matters

The mobile app imports `@folio/melo-companion-engine`, but its 45 Node tests are not collected by the
root Vitest command. Main CI can therefore be green while the shipped companion runtime is broken.
The smallest fix is to make the existing package test an explicit part of the canonical root test
contract.

## Current state

- `apps/mobile/src/folio/companion/MeloCompanionHost.tsx:26-35` imports the package in production.
- `packages/melo-companion-engine/package.json:15-17` defines
  `test: node --test test/*.test.mjs`.
- `vitest.config.ts:5-10` collects only `*.test.ts` patterns.
- Root `package.json:21,39` runs `pnpm test` from `pnpm run ci`, but root `test` is only Vitest.
- `.github/workflows/ci.yml:25-26` installs then calls `pnpm run ci`.
- The separate package command currently passes 45 tests.

## Commands you will need

| Purpose    | Command                                           | Expected on success                                 |
| ---------- | ------------------------------------------------- | --------------------------------------------------- |
| Companion  | `pnpm --filter @folio/melo-companion-engine test` | exit 0; 45 or more tests pass                       |
| Root tests | `pnpm test`                                       | exit 0 and output includes the companion Node suite |
| CI         | `pnpm run ci`                                     | exit 0 after plan 003 is complete                   |
| Formatting | `pnpm exec prettier --check package.json`         | exit 0                                              |

## Scope

**In scope**:

- `package.json`
- `packages/melo-companion-engine/package.json` only if its test script is broken
- `.github/workflows/ci.yml` only if root script integration cannot provide visible CI execution

**Out of scope**:

- Rewriting `.mjs` tests in TypeScript or Vitest.
- Changing companion behavior, animation or production integration.
- Adding a task runner or CI matrix.
- Copying tests into the mobile package.

## Git workflow

- Branch: `advisor/007-companion-ci`.
- Commit example: `test(ci): run companion engine suite`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add an explicit root companion test script

Add `test:companion` to root `package.json` with the existing filtered package command. Compose it into
the root `test` script after Vitest so `pnpm test` is the canonical all-tests entry point. Keep
`pnpm run ci` unchanged unless a clear reason requires otherwise.

Do not invoke the package through Vitest; Node's test runner is part of this package's current
contract.

**Verify**: `pnpm --filter @folio/melo-companion-engine test` → exit 0, 45 or more tests pass.

### Step 2: Prove root CI reaches the suite

Run `pnpm test` and confirm the command/output includes both Vitest and
`@folio/melo-companion-engine test`. Then run `pnpm run ci` after plan 003 has restored the product
gate. No workflow duplication is needed because GitHub Actions already calls the root CI script.

If command output is too opaque to prove execution, add a small script-contract test under `tooling/`
that reads root `package.json` and asserts root `test` invokes `test:companion`; prefer that over
duplicating a second command in the workflow.

**Verify**: `pnpm test` → exit 0 with companion suite visible.

### Step 3: Check the diff stays minimal

Inspect `git diff`. There should be no production-code or dependency change.

**Verify**: `git diff --check` → no errors.

## Test plan

- Existing 45 companion tests are the behavior coverage.
- Root `pnpm test` is the integration assertion.
- Optional tooling contract test only if execution cannot otherwise be demonstrated.

## Done criteria

- [x] `pnpm test` runs Vitest and the companion Node suite.
- [ ] `pnpm run ci` reaches the companion suite.
- [x] Companion tests remain in their package and runner.
- [x] No production source or dependency changed.

## Execution evidence

- Direct package baseline: 45 Node tests passed.
- Root `pnpm test`: 235 Vitest files / 2,726 tests passed, followed visibly by all 45 companion Node
  tests.
- Final `pnpm run ci` observation is intentionally deferred until TRUST-01 removes the earlier known
  `canonical.fake_confidence` lint gate. The implementation commit remains bounded to `package.json`
  and this plan record; the index stays TODO until that last checkbox passes.

## STOP conditions

- The companion package is no longer imported by production mobile code.
- Its test command fails before root integration; report that independent baseline failure.
- Integration appears to require migrating runners or adding a monorepo task framework.

## Maintenance notes

When another shipping package uses a non-Vitest runner, add it to the same explicit root test
contract. Do not assume recursive workspace execution unless CI output proves it.
