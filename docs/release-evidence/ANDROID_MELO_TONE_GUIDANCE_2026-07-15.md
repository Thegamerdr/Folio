# Android Melo tone and guidance evidence — 2026-07-15

## Verdict

The Personal companion's four user-selected styles are now one persisted preference across the
live product. Chat and Today read the same value. Tone never changes a number, safety result,
Review task, recovery route or deterministic financial conclusion.

The narrower P6 guidance rule is implemented on the live Today surface:

- `Calm`, `Honest` and `Dry` keep proactive money-move suggestions off Today;
- `Coachy` may surface the existing subscription-pause and low-point-goal prompts;
- factual spend review remains available in every style;
- onboarding, Review, shelf reminders, shortfall/recovery, payday ritual, insights and mode
  selection are not hidden by the tone gate.

## Reconciliation decision

The inherited RN port specification defines the four visible choices `Calm`, `Honest`, `Dry` and
`Coachy`. The later alignment audit requires that preference to persist globally and gate proactive
guidance. The three-mode `gentle` / `balanced` / `accountability` policy renderer is used only by
non-shipping fixture adapters, so it was not substituted into the live UI.

The visible settings label is now `Melo style`, with a short explanation for each choice. The chat
component reads the persisted store value directly instead of mirroring it in component state.

## Automated proof

Focused coverage passed 101 tests across:

- the new global tone and Today-selection contract;
- deterministic local companion turns;
- adversarial/safety precedence;
- source-copy lint;
- four-tone fact invariance in the Melo engine;
- three-mode fact invariance in the policy package.

The complete repository gate passed:

- 188 test files;
- 2,316 tests;
- all package and service typechecks;
- formatting, dependency and V1 boundaries;
- synthetic-data, constitution and canonical product gates;
- source-package and fixture validation.

The public-release gate remains deliberately blocked by the separately registered iOS, independent
accessibility/security, store, billing, legal and operations requirements.

## Android proof

### Physical Galaxy S9

- Device: `SM-G960F`, serial `2af26a2c19017ece`.
- Existing install updated with `adb install -r`; `firstInstallTime` remained
  `2026-06-26 15:22:33`, so app data was not wiped.
- The Calm and Coachy settings layouts fit the smaller device without clipping.
- Coachy remained selected after a full force-stop and relaunch.
- The original Calm preference was restored after validation.
- The final Today state remained the owner's existing empty/real state: no sample or test money was
  left behind.
- Filtered `AndroidRuntime` and `ReactNativeJS` error logs were empty.

Evidence:

- `android-melo-tone-settings-physical-2026-07-15.png`
- `android-melo-tone-coachy-physical-2026-07-15.png`
- `android-melo-tone-persisted-physical-2026-07-15.png`
- `android-melo-tone-final-today-physical-2026-07-15.png`

### Android emulator

- Clean onboarding was skipped without adding sample data.
- Calm and Coachy settings rendered correctly.
- Filtered `AndroidRuntime` and `ReactNativeJS` error logs were empty.
- App data was cleared after the run, leaving a clean emulator install.

Evidence:

- `android-melo-tone-settings-emulator-2026-07-15.png`
- `android-melo-tone-coachy-emulator-2026-07-15.png`

## APK artifacts

Both artifacts contain `arm64-v8a` and `x86_64` React Native libraries.

### Production-signed

- File:
  `artifacts/android-physical-private/melo-companion-tone-boundary-2026-07-15-production-signed.apk`
- Size: `108,708,127` bytes.
- SHA-256: `4942D76EF98BE39A20A30A2E74697E9CDE9AD12601384B4CB94A37BEEBA320F4`.
- Certificate SHA-256:
  `547396e1fd99681c2a6d768b8b7d1b4484b5f42a17597cad6c495221267a5488`.
- APK Signature Scheme v2 verified.

### Physical-device debug-signed

- File:
  `artifacts/android-physical-private/melo-companion-tone-boundary-2026-07-15-physical-debug-signed.apk`
- Size: `108,695,791` bytes.
- SHA-256: `EF0F5283F81258CF0BA1D48E743DEA5F96917466168571686204D16DB396F3FA`.
- Certificate SHA-256:
  `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- APK Signature Schemes v2 and v3 verified.

## Limits

This closes the locally testable Personal P6 tone/guidance gap. It is not evidence for iOS,
independent accessibility or safety review, public-store submission, Business workspace isolation
or live Open Banking activation.
