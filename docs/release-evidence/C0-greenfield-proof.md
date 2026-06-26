# C0 Greenfield Proof

## Phase / task IDs

Phase 0: T001 through T012.

| Task                                   | Status                            | Evidence                                                                                                                                        |
| -------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| T001 Create greenfield repository      | Complete                          | `C:\dev\folio-v2-greenfield`, CI evidence below                                                                                                 |
| T002 Establish package layout          | Complete                          | `apps/`, `packages/`, strict project references                                                                                                 |
| T003 Add source package                | Complete                          | `docs/source-package`, contract validation                                                                                                      |
| T004 Add CI and boundary gates         | Complete                          | `.github/workflows/ci.yml`, `tooling/scripts/*`                                                                                                 |
| T005 Create source/licence register    | Complete                          | `docs/source-and-licence-register.md`                                                                                                           |
| T006 Add synthetic data policy         | Complete                          | `docs/synthetic-data-policy.md`, `pnpm check:samples`                                                                                           |
| T007 Add ADR process                   | Complete                          | `docs/adr/*`                                                                                                                                    |
| T008 Add initial contracts/tests       | Complete                          | `packages/domain`, `packages/storage`, tests                                                                                                    |
| T009 Freeze V1 reference               | Complete                          | `docs/v1-donor-audit/FREEZE.md`                                                                                                                 |
| T010 Inventory V1 assets               | Complete                          | `docs/v1-donor-audit/inventory.csv`                                                                                                             |
| T011 Establish V2 design-token sandbox | Complete                          | `packages/ui`, `docs/release-evidence/T011-accessibility-token-proof.md`, Figma node `1:3`                                                      |
| T012 Wire CI device build smoke tests  | Complete for Android; iOS blocked | Expo Doctor/prebuild pass; Android dev build installed/launched on emulator; iOS blocker recorded in `docs/release-evidence/C0-native-smoke.md` |

## What was built

- Clean repository at `C:\dev\folio-v2-greenfield`.
- pnpm workspace with strict TypeScript project references.
- Architecture package layout for mobile, pure engines, storage, crypto, sync, AI contracts, policy packs, UI and testing.
- Source package copied to `docs/source-package` for contract validation and implementation traceability.
- CI workflow for install, lint, typecheck, tests and contract validation.
- Dependency-boundary lint for pure engine packages.
- Repeatable V1 runtime-boundary proof with hash-intersection checking.
- Product constitution PR gate.
- Synthetic data policy and scanner.
- ADR process and accepted ADRs for repo boundaries, phase/design evidence and Expo native smoke.
- V1 donor audit freeze, manifest, normalized inventory and runtime-dependency proof.
- Expo SDK 56 development-build mobile shell with Expo Router and token proof screen.
- `@folio/ui` token sandbox with 48dp touch targets, typography, status semantics, interaction states, reduced motion and money text rules.
- Editable Figma Phase 0 evidence board at `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=1-3`.
- Android live preview on `emulator-5554` / `CloseLedger_Phone` using `com.folio.v2.greenfield`.
- Local-first Android product slice with onboarding, Today, Money, Sources, import review, local Melo guidance and native SQLite restart persistence.

## Files changed

- Root tooling: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `tsconfig.packages.json`, `vitest.config.ts`, `turbo.json`.
- CI/governance: `.github/workflows/ci.yml`, `.github/pull_request_template.md`.
- Tooling scripts: `tooling/scripts/check-boundaries.mjs`, `tooling/scripts/check-synthetic-data.mjs`, `tooling/scripts/check-constitution-gate.mjs`, `tooling/scripts/check-v1-boundary.mjs`.
- Mobile shell: `apps/mobile/*`.
- Package skeletons and contracts: `packages/*`.
- Evidence/docs: `STATUS.md`, `docs/adr/*`, `docs/source-package`, `docs/release-evidence/*`, `docs/v1-donor-audit/*`, `docs/privacy-security`, `docs/synthetic-data-policy.md`, `docs/source-and-licence-register.md`, `docs/release-compatibility-matrix.md`, `docs/phase-execution-protocol.md`.

## Contracts implemented

- `DatabaseDriver` abstraction exists in `@folio/storage`.
- Initial `Money`, `CurrencyCode` and `WorkspaceId` value objects exist in `@folio/domain`.
- Pure package boundary rules block React, React Native, Expo, SQLite, SQLCipher, cloud SDK, AI-provider and app/service imports.
- V1 boundary rules block V1 path/name markers, Electron/Vite-era donor dependencies and hash matches against the V1 freeze manifest.
- PR constitution gate requires local-first, advice-boundary, workspace-isolation and accessibility checks.
- Source contracts from the package are present under `docs/source-package`.
- Expo Go is invalid for native evidence; Phase 0 native evidence must use a development build path.

