# Department Audit 2026-06-22

This audit covers the installed Android release APK after the Huashu/product-truth pass for
graphs, calendar/planner, import, money entry, recovery, local security and stale-copy cleanup. It
is scoped to what a local tester can actually open and exercise in the APK, including the local Data
Control route for search, export and armed device clear.

## Fresh Evidence

- APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
- Final rebuilt APK size: `69,327,847` bytes; SHA256:
  `9DF1FC5B3F6A07BFEC69DE8E7E5A4672ED93FE26A5DDAB1C9B97063DAED0C45B`.
- Final release JS bundle size: `3,410,324` bytes; SHA256:
  `F89D2F4C4751A8D5804DD67C48F7124676E78D483ACDAC4EBAFB2431EA6860D8`.
- Install and launch: `adb install -r`, `monkey -p com.folio.v2.greenfield`, armed clear,
  force-stop and relaunch proof confirmed the current persisted local route.
- Fresh captures:
  `docs/release-evidence/route-audit-2026-06-22-department-interactive-pass-final/`.
- Fresh quick-estimate captures:
  `docs/release-evidence/route-audit-2026-06-22-quick-estimate-final/`.
- Fresh Data Control captures:
  `docs/release-evidence/route-audit-2026-06-22-data-control-final/`.
- Fresh Data Control clear captures:
  `docs/release-evidence/route-audit-2026-06-22-data-clear-final/`.
- Fresh Recovery save captures:
  `docs/release-evidence/route-audit-2026-06-22-recovery-save-final/`.
- Fresh Calendar planner captures:
  `docs/release-evidence/route-audit-2026-06-22-calendar-planner-final/`.
- Fresh Melo local-evidence captures:
  `docs/release-evidence/route-audit-2026-06-22-melo-evidence-final/`.
- Fresh Melo direct-lookup captures:
  `docs/release-evidence/route-audit-2026-06-22-melo-lookup-final/`.
- Fresh route-truth captures:
  `docs/release-evidence/route-audit-2026-06-22-truth-pass/`; captures prove the rebuilt APK is
  open on the emulator, Today follows full-route risk rather than only cash today, and the route
  chart no longer renders duplicate overlapping axis labels on one-point routes.
- Current proof captures include `fresh-first-minute-v2`, `user-statement-import-clean`,
  `money-empty-entry`, `money-disabled-buttons`, `more-product-copy-v2`,
  `quick-estimate-empty`, `quick-estimate-filled-integer-graph`, `data-control-top`,
  `data-control-search-rent`, `data-control-export-ready-retry`,
  `calendar-planner-clean-preview`, `calendar-planner-clean-selected-row`,
  `melo-local-records-fallback`, `melo-dentist-local-records`,
  `melo-tyre-lookup`, `melo-tyre-records`,
  `data-control-before-clear`, `data-control-after-clear-top`, `launch-after-clear`,
  `recovery-tyre-preview-scrolled`, `today-after-recovery-save` and
  `launch-after-recovery-save`.
- Targeted final XML scan across those current proof captures found no stale matches for old fake or
  implementation-facing strings: `Record spend today`, `Recorded test spend`, `Bad month route`,
  `Build recovery route`, `Ask one more question`, `searchable rows`, `tester APK`,
  `tester session`, raw digest/fingerprint copy, private example statement names or local parser
  names.
- Source scan over `apps`, `packages` and current stale-copy guards leaves only negative test
  assertions for the old private-example/local-rows strings, not visible route text.
- Android release build after the final Melo lookup fix succeeded and was installed to
  `emulator-5554`.

## Huashu UI/UX Review

Huashu lens used for this pass: no data slop, no fake live charts, no invented stats, no hidden
engineering copy in product UI, and every visible metric must come from local route, ledger,
import summary or Melo local draft state.

Fixed in this pass:

- Fresh install now starts on the first-minute path. The private example is memory-only and is not
  auto-saved as user data.
- The first-minute path now has a no-import quick estimate option. Empty quick estimate shows no
  graph; after typed values `1190`, `1840` and `875`, the route graph and rows are generated from
  those values.
- `Use one of my statements` opens a clean user-statement import path with `0 rows` until the tester
  chooses or pastes a real statement. Private example rows, parser names and seed file names no
  longer leak into that path.
- Money entry no longer ships with fake `Groceries` or `40.00` prefilled state. Save buttons are
  disabled until the tester enters a title and a valid amount.
- The previous one-tap fake spend save was removed. `Use amount in entry` only copies the preview
  amount into the editable field.
- Recovery now previews a user-entered spend title and amount instead of a hard-coded car repair
  demo. Recording remains review-gated.
