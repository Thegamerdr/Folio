# Android Dogfood Pack Final Report

Date: 2026-06-23

## 1. Build Method Found

Best current method: local standalone release APK.

Command:

```powershell
pnpm --filter @folio/mobile native:apk:android
```

Artifact:

```text
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Why this route: it bundles the app and does not require Metro, cloud, AI, Open Banking, account
sign-in, EAS login or store release machinery.

## 2. Commands Run

- `adb devices -l`
- `pnpm --filter @folio/mobile exec expo install --check`
- `pnpm --filter @folio/mobile doctor`
- `pnpm --filter @folio/mobile native:apk:android`
- `pnpm dlx eas-cli@20.3.0 whoami --non-interactive`
- `adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- `adb shell pm clear com.folio.v2.greenfield`
- `adb shell monkey -p com.folio.v2.greenfield -c android.intent.category.LAUNCHER 1`
- `adb exec-out screencap -p`
- `adb shell uiautomator dump /sdcard/window.xml`
- `adb logcat -d -t 2000`
- `adb shell am force-stop com.folio.v2.greenfield`
- `adb shell svc wifi disable`
- `adb shell svc data disable`
- `pnpm vitest run apps/mobile/src/local/androidDogfoodPackEvidence.test.ts --passWithNoTests`
- `pnpm run ci`

Detailed command evidence:

```text
apps/mobile/evidence/android-dogfood-pack-2026-06-23/logs/command-summary.md
```

## 3. Build / Install Result

Build: passed.

Install: passed on emulator `emulator-5554`.

APK evidence:

```text
apps/mobile/evidence/android-dogfood-pack-2026-06-23/logs/apk-artifact.txt
```

EAS result: configured but not available on this host because `eas whoami --non-interactive`
returned `Not logged in`.

Physical Android result: not run because no physical Android device was attached.

## 4. Runtime Result

Passed on Android emulator.

Captured:

- clean first launch;
- no account/cloud/AI gate;
- manual three-fact path;
- saved Today route;
- persistence after app restart;
- Data Control export;
- two-step clear;
- empty baseline not presented as confirmed zero;
- offline Today smoke.

## 5. Files Changed

- `ANDROID_DOGFOOD_INSTALL.md`
- `ANDROID_DOGFOOD_SCENARIOS.md`
- `ANDROID_DOGFOOD_SCORECARD.md`
- `apps/mobile/src/local/androidDogfoodPackEvidence.test.ts`
- `apps/mobile/evidence/android-dogfood-pack-2026-06-23/README.md`
- `apps/mobile/evidence/android-dogfood-pack-2026-06-23/BUILD_COMMANDS_ATTEMPTED.md`
- `apps/mobile/evidence/android-dogfood-pack-2026-06-23/RUNTIME_NOTES.md`
- `apps/mobile/evidence/android-dogfood-pack-2026-06-23/SCENARIO_CHECKLIST.md`
- `apps/mobile/evidence/android-dogfood-pack-2026-06-23/KNOWN_LIMITATIONS.md`
- `apps/mobile/evidence/android-dogfood-pack-2026-06-23/BUG_REPORT_TEMPLATE.md`
- `apps/mobile/evidence/android-dogfood-pack-2026-06-23/FINAL_REPORT.md`
- `apps/mobile/evidence/android-dogfood-pack-2026-06-23/logs/*`
- `apps/mobile/evidence/android-dogfood-pack-2026-06-23/screenshots/*`
- `apps/mobile/evidence/android-dogfood-pack-2026-06-23/xml/*`

## 6. Dogfood Docs Created

- `ANDROID_DOGFOOD_INSTALL.md`
- `ANDROID_DOGFOOD_SCENARIOS.md`
- `ANDROID_DOGFOOD_SCORECARD.md`

## 7. Evidence Folder

```text
apps/mobile/evidence/android-dogfood-pack-2026-06-23/
```

## 8. Tests Added / Updated

Added:

```text
apps/mobile/src/local/androidDogfoodPackEvidence.test.ts
```

Focused result:

```text
1 test file passed, 3 tests passed
```

## 9. CI Result

Passed on 2026-06-23:

```powershell
pnpm run ci
```

Result:

```text
exit code 0
61 test files passed
523 tests passed
Prettier format check passed
```

The CI output still reports existing non-failing readiness blockers for public release, including
operations readiness, store declarations, release gate blockers and iOS native smoke. Those blockers
remain outside this Android dogfood pack and do not block owner Android dogfood through the local APK
route.

## 10. Known Limitations

- No physical Android device was attached in this pass.
- EAS is configured but this host is not logged in.
- Expo dev build route exists but is not the recommended owner route because it depends on the dev
  server path.
- Import review and duplicate rejected import are prepared in docs but need owner manual dogfood.
- Recovery preview is covered by prior Android evidence and remains in the owner scenario pack.
- No Business UI, cloud sync, Open Banking, AI gateway, billing, OCR, final Melo character runtime,
  full redesign, iOS proof or store release was added.
- iOS Simulator was not downloaded or installed because this workspace is Windows. Apple's
  Simulator route requires macOS with Xcode; use the existing `native:smoke:ios` / `expo run:ios`
  path from a Mac.

## 11. Blockers

No blocker for continued owner Android dogfood through local APK.

Blockers that remain outside dogfood scope:

- physical Android hand-feel proof;
- macOS/Xcode host for iOS simulator proof;
- EAS login/credentials for remote internal distribution;
- public release blockers already reported by repo release gates.

## 12. Can The Owner Dogfood On Android Now?

Yes, using the local standalone release APK route.

The owner should still treat this as internal dogfood, not public release or store beta.

## 13. Exact Next Command

From repo root:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
pnpm --filter @folio/mobile native:apk:android
```

Then install:

```powershell
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```
