# Melo release checklist — current authority (2026-08-24)

This file supersedes stale Folio/Plus/Pro naming and package-ID guidance. The product is Melo and
the owner-approved native identity is deliberately retained:

- Android package: `com.folio.v2.greenfield`
- iOS bundle: `com.folio.v2.greenfield`
- App version: `0.0.1`
- Android versionCode: `1`

Do not rename the package merely because historical checklists called it undecided. A package change
would orphan installed devices and the billing audience. `apps/mobile/app.config.ts` and
`apps/mobile/android/app/build.gradle` are the identity sources.

## Current product and billing truth

- App name: Melo.
- Local core: usable without account, cloud, AI, Open Banking or billing.
- Billing: `folio.full` is a one-time non-consumable Full entitlement;
  `folio.live.monthly` and `folio.live.yearly` are Live subscriptions. `folio.plus.*` and
  `folio.pro.*` are legacy restore-only IDs and are not current products.
- Cloud: optional Clerk-authenticated client-encrypted Cloud Vault; production binding and restore /
  deletion proof remain external.
- Open Banking: disabled in the current release candidate; an explicit approved-build flag is
  required before any regulated provider route is exposed.
- AI: current mobile core is deterministic/local; raw document/chat transport is retired. The
  enum-only gateway is future/optional and not a raw-data release dependency.
- Sentry: redacted crash diagnostics only; no user fields, screenshots, traces or replay.

## Hard gates before first Play upload

1. **Complete:** the upload-signed `melo-0.0.1-1-production.aab` matches package
   `com.folio.v2.greenfield`, version `0.0.1`, versionCode `1`, arm64 ABI and the upload signature.
   SHA-256 is `6023B1A455907739B5EB6D7ABEA26B19212ADABF308170510ED2A50EB3E2A999`.
2. **Complete:** `tooling/config/store-declarations.json.submittedBinarySha256` is populated only
   after bundletool/manifest/signature/hash review. Android declaration rows are marked
   `binaryMatched` only where this exact AAB was reviewed; console submission remains false.
3. Complete Google Play developer identity-document and contact-phone verification. The current
   account has no apps and **Create app** is disabled until Google accepts both checks.
4. Publish an owner-confirmed privacy policy URL, support contact and (because accounts exist) public
   deletion URL. Do not invent any address or domain.
5. Create the current Play products (`folio.full`, `folio.live.monthly`, `folio.live.yearly`) and
   run license-test purchase, pending/invalid rejection, restore, expiry/cancellation/grace and
   account/device-boundary proof. Do not sell legacy Plus/Pro IDs.
6. **Engineering match complete:** Google Data Safety, Financial Features, account-deletion and
   Android SDK/permission drafts were checked against the exact AAB. Do not set `consoleSubmitted`
   without real console evidence; re-check the completed console forms before rollout.
7. **Emulator smoke complete:** the matching signed x86_64 tester passed onboarding, restart,
   background/Back, 200% text, reduced motion and real TalkBack checks on `emulator-5570`. The
   attached physical Android device remains `adb unauthorized`; physical secure-key/biometric,
   notification, picker/share and destructive-recovery proof still requires owner authorization.
8. Obtain independent security, accessibility and privacy/legal sign-off; internal evidence cannot
   close those blockers.

## iOS gate

EAS is authenticated, but the current production attempt needs interactive Apple credential /
provisioning setup. Produce an iOS archive if credentials permit; runtime/install evidence still
requires macOS/Xcode or an iOS device. Resolve the App Store export-compliance answer for standard
AES-GCM implemented outside the OS (`ITSAppUsesNonExemptEncryption`) with the owner/legal reviewer;
do not infer an exemption. No iOS PASS is claimed without the artifact and runtime evidence.

## Authoritative status commands

```text
pnpm release:status
pnpm store:status
pnpm operations:status
```

Every blocker in `tooling/config/release-blockers.json` carries the exact classification
`CLOSED`, `BLOCKED EXTERNAL` or `BLOCKED OWNER DECISION`. Historical phase documents remain evidence
only; use the current register, store package and operations records for release decisions.
