# Account Deletion Store Checklist

## Status

Blocked. This file is a store declaration checklist, not live deletion evidence.

## Required Before Release

- If account creation is enabled, users can initiate account deletion in the app.
- Google Play web deletion route is public, reachable and included in the Data safety form.
- Cloud deletion and local-vault retention choices are explained separately.
- Export-before-delete path is available.
- Provider tokens, AI diagnostic retained content, cloud ciphertext and metadata have tested purge
  behavior.
- Legal retention exceptions are written in plain language and reviewed.

## Current Folio Position

- Local app can work without account.
- Account provider, web deletion route and cloud deletion E2E remain blocked.
- Store forms must not claim deletion readiness until provider and deletion evidence exists.

## Official References

- `https://developer.apple.com/support/offering-account-deletion-in-your-app/`
- `https://support.google.com/googleplay/android-developer/answer/13327111`
