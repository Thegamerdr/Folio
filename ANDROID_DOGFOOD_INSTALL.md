# Android Dogfood Install

Date: 2026-06-23

This is the owner dogfood route for Folio V2 on Android. It is not a Play Store release route and
it is not a public beta process.

## Recommended Method

Use the local standalone release APK:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
pnpm --filter @folio/mobile native:apk:android
```

APK output:

```text
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

This route bundles JavaScript into the APK and does not require Metro, cloud, AI, Open Banking or an
account.

## Prerequisites

- Node compatible with repo `package.json`.
- `pnpm` compatible with repo `package.json`.
- Android Studio installed.
- Android SDK installed.
- Android Studio JBR available at `C:\Program Files\Android\Android Studio\jbr`, or set `JAVA_HOME`
  to your installed JDK 21.
- USB debugging enabled for a physical Android device, or a running Android emulator.
- From repo root, dependencies installed with `pnpm install`.

Check the device:

```powershell
adb devices -l
```

## Build

From repo root:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
pnpm --filter @folio/mobile native:apk:android
```

Equivalent local Gradle command:

```powershell
cd apps/mobile/android
.\gradlew.bat :app:assembleRelease
cd ../../..
```

## Install On Emulator

Start an emulator in Android Studio, then:

```powershell
adb devices -l
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
adb shell monkey -p com.folio.v2.greenfield -c android.intent.category.LAUNCHER 1
```

## Install On Physical Android

Enable Developer options and USB debugging, connect by USB, accept the device prompt, then:

```powershell
adb devices -l
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
adb shell monkey -p com.folio.v2.greenfield -c android.intent.category.LAUNCHER 1
```

If `adb install` reports multiple devices, pass the device id:

```powershell
adb -s DEVICE_ID install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
adb -s DEVICE_ID shell monkey -p com.folio.v2.greenfield -c android.intent.category.LAUNCHER 1
```

## Clear Local Data

Use the in-app path first:

```text
More -> Data control -> Clear data -> Arm clear -> Clear records
```

ADB fallback:

```powershell
adb shell pm clear com.folio.v2.greenfield
```

After clearing, Folio should say the workspace is empty and should not present the empty baseline as
a confirmed zero bank balance.

## Capture Screenshots And Logs

Create a local evidence folder:

```powershell
$evidence='apps/mobile/evidence/android-dogfood-pack-manual'
New-Item -ItemType Directory -Force "$evidence/screenshots", "$evidence/xml", "$evidence/logs"
```

Capture screenshot and accessibility XML:

```powershell
adb exec-out screencap -p > "$evidence/screenshots/01-clean-first-launch.png"
adb shell uiautomator dump /sdcard/window.xml
adb pull /sdcard/window.xml "$evidence/xml/01-clean-first-launch.xml"
```

Capture logcat:

```powershell
adb logcat -c
adb shell monkey -p com.folio.v2.greenfield -c android.intent.category.LAUNCHER 1
Start-Sleep -Seconds 5
adb logcat -d -t 2000 > "$evidence/logs/launch-logcat.txt"
```

Quick launch-error scan:

```powershell
Select-String "$evidence/logs/launch-logcat.txt" -Pattern 'FATAL EXCEPTION','ReactNativeJS: Error','Unable to load script','Metro','DevLauncher','DevMenu','ANR'
```

## Export Local Data

In app:

```text
More -> Data control -> Exports -> Prepare export file
```

Record the filename shown by Folio. The current Android dogfood evidence produced a local export
named like:

```text
folio-local-export-YYYY-MM-DD.json
```

## Report Bugs

Use the bug template in:

```text
apps/mobile/evidence/android-dogfood-pack-2026-06-23/BUG_REPORT_TEMPLATE.md
```

Always include:

- scenario number;
- APK build date;
- device model and Android version;
- screenshot name;
- XML dump name, if captured;
- logcat file, if captured;
- whether the issue happened before or after clearing local data.

## Other Android Routes Checked

- Expo dev build: scripts exist (`native:smoke:android`, `expo run:android --variant debug`), but
  this is not the recommended dogfood route because it depends on the development server path.
- EAS build: `apps/mobile/eas.json` has a `tester` APK profile, but this machine is not logged in
  to EAS. Use `pnpm --filter @folio/mobile eas:android:tester` only after `eas login` and project
  credentials are ready.
- Public Play Store release: out of scope for this dogfood pass.
