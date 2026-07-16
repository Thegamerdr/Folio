# SDK Permission And Financial Declarations

## Status

Blocked. This file is the inventory shape, not a completed store-console declaration.

## SDK And Permission Inventory

Before public release, the submitted binary must be reviewed for:

- analytics, crash, attribution, advertising or tracking SDKs;
- AI, Open Banking, cloud, storage, billing and auth SDKs;
- native permissions and required-reason API use;
- lock-screen notification behavior;
- calendar access shape;
- document, file, camera, microphone and speech routes;
- store billing and account-provider routes.

## Financial Features

Folio has financial organization, forecasting, import, Open Banking and business/tax preparation
surfaces. Before Play release, the Financial features declaration must match the enabled binary and
regional scope. Folio must not claim product recommendations, investment advice, direct HMRC filing
or regulated financial execution unless a separately approved programme exists.

## Current Folio Position

- Android billing and Open Banking adapters now exist, but their real external providers remain
  blocked on Play/provider configuration, declarations and end-to-end proof.
- Direct HMRC MTD is a blocked roadmap programme.
- Public financial-feature declarations cannot be completed from synthetic shell evidence alone.

## Official Reference

- `https://support.google.com/googleplay/android-developer/answer/17105854`