## Tests run and results

| Command                                                               | Result                                                                                                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run ci`                                                         | Passed on 2026-06-21.                                                                                                                    |
| `pnpm lint:boundaries`                                                | Passed.                                                                                                                                  |
| `pnpm check:v1-boundary`                                              | Passed: 145 V2 runtime/package files checked against 859 unique V1 freeze hashes.                                                        |
| `pnpm typecheck`                                                      | Passed.                                                                                                                                  |
| `pnpm test`                                                           | Passed: 37 files and 347 tests.                                                                                                          |
| `pnpm validate:contracts`                                             | Passed: 75 files, 15,681 lines, 69,277 words, 192 tasks, 32 risks, 18 forecast vectors, 15 import vectors, 14 fixture cases, 0 failures. |
| `pnpm --filter @folio/mobile doctor`                                  | Passed: 21/21 checks.                                                                                                                    |
| `pnpm --filter @folio/mobile exec expo install --check`               | Passed.                                                                                                                                  |
| `pnpm --filter @folio/mobile exec expo prebuild --clean --no-install` | Passed.                                                                                                                                  |
| `pnpm --filter @folio/mobile native:smoke:android`                    | Passed: Gradle build succeeded, APK installed and dev-client URL opened on `CloseLedger_Phone`; existing Metro on `8081` was reused.     |
| `pnpm --filter @folio/mobile native:smoke:ios`                        | Blocked: iOS local builds require macOS; EAS iOS build needs signing credentials.                                                        |

## Offline evidence

The repository has no runtime network requirement. Baseline install uses the package registry; Expo native build dependencies require platform toolchains. The mobile shell does not require account login, AI access or telemetry for local use.

## Accessibility evidence

- UI tokens require a 48dp minimum touch target.
- Reduced motion has zero-duration, no-transform rules.
- Semantic statuses include non-color affordances: icon name, label, shape/pattern and screen-reader prefix.
- Money text rules require tabular, no-wrap, integer-minor-unit rendering without binary floats or digit clipping.
- Huashu critique is recorded in `docs/release-evidence/T011-accessibility-token-proof.md`.
- Figma token proof is published at `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=1-3`.
- Device-rendered Android proof is captured in `docs/release-evidence/android-live-preview.png`.
- Real VoiceOver/TalkBack audits remain future work; Phase 0 token and hit-target proof is in place.

## Security/privacy impact

- No real financial data is committed.
- No telemetry or crash-reporting runtime exists.
- Financial content remains excluded by synthetic-data policy.
- No V1 runtime dependency, database, schema, route, state model or package graph has been imported.
- V1 donor assets remain documentation/inventory only until source/licence approval.

## V1 donor items used and approval reference

None were copied into runtime.

The V1 snapshot and inventory are audit evidence only:

- `docs/v1-donor-audit/FREEZE.md`
- `docs/v1-donor-audit/freeze-manifest.csv`
- `docs/v1-donor-audit/inventory.csv`
- `docs/v1-donor-audit/runtime-dependency-proof.md`

## Screenshots/recording where visible

Editable Figma evidence: `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=1-3`.

Android live-preview screenshot: `docs/release-evidence/android-live-preview.png`.

Current local-first APK product evidence:

- `docs/release-evidence/local-first-apk-live-slice.md`
- `docs/release-evidence/android-product-visible-root-closed.png`
- `docs/release-evidence/android-product-today-live.png`
- `docs/release-evidence/android-product-sources-live.png`
- `docs/release-evidence/android-product-money-live.png`
- `docs/release-evidence/android-product-after-add-spend.png`
- `docs/release-evidence/android-product-restart-root.xml`

## Known limitations/risks

- V1 source is not a Git worktree, so the freeze records package version, snapshot path, read-only state and file hashes instead of a commit hash.
- Android install/launch/live-preview evidence requires exporting the Android Studio JBR and Android SDK paths in local shells.
- Current Android artifact is a debug development-client APK, so Expo dev tooling can appear and Metro is required for live preview.
- iOS install/launch evidence is blocked until macOS/Xcode or EAS iOS signing credentials are available.
- iOS-specific native claims must stay blocked until macOS/EAS evidence exists.

## Next exact step

Proceed to Phase 1 native risk spikes using Android evidence, while carrying the iOS macOS/EAS blocker explicitly.
