# Melo Store Declaration Readiness

This directory carries the current Melo declaration pack for `RB-T183`. It is not proof of App Store
or Google Play approval. `CURRENT_STORE_SUBMISSION_PACKAGE_2026-08-24.md` is the authority for the
current product/data-flow draft; the individual checklists are reviewer-facing extracts.

Current commands:

- `pnpm store:status`: validate the store declaration pack and print the blocked state.
- `pnpm check:store-declarations`: same validation, included in normal lint/CI.
- `pnpm store:guard`: fail until submitted-binary review and store-console declarations are
  complete.

Current state (2026-08-24):

- Apple App Privacy, account deletion, Google Data Safety, Google account deletion, financial
  features, SDK/permission inventory and reviewer-note checklists exist.
- Processor and SDK inventories are engineering-current.
- Store-console submission, submitted-binary comparison, privacy-policy URL, support route,
  candidate SHA-256, billing listing and public deletion URL remain external/owner actions.
- The package identity is settled: Melo with `com.folio.v2.greenfield`; stale Folio/Plus/Pro naming
  decisions must not be reopened. `folio.plus.*` and `folio.pro.*` are restore-only legacy IDs.

Official references checked on 2026-06-21:

- Apple App Privacy in App Store Connect:
  `https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/`
- Apple user privacy and third-party code declarations:
  `https://developer.apple.com/app-store/user-privacy-and-data-use/`
- Apple account deletion guidance:
  `https://developer.apple.com/support/offering-account-deletion-in-your-app/`
- Google Play Data safety form:
  `https://support.google.com/googleplay/android-developer/answer/10787469`
- Google Play account deletion requirements:
  `https://support.google.com/googleplay/android-developer/answer/13327111`
- Google Play financial features policy:
  `https://support.google.com/googleplay/android-developer/answer/17105854`
