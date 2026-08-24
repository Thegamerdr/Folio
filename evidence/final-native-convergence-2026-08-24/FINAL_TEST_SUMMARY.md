# Final native convergence evidence — 2026-08-24

## Scope and source

- Existing workspace: `C:\dev\melo-native-today-batch1-2026-08-24`
- Branch: `codex/melo-native-port-2026-08-24`
- Required start SHA: `5eaa4255117d8f8ef56eb210760c303947b16e10`
- Existing package: `com.folio.v2.greenfield`
- This is the existing React Native app. No replacement app or parallel shell was created.

## Registry closure

- `registryCoverage.test.ts` compares the live unions, title maps, dispatch branches, self-hosted
  routes, render branches, and the shipping coverage artifact.
- Screens: **52/52**
- Non-null sheets: **27/27**
- Total active shipping surfaces: **79/79**
- Unknown: **0**
- Known unported: **0**

## Critical journeys

- Personal: populated Today pressure state, recovery preview, spend what-if, Review/Activity/
  Decisions, Plan/Calendar/Pots, commitments, Privacy, and dedicated Melo were exercised on the
  Android runtime. Existing native stores and engines remained the source of truth.
- Business: a supported UI-created Limited Company workspace was populated with an account,
  client, paid and unpaid invoices, recurring obligation, trading profit, and Corporation Tax pot.
  Today, runway, invoices, Corporation Tax, CT600, and filing views agreed with those authorities.
- Deterministic tests additionally cover both Sole Trader and Limited Company populated acceptance
  fixtures, including VAT/tax/payroll/filing projections.
- Melo: Personal and Business context sheets were opened from their shipping screens. Android
  hardware Back dismisses the keyboard when present, then closes the local sheet without leaving
  the Melo screen.

## Visual, responsive, theme, and accessibility acceptance

- Android sizes: small `720x1280`, standard `1080x2160`, tall `1080x2400`.
- Text scale: Android `font_scale=1.3` was cold-launched and visually checked; the setting was
  restored to `1.0`.
- Reduced motion: all three Android animator scales were set to `0`, the app was cold-launched and
  checked, then the scales were restored to `1`.
- Theme: explicit Light and Dark passed. With **System** still selected, OS night mode was flipped
  light -> dark -> light and the app followed each change; the preference remained System.
- First run: small-device onboarding was completed through the shipping UI. The intent list
  required scrolling, and its CTA remained reachable rather than clipped.
- Representative retained evidence:
  - `android-final-cold-small.png`, `android-final-cold-standard.png`, `android-final-tall.png`
  - `android-final-font-scale-130.png`, `android-final-reduced-motion.png`
  - `melo-sheet-open-before-hardware-back.png`, `melo-after-hardware-back.png`
  - `business-melo-context-open.png`, `business-melo-after-hardware-back.png`
  - `runtime-standard/system-os-light-stable.png`, `runtime-standard/system-os-dark-stable.png`
  - populated Personal and Business journey screenshots under `runtime-standard/`
  - first-run evidence under `preflight-small/`

## Defects closed in this final batch

1. Personal Melo's screen-owned context/intro sheets were invisible to the shell-level Android Back
   owner. A local Android Back handler now dismisses the open local sheet before navigation.
2. Business Melo had the same local context-sheet Back gap and now follows the same contract.
3. The pure Business filing working-copy builder eagerly loaded native print/share modules, which
   prevented deterministic Node/Vitest acceptance coverage. Native modules now load lazily only at
   the device share boundary; device behavior is unchanged.

## Automated verification

- Mobile typecheck: PASS
- Full workspace test suite: **222 files, 2602 tests passed**
- Final focused acceptance suite: **31/31 passed**
- Product gates: PASS
- Constitution: PASS
- Samples: PASS
- V1 boundary: PASS
- Boundary lint: PASS
- Release foundation: PASS
- Formatting / changed-file Prettier: PASS
- Registry coverage: PASS, **52 screens + 27 sheets = 79/79**

## Android release/runtime

- Gradle: `:app:assembleRelease --no-daemon -PreactNativeArchitectures=x86_64`
- Result: **BUILD SUCCESSFUL** in 2m 28s
- APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Size: `95,093,776` bytes
- SHA-256: `5128DC93AA7450A4BD89FB91E939DA08E783C09188FB01EF4048F3CECB3332F5`
- Install: PASS on `emulator-5554` and `emulator-5570`
- Cold launch: PASS on both devices
- Warm task resume: PASS
- Fatal/runtime log filter: **0 hits** on both devices

The x86_64 architecture override is for local emulator validation only; tracked production
architecture settings were not changed.

## Environment and owner evidence gaps

- iOS: **PASS WITH EXTERNAL EVIDENCE GAP**. The source remains cross-platform, but an iOS build,
  simulator, and runtime smoke cannot be performed on this Windows host.
- Operations readiness: **BLOCKED BY OWNER/ENVIRONMENT** for independent tabletop/rotation drills
  and vulnerability-disclosure evidence.
- Store declarations/public release: **BLOCKED BY OWNER/ENVIRONMENT** for store-console, signed
  production-binary, privacy/processor/SDK declarations, independent security/accessibility/legal
  reviews, billing, cloud-account-deletion, and iOS release evidence.
- These external release approvals are not native implementation defects.

## Final implementation status

- Known implementation failures: **0**
- Known fatal/runtime errors: **0**
- Unknown or unported active shipping surfaces: **0**
