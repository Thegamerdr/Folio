# Apple App Privacy — Melo engineering draft (2026-08-24)

Status: **prepared; BLOCKED EXTERNAL until an iOS candidate exists and App Store Connect review is
performed.** No iOS install, submission or independent privacy approval is claimed.

## Binary truth to review

- Product: Melo; bundle identifier `com.folio.v2.greenfield`; version `0.0.1`.
- Local core: encrypted money state and retained statement sources remain on-device by default.
- Optional processors: Clerk (sign-in), Melo Cloud Vault (client-encrypted backup), Google/Apple
  store billing where listed, Sentry (redacted crash diagnostics), and TrueLayer via the optional
  Open Banking adapter after explicit bank consent.
- AI: raw documents, images, transaction rows and chat prompts are not sent to a model provider;
  the enum-only future route is not used by the current mobile core.
- Tracking: no ad, attribution, behavioural-analytics or session-replay SDK.

## Review actions

Match collection/sharing/purpose answers against the exact iOS archive and privacy manifests. Confirm
the account-deletion answer only after production provider purge and a disposable test-account proof.
Confirm the owner-provided privacy URL and support route before submission.

Official references:

- <https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/>
- <https://developer.apple.com/app-store/user-privacy-and-data-use/>
