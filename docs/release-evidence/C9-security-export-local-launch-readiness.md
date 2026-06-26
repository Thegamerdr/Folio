# C9 Security, Export And Local Launch Readiness

## Phase / task IDs

Phase 9. Primary task range: T122 through T133.

## Result

Phase 9 is complete for deterministic release-readiness contracts and a synthetic-labelled Expo
Today shell. It is not complete for release claims requiring native encrypted document storage,
platform app-lock proof, independent security/MASVS clearance, DPIA approval, independent
accessibility audit, destructive native resilience drills or private-beta operations signoff.

## What was built

- Added `@folio/release-readiness` as a pure Phase 9 package.
- Document-library state for capture/file metadata, links, retention, search, delete and native
  encrypted-file blockers.
- Extraction-review state for candidate fields, source locations, confidence, review status and
  no low-confidence commit gating.
- Privacy/data-centre state for data location, permissions, memory reset, export/delete and cloud
  status.
- Human export plan for CSV, JSON and PDF-style summaries without cloud or subscription gates.
- Threat-model state with assets, actors, controls, residual risks and signoff blocker.
- MASVS verification matrix across storage, crypto, auth, network, platform, code and privacy.
- DPIA/processor inventory for local, cloud AI and Open Banking routes.
- Independent accessibility audit status across VoiceOver, TalkBack, large text, reduced motion
  and cognitive review.
- Local diagnostic screen state for integrity, backup, index and jobs with sanitised export proof.
- Synthetic reviewer vault manifest that is labelled, isolated and account-free.
- Resilience drill report for migration interruption, corruption, low storage, kill-during-import
  and restore drills.
- Private-beta readiness summary that remains blocked until external and native gates close.
- `apps/mobile/src/phase9` mobile evidence adapter and integrated Expo Today section.

## Task coverage

| Task                     | Status                 | Evidence                                                                                    |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------------------------- |
| T122 Document library    | Blocked for acceptance | Pure state built; native encrypted file store and workspace document subkeys still required |
| T123 Extraction review   | Implemented and tested | Low-confidence or unreviewed candidates cannot commit                                       |
| T124 Privacy/data centre | Implemented and tested | Data routes, cloud status, export/delete and memory reset modelled                          |
| T125 Human export        | Implemented and tested | CSV, JSON and PDF-style summary surfaces require no cloud or subscription                   |
| T126 Threat model        | Blocked for release    | Draft controls modelled; independent review/signoff required                                |
| T127 MASVS               | Blocked for release    | Storage, crypto and auth high-severity checks remain open until independent verification    |
| T128 DPIA/processors     | Blocked for release    | Processor inventory modelled; privacy/legal approval required                               |
| T129 Accessibility audit | Blocked for release    | Audit matrix modelled; independent device audit required                                    |
| T130 Diagnostics         | Implemented and tested | Sanitised diagnostic bundle state has no financial content                                  |
| T131 Reviewer vault      | Implemented and tested | Synthetic labelled vault is isolated and account-free                                       |
| T132 Resilience drills   | Blocked for release    | Drill report modelled; native destructive drills required                                   |
| T133 Private beta        | Blocked for release    | Gate summary modelled; beta not ready while T122/T126/T127/T128/T129/T132 blockers remain   |

## Verification evidence

Focused checks completed on 2026-06-21:

- `pnpm exec tsc -b packages\release-readiness --pretty false`: passed.
- `pnpm exec tsc -b apps\mobile --pretty false`: passed.
- `pnpm vitest run packages\release-readiness\test\release-readiness.test.ts apps\mobile\src\phase9\releaseReadinessEvidence.test.ts`: passed, 23 tests.

Full gates completed on 2026-06-21:

- `pnpm run ci`: passed; includes lint, typecheck, 24 test files and 214 tests, and
  contract validation.
- `pnpm lint:boundaries`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 24 files and 214 tests.
- `pnpm validate:contracts`: passed with 75 files, 15,681 lines, 192 tasks, 32 risks,
  18 forecast vectors, 15 import vectors and 14 independently checked fixture cases.
