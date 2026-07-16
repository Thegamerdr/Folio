# Android release regression and store build - 16 July 2026

> Historical release checkpoint. The current schema-v8 authority boundary, artifacts, hashes and
> clean emulator launch are recorded in
> `ANDROID_CANONICAL_FULL_APPSTATE_AUTHORITY_2026-07-16.md`.

## Verdict

The current Android source tree passes the complete repository gate, produces valid upload-signed
APK and AAB artifacts containing both supported Android ABIs and installs and boots on an emulator.
The final artifact passes the complete non-destructive navigation smoke, a bounded airplane-mode
write/remove/undo/wipe loop, clean-sandbox portable-export restore, kernel-ENOSPC state/import
recovery, interrupted Personal state-partition migration, SQLCipher-only authority/rebuild and the
transactionally verified canonical AppState mirror plus mapped typed-command audit path on the
emulator. The Galaxy S9 has
preserved-data boot and same-day four-tab smoke evidence from the immediately preceding phone-signed
candidate; its data was not cleared to force the final upload-signed artifact onto a different
certificate chain.

This materially advances T187 and `RB-T187-FULL-REGRESSION-STORE-BUILDS`. It does not close that
blocker: signed production account-deletion E2E, the remaining database/schema migration and
import/restore resilience matrix, extended endurance, iOS regression, and an iOS store release
build remain required.

## Repository gate

Final-state `pnpm run ci` passed after all persistence, Metro and evidence changes:

- 202 test files and 2,460 tests passed;
- dependency boundaries and V1 separation passed;
- synthetic-data policy, product constitution and canonical product gates passed;
- Prettier and every TypeScript target passed;
- AI gateway, cloud vault, Open Banking and billing Worker types passed;
- release-blocker evidence validation reported no missing current-evidence file; and
- the 75-file source package and all 14 consistency cases validated.

The gate correctly leaves 23 public-release blockers open; a passing code gate is not treated as
store approval.

## Native packaging reconciliation

The first release rebuild from a temporary drive mapping exposed that the shipping import of
`@folio/storage` relied on package-junction resolution. `apps/mobile/metro.config.cjs` now maps that
workspace package to its TypeScript entry point explicitly. Metro then bundled 2,727 modules and
both the arm64 phone build and the final dual-ABI builds completed successfully from the real
repository path.

The first rebuild after the final empty-state correction inherited the repository's arm64-only
developer default. Artifact inspection caught that before install. The canonical outputs below
were rebuilt explicitly with `arm64-v8a,x86_64`; the discarded arm64-only hashes are not release
artifacts.

## Final Android artifacts

### Upload-signed APK

- Path: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Package: `com.folio.v2.greenfield` `0.0.1` (`1`)
- Android: minimum 24, target 36
- ABIs: `arm64-v8a`, `x86_64`
- Size: `108,954,283` bytes
- SHA-256: `4244DBDDAD9CBE8A5BA70603869F7AFC411C91D77459845AB1159DF3F22E7A67`
- Signer certificate SHA-256:
  `547396E1FD99681C2A6D768B8B7D1B4484B5F42A17597CAD6C495221267A5488`
- APK Signature Scheme v2: passed.

### Upload-signed App Bundle

