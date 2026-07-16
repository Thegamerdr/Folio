# Account Deletion Store Checklist

## Status

Partially implemented and still blocked for store release. In-app initiation and server purge
routes now exist and are unit-tested; public web deletion, production-provider configuration,
provider-side bank consent revocation, retention/legal review and signed E2E evidence remain open.

## Required Before Release

- If account creation is enabled, users can initiate account deletion in the app.
- Google Play web deletion route is public, reachable and included in the Data safety form.
- Cloud deletion and local-vault retention choices are explained separately.
- Export-before-delete path is available.
- Provider tokens, AI diagnostic retained content, cloud ciphertext and metadata have tested purge
  behavior.
- Legal retention exceptions are written in plain language and reviewed.

## Current Folio Position

- The local app works without an account, and deleting an account does not silently delete local
  money/history.
- Signed-in Android users have a three-confirmation `Delete account & cloud data` action.
- The app purges both cloud-backup generations and all indexed Open Banking records/provider
  secrets before asking Clerk to delete the identity. If either purge is unconfirmed, the identity
  is retained for retry.
- Bank-side provider consent is not revoked by the current adapter; the UI tells users to revoke it
  at their bank as well. Pending callback metadata expires within 20 minutes and contains no
  provider secret.
- Local clearing is a separate three-confirmation control and spans the encrypted state, SQLCipher
  ledger, reminders, widgets and app-owned exports.
- Public web deletion, production Clerk/Worker configuration, signed lifecycle E2E, purge-schedule
  review and legal/store review remain blocked.
- Store forms must not claim full deletion readiness until those remaining proofs exist.

## Official References

- `https://developer.apple.com/support/offering-account-deletion-in-your-app/`
- `https://support.google.com/googleplay/android-developer/answer/13327111`
