# Melo 1.0.0 Android Release Candidate

Prepared 20 July 2026 from the live Lovable-led React Native source state.

## Upload Artifact

- File: `melo-1.0.0-1-release.aab`
- Package: `com.melomoney.app`
- Version name / code: `1.0.0` / `1`
- Minimum / target SDK: `29` / `36`
- ABI: `arm64-v8a`
- Size: `98,858,840` bytes
- SHA-256: `3B4B36402D0555B6E210082FCC9D9FCE79D39C059740A0B8B882DA5BE473E5A4`
- Bundletool validation: passed
- JAR signature validation: passed with the self-signed upload certificate

## Device Artifact

- File: `melo-1.0.0-1-release.apk`
- Size: `138,482,966` bytes
- SHA-256: `263766296462BE6073C8DD8DB615BB528D2E4A8154664F476FA4973DAFCF250F`
- APK Signature Scheme v2: passed
- Upload certificate:
  `54:73:96:E1:FD:99:68:1C:2A:6D:76:8B:8B:7D:1B:44:84:B5:F4:2A:17:59:7C:AD:6C:49:52:21:26:7A:54:88`

## Release Hardening

- R8 and resource shrinking enabled.
- `android:allowBackup="false"`.
- Debug mode and cleartext traffic are not enabled.
- Camera, microphone, broad storage, manage-storage and overlay permissions are absent.
- Release JavaScript scan found no production/test Stripe keys, private keys, Google API keys,
  Clerk test keys or private forwarding address.

## Verification

- TypeScript: passed.
- Tests: 225 files, 2,590 tests passed.
- Formatting and lint: passed.
- Constitution, canonical-product, contract and release-foundation gates: passed.
- Expo dependency-version check: passed.
- Expo Doctor: 20/21; its duplicate-module check sees three hoisted filesystem copies of the
  same `expo-constants@56.0.21`. `pnpm why` resolves one version and Expo Android autolinking
  resolves one root native module, which is the module compiled into the validated release.
- Physical-device smoke: Samsung SM-G960F, exact release APK installed and launched, Melo
  `MainActivity` remained resumed, zero crash markers.
- Screenshot: `melo-final-device.png`.
- UI hierarchy: `melo-final-device.xml`.
- Obfuscation mapping: `mapping.txt`.
- Native symbols: `native-debug-symbols.zip`.
- Play listing graphics and two physical-device screenshots: `play-store-assets/`.

## Live Services

- Website/legal/support: `https://melo-money.com`
- Billing entitlement service: `https://melo-billing-entitlements.tgdroppin.workers.dev`
- Public site Cloudflare version: `3c7e6b95-2ef4-4a07-a6cb-b0497da622f4`
- Billing Cloudflare version: `5ce76f99-0e1e-472a-8cd5-d0b0c9a4e5cf`
- Sentry runtime DSN is present; source-map upload was intentionally disabled because the
  organisation, project and upload token are not configured locally.

## External Release Dependencies

- Google Play account/app verification and Internal-test upload.
- Four Play subscription products and real purchase/restore/upgrade/expiry/offline-grace proof.
- Play Developer API service-account email/private-key secrets for the billing Worker.
- Play App Signing certificate added to `/.well-known/assetlinks.json`.
- Play declarations, content rating, target audience, screenshots, icon and feature graphic.
- Sentry organisation/project/auth credentials for source-map upload.
- iOS app record, signing, build and App Store work.
- Independent security, privacy/legal/DPIA and accessibility approvals plus human tabletop and
  key/provider rotation drills.
