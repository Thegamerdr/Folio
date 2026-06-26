# C1 Native Risk Spikes

## Phase / task IDs

Phase 1. Primary task range: T013 through T024.

## Result

Phase 1 is complete for the Android database/storage gate and explicitly blocked for platform
claims that cannot be proven on this Windows host or without additional native credentials.
The Android proof is sufficient to let pure Phase 2 and Phase 3 package work proceed, but it
does not unblock Phase 4 vault/mobile claims that depend on Keychain/Keystore, iOS, OCR,
notifications or manual assistive-technology evidence.

## Android database proof

Evidence captured on 2026-06-20 in the live emulator preview:

- Emulator/device: `emulator-5554`, AVD `CloseLedger_Phone`.
- Runtime package: `com.folio.v2.greenfield`.
- Screenshot: `docs/release-evidence/android-live-preview-phase1.png`.
- UI tree: `docs/release-evidence/android-window.xml`.
- Metro log: `docs/release-evidence/metro-live-preview.log`.
- OP-SQLite package: `@op-engineering/op-sqlite@17.0.0`.
- SQLCipher: `4.14.0 community`.
- Wrong-key access: rejected.
- FTS5/WAL: `50000 rows; wal`.
- 100k-row query: `70 ms`; total spike time `28094 ms`.
- Runtime blocker shown by proof screen: `none` for the Android database spike.

The proof values above come from the live screenshot. After the final reinstall, UIAutomator
only exposed the React Native host container in `android-window.xml`; the XML still confirms
the foreground V2 package, but it is not used as the source for proof-row text.

## Native build notes

- The OP-SQLite config must live in `apps/mobile/package.json` because the Android Gradle
  script resolves the nearest package file from `apps/mobile/android`.
- A root-only OP-SQLite config produced a runtime FTS5 blocker: `no such module: fts5`.
- After adding the app-level config, `pnpm --filter @folio/mobile native:smoke:android`
  built, installed and launched successfully.
- After the final clean prebuild, `pnpm --filter @folio/mobile native:smoke:android` passed
  again: Gradle reported `BUILD SUCCESSFUL in 2m 33s`, installed
  `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` and opened the development
  client URL on `CloseLedger_Phone`.
- Gradle `clean` can still trip a React Native generated-JNI/CMake clean-order issue, but
  the normal Expo Android development-build path succeeds.

## Task status

| Task                            | Status                                                    | Evidence                                                                    |
| ------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| T013 OP-SQLite SQLCipher        | Android passed; iOS blocked                               | Live preview SQLCipher `4.14.0 community`, wrong key rejected               |
| T014 FTS5 and WAL               | Android passed; iOS blocked                               | Live preview FTS5 `50000 rows; wal`, 100k query `70 ms`                     |
| T015 Expo updates compatibility | Policy accepted; release build still pending              | ADR 0004 disables OTA until native/schema compatibility is proven           |
| T016 Native key wrapping        | Blocked                                                   | Requires Keychain/Keystore module spike and biometric/unlock evidence       |
| T017 Recovery wrapping          | Blocked                                                   | Requires Argon2id parameter benchmark and unwrap vector                     |
| T018 Encrypted document files   | Blocked                                                   | Requires native/file-system encryption spike and residue check              |
| T019 On-device OCR              | Blocked                                                   | Requires iOS Vision and Android ML Kit spike or signed fallback decision    |
| T020 Voice capability           | Deferred                                                  | Non-release-blocking in backlog; typing fallback remains required           |
| T021 Calendar bridge            | Partially covered by pure recurrence engine only          | System calendar write-only bridge not proven                                |
| T022 Local notifications        | Blocked                                                   | Requires schedule/update/cancel/restart proof                               |
| T023 Accessible motion/money    | Partially covered by token tests and Android proof screen | Manual TalkBack/VoiceOver large text/reduced-motion evidence still required |
| T024 Production native stack    | Conditional decision accepted                             | ADR 0004 records selected stack and blockers                                |

## Huashu UI/UX critique

The live proof screen remains evidence-first: it shows only actual native/runtime facts, avoids
fake finance data, avoids decorative dashboard filler and exposes blockers as first-class rows.
The proof uses restrained hierarchy, stable 48dp rows and status color only as reinforcement.

Critical Huashu issue fixed before this evidence update:

- Replaced deprecated React Native `SafeAreaView` with `react-native-safe-area-context`
  so the proof shell uses the Expo/RN-safe layout primitive.

## Figma evidence

The Figma board was updated with a Phase 1-3 execution evidence frame:

- `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=3-2`

Figma is review evidence only. The repository, tests and emulator artifacts remain the source
of truth.

## iOS blocker

iOS local evidence is blocked on this Windows host.

Exact unblock condition:

- run `pnpm --filter @folio/mobile native:smoke:ios` on macOS with Xcode; or
- provide EAS iOS signing credentials and run `pnpm --filter @folio/mobile eas:ios:development`.

## Boundary conclusion

Android database native risk is retired for Phase 2/3 storage architecture. iOS and non-database
native risks remain explicit blockers before any vault, import, OCR, notification, calendar
handoff or store-readiness claim.
