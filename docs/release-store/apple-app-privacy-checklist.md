# Apple App Privacy Checklist

## Status

Blocked. This file is a declaration checklist, not App Store Connect evidence.

## Required Before Release

- App Privacy answers are reviewed in App Store Connect for the submitted binary.
- Privacy policy URL is current and reachable.
- User privacy choices URL is provided if applicable.
- Third-party SDK data collection and tracking are reflected in the answers.
- Optional cloud, AI, Open Banking, business workspace and support diagnostic routes are declared
  according to their real enabled state.
- Apple privacy manifests and required-reason API use are reviewed against the generated native
  project and release binary.
- App Review notes explain local-first/no-account mode and synthetic reviewer data.

## Current Melo Position

- The local personal core is reviewable without account creation.
- The data-flow and processor inventories are prepared from the Android candidate; they must be
  repeated against the generated iOS archive and Apple privacy manifests.
- Optional identity/cloud, Open Banking and provider-backed routes remain conditional.
- The iOS app record, signed archive and App Store Connect declaration do not exist yet.

## Official References

- `https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/`
- `https://developer.apple.com/app-store/user-privacy-and-data-use/`
