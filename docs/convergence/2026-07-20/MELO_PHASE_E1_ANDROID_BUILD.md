# Phase E.1 Android build record

Status: native configuration inspected; current environment cannot produce/install the Android artifact.

## Inspected configuration

- Branch: `codex/melo-trusted-core-convergence-2026-07-20`
- Start commit: `8e00a634b9a027f3af0600f8860fc959e397c661`
- Phase E.1 implementation commit: `ba9bb28`
- `apps/mobile/android`: absent
- Expo app config: `apps/mobile/app.config.ts`
- EAS profiles: `apps/mobile/eas.json`
- Android package id: `com.melomoney.app`
- App version: `1.0.0`
- Version code: `1`
- User interface style: automatic
- Android backup: disabled with `allowBackup: false`

## Supported build routes

| Route                              | Risk                                                             |
| ---------------------------------- | ---------------------------------------------------------------- |
| Existing checked-in native project | Not available                                                    |
| Disposable Expo prebuild           | Safest local route if generated files stay untracked or isolated |
| `expo run:android`                 | Requires prebuild and emulator/toolchain                         |
| EAS tester APK                     | Requires EAS credentials/network build                           |

## Attempted Phase E.1 build route

Local toolchain checks:

- `where.exe adb` failed: no `adb` on PATH.
- `adb devices` failed: command not found.
- `java -version` failed: command not found.

EAS checks:

- `pnpm dlx eas-cli@20.3.0 whoami` succeeded as `thegamer.dr1` / `tgdroppin@gmail.com`.
- `pnpm dlx eas-cli@20.3.0 build --platform android --profile tester --non-interactive --no-wait` timed out after 5 minutes before returning a build URL.
- `pnpm dlx eas-cli@20.3.0 build:list --platform android --limit 3 --json` returned `[]`, so no build was queued.
- No lingering EAS/Node upload process remained after timeout.

## Artifact identity fields to capture

- source commit after Phase E.1 commit;
- build timestamp;
- package id `com.melomoney.app`;
- app version `1.0.0`;
- build type: debug/development/tester;
- environment: local generated prebuild or EAS.

## Current blocker

No Android native project is checked in, the local machine lacks Java/ADB, and the authenticated EAS submission command did not reach build creation. Any current-branch APK still requires either a machine with Android SDK/JDK, a disposable prebuild plus local toolchain, or a successful EAS submission from a non-hanging environment.
