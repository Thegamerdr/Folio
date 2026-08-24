# Google Play Data Safety — Melo engineering draft (2026-08-24)

Status: **prepared; BLOCKED EXTERNAL until the exact `app-release.aab` is hashed/matched and the
owner submits/reviews the Play Console form.**

## Current answers to reconcile in Play Console

- Product: Melo; package `com.folio.v2.greenfield`; version `0.0.1`, versionCode `1`.
- Financial information: collected locally for the core; sent only when the user opts into Cloud
  Vault backup, billing verification or the Open Banking provider boundary. Melo does not sell or
  use it for advertising.
- Photos/files: selected statement images/PDFs are read locally. An Open Banking connection sends
  provider-required data only after explicit consent. Retained originals stay encrypted locally.
- Personal identifiers: Clerk receives sign-in identifier/session data only when the user signs in.
- Purchase history: Google Play and Melo billing verification receive product ID/purchase proof;
  Melo does not receive card details.
- App activity/analytics/advertising: no behavioural analytics, ad SDK or tracking SDK.
- Crash diagnostics: Sentry receives redacted technical exception/device context; user fields,
  screenshots, view hierarchy, traces and replay are disabled.
- Data sharing: Cloud Vault receives client-encrypted ciphertext/metadata; Open Banking provider
  access is optional and consented; AI raw document/chat transport is retired.
- Deletion: local wipe exists; Cloud Vault and provider-index purge routes exist; identity deletion
  is fail-closed until remote purge confirms. Public web deletion URL and production E2E proof remain
  external.
- Security: encryption in transit and encrypted local storage; no provider secret is embedded in
  the APK.
- Financial features: record organisation, budgeting, deterministic forecasts and reviewed imports;
  no payments, money custody, investment/product recommendation or direct tax filing.

## Required external evidence

1. Owner confirms an owned public privacy/support/deletion URL.
2. Release engineer attaches the exact candidate AAB and SHA-256.
3. Play Console owner creates/reviews the declaration and billing products.
4. Production Clerk/Worker/provider test account proves deletion and consent revocation boundaries.

Official reference: <https://support.google.com/googleplay/android-developer/answer/10787469>
