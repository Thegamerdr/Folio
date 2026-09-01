# Melo owner action pack — current release gate (1 September 2026)

This is the only current owner-action list. It contains genuine external actions; the internal
tabletop revalidation, safe rotation drills, declaration drafts, privacy/DPIA package, security and
accessibility handoffs are already delivered in this branch. See
`docs/release-evidence/RELEASE_REVIEW_HANDOFF_2026-08-31.md` for the review index and
`docs/release-operations/support-intake-workflow.md` for the executable support boundary.

After installing provider secrets, run `pnpm provider:readiness`. It executes both the Google Play
billing and TrueLayer activation checks, reports every missing input in one pass and exits non-zero
until both deployed provider boundaries are configured. `pnpm provider:preflight` is the non-blocking
status form to use before secrets are available.

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
- Secret entry commands: run `pnpm billing:secret:google-email` and
  `pnpm billing:secret:google-private-key`, then confirm `pnpm billing:readiness`. Paste secrets only
  into the hidden Wrangler prompts; never into a file, shell history, issue or chat.
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
- Clerk values and console switches: supply the production `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
  (`pk_live_...`) and `EXPO_PUBLIC_CLERK_FRONTEND_API_HOST` (hostname only); enable Google, Apple,
  passkeys and self-service deletion in the Clerk production instance; complete the Apple/Google
  provider console configuration and publish the required domain association files.
- Cloud Vault values: deploy the Durable Object/KV Worker with production Clerk verification,
  configure `EXPO_PUBLIC_MELO_CLOUD_VAULT_URL`, and set the owner-controlled HTTPS account-deletion
  URL shown by `GET /delete-account`.
- TrueLayer activation inputs: register the callback URL printed by `pnpm open-banking:readiness`,
  then run `pnpm open-banking:secret:client-id`, `pnpm open-banking:secret:client-secret` and
  `pnpm open-banking:secret:encryption-key`. Re-run `pnpm open-banking:readiness` before enabling a
  provider build. Production Clerk/Cloud Vault also need their owner-issued production values and a
  disposable account for the deletion/restore proof.
- Expected result: remote purge confirms before Clerk deletion; local wipe remains separate. The
  current candidate makes no Open Banking request; any future enabled build must match provider
  consent/revocation wording to real behavior.
- Evidence to save: redacted request/response IDs, deletion confirmations, retention schedule and
  provider revocation result.
- Blocks: Android public and iOS public if those optional routes ship.

## 4. Obtain independent review signatures

- Exact action: send the completed security, accessibility and DPIA/privacy/legal packages to named
  independent reviewers and record decisions against Android candidate SHA-256
  `D1995267DB79078367983119CB2DC3B461740A522972CB35671BFBA40BCF03CB`.
- Where: owner-selected independent security, accessibility and legal/privacy reviewers.
- Required value: reviewer names/organisations, scope, date, findings and sign-off.
- Expected result: no unaccepted high/critical findings and explicit approval of store/privacy/
  accessibility claims.
- Evidence to save: signed review records and remediation evidence; do not self-approve.
- Blocks: Android public and iOS public.

## 5. Complete remaining physical Android and iOS release evidence

- Exact action: the refreshed signed arm64 candidate is installed and launch, first-use native voice
  disclosure/permission, owner-authenticated App Lock, notification-channel creation, JSON-export
  share, restore-picker cancellation and local `.ics` calendar handoff have passed on the authorized
  Galaxy S9. Speak a test phrase to finish transcript edit/proposal/undo proof. Using a disposable
  Android profile and safe test data, run the remaining hardware-bound secure-key loss,
  clean-install notification privacy and destructive-recovery drills. Emulator onboarding, 200%
  text, reduced motion and real TalkBack smoke are already complete. For iOS, the project is prepared with
  `expo-dev-client`; use the authenticated EAS account after interactive distribution-credential
  setup, or use macOS/Xcode, and test on an iOS device or simulator.
- Where: the currently connected S9 for the remaining Android drills; complete interactive Apple
  credential/provisioning setup in EAS or use macOS/Xcode for iOS.
- Required value: physical-device/build logs, screenshots and exact candidate metadata.
- Expected result: hardware-bound Android and iOS evidence complements the signed-candidate emulator
  record without converting internal accessibility checks into independent sign-off.
- Evidence to save: install/launch logs, screenshots, accessibility observations and recovery proof.
- Blocks: Android beta/public; iOS beta/public.

## 6. Configure production crash-symbol upload

- Exact action: provide the Sentry organisation, project and auth token used by the production
  release pipeline, then rebuild and verify the source-map upload task.
- Where: Sentry project settings and the protected CI/EAS release environment.
- Required value: owner-issued `SENTRY_ORG`, `SENTRY_PROJECT` and narrowly scoped auth token; never
  commit or paste the token into repository files.
- Expected result: production source maps upload against the exact release and the artifact/hash is
  regenerated and re-matched if the binary changes.
- Evidence to save: redacted upload task output and Sentry release/artifact association.
- Blocks: production observability sign-off.

## 7. Resolve Apple export compliance

- Exact action: determine the correct App Store export-compliance answer for standard AES-GCM
  encryption implemented outside the operating system, and record the owner/legal decision.
- Where: App Store Connect export-compliance questionnaire and the privacy/legal release record.
- Required value: a documented determination for `ITSAppUsesNonExemptEncryption`; do not assert
  exemption from engineering inference.
- Expected result: the iOS submission package carries the owner-approved answer and any required
  supporting documentation.
- Evidence to save: owner/legal decision or counsel note attached to the iOS submission package.
- Blocks: iOS public.
