# Android Install For Owner

Date: 2026-06-23

This is the internal owner dogfood install path for Folio V2. It does not require account, cloud, AI, Open Banking or billing.

## APK Path

Build command:

```powershell
pnpm --filter @folio/mobile native:apk:android
```

APK output:

```text
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Package id:

```text
com.folio.v2.greenfield
```

## Install From The Phone

1. Move `app-release.apk` to the phone.
2. Open the file from Downloads or Files.
3. If Android blocks it, open settings from the prompt.
4. Enable install from unknown apps for the app you used to open the APK.
5. Return to the APK and install.
6. Open Folio.

## Install With ADB

Check device:

```powershell
adb devices
```

Install:

```powershell
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Launch:

```powershell
adb shell monkey -p com.folio.v2.greenfield -c android.intent.category.LAUNCHER 1
```

## Uninstall Or Clear Data

Clear app data without uninstalling:

```powershell
adb shell pm clear com.folio.v2.greenfield
```

Uninstall:

```powershell
adb uninstall com.folio.v2.greenfield
```

In app:

```text
More -> Dogfood mode -> Reset local data
```

## Screenshots And Screen Recording

Screenshot with phone buttons:

```text
Power + Volume Down
```

Screenshot with ADB:

```powershell
adb shell screencap -p /sdcard/folio-dogfood.png
adb pull /sdcard/folio-dogfood.png .
```

Screen recording with ADB:

```powershell
adb shell screenrecord /sdcard/folio-dogfood.mp4
adb pull /sdcard/folio-dogfood.mp4 .
```

Stop recording with `Ctrl+C`.

## Pull Diagnostic Or Export Files

In Folio:

```text
More -> Dogfood mode -> Export diagnostic
```

The app writes:

```text
folio-dogfood-diagnostic-YYYY-MM-DD.json
folio-dogfood-diagnostic-YYYY-MM-DD.md
```

To inspect app-accessible files with ADB:

```powershell
adb shell run-as com.folio.v2.greenfield ls files
adb exec-out run-as com.folio.v2.greenfield cat files/folio-dogfood-diagnostic-YYYY-MM-DD.json > folio-dogfood-diagnostic.json
adb exec-out run-as com.folio.v2.greenfield cat files/folio-dogfood-diagnostic-YYYY-MM-DD.md > folio-dogfood-diagnostic.md
```

If `run-as` is not available on the installed release build, use the Android Files app or share/export route available on the device.

## If Folio Will Not Launch

1. Capture logs:

```powershell
adb logcat -d -t 2000 > folio-launch-logcat.txt
```

2. Clear app data:

```powershell
adb shell pm clear com.folio.v2.greenfield
```

3. Launch again:

```powershell
adb shell monkey -p com.folio.v2.greenfield -c android.intent.category.LAUNCHER 1
```

4. If it still fails, uninstall, reinstall and attach `folio-launch-logcat.txt` to the dogfood bug report.
