# Phase E.2 build log

## EAS cloud build

Command:

```powershell
cd C:\dev\melo-phase-d-work\apps\mobile
$env:CI='1'
pnpm dlx eas-cli@20.3.0 build --platform android --profile tester --non-interactive --no-wait --json --message "Phase E.2 Android runtime proof from 1f4f082"
```

Result:

- Build submitted.
- Build ID: `642baa36-a055-4094-a0e9-b8e23dc25cab`
- Latest status on 2026-07-21: `IN_QUEUE`
- No artifact URL yet.

## Archive investigation

| Archive | Result |
| --- | --- |
| Before `.easignore` | approximately 5.94 GB; included `.git`, artifacts, docs, scratch output |
| After `.easignore` | approximately 77.99 MB; source-only upload |

Source fix:

- `466e39a chore(android): establish managed build validation`

## Local fallback

Disposable worktree:

```text
C:\dev\melo-e2-local-android-1f4f082
```

Initial worktree source:

```text
1f4f082c0ba002e5a926719937207e9ca846e883
```

Runtime-fix source:

```text
b8bb84697a0634c1bc442a86ae38ed9fed18db96
```

Prebuild:

```powershell
pnpm --filter @folio/mobile exec expo prebuild --platform android --no-install
```

Result: succeeded. Generated native files stayed inside the disposable worktree only.

Final release build:

```powershell
cd C:\dev\melo-e2-local-android-1f4f082\apps\mobile\android
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='C:\Users\User\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT='C:\Users\User\AppData\Local\Android\Sdk'
$env:NODE_ENV='production'
$env:SENTRY_DISABLE_AUTO_UPLOAD='true'
$env:SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD='true'
.\gradlew.bat ':app:assembleRelease' '-PreactNativeArchitectures=x86_64' '-PFOLIO_UPLOAD_STORE_FILE=debug.keystore' '-PFOLIO_UPLOAD_STORE_PASSWORD=android' '-PFOLIO_UPLOAD_KEY_ALIAS=androiddebugkey' '-PFOLIO_UPLOAD_KEY_PASSWORD=android' '--console=plain'
```

Result:

```text
BUILD SUCCESSFUL in 1m 59s
1086 actionable tasks: 37 executed, 1049 up-to-date
```

Log:

- `artifacts/phase-e2-android-emulator-20260721/local-release-b8bb846-gradle.log`

## Build-route findings

| Finding | Status |
| --- | --- |
| Default local release ABI is not emulator-compatible | `withUploadSigning.cjs` defaults to `arm64-v8a`; x86_64 override required for `CloseLedger_Phone`. |
| Debug APK is not a standalone runtime proof | It installs but requires Metro. |
| Local release Sentry upload needs CI config | Local proof disabled upload via `SENTRY_DISABLE_AUTO_UPLOAD=true`; cloud release should set Sentry org/project/auth intentionally. |
| Generated manifest removes blocked permissions | `RECORD_AUDIO`, camera and legacy external storage were removed in generated manifest. |
| Expo public config still lists `android.permissions` with `RECORD_AUDIO` | Non-blocking config confusion; generated manifest is the store-facing evidence. |
