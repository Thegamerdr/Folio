# Local Tester APK Standalone Evidence - 2026-06-21

## Scope

This record covers the clean Android tester APK built and installed locally on Windows. It is a
local tester artifact, not a Play Store release claim and not a full public-release readiness claim.

## Artifact

- APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- APK size: 50,422,376 bytes
- Release JS bundle: `apps/mobile/android/app/build/generated/assets/react/release/index.android.bundle`
- Release JS bundle size: 3,675,088 bytes
- Android package: `com.folio.v2.greenfield`
- Signing: local Gradle release APK for tester use; public-store signing remains blocked.

## Build And Install Proof

The release APK was built from the native Android project with:

```powershell
$env:NODE_ENV='production'
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='C:\Users\User\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=x86_64 --console=plain
```

Result: Gradle `:app:assembleRelease` completed successfully.

The app was then installed and launched with:

```powershell
adb uninstall com.folio.v2.greenfield
adb install -r apps\mobile\android\app\build\outputs\apk\release\app-release.apk
adb shell monkey -p com.folio.v2.greenfield -c android.intent.category.LAUNCHER 1
```

Foreground activity after launch:

```text
com.folio.v2.greenfield/com.folio.v2.greenfield.MainActivity
```

Release logcat scan over the latest 2,000 lines found no matches for:

```text
Metro, DevLauncher, DevMenu, Unable to load script, expo-dev, FATAL EXCEPTION, ReactNativeJS: Error
```

## Captured Product Evidence

| Evidence                                                      | What it proves                                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `android-standalone-release-root.png` / `.xml`                | Release APK opens to the product first-minute screen, not an engineering evidence list.  |
| `android-standalone-release-playable-moved.png` / `.xml`      | The first-minute playable route responds before anything is saved.                       |
| `android-standalone-release-first-answer.png` / `.xml`        | Import discovery produces a first answer before perfect data.                            |
| `android-standalone-release-today.png` / `.xml`               | The first-minute summary shows breathing room and review count.                          |
| `android-standalone-release-today-main.png` / `.xml`          | Main Today surface shows route, actions, review card and local ledger items.             |
| `android-standalone-release-more-vault.png` / `.xml`          | More screen shows local vault row counts and data version from the installed APK.        |
| `android-standalone-release-import-review-real.png` / `.xml`  | Import review keeps original bank wording visible with confirm/edit/Melo/reject actions. |
| `android-standalone-release-import-melo-suggest.png` / `.xml` | Melo suggests a debt label but keeps the row in review before saving.                    |
| `android-standalone-release-whatif.png` / `.xml`              | Bad-month route shows protected bills, moved buffer and rebuilt route.                   |
| `c15-final-apk-launch-rendered.png` / `.xml`                  | Final rebuilt APK renders with corrected first-screen import copy.                       |
| `c15-more.png` / `.xml`                                       | SecureStore key and local app-lock posture are visible in the APK.                       |
| `c15-import-file-staged.png` / `.xml`                         | Android system picker text file is staged with metadata and digest.                      |
| `c15-import-after-confirm.png` / `.xml`                       | File-imported row writes only after explicit confirmation.                               |

## Product Functions Proven In This APK

- First-minute relief path: welcome, playable route, import discovery and first answer.
- Main Today route: breathing room, tightest date, confidence and local route events.
- Source/import trust loop: original wording stays visible until explicit confirmation.
- Local Melo assistance: deterministic local classification and spend guidance without provider calls.
- Local security posture: SecureStore database key, app-lock overlay and honest biometric fallback
  are surfaced from the installed APK.
- Local import path: Android system picker supports CSV/TXT-style text files, stages document
  metadata and keeps transaction writes behind explicit review.
- Local vault summary: transactions, drafts, staged files, search rows, audit entries and data
  version are surfaced from app state.
- What-if recovery: a bad-month repair changes the route without erasing protected needs.

## Explicit Non-Claims

- This APK is not a Play Store or public release artifact.
- Production signing, store listing, privacy/legal review and external security audit remain open.
- iOS proof is still blocked on macOS/Xcode or EAS signing credentials.
- The mobile vault is strengthened with SecureStore-backed SQLCipher keying, normalized local rows
  plus snapshot fallback, but full canonical key wrapping and recovery are not independently
  audited.
- Open Banking, PDF/image OCR, real cloud AI provider integration and store billing are not
  complete in this APK.

## Huashu/UI Review Note

The standalone APK now follows the supplied zip direction much more closely than the earlier
evidence-list build: the route is the protagonist, first value appears before onboarding friction,
Melo behaves as warm assistance rather than a compliance narrator, and import trust is visible in
the flow. Remaining craft debt: the route/horizon is still rendered as native view strokes instead
of a true curved vector system, and the app needs longer real-user sessions before calling the whole
product 10/10. C15 replaced the route bars with SVG paths, added SecureStore/app-lock proof and
connected Android text-file staging, but manual accessibility/security review and real-device
biometric proof still remain.
