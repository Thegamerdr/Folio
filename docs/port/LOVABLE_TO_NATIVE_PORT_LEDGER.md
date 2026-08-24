# Lovable → React Native port ledger

Status: **BATCH 3 COMPLETE — PERSONAL REVIEW, INTAKE, HISTORY, AND CONTROL SURFACES PORTED; EXPLICIT EVIDENCE GAPS RECORDED**

## Immutable batch pins

- `DESIGN_SOURCE_SHA=ad90b4fee36c58be156e145e8663d8c6be1bf0eb`
- `NATIVE_BASE_SHA=8cf2f9ba2656b6980cca1e58459521de71bb9967`
- `NATIVE_BRANCH=codex/melo-native-ux`
- `IMPLEMENTATION_BRANCH=codex/melo-native-port-2026-08-24`
- `IMPLEMENTATION_WORKTREE=C:\dev\melo-native-today-batch1-2026-08-24`

The design source is immutable for this batch. Later Lovable commits are a
separate explicit delta. The dirty source worktree at `C:\dev\melo-native-ux`
must remain unchanged. Folio remains authoritative for product/domain logic,
state, persistence, navigation, privacy/security, and platform integrations.

## Acceptance evidence — 2026-08-24

- Native implementation checkpoint entering final acceptance:
  `47a074a992d55d020b6789e07ccce0bf3cdb286c` in the clean worktree above. The
  final correction and complete evidence set are durable at
  `c97608e56841223fe430c56a1c13c9923c1ec365`.
