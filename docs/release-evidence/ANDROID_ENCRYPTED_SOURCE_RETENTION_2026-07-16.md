# Android encrypted source retention - 16 July 2026

## Verdict

The current Android implementation now retains every selected PDF, delimited file, text file,
image or camera original in an app-private encrypted document vault before extraction begins. Raw
source bytes are not written into Melo state and are not sent to the AI gateway. Review candidates,
confirmed transactions and import history carry only a workspace-owned evidence identity.

This closes the Android implementation gap for encrypted source-document staging and the document
library. It does not close iOS proof, independent mobile security review, production release
approval or portable backup of the encrypted originals.

## Security and lifecycle properties

- AES-256-GCM binary envelope with a random nonce per document.
- Per-workspace document key derived behind the device-protected key hierarchy.
- Associated data binds workspace identity and evidence identity, so swapped or cross-workspace
  ciphertext fails authentication.
- Opaque app-private filenames contain no user filename, bank name or account detail.
- The persisted state contains metadata and evidence links only, never a source URI or raw bytes.
- Opening an original decrypts to a short-lived cache file and invokes Android's `ACTION_VIEW`
  surface with a read-only content grant. Melo does not invoke the Android share sheet.
- The viewer cache remains available while the external viewer reads it, then is deleted when Melo
  returns to the foreground. A ten-minute timeout and boot cleanup remove interrupted leftovers.
- Removing evidence deletes the encrypted file and atomically clears every metadata link while
  preserving confirmed money records.
- Local-data deletion enumerates encrypted evidence before resetting metadata and has a directory
  enumeration fallback.
- A same-device restore can retain originals. A cross-device state restore prunes unavailable
  metadata and links instead of exposing dead controls. The originals are not part of the portable
  export or cloud-backup payload.

## Runtime proof

The release build was exercised on `emulator-5554` with a temporary onboarding screenshot that
contained no financial data. On-device OCR intentionally found no reliable transaction rows. The
fallback then showed the real retained filename, and both View controls opened the decrypted image
in Android's installed image viewer.

Evidence:

- `melo-android-encrypted-source-fallback-fixed-2026-07-16.png` - real retained filename and active
  View controls on the coded fallback screen.
- `melo-android-encrypted-source-viewer-only-rendered-2026-07-16.png` - the decrypted image rendered
  in Android's installed viewer through `ACTION_VIEW`, rather than Melo opening a share chooser.
- `melo-android-encrypted-source-library-2026-07-16.png` - responsive Account library with two
  encrypted originals and Open/Remove actions.
- `melo-android-phone-current-build-ready-2026-07-16.png` - current build running after an in-place
  preserved-data update on the physical Galaxy S9.

The device walkthrough exposed two inherited no-op View controls on the image and PDF fallback
screens. They were wired to the authenticated vault viewer, the prototype sample filenames were
removed, and the exact evidence identity now passes from intake to the fallback surface.

## Cleanup

- All temporary encrypted originals used during the walkthrough were removed through the Account
  UI, including the final viewer-lifecycle proof import.
- The library returned to zero encrypted sources.
- No review candidate or transaction was created.
- Temporary `/sdcard/melo-*` test artifacts were deleted and absence was verified.
- The physical phone was never uninstalled or reset.

## Verification

- Full repository CI: 202 test files and 2,460 tests passed after the final canonical-parity,
  typed-command
  and release-packaging reconciliation.
- Final focused verification: mobile TypeScript passed; reader handoff, document vault and source
  voice suites passed (24 tests), including the Android viewer lifecycle cleanup.
- Formatting, package boundaries, every TypeScript target, Worker types, contracts and source
  package validation passed in the same final gate.

Final distribution APK:

- Path: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Package: `com.folio.v2.greenfield` `0.0.1` (`1`)
- Android: minimum 24, target 36
- ABIs: `arm64-v8a`, `x86_64`
- Size: `108,954,283` bytes
- SHA-256: `4244DBDDAD9CBE8A5BA70603869F7AFC411C91D77459845AB1159DF3F22E7A67`
- Signer certificate SHA-256:
  `547396E1FD99681C2A6D768B8B7D1B4484B5F42A17597CAD6C495221267A5488`
- APK Signature Scheme v2 verification passed.

The S9's historical install uses the repository debug certificate, so the same release code was
also built with that matching certificate and installed with `adb install -r`. This preserved the
existing app package and data. That phone-only signing variant is not the distribution artifact.

## Remaining limits

1. Encrypted originals are device-only; portable backup/restore of the files is not implemented.
2. iOS encrypted-source and native-viewer behavior still needs an iOS build and device proof.
3. Independent MASVS review, penetration testing and packet-capture verification remain external
   release gates.
4. Full bank-format, scan-quality, rotation, language and endurance corpora remain broader import
   validation work.
5. Play signing, version-code progression, store listing, billing proof and release approval remain
   separate public-release gates.
