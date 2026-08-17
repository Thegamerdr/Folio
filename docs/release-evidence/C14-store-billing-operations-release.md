# C14 Store Billing Operations Release

## Phase / task IDs

Phase 14. Primary task range: T183 through T192.

## Result

Phase 14 is complete for pure store-release governance contracts and now has a real Android billing
foundation in the production app. The app uses `expo-iap`, treats pending purchases as non-owned,
and verifies purchased tokens through a deployed Google Play verification Worker before it writes
or applies a signed entitlement. It is not complete for public release claims requiring a real Play
listing/service account, live purchase and restore proof, Apple StoreKit if iOS ships, final store
declarations, complete account-deletion E2E, operational exercises, independent reviews, signed store builds or
limited UK launch approval.

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
- Existing production `PaywallScreen` preserved with Free / Full / Live pricing and real
  `expo-iap` purchase/restore seams; the unlisted-store state still shows the honest preview.
- `services/billing-entitlements` deployed at
  `https://melo-billing-entitlements.tgdroppin.workers.dev`.
- Google provider verification is fixed to package `com.folio.v2.greenfield` and the Melo product
  allowlist. Provider credentials never enter the APK.
- Worker-side Ed25519 signing, hash-only purchase-token KV storage and public JWKS. Raw purchase
  tokens are used transiently for Google verification and are not stored.
- On-device Ed25519 verification before entitlement persistence/unlock. Unsigned local store
  labels and pending, unknown, mismatched or expired purchases fail closed.
- Independent signed records for permanent Full ownership and time-bounded Live access. Live uses
  provider expiry plus a 72-hour offline grace; legacy Plus/Pro restore maps to permanent Full only
  after Google verification.

## Task coverage

| Task                                | Status                                      | Evidence                                                                                                                           |
| ----------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| T183 Apple/Google declarations      | Blocked for release                         | Matrix exists; privacy, deletion, accessibility, legal and SDK reviews block                                                       |
| T184 Entitlements and store billing | Implemented foundation; blocked for release | Android IAP + signed backend grants exist; Play listing/credentials/live purchase and restore proof block                          |
| T185 Incident/support runbooks      | Blocked for release                         | Incident classes modelled; tabletop, rotations and disclosure channel block                                                        |
| T186 Final pen/privacy review       | Blocked for release                         | Gate exists; pen test, DPIA, legal, privacy, security and a11y block                                                               |
| T187 Regression/store builds        | Android partial; blocked for release        | Final CI + APK/AAB + two-device smoke + offline, clean-restore and ENOSPC loops pass; remaining resilience, deletion and iOS block |
| T188 Limited UK launch              | Blocked for release                         | Track model exists; production flag and operations thresholds block                                                                |
| T189 Outcomes research              | Implemented as protocol                     | Five outcome families defined; no hidden profiling                                                                                 |
| T190 Household collaboration        | Blocked roadmap                             | Separate privacy/threat/permissions programme required                                                                             |
| T191 Direct HMRC MTD                | Blocked roadmap                             | Dedicated HMRC conformance and legal programme required                                                                            |
| T192 Additional jurisdictions       | Blocked roadmap                             | Country launch checklist, owner, policy, bank, tax, language and legal work                                                        |

## Verification evidence

Current Android billing foundation checks completed on 2026-07-14:

- Billing Worker typecheck: passed.
- Mobile typecheck: passed.
- Focused Worker, grant, persistence, allowance, CTA and paywall tests: 7 files and 76 tests passed.
- Wrangler dry-run: passed, 56.62 KiB upload / 13.41 KiB gzip.
- Deployed Worker version: `bd7403bf-7c34-499e-8a9f-5b91f31e8c8a`.
- Provisioned hash-only KV namespace: `74ef0fe9650a41a1b65639c506ad2aee`.
- Deployed health reports `providerConfigured: false`, `signerConfigured: true`,
  `tokenStoreConfigured: true`, `clientGrantsAccepted: false` and
  `purchaseTokensStored: false`.
- Public JWKS exposes only Ed25519 key `melo-billing-ed25519-2026-07`; its private key was piped
  directly to a Worker secret and was never written to the repository or APK.
- A dummy verification request returns `provider_not_configured` and no grant, proving the
  external gate fails closed rather than fabricating an entitlement.
