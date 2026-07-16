# Android local privacy path - 15 July 2026

## Verdict

The current Android build keeps both companion reasoning and statement extraction on the phone.
The physical-device run used a synthetic PDF and showed Android selecting the bundled local ML Kit
Latin model. No raw document or user transaction data was sent to the Melo AI gateway or a model
provider, and nothing from the synthetic statement was committed to the user's ledger.

This is implementation and real-device evidence. It is not a substitute for an independent security
assessment or packet-capture review.

## Device and install

- Device: Samsung Galaxy S9 (SM-G960F), Android device serial `2af26a2c19017ece`.
- Package: `com.folio.v2.greenfield`, version `0.0.1`, version code `1`.
- Original first-install time remained `2026-06-26 15:22:33`.
- Final update time: `2026-07-15 12:25:11`.
- Existing application data was preserved; the app was not uninstalled or reset.
- The repository's upload-signed release APK cannot replace the older private install because the
  certificates differ. For this physical phone only, the final release build was signed with the
  historical debug certificate already installed on the device.
- Phone-only APK:
  `artifacts/android-physical-private/melo-privacy-local-ocr-direction-2026-07-15-debug-signed.apk`
- SHA-256:
  `EBEF1BF79958BB643FBBF50AAECFD5C3ACE4F4C34DA3A7BB654FCE1836CE61B4`
- APK Signature Scheme v2 and v3 verification passed.

The phone-only APK is not a Play-distribution artifact. Release signing migration and a version-code
bump remain separate release tasks.

## Companion proof

The Melo tab remained a primary navigation destination. Opening the companion showed
`On this phone - Calm`. Asking `can i spend 5 pounds` returned an immediate response derived from
the local money snapshot. The response did not create or change a transaction.

Evidence:

- `android-melo-local-tab-2026-07-15.png`
- `android-melo-local-chat-2026-07-15.png`
- `android-melo-local-answer-2026-07-15.png`

The application process log contained no matches for the Melo AI gateway, OpenRouter, Gemini,
OpenAI, or Anthropic during this interaction.

## PDF extraction proof

A one-page synthetic bank statement was generated solely for this test. It contained no real
person, bank, account, merchant or transaction data. Its rendered page was visually checked before
use, then both generated fixture files were removed from the workspace after the evidence capture.

- Temporary fixture (removed): `output/pdf/melo-synthetic-statement-privacy-test.pdf`
- Temporary validation render (removed):
  `tmp/pdfs/melo-synthetic-statement-render/page-1.png`
- Intake surface: `android-melo-local-intake-2026-07-15.png`

During the read, Android logged:

- `Selected local version of com.google.mlkit.dynamite.text.latin`
- local TFLite model files loaded from `mlkit-google-ocr-models/...`

No log line matched the Melo AI gateway or the listed model providers. The app staged six items on
the review screen and showed `Nothing counts until you choose`; no transaction was written.

The first run also exposed a correctness issue: unsigned values under a `Money out` column were
flattened into plain text and interpreted as income. The Android reader was changed to retain the
debit/credit meaning from the recognised word coordinates before the text crosses the JavaScript
bridge. The same PDF was then rerun on the same phone:

- synthetic salary: `+GBP 2,000`
- synthetic rent: `-GBP 850`
- synthetic grocery: `-GBP 67.50`
- synthetic energy: `-GBP 120`
- synthetic transport: `-GBP 80`
- synthetic savings transfer: `-GBP 500`

Corrected result evidence:

- `android-melo-local-pdf-direction-fixed-2026-07-15.png`

The wording above uses `GBP` only to keep this Markdown ASCII-safe; the app correctly displayed the
pound symbol.

## Cleanup and retained-data check

- No review action or add-all action was pressed.
- Reader candidates are transient and excluded from the persisted store blob.
- The app was force-stopped and cold-started, which reset the transient reader staging state.
- `/sdcard/Download/melo-synthetic-statement-privacy-test.pdf` was deleted and its absence verified.
- The generated repository fixture and validation render were also deleted after capture.
- The display override was restored to `1080x2220`.
- The app was left cold-started on the real Today surface.
- Cleanup evidence: `android-melo-post-fixture-cleanup-2026-07-15.png`.

## What this proves and does not prove

Proved here:

1. The current physical Android build runs after an in-place update with existing data preserved.
2. Melo companion answers are produced locally from an aggregate snapshot.
3. PDF pages are rendered and recognised on-device with the bundled local ML Kit model.
4. Extracted rows remain review-only until a user action.
5. Debit/credit direction survives the tested split-column statement layout.
6. The synthetic file and transient candidates were removed after the test.

Not yet proved here:

1. An independent packet capture showing every network flow under every app route.
2. Coverage of every UK bank statement layout, scan quality, language, or rotated page.
3. Independent mobile application security testing.
4. iOS behavior; this evidence is Android-specific.
5. Production store signing, billing, or release approval.
