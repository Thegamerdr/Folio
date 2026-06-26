# Folio V2 iOS Readiness Checklist

Date: 2026-06-23

Host: Windows / PowerShell

Status: iOS runtime evidence not collected on this host. Do not treat this file as iOS proof.

## Why iOS Runtime Evidence Is Not Available Here

- `expo run:ios` / `pnpm --filter @folio/mobile native:smoke:ios` requires macOS with Xcode and an iOS simulator or connected iOS device.
- This pass is running on Windows, so it cannot launch an iOS simulator, install an iOS development build, inspect iOS safe-area behavior, or capture VoiceOver/runtime screenshots.
- Android emulator evidence can be captured here; iOS must be captured later on a Mac/iOS device.

## Static Checks Completed

- Expo config declares `platforms: ['ios', 'android']` in `apps/mobile/app.config.ts`.
- iOS bundle id is configured as `com.folio.v2.greenfield`.
- `SafeAreaView` from `react-native-safe-area-context` wraps the app root in `apps/mobile/app/index.tsx`.
- The main `ScrollView` uses `contentInsetAdjustmentBehavior="automatic"`.
- The main `ScrollView` uses `keyboardShouldPersistTaps="handled"`.
- `expo-document-picker` is installed and `pickLocalStatementDocument()` uses the system document picker.
- `writeLocalLedgerExport()` writes a local JSON export into the app document directory.
- `useReducedMotionPreference()` reads `AccessibilityInfo.isReduceMotionEnabled()` and listens for `reduceMotionChanged`.
- Modal animation switches to `none` when reduced motion is enabled.
- Product controls and surfaces expose explicit `accessibilityLabel` values in the mobile shell.
- Expo config includes an iOS Face ID usage string for local app-lock copy.

## Required iOS Runtime Evidence Still Missing

- Safe area rendering on iPhone with notch / Dynamic Island.
- Bottom inset and bottom navigation comfort on iPhone.
- Keyboard interaction with quick estimate, calendar commitment, manual spend and recovery amount fields.
- Large text / Dynamic Type layout at accessibility sizes.
- VoiceOver traversal order and labels.
- Document picker return path after selecting CSV, TSV or TXT.
- Export behavior and share-sheet / Files discoverability for local JSON export.
- Local persistence after force quit and app restart.
- Clear local records behavior after restart.
- Reduced motion behavior in modals and route preview sheets.
- Physical-device or iOS simulator screenshot/XML equivalent evidence.

## Static Source Checklist

- Safe area: `apps/mobile/app/index.tsx` imports `SafeAreaView` and renders it at the app root.
- Notch/Dynamic Island: static safe-area wrapper exists, but runtime visual proof is missing.
- Bottom inset: app content has bottom padding and bottom navigation, but iOS inset proof is missing.
- Large text: many labels are explicit and layouts wrap, but Dynamic Type proof is missing.
- VoiceOver labels: labels exist statically; VoiceOver traversal proof is missing.
- Export/share sheet: local export exists; share-sheet integration is not implemented.
- Document picker return: document picker code exists; iOS return proof is missing.
- Local persistence after restart: canonical local storage exists; iOS restart proof is missing.
- Clear/export behavior: clear and export flows exist; iOS runtime proof is missing.
- Reduced motion: modal animation uses reduced-motion state; iOS runtime proof is missing.

## Result

iOS readiness is partially prepared at code/config level. iOS behavior is not proven until a macOS/iOS evidence pass captures runtime screens and accessibility checks.