- Emulator-only x86_64 release APK: `artifacts/billing-proof/melo-billing-x86_64-release.apk`,
  SHA-256 `A6139A720304529A4E8BB848C0E5B5EDE9DC4EC08EE0E10D5246F5EE62439A6E`.
- Clean empty-account/plan/paywall captures: `artifacts/billing-proof/01-empty-account.png` through
  `artifacts/billing-proof/05-paywall-footer.png`; the physical Galaxy S9 was not touched.

These checks prove code, deployment and cryptographic trust boundaries. They do not prove a real
charge, Play acknowledgement, refund/revocation, renewal, cancellation, release-track restore or
offline lifecycle because the listing and minimum-privilege service account do not exist yet.

## SECURITY-02 local hardening — 2026-08-17

The repository now keeps public Play verification independently fail-closed through
`BILLING_PUBLIC_VERIFICATION_ENABLED=false`; provider credentials alone cannot expose the POST
route. The route has an 8,192-byte streaming limit, strict JSON/UTF-8 validation, a hashed
`VERIFY_SOURCE_RATE_LIMITER` decision before body parsing, and a hashed
`VERIFY_PURCHASE_RATE_LIMITER` decision after product/token validation but before Google work.

The account owner confirmed namespace `21001` at 300 calls per 60 seconds for the loose shared-source
guard and namespace `21002` at 10 calls per 60 seconds for repeated product/purchase proofs. Raw
connecting addresses, purchase tokens, composed identifiers and limiter keys are absent from logs
and durable storage. Cloudflare rate limiting remains permissive, eventually consistent and
location-local defence-in-depth, not exact purchase accounting or fraud proof.

No Worker deployment, secret change, public enablement or production verification occurred during
this implementation. The previously deployed health endpoint still reports provider configuration
false and does not yet include the new switch field. A reviewed operator must deploy disabled,
observe health and the documented 429/503 alerts, complete controlled purchase/restore evidence,
then enable deliberately only after the remaining T184 security and store gates close.

Local verification passed: 33 focused Worker tests, generated Worker binding types, service
typecheck, and a Wrangler `--dry-run` bundle of 60.28 KiB / 14.40 KiB gzip. Full root CI passed 242
Vitest files / 2,819 tests, all 45 companion Node tests and both source-package validators. These are
code/configuration proofs only; they do not substitute for a controlled Play purchase/restore or
authorise public reachability.

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

- Real Play product purchase, pending-to-purchased transition, restore, renewal, cancellation,
  refund/revocation, acknowledgement and offline-grace proof remains required. StoreKit 2 is also
  required if an iOS release remains in scope.
- Apple/Google declarations must be checked against a real submitted binary and SDK inventory.
- In-app account deletion and cloud/Open Banking purge routes are implemented and unit-tested.
  Public web deletion, production Clerk/Worker configuration, provider-consent revocation policy,
  signed destructive E2E, DPIA, processor inventory, legal review, pen test and accessibility
  review remain release blockers.
- Tabletop exercise, support runbook, rotation drills, disclosure channel, monitoring and rollback
  operations remain blocked.

## Boundary conclusion

Phase 14 now includes deterministic governance contracts and a real fail-closed Android
billing-entitlement foundation; the old synthetic shell is no longer treated as the implementation.
It remains blocked for public release until live store lifecycle, legal, privacy, security,
accessibility, support, operations, build and launch evidence close. No V1 donor runtime code or
assets were used.

## Final Android release-candidate verification — 2026-07-15

This pass verifies the current coded Android product rather than the old Lovable prototype or the
synthetic Phase 14 shell.

### Repository and dependency gates

- `pnpm run ci` passed after the Expo dependency reconciliation: 178 test files and 2,223 tests,
  with lint, formatting, type checks, boundary checks and contract validation included.
- Contract validation passed with 75 source-package files, 15,858 lines and 14 independently checked
  fixture cases.
- `pnpm mobile:doctor` passed all 21 checks.
- `pnpm mobile:install-check` passed with the Expo packages current.
- The remaining `pnpm peers check` diagnostic is an optional transitive `utf-8-validate` range
  disagreement between Clerk/Solana's `rpc-websockets` branch and React Native/Metro's `ws` branch;
  it is not an installed Melo runtime mismatch.

### Android packaging proof

- Arm64 release APK: `artifacts/android-final-release/melo-arm64-release.apk`
  - size: 66,589,963 bytes
  - SHA-256: `9ABB17593D1B200225D540332FC8C69A8431B196862000EFA121E3C22F616214`
  - ABI: `arm64-v8a`
  - APK Signature Scheme v2: verified
  - 16 KiB page alignment: verified with `zipalign -P 16`
