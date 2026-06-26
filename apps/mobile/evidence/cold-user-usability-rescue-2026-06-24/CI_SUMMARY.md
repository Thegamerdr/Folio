# CI Summary

Date: 2026-06-24

Status: passed.

Focused checks passed during the pass:

```text
pnpm exec vitest run apps/mobile/src/surfaces/coldUserUsabilityRescue.test.ts apps/mobile/src/local/routeSurfaceTruth.test.ts apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts apps/mobile/src/surfaces/uiTrustReviewCopy.test.ts apps/mobile/src/surfaces/recoveryMeloCompletionSurface.test.ts apps/mobile/src/local/localLedger.test.ts
```

Result:

```text
6 test files passed
70 tests passed
```

Previously failing stale-expectation checks passed after copy alignment:

```text
pnpm exec vitest run apps/mobile/src/surfaces/interactiveObjectReality.test.ts apps/mobile/src/local/canonicalProductExperienceLoop.test.ts apps/mobile/src/local/dogfoodMode.test.ts apps/mobile/src/surfaces/brandMarkCorrection.test.ts
```

Result:

```text
4 test files passed
27 tests passed
```

Full CI command:

```text
pnpm run ci
```

Result:

```text
lint passed
typecheck passed
67 test files passed
561 tests passed
source-package validation passed with 75 files and 0 errors
fixture consistency validation passed with 14 checked cases and 0 failures
```

Android APK build and smoke result:

```text
pnpm mobile:apk:android passed after setting JAVA_HOME and ANDROID_HOME for the command process.
APK: C:\dev\folio-v2-greenfield\apps\mobile\android\app\build\outputs\apk\release\app-release.apk
SHA256: 94267019BB624F52A9655FD68EA1069649B71C22F60D8DF3181D4A2732AAA3EC
adb install -r passed on emulator-5554
am start focused com.folio.v2.greenfield/.MainActivity
```

Android launch smoke metric:

```text
adb shell am start -W -n com.folio.v2.greenfield/.MainActivity
LaunchState: COLD
TotalTime: 2780 ms
WaitTime: 2785 ms

Small post-launch gfxinfo sample:
Total frames rendered: 28
Janky frames: 4 (14.29%)
50th percentile: 19 ms
90th percentile: 46 ms
95th percentile: 117 ms
```

This is a smoke metric only, not a full performance certification.

Notes:

```text
Operations readiness, store declarations and public release reports still print BLOCKED status for documented release-readiness items. They are intentionally non-failing status reports inside the current CI command and were not part of this cold-user usability rescue scope.
```
