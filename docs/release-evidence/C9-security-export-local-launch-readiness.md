# C9 Security, Export And Local Launch Readiness

## Phase / task IDs

Phase 9. Primary task range: T122 through T133.

## Result

Phase 9 now has both its deterministic contracts and a production Android implementation for the
main encrypted local state, optional device-credential app lock, complete local-data clearing and
human export. The app-lock unavailable/recovery path is release-built and emulator-proven. It is
not complete for claims requiring a live successful app-lock authentication recording, independent
security/MASVS clearance, DPIA approval, independent accessibility audit, destructive native
resilience drills or private-beta operations signoff. Android encrypted source retention is now
implemented and device-proven in `ANDROID_ENCRYPTED_SOURCE_RETENTION_2026-07-16.md`. Folio-state
write-failure visibility, intact-generation recovery and retry are partially proven in
`ANDROID_PERSISTENCE_FAILURE_RECOVERY_2026-07-16.md`.

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
- AES-256-GCM main-state persistence with a device-only Android Keystore data key, staged writes,
  a verified previous generation and corruption parking.
- A real optional app-lock gate using Android device credentials through
  `expo-local-authentication`; it locks whenever Melo leaves the active screen and recovers safely
  if the device credential is later removed.
- A comprehensive local clear adapter that removes live money/history, SQLCipher ledger rows,
  reminder state and presented notifications, widget state, backup/parked state files and
  app-owned plaintext exports before writing one canonical encrypted empty state.
- An app-private AES-256-GCM source-document vault with workspace/evidence-bound authentication,
  short-lived plaintext viewing, boot cleanup, evidence-link integrity and complete deletion.

## Task coverage

| Task                     | Status                                | Evidence                                                                                                                                                                  |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T122 Document library    | Android implemented and device-proven | Encrypted vault, authenticated viewer, cleanup and library evidence recorded on 2026-07-16                                                                                |
| T123 Extraction review   | Implemented and tested                | Low-confidence or unreviewed candidates cannot commit                                                                                                                     |
| T124 Privacy/data centre | Implemented and tested                | Data routes, cloud status, export/delete and memory reset modelled                                                                                                        |
| T125 Human export        | Implemented and tested                | CSV, JSON and PDF-style summary surfaces require no cloud or subscription                                                                                                 |
| T126 Threat model        | Blocked for release                   | Draft controls modelled; independent review/signoff required                                                                                                              |
| T127 MASVS               | Blocked for release                   | Storage, crypto and auth high-severity checks remain open until independent verification                                                                                  |
| T128 DPIA/processors     | Blocked for release                   | Processor inventory modelled; privacy/legal approval required                                                                                                             |
| T129 Accessibility audit | Blocked for release                   | Audit matrix modelled; independent device audit required                                                                                                                  |
| T130 Diagnostics         | Implemented and tested                | Sanitised diagnostic bundle state has no financial content                                                                                                                |
| T131 Reviewer vault      | Implemented and tested                | Synthetic labelled vault is isolated and account-free                                                                                                                     |
| T132 Resilience drills   | Partial; blocked for release          | Kernel ENOSPC state/PDF retry, corruption recovery, Personal migration interruption, airplane loop and clean-sandbox restore proven on Android; remaining matrix required |
| T133 Private beta        | Blocked for release                   | Gate summary modelled; beta not ready while T122/T126/T127/T128/T129/T132 blockers remain                                                                                 |

The production implementation closes the Android T122 implementation gap and materially advances
T124. The persistence recovery work materially advances T132, but it does not convert the
independent T126-T129 or full destructive-drill T132 gates into passes.

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

Focused production checks completed on 2026-07-15:

- `pnpm vitest run apps/mobile/src/folio/lib/localDataDeletion.test.ts apps/mobile/src/folio/lib/appLock.test.ts apps/mobile/src/folio/lib/notifications.test.ts`: passed, 3 files and 17 tests.
- Expanded release-critical run covering local/remote deletion, app lock, notifications, runtime
  reminder state, calendar reminders, encrypted backup, billing grants and all three backend purge /
  entitlement services: passed, 12 files and 56 tests.
- `pnpm --filter @folio/mobile typecheck`: passed.
- Android release runtime showed the real `App lock` switch and the correct device-lock-required
  recovery alert on an emulator without a PIN, pattern, password or biometric. The emulator
  security configuration was not changed merely to manufacture a success capture.
- A fresh release install showed an empty first run with no inherited sample-money values. Android
  reduced-motion (`0` animation scales) and 1.3 large-text passes are captured, and the shared sheet
  transition/keyboard bug discovered by that pass was fixed. TalkBack binding and Back-control
  focus are captured; full spoken traversal remains independent acceptance work.

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

The newer production-app evidence is separate from that historical preview:

- `docs/release-evidence/android-melo-app-lock-unavailable.png` and `.xml`: Privacy exposes the
  actual switch as an accessibility `switch`, state off.
- `docs/release-evidence/android-melo-app-lock-device-requirement.png` and `.xml`: enabling without
  an enrolled Android device credential produces a truthful requirement and does not enable the
  lock.
- `docs/release-evidence/android-melo-release-first-run.png` and `.xml`: clean release first run,
  empty money state and no inherited sample values.
- `docs/release-evidence/android-melo-reduced-motion-onboarding.png` and `.xml`: onboarding remains
  visible and operable with Android system animation scales at zero.
- `docs/release-evidence/android-melo-large-text-onboarding.png`,
  `android-melo-large-text-more.png`, `android-melo-large-text-privacy.png` and matching XML: 1.3
  Android font-scale reflow evidence.
- `docs/release-evidence/android-melo-talkback-back-focus.png` and `.xml`: TalkBack bound with a
  visible focus indicator on Back; not a claim of complete spoken traversal.

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

- Android encrypted document handling and workspace-bound document keys are implemented and
  device-proven; the iOS counterpart and independent cryptographic review remain required.
- Successful device-credential authentication, timeout policy and credential-change recovery need
  a controlled emulator/device recording; the unavailable/recovery path is already proven.
- Independent security/MASVS, DPIA/legal and accessibility audit evidence remain required.
- The current persistence writer has a 47-case recovery suite plus release-built Android
  kernel-ENOSPC retry/cold-start, encrypted-PDF-source ENOSPC recovery,
  corrupted-main-to-verified-backup proof, Personal legacy-to-schema-v11 interrupted-migration
  recovery, clean-sandbox portable-export restore, lossless state/root SQLCipher authority,
  SQL-only cold start, native whole-database quarantine/rebuild and a transactionally verified
  schema-v8 canonical mirror, generation-bound inverse parity for all 44 durable AppState fields
  and privacy-minimal typed-command writes for mapped shipping mutations. Automated encrypted-file
  orphan reconciliation plus source-promotion `ENOSPC` and deletion `EIO` behavior are covered. The
  remaining destructive matrix still requires release-build staged/backup drills,
  kill-during-import, physical low-storage edit/restore boundaries, real-format endurance, iOS and
  cloud/cross-device restore runs.
- Private beta cannot open until the release-blocking rows above are closed.

## Boundary conclusion

Phase 9 has a real encrypted-state, export, local-deletion and optional app-lock Android foundation
in addition to its deterministic contracts and historical synthetic shell. It remains blocked for
public or private-beta security claims until iOS encrypted-source parity, the remaining app-lock
device path, independent reviews, DPIA approval, the full destructive resilience matrix and beta
operations signoff exist. No V1 donor runtime code or assets were used.
