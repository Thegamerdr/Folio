# Melo current store-submission package — 2026-08-24

## Submission identity

| Field                  | Current engineering truth                                          | Evidence/state                                                              |
| ---------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Product name           | Melo                                                               | `apps/mobile/app.config.ts`                                                 |
| Android application ID | `com.folio.v2.greenfield`                                          | Deliberately retained; do not rename from stale Folio-era checklists        |
| iOS bundle ID          | `com.folio.v2.greenfield`                                          | `apps/mobile/app.config.ts`                                                 |
| App version            | `0.0.1`                                                            | `apps/mobile/app.config.ts`                                                 |
| Android versionCode    | `1`                                                                | `apps/mobile/android/app/build.gradle`                                      |
| Candidate artifact     | `app-release.aab`                                                  | **OWNER/RELEASE INTEGRATION REQUIRED** — no candidate hash is recorded here |
| Candidate SHA-256      | `OWNER/RELEASE INTEGRATION REQUIRED: paste the actual AAB SHA-256` | Must be set only after hashing the exact submitted AAB                      |
| Play submission        | Not submitted                                                      | Console submission must not be claimed from repository evidence             |
| Privacy policy URL     | `OWNER INPUT REQUIRED: choose/confirm an owned public URL`         | No owned public URL is present in repo/config                               |
| Support contact        | `OWNER INPUT REQUIRED: choose/confirm support contact`             | No inbox/service is present in repo/config                                  |

The existing Google Play developer account is authenticated, but it currently has no apps and
Google disables **Create app** until the owner completes identity-document and contact-phone
verification. Product creation, license testing and first upload cannot proceed before that
account-level approval.

## Product/data-safety truth

The submitted binary must be reviewed against these facts. Optional services are visible only when
the user chooses the associated flow and/or signs in; local manual entry, statement import and
deterministic Melo remain usable without an account.

| Surface             | Shipping exposure                                                                                                                               | Data sent/processor                                                                                                                   | Consent/auth/deletion/failure behavior                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Local core          | In scope by default                                                                                                                             | Encrypted local SQLCipher state and encrypted retained sources; no processor                                                          | No account required; local export and Start fresh wipe; recovery failures fail closed                                       |
| Clerk sign-in       | Optional account flow                                                                                                                           | Sign-in identifier/session data to Clerk; current app config contains a publishable key only                                          | Explicit sign-in; logout available; production Clerk environment and deletion E2E remain external                           |
| Cloud Vault         | Optional encrypted backup                                                                                                                       | Client-encrypted envelope + operational metadata to Melo Cloudflare Worker; plaintext money data is not stored by Worker              | Clerk bearer token required; backup/delete routes exist; outage keeps local core; production binding/restore proof external |
| Google Play Billing | Optional Full/Live purchase                                                                                                                     | Product ID and purchase proof to Play and Melo billing Worker; no card data to Melo                                                   | Signed server grant; pending/invalid proof does not unlock; restore path exists; live listing/test proof external           |
| Open Banking        | **Disabled in the current release candidate**; deployed Worker health reports `featureEnabled=false` and `/v1` routes return `feature_disabled` | No Open Banking data is sent by this candidate                                                                                        | Future provider build requires explicit consent, provider/DPIA/deletion proof and store re-review                           |
| AI/provider         | No raw financial/document/chat transport in current mobile release; optional enum-only future gateway exists                                    | Only approved intent/tone/outcome enums if a future route is enabled; raw routes return `410`                                         | Current deterministic/local path remains; provider route can be disabled; future provider approval external                 |
| Sentry              | Crash diagnostics configured                                                                                                                    | Redacted exception type/stack/severity/technical device context; user fields, screenshots, view hierarchy, traces and replay disabled | No account required; event failures do not block the app; source-map/org operation external                                 |

## Billing product matrix

