# Lovable → React Native port ledger

Status: **BATCH 1 COMPLETE — TODAY PORTED; EXPLICIT EVIDENCE GAPS RECORDED**

## Immutable batch pins

- `DESIGN_SOURCE_SHA=ad90b4fee36c58be156e145e8663d8c6be1bf0eb`
- `NATIVE_BASE_SHA=8cf2f9ba2656b6980cca1e58459521de71bb9967`
- `NATIVE_BRANCH=codex/melo-native-ux`
- `IMPLEMENTATION_BRANCH=codex/lovable-native-today-batch1-2026-08-24`
- `IMPLEMENTATION_WORKTREE=C:\dev\melo-native-today-batch1-2026-08-24`

The design source is immutable for this batch. Later Lovable commits are a
separate explicit delta. The dirty source worktree at `C:\dev\melo-native-ux`
must remain unchanged. Folio remains authoritative for product/domain logic,
state, persistence, navigation, privacy/security, and platform integrations.

## Acceptance evidence — 2026-08-24

- Native implementation checkpoint entering final acceptance:
  `47a074a992d55d020b6789e07ccce0bf3cdb286c` in the clean worktree above. The
  final correction/evidence commit is recorded below after it is created.
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
