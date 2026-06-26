# Build Commands Attempted

Date: 2026-06-23

## Environment

- Host: Windows
- Android device available: emulator `emulator-5554`
- Java: Android Studio JBR, OpenJDK 21.0.10
- Android SDK: `%LOCALAPPDATA%\Android\Sdk`

## Expo Dependency Check

Command:

```powershell
pnpm --filter @folio/mobile exec expo install --check
```

Result:

```text
Dependencies are up to date
```

## Expo Doctor

Command:

```powershell
pnpm --filter @folio/mobile doctor
```

Result:

```text
21/21 checks passed. No issues detected.
```

## Android Release APK

Command:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
pnpm --filter @folio/mobile native:apk:android
```

Result: passed.

Artifact:

```text
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Current artifact evidence:

```text
logs/apk-artifact.txt
```

## Local Gradle Build

Equivalent command:

```powershell
cd apps/mobile/android
.\gradlew.bat :app:assembleRelease
```

Status: covered by `pnpm --filter @folio/mobile native:apk:android`, which runs the same Gradle
target.

## Emulator Install

Command:

```powershell
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
adb shell pm clear com.folio.v2.greenfield
adb shell monkey -p com.folio.v2.greenfield -c android.intent.category.LAUNCHER 1
```

Result: passed.

Evidence:

```text
screenshots/01-clean-first-launch.png
xml/01-clean-first-launch.xml
logs/01-clean-first-launch-logcat.txt
```

## Physical Android Install

Status: not run in this pass. No physical Android device was attached. The exact command is:

```powershell
adb devices -l
adb -s DEVICE_ID install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
adb -s DEVICE_ID shell monkey -p com.folio.v2.greenfield -c android.intent.category.LAUNCHER 1
```

## Expo Dev Build

Configured route:

```powershell
pnpm --filter @folio/mobile native:smoke:android
```

Status: available but not selected for owner dogfood. This route uses the debug/development server
path, while the dogfood pack needs a tired-owner install path that does not require Metro.

Recommended use: engineer smoke only, not owner dogfood.

## EAS Build

Configured file:

```text
apps/mobile/eas.json
```

Relevant profile:

```text
tester: internal Android APK
```

Auth check command:

```powershell
pnpm dlx eas-cli@20.3.0 whoami --non-interactive
```

Result:

```text
Not logged in
```

Root cause: this host has EAS config but no authenticated EAS session.

Recommended fix:

```powershell
pnpm dlx eas-cli@20.3.0 login
pnpm --filter @folio/mobile eas:android:tester
```

Do this only when remote internal distribution is intentionally needed.
