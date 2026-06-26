# Runtime Commands

Date: 2026-06-23

## Focused Tests

Command:

```powershell
pnpm vitest run apps/mobile/src/local/androidRecoveryReplayEvidence.test.ts apps/mobile/src/local/localMeloPolicyAdapter.test.ts apps/mobile/src/local/iosReadinessEvidence.test.ts apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts apps/mobile/src/local/canonicalProductExperienceLoop.test.ts --passWithNoTests
```

Result: pass. 5 test files, 27 tests.

## Typecheck

Command:

```powershell
pnpm typecheck
```

Result: pass.

## iOS Smoke Attempt

Command:

```powershell
pnpm --filter @folio/mobile native:smoke:ios
```

Result: failed as expected on Windows.

Key output:

```text
iOS apps can only be built on macOS devices. Use eas build -p ios to build in the cloud.
```

## Android Evidence Capture

Commands used:

```powershell
adb devices
adb shell input tap ...
adb shell input text ...
adb shell input swipe ...
adb shell screencap -p /sdcard/<capture>.png
adb pull /sdcard/<capture>.png <evidence>/screenshots/<capture>.png
adb shell uiautomator dump /sdcard/<capture>.xml
adb pull /sdcard/<capture>.xml <evidence>/xml/<capture>.xml
```

Device: `emulator-5554`

Package: `com.folio.v2.greenfield`

## Evidence String Check

Command:

```powershell
Select-String / Get-Content checks across android-recovery-replay XML
```

Result:

- Preview XML contains compact Melo note, `preview only`, `Source: hypothetical`, `Scenario preview`, `Plan projections`, and `Record locally`.
- Post-acceptance XML contains `4 changes are visible`, `not a verdict`, `Repair recorded from recovery preview`, `Scenario decision recorded`, `hypothetical - accepted`, `3 records`, `2 audit items`, and `recovery recorded`.
- Normalized visible XML samples contain no shame/advice/fake-score terms checked by the pass.

## Formatting

Initial `pnpm run ci` failed on Prettier for touched files. Formatting command:

```powershell
pnpm exec prettier --write apps/mobile/src/local/androidRecoveryReplayEvidence.test.ts apps/mobile/src/local/iosReadinessEvidence.test.ts apps/mobile/src/surfaces/compactMeloNoteSurface.tsx apps/mobile/src/surfaces/mobileShell.tsx apps/mobile/src/surfaces/timelineSurface.tsx apps/mobile/src/local/localMeloPolicyAdapter.ts apps/mobile/src/local/localMeloPolicyAdapter.test.ts apps/mobile/src/surfaces/firstMinuteSurface.tsx apps/mobile/src/surfaces/importReviewSurface.tsx apps/mobile/src/surfaces/dataControlSurface.tsx apps/mobile/src/surfaces/recoverySurface.tsx apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts
```

Result: pass.

## Full CI

Command:

```powershell
pnpm run ci
```

Result: pass.

Final CI details:

- Dependency boundaries passed.
- V1 boundary proof passed.
- Synthetic-data policy passed.
- Product constitution gate passed.
- Canonical product gates passed.
- Prettier passed.
- TypeScript passed.
- Vitest passed: 57 test files, 510 tests.
- Contract validation passed: 75 files, 15,822 lines, 82 database tables, 192 tasks, 32 risks, 51 research sources.

Status reports still show known non-failing blockers:

- Operations readiness: blocked by tabletop, rotation drills, vulnerability disclosure channel.
- Store declarations: blocked by store-console/submitted-binary/privacy/SDK/deletion declaration work.
- Public release gate: blocked by 23 known release items including iOS native smoke, secure keys, document/OCR, real-data vault E2E, independent security/privacy/accessibility review, account deletion, store declarations and billing.
