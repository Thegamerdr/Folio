# Melo owner action pack — current release gate (2026-08-24)

This is the only current owner-action list. It contains genuine external actions; internal tabletop,
safe rotation drills, declaration drafts and DPIA evidence are already delivered in this branch.

## 1. Confirm public contact and policy routes — owner decision

- Exact action: choose/confirm an existing owned support/security contact, legal entity and public
  privacy/account-deletion URLs.
- Where: owner/domain or existing support service; then copy the values into
  `PRIVACY_POLICY.md`, `docs/release-operations/vulnerability-disclosure-readiness.md` and the
  store declaration config.
- Required value: real inbox/service/URL; do not use a fabricated address or unrelated domain.
- Expected result: reviewers can reach support/security and users can read privacy/deletion policy.
- Evidence to save: public URL response and owner confirmation; legal/privacy approval record.
- Blocks: Android public and iOS public; support/disclosure readiness.

## 2. Verify the Google Play account, create Melo and test billing

- Exact action: complete Google Play developer identity and contact-phone verification first; the
  current account has no apps and **Create app** is disabled. Then create the Melo app for
  `com.folio.v2.greenfield`, list `folio.full` (one-time), `folio.live.monthly` and
  `folio.live.yearly` (subscriptions), add a license tester and execute purchase, pending/invalid
  rejection, restore, reinstall restore, expiry/cancel/grace and device/account boundary proof.
- Where: Google Play Console account `8129371611351079578` and the configured billing Worker; use
  sandbox/license-test only.
- Required value: owner identity document/contact-phone verification, Google Play service-account
  credential and approved prices. Never sell legacy `folio.plus.*`/`folio.pro.*` IDs.
- Expected result: signed grant verification and native Play lifecycle match the current store
  package.
- Evidence to save: product screenshots/export, tester purchase/restore logs, grant IDs/hashes and
  cancellation/expiry proof with no card data.
- Blocks: Android beta upload and Android public.

## 3. Prove production account/cloud/provider deletion if those optional services ship

- Exact action: configure production Clerk/Cloud Vault and, only if the owner approves a future
  Open Banking build, its regulated provider. Create a disposable test account and run
  sign-up/sign-in, backup/restore, logout, remote purge, provider disconnect/revocation and identity
  deletion. Never use the owner's real account or financial data.
- Where: provider dashboards and a disposable test device/account.
- Required value: owner/provider credentials, approved processor contracts and test account.
- Expected result: remote purge confirms before Clerk deletion; local wipe remains separate. The
  current candidate makes no Open Banking request; any future enabled build must match provider
  consent/revocation wording to real behavior.
- Evidence to save: redacted request/response IDs, deletion confirmations, retention schedule and
  provider revocation result.
- Blocks: Android public and iOS public if those optional routes ship.

## 4. Obtain independent review signatures

- Exact action: send the completed security, accessibility and DPIA/privacy/legal packages to named
  independent reviewers and record decisions against Android candidate SHA-256
  `5120F437F7C004F323576DEBEF32CD9C17203A4E7E376E6ACED1248D074ED14F`.
- Where: owner-selected independent security, accessibility and legal/privacy reviewers.
- Required value: reviewer names/organisations, scope, date, findings and sign-off.
- Expected result: no unaccepted high/critical findings and explicit approval of store/privacy/
  accessibility claims.
- Evidence to save: signed review records and remediation evidence; do not self-approve.
- Blocks: Android public and iOS public.

## 5. Complete remaining physical Android and iOS release evidence

- Exact action: authorize the attached physical Android device and run the remaining hardware-bound
  secure-key, biometric, notification, picker/share and safe destructive-recovery drills against the
  signed candidate. Emulator launch/restart/background/Back/onboarding, 200% text, reduced motion
  and real TalkBack smoke are already complete. For iOS, use authenticated EAS / macOS/Xcode and an
  iOS device or simulator.
- Where: authorize the currently attached Android device for USB debugging, then use `adb`;
  complete interactive Apple credential/provisioning setup in EAS or use macOS/Xcode for iOS.
- Required value: physical-device/build logs, screenshots and exact candidate metadata.
- Expected result: hardware-bound Android and iOS evidence complements the signed-candidate emulator
  record without converting internal accessibility checks into independent sign-off.
- Evidence to save: install/launch logs, screenshots, accessibility observations and recovery proof.
- Blocks: Android beta/public; iOS beta/public.

## 6. Resolve Apple export compliance

- Exact action: determine the correct App Store export-compliance answer for standard AES-GCM
  encryption implemented outside the operating system, and record the owner/legal decision.
- Where: App Store Connect export-compliance questionnaire and the privacy/legal release record.
- Required value: a documented determination for `ITSAppUsesNonExemptEncryption`; do not assert
  exemption from engineering inference.
- Expected result: the iOS submission package carries the owner-approved answer and any required
  supporting documentation.
- Evidence to save: owner/legal decision or counsel note attached to the iOS submission package.
- Blocks: iOS public.
