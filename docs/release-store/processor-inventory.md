# Melo Processor and External-Service Inventory

Last reviewed: 20 July 2026

This inventory describes the current Android release-candidate configuration. A service is listed
as conditional when the app contains an integration but the flow is unavailable until the user
chooses it and production provider configuration is present.

| Provider / service                   | Purpose                                                                                           | Data boundary                                                                                                                                                           | Candidate state                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Cloudflare Workers                   | Public site; client-encrypted backup storage; billing verification; optional Open Banking adapter | Public HTTP metadata; ciphertext and account-scoped operational metadata for backup; store purchase proof for billing; provider-scoped data only after explicit consent | Active infrastructure; each optional app flow remains user initiated                     |
| Sentry                               | Crash diagnostics                                                                                 | Scrubbed exception type, stack, severity and technical app/device context; no configured screenshots, replay, tracing, user, request, extras or breadcrumbs             | Active in release builds                                                                 |
| Clerk                                | Optional sign-in and identity lifecycle                                                           | Sign-in identifier and authentication/session data                                                                                                                      | Conditional; the local personal core does not require an account                         |
| Google Play                          | Android distribution and billing                                                                  | Store account, payment handled by Google, product identifier and purchase proof returned to Melo                                                                        | Conditional until the Play listing and products are active                               |
| Apple App Store                      | Future iOS distribution and billing                                                               | Store account, payment handled by Apple, product identifier and transaction proof returned to Melo                                                                      | Not active until the iOS app is created                                                  |
| Expo EAS Update                      | JavaScript update delivery                                                                        | Update request metadata needed to select and deliver the configured runtime/channel                                                                                     | Configured for the production channel; update code signing is not yet configured         |
| TrueLayer or another approved AISP   | Optional Open Banking account-information consent                                                 | Account and transaction information within the user's explicit provider consent; provider credentials remain server-side                                                | Not active for public release until procurement, legal and production consent gates pass |
| OpenRouter / approved model provider | Future enum-only wording service behind Melo's gateway                                            | Approved intent, tone and outcome enums plus placeholders; the gateway rejects prompts, documents, names, transaction rows and exact values                             | Not called by the current mobile app                                                     |

## Explicit exclusions

- No advertising, attribution or behavioural-analytics SDK.
- No raw statement, image, OCR text, Melo conversation, merchant name or exact financial value is
  sent to an AI/model provider.
- No bank credential, Cloudflare secret, Sentry credential with administrative access, store
  verification key or Clerk secret key is embedded in the mobile app.
- Support must never request a vault recovery secret or unredacted financial record.

## Review rule

Re-run the SDK and permission inventory against the exact AAB submitted to Google Play and the exact
archive submitted to Apple. Update this file and the public privacy policy before enabling any
conditional processor or material data flow.