- Build: `:app:assembleRelease --no-daemon -PreactNativeArchitectures=x86_64` with Android
  Studio JBR/local SDK and `SENTRY_DISABLE_AUTO_UPLOAD=true`; **BUILD SUCCESSFUL** (1m 29s).
  Final stable-mood/32dp APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`,
  95,034,768 bytes, SHA-256
  `79C5213AEEA705BDB5CA2570F313C8F3DB2B855C27D9782194BBE23974629BF7` (written
  `2026-08-24T17:37:45.7970365Z`). The x86_64 override is emulator evidence-build configuration
  only; the tracked production arm64 pin was not changed.
- Runtime: explicit `adb -s emulator-5554 install -r` and
  `am start -W -n com.folio.v2.greenfield/.MainActivity` both exited 0; the resumed activity was
  `com.folio.v2.greenfield/.MainActivity`. Logcat shows `libreactnative.so` loading from
  `lib/x86_64` and no app `FATAL EXCEPTION`.
- Standard evidence is on `emulator-5554` at override `1080x2160` / `420` dpi (physical
  `1080x2400`). The final stable-mood/32dp Light/Dark captures are
  [today-populated-final-standard-light.png](evidence/today-native-2026-08-24/today-populated-final-standard-light.png)
  and [today-populated-final-standard-dark.png](evidence/today-native-2026-08-24/today-populated-final-standard-dark.png),
  with matching UI dumps and logcats in the same directory. The populated header Melo is visibly
  present in both final captures. Small 360×640, tall 1080×2400, 1.3× font-scale, and absolute-bottom
  captures are retained under `apps/mobile/evidence/android-today-batch1/`.
- Header proof: the emulator status-bar inset is `[0,0][1080,63]`; the fixed UI dump places
  `24 August` at `[74,78][902,127]`, so the date no longer enters the system-bar region.
- Path proof: the fixed Light/Dark screenshots show separate Today and Payday endpoint nodes
  across the plot, a continuous non-chart path, and the tight-point callout without the previous
  one-day label collision. The focused geometry regression is
  `apps/mobile/src/folio/screens/today/todayPathGeometry.test.ts` (3/3 passing), including a regression
  proving a lower post-payday sample cannot become the plotted payday-horizon low point.
- Decision proof: tapping `Can I spend something?` opened the native afford-check sheet with
  `Before you spend`, `Can I afford this?`, amount input, and `Done` in
  [today-afford-check-standard-light.png](evidence/today-native-2026-08-24/today-afford-check-standard-light.png);
  the sheet was dismissed and the Today activity remained resumed. This evidence predates only the
  final header sprite stabilization; no decision-sheet source changed.
- State evidence: the native `+ log a spend` flow persisted `PressureTest £1,700` and then `QA2 £200`,
  proven by [today-pressured-balance100-bottom.xml](evidence/today-native-2026-08-24/today-pressured-balance100-bottom.xml)
  and [today-overspent-after-qa2-bottom.xml](evidence/today-native-2026-08-24/today-overspent-after-qa2-bottom.xml).
  The shared route intentionally excludes past logged transactions and reads the live bank/account
  balance, so those spends alone did not change the hero. A supported Account → Main balance correction
  to £100 produced a real pressured render in Light:
  [today-pressured-balance100-standard-light.png](evidence/today-native-2026-08-24/today-pressured-balance100-standard-light.png)
  and its UI dump/logcat. The same supported native route set the tall Dark lane to −£80. The final
  correction render
  [today-correction-£80-short-rerun.png](../../apps/mobile/evidence/android-today-batch1/tall-dark/today-correction-£80-short-rerun.png)
  shows `£0 spare · £80 short` and `Monday 24 · £80 short`; its UI dump/accessibility evidence announces
  today −£80, the payday-horizon low −£80, payday £2,940, and the overspent verdict. Final filtered logcat
  contains zero fatal/AndroidRuntime/ReactNativeJS/DSO matches.
- Side-by-side authority check was read-only against the pinned source
  `C:\dev\melo-design-source-ad90b4` at `ad90b4fe`; its `ScreenToday.tsx` and `MoneyPathChart.tsx`
  defines the same Today → tightest → payday journey, payday-bounded events, endpoint stations,
  and no generic chart framing. Native implements the continuous route, endpoint/low stations,
  callout, and scrub interaction; source movement markers/drop-lines are not claimed as parity.

The bounded acceptance covers safe Light/Dark, pressured Light, genuine negative/overspent Dark,
small/standard/tall composition, 1.3× text scale, absolute-bottom navigation clearance, the primary
decision sheet, and final cold launch. Dedicated low-confidence, Dark empty, and Dark interaction
variants remain explicit evidence gaps below; no implementation gap was found in their shared paths.

## Batch 1 surfaces

| surface/state                        | Lovable source SHA | native implementation               | visual parity                   | behaviour parity                                     | data authority                                | Light                          | Dark                           | native verification                                                                                                                      | status                                    | notes                                                                                                                                                                                   |
| ------------------------------------ | ------------------ | ----------------------------------- | ------------------------------- | ---------------------------------------------------- | --------------------------------------------- | ------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today-required visual foundation     | `ad90b4fe`         | `TodayScreen` + native kit          | PASS (representative)           | OPEN (render/launch only)                            | Existing native kit                           | PASS                           | PASS                           | Build/install/launch + fixed Light/Dark evidence                                                                                         | PASS WITH OPEN STATE COVERAGE             | Shared Today roles render on the emulator; full state matrix remains open.                                                                                                              |
| Today — confirmed / high confidence  | `ad90b4fe`         | `TodayScreen`                       | PASS (representative populated) | PASS (live route render)                             | Existing native finance/state authorities     | PASS                           | PASS                           | Fixed Light/Dark UI dumps and screenshots                                                                                                | PASS WITH OPEN STATE COVERAGE             | Real onboarding values render as `£1,800` and a payday answer; other confidence bands remain open.                                                                                      |
| Today — provisional / low confidence | `ad90b4fe`         | `TodayScreen`                       | PASS (shared implementation)    | PASS (native confidence authority)                   | Existing native confidence/evidence authority | PASS (honest framing observed) | PASS (honest framing observed) | Populated evidence only                                                                                                                  | PASS WITH DEDICATED RUNTIME EVIDENCE OPEN | `about`, source, and confidence framing are implemented; a dedicated low-confidence fixture was not exercised.                                                                          |
| Today — safe                         | `ad90b4fe`         | `TodayScreen`                       | PASS                            | PASS (representative)                                | Existing native safe-range authority          | PASS                           | PASS                           | Fixed Light/Dark evidence                                                                                                                | PASS WITH OPEN STATE COVERAGE             | `getting through`, positive path, and `You make it to payday.` verified.                                                                                                                |
| Today — pressured                    | `ad90b4fe`         | `TodayScreen`                       | PASS (Light representative)     | PASS (live route after supported account correction) | Existing native account/route authority       | PASS                           | NOT SEPARATELY EXERCISED       | `today-pressured-balance100-standard-light.png/xml/logcat` shows `The middle of next week is the squeeze.`, `£100`, and a separated path | PASS                                      | Native spend rows persist, while the route correctly reads the live account balance rather than re-counting past logged spends.                                                         |
| Today — overspent / negative         | `ad90b4fe`         | `TodayScreen`                       | PASS                            | PASS (live native −£80 state)                        | Existing native money-path authority          | NOT SEPARATELY EXERCISED       | PASS                           | Final tall Dark screenshot, UI dump, node/accessibility evidence, and clean logcat                                                       | PASS                                      | The spendable figure remains truthfully floored at £0 while the signed deficit is explicit as `£80 short`; path callout and accessibility retain the negative amount.                   |
| Today — sample/demo truth            | `ad90b4fe`         | `TodayScreen`                       | PASS (empty + populated truth)  | PASS (state persisted)                               | Existing native sample-mode authority         | PASS                           | OPEN                           | `today-empty.png/xml` plus populated evidence                                                                                            | PASS WITH OPEN DARK EMPTY STATE           | Empty state labels the doorway; populated state identifies user-entered/close-guess data.                                                                                               |
| Today hero                           | `ad90b4fe`         | `TodayScreen`                       | PASS                            | PASS (live route/decision sheet)                     | Native finance authority                      | PASS                           | PASS                           | Fixed Light/Dark + afford-check sheet                                                                                                    | PASS WITH OPEN STATE COVERAGE             | Qualifier, `£1,800`, spare unit, lowest-point source, and action hierarchy are visible.                                                                                                 |
| Today decision/action                | `ad90b4fe`         | `TodayScreen`                       | PASS                            | PASS (primary afford-check opened and dismissed)     | Native decision/navigation authority          | PASS                           | OPEN                           | `today-afford-check-standard-light.png/xml/logcat`                                                                                       | PASS WITH OPEN DARK INTERACTION           | Primary money decision opens the native sheet; dark interaction not separately exercised.                                                                                               |
| Today → Tightest → Payday path       | `ad90b4fe`         | `TodayScreen` + `todayPathGeometry` | PASS (native composition)       | PASS (scrub surface mounted; endpoint path verified) | Native money-path calculations                | PASS                           | PASS                           | Fixed standard Light/Dark screenshots + 3 geometry tests + negative accessibility evidence                                               | PASS WITH RECORDED SOURCE DELTA           | Payday-bounded plotting removes the one-day collision; no generic chart framing or card wall. Lovable movement markers/drop-lines and station money labels are not individually ported. |
| Today Melo / first-run primer        | `ad90b4fe`         | `TodayScreen` + native Melo         | PASS                            | OPEN (primer interaction not advanced)               | Canonical native Melo/lifecycle               | PASS                           | PASS                           | Fixed standard Light/Dark screenshots and dumps                                                                                          | PASS WITH OPEN INTERACTION                | Primer follows the decision, has contextual copy, and clears the bottom nav.                                                                                                            |

## Non-droppable owner findings

| ID             | Today acceptance finding                                                 | Status                             | Evidence / resolution                                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TODAY-OWNER-01 | Mode copy must not clip or compress the header.                          | PASS (standard)                    | Final Light/Dark UI dumps place `24 August` at `[74,78][902,127]`, below the `[0,0][1080,63]` status bar.                                                                                                    |
| TODAY-OWNER-02 | Weather/state glyph must not crop.                                       | PASS (standard)                    | Final Light/Dark captures show the state/weather control fully within its bounds.                                                                                                                            |
| TODAY-OWNER-03 | Light must feel as premium as Dark.                                      | PASS (standard)                    | Final Light/Dark populated captures show equivalent hierarchy and intentional tonal mapping.                                                                                                                 |
| TODAY-OWNER-04 | Dotted/prototype-link treatment must not return.                         | PASS (standard)                    | Final path uses a continuous route and meaningful stations, with no prototype link or generic grid.                                                                                                          |
| TODAY-OWNER-05 | Terracotta must not be sprayed across every interaction.                 | PASS (standard)                    | Final captures confine terracotta to decision/path semantics and the active tab.                                                                                                                             |
| TODAY-OWNER-06 | Hero metric semantics must be coherent.                                  | PASS (safe + pressured + negative) | Safe `£1,800`, pressured `£100`, and negative `£0 spare · £80 short` renders retain qualifier, unit, source, and signed-shortfall truth.                                                                     |
| TODAY-OWNER-07 | Pending review must not steal the hero unnecessarily.                    | PASS (standard)                    | Pending-review/nudge content remains below the financial answer and path.                                                                                                                                    |
| TODAY-OWNER-08 | Melo must not float decoratively.                                        | PASS (standard)                    | Final primer follows the decision/action area and carries contextual copy.                                                                                                                                   |
| TODAY-OWNER-09 | Melo must not overlap navigation.                                        | PASS (standard)                    | Primer ends at y≈1185 while bottom tab labels begin at y≈2043 on the 1080x2160 evidence device.                                                                                                              |
| TODAY-OWNER-10 | Signature path must not become a generic bar chart.                      | PASS (standard)                    | Final Light/Dark path is continuous, endpoint-labelled, and free of axes/grid/card-wall framing.                                                                                                             |
| TODAY-OWNER-11 | Financial answer must remain the first focal point.                      | PASS (standard)                    | Status/answer precede decision, primer, and path in the final populated captures.                                                                                                                            |
| TODAY-OWNER-12 | Responsive state changes must be intentionally composed, not merely fit. | PASS (bounded)                     | Small 360×640, standard 1080×2160, tall 1080×2400, 1.3× font-scale, and absolute-bottom captures are unclipped. At 1.3× the amount stays with its qualifier while the unit intentionally settles beneath it. |

## Explicit Batch 1 evidence gaps / source deltas

- A dedicated low-confidence fixture was not separately exercised; the shared native confidence/source
  implementation is present and representative provisional copy rendered in both themes.
- Dark empty state and the afford-check interaction in Dark were not separately repeated; their shared
  implementation passed in Light and Dark populated rendering passed.
- Lovable movement-event drop-lines and station money labels are not individually reproduced on the native
  path. Native retains the signature continuous journey, today/low/payday stations, signed low callout,
  scrub preview/commit, and day-by-day Calendar doorway without introducing a replacement chart engine.

## Batch boundary

Plan, Calendar, Pots, Subscriptions, Debts, What If, Recovery, Shortfall,
Review, Intake, More/settings, and Business surfaces are excluded except for a
strictly necessary shared primitive change required for Today to compile.

## Batch 2 acceptance evidence — 2026-08-24

- Durability: the accepted Batch 1 chain begins this batch at
  `7476594e8a34f9e39808cae7084af42d3b8b5c19`. Planning and commitment surfaces are durable at
  `b8920e09708a2ecc74efcba33ffed2e15a3089b0`; recovery and insight surfaces are durable at
  `22f581ef394b88423ea37b05de7856f84ddebf7c`. All are on
  `origin/codex/melo-native-port-2026-08-24`; the final visual/evidence checkpoint follows them
  without rebasing or squashing Batch 1.
- Build: `:app:assembleRelease --no-daemon -PreactNativeArchitectures=x86_64` with Android Studio
  JBR/local SDK and `SENTRY_DISABLE_AUTO_UPLOAD=true`; **BUILD SUCCESSFUL**. Final evidence APK:
  `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`, 95,065,064 bytes, SHA-256
  `F320E73D4F733B64943505E511273B4EDAB909EDA8643AC6289C984C3D2AF8D9` (written
  `2026-08-24T18:13:01.5295497Z`). The x86_64 override remains emulator-only; tracked production
  architecture configuration was not changed.
- Runtime: `adb -s emulator-5554 install -r` succeeded, followed by a cold
  `am start -W -n com.folio.v2.greenfield/.MainActivity` in 2,507 ms. Android reported
  `topResumedActivity=com.folio.v2.greenfield/.MainActivity`; the focused app-fatal filter returned
  `APP_FATAL_MATCHES=0`. The supported account correction used to exercise pressure was restored;
  [restored-account.xml](../../evidence/batch2-native-2026-08-24/restored-account.xml) retains the
  Main balance at £100.00 and [restored-today.xml](../../evidence/batch2-native-2026-08-24/restored-today.xml)
  retains Survival / `getting through` / storm.
- Verification: `pnpm --filter @folio/mobile typecheck` passed. Focused Vitest coverage passed
  **99/99**: calendar events 25, store-route 22, money path 11, Melo calculations 11, recovery
  preview 2, commitment helpers 6, authored insight read 7, no-fabricated-content 3, and debt/store
  authority 12. `git diff --check` reported no whitespace errors (only the repository's CRLF notice).
- Visual sampling: representative 1080×2160 Plan, What If, and Recovery states passed in Light and
  Dark; Shortfall passed in a real negative Dark state; Pots passed in Light and Dark. Calendar,
  Subscriptions, Insights, and the integrated Debt lens were spot-checked in Light. Matching UI dumps
  sit beside each retained screenshot under `evidence/batch2-native-2026-08-24/`.

## Batch 2 surfaces

| surface       | source SHA | native implementation                                             | data authority                                                                                     | visual parity                     | behaviour parity                                                                   | Light                   | Dark                    | evidence                                                                       | status / exact gap                                                           |
| ------------- | ---------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------- | ----------------------- | ----------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Plan          | `ad90b4fe` | `PlansScreen`                                                     | `useRoute` + `deriveCalendarEvents`; native plans, pots, subscriptions, and debts                  | PASS (pressured representative)   | PASS for live route/timeline/navigation                                            | PASS                    | PASS                    | `plan-light-final.png/xml`, `plan-dark-final.png/xml`                          | PASS; no dedicated component-render test                                     |
| Calendar      | `ad90b4fe` | `CalendarScreen`                                                  | `deriveCalendarEvents`, historical transactions, `useRoute`, native nudge mutators                 | PASS (agenda representative)      | PASS for engine grouping/route anchors; interaction paths retained                 | PASS                    | NOT SEPARATELY CAPTURED | `calendar-light-final.png/xml`; 25 calendar tests                              | PASS WITH DARK EVIDENCE OPEN                                                 |
| Pots          | `ad90b4fe` | `PotsScreen` + `commitmentHelpers`                                | canonical `addToPot`, `borrowFromPot`, `repayToPot`, pot ledger, `routeFromStore` preview          | PASS (populated allocation state) | PASS for native ledger/preview authorities                                         | PASS                    | PASS                    | `pots-light.png/xml`, `pots-dark-system.png/xml`; 6 helper tests               | PASS; borrow/repay commit was not executed in acceptance data                |
| Subscriptions | `ad90b4fe` | `SubscriptionsScreen` + `commitmentHelpers`                       | native recurring rows, cadence/date anchor, pause state, hypothetical `routeFromStore` consequence | PASS (empty state)                | PASS for native route and store wiring; no fabricated usage insight                | PASS                    | NOT SEPARATELY CAPTURED | `subscriptions-light-final.png/xml`; helper + no-fabrication tests             | PASS WITH POPULATED/DARK VISUAL EVIDENCE OPEN                                |
| Debts         | `ad90b4fe` | `DebtCommitmentSurface` integrated in `TodayModeScreen` Debt lens | existing `debtEngine.summarise` / `totalInterest`, Debt store, live route tight point              | PASS (empty integrated state)     | PASS for existing engine/store authority                                           | PASS                    | NOT SEPARATELY CAPTURED | `debts-light-final.png/xml`; 12 focused debt/store tests                       | PASS WITH POPULATED/DARK VISUAL EVIDENCE OPEN                                |
| What If       | `ad90b4fe` | `WhatIfScreen`                                                    | `useRoute`, real trailing-28-day transactions, preview-local scenario state                        | PASS (pressured representative)   | PASS for live recalculation; no legacy £28/day fixture; route ends at payday       | PASS                    | PASS                    | `whatif-light-final.png/xml`, `whatif-dark-final.png/xml`                      | PASS; cadence/amount controls not exhaustively interaction-tested            |
| Recovery      | `ad90b4fe` | `RecoveryScreen` + `buildRecoveryRoutePreview`                    | pure `routeFromStore` candidate previews and existing preview-then-commit writes                   | PASS (negative representative)    | PASS for non-mutating ranked preview authority                                     | PASS                    | PASS                    | `recovery-light-final.png/xml`, `recovery-dark-final.png/xml`; 2 preview tests | PASS; final commit action intentionally not executed during evidence capture |
| Shortfall     | `ad90b4fe` | `ShortfallScreen`                                                 | `useRoute`, `deriveCalendarEvents`, canonical `borrowFromPot` commit                               | PASS (real −£80 state)            | PASS for live gap and preview-then-commit wiring                                   | NOT SEPARATELY CAPTURED | PASS                    | `shortfall-dark-final.png/xml`                                                 | PASS WITH LIGHT EVIDENCE OPEN; borrow commit not executed                    |
| Insights      | `ad90b4fe` | `InsightsScreen` + `buildInsightsRead`                            | native completed cycles, retrospect, subscriptions, transactions, and tiny wins                    | PASS (honest empty state)         | PASS for authored fact/pattern/interpretation logic without manufactured certainty | PASS                    | NOT SEPARATELY CAPTURED | `insights-light-final.png/xml`; 7 authored-read tests                          | PASS WITH POPULATED/DARK VISUAL EVIDENCE OPEN                                |

## Explicit Batch 2 evidence gaps

- No implementation defect was observed in the representative states above. Remaining gaps are
  bounded runtime-evidence gaps rather than substituted authorities: populated Subscriptions,
  populated Debts, and populated Insights were unavailable in the retained emulator data, so their
  populated visual compositions were not claimed as exercised.
- Calendar, Subscriptions, Debts, and Insights were not separately repeated in Dark; Shortfall was
  not separately repeated in Light. Both themes are exercised across each surface family, but those
  sibling state/theme combinations remain open.
- Destructive/financial commits were deliberately not used merely to manufacture screenshots:
  Recovery's final commit, Shortfall's borrow commit, and Pots' borrow/repay commit remain covered by
  their canonical write wiring and focused authorities, not by acceptance-data mutation.

## Batch 3 — Lane C personal control checkpoint (2026-08-24)

Source SHA: `ad90b4fee36c58be156e145e8663d8c6be1bf0eb`
Native start SHA: `d51a92ddd60270b80579939ac45a50b450fe0648`

| surface                           | native implementation                                     | authority preserved                                                                     | visual parity                                          | behaviour parity                                                                                 | Light/Dark evidence                                                  | status / exact gap                                                                             |
| --------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| More / personal control hub       | `MoreScreen`                                              | theme store, notification settings, OS accessibility, Account, Privacy, Melo            | PASS (shared Quiet Paper Luxury primitives)            | PASS for routing and live preference reads; notifications toggle requests permission only on tap | NOT CAPTURED IN THIS CHECKPOINT                                      | IMPLEMENTED; representative Light + Dark emulator captures remain open                         |
| Appearance                        | `MoreScreen` Appearance row                               | `useThemeMode` / `useIsDark`                                                            | PASS (existing native theme language)                  | PASS (explicit light ↔ dark toggle)                                                              | NOT CAPTURED IN THIS CHECKPOINT                                      | IMPLEMENTED; system-follow mode remains intentionally outside this binary row                  |
| Notifications / accessibility     | `MoreScreen` + `lib/notifySettings` + `lib/notifications` | local notification policy and device `AccessibilityInfo`                                | PASS (flat preference rows)                            | PASS for persisted reminders, lock-screen detail preference, and live reduced-motion report      | NOT CAPTURED IN THIS CHECKPOINT                                      | IMPLEMENTED; OS settings handoff and notification permission denial need device evidence       |
| Money sources / connections       | `AccountScreen` source rows + `BankConnectionSheet`       | account store, evidence vault, provider-isolated bank connection                        | PASS (source rows remain restrained and status-led)    | PASS for statement/manual/source evidence routing and native connection boundary                 | Existing source/account evidence; no new Light/Dark capture          | IMPLEMENTED; connected-provider runtime state not exercised here                               |
| Account / export-share controls   | `AccountScreen`                                           | lens/account state, native `Share.share`, Privacy export engine                         | PASS (account controls remain grouped, not duplicated) | PASS for one-off snapshot share and canonical full export route                                  | NOT CAPTURED IN THIS CHECKPOINT                                      | IMPLEMENTED; OS share-sheet success/cancel evidence remains open                               |
| Data & privacy / trust / security | `PrivacyScreen`                                           | `runExport`, restore pipeline, `clearLocalMeloData`, app-lock capability/authentication | PASS (live footprint plus quiet action list)           | PASS for live workspace footprint, export/restore, gated destructive clear, and app lock handoff | Existing Privacy Light/Dark evidence; footprint variant not captured | IMPLEMENTED; destructive clear and restore remain intentionally un-executed in visual sampling |
| AI & automation / Melo memory     | `MoreScreen` → native Review/Melo owners                  | statement-read allowance, Review confirmation pipeline, `deriveMeloMemory`              | PASS (status row, no decorative mascot)                | PASS for honest read/confirm explanation and canonical Melo memory route                         | NOT CAPTURED IN THIS CHECKPOINT                                      | IMPLEMENTED; read-threshold and memory populated visual evidence remain open                   |

Lane C verification: `copyLint`, `sourceVoiceLint`, `notifySettings`, `appLock`, and
`PrivacyScreen.cleanSlate` focused tests passed (35/35). The integrated mobile typecheck passes; the
temporary shared review-history union error present during the lane checkpoint was corrected before
final acceptance. No native destructive data was mutated for evidence.

## Batch 3 — Lane B intake / evidence checkpoint (2026-08-24)

Source SHA: `ad90b4fee36c58be156e145e8663d8c6be1bf0eb`
Native start SHA: `d51a92ddd60270b80579939ac45a50b450fe0648`

| surface                                      | native implementation                                       | authority preserved                                                                    | visual parity                                  | behaviour parity                                                                                                                     | Light/Dark evidence             | status / exact gap                                                                            |
| -------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------- |
| Statement/file doorway                       | `IntakeScreen` + native document/image pickers              | Expo document/photo/camera pickers, local OCR/text readers, evidence vault             | PASS by existing Quiet Paper Luxury primitives | PASS for cancel, permission, retained evidence, staged candidates, and review-only handoff                                           | NOT CAPTURED IN THIS CHECKPOINT | IMPLEMENTED; native picker and theme screenshots remain open                                  |
| PDF / image success                          | `PdfSuccessScreen`, `ImageSuccessScreen`                    | `readerCandidates`, closing-balance staging, evidence metadata, `BulkStatementLanding` | PASS by existing preview/card language         | PASS for waiting state, real candidate counts, source evidence, bulk/history or one-by-one review                                    | NOT CAPTURED IN THIS CHECKPOINT | IMPLEMENTED; populated Light/Dark runtime sampling remains open                               |
| Paste / CSV success                          | `PasteSuccessScreen`                                        | `parseSheet`, transient reader staging, review queue                                   | PASS by existing preview/card language         | PASS for clipboard/CSV staged handoff, source-preserving queueing, honest row-check notice, and staging clear                        | NOT CAPTURED IN THIS CHECKPOINT | IMPLEMENTED; direct native clipboard/CSV emulator evidence remains open                       |
| Unreadable / manual workbench                | `PdfFallbackScreen`, `ImageFallbackScreen`, `LogSpendSheet` | retained encrypted original and canonical manual transaction write                     | PASS by existing calm fallback language        | PASS for source viewing, retry, and manual entry without routing to a blank Review                                                   | NOT CAPTURED IN THIS CHECKPOINT | IMPLEMENTED; source-open and manual-save runtime evidence remains open                        |
| Candidate classification / source correction | `EditItemSheet`, `EditTxnSheet`, Review-owned queue         | candidate review-before-truth, transaction edit engine, evidence links                 | PASS by existing native sheet language         | PASS for income/bill/debt/transfer/refund labels, posted correction, duplicate proposal, ignore/link paths, and source attach/detach | NOT CAPTURED IN THIS CHECKPOINT | Existing native authorities preserved; row-tap-to-candidate-sheet remains a shell payload gap |

Lane B verification: mobile typecheck passed. Focused intake/evidence tests passed **74/74** (`importSheet`,
`documentVault`, `bulkLanding`, bulk wiring, fallback reason, and edit-save coverage). `git diff --check`
reported no whitespace errors (only the repository's CRLF notice). No destructive financial data was
mutated for evidence.

## Batch 3 — Lane A review, history, and decisions checkpoint (2026-08-24)

Source SHA: `ad90b4fee36c58be156e145e8663d8c6be1bf0eb`
Native start SHA: `d51a92ddd60270b80579939ac45a50b450fe0648`

| surface               | native implementation                                   | authority preserved                                                               | visual parity                             | behaviour parity                                                                            | Light/Dark evidence                         | status / exact gap                                                                     |
| --------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------- |
| Review hub            | `ReviewHubScreen` + `FolioShell` Review tab             | persisted `reviewQueue`, transactions, edits, timeline events, ignored signatures | PASS (calm three-lane Review hierarchy)   | PASS for separate proposal, confirmed-activity, and decision lanes                          | Light empty/populated/pending; Dark pending | PASS                                                                                   |
| Pending review detail | existing `ReviewScreen` reached through `review-item`   | candidate queue, evidence links, category learning, explicit add/ignore decisions | PASS (existing Review workbench retained) | PASS for editable merchant/amount/category, evidence open, add, and ignore                  | Dark populated detail                       | PASS; direct candidate-row payload into the separate `EditItemSheet` remains unclaimed |
| Confirmed activity    | `ReviewHubScreen` Activity lane + `buildReviewHistory`  | immutable native transactions and correction records                              | PASS                                      | PASS; base transaction rows remain `Added`, while later edits are separate correction rows  | Light populated                             | PASS                                                                                   |
| Decisions             | `ReviewHubScreen` Decisions lane + `buildReviewHistory` | ignored proposal signatures and correction history                                | PASS                                      | PASS for durable put-aside/correction history without converting proposals into money truth | Dark populated                              | PASS                                                                                   |
| Timeline              | existing `TimelineScreen` + shared timeline builders    | native transaction/edit/timeline authorities                                      | PASS                                      | PASS for newest-first added/changed history and source/category context                     | Light populated                             | PASS                                                                                   |

Lane A focused tests passed **22/22** (`reviewHistory` 3, `timelineEvents` 12,
`reviewCategoryLearning` 7). Integrated typecheck and the final Android build also pass.

## Batch 3 final acceptance evidence — 2026-08-24

- Durability: Batch 3 starts exactly at `d51a92ddd60270b80579939ac45a50b450fe0648` on
  `codex/melo-native-port-2026-08-24`. The independently reviewed implementation checkpoints are
  `8bfec1906d0ff5804f7c29266dd1916fdd0348c6` (review/history),
  `237fc324810e2c5bde2b3a3c9bd37001adb07a1a` (intake/evidence), and
  `44d733b59e1537da02acfdcd9df737244a6034bb` (personal control/trust), all pushed in order to the
  same remote branch. The final shared-sheet safe-area correction and this evidence ledger are in
  the following integration commit; no rewrite or replacement app was created.
- Build: `:app:assembleRelease --no-daemon -PreactNativeArchitectures=x86_64` with Android Studio
  JBR/local SDK and `SENTRY_DISABLE_AUTO_UPLOAD=true`; **BUILD SUCCESSFUL** after the final
  safe-area correction. APK:
  `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`, 95,080,184 bytes, SHA-256
  `CB38518169E9ABC1271ADE3FC75F1D3BB8AC8627EC3FD4E2B8F906105DB507E5` (written
  `2026-08-24T19:43:55.4154816+01:00`). The x86_64 override is emulator-only; tracked production
  architecture configuration was not changed.
- Runtime: `adb -s emulator-5554 install -r` succeeded, followed by a cold
  `am start -W -n com.folio.v2.greenfield/.MainActivity` in 2,853 ms. The app package remains
  `com.folio.v2.greenfield`. App-PID logcat contained no `FATAL EXCEPTION`, AndroidRuntime crash, or
  ReactNativeJS error; the retained platform messages were a debugger-agent notice and an Android
  IME frame-tracker timeout, not an app exception.
- Verification: `pnpm --filter @folio/mobile typecheck` passed after final integration.
  The focused Batch 3 suite passed **153/153** across 16 files: review/history/category learning,
  import parsing, evidence vault, bulk landing/wiring, fallback reason, transaction correction/save,
  copy/source-voice lint, notification settings, app lock, privacy clean-slate, and
  no-fabricated-content. `git diff --check` reported no whitespace errors (only the repository's
  CRLF notice).
- Real Android intake evidence uses the platform document picker and the retained one-row fixture
  [batch3-review-fixture.csv](../../evidence/batch3-native-2026-08-24/batch3-review-fixture.csv).
  The file first rendered as a proposal in
  [intake-review-light.png](../../evidence/batch3-native-2026-08-24/intake-review-light.png), then as
  pending Review in
  [review-pending-light.png](../../evidence/batch3-native-2026-08-24/review-pending-light.png), and
  was finally put aside through Review's supported decision action. It never entered confirmed
  money history.
- Representative visual evidence, each with a matching UI hierarchy dump, is retained under
  `evidence/batch3-native-2026-08-24/`: Review empty and populated Activity in Light
  (`review-light`, `review-activity-light`), pending Review in Light/Dark
  (`review-pending-light`, `review-pending-dark`), populated Review detail and Decisions in Dark
  (`review-detail-dark`, `review-decisions-dark`), Timeline in Light (`timeline-light`), intake
  doorway and staged read in Light (`intake-light`, `intake-review-light`), More and trust controls
  in Light/Dark (`more-light`, `more-lower-light`, `more-mid-dark`, `more-trust-dark`), and live
  Privacy footprint in Light/Dark (`privacy-light`, `privacy-dark`).
- The Android keyboard initially showed the manual fallback sheet against the status bar. The final
  shared `Sheet` primitive reserves `insets.top` in its keyboard avoider. The rebuilt release APK
  proves the corrected state in
  [manual-entry-dark-fixed.png](../../evidence/batch3-native-2026-08-24/manual-entry-dark-fixed.png)
  and the complete keyboard-dismissed composition in
  [manual-entry-dark.png](../../evidence/batch3-native-2026-08-24/manual-entry-dark.png).

## Batch 3 final surface status

| family                            | shipped native surfaces                                                                                                | authorities retained                                                                                                            | representative evidence                                                               | final status / exact gap                                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review / history / decisions      | Review hub, candidate detail, Activity, Decisions, Timeline                                                            | review queue, transactions, immutable edits, timeline events, evidence links, category memory                                   | populated, empty, pending, detail, decision, and timeline across Light/Dark           | PASS; the separate `EditItemSheet` is not directly opened by a candidate-row payload because Review detail already owns inline candidate correction      |
| Intake / evidence                 | native document/image doorway, CSV/TXT/paste handoff, PDF/image success and fallback paths, bulk landing, manual entry | Expo pickers, reader staging, evidence vault, import parser, review-before-truth queue, canonical manual transaction write      | real Android CSV picker, intake doorway, staged read, pending Review, manual fallback | PASS; unreadable PDF/image fallback and camera-permission denial were not separately captured on-device                                                  |
| More / account / preferences      | More hub, money sources, account controls, Appearance, Notifications, Accessibility                                    | native theme/reminder/accessibility/account stores and OS handoffs                                                              | More top/preferences/trust in Light/Dark                                              | PASS; notification permission denial/OS-settings handoff and connected-provider state were not exercised                                                 |
| Data / privacy / trust / security | live local footprint, export/restore/clear owners, app lock, AI-read boundary, Melo memory doorway                     | export engine, restore pipeline, clear-local authority, secure app-lock capability, review confirmation, Melo memory derivation | Privacy and trust controls in Light/Dark                                              | PASS; destructive clear/restore, OS share completion/cancel, and populated Melo-memory thresholds were intentionally not executed merely for screenshots |

## Explicit Batch 3 evidence gaps

- No iOS build or simulator claim is made in this batch. The source remains React Native and
  cross-platform, but the requested install/build/visual acceptance run is Android-only.
- Native camera permission denial, unreadable PDF/image fallbacks, notification permission denial,
  connected bank-provider state, and OS share completion/cancel were not separately exercised.
  Their existing native owners and routing are retained; no fabricated success state substitutes
  for those platform/runtime gaps.
- Destructive clear/restore and financial add/save actions were not used to manufacture evidence.
  The only new runtime fixture remained provisional and was put aside through Review, leaving the
  two existing confirmed transactions unchanged.
- Candidate correction is fully available inline in Review detail and posted corrections continue
  through `EditTxnSheet`; a distinct candidate-row-to-`EditItemSheet` payload path is not claimed.

## Batch 4 final acceptance evidence — 2026-08-24

- Durability: Batch 4 starts exactly at
  `c1bf333d64a6e1c241d2f6a0aa403af72979bbcd` on
  `codex/melo-native-port-2026-08-24`. The pushed implementation checkpoints are
  `8d790cf` (complete Melo companion), `e9c8b50` (complete native Business registry/surfaces),
  and `ba34760` (secondary-surface parity and registry closure). No accepted Batch 1–3 commit was
  rebased, squashed, or redesigned.
- Build: `:app:assembleRelease --no-daemon -PreactNativeArchitectures=x86_64` with Android Studio
  JBR/local SDK and `SENTRY_DISABLE_AUTO_UPLOAD=true`; **BUILD SUCCESSFUL** in 1m 29s. APK:
  `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`, 95,093,204 bytes, SHA-256
  `738307659D5DF099D2B31284E1D7FD88195FF745CD98E4C0D3E443BE8854A85B`. The x86_64
  override remains emulator-only; tracked production architecture configuration was not changed.
- Runtime: `adb -s emulator-5554 install -r` succeeded for the existing package
  `com.folio.v2.greenfield`. A force-stop plus launcher cold start resumed `.MainActivity`; the
  app-PID fatal filter returned `app_fatal_matches=0`. The retained emulator-only Business
  workspace was created through the shipping workspace flow and configured through the shipping
  entity form; no account, invoice, tax, or cash figure was fabricated for screenshots.
- Verification: `pnpm --filter @folio/mobile typecheck` passed. Focused Vitest coverage passed
  **32/32** across eight files: companion semantics, Melo reaction/rework, canonical state
  projections, Business registry/current-year invoicing, and Appearance/edit-ownership contracts.
  The coverage closure command compared the live unions with the coverage table exactly:
  52/52 screens and 27/27 sheets, with zero set differences. `git diff --check` passed (repository
  CRLF notices only).
- Visual sampling: retained 1080×2160 Android evidence under
  `evidence/batch4-native-2026-08-24/` covers Melo first-run introduction, dedicated Melo in Light
  and Dark, personal and Business context sheets, Business Today in Sole Trader and Limited
  Company states, Business Today in Light and Dark, runway, invoices, filings, Appearance, workspace
  onboarding, cold launch, and reduced-motion device settings/static rendering. Matching UI
  hierarchy dumps sit beside each screenshot.

## Batch 4 surface status

| family                       | shipped native surfaces                                                                                                                                                                          | native authority retained                                                                                                                 | representative evidence                                                                                                                                                | final status / exact gap                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Melo companion               | dedicated personal and Business Melo screens; canonical companion host; mood/presence; context action; quiet mode; safe auto/left/right position; memory; first-run introduction; reduced motion | existing canonical `Melo` sprite/atlas renderer, money/business-derived mood and action selectors, canonical companion runtime projection | `melo-screen-dark`, `melo-dedicated-light`, `melo-dedicated-dark`, `melo-context-dark`, `business-melo-dark`, `business-melo-context-dark`, `melo-reduced-motion-dark` | PASS; no second renderer or floating global overlay introduced                   |
| Business workspace and Today | workspace creation/switching; entity setup; dynamic Business Today; honest empty/cash state; Sole Trader and Limited Company variants                                                            | workspace partition, saved entity, accounts, invoices, recurring obligations, native tax/business engines                                 | `workspace-light`, `business-today-sole-light`, `business-today-ltd-light`, `business-today-ltd-dark`                                                                  | PASS; populated cash/invoice figures were not manufactured for evidence          |
| Business money movement      | 90-day runway, clients, invoices, recurring money out, VAT, deductions, insights                                                                                                                 | native account balances, dated invoices, obligation schedules, VAT boxes, deduction authorities                                           | `business-runway-sole-light`, `business-invoices-sole-light`                                                                                                           | PASS; visual evidence uses honest empty states, not screenshot-only calculations |
| Business tax and filing      | VAT, Corporation Tax, payroll, dividends, DLA, Companies House, filing hub and VAT/SA/CT/CS/accounts/payroll working copies                                                                      | native VAT/tax/payroll/dividend/DLA/filing engines and saved entity                                                                       | `business-filings-sole-light`; route registry tests                                                                                                                    | PASS; only the representative Sole Trader filing hub was separately captured     |
| Appearance                   | System, Light, Dark picker reached from More                                                                                                                                                     | existing `useThemeMode` persistence and `useColorScheme` resolution                                                                       | `appearance-dark`, Melo and Business Light/Dark samples                                                                                                                | PASS; System remains the same single authority and follows OS while selected     |
| Candidate correction         | Review detail owns provisional candidate correction; posted transaction correction remains in `EditTxnSheet`; redundant `edit-item` route removed from the active registry                       | review-before-truth queue, Review inline draft fields, canonical posted-transaction edit                                                  | source contract test plus 79-surface registry closure                                                                                                                  | PASS; one owner, no half-connected duplicate flow                                |
| Secondary shipping surfaces  | every active `ScreenId` and non-null `SheetId`, including intake success/fallback, search/detail, onboarding, day/detail, confirmation and auxiliary sheets                                      | existing screen/sheet owners and native persistence/permission/entitlement boundaries                                                     | `BATCH4_SHIPPING_SURFACE_COVERAGE.md`; exact registry comparison; `cold-launch`, `workspace-light`, `appearance-dark`                                                  | PASS; 79 ported, 0 unknown, 0 open in the active registry                        |

## Explicit Batch 4 gaps

- **Implementation gaps:** none known within the Batch 4 shipping registry. All 52 screens and 27
  sheets are classified and mapped to active native owners; no active surface is marked open.
- **Evidence gaps:** this Android batch does not claim an iOS build or simulator run. It also does
  not claim exhaustive runtime interaction across all 79 routes (reserved for final whole-app
  convergence), populated Business cash/invoice/tax fixtures, every filing working copy, or a live
  OS theme flip while System remained selected. The underlying native authorities and the System
  theme resolution path are covered by typecheck/focused contracts; no fabricated state substitutes
  for the missing runtime samples.
- The retained Android acceptance state ends in the added `Batch4Studio` Business workspace as a
  Limited Company and Dark appearance. Its financial records remain empty; existing Personal money
  records were not altered.

Shipping coverage artifact:
`docs/port/BATCH4_SHIPPING_SURFACE_COVERAGE.md` — **52 screens + 27 sheets = 79 active registered
surfaces; 79 ported, 0 intentionally native-only, 0 deprecated/not shipping in the active registry,
0 open.**

## Final whole-app native convergence — 2026-08-24

- Durability: this final convergence starts exactly at
  `5eaa4255117d8f8ef56eb210760c303947b16e10` on the existing
  `codex/melo-native-port-2026-08-24` branch. It extends the accepted app and package
  `com.folio.v2.greenfield`; no new app, replacement shell, or redesign was introduced.
- Registry: the executable registry contract proves all **52 ScreenId** values and all **27
  non-null SheetId** values have titles, dispatch ownership, render ownership or declared
  self-hosting, and exact shipping-artifact coverage. Final status: **79/79 PASS; 0 unknown; 0
  known unported**.
- Personal acceptance: populated pressure/recovery/spend what-if, Review/Activity/Decisions,
  Plan/Calendar/Pots, commitments, Privacy, and dedicated Melo journeys passed against the real
  Android runtime and native data authorities.
- Business acceptance: supported UI-created account/client/invoice/obligation/tax data drove
  Business Today, runway, invoices, Corporation Tax, CT600, and filings. Deterministic Sole Trader
  and Limited Company acceptance fixtures cover the wider tax/VAT/payroll/filing projections.
- Defects fixed: Personal and Business Melo screen-owned sheets now consume Android hardware Back
  before shell navigation. Business filing's pure working-copy builder no longer eagerly loads
  native print/share modules during Node tests; those modules still load at the device share
  boundary.
- Visual acceptance: representative populated Personal and Business screens passed without known
  clipping or hierarchy regressions. Small `720x1280`, standard `1080x2160`, tall `1080x2400`,
  Android 130% text scale, keyboard, and reduced-motion device states were exercised. First-run
  onboarding remained scrollable and completable on the small device.
- Appearance: explicit Light and Dark passed. While System remained selected, Android OS mode was
  changed light -> dark -> light and the app followed each change without changing the saved
  preference.
- Verification: mobile typecheck passed; the full suite passed **222 files / 2602 tests**; final
  focused acceptance passed **31/31**; product, constitution, samples, V1-boundary, dependency
  boundary, release-foundation, and formatting gates passed.
- Android: release `assembleRelease` completed successfully in 2m 28s. The 95,093,776-byte APK has
  SHA-256 `5128DC93AA7450A4BD89FB91E939DA08E783C09188FB01EF4048F3CECB3332F5`.
  Installation, cold launch on two emulators, warm task resume, critical paths, hardware Back, and
  log filtering passed; fatal/runtime matches: **0**.
- iOS: **PASS WITH EXTERNAL EVIDENCE GAP**. This Windows host cannot perform an iOS build,
  simulator run, or runtime smoke. No iOS runtime claim is made.
- External release status: operations tabletop/rotation/vulnerability-disclosure evidence and
  store-console/signed-binary/privacy/processor/SDK/security/accessibility/legal/billing/cloud
  account-deletion/iOS approvals remain **BLOCKED BY OWNER/ENVIRONMENT**. They do not represent
  defects in the native implementation accepted here.
- Final implementation status: **0 known implementation failures, 0 known fatal/runtime errors,
  0 unknown surfaces, 0 unported active surfaces**.

Final evidence index:
`evidence/final-native-convergence-2026-08-24/FINAL_TEST_SUMMARY.md`.
