# Android Melo subscription review evidence - 15 July 2026

## Verdict

Melo now understands a narrow explicit pause or resume request for an existing local subscription,
shows the exact monthly recurring-total effect, and opens the real Subscriptions surface for the
reversible change. Chat does not pause or resume anything itself.

This deliberately preserves the later owner decision recorded in `AUDIT.md`, `PORT_BIBLE.md` and
the RN build plan: Melo's direct write bridge remains the four ledger tools (`log_spend`,
`log_income`, `log_refund`, `log_transfer`). The older Lovable prototype's
`pause_subscription` tool was not restored.

## Truth and safety boundary

- Only an imperative pause/resume request enters this path. Advice and hypothetical questions such
  as `Should I pause Spotify?` and `What if I pause Spotify?` remain ordinary review questions.
- Exact name matching wins. A missing target or multiple partial matches produces explicit choice
  chips instead of a guess.
- An unknown name produces `Nothing has changed` and a route to the local subscription list.
- Negative or non-finite stored costs are not used for a financial preview; Melo asks the user to
  review the stored amount.
- The preview uses integer pence and the current unpaused subscription rows. It does not claim a
  balance, Safe Zone or route effect that was not calculated.
- The chat turn creates no `pause_subscription` suggestion and cannot call `togglePaused`.
- The dedicated Subscriptions screen applies the current live state. Pause and resume both expose
  the canonical 30-second Tier-1 Undo affordance.
- Seed records are removed from a real-user view before matching. The physical phone path contained
  no subscriptions and Melo did not fabricate Spotify or add a sample row.

## Physical Galaxy S9

The arm64 release was debug-key-resigned only so it could update the historical debug-signed
install without uninstalling it.

- Device: Samsung Galaxy S9 (`SM-G960F`), serial `2af26a2c19017ece`.
- Install command: `adb install -r`.
- First-install time remained `2026-06-26 15:22:33`.
- Update time became `2026-07-15 17:09:48`.
- Existing local app data was preserved.

Prompt: `Pause Spotify`

Observed result:

- Melo reported that it could not find Spotify in the user's subscriptions;
- it said `Nothing has changed`;
- the action opened the real empty Subscriptions surface;
- no sample subscription, transaction, review item or other financial record was created;
- the phone was returned to Today with the same zero money picture after the test.

Evidence:

- `android-melo-subscription-preview-no-record-2026-07-15.png`;
- `android-melo-subscription-preview-empty-surface-2026-07-15.png`;
- `android-melo-subscription-preview-final-today-2026-07-15.png`.

## Disposable x86_64 emulator

The normal release configuration is intentionally `arm64-v8a`, so the arm64 APK could install on
the x86_64 emulator but could not load `libreactnative.so`. This was an ABI mismatch, not a stored
data or JavaScript crash. A production-bundled x86_64 release was built with
`-PreactNativeArchitectures=x86_64`; the archive was checked for
`lib/x86_64/libreactnative.so`, installed successfully and produced no AndroidRuntime or
ReactNative error log.

The emulator started from the real empty first-run path. It skipped onboarding without adding a
money picture, then added one explicit disposable test row: Spotify at GBP 10.99 monthly.

Prompt: `Pause Spotify`

Observed result:

- Melo showed Spotify as active at GBP 10.99 per month;
- it showed active recurring total GBP 10.99 -> GBP 0.00;
- it said `Nothing has changed yet`;
- `Review Spotify pause` opened the populated Subscriptions surface while Spotify remained active;
- tapping `Pause for a month` changed the live recurring total to GBP 0.00 and showed Undo;
- tapping `Resume` changed it back to GBP 10.99 and showed
  `recurring total GBP 0.00 -> GBP 10.99` with Undo;
- the Undo closure restored the paused state.

The emulator package sandbox was cleared after evidence capture. The disposable Spotify row was not
left behind.

Evidence:

- `android-melo-subscription-exact-preview-emulator-2026-07-15.png`;
- `android-melo-subscription-review-surface-emulator-2026-07-15.png`;
- `android-melo-subscription-paused-undo-emulator-2026-07-15.png`;
- `android-melo-subscription-resume-undo-emulator-2026-07-15.png`;
- `android-melo-subscription-resume-undone-emulator-2026-07-15.png`.

## Validation

- Focused companion/store suite: 5 files and 282 tests passed before final hardening.
- Final repository gate: 185 test files and 2,290 tests passed.
- Formatting, dependency boundaries, V1 boundary, sample-data policy, constitution, canonical
  product gates, package/service typechecks and documentation validation passed.
- Android arm64 `:app:assembleRelease` passed with `NODE_ENV=production`.
- Android x86_64 `:app:assembleRelease -PreactNativeArchitectures=x86_64` passed with
  `NODE_ENV=production`.
- The known optional Sentry upload-configuration warning remained. A clean native rebuild also
  reported third-party deprecations and Gradle metaspace pressure, but completed successfully.

## Artifacts

Production-signed arm64 release:

- `artifacts/android-physical-private/melo-companion-subscription-preview-2026-07-15-production-signed.apk`;
- size: `66,625,375` bytes;
- SHA-256: `9517E750AFA369E9316172B9DC680A9C52BD886EC797D53577D4EF2A1A35A232`;
- certificate SHA-256:
  `547396E1FD99681C2A6D768B8B7D1B4484B5F42A17597CAD6C495221267A5488`;
- APK Signature Scheme v2 verification passed.

Physical-test arm64 release, signed with the existing install's historical debug key:

- `artifacts/android-physical-private/melo-companion-subscription-preview-2026-07-15-physical-debug-signed.apk`;
- size: `66,717,886` bytes;
- SHA-256: `E1781EBA7A4106098733CAD5A8FB6B9FA8E5435B17A35EC82F06ED576C8149EB`;
- certificate SHA-256:
  `FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C`;
- APK Signature Schemes v2 and v3 verification passed.

Production-signed x86_64 emulator release:

- `artifacts/android-physical-private/melo-companion-subscription-preview-2026-07-15-emulator-x86_64-production-signed.apk`;
- size: `68,102,621` bytes;
- SHA-256: `3D1C89A9B9617625220F2399567DE26AD42EDA7A44C3D4928C5FA3D93BAA77CF`;
- certificate SHA-256:
  `547396E1FD99681C2A6D768B8B7D1B4484B5F42A17597CAD6C495221267A5488`;
- APK Signature Scheme v2 verification passed.

## Remaining boundary

This closes the locally solvable subscription pause/resume preview gap. It does not close iOS,
independent accessibility/security review, packet capture, store/legal/operations, live Open
Banking or Business workspace release gates. Existing-record date and amount change previews also
remain future work until each target has a real before/after engine and undo contract.
