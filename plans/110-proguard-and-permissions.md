# Plan 110: Durable ProGuard keep rules + drop the unused biometric permission

> **Executor instructions**: Follow step by step; verify each step; STOP conditions binding.
> Do NOT update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5cea944..HEAD -- apps/mobile/app.config.ts apps/mobile/package.json`
> On changes, compare excerpts; mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: M (includes a release-build verification)
- **Risk**: MED (shrinker rules affect the shipped binary; verified by building)
- **Depends on**: none
- **Category**: launch readiness
- **Planned at**: commit `5cea944`, 2026-07-11

## Why this matters

R8 minification is ON for release builds, but the only keep rule lives in
`android/app/proguard-rules.pro` — a file inside the GITIGNORED, prebuild-regenerated
android/ dir (zero git history). A clean `expo prebuild` (or EAS build) ships WITHOUT it.
The app.config.ts comment itself warns: "If a release build ever crashes on boot after a
new native dep, suspect missing ProGuard keep rules first" — and expo-iap, Clerk, the
widget lib, and Sentry all landed after that rule was written. Separately, the manifest
ships USE_BIOMETRIC/USE_FINGERPRINT from `expo-local-authentication`, whose only consumer
is unreachable legacy code — free Play-review friction.

## Current state

- `apps/mobile/gradle.properties:63-64` — `android.enableMinifyInReleaseBuilds=true`,
  `android.enableShrinkResourcesInReleaseBuilds=true`.
- `apps/mobile/android/app/proguard-rules.pro` — untracked; contains
  `-keep class com.swmansion.reanimated.** { *; }` + a turbomodule keep.
- `apps/mobile/app.config.ts:58-67` — `expo-build-properties` plugin block (the durable
  home): supports `android.extraProguardRules` (a string of rules).
- `apps/mobile/package.json:64` — `"expo-local-authentication": "~56.0.4"`; consumer
  `src/local/nativeLocalSecurity.ts` is unreachable from the shipping graph (verified at
  planning time: only legacy pressureMap/mobileShell files import it, and the shell imports
  from mobileShell are `import type` only).
- Build recipe (Windows MAX_PATH — REQUIRED): `subst M: <repo-root>` may already map; build
  from `M:\apps\mobile\android` with `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"`:
  `.\gradlew.bat :app:assembleRelease "-PreactNativeArchitectures=x86_64" "-PFOLIO_UPLOAD_STORE_FILE=debug.keystore" "-PFOLIO_UPLOAD_KEY_ALIAS=androiddebugkey" "-PFOLIO_UPLOAD_STORE_PASSWORD=android" "-PFOLIO_UPLOAD_KEY_PASSWORD=android"`
  → BUILD SUCCESSFUL. (x86_64 targets the emulator; install with
  `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe -s emulator-5554 install -r <apk>` —
  ONLY to emulator-5554. NEVER install to any other device id.)

## Commands

Typecheck from `apps\mobile`: `..\..\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json`;
full suite from root: `node node_modules/vitest/vitest.mjs run`; build/install: above.

## Scope

**In scope**: `apps/mobile/app.config.ts` (extraProguardRules), `apps/mobile/package.json`
(remove expo-local-authentication).
**Out of scope**: anything inside `apps/mobile/android/` (regenerated; do not hand-edit),
`src/local/nativeLocalSecurity.ts` (dead code excision is another plan), lockfiles beyond
what the package-manager touches — NOTE: pnpm is broken on this box; removing the dep from
package.json WITHOUT a lockfile update is acceptable here (prebuild reads package.json),
say so in NOTES.

## Git workflow

Conventional commit: `fix(android): durable ProGuard keep rules + drop unused biometric permission`. No push.

## Steps

1. In app.config.ts's expo-build-properties android block, add `extraProguardRules` with:
   reanimated + turbomodule keeps (copy the two existing rules from the untracked
   proguard-rules.pro verbatim), plus conservative keeps for the post-rule deps:
   `-keep class expo.modules.iap.** { *; }`, `-keep class com.clerk.** { *; }` (verify the
   actual package prefix by grepping `node_modules/@clerk/clerk-expo/android` — if no
   android dir exists, Clerk is JS-only: SKIP its rule and say so in NOTES),
   `-keep class com.reactnativeandroidwidget.** { *; }` (verify prefix in
   `node_modules/react-native-android-widget/android`), and Sentry's documented rules
   (grep `node_modules/@sentry/react-native/android` for a consumer-rules file — if the
   AAR ships consumer ProGuard rules, R8 applies them automatically: note that and skip).
   Only add rules for things NOT already covered by library consumer rules — check each.
2. Remove `expo-local-authentication` from package.json dependencies.
3. Typecheck + full suite green (JS untouched — should be trivially green).
4. Release-build verification: run the build recipe above → BUILD SUCCESSFUL. Then verify
   the rules actually reached R8: after the build,
   `Select-String -Path M:\apps\mobile\android\app\build\outputs\mapping\release\configuration.txt -Pattern "expo.modules.iap"`
   (or the mapping dir's merged rules file) → your rule appears. Install to emulator-5554,
   launch, open the paywall screen (adb shell am start + manual nav not possible — instead
   check logcat for crashes on boot: `adb -s emulator-5554 logcat -d -t 100 *:E` → no FATAL).
5. NOTE in report: the manifest's biometric permission disappears only after the NEXT
   `expo prebuild` regenerates android/ — the currently-checked-out android dir is stale
   by design; do NOT hand-edit it.

## Done criteria

- [ ] extraProguardRules present in app.config.ts with verified-prefix rules.
- [ ] expo-local-authentication gone from package.json.
- [ ] Typecheck + full suite green.
- [ ] Release build succeeds AND the merged R8 config contains the new rules.
- [ ] Emulator boot shows no FATAL.
- [ ] Only in-scope files modified.

## STOP conditions

- The emulator (emulator-5554) is offline (report — do not install anywhere else).
- The build fails twice.
- A library's package prefix can't be verified (skip its rule + NOTES, don't guess).

## Maintenance notes

- Every future native dep addition should touch extraProguardRules in the same PR unless
  the library ships consumer rules. Reviewer: diff the mapping configuration.txt claim.