- Path: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`
- ABIs: `arm64-v8a`, `x86_64`
- Size: `76,926,853` bytes
- SHA-256: `176B1A9EA53C47068EFCD4600986A5D91BCAFABC578EA80DF20FEF56BFF3C99F`
- Signer: `CN=Folio, OU=Folio, O=Folio, L=Verona, C=IT`
- Signer certificate SHA-256:
  `547396E1FD99681C2A6D768B8B7D1B4484B5F42A17597CAD6C495221267A5488`
- Bundletool 1.18.3 validation: passed with exit code 0.

These are locally valid release artifacts. The engineering package id, version code, store listing,
Play product setup, declaration review and submitted-binary hash process remain explicit pre-upload
gates.

## Emulator proof

- The exact final upload-signed APK installed with `adb install -r` on `emulator-5554` and launched
  with a live process and no fatal Android/React log marker.
- App-private files remained mode `771`; no `/sdcard/melo-*` artifact remained after the persistence
  drill.
- The release-built persistence failure/retry/cold-start exercise is recorded separately in
  `ANDROID_PERSISTENCE_FAILURE_RECOVERY_2026-07-16.md`.
- A real shipping save created and read back the canonical schema in the same SQL transaction as
  the exact AppState generation. Native SQLCipher reported `quick_check = ok`, schema version 4 and
  the expected empty Personal account/balance projection. See
  `ANDROID_CANONICAL_MIRROR_2026-07-16.md`.
- The final artifact also completed onboarding with a controlled `£980` balance, cold-restored it,
  and proved one privacy-minimal `folio.balance.set_current.v1` audit row through the bundled
  SQLCipher library. The app's three-stage clear then removed the controlled identity and balance;
  the final cold-start screenshot is again the honest empty doorway. See
  `ANDROID_TYPED_COMMAND_BRIDGE_2026-07-16.md`.
- Direct UI Automator smoke against the final APK passed: cold-launch Today, Review, Melo, More,
  `The quiet hub`, Reminders, Start fresh and return to Today. No destructive control was invoked.
- The equivalent non-destructive `.maestro/smoke.yaml` flow remains checked in and was passed by
  the preceding same-day release candidate.

The first smoke run exposed an obsolete assertion that every Today state contains `spare`. The
empty product correctly showed `Your first picture`; the smoke now accepts either the honest empty
state or a real money-path state and creates no fixture data. The corrected run passed.

The corruption-drill cleanup exposed a second truth issue: a cleared returning account rendered
`You make it to payday` over an unconfigured £0 route because `onboarding.done` was being mistaken
for a money picture. `hasConfiguredMoneyPicture` now selects the existing honest empty doorway
until route-driving user data exists. The cleared encrypted state survived a cold launch and showed
`Your first picture`, `Add my numbers` and `Add a statement instead` with no fixture values. See
`melo-android-post-clear-empty-doorway-2026-07-16.png`.

The final release APK then completed a bounded airplane-mode regression with all network services
disabled and a direct ping returning `Network is unreachable`: configure temporary values through
onboarding, cold launch, log `OfflineShop` £12.34, cold launch, open all four tabs, remove, Undo,
cold launch, complete the three-gate local wipe, and cold launch to the honest empty doorway. No
React Native fatal was logged. During this sequence the wipe was found to retain onboarding name
and payday; `resetToEmpty()` now clears both, and the rebuilt release showed only the blank name
placeholder after the offline wipe. Evidence:
`melo-android-airplane-mode-write-cold-start-2026-07-16.png` and
`melo-android-local-clear-identity-wipe-2026-07-16.png`.

The same final APK also passed two destructive recovery additions:

- A full `pm clear` removed the Android sandbox and protected keys after a real export. The blank
  installation restored the portable schema-11 JSON through DocumentsUI and both destructive
  confirmations, then cold-launched with the exact identity, balance, income and transaction.
- A temporary 64 KiB app-private volume forced genuine kernel `ENOSPC`. The encrypted-state warning
  recovered through `Try again` and survived a cold launch. PDF source retention showed sanitized
  `Not enough storage` copy; selecting the same file after space returned retained an encrypted
  source and produced five review-gated candidates. No sample candidate was confirmed.
- A deliberately truncated scoped migration temp plus a complete legacy Personal generation
  recovered through the production boot path. The app parked the exact incomplete bytes, showed a
  one-time recovery notice, committed and read back a new authenticated partition, removed the
  redundant complete legacy generations, then restored the same balance/income/transaction from
  the healed partition on a force-stop/cold launch.
- The exact schema-v11 partition and Personal root were then migrated into hash-verified SQLCipher
  generations. Deleting every authenticated rollback state/manifest file still cold-restored the
  exact UI. A deliberately corrupt whole database was SHA-256-preserved by the new native vault
  bridge, rebuilt from the verified rollback and cold-restored again after rollback deletion.
- The final three-gate product clear removed the parked corrupt family. The first run found and
  fixed a lock race between the live debounced writer and direct empty SQL commit; the final APK
  reported `Local data cleared` and cold-started into `Your first picture` without fixture values.

The import drill found and fixed raw Expo/Java exception leakage before the final rebuild. Evidence
is indexed in `ANDROID_PERSISTENCE_FAILURE_RECOVERY_2026-07-16.md` and the five new screenshots in
this directory. The emulator was then unmounted, all test inputs were removed, the package was
cleared after the migration proof, and the final cold launch showed `Your first picture` with none
of the drill values.

## Physical-device proof

- Device: Samsung Galaxy S9 `SM-G960F`, Android 10 / API 29,
  id `2af26a2c19017ece`.
- The same release code was signed only for this phone with its existing repository debug
  certificate and installed with `adb install -r`; no uninstall or data clear occurred.
- The final release code was re-signed only for the already-installed debug certificate, updated in
  place, and launched with a live process and no React Native fatal marker. The upload-signed APK
  was correctly rejected as signature-incompatible; the app was not uninstalled and phone data was
  not cleared.
- The immediately preceding same-day phone-signed candidate passed the complete non-destructive
  Maestro smoke and booted after an in-place update. The later empty-state and local-identity-wipe
  corrections were release-built and device-proven on the emulator; the S9 was preserved rather
  than uninstalled or cleared to cross the signer boundary.
- `melo-android-phone-persistence-build-2026-07-16.png` shows the preserved-state build running on
  the phone.

The phone-only APK is not a distribution artifact. The upload-signed dual-ABI APK remains at the
canonical release output path.

## Remaining T187 work

1. Finish kill-during-import and low-storage formats and delete/restore boundaries, production
   staged/backup corruption combinations and extended endurance. Full durable AppState canonical
   authority and mapped typed-command coverage are now complete. The Android Personal legacy-to-v11
   migration interruption, airplane-mode loop, clean-sandbox portable restore, encrypted-state
   ENOSPC retry, PDF-source ENOSPC retry, lossless state/root SQLCipher authority and whole-database
   rebuild are also complete.
2. Run in-app and public-web account deletion against production-configured identity, cloud,
   billing and Open Banking services, including purge timing and token revocation.
3. Produce, install and regress the iOS release build on supported devices from macOS/Xcode or EAS.
4. Produce and validate the final iOS store archive if iOS remains in the first public release.
5. Rebuild after the permanent package-id/name/version decision and match declarations to the exact
   submitted binaries.

Until those rows pass, T187 remains release-blocking.
