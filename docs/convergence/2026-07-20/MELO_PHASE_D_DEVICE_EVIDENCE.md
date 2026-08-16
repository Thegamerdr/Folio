# Phase D.1 device evidence

Status: Android tooling inspected on 2026-07-20. Current-branch Android device evidence is externally blocked; no stale app screenshot is claimed as evidence.

## Android tooling inspection

| Item | Result | Evidence |
|---|---|---|
| `ANDROID_HOME` | Present | `C:\Users\User\AppData\Local\Android\Sdk` |
| `ANDROID_SDK_ROOT` | Empty | Not required while `ANDROID_HOME` is usable |
| SDK directory | Present | `platform-tools`, `emulator`, `platforms` exist |
| Android Studio | Present | `C:\Program Files\Android\Android Studio` |
| `adb` on PATH | Not present | `where.exe adb` returns no PATH result |
| `adb` absolute path | Present | `C:\Users\User\AppData\Local\Android\Sdk\platform-tools\adb.exe` |
| Emulator binary | Present | `C:\Users\User\AppData\Local\Android\Sdk\emulator\emulator.exe` |
| AVD | Present | `CloseLedger_Phone` |
| Expo CLI | Present | `pnpm --filter @folio/mobile exec expo --version` -> `56.1.20` |

## Emulator inspection

Safe command used:

```powershell
Start-Process -FilePath 'C:\Users\User\AppData\Local\Android\Sdk\emulator\emulator.exe' -ArgumentList @('-avd','CloseLedger_Phone','-no-snapshot-load') -WindowStyle Hidden
```

ADB recovery:

```powershell
C:\Users\User\AppData\Local\Android\Sdk\platform-tools\adb.exe kill-server
C:\Users\User\AppData\Local\Android\Sdk\platform-tools\adb.exe start-server
C:\Users\User\AppData\Local\Android\Sdk\platform-tools\adb.exe devices -l
```

Observed device:

```text
emulator-5554 device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 device:emu64xa transport_id:1
```

## Installed app inspection

Installed packages matching Melo/Folio:

```text
package:com.folio.v2.greenfield
package:com.folio.v2.greenfield.qa
```

Resolved activities:

```text
com.folio.v2.greenfield/.MainActivity
com.folio.v2.greenfield.qa/com.folio.v2.greenfield.MainActivity
```

Installed production package metadata:

```text
versionCode=1
versionName=0.0.1
firstInstallTime=2026-07-18 04:49:12
lastUpdateTime=2026-07-19 02:33:03
```

## Current-branch evidence blocker

Current-branch Android evidence was not captured because the installed Android apps predate the Phase D.1 changes and no current-branch Android binary/dev client is available in the workspace.

Additional constraint:

- `apps/mobile/android` is not checked in.
- Running `expo run:android` or native prebuild would scaffold native project files, which is outside D.1 without explicit human approval.

Therefore:

- no Android screenshot or recording is claimed for Phase D.1
- no stale installed app is treated as current-branch evidence
- Android SDK/ADB/emulator availability is no longer the blocker
- the remaining blocker is the absence of a safe current-branch Android runtime artifact

## Exact path to unblock

Any one of these is enough:

1. Human approves Expo native prebuild/run for this branch.
2. Human provides a current-branch APK/dev-client build.
3. Human confirms an Expo Go/dev-client route that can load the current app without creating checked-in native files.

Suggested verification routes once unblocked:

- Trusted Safe Range reliable state in light mode.
- Trusted Safe Range caution/uncertain state in dark mode.
- Decision History list.
- Decision receipt/detail.
- A sheet with an accent CTA.
- Selected chip/tab state.
- App relaunch persistence.

## iOS

iOS remains blocked and out of scope for this checkpoint because the native iOS project/account setup is not available.
