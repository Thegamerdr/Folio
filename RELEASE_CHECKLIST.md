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

1. Produce the actual upload-signed `app-release.aab`, verify package, version/versionCode and
   signature, and record SHA-256. Never upload a debug-signed artifact or print keystore secrets.
2. Keep `tooling/config/store-declarations.json.submittedBinarySha256` null until the exact candidate
   has been hashed; then set it and `binaryMatched` only after the package/hash match is performed.
3. Publish an owner-confirmed privacy policy URL, support contact and (because accounts exist) public
   deletion URL. Do not invent any address or domain.
4. Create the current Play products (`folio.full`, `folio.live.monthly`, `folio.live.yearly`) and
   run license-test purchase, pending/invalid rejection, restore, expiry/cancellation/grace and
   account/device-boundary proof. Do not sell legacy Plus/Pro IDs.
5. Match Google Data Safety, Financial Features, account deletion, SDK/permission and reviewer
   answers against the exact AAB. Do not set `consoleSubmitted` without real console evidence.
6. Run signed-candidate Android runtime/accessibility/resilience smoke on a disposable or owner-
   approved device. This machine has two authorized emulators, but the attached physical Android
   device is `adb unauthorized`; no physical-device PASS is claimed until the owner accepts the USB
   debugging authorization prompt.
7. Obtain independent security, accessibility and privacy/legal sign-off; internal evidence cannot
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