- Recovery accessibility copy no longer refers to the old hard-coded repair example when backing out
  without saving.
- Recovery save was executed from an empty persisted route. A user-entered `Tyre` / `25.00` preview
  showed `-25`; after `Record locally`, Today showed `Tyre added locally`, `-25` and `1 known`, and
  the same route survived force-stop/relaunch.
- Melo action labels no longer overpromise route-building or fake follow-up intelligence. Local AI
  actions stay deterministic and review-gated.
- Melo now exposes the local records it checked. Generic route questions show route-balance
  evidence; a direct `Dentist` query shows the saved `Dentist`, `-25`, due-date row from the local
  calendar commitment instead of a black-box assistant answer.
- Melo now answers direct saved-record lookups from the local records themselves. In the rebuilt
  release APK, a typed `Tyre` prompt returns `I found Tyre in the local records as -£25`, shows `1
direct local record match`, `No cloud model or remote search used`, and lists the checked `Tyre
-£25` source row.
- More now says `source-linked records`, `Saved here` and `Private example is not saved`; old
  `searchable rows`, tester and native-debug wording was removed.
- Data Control now gives the tester local search across route records, transactions, import drafts,
  document stages and local history; the export button writes a sanitized JSON file and reports the
  actual generated filename/size; clear-this-device is guarded behind an explicit arm step.
- Data Control clear was executed in the installed APK. A saved `Dentist` row became `0 saved rows,
1 route point`; after force-stop and relaunch, Today reopened at `0 known` with a single `GBP 0`
  route point and no private-example rows.
- Calendar now has a selected-day planner form. A dated protected commitment previews its route
  impact, saves as a local record and then appears in selected-day rows and the agenda from the
  installed APK.
- Today's top headline now follows the full plotted route. A cash-positive route with a later
  negative tightest point is labelled `This route needs attention`, not covered-through-payday.
- Calendar/Today/Data Control no longer truncate local route/source rows before selected-day or
  source filtering. Summary views can still be compact, but the underlying local lists remain
  complete and searchable.
- Import progress now tracks duplicate restaged statement rows as skipped rows instead of inflating
  resolved/read progress.
- Route chart axis labels now compact duplicate/colliding labels; the installed APK capture shows a
  one-point route with a single readable `Today` axis label rather than overlapping repeated labels.
- Raw digests/fingerprints are no longer visible in the import/source UI. Source copy now describes
  the locally kept file/text attachment in product language.
- SecureStore fallback no longer persists with a hard-coded key. If device key storage is
  unavailable, records are memory-only and save attempts report that honestly.
- SQLite snapshot and normalized-table rewrite now run inside a transaction.
- Accessibility pass removed parent wrappers that hid child controls, added disabled states to
  buttons, clamped stepper controls at min/max and made the More button a real 48dp target.

Remaining Huashu caution: the local APK is ready for serious local testing, but public 10/10 still
requires real-device TalkBack/large-text/reduced-motion recordings, long-run profiling and real user
sessions.

## Local APK Scoreboard

| Department                 | Local APK score | Current state                                                                                                                                      |
| -------------------------- | --------------: | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today / live route         |           10/10 | Headline follows full-route risk; rows, source sheet and graph derive from local route/ledger state.                                               |
| Graphs / data truth        |           10/10 | Today, Calendar, Money what-if and Recovery graphs reflect route state changes and compact duplicate axis labels.                                  |
| Quick estimate             |           10/10 | No-import route path starts empty, draws no placeholder graph and renders graph/rows only after tester-entered values.                             |
| Money / manual entry       |          9.9/10 | Empty by default, validates title/amount and disables write buttons until the tester enters real values.                                           |
| Calendar / planner         |           10/10 | Selected days filter dated rows; adding a dated commitment saves locally and rebuilds route, agenda and graph state.                               |
| Import review              |           10/10 | User-statement import starts clean; CSV/TXT/paste staging, edit, duplicate-skip counts and confirm flows remain local and review-gated.            |
| Melo / local AI            |           10/10 | Deterministic local assistant answers route questions and direct saved-record lookups from checked local records; live AI is release/out-of-scope. |
| Recovery                   |           10/10 | User-entered recovery spend preview, local save, Today rebuild and restart persistence are proven from the installed APK.                          |
| Data control               |           10/10 | Local search, sanitized export, armed clear, empty-state counter and restart-persistent clear are proven from the installed APK.                   |
| Security / local vault     |          9.6/10 | Device-key, app-lock and memory-only fallback states are now honest; real-device biometric/key-wrapping audit remains release work.                |
| Accessibility              |          9.5/10 | Disabled states, touch target fixes and control visibility improved; independent TalkBack/large-text audit is still required.                      |
| UI / UX craft              |          9.9/10 | Relief-first flow restored, implementation copy removed and the visible chart-label collision fixed.                                               |
| Performance / native build |          9.5/10 | Release APK builds, installs and launches on emulator; long-run profiling/endurance remains future work.                                           |
| Testing / contracts        |           10/10 | CI, boundaries, typecheck, tests, contract validation, formatting and stale-copy scans pass.                                                       |
| V1 independence            |           10/10 | V1 boundary proof passes: `149` V2 runtime/package files checked against `859` V1 hashes.                                                          |

