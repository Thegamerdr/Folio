# R0 Public Release Blocker Gate

## Scope

This is not a new product phase. The implementation backlog ends at Phase 14. This record turns the
remaining external blockers into a repeatable release gate so the repo can stay
implementation-complete while public release remains blocked.

## What was built

- Added pure `@folio/release-gate` package.
- Added `tooling/config/release-blockers.json` as the machine-readable blocker register.
- Added `tooling/scripts/check-release-blockers.mjs`.
- Added one current-evidence artifact row for every registered blocker.
- Added release operations pack for the `RB-T185` incident/support runbook blocker.
- Added store declaration pack for the `RB-T183` Apple/Google declaration blocker.
- Added root commands:
  - `pnpm operations:status`
  - `pnpm operations:guard`
  - `pnpm store:status`
  - `pnpm store:guard`
  - `pnpm release:status`
  - `pnpm release:guard`

## Gate behavior

- `pnpm release:status` validates the register and reports the current blocked state.
- `pnpm check:release-blockers` runs the same validation inside normal lint/CI, checks blocker
  source paths and checks current-evidence artifact paths.
- `pnpm check:operations-readiness` validates the operations pack inside normal lint/CI.
- `pnpm check:store-declarations` validates the store declaration pack inside normal lint/CI.
- `pnpm operations:guard` intentionally fails until tabletop, rotation drills and vulnerability
  disclosure readiness are complete.
- `pnpm store:guard` intentionally fails until submitted-binary review and store-console
  declarations are complete.
- `pnpm release:guard` intentionally fails until the public-release flag is enabled and all
  release-blocking blockers are closed with evidence.
- Synthetic emulator, Figma and contract evidence cannot satisfy public release by themselves.
- Closed external blockers require independent external reviewer evidence metadata. Local notes,
  emulator screenshots or synthetic evidence cannot close external signoff blockers.

## Blocker classes

| Class                  | Meaning                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `local_machine_check`  | Can eventually be closed by repeatable local command/device artifacts.  |
| `local_docs_evidence`  | Needs local evidence records such as runbooks or tabletop notes.        |
| `external_device`      | Needs device or platform access unavailable in this workspace.          |
| `external_credentials` | Needs store/provider credentials or signing access.                     |
| `external_signoff`     | Needs independent legal, security, privacy or accessibility approval.   |
| `external_service`     | Needs live provider/backend/monitoring operations.                      |
| `roadmap_program`      | Must stay out of implementation until a separate programme is approved. |

## Current status

The gate is blocked by design. `pnpm check:release-blockers` currently reports:

- 23 open blockers out of 23 registered blockers.
- 14 release-blocking blockers.
- 6 beta-blocking blockers.
- 3 roadmap-blocking blockers.
- 17 external blockers.
- 2 local machine-check blockers.
- 1 local docs/evidence blocker.
- 23 current-evidence rows.
- 0 missing current-evidence files.

It includes release-blocking rows for:

- iOS native install/launch evidence.
- Keychain/Keystore, recovery wrapping and app lock.
- Encrypted document/OCR proof.
- Vault-backed writes, offline E2E and resilience drills.
- Independent security, privacy/legal/DPIA and accessibility reviews.
- Account providers and account deletion routes.
- Incident/support runbook pack, while tabletop and rotation evidence remain blocked.
- Store declaration pack, while submitted-binary and store-console evidence remain blocked.
- Apple/Google store declarations.
- Native StoreKit 2 and Google Play Billing.
- Incident tabletop, rotations and disclosure readiness.
- Full release regression and store builds.
- Limited UK launch operations and thresholds.

Roadmap rows keep household collaboration, direct HMRC MTD and additional jurisdictions separate
and blocked.

## Verification

Completed on 2026-06-21:

- `pnpm --filter @folio/release-gate typecheck`: passed.
- `pnpm exec vitest run packages/release-gate/test/release-gate.test.ts --passWithNoTests`:
  passed, 1 file and 9 tests.
- `pnpm check:operations-readiness`: passed; current operations state is blocked with 3 blockers.
- `pnpm operations:guard`: failed as expected with exit code 1 because tabletop, rotation and
  disclosure blockers remain open.
- `pnpm check:store-declarations`: passed; current store declaration state is blocked with 14
  blockers.
- `pnpm store:guard`: failed as expected with exit code 1 because submitted-binary and
  store-console declaration blockers remain open.
- `pnpm check:release-blockers`: passed; current state is blocked by policy and evidence.
- `pnpm release:guard`: failed as expected with exit code 1 because release blockers remain open.

Final full-gate commands are recorded in `STATUS.md`.

## Official store references checked

- Apple App Privacy in App Store Connect:
  `https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/`
- Apple account deletion guidance:
  `https://developer.apple.com/support/offering-account-deletion-in-your-app/`
- Google Play Data safety form:
  `https://support.google.com/googleplay/android-developer/answer/10787469`
- Google Play account deletion requirements:
  `https://support.google.com/googleplay/android-developer/answer/13327111`
