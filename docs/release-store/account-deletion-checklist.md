# Melo account deletion — engineering/store draft (2026-08-24)

Status: **partially implemented; BLOCKED EXTERNAL for public URL, production provider configuration,
and signed E2E proof.**

## Current lifecycle

1. Signed-in user starts the three-confirmation `Delete account & cloud data` action.
2. Melo purges Cloud Vault backup generations. Open Banking is disabled in the current candidate,
   so it has no provider connection or provider data to purge; the adapter-index purge route remains
   for a future approved build.
3. Identity deletion is requested from Clerk only after both remote purge calls confirm. If either
   purge fails, identity remains for retry and the user receives a failure message.
4. Local money/history is deliberately separate. The Start fresh/local wipe path removes the local
   encrypted database family, recovery generations, retained sources and app-owned exports.
5. Open Banking provider consent is not active in the current candidate. A future enabled adapter
   cannot claim bank-side consent revocation; the UI must tell the user to revoke at the bank.
   Pending callback metadata expires within 20 minutes when that future route is enabled.

## Required before store submission

- Owner publishes and confirms a public web deletion route with a real owned URL.
- Production Clerk/Cloud Vault/Open Banking environments are configured and exercised with a
  disposable test account; no owner production account is used.
- Provider-side consent revocation and retention/legal exceptions are reviewed.
- Exact candidate binary is tested and the deletion result is attached to the store package.

Official references:

- <https://developer.apple.com/support/offering-account-deletion-in-your-app/>
- <https://support.google.com/googleplay/android-developer/answer/13327111>
