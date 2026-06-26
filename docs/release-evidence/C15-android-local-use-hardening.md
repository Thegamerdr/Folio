# C15 Android Local Use Hardening Evidence - 2026-06-21

## Scope

This pass hardens the Android standalone tester APK for local use. It does not claim public
release readiness, banking-grade certification, iOS readiness or store readiness.

## Artifact

- APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- APK size: `50,422,376` bytes
- Release JS bundle: `apps/mobile/android/app/build/generated/assets/react/release/index.android.bundle`
- Release JS bundle size: `3,675,088` bytes
- Android package: `com.folio.v2.greenfield`
- Build result: Gradle `:app:assembleRelease` passed on Windows with `x86_64` architecture.

## What Changed

- Replaced the local SQLCipher dev key with a SecureStore-backed generated database key.
- Removed the legacy hardcoded dev-key migration path from the release code.
- Added Android app-lock overlay with LocalAuthentication when available and explicit tester
  fallback when the emulator cannot prove biometrics.
- Set Android `allowBackup=false` and removed legacy broad external-storage permissions in the
  generated manifest.
- Added Android system document picker support for CSV/TXT/TSV-like text statements, with paste
  fallback.
- Persisted staged local document metadata: filename, MIME type, byte size, cache-copy state and
  local text digest.
- Kept import commit review-gated: file staging creates review rows, and a transaction is written
  only after `Confirm`.
- Replaced the old segmented route bars with native SVG `Path`/`Circle` rendering.
- Fixed first-screen and import copy so this APK advertises CSV/TXT and paste, while PDF/image OCR
  remains blocked.

## Emulator Evidence

| Capture                                      | Proof                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `c15-final-apk-launch-rendered.png` / `.xml` | Final rebuilt APK renders the product first-minute screen.                         |
| `c15-first-minute.png` / `.xml`              | First screen says `CSV/TXT or pasted text`, not PDF/photo.                         |
| `c15-after-show.xml`                         | Route proof uses `com.horcrux.svg.SvgView`, `PathView` and `CircleView`.           |
| `c15-route-moved.png` / `.xml`               | Moved-route state shows recovery route and changed status.                         |
| `c15-today.png` / `.xml`                     | Today route renders in the installed product shell.                                |
| `c15-more.png` / `.xml`                      | SecureStore key active, app-lock status and local lock copy visible.               |
| `c15-after-picker-relaunch.png` / `.xml`     | App-lock overlay appears after leaving the app.                                    |
| `c15-document-picker-2.png` / `.xml`         | Android system document picker opens from Folio.                                   |
| `c15-picker-downloads-verified.png` / `.xml` | Downloads location exposes the supported text sample.                              |
| `c15-import-file-staged.png` / `.xml`        | `c15-sample-statement.txt` staged locally with MIME, size, cache state and digest. |
| `c15-import-file-row-actions.png` / `.xml`   | Import actions are visible above the nav: Confirm, Edit, Not this, Ask Melo.       |
| `c15-import-after-confirm.png` / `.xml`      | Review-gated commit works: `Test Coffee confirmed`; undo remains in local history. |

## Static And Runtime Checks

- `pnpm --filter @folio/mobile typecheck`: passed.
- Focused Vitest: `apps/mobile/src/local/localLedger.test.ts` and
  `apps/mobile/src/phase5/importReviewAdapter.test.ts` passed, 18 tests.
- Final release build: `:app:assembleRelease` passed.
- Final source scan found no `folio-v2-local-ledger-dev-build-key`, `legacyDevEncryptionKey` or
  `rekeyLegacyDatabase`.
- Final release bundle scan found no `folio-v2-local-ledger-dev-build-key`, `legacyDevEncryptionKey`
  or `rekeyLegacyDatabase`.
- Final launch logcat scan found no matches for fatal React/runtime errors.
- Manifest proof:
  - `android:allowBackup="false"`
  - `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` and `SYSTEM_ALERT_WINDOW` are removed.
  - `USE_BIOMETRIC` and `USE_FINGERPRINT` are present for app-lock proof.

## Huashu UI/UX Gate

Huashu review outcome for this pass: the local tester APK now behaves like a product slice rather
than an evidence wall. The import trust loop is visible before action, the route is a real graphic
object, security copy is honest, and the app avoids pretending that blocked native work exists.

Remaining craft debt before calling the overall product 10/10: manual TalkBack/large-text/reduced
motion runs, longer real-device sessions, real user files, real-device biometric proof and external
security/accessibility review.

## Explicit Non-Claims

- PDF/image OCR remains blocked.
- FLAG_SECURE is not enabled in this tester APK because it would block screenshots and live review.
- iOS remains blocked by macOS/Xcode or EAS signing evidence.
- Real Open Banking, store billing, cloud provider AI, account deletion and public release
  operations remain blocked by the existing release register.
