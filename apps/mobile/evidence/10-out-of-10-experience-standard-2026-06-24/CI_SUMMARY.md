# CI Summary

Date: 2026-06-24

Status: passed.

## Full CI

```text
pnpm run ci
```

Result:

```text
Prettier: passed
TypeScript packages: passed
Vitest: 68 test files passed, 568 tests passed
Source package validation: passed
Fixture consistency: passed
```

## Focused Product Experience Checks

```text
pnpm exec vitest run apps/mobile/src/surfaces/coldUserUsabilityRescue.test.ts apps/mobile/src/local/routeSurfaceTruth.test.ts apps/mobile/src/surfaces/brandMarkCorrection.test.ts apps/mobile/src/surfaces/tenOutOfTenExperienceStandard.test.ts apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts apps/mobile/src/surfaces/uiTrustReviewCopy.test.ts apps/mobile/src/local/canonicalProductExperienceLoop.test.ts
```

Result:

```text
7 test files passed
59 tests passed
```

## Android APK

```text
Build command: pnpm mobile:apk:android
Build result: BUILD SUCCESSFUL
APK: C:\Users\User\Downloads\folio-v2-10-out-of-10-test-2026-06-24.apk
Size: 66.6 MB
SHA256: 995081757D8A46C904C6CED1C1D2BA31E3B5DA095548C0FC2793884505941196
Install result: Success on emulator-5554
Launch result: Status ok, cold launch TotalTime 2688 ms
```

## Settled Interaction Smoke

```text
Device: emulator-5554
Action: reset gfx stats, scroll down, scroll up
Total frames rendered: 127
Janky frames: 2 (1.57%)
50th percentile: 17ms
90th percentile: 17ms
95th percentile: 17ms
99th percentile: 18ms
```