- `pnpm --filter @folio/mobile doctor`: passed, 21/21 checks.
- `pnpm --filter @folio/mobile exec expo install --check`: passed.
- `pnpm check:v1-boundary`: passed; 111 authored V2 runtime/package files checked against
  859 V1 freeze hashes.

## Android live preview evidence

The Phase 9 mobile shell is integrated into `apps/mobile/app/index.tsx`. Android
development-client preview was verified on `emulator-5554` (`sdk_gphone64_x86_64`) using Metro on
port `8087`.

Actual artifacts:

- `docs/release-evidence/metro-phase9-live-preview-lan.log`
- `docs/release-evidence/android-live-preview-phase9-top.png`
- `docs/release-evidence/android-window-phase9-top.xml`
- `docs/release-evidence/android-live-preview-phase9-readiness.png`
- `docs/release-evidence/android-window-phase9-readiness.xml`
- `docs/release-evidence/android-live-preview-phase9-security.png`
- `docs/release-evidence/android-window-phase9-security.xml`
- `docs/release-evidence/android-live-preview-phase9-gate.png`
- `docs/release-evidence/android-window-phase9-gate.xml`
- `docs/release-evidence/android-live-preview-phase9-gate-bottom.png`
- `docs/release-evidence/android-window-phase9-gate-bottom.xml`

The Metro log records `Android Bundled 2164ms node_modules\expo-router\entry.js (1698 modules)`.
PNG captures decode as valid `1080x2400` images.

UI tree proof:

- Top viewport confirms `PERSONAL WORKSPACE`, `Local mode`, `Today` and first-minute rows.
- Phase 9 readiness viewport confirms `PHASE 9 LOCAL LAUNCH READINESS`, `Private beta`,
  `7 blockers`, synthetic no-account/no-cloud/no-model/no-real-records copy, and the document
  extraction section.
- Security viewport confirms `SECURITY, PRIVACY AND AUDIT BLOCKERS`, document-file/app-session
  blockers, sanitised diagnostics, disabled optional cloud routes, and MASVS storage/crypto
  blockers.
- Gate viewport confirms `PHASE 9 GATE`, T122 document-library blocker, T123 extraction review,
  T124 privacy/data centre, T125 human export, and T126-T129 review blockers.
- Lower gate viewport confirms T130 diagnostics, T131 reviewer vault, T132 resilience drills and
  T133 private beta blocked because local-only beta is not ready.

The preview proves only that the synthetic Phase 9 shell renders in the Android development
client. It does not prove native encrypted document files, app lock, independent reviews,
destructive drills or private-beta launch readiness.

## Figma evidence

Editable Figma evidence was created from the Phase 9 repo contracts and mobile shell.

Figma board:

- `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=14-2`

Local rendered board:

- `docs/release-evidence/figma-phase9-evidence.png` (`1260x1496`)

Figma is review evidence only. The repository, tests and emulator artifacts remain the source of
truth.

## Huashu UI/UX critique

Huashu review outcome:

- The section avoids trust theatre: no shield graphics, victory badges or implied clearance.
- The first private-beta row says "blockers" rather than "ready" when external gates remain open.
- Security, DPIA, MASVS and accessibility are shown as plain rows with exact blockers.
- The diagnostic area states that the export is sanitised and contains no financial content.
- The reviewer vault is labelled synthetic and account-free.
- The hierarchy keeps implemented local contracts and release blockers in separate scan groups.

Issues carried forward:

- Native encrypted document file handling and workspace subkeys remain required.
- App lock, timeout and recovery proof remain required.
- Independent security/MASVS, DPIA/legal and accessibility audit evidence remain required.
- Native destructive resilience drills remain required.
- Private beta cannot open until the release-blocking rows above are closed.

## Boundary conclusion

Phase 9 is complete for deterministic security/export/local-launch readiness contracts and
synthetic mobile shell evidence. It remains blocked for actual local-only private beta release
until native storage/app-lock proof, independent reviews, DPIA approval, destructive resilience
drills and beta operations signoff exist. No V1 donor runtime code or assets were used.
