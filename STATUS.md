# Melo delivery status

> **Current authority, 2026-08-16:** this repository and its `apps/mobile` React Native runtime are
> the authoritative Melo implementation. Delivery work is on
> `codex/melo-one-app-convergence-2026-08-15` in the existing Folio remote. Start with the
> [dated repository and navigation authority](docs/convergence/2026-08-16/MELO_REPOSITORY_AND_NAVIGATION_AUTHORITY.md),
> then the [current advisor-plan index](advisor-plans/README.md). Personal navigation is Today / Plan
> / Review / More; Business is Today / Money / Review / More; Melo is a contextual companion action.
> Public release, Business beta and billing verification remain separately gated.

The material below is retained as historical delivery evidence. Its old branch names, test counts,
build hashes and navigation descriptions are not current authority.

## Historical checkpoint — 16 July 2026

- The schema-v8 SQLCipher boundary represents all 44 durable fields in the 48-field shipping
  AppState contract. The four remaining fields are intentionally transient; no durable field is
  exact-envelope-only.
- Current import support includes local PDF text, image OCR, CSV, TSV, semicolon files, common split
  debit/credit exports and unstructured TXT/clipboard lines, all review-gated. The shipping parser
  passed an 18-case synthetic corpus and 100,000-row endurance run.
- Raw statement, OCR, transaction and Melo-chat data is not sent to an AI provider. Raw provider
  routes are retired; statement extraction and the deterministic companion run on-device. Sentry
  free-text/identity/request/breadcrumb data is scrubbed before egress.
- Persistence has a 47-case recovery matrix, automatic encrypted-import orphan cleanup, tested
  encrypted-source `ENOSPC` promotion cleanup and tested fail-honest `EIO` deletion behavior.
- `pnpm run ci` passes: full lint, every TypeScript target, 205 test files / 2,510 tests and
  both source-package validators. The latest 100,000-row parser run completed in 822 ms.
- Current dual-ABI APK: `109,035,615` bytes, SHA-256
  `08D73315D240EB9996D1C4D14D73A327D7468A0367B9F8B37A5D2AEE0D16FA72`.
- Current dual-ABI AAB: `76,959,006` bytes, SHA-256
  `50E1952891C137D2F98899F314A4BB24CB4700510A6A6DB8A9644DEE0E1D5532`.
- The current APK installed only on `emulator-5554` and cold-launched empty in 8,124 ms with no fatal
  Android/React match. The rendered first-use state contains no sample financial data.
- Release-built CSV review now identifies `CSV`, the real retained filename and row count; it no
  longer labels every successful intake as a one-page PDF. The same source-aware contract covers
  TSV, TXT, paste, image and PDF paths and preserves the correct Review source.
- Melo is not public-release complete: iOS, native key wrapping/recovery, independent security and
  accessibility review, store credentials/listing/purchase evidence, production Open Banking
  procurement/legal/pilot evidence, cloud restore/replay, real-user research and release operations
  sign-off remain open.

> **⛔ STALE BELOW THIS BANNER (kept as history). Current state, 2026-07-10:** the live product is
> the **Melo MVP** on branch **`claude/melo-mvp`**. Start at **`MELO_ALIGNMENT_AUDIT.md`** (the
> whole-app audit + phase plan; Phase 0 shipped at `bc50cad`, first Phase-1 tranche at `4b67d96`),
> then `MONEY_MODEL.md` (§2b confirmed money model), `ACCOUNTS_MODEL.md` (P3–P6 specs), and
> `ARCHIVE.md`/`CONSOLIDATION.md` (what was deleted vs. what is dead-but-present). The 15-phase
> greenfield program described below is the PRE-MELO era: its branch pointers, blocker lists, and
> evidence paths are historical.

> Updated 2026-06-30 (evening) — commits eb6e0a0/3783c9c/a3f81c9 (+ 7147884 AUDIT.md) on branch
> `claude/folio-rn-faithful-port`: sample/placeholder-data purge (charts, summary trio, calendar
> agenda, reader/edit sheets now plot real route data or show honest empty doorways, demo data gated
> behind `currentBalance.source==='sample'`), Melo mood wired to a real-route-derived pressure
> (`derivePressure`) with a nav override, TimelineScreen dark-mode invisible-text fix, ScrollView
> wrapping for five fixed-height screens, "Start fresh" → `resetToEmpty` + one-tap confirm, imported
> transactions keep their real statement date, and an AI cost split (chat = cheap
> `gemini-2.5-flash-lite`, vision = `gemini-2.5-flash`, gateway model allow-list). 0 typecheck
> errors, 306 folio tests green; visible fixes verified on-device by screenshot. Remaining open work
> (exhaustive dark-mode/cross-device visual pass, iOS, gateway redeploy + OpenRouter spend cap) is
> owner/QA, not RN bugs.

## Historical Phase 15 checkpoint

Phase 15 Android local-use hardening is implemented for the standalone tester APK, and the
2026-06-22 Huashu/product-truth pass removed fake/live-looking route copy, stale engineering
surfaces and prefilled demo writes from the current product flow. Today, Money, Calendar, Melo,
Import Review, Recovery and Source Sheet now use local route/ledger/import/Melo data rather than
invented product copy. Known route values, preview-only what-ifs and review-gated rows are separated
in the visible UI. Route graphs rebuild from local ledger state, the Calendar has tappable selected
days backed by dated route records, manual Money writes require tester-entered title and amount,
the first-minute flow includes a no-import quick estimate route from three typed facts, Import
Review opens a clean user-statement path with zero rows until the tester chooses or pastes a real
statement, Calendar can add a dated protected local commitment that rebuilds the route, Source
Sheet shows current local records, and More distinguishes private example state,
memory-only/device-save state, device key storage, local history, true device-auth app-lock
availability and a Data Control route for complete local search, sanitized export and two-step
device clear. A 2026-06-22 route-truth pass also removed pre-filter route truncation, corrected
Today's headline to follow the full plotted route risk, counted duplicate statement restages as
skipped instead of resolved, and fixed a visible chart-label collision on one-point routes.
Real Apple/Google
declarations, native billing, account deletion, tabletop, legal, DPIA, pen-test, manual
accessibility, iOS proof, store builds, production monitoring and launch blockers are carried
explicitly.

UI correction on 2026-06-21: the previous default mobile route was an engineering evidence wall,
not a product UX. Follow-up corrections on 2026-06-22 removed `/evidence` from the Expo app
entirely, stopped the private example from auto-saving as user data, removed fake prefilled Money
entry values, converted Recovery into a user-entered preview, removed raw digest/tester wording from
visible routes and made SecureStore fallback memory-only instead of using a hard-coded persisted
fallback key. Evidence remains in docs/test adapters, not in the local tester APK route surface. UX
readiness is not complete until real interaction polish, native accessibility recordings, large-
text/reduced-motion checks, user testing and Figma/code alignment are complete.