Local tester APK overall: `9.88/10`. That means strong enough for full hands-on local testing, not a
public-store release claim.

## Public/Beta Release Scoreboard

| Department           | Release score | Why it remains outside this local APK pass                                                                       |
| -------------------- | ------------: | ---------------------------------------------------------------------------------------------------------------- |
| iOS native           |        2.0/10 | No macOS/Xcode or EAS-signed iOS install/launch proof.                                                           |
| Open Banking         |        3.0/10 | Contracts exist; no regulated provider, token adapter, legal/provider proof or rollout evidence.                 |
| Cloud account / sync |        3.4/10 | Contracts/evidence exist; no live account provider, deletion route, multi-device restore or cloud backend proof. |
| Optional live AI     |        4.2/10 | Local Melo works; live gateway/provider/model evaluation, monitoring, DPIA and rollback are not closed.          |
| OCR / documents      |        4.6/10 | Local CSV/TXT import works; encrypted native document storage and OCR proof remain release work.                 |
| Billing / store      |        2.0/10 | Store declarations are prepared but not submitted/matched to a reviewed binary; billing proof absent.            |
| Operations / support |        4.0/10 | Runbooks exist; tabletop, rotation drills and vulnerability disclosure are not complete.                         |
| Legal / privacy      |        3.5/10 | DPIA/checklists/policies exist; external legal/privacy approval missing.                                         |
| Security release     |        4.0/10 | Local posture is visible; independent threat/MASVS/pen-test signoff missing.                                     |

## Verification

- `pnpm run ci`: passed; public release, store and operations blockers are reported as blocked by
  design.
- `pnpm lint:boundaries`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 38 files and 380 tests.
- `pnpm validate:contracts`: passed.
- `pnpm format:check`: passed.
- Source stale-copy scan: clean for visible product routes; remaining matches are internal digest
  fields, type names and negative test guards.
- Current proof XML stale-copy scan: clean for stale fake/live/prototype strings listed above.
- Quick-estimate emulator proof: clean first-minute entry, empty no-placeholder state and generated
  graph/rows from typed values; stale `local rows` copy absent from current source/proof scan.
- Data Control emulator proof: local search result list, export preview and export-ready filename
  from the installed APK; clear controls are visible and armed before destructive action.
- Data Control clear proof: `data-control-before-clear` showed the saved `Dentist` row; after the
  armed clear, `data-control-after-clear-top` showed `0 saved rows, 1 route point`; after force-stop
  and relaunch, `launch-after-clear` showed Today at `0 known` with the single `GBP 0` plotted
  point.
- Calendar planner emulator proof: `Dentist` commitment preview changed the projected tightest point
  from `£142` to `£117`; after save, the selected-day and agenda rows show `Dentist`, `-£25` and
  `Added on this device`.
- Melo emulator proof: the default spend question shows route-balance evidence, while a direct
  `Dentist` query shows the saved `Dentist`, `-25`, `due 2026-06-23` local record in the installed
  release APK.
- Melo direct-lookup emulator proof: a typed `Tyre` prompt in the rebuilt APK shows `I found Tyre in
the local records as -£25`, `1 direct local record match`, `No cloud model or remote search used`
  and the checked `Tyre -£25` source row.
- Recovery emulator proof: `recovery-tyre-preview-scrolled` showed a user-entered `Tyre` / `25.00`
  preview at `-25`; `today-after-recovery-save` and `launch-after-recovery-save` proved the saved
  local row rebuilt Today and persisted after restart.
- Android release build/install/launch: passed after the final fix.

## Current Truth

The Android APK is ready for serious local functional testing of the local-first slice: onboarding,
Today graph, Money what-if and manual recording, Calendar route plus dated local commitments,
Import Review with real edit sheet, Melo local assistant, Recovery path, full Source Sheet, Data
Control search/export/clear and honest local security/persistence posture.

It is not honestly a public 10/10 release. The remaining gaps are platform/provider/release
departments: live cloud AI, Open Banking, iOS proof, OCR, real-device security, independent
accessibility/security/legal review, billing, store submission and operations drills.
