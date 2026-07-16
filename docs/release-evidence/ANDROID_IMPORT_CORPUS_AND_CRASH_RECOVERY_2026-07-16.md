# Android import corpus and crash recovery - 16 July 2026

## Verdict

The actual shipping intake now handles ordinary unstructured clipboard/TXT bank lines and common
split `Out`/`In` or `Debit`/`Credit` CSV exports, in addition to the existing single-amount CSV,
semicolon, TSV, PDF-text and image-OCR paths. Ambiguous rows with both debit and credit populated
fail closed into an issue rather than inventing a direction.

The active-workspace boot path now also removes encrypted import files left by two process-kill
windows: an incomplete `.tmp`, or a promoted encrypted source whose metadata generation never
committed. It preserves referenced sources, all files belonging to another workspace, and any bytes
it cannot safely enumerate/delete.

## Corpus and endurance proof

`apps/mobile/src/folio/lib/importEndurance.test.ts` covers 18 synthetic-only cases:

- single-amount, semicolon, TSV, duplicate, transfer, income, bill, debt-payment,
  balance-mismatch, subscription, refund and unclear-merchant files;
- a common split debit/credit bank export;
- ordinary pasted lines and pasted statement text;
- text-extracted PDF, screenshot OCR and camera OCR;
- a split row with both directions populated, which fails closed.

The shipping `parseSheet` path parsed 100,000 generated rows into 100,000 deterministic review
candidates with no issues in 778 ms during the recorded focused run, below the 30-second release
budget. This is a parser/endurance proof, not a claim that the free AppState retains 100,000 posted
transactions: current product policy intentionally keeps a bounded 2,000-row live history and
reports older-row eviction.

## Crash-window proof

The persistence recovery suite now has 47 passing cases. New cases prove:

- a referenced encrypted source main survives;
- its interrupted `.tmp` replacement is removed;
- a promoted source with no committed metadata is removed;
- another workspace's source is untouched; and
- directory-enumeration failure retains possible orphan bytes for later retry.

The expanded generation matrix also proves that a newer verified stage wins over an older verified
backup after main corruption, a verified backup wins when both main and stage are corrupt, a corrupt
orphaned stage is parked before backup recovery when main is missing, and an all-corrupt family is
reported unreadable without deleting any remaining generation.

The same suite continues to cover SQLCipher generation recovery, staged/main/backup corruption,
ENOSPC state saves, interrupted Personal partition migration, native-writer quiescing, manifest
recovery, Business partition rollback and full local clear.

`apps/mobile/src/folio/lib/documentVault.test.ts` separately injects `ENOSPC` during encrypted-source
promotion and verifies that neither a partial main nor `.tmp` generation remains. It also injects
`EIO` during deletion and verifies that deletion rejects while the original encrypted file remains,
so callers cannot report success after a failed delete.

## Current release-build proof

The source containing these changes passed the complete repository typecheck, 205 test files and
2,510 tests, plus the repository formatting gate. A new production dual-ABI release was built and
verified:

- APK: `109,035,615` bytes, SHA-256
  `08D73315D240EB9996D1C4D14D73A327D7468A0367B9F8B37A5D2AEE0D16FA72`;
- AAB: `76,959,006` bytes, SHA-256
  `50E1952891C137D2F98899F314A4BB24CB4700510A6A6DB8A9644DEE0E1D5532`;
- release JS bundle: `7,925,292` bytes, SHA-256
  `4C7BFAC2512C5BFD62EB672F8E26E2806ECC421A29020F5FF9C364FE27CBA629`;
- APK and AAB ABIs: `arm64-v8a`, `x86_64`;
- APK v2 signature and AAB JAR signature verified with certificate SHA-256
  `547396E1FD99681C2A6D768B8B7D1B4484B5F42A17597CAD6C495221267A5488`.

The APK installed only on `emulator-5554`. After the release UI drill and an explicit app-data clear,
it cold-launched into the empty product in 8,124 ms with PID 10759 and produced no fatal
Android/React match. The real first-use doorway showed Melo with zero synthetic rows and zero staged
review candidates. Evidence is `melo-final-empty-after-import-proof-2026-07-16.png` and its matching
UI Automator XML. Temporary capture/import files were removed from `/sdcard`.

## Release-built source-label and review-gate proof

The same signed APK selected `android-import-interruption.csv` through Android DocumentsUI. The
shipping parser staged five split debit/credit rows and showed them only in the pre-accept review
surface. The first build of this drill exposed inherited UI drift: the shared success screen labelled
the CSV as `PDF` and invented `1 page`.

The corrected screen now derives its presentation and Review source from the actual candidate source
and retained filename. On the rebuilt release, UI Automator asserted:

- `CSV`, `android-import-interruption.csv`, `5 rows read on this device` and `5 THINGS FOUND` are
  present;
- `PDF` and `1 page` are absent; and
- the five synthetic rows remain preview-only.

`melo-import-staged-review-2026-07-16.png` records the discovered before-state and
`melo-csv-source-correct-2026-07-16.png` records the corrected release. Pure tests cover CSV, TSV,
TXT, paste, image and PDF presentation. The emulator was then cleared and re-launched empty, so no
synthetic transaction, review candidate, retained source or external fixture remains on it.

## Remaining release work

This advances but does not close `RB-VAULT-REAL-DATA-E2E`. Release-device drills still need timed
process kills during real PDF/image/CSV intake, physical low-storage edit/restore coverage,
long-running reviewed real-format endurance, every staged/backup loss combination on a production
build, iOS parity and cloud/cross-device restore evidence.
