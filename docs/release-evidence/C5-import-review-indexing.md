# C5 Import Review And Indexing

## Phase / task IDs

Phase 5. Primary task range: T071 through T086.

## Result

Phase 5 is complete for the unblocked pure parser/review/indexing contracts and for an Expo
development-build import review shell. It is not complete for release claims that require native
encrypted file staging, OCR, vault-backed transaction writes, real-data briefing or endurance
evidence.

## What was built

- `@folio/import-engine`, a pure TypeScript import engine with canonical rows, provenance,
  confidence, review states and parser metadata.
- CSV parser with deterministic column mapping, quoted-cell parsing and spreadsheet-formula text
  escaping.
- OFX/QFX parser for bank statement transaction blocks, balances, FITID identities and fallback
  stable IDs.
- QIF best-effort parser that surfaces legacy limitations as review reasons.
- Duplicate fingerprinting, pending-to-posted candidates, transfer candidates and balance
  reconciliation.
- Deterministic categorisation ladder with user rules, known counterparties, bundled rules and
  blocked classifier/model routes.
- Search index entry generation and bounded import-question planning with a default cap of three.
- `@folio/storage` import-commit command handler that atomically writes search entries, queues
  rebuild jobs and writes command audit entries, with a caveat that transaction row writes await
  the vault-backed repository.
- Mobile Phase 5 import review shell in the Expo screen showing file-route choices, staging
  blocker, row totals and review rows without requesting permissions.
- Figma Phase 5 evidence frame and Huashu critique record.

## Task coverage

| Task                          | Status                                          | Evidence                                                       |
| ----------------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| T071 Encrypted source staging | Blocked                                         | Requires T018 encrypted document-file proof                    |
| T072 Canonical import row     | Implemented and tested                          | `CanonicalImportRow`, parser metadata, provenance tests        |
| T073 CSV parser/mapping       | Implemented and tested                          | CSV quoted rows, debit/credit mapping and formula safety tests |
| T074 OFX/QFX parser           | Implemented and tested                          | STMTTRN, FITID/fallback ID and balance parsing tests           |
| T075 QIF parser               | Implemented and tested                          | Legacy limitation review reasons tested                        |
| T076 PDF/image adapter        | Blocked                                         | Requires T017/OCR and native capture path                      |
| T077 Duplicate fingerprinting | Implemented and tested                          | Provider, source-row, semantic and pending-posted candidates   |
| T078 Pending-posted reconcile | Implemented as reviewable candidates            | Duplicate candidate tests                                      |
| T079 Transfer matching        | Implemented and tested                          | Cross-account equal/opposite movement tests                    |
| T080 Balance reconciliation   | Implemented and tested                          | Exact and mismatch balance tests                               |
| T081 Categorisation ladder    | Deterministic routes implemented; ML blocked    | User rule, known counterparty and bundled rule tests           |
| T082 Bounded import questions | Implemented and tested                          | Three-question cap and deferred review queue tests             |
| T083 Import review UI         | Shell implemented; real flow blocked            | Expo review shell with no picker/permission request            |
| T084 Atomic commit/rebuild    | Evidence command implemented; real rows blocked | Storage command bus rollback/search/job/audit tests            |
| T085 First real-data briefing | Blocked                                         | Requires vault-backed accepted rows and real user data         |
| T086 Corpus/endurance tests   | Pure fixtures covered; full gate blocked        | Source package vectors still require blocked native/real flows |

## Android live preview evidence

Evidence captured on 2026-06-21:

- Metro log: `docs/release-evidence/metro-phase5-live-preview.log`.
- First viewport: `docs/release-evidence/android-live-preview-phase5.png`.
- First scrolled preview: `docs/release-evidence/android-live-preview-phase5-scroll.png`.
- Import shell route/staging preview:
  `docs/release-evidence/android-live-preview-phase5-gates.png`.
- Import review row preview:
  `docs/release-evidence/android-live-preview-phase5-review.png`.
