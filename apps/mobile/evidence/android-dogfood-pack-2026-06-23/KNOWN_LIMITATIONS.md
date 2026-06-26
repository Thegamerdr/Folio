# Known Limitations

Date: 2026-06-23

## Dogfood Limitations

- Physical Android device was not attached during this pass.
- Emulator runtime cannot prove hand feel, device biometrics, real keyboard behavior or real camera
  and file workflows.
- Automated ADB typing can append placeholder text into React Native fields; owner manual typing is
  the real usability signal.
- Import review scenarios are prepared but not re-run end to end in this pass.
- Recovery preview is covered by the previous Android evidence pass and should still be repeated by
  the owner on a physical device.
- Offline check was a light local smoke, not a long airplane-mode session.

## Explicit Non-Claims

- No Business UI.
- No cloud sync.
- No Open Banking.
- No AI gateway.
- No billing.
- No OCR pipeline.
- No final Melo character runtime.
- No full visual redesign.
- No iOS proof.
- No iOS Simulator install on this host: the current Codex workspace is Windows, and Apple's iOS
  Simulator runtime requires a macOS/Xcode host.
- No App Store release.
- No Play Store release.
- No public release readiness.

## Existing Release Blockers

The repo's release gates still report known public-release blockers, including iOS native smoke,
security/key proof, store declarations, independent reviews, billing and legal/privacy readiness.
Those blockers do not prevent internal Android owner dogfood through the local APK route. iOS
simulator dogfood needs a Mac with Xcode installed, then the existing `native:smoke:ios` /
`expo run:ios` route can be used.