| Store product ID              | Type                       | Entitlement        | Current code truth                        | Submission state                                                                           |
| ----------------------------- | -------------------------- | ------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `folio.full`                  | Google Play non-consumable | Full, permanent    | `PRODUCT_IDS.full`; signed grant required | Worker catalog is deployed; Play listing/license-test and purchase/restore proof required  |
| `folio.live.monthly`          | Google Play subscription   | Live, monthly      | `PRODUCT_IDS.live.monthly`                | Worker catalog is deployed; Play listing/license-test, renewal/cancel/grace proof required |
| `folio.live.yearly`           | Google Play subscription   | Live, yearly       | `PRODUCT_IDS.live.yearly`                 | Worker catalog is deployed; Play listing/license-test, renewal/cancel/grace proof required |
| `folio.plus.*`, `folio.pro.*` | Legacy restore-only IDs    | Grandfathered Full | Never sell in current Melo model          | Do not create new listings; retain only for restore compatibility                          |

## Google Play declaration answers (engineering draft)

- Data collected: financial information and documents only when the user explicitly enables the
  corresponding import/optional service; account identifiers for optional Clerk sign-in; purchase
  history for billing; crash diagnostics as described above.
- Data shared: Cloud Vault receives ciphertext/metadata; Clerk receives authentication data; Play
  receives purchase/payment data; Sentry receives redacted diagnostics. Open Banking is disabled in
  this candidate and requires a separately approved build. Melo has no ads or behavioural analytics.
- Security: encrypted in transit; local money state and retained sources encrypted at rest; Worker
  boundaries do not receive plaintext vault data.
- Deletion: local wipe is separate; cloud purge exists and the provider-index purge route is retained
  for a future approved Open Banking build; identity deletion is fail-closed until remote purge
  confirms. Public web deletion route, production provider config and signed E2E proof remain external.
- Financial features: budgeting/record organisation, deterministic forecasts and user-reviewed
  imports; no payment initiation, money custody, product recommendations, investment advice or
  direct HMRC filing.

## Apple App Privacy / account deletion draft

The same data-flow inventory applies to iOS if an iOS binary is produced. The current iOS path has
not been installed or submitted. Apple answers, account deletion answers and required privacy-manifest
review must be checked against the actual iOS binary; no iOS submission is claimed.

## SDK and permission inventory

- SDKs: Expo/React Native, SQLCipher storage, Clerk Expo (optional auth), Sentry React Native
  (redacted crash diagnostics), Expo IAP, Expo document/image picker, Expo sharing, Expo secure
  store/local authentication, notifications/calendar and WebBrowser/Open Banking adapter.
- Blocked permissions: `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `RECORD_AUDIO` and
  `SYSTEM_ALERT_WINDOW` are explicitly blocked in `app.config.ts`; audio recording is disabled.
- User-mediated surfaces: document/photo picker, optional camera capture, optional notifications,
  calendar export, biometric/PIN app lock and share/export.
- No advertising ID, tracking SDK, analytics SDK, raw chat transport or provider secret is shipped.

## Reviewer notes

Use synthetic reviewer data only. Melo works locally without an account; account/cloud/bank flows
are optional. Do not ask a reviewer to provide real financial data. The reviewer must be given the
exact candidate artifact/hash and an owner-confirmed privacy/support URL before console submission.

## Submission gate

This package is engineering-complete as a declaration draft. The billing Worker catalog and signing
boundary are deployed, but `providerConfigured` is false until the owner supplies the Google Play
service credential. EAS is authenticated, but iOS production credentials/provisioning need an
interactive Apple setup. The package is **not** console-submitted and does not claim a current public
privacy URL, support inbox, candidate hash, billing purchase proof, external account-deletion proof
or independent reviewer sign-off. Apple export-compliance treatment for the app's standard AES-GCM
implementation is also an owner/legal determination. Update `tooling/config/store-declarations.json`
only after those external facts exist and the exact candidate binary has been matched.
