# Android Dogfood Pack

Date: 2026-06-23

This folder contains the Android dogfood-readiness pack for Folio V2. It records the build route,
install route, runtime evidence, scenario checklist, known limitations and bug-report format for
owner dogfooding.

## Verdict

Ready for continued owner Android dogfood through the local standalone release APK route.

Not ready for public release, Play Store distribution, cloud sync, Open Banking, billing, OCR,
final Melo character runtime or iOS proof.

## Best Build Route

Use:

```powershell
pnpm --filter @folio/mobile native:apk:android
```

Output:

```text
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

This route produced a release APK from current source and installed on the running emulator.

## Evidence Index

- `logs/command-summary.md` - commands attempted and results.
- `logs/native-apk-android.log` - release APK build log.
- `logs/apk-artifact.txt` - APK path, size and timestamp.
- `logs/eas-check.log` - EAS configuration/auth check.
- `logs/01-clean-first-launch-logcat.txt` - launch logcat.
- `screenshots/*.png` - runtime captures.
- `xml/*.xml` - Android accessibility dumps for runtime captures.
- `BUILD_COMMANDS_ATTEMPTED.md` - build/install method audit.
- `RUNTIME_NOTES.md` - observed runtime results.
- `SCENARIO_CHECKLIST.md` - owner test checklist.
- `KNOWN_LIMITATIONS.md` - limitations and non-claims.
- `BUG_REPORT_TEMPLATE.md` - bug report format.

## Screenshot Naming Convention

Use:

```text
NN-short-kebab-name.png
NN-short-kebab-name.xml
NN-short-kebab-name-logcat.txt
```

For manual scenario runs, prefix with scenario id:

```text
S02_03_today-after-save.png
S02_03_today-after-save.xml
```

## Log Capture

```powershell
adb logcat -c
adb shell monkey -p com.folio.v2.greenfield -c android.intent.category.LAUNCHER 1
Start-Sleep -Seconds 5
adb logcat -d -t 2000 > apps/mobile/evidence/android-dogfood-pack-manual/logs/launch-logcat.txt
```

Scan for severe runtime problems:

```powershell
Select-String apps/mobile/evidence/android-dogfood-pack-manual/logs/launch-logcat.txt -Pattern 'FATAL EXCEPTION','ReactNativeJS: Error','Unable to load script','Metro','DevLauncher','DevMenu','ANR'
```

## Runtime Captures From This Pass

- `01-clean-first-launch` - clean app launch, no account/cloud/AI gate.
- `02-quick-estimate-empty` - manual three-fact path opens.
- `03-quick-estimate-filled` - owner seed values entered.
- `04-quick-estimate-save-visible` - route preview appears before save.
- `05-quick-estimate-save-button` - save action visible and enabled.
- `06-today-after-save` - Today after saved local estimate.
- `07-after-restart-persistence` - persistence after app force-stop/relaunch.
- `08-more-after-persistence` - More screen after persistence.
- `09-data-control` - Data Control overview.
- `10-data-control-export-clear-actions` - export and clear areas.
- `11-data-control-export-prepared` - export filename prepared.
- `12-data-control-clear-selected` - clear warning selected.
- `14-data-control-clear-buttons` - arm clear visible.
- `15-data-control-clear-armed` - cancel/clear state after arming.
- `16-data-control-after-clear` - cleared state says empty is not confirmed zero.
- `17-offline-today-after-clear` - local Today opens while network services are disabled.

## Canonical Safety Checks

The dogfood route remains:

- local-first;
- account-free at first launch;
- cloud optional;
- AI optional;
- Open Banking optional;
- review-before-reality;
- no fake scores;
- no advice language;
- no shame language;
- rejected evidence outside financial reality;
- Melo as interpreter, not direct writer;
- Personal workspace only in this UI, with Business explicitly separate.
