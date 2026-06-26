# Store Release and Monetisation Architecture

## Store positioning

Folio is a financial record, forecasting and planning application. It must accurately declare financial features, sensitive data handling and any Open Banking/tax integration in each target store.

Initial public scope:

- adults;
- UK-first policy pack;
- personal workspace and debt-focused clarity;
- local-only use without login;
- optional account/cloud features;
- business architecture present, business UI phased.

## App account rules

- Do not require sign-in for local core.
- If account creation is enabled, offer in-app account deletion.
- Provide the external deletion path required by Google Play.
- If third-party login is offered on iOS, meet Sign in with Apple equivalence requirements.
- Account deletion and cloud-data deletion are not hidden behind support.

## Privacy declarations

Maintain one data inventory that generates/checks:

- privacy policy;
- Apple App Privacy answers;
- privacy manifests/required-reason APIs;
- Google Data Safety form;
- Google Financial Features declaration;
- processor list;
- in-app privacy centre.

Any SDK change triggers a declaration review.

## Financial/store compliance

- Register the appropriate organisation developer account where store policy requires it for financial services/features.
- Provide review notes explaining that Folio does not execute investments, lend, broker or provide personal financial recommendations.
- Provide a review account/demo mode without exposing real financial data.
- Keep Open Banking provider authorisation evidence and consent UX available to reviewers.
- Complete age/content rating accurately.

## Monetisation is an adapter

The business model is intentionally undecided. Do not bind core data or calculations to a price tier.

Implement entitlement capabilities such as:

```text
local_core
cloud_backup
multi_device_sync
cloud_ai_units
advanced_imports
business_workspace
business_exports
open_banking_connection_count
```

Map products/prices to capabilities later.

## Likely sustainable shape (not a locked price)

- **Free/local:** personal local core, manual/import path, basic Melo/templates, calendar/plans, export.
- **Cloud/Pro:** encrypted backup/sync, larger cloud AI quota, richer automation.
- **Business:** separated business workspace, invoices/receipts/tax preparation/exports.

Do not paywall access to a user's existing records or a basic full export. Core financial truth should continue during subscription lapse.

## Store billing

Digital subscriptions/features use StoreKit 2 and Google Play Billing where required. The backend verifies purchases and issues signed entitlements; the app caches an offline entitlement with a reasonable grace period.

Rules:

- no permanent lockout during temporary store outage;
- restore purchases;
- clear renewal/pricing terms;
- downgrade does not delete data;
- business records remain exportable after expiry;
- AI quota displayed before use;
- no surprise document charges.

## Release tracks

1. internal security/engine build;
2. staff/dev dogfood with synthetic data;
3. private alpha with local-only mode;
4. TestFlight/closed Play beta;
5. limited UK release;
6. staged rollout;
7. business module beta;
8. Open Banking controlled rollout.

## Review demo mode

Include an entirely synthetic, labelled demo vault that shows:

- Today briefing;
- timeline/calendar;
- debt plan;
- unexpected event recovery;
- business workspace preview if submitted;
- privacy/cloud controls.

Demo data never mixes with the user's vault.

## Acceptance gates

- Store declarations match actual data flows.
- Local core launches without account.
- Account deletion is tested end-to-end.
- Subscription outage does not remove local access.
- Reviewers can exercise functionality safely.
- Legal review covers advice boundary, privacy, Open Banking and business/tax claims.
