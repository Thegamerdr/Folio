# Android Melo transaction-correction evidence — 2026-07-15

## Verdict

Melo now handles an explicit request to correct an existing transaction without guessing which
local row the user meant. The companion opens Timeline, the user selects the exact record, and the
existing editor shows only the changed fields as a before/after review before it enables the final
write. The saved correction remains an immutable edit to the same transaction and exposes Undo.

Chat does not receive transaction rows, merchant names or transaction IDs from the aggregate Melo
snapshot. It cannot directly alter an existing record.

## Truth and safety boundary

- Explicit correction wording is intercepted before ordinary completed-spend/income/refund/transfer
  parsing, so `Change Tesco from £12.50 to £10` cannot become a second ledger suggestion.
- Melo creates no suggestion and performs no write. It returns the existing `open_timeline` action,
  labelled `Choose transaction` and marked as requiring user review.
- The transient companion context stores only the typed `explain_changes` intent and no amount. It
  does not retain the merchant, record ID or raw prompt.
- Subscription, account, debt, goal, payday and income-source changes remain in their dedicated
  domains unless the user explicitly identifies a posted transaction or payment.
- Timeline owns exact-row selection. The selected editor owns merchant, amount, date, category and
  note changes.
- An untouched or missing note remains absent and cannot create a phantom correction. Empty merchant
  or invalid/empty/zero amount input falls back to the current stored value.
- `No changes` is disabled until the shared pure preview engine finds a real field change.
- The review screen renders only changed fields. Nothing is written until `Confirm changes`.
- Preview and commit use the same `previewTxnEdit` comparison, so the displayed before/after rows and
  immutable audit records cannot drift apart.
- The transaction keeps the same ID, imported-source payloads remain untouched, and the existing
  30-second Undo path restores the pre-edit editable fields.

## Automated proof

Focused validation passed 64 tests across:

- local Melo correction routing and context minimisation;
- adversarial/safety precedence;
- the transaction preview/edit engine;
- the store edit seam; and
- Melo action navigation.

The complete repository gate passed:

- 188 test files;
- 2,321 tests;
- all package and service typechecks;
- formatting, dependency and V1 boundaries;
- sample-data policy, constitution and canonical product gates; and
- source-package and fixture validation.

The mobile package typecheck also passed independently.

## Android emulator proof

A production-bundled dual-ABI APK was installed on the x86_64 emulator. One isolated local test
transaction was created through Melo's existing confirmation-only spend path and then selected in
Timeline.

Observed sequence:

1. Timeline showed the original GBP 12.50 row.
2. Tapping that exact row opened its real transaction editor.
3. With no changed field, the primary action read `No changes` and was disabled.
4. Changing the amount to GBP 10 enabled `Review changes`.
5. Review showed only `AMOUNT`, with `-£12.50 → -£10.00`, plus `Back` and `Confirm changes`.
6. Confirmation replaced the same Timeline row with the GBP 10 value and displayed
   `Updated T` / `Undo`.
7. Filtered `AndroidRuntime` and `ReactNativeJS` error logs were empty.

Evidence:

- `android-melo-correction-timeline-emulator-2026-07-15.png`
- `android-melo-correction-editor-emulator-2026-07-15.png`
- `android-melo-correction-review-emulator-2026-07-15.png`
- `android-melo-correction-committed-emulator-2026-07-15.png`

ADB text injection into the React Native multiline chat field was not reliable enough to treat a
prompt screenshot as evidence. The exact correction-parser handoff is therefore proven by the
automated contract tests; the complete exact-row selection, review, commit and visible Undo path is
proven on the emulator.

After capture, `pm clear com.folio.v2.greenfield` returned `Success`. Relaunch showed clean
first-run onboarding and no test transaction or correction history remained.

Cleanup evidence:

- `android-melo-correction-clean-emulator-2026-07-15.png`

## Physical Galaxy S9

- Device: Samsung Galaxy S9 (`SM-G960F`), serial `2af26a2c19017ece`.
- The debug-key-resigned dual-ABI APK updated the historical debug-signed install with
  `adb install -r`.
- `firstInstallTime` remained `2026-06-26 15:22:33`.
- `lastUpdateTime` became `2026-07-15 18:46:50`.
- Existing local app data was preserved.
- The app launched and rendered the owner's existing empty GBP 0 Today state.
- No test transaction, sample money or correction was added to the phone.
- Filtered `AndroidRuntime` and `ReactNativeJS` error logs were empty.

Evidence:

- `android-melo-correction-final-physical-2026-07-15.png`

## APK artifacts

Both artifacts contain React Native libraries for `arm64-v8a` and `x86_64`.

### Production-signed

- File:
  `artifacts/android-physical-private/melo-companion-transaction-correction-2026-07-15-production-signed.apk`
- Size: `108,707,371` bytes.
- SHA-256: `A72D302673AF59CEDCFFD00A09BDFF153F09CB48A63784C352537EC0884C5D8C`.
- Certificate SHA-256:
  `547396e1fd99681c2a6d768b8b7d1b4484b5f42a17597cad6c495221267a5488`.
- APK Signature Scheme v2 verified.

### Physical-device debug-signed

- File:
  `artifacts/android-physical-private/melo-companion-transaction-correction-2026-07-15-physical-debug-signed.apk`
- Size: `108,802,486` bytes.
- SHA-256: `8FC65B4456260C6A8FFC71A9D5C6433C19931A973813ED860C9C7EE8973EACCF`.
- Certificate SHA-256:
  `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- APK Signature Schemes v2 and v3 verified.

## Remaining boundary

This closes the locally testable Personal existing-transaction amount/date correction-preview gap.
It does not prove iOS, independent accessibility or safety review, packet-level privacy inspection,
public-store submission, live Open Banking activation or Business workspace isolation. Those remain
separate registered release gates.
