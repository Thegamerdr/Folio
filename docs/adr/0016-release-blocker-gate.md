# ADR 0016: Release Blocker Gate

## Status

Accepted.

## Context

The implementation backlog ends at Phase 14, but public release still depends on external
evidence: iOS signing, native security proof, store declarations, native billing, account deletion,
legal/privacy/security/accessibility signoff, provider procurement, operations drills and launch
monitoring. These items must stay visible without inventing a Phase 15 or treating synthetic
screens as release proof.

Apple App Store Connect requires app privacy information and a privacy policy URL to be managed in
App Privacy. Apple also requires apps that support account creation to let users initiate account
deletion in the app. Google Play requires Data safety information, a privacy policy and, for apps
with account creation, both in-app and web deletion paths.

## Decision

Add a pure `@folio/release-gate` package and a machine-readable
`tooling/config/release-blockers.json` register. The package models blocker kinds, impact, status,
evidence types and public-release readiness. The root script
`tooling/scripts/check-release-blockers.mjs` validates the register and exposes two commands:

- `pnpm release:status`: print the current release-blocked state and exit successfully if the
  register is valid.
- `pnpm release:guard`: fail until the public-release flag is enabled and every release-blocking
  item is closed.
- `pnpm check:release-blockers`: validate the register during normal lint/CI without requiring
  public release readiness.

The non-failing register validation is part of `pnpm run ci`, because the register must stay
well-formed. The strict release guard is not part of normal CI, because the repository is expected
to remain implementation-complete and release-blocked while external evidence is absent. Release
packaging or public launch workflows must use `pnpm release:guard`.

## Consequences

- The current state is explicitly blocked, not ambiguous.
- Local checks can distinguish machine-checkable gaps from external credentials, devices, services
  and signoffs.
- Roadmap programmes such as household collaboration, direct HMRC MTD and additional jurisdictions
  remain blocked separately from public release.
- The package has no native, network, billing or store side effects.

## Official Store References

- Apple App Privacy in App Store Connect:
  `https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/`
- Apple account deletion guidance:
  `https://developer.apple.com/support/offering-account-deletion-in-your-app/`
- Google Play Data safety form:
  `https://support.google.com/googleplay/android-developer/answer/10787469`
- Google Play account deletion requirements:
  `https://support.google.com/googleplay/android-developer/answer/13327111`
