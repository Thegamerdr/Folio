# C14 Store Billing Operations Release

## Phase / task IDs

Phase 14. Primary task range: T183 through T192.

## Result

Phase 14 is complete for pure store-release, billing-entitlement, operations, review, regression,
limited-launch, outcome-research and roadmap-guardrail contracts plus a synthetic-labelled Expo
Today shell. It is not complete for public release claims requiring real Apple/Google declarations,
native StoreKit 2 and Play Billing proof, backend receipt verification, account deletion routes,
tabletop exercise, rotation drills, final penetration/privacy/legal/security/accessibility signoff,
store release builds, production monitoring or limited UK launch approval.

Local core and full export remain outside billing locks. Production launch is disabled. Household
collaboration, direct HMRC MTD, accountant collaboration, multiple businesses and additional
jurisdictions remain separate programmes with no implementation start.

## What was built

- Added pure `@folio/store-release` package for Phase 14 contracts.
- Store declaration matrix for privacy policy, processor list, Apple App Privacy, privacy
  manifest, Google Data Safety, Financial Features, account deletion, reviewer mode and legal
  store scope.
- Capability-based entitlement model for local core, cloud backup, sync, cloud AI units, advanced
  imports, business workspace, business exports, Open Banking connections and full export.
- Billing lapse/downgrade rules that preserve local core, existing records and full export.
- Operations runbook state covering calculation, sync, provider, AI, tax, security and store
  removal incidents.
- Final review gate for pen test, high/critical findings, DPIA, processor inventory, legal,
  privacy, security, accessibility and current store policy review.
- Regression and store-build gate covering golden vectors, migrations, offline E2E, account
  deletion E2E, iOS/Android release builds and fixture/key exclusions.
- Limited UK production launch gate with production flag, cohorts, rollback, operational
  thresholds, support, monitoring and expansion block.
- Outcome research protocol for first minute, confidence, corrections, avoidance and plan progress
  without hidden profiling.
- Roadmap guardrails for household collaboration, direct HMRC MTD, additional jurisdictions,
  accountant collaboration and multiple businesses.
- `apps/mobile/src/phase14` mobile evidence adapter and integrated Expo Today section.

## Task coverage

| Task                                | Status                  | Evidence                                                                     |
| ----------------------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| T183 Apple/Google declarations      | Blocked for release     | Matrix exists; privacy, deletion, accessibility, legal and SDK reviews block |
| T184 Entitlements and store billing | Blocked for release     | Capability model exists; StoreKit/Play/backend/restore proof blocks          |
| T185 Incident/support runbooks      | Blocked for release     | Incident classes modelled; tabletop, rotations and disclosure channel block  |
| T186 Final pen/privacy review       | Blocked for release     | Gate exists; pen test, DPIA, legal, privacy, security and a11y block         |
| T187 Regression/store builds        | Blocked for release     | Golden/migration model exists; offline, deletion and store builds block      |
| T188 Limited UK launch              | Blocked for release     | Track model exists; production flag and operations thresholds block          |
| T189 Outcomes research              | Implemented as protocol | Five outcome families defined; no hidden profiling                           |
| T190 Household collaboration        | Blocked roadmap         | Separate privacy/threat/permissions programme required                       |
| T191 Direct HMRC MTD                | Blocked roadmap         | Dedicated HMRC conformance and legal programme required                      |
| T192 Additional jurisdictions       | Blocked roadmap         | Country launch checklist, owner, policy, bank, tax, language and legal work  |

## Verification evidence

Focused checks completed on 2026-06-21:

- `pnpm --filter @folio/store-release typecheck`: passed.
- `pnpm --filter @folio/mobile typecheck`: passed.
- `pnpm exec vitest run packages/store-release/test/store-release.test.ts apps/mobile/src/phase14/storeReleaseEvidence.test.ts --passWithNoTests`: passed, 2 files and 20 tests.

Full gates completed on 2026-06-21:

- `pnpm run ci`: passed; includes lint, typecheck, 34 test files and 319 tests, and
  contract validation.
- `pnpm lint:boundaries`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 34 files and 319 tests.
- `pnpm validate:contracts`: passed with 75 files, 15,681 lines, 192 tasks, 32 risks,
  18 forecast vectors, 15 import vectors and 14 independently checked fixture cases.
- `pnpm --filter @folio/mobile doctor`: passed, 21/21 checks.
- `pnpm --filter @folio/mobile exec expo install --check`: passed.
- `pnpm check:v1-boundary`: passed; 135 authored V2 runtime/package files checked against
  859 unique V1 freeze hashes.