- Phase 5 gate proof:
  `docs/release-evidence/android-live-preview-phase5-gate-proof-2.png`.
- UIAutomator dumps:
  - `docs/release-evidence/android-window-phase5.xml`
  - `docs/release-evidence/android-window-phase5-scroll.xml`
  - `docs/release-evidence/android-window-phase5-gates.xml`
  - `docs/release-evidence/android-window-phase5-review.xml`
  - `docs/release-evidence/android-window-phase5-gate-proof-2.xml`

The screenshots show the Today shell plus a Phase 5 import review section with no file picker
prompt, no permission request and explicit staging blockers. The Expo development overlay is
visible, so release-frame screenshots without the overlay remain required before public/store
claims.

Android native build/install evidence:

- `pnpm --filter @folio/mobile exec expo prebuild --clean --no-install`: passed.
- `docs/release-evidence/android-phase5-native-smoke.log`: Gradle `BUILD SUCCESSFUL in 2m 53s`,
  APK installed and the development-client URL opened.

Post-smoke preview blocker:

- After the clean prebuild/reinstall, repeated development-client relaunches opened a blank native
  surface instead of requesting/rendering the Metro JS bundle. The build/install smoke passed, but
  post-smoke live preview is blocked until the Expo dev-client launch configuration is corrected.
- Blocker evidence:
  - `docs/release-evidence/android-phase5-run-android-port8082.log`
  - `docs/release-evidence/android-live-preview-phase5-run-android-port8082.png`
  - `docs/release-evidence/android-window-phase5-run-android-port8082.xml`

## Verification evidence

Focused checks completed on 2026-06-21:

- `pnpm --filter @folio/import-engine typecheck`: passed.
- `pnpm vitest run packages/import-engine/test/import-engine.test.ts`: passed, 13 tests.
- `pnpm --filter @folio/storage typecheck`: passed.
- `pnpm vitest run packages/storage/test/import-commit.test.ts`: passed, 2 tests.
- `pnpm --filter @folio/mobile typecheck`: passed.
- `pnpm vitest run apps/mobile/src/phase5/importReviewAdapter.test.ts`: passed, 10 tests.
- `pnpm run ci`: passed, 17 test files and 100 tests.
- `pnpm lint:boundaries`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 17 test files and 100 tests.
- `pnpm validate:contracts`: passed with 75 files, 15,681 lines, 192 tasks, 32 risks,
  18 forecast vectors, 15 import vectors and 14 checked fixture cases.
- `pnpm --filter @folio/mobile doctor`: passed, 21/21 checks.
- `pnpm --filter @folio/mobile exec expo install --check`: dependencies are up to date.

## Figma evidence

Editable Figma evidence exists at:

- `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=7-3`

Local rendered board:

- `docs/release-evidence/figma-phase5-evidence.png`

Figma is review evidence only. The repository, tests and emulator artifacts remain the source of
truth.

## Huashu UI/UX critique

Huashu review outcome:

- The flow keeps import as a review-before-commit experience, not a hidden background mutation.
- Blocked native capabilities are visible in the same surface as the import choice.
- The copy avoids fake reassurance: it says the file picker is not connected and no file permission
  is requested.
- Sample rows are labelled as review-shell evidence and do not pretend to be user data.
- The design keeps hierarchy tight: route choice, staging blocker, totals, then rows.

Issues carried forward:

- Capture release screenshots without the Expo development overlay.
- Manual TalkBack, large text and reduced-motion checks are still required.
- Native encrypted staging must be proven before connecting the real picker.
- OCR and PDF/image routes must not appear available until the native adapter exists.
- The storage command handler is atomic evidence for search/jobs/audit only; real transaction
  writes remain blocked until the vault-backed repository lands.

## Boundary conclusion

Phase 5 is complete for pure parser/review/indexing contracts, mobile shell evidence and atomic
storage-command evidence. T071, T076, the real part of T083, the real transaction-row part of T084,
T085 and the full T086 release gate remain blocked by native/vault/real-data dependencies. No V1
donor runtime code or assets were used.