- Arm64 release AAB: `artifacts/android-final-release/melo-arm64-release.aab`
  - size: 52,435,795 bytes
  - SHA-256: `7548AC854B0F6F7C53308B44107AA69AB329A76F87C59012D21307647A733CFB`
  - ABI: `arm64-v8a`
  - `bundletool 1.18.3 validate`: passed
- Both release artifacts use the Folio upload certificate:
  `CN=Folio, OU=Folio, O=Folio, L=Verona, C=IT`, certificate SHA-256
  `547396e1fd99681c2a6d768b8b7d1b4484b5f42a17597cad6c495221267a5488`.

### Runtime proof

- A clean uninstall/install of the x86_64 release APK passed on `emulator-5554`.
- The emulator opened on the first-use experience with the intended Fraunces fonts, no sample money,
  no Clerk development-key warning, no fatal exception and no ANR.
- Emulator evidence: `docs/release-evidence/android-melo-final-release-candidate.png`.
- A Samsung Galaxy S9 (`SM-G960F`, Android 10 / API 29) was updated without uninstalling so the
  previously installed local state could be reconciled and inspected.
- The old phone installation was signed with the repository's Android debug certificate, so Android
  correctly rejected a data-preserving update from the Folio-signed APK with
  `INSTALL_FAILED_UPDATE_INCOMPATIBLE`. A separate, private, debug-signed copy of the same release code
  was used only for this physical-device preservation test. It is not a release artifact and is not
  suitable for distribution.
- On the S9, the current Today, Review, Melo and More surfaces loaded with the intended fonts. The old
  development-only `Fast-forward 1 month` control was absent from the release build.
- The preserved seeded state was removed through Melo's own three-gate **Clear local money & history**
  flow. The post-clear Today and Review surfaces are empty, and Melo remains present in the primary
  navigation.
- Physical-device clean-state evidence:
  `docs/release-evidence/android-melo-physical-s9-clean-state.png`.

### Release-boundary fixes found during verification

- A stale generated Android font-resource path still referenced an obsolete worktree and left the
  release build on the splash screen. Generated Android build output was cleared and regenerated from
  the current repository; the obsolete path no longer appears in generated output.
- `apps/mobile/app/_layout.tsx` now has a bounded six-second font-startup guard. A future font failure
  reports the problem and uses the platform fallback instead of trapping the user on the splash screen.
- `apps/mobile/app.config.ts` no longer contains a Clerk `pk_test_` fallback. A production build rejects
  test publishable keys; a no-key production build remains a valid signed-out local app.

### Honest remaining blockers

- Sentry runtime reporting is configured, but organization/project credentials were unavailable during
  the local build, so release source-map upload is not proven.
- The public-release gate remains intentionally closed: live Play listing and purchase lifecycle,
  production credentials and backend operations, store declarations, legal/privacy review, independent
  security and accessibility review, account/cloud deletion evidence, production Open Banking rollout,
  and iOS release proof remain external or cross-platform blockers.
- The locally verified Android artifacts constitute an Android MVP/release-candidate boundary, not a
  public-store release approval.

## Current Android regression update - 2026-07-16

`ANDROID_RELEASE_REGRESSION_2026-07-16.md` supersedes the Android artifact hashes and test totals in
the historical 2026-07-15 section above. The final tree passes 202 test files and 2,460 tests; the
upload-signed dual-ABI APK and AAB build and validate;
the final navigation smoke, bounded airplane-mode loop, clean-sandbox portable restore,
kernel-ENOSPC state/PDF-source retry, Personal legacy-to-schema-v11 interrupted-migration recovery,
lossless state/root SQLCipher authority, SQL-only cold start, native whole-database rebuild and the
transactionally verified canonical mirror, privacy-minimal typed-command writes for mapped
AppState fields and fail-closed current-balance/account/transaction inverse-query parity pass on
the release emulator;
and the immediately preceding phone-signed candidate boots after an in-place, data-preserving
Galaxy S9 update and passes the full phone navigation smoke. T187 remains blocked by full field
normalization and domain-by-domain canonical read authority, typed coverage for unsupported
domains, the remaining
import/restore/endurance matrix, production account-deletion E2E and iOS release/store proof.