- Phase 14 PNG evidence decode check: passed; Figma render is `1260x1688`, Android captures
  are `1080x2400`.
- Non-ASCII scan of 21 touched text files: passed, no matches.

## Android live preview evidence

The Phase 14 mobile shell is integrated into `apps/mobile/app/index.tsx`. Android development-client
preview was verified on `emulator-5554` using Metro port `8082`.

Actual artifacts:

- `docs/release-evidence/metro-phase14-live-preview-lan.log`
- `docs/release-evidence/android-live-preview-phase14-store.png`
- `docs/release-evidence/android-window-phase14-store.xml`
- `docs/release-evidence/android-live-preview-phase14-billing.png`
- `docs/release-evidence/android-window-phase14-billing.xml`
- `docs/release-evidence/android-live-preview-phase14-operations.png`
- `docs/release-evidence/android-window-phase14-operations.xml`
- `docs/release-evidence/android-live-preview-phase14-release.png`
- `docs/release-evidence/android-window-phase14-release.xml`
- `docs/release-evidence/android-live-preview-phase14-blockers.png`
- `docs/release-evidence/android-window-phase14-blockers.xml`
- `docs/release-evidence/android-live-preview-phase14-gate-start.png`
- `docs/release-evidence/android-window-phase14-gate-start.xml`
- `docs/release-evidence/android-live-preview-phase14-gate.png`
- `docs/release-evidence/android-window-phase14-gate.xml`
- `docs/release-evidence/android-live-preview-phase14-gate-bottom.png`
- `docs/release-evidence/android-window-phase14-gate-bottom.xml`

The Metro log records `Android Bundled 2063ms node_modules\expo-router\entry.js (1708 modules)`
and a subsequent fast bundle reload. PNG captures decode as valid `1080x2400` images.

UI tree proof:

- Store viewport confirms no real submission/billing/launch/MTD/collaboration rollout, six limited
  UK production gates blocked, no account required and incomplete declaration rows.
- Billing viewport confirms 9 capabilities, 2 placeholder mappings, no locked prices, existing
  records not tier-bound, full export available after expiry, valid grace model, and missing native
  billing proof.
- Operations viewport confirms 7 incident classes covered, support diagnostics redacted, tabletop
  and rotation drills blocked, final signoff false, one high/critical finding modelled open and
  store policy review missing.
- Release viewport confirms limited UK launch flag disabled, rollback/operations blockers, privacy
  safe outcome protocol and roadmap programmes blocked by default.
- Blockers viewport confirms Huashu anti-slop rows and visible release blockers for privacy,
  processor, Apple/Google declaration, deletion and accessibility gaps.
- Gate viewports confirm T183 through T192, with T189 implemented as protocol and T183-T188 plus
  T190-T192 blocked.

The preview proves only that the synthetic Phase 14 shell renders in the Android development
client. It does not prove real store submission, StoreKit/Play Billing, backend receipt
verification, account deletion, legal signoff, pen testing, DPIA approval, accessibility review,
support readiness, production monitoring, limited UK launch, direct HMRC MTD, household
collaboration or additional jurisdiction readiness.

## Figma evidence

Editable Figma evidence was created from the Phase 14 repo contracts and mobile shell.

Figma board:

- `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=21-2`

Local rendered board:

- `docs/release-evidence/figma-phase14-evidence.png` (`1260x1688`)

Figma is review evidence only. The repository, tests and emulator artifacts remain the source of
truth.

## Huashu UI/UX critique

Huashu review outcome:

- Store, billing, operations and launch states are visible without pretending to launch.
- Local core, no-account behavior and export safety appear before billing and production claims.
- The UI avoids fake Apple/Google marks, fake pricing cards, launch celebration states and
  compliance seals.
- Roadmap items are framed as blocked programmes, not hidden implementation.
- Release blockers remain visible in the same flow as the store and billing contracts.

Issues carried forward:

- Native StoreKit 2, Play Billing, restore and backend receipt verification proof remains required.
- Apple/Google declarations must be checked against a real submitted binary and SDK inventory.
- Account deletion routes, DPIA, processor inventory, legal review, pen test and accessibility
  review remain release blockers.
- Tabletop exercise, support runbook, rotation drills, disclosure channel, monitoring and rollback
  operations remain blocked.

## Boundary conclusion

Phase 14 is complete for deterministic store-release governance contracts, capability entitlement
boundaries, incident/review/regression/launch blocker modelling, Huashu review and synthetic mobile
shell evidence. It remains blocked for public release until store, billing, legal, privacy,
security, accessibility, support, operations, build and launch evidence close. No V1 donor runtime
code or assets were used.
