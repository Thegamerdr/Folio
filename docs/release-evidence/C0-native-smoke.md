# C0 Native Smoke

## Phase / task IDs

Phase 0. Primary task: T012, "Wire CI device build smoke tests".

## What was built

- `apps/mobile` is an Expo SDK 56 native mobile shell.
- Expo Router is the entrypoint through `expo-router/entry`.
- The mobile app now supports a standalone Android local tester APK path in addition to earlier debug/dev-client smoke evidence.
- The product shell renders the zip-aligned first-minute route, Today, Melo, import review, More/vault and what-if surfaces.
- Native prebuild config exists for Android and iOS identifiers:
  - Android package: `com.folio.v2.greenfield`
  - iOS bundle ID: `com.folio.v2.greenfield`
- EAS profiles exist for future development builds.

## Commands and results

| Command                                                               | Result                                                                                                                                                                     |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @folio/mobile doctor`                                  | Passed: Expo Doctor ran 21 checks and reported 21/21 passed.                                                                                                               |
| `pnpm --filter @folio/mobile exec expo install --check`               | Passed: dependencies are up to date.                                                                                                                                       |
| `pnpm --filter @folio/mobile exec expo prebuild --clean --no-install` | Passed: Android native directory was cleared, recreated and prebuild finished.                                                                                             |
| `pnpm --filter @folio/mobile native:apk:android`                      | Passed: Gradle `:app:assembleRelease` produced `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.                                                        |
| `java -version`                                                       | Passed with Android Studio JBR: OpenJDK `21.0.10`, `C:\Program Files\Android\Android Studio\jbr\bin\java.exe`.                                                             |
| `adb version`                                                         | Passed with Android SDK platform tools: Android Debug Bridge `37.0.0-14910828`.                                                                                            |
| `emulator -version`                                                   | Passed with Android Emulator `36.6.11.0`.                                                                                                                                  |
| `pnpm --filter @folio/mobile native:smoke:android`                    | Passed on rerun with existing Metro on port 8081: Gradle `BUILD SUCCESSFUL in 23s`, debug APK installed and Expo opened the development-client URL on `CloseLedger_Phone`. |
| `pnpm --filter @folio/mobile native:smoke:ios`                        | Blocked: Expo reported that iOS apps can only be built on macOS devices and to use EAS for cloud iOS builds.                                                               |

## Android evidence

Android install/launch evidence is available on this host when the Android Studio JBR and SDK paths are exported for the shell:

- `JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`
- `ANDROID_HOME=C:\Users\User\AppData\Local\Android\Sdk`
- `PATH` includes `%JAVA_HOME%\bin`, `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\emulator`

Evidence captured on 2026-06-20:

- Emulator/device: `emulator-5554`, AVD `CloseLedger_Phone`.
- Foreground V2 activity: `com.folio.v2.greenfield/.MainActivity`.
- Installed APK: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`, 85,538,298 bytes.
- Metro live-preview process: port `8081`, log `docs/release-evidence/metro-live-preview.log`.
- Android bundle probe: `http://127.0.0.1:8081/node_modules/expo-router/entry.bundle?...platform=android...` returned HTTP `200` with 8,810,704 bytes.
- Clean screenshot: `docs/release-evidence/android-live-preview.png`.
- The Expo CLI printed `Port 8081 is being used by another process` and skipped starting a second dev server, then used the existing Metro server.

Latest product-slice evidence captured on 2026-06-21:

- Standalone release APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`, 48,125,341 bytes.
- Release bundle: `apps/mobile/android/app/build/generated/assets/react/release/index.android.bundle`, 3,467,552 bytes.
- Foreground V2 activity after install and launch: `com.folio.v2.greenfield/.MainActivity`.
- Product onboarding screenshot: `docs/release-evidence/android-standalone-release-root.png`.
- First-minute playable route: `docs/release-evidence/android-standalone-release-playable-moved.png`.
- Import discovery first answer: `docs/release-evidence/android-standalone-release-first-answer.png`.
- Today route screenshot: `docs/release-evidence/android-standalone-release-today-main.png`.
- More/vault screenshot: `docs/release-evidence/android-standalone-release-more-vault.png`.
- Import Melo suggestion screenshot: `docs/release-evidence/android-standalone-release-import-melo-suggest.png`.
- Bad-month route screenshot: `docs/release-evidence/android-standalone-release-whatif.png`.
- Release logcat scan: no `Metro`, `DevLauncher`, `DevMenu`, `Unable to load script`, `expo-dev`, `FATAL EXCEPTION` or `ReactNativeJS: Error` markers in the latest 2,000 lines after launch.

Implementation notes:

- `pnpm-workspace.yaml` sets `nodeLinker: hoisted` to keep Windows native-module CMake paths below the effective path-length limit.
- `patches/@react-native__gradle-plugin@0.85.3.patch` upgrades the React Native Gradle plugin's Foojay resolver convention from `0.5.0` to `1.0.0`, which avoids the Gradle/JVM vendor-spec failure observed with Gradle `9.3.1`.

## iOS blocker

iOS local install/launch evidence is not available because this host is Windows.

Exact unblock condition:

- run `pnpm --filter @folio/mobile native:smoke:ios` on macOS with Xcode; or
- provide EAS iOS signing credentials and run `pnpm --filter @folio/mobile eas:ios:development`.

## Boundary conclusion

Expo configuration, dependency compatibility, native prebuild generation and Android standalone local tester install/launch are proven. iOS local launch remains blocked on this Windows host until macOS/Xcode or EAS iOS signing credentials are available. Public release remains blocked on production signing, store, privacy/legal, external security and real-data evidence.
