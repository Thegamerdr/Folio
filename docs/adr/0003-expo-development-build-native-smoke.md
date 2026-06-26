# ADR 0003: Expo Development Build Native Smoke

Date: 2026-06-20

Status: Accepted

## Context

Folio V2 needs native-module proof before database, crypto, OCR, calendar and notification spikes. Expo Go is not sufficient evidence because it cannot prove the native runtime boundary, generated native project shape, development client behavior or eventual store-build constraints.

## Decision

Use an Expo SDK 56 development-build shell for Phase 0 native proof.

- `apps/mobile` uses Expo Router and `expo-dev-client`.
- Expo Go is explicitly invalid for Phase 0 native evidence.
- Required local checks are `expo-doctor`, `expo install --check`, and `expo prebuild --clean --no-install`.
- Android install/launch evidence must come from a development build on an emulator or device when Java and Android SDK tooling are available.
- iOS install/launch evidence must come from macOS local tooling or an EAS iOS development build with signing credentials.
- If host tooling is missing, the blocker must name the exact missing tool, command and unblock condition.
- On Windows, pnpm must use the hoisted linker for React Native native-module builds unless a shorter workspace path or proven alternative is adopted.
- The React Native Gradle plugin patch in `patches/@react-native__gradle-plugin@0.85.3.patch` is part of Phase 0 native evidence until the upstream dependency no longer needs it.

## Consequences

Native feasibility remains visible before Phase 1 risk spikes. Windows can prove Expo configuration, Android prebuild generation and Android emulator launch, but cannot prove iOS local launch. Android local build also requires `JAVA_HOME`, `java`, Android platform tools and a connected emulator/device.

The hoisted pnpm linker avoids Windows CMake path-length failures observed under `.pnpm` nested paths for native modules such as `react-native-screens`. The Gradle plugin patch upgrades the Foojay resolver convention from `0.5.0` to `1.0.0`, avoiding the Gradle/JVM vendor-spec failure observed with Gradle `9.3.1`.

## Evidence

- `apps/mobile/app.config.ts`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/index.tsx`
- `apps/mobile/eas.json`
- `apps/mobile/metro.config.cjs`
- `patches/@react-native__gradle-plugin@0.85.3.patch`
- `docs/release-evidence/C0-native-smoke.md`
