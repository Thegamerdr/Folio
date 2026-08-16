# Play Console Handoff

Use this order after Google finishes account verification.

1. Create the app as `Melo`, default language English (United Kingdom), app, free, Finance, 18+,
   package `com.melomoney.app`.
2. Enrol in Play App Signing.
3. Upload `melo-1.0.0-1-release.aab` to Internal testing.
4. Copy Play's app-signing SHA-256 certificate fingerprint. Add that fingerprint alongside the
   upload certificate in `https://melo-money.com/.well-known/assetlinks.json`.
5. Upload the four files in `play-store-assets/` to the main store listing.
6. Paste the listing copy and public URLs from
   `docs/release-store/google-play-listing.md`.
7. Create and activate these auto-renewing subscription products:

   | Product ID          | Billing period | UK price |
   | ------------------- | -------------- | -------- |
   | `melo_plus_monthly` | Monthly        | £4.99    |
   | `melo_plus_yearly`  | Yearly         | £39.99   |
   | `melo_pro_monthly`  | Monthly        | £8.99    |
   | `melo_pro_yearly`   | Yearly         | £69.99   |

8. Create/link a Google Play Developer API service account with subscription-verification access.
   Add its email and private key to the billing Worker as
   `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.
9. Complete Data safety, Financial features, account deletion, content rating, target audience and
   reviewer declarations using `docs/release-store/`.
10. Add a licence tester and prove purchase, pending purchase, restore, Plus-to-Pro replacement,
    expiry and offline grace on the Internal-test release.
11. Record the Play-processed artifact hash/permissions, set the submitted-binary hash in
    `tooling/config/store-declarations.json`, and only then mark the declaration rows
    `binaryMatched`.

Do not enable public release while the release registry still reports external security,
privacy/legal, accessibility or operational sign-off blockers.