Update on 2026-06-30 (evening, commits eb6e0a0/3783c9c/a3f81c9): the same "nothing fabricated is
present 24/7" rule was carried into the `apps/mobile/src/folio/` faithful-port surface tree (the
Lovable 1:1 port), which still held demo geometry the 06-22 pass had not reached. The Today
money-path chart no longer draws hardcoded SVG geometry (the "salary rise +£2,180 / bill drop
−£875 / 7 Jul" curve) — it plots the real `route.points` daily series. The Today summary trio
("Coming in £2,180 / Going out £1,095") now reads real route totals
(`RouteResult.incomingTotal`/`outgoingTotal`) and the low-point week tile reads the real route tight
point. The Calendar agenda's hardcoded "Check Klarna · 2 of 3" review, generic UK tax deadlines and
`RECURRING_BILLS` (Octopus/Council Tax/Rent/BT) are now gated behind the demo regime
(`currentBalance.source==='sample'`, via `deriveCalendarEvents`'s `includeSampleBills`), so a
cleared/real app shows only the user's own data. Reader screens (Visualizer/Review/Paste/Image),
`SubCaughtSheet` and the edit sheets no longer fall back to sample rows or a fake
"Tesco · £42 · 26 Jun" on a cold open — they show honest empty doorways / blank forms; the
`RouteDetailSheet` Octopus/Rent placeholder and the chart "breathing room · £100" literal are gone.

- Phase 0: complete for Android native smoke; iOS remains blocked by macOS/Xcode or EAS iOS signing.
- Phase 1: Android database/storage risk retired with live emulator proof. Non-database native spikes remain explicit blockers before Phase 4 vault/mobile release claims.
- Phase 2: pure engine foundation implemented and tested.
- Phase 3: storage/application foundation implemented and tested.
- Phase 4: first-minute shell, labelled preview, quick-start path, privacy copy and navigation skeleton implemented; vault create/unlock and real usability evidence remain blocked.
- Phase 5: pure import engine, storage import-commit evidence command, mobile import review shell,
  Android system-picker staging, local PDF/image OCR, encrypted source retention, a verified
  canonical mirror, schema-v8 generation-bound canonical authority for all 44 durable AppState
  fields and privacy-minimal typed commands for the mapped mutation paths implemented; the full
  format/device matrix, real-data briefing and endurance evidence remain blocked.
- Phase 6: pure daily-loop engine, workspace-scoped local search and Expo Today shell implemented; vault-backed corrections, native notifications, external calendar sync, manual accessibility proof and real airplane-mode E2E remain blocked.
- Phase 7: deterministic Melo intent registry, language policy, proposal lifecycle, tone modes, ranking, bad-month mode, memory/correction contracts and Expo shell implemented; native voice, vault-backed commit, legal sign-off and manual accessibility proof remain blocked.
- Phase 8: deterministic plan/recovery contracts, optional plan drafts, rule edits, progress journeys, event cascade, recovery copy, budget remaining, momentum, controlled fun, retention preferences, rituals and Expo shell implemented; real vault commits, native rituals, animation proof, real-data E2E and manual accessibility proof remain blocked.
- Phase 9: deterministic release-readiness contracts, document/extraction review state, privacy/data centre, export/delete, threat/MASVS/DPIA/accessibility matrices, diagnostics, reviewer vault, Android encrypted documents, write-failure recovery, local app-lock overlay and Expo shell implemented; iOS parity, successful real-device biometric proof, independent reviews, DPIA approval, the remaining destructive drills and private beta remain blocked.
- Phase 10: deterministic optional-account, key hierarchy, recovery, device registry, encrypted envelope, inbox, conflict, snapshot, compaction, deletion, cloud inventory, multi-device, security-review and beta-gate contracts plus Expo shell implemented; real providers, native key wrapping, clean-device restore, cloud backend, web deletion, external pen-test and encrypted-backup/sync beta remain blocked.
- Phase 11: deterministic optional-AI task schema, provider registry, gateway, minimal context, route ladder, quota/cost, evaluation, Melo integration, consent and strict beta contracts plus Expo shell implemented; real gateway/provider/model, DPIA/processor approval, on-device adapter proof, evaluation pass, monitoring, rollback, support and strict beta remain blocked.
- Phase 12: deterministic Open Banking provider selection, BankDataProvider contract, consent, dashboard, staged ingestion, reconciliation, stale/gap, revocation and rollout-gate contracts plus Expo shell implemented; regulated provider, live provider contracts, backend token adapter, legal/store review, pilots, support and staged rollout remain blocked.
- Phase 13: deterministic business workspace, clients, invoices, payment matching, receipts, tax prep, reserve estimate, calendar, Melo context, reports, exports, mileage, isolation and beta-gate contracts plus Expo shell implemented; tax/legal signoff, official guidance verification, business entitlement, support, accessibility and beta remain blocked.
- Phase 14: deterministic store-release, entitlement, operations, final review, regression, limited-launch, outcome-research and roadmap guardrail contracts plus Expo shell implemented; real store declarations, native billing, account deletion, legal/privacy/security/accessibility reviews, store builds and production launch remain blocked.
- Phase 15: Android local-use hardening implemented in the standalone tester APK; public release remains blocked by iOS, legal/privacy/security/accessibility/store/operations and real-provider evidence.

## Implementation record

The implementation package in `docs/source-package` was read in the required order before coding began:

1. `00_START_HERE.md`
2. `01_GREENFIELD_AGENT_DIRECTIVE.md`
3. `02_PRODUCT_CONSTITUTION.md`
4. `03_SCOPE_AND_BOUNDARIES.md`
5. `04_EXPERIENCE_BLUEPRINT.md`
6. `05_FIRST_60_SECONDS.md`
7. `06_MELO_SYSTEM.md`
8. `07_PERSONAL_AND_BUSINESS_WORKSPACES.md`
9. `08_FINANCIAL_TRUTH_AND_EVENT_MODEL.md`
10. `09_PLANS_BUDGETS_AND_FORECASTING.md`
11. `10_CALENDAR_AND_PLANNER.md`
12. Remaining root documents
13. `architecture/`, `schemas/`, `testing/`, `release/`, `examples/`
14. `backlog/implementation_backlog.csv` and `backlog/risk_register.csv`
15. `agent/SINGLE_AGENT_EXECUTION_PROMPT.md`

## What was built

- New clean repository at `C:\dev\folio-v2-greenfield`.
- pnpm workspace and strict TypeScript project references.
- Baseline package layout matching the greenfield architecture.
- Source package copied under `docs/source-package` as implementation evidence.
- CI workflow for linting, type checking, tests and contract validation.
- Dependency-boundary checker and V1 hash/name boundary checker.
- Synthetic data, source/licence, ADR and constitution-gate records.
- V1 freeze, manifest, normalized donor inventory and runtime-dependency proof.
- Expo SDK 56 development-build shell in `apps/mobile`.
- Mobile token proof screen wired to `@folio/ui`.
- Expanded `@folio/ui` token sandbox with 48dp touch targets, reduced motion, interaction states, semantic statuses and money text rules.
- Huashu UI/UX critique evidence and Figma Phase 0 evidence board.
- OP-SQLite SQLCipher/FTS5/WAL Android spike in the live Expo development build.
- Phase 2 pure engine packages for domain, calendar, events, finance, plans and Melo policy.
- Phase 3 storage package for migrations, schema, driver abstraction, command bus, audit, projections, search, jobs, export, health and scale estimates.
- Phase 4 pure `@folio/first-minute` package for labelled preview, three-fact projection, privacy routes, first-launch paths and navigation metadata.
- Phase 4 Expo first-minute shell rendered in the Android development client.
- Phase 5 pure `@folio/import-engine` package for canonical import rows, CSV, OFX/QFX, QIF, provenance, duplicate detection, transfer matching, balance reconciliation, categorisation, search entries and bounded questions.
- Phase 5 `@folio/storage` import-commit command handler for atomic search/jobs/audit evidence.
- Phase 5 Expo import review shell rendered in the mobile app without file-picker or permission requests.
- Phase 6 pure `@folio/today-engine` package for briefing ranking, position summaries, timelines, transaction detail view models, internal calendar views, tasks/reminders, variance questions and accessible visual text.
- Phase 6 `@folio/search-engine` workspace-scoped local index/query contract with typed filters, deterministic natural-language parsing, privacy/archive controls, ranking and highlights.
- Phase 6 Expo Today shell rendered in the mobile app with synthetic-labelled briefing, position, timeline, transaction, calendar, task, notification-policy, variance, search and accessible-visual proof sections.
- Phase 7 expanded `@folio/melo-policy` package for bounded intents, deterministic briefing language, typed proposal lifecycle, tone modes, proactive ranking, bad-month mode, compact memory, correction learning, voice blockers, language-policy blocking and no-AI acceptance.
- Phase 7 Expo Melo shell rendered in the mobile app with synthetic-labelled state, briefing, intent, proposal, tone, intervention, bad-month, memory/correction and policy-gate proof sections.
- Phase 8 expanded `@folio/plan-engine` package for optional plan drafts, reversible rule edits, progress journeys, event cascade, recovery rebasing, budget remaining, momentum, controlled fun, retention preferences, rituals and emotional-safety review.
- Phase 8 Expo plans/recovery shell rendered in the mobile app with synthetic-labelled plan, rule, cascade, recovery, progress, budget, fun, ritual and policy-gate proof sections.
- Phase 9 `@folio/release-readiness` package for document library state, extraction review, privacy/data-centre routes, export surfaces, threat model, MASVS, DPIA, accessibility audit, diagnostics, reviewer vault, resilience drills and private-beta readiness.
- Phase 9 Expo release-readiness shell rendered in the mobile app with synthetic-labelled documents, extraction, privacy/export, diagnostics, reviewer vault, security blockers and coverage proof sections.
- Phase 10 `@folio/sync` package for optional-account/auth separation, key hierarchy, recovery, device registry, encrypted envelopes, inbox rejection, deterministic conflict policy, encrypted snapshots, compaction cursors, device/recovery manager state, account deletion, cloud inventory, multi-device drill status, security review and beta gate.
- Phase 10 Expo cloud/sync shell rendered in the mobile app with synthetic-labelled account, recovery, envelope, deletion, inventory, security blocker, Huashu and coverage proof sections.
- Phase 11 `@folio/ai-contracts` package for optional-AI task schemas, typed output validation, provider registry, gateway, minimal context, route selection, quota/cost, model evaluation, Melo integration, consent and strict beta gate.
- Phase 11 Expo optional-AI shell rendered in the mobile app with synthetic-labelled AI-off, registry, gateway, redacted context, route ladder, quota, evaluation, Melo, consent, Huashu, blocker and coverage proof sections.
- Phase 12 `@folio/open-banking` package for provider-neutral Open Banking selection, contract, consent, dashboard, canonical staging, reconciliation, stale/gap, revocation and rollout gates.
- Phase 12 Expo Open Banking shell rendered in the mobile app with synthetic-labelled provider, consent, staging, stale/revoke, Huashu, blocker and coverage proof sections.
- Phase 13 `@folio/business-workspace` package for optional business workspace, clients, invoices, payment matching, receipts, tax period, reserve estimate, business calendar, Melo context, reports, exports, mileage, tax/legal review, isolation and beta gates.
- Phase 13 Expo business workspace shell rendered in the mobile app with synthetic-labelled workspace, ledger, invoice, tax prep, export, Huashu, blocker and coverage proof sections.
- Phase 14 `@folio/store-release` package for store declarations, capability entitlements, billing lapse safety, operations runbooks, final review, regression, limited launch, outcome research and roadmap guardrails.
- Phase 14 Expo store/billing/operations/release shell rendered in the mobile app with synthetic-labelled store, billing, operations, launch, Huashu, blocker and coverage proof sections.
- Phase 15 Android local-use hardening in `apps/mobile`: SecureStore-backed SQLCipher key,
  app-lock overlay, system document picker, staged file metadata, review-gated file import, honest
  blocked PDF/OCR copy and SVG route rendering.
- Phase 15 Data Control in `apps/mobile`: local record search, sanitized JSON export written through
  native file storage and armed two-step device clear.
- Calendar planner hardening in `apps/mobile`: a selected-day commitment form creates a dated
  protected local record and immediately updates route math, agenda rows, search/export/source data
  and the graph.
- Melo local-evidence hardening in `apps/mobile`: deterministic local answers now show the exact
  route records, import rows, drafts or transactions checked, including direct saved-record lookups.
- Public release blocker gate in `@folio/release-gate`, `tooling/config/release-blockers.json`
  and `tooling/scripts/check-release-blockers.mjs`.
- Release operations pack in `docs/release-operations`, `tooling/config/operations-readiness.json`
  and `tooling/scripts/check-operations-readiness.mjs`.
- Store declaration pack in `docs/release-store`, `tooling/config/store-declarations.json` and
  `tooling/scripts/check-store-declarations.mjs`.
- Figma Phase 1-4 execution evidence frames.
- Figma Phase 5 import/review/indexing evidence frame.
- Figma Phase 6 today/timeline/calendar/transactions evidence frame.
- Figma Phase 7 Melo deterministic system evidence frame.
- Figma Phase 8 plans/progress/fun/recovery evidence frame.
- Figma Phase 9 security/export/local-launch evidence frame.
- Figma Phase 10 cloud account/encrypted backup/sync evidence frame.
- Figma Phase 11 optional-AI evidence frame.
- Figma Phase 12 Open Banking evidence frame.
- Figma Phase 13 business workspace evidence frame.
- Figma Phase 14 store/billing/operations/release evidence frame.

## Current evidence

- `pnpm run ci`: passed, 202 files and 2,460 tests.
- `pnpm lint:boundaries`: passed.
- `pnpm check:v1-boundary`: passed; 620 V2 runtime/package files checked against 859
  unique V1 freeze hashes.
- `pnpm typecheck`: passed.
- `pnpm --filter @folio/mobile typecheck`: passed.
- `pnpm test`: passed, 203 files and 2,472 tests.
- `pnpm validate:contracts`: passed with 75 files, 15,858 lines, 70,565 words, 82 database
  tables, 192 tasks, 32 risks, 51 research sources, 18 forecast vectors, 15 import vectors and 14
  independently checked fixture cases.
- `pnpm --filter @folio/mobile doctor`: passed, 21/21 checks.
- `pnpm format:check`: passed.
- Fresh Android release route-surface captures:
  `docs/release-evidence/route-audit-2026-06-22-department-interactive-pass-final/`.
- Fresh quick-estimate route proof:
  `docs/release-evidence/route-audit-2026-06-22-quick-estimate-final/`; captures prove a clean
  first-minute entry, an empty quick-estimate state with no placeholder graph, and a graph/rows
  generated from typed values `1190`, `1840` and `875`.
- Fresh Data Control proof:
  `docs/release-evidence/route-audit-2026-06-22-data-control-final/`; captures prove local search
  results from current records, sanitized export preparation and visible armed-clear controls.
- Fresh Data Control clear proof:
  `docs/release-evidence/route-audit-2026-06-22-data-clear-final/`; captures prove the installed
  release APK clears a saved `Dentist` row, shows `0 saved rows, 1 route point`, and relaunches into
  an empty persisted route.
- Fresh Recovery save proof:
  `docs/release-evidence/route-audit-2026-06-22-recovery-save-final/`; captures prove a user-entered
  `Tyre` recovery spend previews `-25`, records locally from the installed release APK and persists
  after force-stop/relaunch.
- Fresh Calendar planner proof:
  `docs/release-evidence/route-audit-2026-06-22-calendar-planner-final/`; captures prove a selected
  day commitment preview, save and selected-day/agenda rows from the installed release APK.
- Fresh Melo local-evidence proof:
  `docs/release-evidence/route-audit-2026-06-22-melo-evidence-final/`; captures prove Melo's
  deterministic local answer now shows the exact local route records and direct `Dentist` commitment
  row it checked from the installed release APK.
- Fresh Melo direct-lookup proof:
  `docs/release-evidence/route-audit-2026-06-22-melo-lookup-final/`; captures prove a typed
  `Tyre` prompt now answers from the saved local record (`I found Tyre...`) and shows `1 direct
local record match`, `No cloud model or remote search used` and the checked `Tyre -£25` source row
  from the rebuilt release APK.
- Department audit: `docs/release-evidence/DEPARTMENT_AUDIT_2026-06-22.md`.
- Fresh route-truth proof:
  `docs/release-evidence/route-audit-2026-06-22-truth-pass/`; captures prove the final rebuilt APK
  is open on `emulator-5554`, the Today headline follows the full route risk, and the route chart no
  longer renders overlapping duplicate axis labels on one-point routes.
- Final Android local APK route-truth evidence: `fresh-first-minute-v2`,
  `user-statement-import-clean`, `money-empty-entry`, `money-disabled-buttons`,
  `more-product-copy-v2`, `Today`, `Source Sheet`, `Calendar`, `Calendar selected-day`, `Melo`,
  `Import Edit Sheet`, `Recovery` and saved-spend mutation captures were taken from installed
  release APKs in the final pass. The current proof scan found no fake/placeholder copy, old
  confidence percentages, old live/what-if labels, stale cloud/security copy, old undo/toggle
  promises, inactive dropdown affordance, hardcoded false weekday-payday copy, native-storage/native-
  save copy, not-implemented wording, raw digest/fingerprint copy, tester wording, stale recovery
  labels, stale `local rows` copy or private-example leakage in the current proof XML.
- Mutation and safeguard proof: local route surfaces update after a saved spend, while the current
  Money proof shows an empty manual entry by default and disabled save buttons until a tester enters
  a title plus valid amount.
- Final Android release APK/AAB build/install/launch proof: `gradlew.bat :app:assembleRelease
:app:bundleRelease -PreactNativeArchitectures=arm64-v8a,x86_64` passed; `adb install -r`,
  force-stop and a cold `am start -W` opened the rebuilt `com.folio.v2.greenfield` APK only on
  `emulator-5554` in 6,988 ms. The Galaxy S9 was not targeted by this candidate.
- Current final dual-ABI APK size: `109,030,815` bytes; SHA256
  `B746CF1CB0CAB30038F3EC1FB0A5F92B4006A515B0D144D8E7E4504687B81F20`.
- Current final dual-ABI AAB size: `76,956,279` bytes; SHA256
  `C2A7B68DB3D1967F05E08B51B87CB72BF77286B2A0981896C844F94F62E6884B`.
- Current final release JS bundle size: `7,920,492` bytes; SHA256
  `FDC4CB008F32A6CB0082B8B196B19A006DFCA883EB2DBC515A880409AECC15C7`.
- Release-built mapped typed-command proof: a user balance write committed exact AppState,
  canonical balance rows and a privacy-minimal `folio.balance.set_current.v1` audit row atomically,
  survived a cold start, and was then removed through the product's three-stage clear. See
  `docs/release-evidence/ANDROID_TYPED_COMMAND_BRIDGE_2026-07-16.md`.
- Canonical authority is now schema v8, generation-bound and fail-closed for all 44 durable fields
  in the 48-field AppState contract. This includes the ledger/container core, financial context,
  calendar/plans/income schedules, transaction intelligence, evidence/import metadata, timeline and
  review queues, entitlement/lens, AI/cache, Melo and tiny wins. The remaining four fields are
  deliberately transient navigation/reader staging state; no durable field is exact-envelope-only.
  Exact encrypted AppState remains the lossless recovery envelope. See
  `docs/release-evidence/ANDROID_CANONICAL_FULL_APPSTATE_AUTHORITY_2026-07-16.md`.
- `pnpm --filter @folio/mobile exec expo install --check`: passed.
- `pnpm check:operations-readiness`: validates the operations pack and reports the current
  operations state as blocked with 7/7 incident runbooks covered, safe support boundary and
  3 blockers for tabletop, rotation drills and vulnerability disclosure readiness.
- `pnpm operations:guard`: fails as expected while tabletop, rotation drills and vulnerability
  disclosure readiness remain open.
- `pnpm check:store-declarations`: validates the store declaration pack and reports the current
  store state as blocked with 7/7 declarations prepared, 0/7 store-console submissions,
  0/7 binary matches and 13 declaration blockers.
- `pnpm store:guard`: fails as expected while submitted-binary review, store-console declaration,
  privacy policy, processor, SDK inventory and declaration evidence remain open.
- `pnpm release:status`: validates the release blocker register and reports the current
  public-release state as blocked with 23 open blockers, 14 release-blocking blockers,
  6 beta-blocking blockers, 3 roadmap-blocking blockers, 23 current-evidence rows and
  0 missing current-evidence files.
- `pnpm release:guard`: fails as expected while the public-release flag is disabled and
  release-blocking items remain open.
- `pnpm --filter @folio/mobile exec expo prebuild --clean --no-install`: passed.
- `pnpm --filter @folio/mobile native:smoke:android`: passed with existing Metro on `8081`; Gradle build succeeded, APK installed and the development client opened on `CloseLedger_Phone`.
- Android live Phase 1 preview: `docs/release-evidence/android-live-preview-phase1.png`.
- Android UI tree: `docs/release-evidence/android-window.xml`; after the final reinstall it
  confirms the V2 package/host container while the screenshot carries the proof-row values.
- Phase 1 live proof values: SQLCipher `4.14.0 community`, wrong-key rejection, FTS5 `50000 rows; wal`, 100k query `70 ms`, total spike `28094 ms`.
- Final Android smoke after clean prebuild: `pnpm --filter @folio/mobile native:smoke:android`
  passed with Gradle `BUILD SUCCESSFUL in 2m 33s`.
- Phase 4 Android smoke after clean prebuild/reinstall: passed with explicit shell `JAVA_HOME` and `ANDROID_HOME`; Gradle `BUILD SUCCESSFUL in 2m 58s`, APK installed and dev-client URL opened.
- Phase 4 final Metro log: `docs/release-evidence/metro-phase4-live-preview-final.log`.
- Phase 4 Android final first viewport: `docs/release-evidence/android-live-preview-phase4-final.png`.
- Phase 4 Android final timeline proof: `docs/release-evidence/android-live-preview-phase4-final-scroll.png`.
- Phase 4 Android final Today/nav proof: `docs/release-evidence/android-live-preview-phase4-final-bottom.png`.
- Phase 4 Android final gate proof: `docs/release-evidence/android-live-preview-phase4-final-gates.png`.
- Phase 4 evidence record: `docs/release-evidence/C4-mobile-first-60-seconds.md`.
- Phase 5 Metro log: `docs/release-evidence/metro-phase5-live-preview.log`.
- Phase 5 Android first viewport: `docs/release-evidence/android-live-preview-phase5.png`.
- Phase 5 Android import shell: `docs/release-evidence/android-live-preview-phase5-gates.png`.
- Phase 5 Android import review rows: `docs/release-evidence/android-live-preview-phase5-review.png`.
- Phase 5 Android gate proof: `docs/release-evidence/android-live-preview-phase5-gate-proof-2.png`.
- Phase 5 Android native build/install smoke: `docs/release-evidence/android-phase5-native-smoke.log`,
  Gradle `BUILD SUCCESSFUL in 2m 53s`.
- Phase 5 post-smoke dev-client relaunch blocker: `docs/release-evidence/android-phase5-run-android-port8082.log`
  and `docs/release-evidence/android-live-preview-phase5-run-android-port8082.png` show the rebuilt
  APK opens a blank native surface instead of rendering the Metro bundle.
- Phase 5 evidence record: `docs/release-evidence/C5-import-review-indexing.md`.
- Phase 5 Figma evidence render: `docs/release-evidence/figma-phase5-evidence.png`.
- Phase 6 Metro live preview log: `docs/release-evidence/metro-phase6-live-preview-lan.log`.
- Phase 6 Android daily-loop heading preview: `docs/release-evidence/android-live-preview-phase6-heading.png`.
- Phase 6 Android transaction/calendar preview: `docs/release-evidence/android-live-preview-phase6-visible.png`.
- Phase 6 first localhost preview diagnostic: `docs/release-evidence/android-live-preview-phase6-devlauncher-error.png`.
- Phase 6 evidence record: `docs/release-evidence/C6-today-timeline-calendar-transactions.md`.
- Phase 6 Figma evidence render: `docs/release-evidence/figma-phase6-evidence.png`.
- Phase 7 Metro live preview log: `docs/release-evidence/metro-phase7-live-preview-lan.log`.
- Phase 7 Android Melo top preview: `docs/release-evidence/android-live-preview-phase7-top.png`.
- Phase 7 Android proposal/tone preview: `docs/release-evidence/android-live-preview-phase7-heading.png`.
- Phase 7 Android gate proof: `docs/release-evidence/android-live-preview-phase7-gate.png`.
- Phase 7 evidence record: `docs/release-evidence/C7-melo-deterministic-system.md`.
- Phase 7 Figma evidence render: `docs/release-evidence/figma-phase7-evidence.png`.
- Phase 8 Metro live preview log: `docs/release-evidence/metro-phase8-live-preview-lan.log`.
- Phase 8 Android top preview: `docs/release-evidence/android-live-preview-phase8-top.png`.
- Phase 8 Android plan/rule/cascade preview: `docs/release-evidence/android-live-preview-phase8-rebase.png`.
- Phase 8 Android progress/budget preview: `docs/release-evidence/android-live-preview-phase8-journey.png`.
- Phase 8 Android gate proof: `docs/release-evidence/android-live-preview-phase8-gate.png`.
- Phase 8 evidence record: `docs/release-evidence/C8-plans-progress-fun-recovery.md`.
- Phase 8 Figma evidence render: `docs/release-evidence/figma-phase8-evidence.png`.
- Phase 9 Metro live preview log: `docs/release-evidence/metro-phase9-live-preview-lan.log`.
- Phase 9 Android top preview: `docs/release-evidence/android-live-preview-phase9-top.png`.
- Phase 9 Android readiness preview: `docs/release-evidence/android-live-preview-phase9-readiness.png`.
- Phase 9 Android security/audit blocker preview: `docs/release-evidence/android-live-preview-phase9-security.png`.
- Phase 9 Android gate proof: `docs/release-evidence/android-live-preview-phase9-gate.png`.
- Phase 9 Android lower gate proof: `docs/release-evidence/android-live-preview-phase9-gate-bottom.png`.
- Phase 9 evidence record: `docs/release-evidence/C9-security-export-local-launch-readiness.md`.
- Phase 9 Figma evidence render: `docs/release-evidence/figma-phase9-evidence.png`.
- Phase 10 Metro live preview log: `docs/release-evidence/metro-phase10-live-preview-lan.log`.
- Phase 10 Android top preview: `docs/release-evidence/android-live-preview-phase10-top.png`.
- Phase 10 Android cloud/account preview: `docs/release-evidence/android-live-preview-phase10-cloud.png`.
- Phase 10 Android encrypted envelope preview: `docs/release-evidence/android-live-preview-phase10-sync.png`.
- Phase 10 Android gate proof: `docs/release-evidence/android-live-preview-phase10-gate.png`.
- Phase 10 Android lower gate proof: `docs/release-evidence/android-live-preview-phase10-gate-bottom.png`.
- Phase 10 evidence record: `docs/release-evidence/C10-cloud-account-encrypted-backup-sync.md`.
- Phase 10 Figma evidence render: `docs/release-evidence/figma-phase10-evidence.png`.
- Phase 11 focused checks: `pnpm --filter @folio/ai-contracts typecheck` passed;
  `pnpm --filter @folio/mobile typecheck` passed; focused Vitest passed with 2 files and 24 tests.
- Phase 11 Metro live preview log: `docs/release-evidence/metro-phase11-live-preview-lan.log`.
- Phase 11 Android top preview: `docs/release-evidence/android-live-preview-phase11-top.png`.
- Phase 11 Android AI-off/registry preview: `docs/release-evidence/android-live-preview-phase11-ai.png`.
- Phase 11 Android route/quota/evaluation preview: `docs/release-evidence/android-live-preview-phase11-routes.png`.
- Phase 11 Android Huashu/blocker preview: `docs/release-evidence/android-live-preview-phase11-blockers.png`.
- Phase 11 Android gate proof: `docs/release-evidence/android-live-preview-phase11-gate.png`.
- Phase 11 Android lower gate proof: `docs/release-evidence/android-live-preview-phase11-gate-bottom.png`.
- Phase 11 evidence record: `docs/release-evidence/C11-optional-ai.md`.
- Phase 11 Figma evidence render: `docs/release-evidence/figma-phase11-evidence.png`.
- Phase 12 focused checks: `pnpm --filter @folio/open-banking typecheck` passed;
  `pnpm --filter @folio/mobile typecheck` passed; focused Vitest passed with 2 files and 19 tests.
- Phase 12 Metro live preview log: `docs/release-evidence/metro-phase12-live-preview-lan.log`.
- Phase 12 Android Open Banking provider/consent preview:
  `docs/release-evidence/android-live-preview-phase12-open-banking.png`.
- Phase 12 Android consent/staging preview:
  `docs/release-evidence/android-live-preview-phase12-consent-staging.png`.
- Phase 12 Android stale/revocation preview:
  `docs/release-evidence/android-live-preview-phase12-stale-revocation.png`.
- Phase 12 Android blocker/Huashu preview:
  `docs/release-evidence/android-live-preview-phase12-blockers.png`.
- Phase 12 Android gate proof: `docs/release-evidence/android-live-preview-phase12-gate.png`.
- Phase 12 Android lower coverage proof:
  `docs/release-evidence/android-live-preview-phase12-gate-bottom.png`.
- Phase 12 evidence record: `docs/release-evidence/C12-open-banking.md`.
- Phase 12 Figma evidence render: `docs/release-evidence/figma-phase12-evidence.png`.
- Phase 13 focused checks: `pnpm --filter @folio/business-workspace typecheck` passed;
  `pnpm --filter @folio/mobile typecheck` passed; focused Vitest passed with 2 files and
  22 tests.
- Phase 13 Metro live preview logs: `docs/release-evidence/metro-phase13-live-preview-lan.log`
  and `docs/release-evidence/metro-phase13-live-preview-devclient-8082.log`.
- Phase 13 Metro rerun log after payment-summary spacing fix:
  `docs/release-evidence/metro-phase13-live-preview-devclient-8082-rerun.log`.
- Phase 13 Android business/workspace preview:
  `docs/release-evidence/android-live-preview-phase13-business.png`.
- Phase 13 Android invoice/payment preview:
  `docs/release-evidence/android-live-preview-phase13-invoices-tax.png`.
- Phase 13 Android receipt/tax preview:
  `docs/release-evidence/android-live-preview-phase13-receipts-tax.png`.
- Phase 13 Android export/calendar/Melo preview:
  `docs/release-evidence/android-live-preview-phase13-tax-prep.png`.
- Phase 13 Android isolation/Huashu preview:
  `docs/release-evidence/android-live-preview-phase13-export-isolation.png`.
- Phase 13 Android blocker/coverage preview:
  `docs/release-evidence/android-live-preview-phase13-blockers.png`.
- Phase 13 Android gate start proof:
  `docs/release-evidence/android-live-preview-phase13-gate-start.png`.
- Phase 13 Android gate top proof:
  `docs/release-evidence/android-live-preview-phase13-gate-top.png`.
- Phase 13 Android middle gate proof: `docs/release-evidence/android-live-preview-phase13-gate.png`.
- Phase 13 Android lower gate proof:
  `docs/release-evidence/android-live-preview-phase13-gate-bottom.png`.
- Phase 13 evidence record: `docs/release-evidence/C13-business-workspace.md`.
- Phase 13 Figma evidence render: `docs/release-evidence/figma-phase13-evidence.png`.
- Phase 14 focused checks: `pnpm --filter @folio/store-release typecheck` passed;
  `pnpm --filter @folio/mobile typecheck` passed; focused Vitest passed with 2 files and
  20 tests.
- Phase 14 Metro live preview log: `docs/release-evidence/metro-phase14-live-preview-lan.log`.
- Phase 14 Android store/declaration preview:
  `docs/release-evidence/android-live-preview-phase14-store.png`.
- Phase 14 Android billing/entitlement preview:
  `docs/release-evidence/android-live-preview-phase14-billing.png`.
- Phase 14 Android operations/final-review preview:
  `docs/release-evidence/android-live-preview-phase14-operations.png`.
- Phase 14 Android limited-launch/research/roadmap preview:
  `docs/release-evidence/android-live-preview-phase14-release.png`.
- Phase 14 Android Huashu/blocker preview:
  `docs/release-evidence/android-live-preview-phase14-blockers.png`.
- Phase 14 Android gate start proof:
  `docs/release-evidence/android-live-preview-phase14-gate-start.png`.
- Phase 14 Android middle gate proof:
  `docs/release-evidence/android-live-preview-phase14-gate.png`.
- Phase 14 Android lower gate proof:
  `docs/release-evidence/android-live-preview-phase14-gate-bottom.png`.
- Phase 14 evidence record: `docs/release-evidence/C14-store-billing-operations-release.md`.
- Phase 14 Figma evidence render: `docs/release-evidence/figma-phase14-evidence.png`.
- Figma Phase 14 evidence file:
  `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=21-2`.
- Phase 13 PNG evidence decode check: passed; Figma render is `1260x1688`, Android captures
  are `1080x2400`.
- Phase 14 PNG evidence decode check: passed; Figma render is `1260x1688`, Android captures
  are `1080x2400`.
- Phase 15 focused checks: `pnpm --filter @folio/mobile typecheck` passed; focused Vitest passed
  with 2 files and 18 tests.
- Phase 15 final Android release build: `:app:assembleRelease` passed; current APK size is
  `69,327,847` bytes and current release JS bundle size is `3,410,324` bytes.
- Phase 15 final APK launch: `docs/release-evidence/c15-final-apk-launch-rendered.png` and
  `.xml`.
- Phase 15 SVG route proof: `docs/release-evidence/c15-after-show.xml` and
  `docs/release-evidence/c15-route-moved.png`.
- Phase 15 security/app-lock proof: `docs/release-evidence/c15-more.png` and
  `docs/release-evidence/c15-after-picker-relaunch.png`.
- Phase 15 Android picker proof: `docs/release-evidence/c15-document-picker-2.png` and
  `docs/release-evidence/c15-picker-downloads-verified.png`.
- Phase 15 file staging proof: `docs/release-evidence/c15-import-file-staged.png` and
  `.xml`.
- Phase 15 review-gated file commit proof: `docs/release-evidence/c15-import-after-confirm.png`
  and `.xml`.
- Phase 15 evidence record: `docs/release-evidence/C15-android-local-use-hardening.md`.
- Phase 15 hardcoded dev-key scan: source and final release bundle contain no
  `folio-v2-local-ledger-dev-build-key`, `legacyDevEncryptionKey` or `rekeyLegacyDatabase`.
- Phase 15 final launch logcat scan: no fatal React/runtime markers found.
- Non-ASCII scan of 21 touched text files: passed, no matches.

## Open risks

- iOS install/launch evidence remains blocked by macOS/signing availability.
- V1 freeze uses `C:\dev\apps\close-ledger-frontend` as the approved V1 reference candidate, but that source is not a Git worktree.
- Phase 1 native database choice is accepted for Android and blocked for iOS until macOS/EAS evidence exists.
- Full Keychain/Keystore and Argon2id recovery proof, iOS encrypted-document/OCR parity, local
  notifications and independent TalkBack/VoiceOver evidence remain blockers before broad vault,
  import and release claims. Android encrypted source retention and local OCR are separately
  device-proven.
- Phase 4 T061 vault creation and T062 vault unlock/app lock remain blocked by native key wrapping and recovery proof.
- Phase 4 T070 remains blocked until debt-focused and financially avoidant participant sessions are run and documented.
- Phase 5 T071 Android system-picker staging and encrypted source retention are implemented;
  supported-format/device coverage and iOS parity remain open.
- Phase 5 T076 Android PDF/image local OCR and capture paths are implemented; the full
  bank-format, scan-quality, language, device and iOS matrices remain open.
- Phase 5 T083/T084 review-gated local file-import commit is implemented in the standalone APK;
  lossless Android state/root writes are SQLCipher-authoritative and all 44 durable AppState fields
  now mirror through first-class schema-v8 canonical records. Boot adoption is generation-bound and
  inverse-parity-gated. Mapped real user/system/import, review and Open Banking-history mutation
  paths emit transactionally verified privacy-minimal typed commands.
- Phase 5 T085/T086 real-data briefing and full endurance gate remain blocked by native/vault and participant evidence.
- Phase 6 T090 transaction corrections now persist in the canonical transaction-intelligence
  record with typed semantic receipts; real-device interaction and broader correction-workflow
  usability evidence remain open.
- Phase 6 T093 local notifications remain blocked until native scheduling, quiet hours and lock-screen privacy are proven.
- Phase 6 T096 external calendar handoff remains disabled until explicit opt-in and native calendar evidence exist.
- Phase 6 T098 now has a release-built SQLCipher-authoritative Android airplane-mode
  write/cold-start/remove/undo/wipe loop with real UI-entered values and no fixture path. It remains
  blocked until the remaining import/endurance/restore matrix passes. All durable AppState fields
  now have a generation-bound canonical boot read candidate, and mapped mutations have typed-command
  and privacy-minimal audit coverage.
- Phase 7 T101 real proposal commit remains command-envelope-only until vault-backed command adapters exist.
- Phase 7 T107 voice-to-proposal remains blocked until native audio, transcript review and no-retained-audio evidence exist.
- Phase 7 T108 animation remains static reduced-motion shell evidence until native motion/accessibility verification exists.
- Phase 7 T109 legal/compliance review remains required before public regulated-boundary claims.
- Phase 8 plan and contribution writes now commit canonical plan rows with typed semantic receipts;
  complete real-data recovery E2E and usability evidence remain open.
- Phase 8 native payday, weekly and month-close rituals remain blocked until scheduling, quiet hours and lock-screen privacy are proven.
- Phase 8 native animation and manual reduced-motion accessibility recordings remain blocked.
- Phase 8 real-data recovery E2E remains blocked until vault-backed records can render without Metro or synthetic fixtures.
- Phase 9 T122 Android document-library acceptance is implemented and device-proven; iOS parity
  and independent cryptographic review remain open.
- Phase 9 app-lock and timeout proof remain blocked until Keychain/Keystore wrapping, biometric/PIN behavior and recovery routes are implemented and tested.
- Phase 9 T126/T127 remain blocked until independent threat-model/MASVS review closes high/critical findings.
- Phase 9 T128 remains blocked until DPIA and processor inventory are approved for local, cloud, AI, Open Banking and tax routes.
- Phase 9 T129 remains blocked until independent VoiceOver, TalkBack, large text, reduced-motion and cognitive accessibility audit passes.
- Phase 9 T132 now has a 47-case persistence recovery suite, injected ENOSPC coverage,
  release-built Android kernel-ENOSPC/manual-retry/cold-start, encrypted-PDF-source ENOSPC
  recovery, corrupted-main-to-verified-backup proof, Personal legacy-to-schema-v11 interrupted-
  migration recovery, a bounded airplane-mode write/remove/undo/wipe loop and a clean-sandbox
  portable-export restore. Release-built Android now also proves exact schema-v11 state/root
  migration into SQLCipher, SQL-only cold starts, native whole-database quarantine/rebuild and a
  race-free full local clear. The drills found and fixed retained onboarding name/payday after
  local clear, raw native exception leakage during source-retention ENOSPC, corrupt orphaned
  generations being misclassified as first run, good staged generations being ignored after main
  corruption, an unsafe databases-directory quarantine path and a writer/direct-commit lock race.
  The shipping save now atomically mirrors all durable AppState fields into verified schema-v8
  canonical SQL. Reads are bound to their exact generation and adopted only after inverse parity;
  mapped shipping mutations commit privacy-minimal typed-command receipts with exact readback. T132
  remains blocked until release-build staged/backup loss drills, kill-during-import, physical
  low-storage boundaries, real-format endurance, iOS and cloud/cross-device restore pass.
- Phase 9 T133 private beta remains blocked until the release blockers above, beta operations and user-research signoff close.
- Phase 10 T134 remains blocked until passkey, Apple and Google account providers and the external web deletion route are wired and tested.
- Phase 10 T135 remains blocked until Keychain/Keystore wrapping, recovery wrapping, KDF parameters and qualified cryptographic review are complete.
- Phase 10 T136 remains blocked until clean-device zero-knowledge restore succeeds without server plaintext.
- Phase 10 T137 remains blocked until cloud device registry, lost-device revoke and future sync-key rotation drills pass.
- Phase 10 T141 remains blocked until encrypted snapshot plus operation replay restore is exact on a clean device.
- Phase 10 T144 remains blocked until web account deletion, token/session revocation and cloud purge schedule are live and tested.
- Phase 10 T146 remains blocked until multi-device offline edit/delete/recovery/revoke scenarios pass without silent financial loss.
- Phase 10 T147 remains blocked until independent cloud vault/auth/sync pen-test closes every high/critical finding.
- Phase 10 T148 encrypted backup/sync beta remains blocked until T134-T147, support runbook, restore telemetry and staged opt-in rollout are ready.
- Phase 11 T150 remains blocked for live release until the server-side AI gateway is deployed, authenticated, rate-limited, redaction-enforcing and reviewed without provider keys or database credentials in the app.
- Phase 11 T152 remains blocked for live release until on-device model capability and fallback behavior are proven on supported iOS/Android devices.
- Phase 11 T153/T154 remain blocked for live release until provider/model procurement, data-use review, server-side key handling and route configuration are approved.
- Phase 11 T156 remains blocked for live release until model/prompt evaluation passes schema validity, faithfulness, advice-boundary, tone, workspace-leakage, prompt-injection and clarification-limit thresholds.
- Phase 11 T158 remains blocked for live release until cloud AI DPIA, processor inventory, store privacy declarations and task-level consent screens are approved.
- Phase 11 T159 strict AI beta remains blocked until evaluation, monitoring, rollback, support runbook, budget caps and no-core-degradation proof are ready.
- Phase 12 T160 remains blocked until regulated AISP provider selection, procurement decision,
  legal decision, store disclosures, coverage and security/processor review are approved.
- Phase 12 T161 remains blocked for live release until regulated provider sandbox and production
  contract suites pass.
- Phase 12 T162 remains contract-only until the backend token adapter is deployed, encrypted and
  security-reviewed without provider tokens in the app.
- Phase 12 T167 remains blocked until provider sandbox/production pilot acceptance and legal
  signoff pass.
- Phase 12 T168 staged Open Banking rollout remains blocked until legal/store review, support
  runbook, incident monitoring and manual/import fallback proof are ready.
- Phase 13 T176 business calendar native alerts remain modelled only until native scheduling,
  quiet hours and lock-screen privacy are proven.
- Phase 13 T180 tax/legal review remains blocked until UK tax/business claims, recordkeeping,
  MTD readiness, legal signoff and official guidance verification pass.
- Phase 13 T182 business beta remains blocked until tax/legal review, entitlement seam, support
  runbook, independent accessibility review and beta operations are ready.
- Phase 14 T183 now has a local store declaration pack and remains blocked until Apple/Google
  privacy, financial, accessibility, account deletion and SDK declarations are checked against the
  submitted binary and data flows.
- Phase 14 T184 remains blocked until StoreKit 2, Google Play Billing, backend receipt
  verification, purchase restore, offline grace and downgrade behavior are proven natively.
- Phase 14 T185 now has a local operations pack and remains blocked until tabletop, rotation drills
  and vulnerability disclosure readiness are actually completed.
- Phase 14 T186 remains blocked until final penetration, DPIA, processor, legal, privacy, security,
  accessibility and current store-policy review signoff pass with no high/critical findings open.
- Phase 14 T187 now has final-state CI, upload-signed dual-ABI Android APK/AAB validation,
  non-destructive emulator/physical-device navigation smoke, a bounded final-APK airplane-mode
  loop, clean-sandbox portable restore, kernel-ENOSPC state/PDF-import recovery and a release-built
  Personal legacy-to-schema-v11 interrupted-migration recovery. Lossless Android state/root
  SQLCipher authority, SQL-only cold start, whole-database quarantine/rebuild and complete local
  clear and the transactionally verified schema-v8 canonical AppState mirror are also release-built
  and emulator-proven. All 44 durable AppState fields now have generation-bound inverse-parity read
  authority, and mapped typed-command writes/privacy-minimal audit rows are release-built and
  emulator-proven. It remains blocked until the remaining import/restore/endurance matrix,
  production account-deletion E2E and iOS release/store builds pass every release-blocking criterion.
- Phase 14 T188 limited UK production launch remains blocked until billing, operations,
  monitoring, support, rollback and operational thresholds are stable.
- Phase 14 T190-T192 remain blocked roadmap programmes; household collaboration, direct HMRC MTD
  and additional jurisdictions require separate privacy, threat, legal and regulatory approval.
- Manual TalkBack, large text and reduced-motion checks remain required before release accessibility claims.

## Next exact step

No further implementation-backlog phase remains after Phase 15 local Android hardening. Use the
standalone APK as a local tester build, not a public release claim. Do not convert the local tester
APK into public release, native billing, account deletion, direct HMRC, household collaboration or
jurisdiction launch claims until the explicit release blockers above are closed with external
evidence. Use `pnpm release:status` to inspect the current blocker register and `pnpm release:guard`
in any public release workflow; `pnpm release:guard` is expected to fail until those blockers close.
