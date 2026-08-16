# Phase E.2 Android build path

Status: established on 2026-07-21.

## Conclusion

The repository is intended to stay Expo managed. `apps/mobile/android` and `apps/mobile/ios` are generated build outputs and should not be committed by default.

Prebuild is expected for native builds:

- EAS cloud builds run prebuild remotely.
- Local Android proof may run prebuild only in a disposable worktree.

Canonical Android tester command:

```powershell
cd C:\dev\melo-phase-d-work\apps\mobile
$env:CI='1'
pnpm dlx eas-cli@20.3.0 build --platform android --profile tester --non-interactive --no-wait --json --message "Phase E.2 Android runtime proof from <commit>"
```

Local fallback command shape:

```powershell
pnpm --filter @folio/mobile exec expo prebuild --platform android --no-install
cd apps/mobile/android
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=x86_64 -PFOLIO_UPLOAD_STORE_FILE=debug.keystore -PFOLIO_UPLOAD_STORE_PASSWORD=android -PFOLIO_UPLOAD_KEY_ALIAS=androiddebugkey -PFOLIO_UPLOAD_KEY_PASSWORD=android --console=plain
```

## Build options ranked

| Rank | Route | Result | Notes |
| --- | --- | --- | --- |
| 1 | EAS cloud tester build | Submitted, still queued | Correct canonical path for distributable tester APK. |
| 2 | Local Expo prebuild in disposable worktree | Succeeded | Used for emulator proof after EAS queue delay. |
| 3 | Local Gradle debug after isolated prebuild | Built, not sufficient | Debug APK requires Metro; not a standalone runtime artifact. |
| 4 | Expo Go | Not viable | Native modules/plugins exceed Expo Go support. |
| 5 | Existing CI workflow | Not viable for artifact | CI runs tests/typecheck only; no Android artifact workflow. |

## App identity

| Field | Value |
| --- | --- |
| App name | `Melo` |
| Slug | `folio-v2-greenfield` |
| Android package | `com.melomoney.app` |
| Version | `1.0.0` |
| Version code | `1` |
| Runtime version | `1.0.0` via `policy: appVersion` |
| EAS project ID | `ef69039d-abaf-48e9-b35a-52d80b03a96a` |
| EAS owner | `thegamer.dr1` |
| Tester profile | `android.buildType=apk`, `distribution=internal`, `channel=tester` |

## Environment requirements

| Item | Observed |
| --- | --- |
| Node | workspace requires Node `>=24` |
| Package manager | `pnpm@11.5.2` |
| Java | `C:\Program Files\Android\Android Studio\jbr\bin\java.exe`, OpenJDK 21 |
| Android SDK | `C:\Users\User\AppData\Local\Android\Sdk` |
| ADB | `C:\Users\User\AppData\Local\Android\Sdk\platform-tools\adb.exe` |
| Emulator | `C:\Users\User\AppData\Local\Android\Sdk\emulator\emulator.exe` |
| AVD | `CloseLedger_Phone` |
| Build tools | 34.0.0, 35.0.0, 36.0.0, 36.1.0, 37.0.0 |

`adb` and `java` were not on PATH, but they are present on disk and usable by absolute path.

## Prior EAS timeout cause

The earlier EAS command did not fail because of project linkage, auth, or network. The local upload/archive step was too large and the shell timeout killed the process before a durable build ID was captured.

Evidence:

- Initial archive inspection was approximately 5.94 GB because `.git`, artifacts, docs, and scratch outputs were included.
- After `.easignore`, the inspected archive dropped to approximately 77.99 MB.
- EAS submission then reached Expo and returned build ID `642baa36-a055-4094-a0e9-b8e23dc25cab`.

## EAS submission

| Field | Value |
| --- | --- |
| Build ID | `642baa36-a055-4094-a0e9-b8e23dc25cab` |
| URL | `https://expo.dev/accounts/thegamer.dr1/projects/folio-v2-greenfield/builds/642baa36-a055-4094-a0e9-b8e23dc25cab` |
| Status at latest poll | `IN_QUEUE` |
| Submitted source commit | `1f4f082c0ba002e5a926719937207e9ca846e883` |
| Fingerprint | `87b31268a2641b15ee29a6cb126c714a8c5ceb24` |
| Build profile | `tester` |

The queued EAS build remains useful for cloud validation, but Phase E.2 runtime proof used the isolated local fallback from the later runtime-fix commit `b8bb846`.
