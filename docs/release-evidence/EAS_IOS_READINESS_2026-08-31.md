# Melo EAS/iOS readiness — 31 August 2026

## Current evidence

- `apps/mobile/app.config.ts` declares iOS bundle `com.folio.v2.greenfield`, version `0.0.1`,
  Expo project `ef69039d-abaf-48e9-b35a-52d80b03a96a` and the production update channel.
- `apps/mobile/eas.json` has development, preview, tester and production profiles.
- The local `eas` executable is not installed on this Windows host, but the repository's
  `pnpm dlx eas-cli@20.3.0` path is available and authenticated as `thegamer.dr1`.
- `pnpm --filter @folio/mobile native:smoke:ios` is not runnable on Windows because local iOS
  builds require macOS/Xcode.

## Cloud build checks

- `pnpm dlx eas-cli@20.3.0 build --platform ios --profile development --non-interactive` reached
  EAS after the project was prepared with `expo-dev-client@~56.0.26`; it created the development
  update channel/branch, then stopped because no remote iOS credentials suitable for internal
  distribution were available in non-interactive mode. No iOS artifact was produced.
- `pnpm dlx eas-cli@20.3.0 build --platform ios --profile production --non-interactive` resolved
  the production environment and found remote iOS credentials, but stopped because the distribution
  certificate is not validated for non-interactive builds. EAS requested an interactive credential
  setup; no iOS artifact was produced.
- Both cloud checks warned that `ios.infoPlist.ITSAppUsesNonExemptEncryption` is missing. The
  correct value is an owner/legal export-compliance decision and has deliberately not been guessed.

## Exact unblock command

On a macOS host with Xcode and authenticated EAS credentials, after interactive iOS credential
setup (or after adding the required development-client dependency for a development build):

```text
pnpm --filter @folio/mobile eas:ios:development
```

For a store candidate, use the existing `production` profile through the authenticated EAS CLI,
retain the build URL and checksum, install on a supported iOS device, and repeat the accessibility,
account/deletion and runtime checks against that exact archive. Do not claim iOS build, install,
runtime or App Store review evidence from this Windows-only configuration inspection.

## Remaining external evidence

- macOS/Xcode or authenticated EAS iOS signing credentials;
- Interactive validation/setup of the EAS distribution certificate and internal-distribution
  credentials;
- Owner/legal export-compliance decision for `ITSAppUsesNonExemptEncryption`;
- iOS archive and install/runtime smoke;
- VoiceOver, large text, reduced motion and iOS privacy-manifest review;
- App Store Connect metadata, privacy answers and account-deletion review.
