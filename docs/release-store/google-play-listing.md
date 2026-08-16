# Google Play Listing — Melo 1.0.0

Last prepared: 20 July 2026

## App identity

- App name: `Melo`
- Package: `com.melomoney.app`
- Version name / code: `1.0.0` / `1`
- Default language: English (United Kingdom)
- Category: Finance
- Distribution: United Kingdom
- Intended audience: 18+

## Listing copy

### Short description

See whether your money lasts to payday — calmly, privately and clearly.

### Full description

Melo answers one question first: will my money last to payday?

See your Money Path, the tight point before payday and what is safe today. Add statements,
photos, pasted rows or manual entries, then review every candidate before it becomes part of your
money history.

Use pots, subscriptions, calendar, What If, Recovery, payday rituals and cycle insights without
giving up control of your records. Melo can suggest one quiet next step, but no move happens
silently.

Choose the lens that fits your life. Free keeps the core money-path question and safety features.
Melo Plus adds everyday clarity. Melo Pro adds the advanced lenses for irregular income, debt and
shared money. Pro includes everything in Plus.

Melo is local-first. The personal core works without an account. Financial state is stored in
encrypted local storage, statement reading runs on the device, and imported rows remain
candidates until you confirm them. Export and Start fresh stay under your control.

Melo organises and explains user-provided information. It does not hold money, initiate payments,
recommend regulated products or file taxes. Check important figures against original records or
an appropriately qualified professional.

## Public URLs

- Website: `https://melo-money.com`
- Privacy policy: `https://melo-money.com/privacy`
- Terms: `https://melo-money.com/terms`
- Account deletion: `https://melo-money.com/delete-account`
- Support: `https://melo-money.com/support`
- Support email: `support@melo-money.com`
- Security: `https://melo-money.com/security`

## Google Play subscriptions

Create all four as auto-renewing subscription products. Prices shown here match the live Lovable
surface; the store remains the final price display and confirmation.

| Product ID          | Plan      | Billing period | UK price |
| ------------------- | --------- | -------------- | -------- |
| `melo_plus_monthly` | Melo Plus | Monthly        | £4.99    |
| `melo_plus_yearly`  | Melo Plus | Yearly         | £39.99   |
| `melo_pro_monthly`  | Melo Pro  | Monthly        | £8.99    |
| `melo_pro_yearly`   | Melo Pro  | Yearly         | £69.99   |

Use one active base plan per product and no store trial. Melo's one-cycle lens trial is local,
requires no card and never auto-charges.

## Prepared Play graphics

Upload-ready files are in
`artifacts/melo-1.0.0-android-release-2026-07-20/play-store-assets/`:

- 512 × 512 32-bit app icon: `play-icon-512.png`
- 1024 × 500 24-bit feature graphic: `play-feature-graphic-1024x500.png`
- 1080 × 1920 phone screenshot: `play-phone-01-start-1080x1920.png`
- 1080 × 1920 phone screenshot: `play-phone-02-onboarding-1080x1920.png`

The graphics are deterministic derivatives of canonical Melo assets and physical release-device
captures; no mascot or brand art was regenerated.

## Release-console items still requiring the owner

- Upload-ready AAB:
  `artifacts/melo-1.0.0-android-release-2026-07-20/melo-1.0.0-1-release.aab`
  (`3B4B36402D0555B6E210082FCC9D9FCE79D39C059740A0B8B882DA5BE473E5A4`).
- Create/verify the Play app for `com.melomoney.app`.
- Enrol the app in Play App Signing and add the Play app-signing certificate fingerprint to
  `/.well-known/assetlinks.json`.
- Create and activate the four subscription products above.
- Link a Google Play Developer API service account, then add its email and private key as
  `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` Worker secrets.
- Upload the final AAB to Internal testing before completing Data safety, Financial features,
  content rating, target audience and reviewer declarations.
- Upload the prepared icon, feature graphic and phone screenshots, then review their Play Console
  previews.
