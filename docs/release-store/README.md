# Store Declaration Readiness

This directory carries the local declaration pack for `RB-T183`. It is not proof of App Store or
Google Play approval. It defines the evidence that must be checked against a submitted binary,
store-console forms, SDK inventory and data flows before public release.

Current commands:

- `pnpm store:status`: validate the store declaration pack and print the blocked state.
- `pnpm check:store-declarations`: same validation, included in normal lint/CI.
- `pnpm store:guard`: fail until submitted-binary review and store-console declarations are
  complete.

Current state:

- Apple App Privacy, account deletion, Google Data Safety, Google account deletion, financial
  features, SDK/permission inventory and reviewer-note checklists exist.
- Store-console submission, submitted-binary comparison, privacy policy URL, processor-list
  approval and SDK inventory approval remain blocked.

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
