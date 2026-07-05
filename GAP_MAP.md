# Folio RN Port Gap Map

Generated 2026-07-05. Compares Lovable design source
(`C:\dev\folio-melo\.claude\worktrees\design-main\src\components\folio\`) against the RN
shipping surface (`C:\dev\folio-v2-greenfield\.claude\worktrees\melo-mvp\apps\mobile\src\folio\`).

**Staleness signal:** Lovable folio/* commits are all dated 2026-07-05 ("Changes" — squashed
messages, still actively being designed). RN folio/* last real commits are 2026-07-01. RN is
~4 days behind the design source; treat every PORTED-OK verdict below as "structurally ported,
re-diff before trusting pixel/copy parity" rather than "verified current."

Method: read every Lovable screen/sheet's `@rn-screen` / `@rn-sheet` JSDoc header (rn-stack,
reads/writes, copy status) and cross-referenced against RN's `types.ts` (`ScreenId`/`SheetId`
unions) and `shell/FolioShell.tsx` routing table. Did not read full implementations.

---

## NAV — Lovable tab/route structure vs RN FolioShell

Lovable's nav vocabulary lives in `folio/types.ts` (web) + `folio/shell/TabBar.tsx` +
`folio/shell/HeroPhone.tsx` (phone-frame showcase router, not a real router — this is a design
gallery, not the shipped nav). The **real** nav contract RN ports is the `ScreenId`/`SheetId`
union already mirrored in `C:\dev\folio-v2-greenfield\.claude\worktrees\melo-mvp\apps\mobile\src\folio\types.ts`,
which the header comment states is a "faithful 1:1 port of the web design source... name-for-name."

Bottom tab bar (per Lovable `TabBar.tsx`): **Today | Pots | Subs | Melo (chat entry, not a
route) | More**. RN's `FolioShell.tsx` routing (`if (screen === ...)`) matches this: `today`,
`pots`, `subs`, `melo`, `more` all present and routed.

RN `ScreenId` union (26 values) vs Lovable screens directory (29 files, of which 27 are real
screens — `ScreenImageFallback`/`ScreenImageSuccess`/etc. count as screens; `today/` is a
subfolder of helper components, not a screen):

| Lovable screen | In RN `ScreenId`? |
|---|---|
| start, guided, intake, pdf-success, pdf-fallback, image-success, image-fallback, paste-success, visualizer, review, today, today-after, privacy, melo, more, timeline, calendar, plans, whatif, recovery, add-bill, add-debt, subs, pots, ritual, insights, shortfall | yes (26/26) |
| **account** (ScreenAccount → `AccountScreen`) | **NO — missing from `ScreenId` union and from `FolioShell.tsx` routing entirely** |
| **today-mode** (ScreenTodayMode → `TodayModeScreen`) | **NO — missing** |
| **today-stability** (ScreenTodayStability → `TodayStabilityScreen`) | **NO — missing** |

RN `SheetId` union (12 values) vs Lovable sheets directory (22 files, of which `Sheet.tsx` and
`SheetChartStyle.tsx`/`SheetLensPicker.tsx` are shell-level component primitives, not
screen-opened sheets — 20 real openable sheets):

| Lovable sheet | In RN `SheetId`? |
|---|---|
| route-detail, edit-txn, edit-item, melo-chat, share, onboarding, log-spend, sub-caught, add-event, calendar-export, calendar-connect | yes (11/11 — note RN spells `sub-caught` as `sub-caught`, matches) |
| **add-debt** (SheetAddDebt) | **NO — missing (RN instead routes add-debt as a full SCREEN via `add-debt` ScreenId + `AddEntryScreen kind="debt"`, not a sheet — see PORTED-OK note below, this is an intentional pattern difference, not a gap)** |
| **add-plan** (SheetAddPlan) | **NO — missing entirely (no Plans-add flow in RN sheets or PlansScreen per file list)** |
| **afford-check** (SheetAffordCheck) | **NO — missing entirely** |
| **day-detail** (SheetDayDetail) | **NO — missing (CalendarScreen has no day-detail sheet)** |
| **hidden-review** (SheetHiddenReview) | **NO — missing** |
| **household-setup** (SheetHouseholdSetup) | **NO — missing (Household lens not ported)** |
| **log-invoice** (SheetLogInvoice) | **NO — missing (Irregular Income lens not ported)** |
| **log-payment** (SheetLogPayment) | **NO — missing (debt-payment logging not ported)** |
| **safe-zone** (SheetSafeZone) | **NO — missing** |

---

## Screen-by-screen table

Batch numbers per the ordering requested: 1 tokens/shell, 2 Today+lenses, 3 calendar+timeline,
4 money screens (pots/subs/plans/debt), 5 melo+chat+paywall+account, 6 intake/import, 7
review+recovery+misc.

| Screen | RN path | Status | Reuse notes | Batch |
|---|---|---|---|---|
| Tokens / kit (`kit.tsx`, `Tokens.tsx`, `types.ts`, `copy-index.ts`) | `apps/mobile/src/folio/theme.ts`, `types.ts`, `copy/copy.ts` | PORTED-OK | Token names line up (`--paper --surface --hairline` etc mirrored in `theme.ts`); `copy/copyLint.test.ts` enforces the FROZEN-copy discipline the Lovable headers declare. Re-diff `theme.ts` against Lovable `Tokens.tsx` — Lovable's tokens file is untracked-empty header (blank docblock), check raw values match. | 1 |
| ScreenHeader / Sheet shell / TabBar | `shell/FolioShell.tsx` (inline), `ui/EmptyState.tsx`, `ui/UndoToast.tsx` | PORTED-OK (structural) | Lovable's `ScreenHeader.tsx` is a shared primitive (44px back target, grid layout spec) — verify RN has an equivalent shared header component rather than each screen rolling its own; not confirmed from file list alone (no `ScreenHeader.tsx`-equivalent visible under `folio/ui/` or `folio/shell/`). Flag for the batch-1 agent to check. | 1 |
| StartScreen | `screens/StartScreen.tsx` | PORTED-OK | — | 1 |
| GuidedCheckInScreen | `screens/GuidedCheckInScreen.tsx` | PORTED-OK | — | 1 |
| OnboardingSheet | `sheets/OnboardingSheet.tsx` (+ `onboardingComplete.test.ts`) | PORTED-OK | Tested. | 1 |
| TodayScreen | `screens/TodayScreen.tsx` + `screens/today/{format,pressure}.ts` + `today/{TodayNudges,TodayRecentTxns,TodaySpendStrip,TodayWeekTiles}.tsx` | PORTED-OK | Lovable explicitly calls out "Sub-components live in ./today/ — port each as its own RN component" — RN did this exactly (4 sub-components + 2 libs). Good sign of faithful port. Re-verify money-path SVG scrub-preview parity (Lovable's hero feature) since RN is 4 days stale vs an actively-edited hero screen. | 2 |
| TodayAfterScreen | `screens/TodayAfterScreen.tsx` | PORTED-OK | — | 2 |
| **TodayModeScreen** (10 parked lenses: growth/debt/irregular/household/planning/optimizer/reset/lowVis) | **none** | **MISSING** | Not in `ScreenId`, not in `FolioShell.tsx`. This is the multi-lens Today shell Lovable built as a single shared component (`ScreenTodayMode.tsx`) rendering a mode-specific hero. Biggest single scope item in the whole gap map — 8 lens personalities behind one screen. Depends on `SheetLensPicker` (also missing) and `deriveModeState`. | 2 |
| **TodayStabilityScreen** | **none** | **MISSING** | Sibling to Survival Today; anchors on Safe Zone + horizon strip. Needs `SheetSafeZone` (missing) to be meaningful. | 2 |
| **SheetLensPicker** (10-lens switcher) | **none** | **MISSING** | Gatekeeper for reaching TodayMode/TodayStability at all — without it those screens are unreachable even if built. Reads `lens.plusUnlocked/proUnlocked/trialCycleId`, writes `setMoneyMode`. | 2 |
| **SheetSafeZone** | **none** | **MISSING** | Decomposes the Safe Zone number; writes `bufferAmount`. | 2 |
| WhatIfScreen | `screens/WhatIfScreen.tsx` | PORTED-OK | — | 2 |
| ShortfallScreen | `screens/ShortfallScreen.tsx` | PORTED-OK | — | 2 (moved here logically but file exists; leave in review/recovery batch if preferred — see notes) | 7 |
| RecoveryScreen | `screens/RecoveryScreen.tsx` | PORTED-OK | — | 7 |
| CalendarScreen | `screens/CalendarScreen.tsx` | PORTED-OK | Lovable notes "Business calendar... Built in RN" as a `@rn-future` — confirm that's intentionally still out of scope, not a silent gap. | 3 |
| AddEventSheet | `sheets/AddEventSheet.tsx` | PORTED-OK | — | 3 |
| CalendarExportSheet | `sheets/CalendarExportSheet.tsx` | PORTED-OK | — | 3 |
| CalendarConnectSheet | `sheets/CalendarConnectSheet.tsx` | PORTED-OK | Lovable marks this `@rn-engine` (OAuth/sync ships in RN, web is design-only stub) — check RN sheet actually implements real Google push or is still a stub; if stub, that's expected per spec, not a gap. | 3 |
| **SheetDayDetail** | **none** | **MISSING** | Full-detail day drill-in from Month-cell tap / "+N" overflow chip / Week day header. CalendarScreen likely has an inline selected-day panel only, no full sheet. | 3 |
| TimelineScreen | `screens/TimelineScreen.tsx` | PORTED-OK | — | 3 |
| EditTxnSheet | `sheets/EditTxnSheet.tsx` (+ `editTxnSave.test.ts`, `lib/editTxn.ts`) | PORTED-OK | Tested; Lovable's audit-row / undo-snackbar behavior — confirm `lib/undoPolicy.ts` + `ui/useUndo.tsx` wire into this sheet specifically. | 3 |
| PotsScreen | `screens/PotsScreen.tsx` | PORTED-OK | — | 4 |
| SubscriptionsScreen | `screens/SubscriptionsScreen.tsx` | PORTED-OK | — | 4 |
| PlansScreen | `screens/PlansScreen.tsx` | PORTED-OK (screen exists) — but **add flow MISSING** | No `SheetAddPlan` sheet or equivalent in RN sheets list, so Plans is likely read-only in RN (view bills/renewals/debt drops but can't declare a new plan/target). | 4 |
| **SheetAddPlan** | **none** | **MISSING** | Declares a plan (name/£target/by-date/cadence) → feeds `plans[]`, read by Planning lens strategy + planEngine (which itself is gated behind the missing TodayMode work). | 4 |
| AddEntryScreen (bill) | `screens/AddEntryScreen.tsx` (`kind="bill"`) | PORTED-OK | Single reused form for bill+debt per Lovable's own design (`ScreenAddEntry.tsx` header says "Reused for both kinds"). RN mirrors this via a `kind` prop — good. | 4 |
| AddEntryScreen (debt) / SheetAddDebt | `screens/AddEntryScreen.tsx` (`kind="debt"`) + `lib/debt.ts` (+ test) | PORTED-OK (as a screen, not a sheet) | Lovable ships debt-add as a bottom SHEET (`SheetAddDebt`); RN ships it as a full SCREEN via the shared `AddEntryScreen`. Functionally covers the same need — flag as an intentional RN pattern deviation, not a blocking gap, but worth a design-parity note since Lovable's nav model treats it as a modal not a push. | 4 |
| **SheetLogPayment** (log payment against a debt) | **none** | **MISSING** | Debt lens has add-debt but no way to log a payment against it in RN sheets; `lib/debt.ts` may have the calc logic without the UI hookup — check. | 4 |
| **SheetHouseholdSetup** | **none** | **MISSING** | Household lens entirely unported (partner name, split, per-sub overrides). Depends on TodayMode/lens-picker work landing first. | 5 (lens-adjacent, but low priority — group with money screens batch 4 if picked up early, otherwise defer) |
| **SheetLogInvoice** (Irregular Income lens) | **none** | **MISSING** | Same story — Irregular Income lens unported. | 4 |
| MeloScreen | `screens/MeloScreen.tsx` + `melo/Melo.tsx` + `melo/MeloLine.tsx` | PORTED-OK | Strong reuse target: `src/melo/mascot/MeloPhoenix.tsx` + `mascot/fenice.tsx` + `mascot/assets/phoenix-*.png` (5 mood PNGs: celebrate/concern/hero/protect/think) + `mascot/wardrobe.tsx` are the exact "plumage reflects live vitality" system Lovable's header describes (`deriveMeloVitality`). Confirm `MeloScreen.tsx` actually imports from `melo/mascot/` rather than a separate/duplicate phoenix implementation — `folio/copy-index.ts`-era ScreenMelo.tsx in Lovable references its own `MeloPhoenix.tsx` (web SVG version) which is NOT the RN asset; RN should be using `melo/mascot/MeloPhoenix.tsx`, not reinventing. | 5 |
| MeloChatSheet | `sheets/MeloChatSheet.tsx` | PORTED-OK | Reuse: `melo/state/meloStore.tsx`, `melo/screens/MeloChat.tsx` — RN appears to have TWO chat surfaces (`folio/sheets/MeloChatSheet.tsx` sheet-hosted, and `melo/screens/MeloChat.tsx` standalone screen). Clarify which is canonical / whether `melo/screens/MeloChat.tsx` is legacy pre-Folio-port and should be retired to avoid two sources of truth for the "5 tool calls" chat contract Lovable's header specifies. | 5 |
| PaywallScreen | **none found under `folio/screens/`** | **MISSING** | Closest RN analog is `melo/screens/Premium.tsx` — but that's in the OLD `melo/` surface, not the `folio/` shipping surface. Needs a proper port into `folio/screens/PaywallScreen.tsx` following Lovable's 3-tier (Free/Plus/Pro) + `canShowUpsell` gating logic (never sell during storm/Recovery/negative Safe Zone/fog/Quiet Mode) — that gating logic is a real behavior spec, not just UI, so treat as a genuine build not a straight port. | 5 |
| **AccountScreen** | **none** | **MISSING** | Not in `ScreenId`, no file under `folio/screens/`. Simple read-only status screen (lens tier, connected sources, sign-in/restore/manage-plan levers) — low complexity, good candidate to pair with Paywall batch since both are "More > monetization/identity" surfaces. | 5 |
| MoreScreen | `screens/MoreScreen.tsx` | PORTED-OK | Confirm it links out to Account + Paywall once those exist — currently it can't, since both destinations are missing. | 5 |
| PrivacyScreen | `screens/PrivacyScreen.tsx` (+ `PrivacyScreen.cleanSlate.test.ts`) | PORTED-OK | Tested; copy-lint-checked per Lovable header — confirm RN's own copy-lint (`copy/copyLint.test.ts`) covers this screen's claims too. | 5 |
| IntakeScreen | `screens/IntakeScreen.tsx` | PORTED-OK | — | 6 |
| PdfSuccessScreen / PdfFallbackScreen | `screens/PdfSuccessScreen.tsx` / `PdfFallbackScreen.tsx` | PORTED-OK | — | 6 |
| ImageSuccessScreen / ImageFallbackScreen | `screens/ImageSuccessScreen.tsx` / `ImageFallbackScreen.tsx` | PORTED-OK | — | 6 |
| PasteSuccessScreen (sheet-visualizer / bring-my-sheet-across) | `screens/PasteSuccessScreen.tsx` + `screens/VisualizerScreen.tsx` (+ `VisualizerScreen.addAll.test.ts`) + `lib/importSheet.ts` (+ test) | PORTED-OK | Tested; `VisualizerScreen` in RN maps to Lovable's `visualizer` screen id referenced inside `ScreenPasteSuccess.tsx`'s stack (`Intake > Sheet visualizer > Things to check`) — confirms correct 1:1 route naming. | 6 |
| EditItemSheet | `sheets/EditItemSheet.tsx` | PORTED-OK | — | 6 |
| SubCaughtSheet | `sheets/SubCaughtSheet.tsx` (+ `caughtSubs.ts`/test) | PORTED-OK | Reuse: `lib/subSignals.ts` for the underlying detection signal RN's real engine supplies (Lovable's version is synthetic/prototype per its header — RN's is presumably real, worth confirming it's wired to `subSignals.ts` output not a hardcoded demo). | 6 |
| **SheetHiddenReview** | **none** | **MISSING** | Un-hide flow for ignored intake candidates. `ignoredReviewSigs`/`unhideReviewSig` store slice presence not confirmed from file list — check `store.ts` for these fields before building; may be store-ready but UI-missing. | 6 |
| ReviewScreen | `screens/ReviewScreen.tsx` (+ `lib/reviewDedupe.ts`/test, `lib/dedupe.ts`/test) | PORTED-OK | Strong — RN's dedupe engine (`dedupe.ts` + `reviewDedupe.ts`, both tested) implements exactly the "Link / Keep both / Ignore / Edit" de-dupe UX referenced in the memory index (`d22aca2` commit). This is ahead of or equal to Lovable's stub-comment ("synthetic candidate in prototype"). | 7 |
| PaydayRitualScreen | `screens/PaydayRitualScreen.tsx` (+ `lib/payday.ts`/test) | PORTED-OK | — | 7 |
| InsightsScreen | `screens/InsightsScreen.tsx` | PORTED-OK | Confirm mode-tinted framing (`getRetrospect`) ported — Lovable's is mode-aware across 8 lenses, most of which (TodayMode) are missing in RN, so InsightsScreen may currently only support the 1-2 shipped modes; re-scope its mode-awareness once TodayMode batch lands. | 7 |
| ShareSheet | `sheets/ShareSheet.tsx` | PORTED-OK | — | 7 |
| LogSpendSheet | `sheets/LogSpendSheet.tsx` | PORTED-OK | — | 7 |
| **SheetAffordCheck** ("Before You Spend") | **none** | **MISSING** | Standalone afford-check verdict UX with Shelf-it alternative. Depends on **SheetShelf** (24-Hour Shelf) also being present. | 7 |
| **SheetShelf** (24-Hour Shelf) | **none found** | **MISSING** | `shelf` store slice / `addShelfItem`/`resolveShelfItem` not confirmed present in RN `store.ts` — check before scoping; if store has no shelf slice this is a full-stack build not just a UI port. | 7 |

---

## Batches — final assignment (ordered, file-disjoint)

1. **Tokens / shell primitives** — verify `theme.ts` token parity vs Lovable `Tokens.tsx`;
   confirm/port a shared `ScreenHeader`-equivalent if missing. Low risk, unblocks nothing else
   but should run first so later batches inherit correct tokens.
2. **Today + lenses** — `TodayModeScreen`, `TodayStabilityScreen`, `SheetLensPicker`,
   `SheetSafeZone`. Largest scope item in the whole map (8 parked lens personalities). Re-verify
   `TodayScreen`'s money-path scrub-preview against the actively-changing Lovable source before
   calling it done.
3. **Calendar + timeline** — `SheetDayDetail` (missing), re-check `CalendarConnectSheet` stub
   status, re-verify `EditTxnSheet` undo/audit wiring.
4. **Money screens (pots/subs/plans/debt)** — `SheetAddPlan` (missing), `SheetLogPayment`
   (missing), `SheetLogInvoice` (missing, Irregular Income lens), confirm AddEntryScreen
   sheet-vs-screen deviation is intentional.
5. **Melo + chat + paywall + account** — `PaywallScreen` (missing, real build not just port —
   canShowUpsell gating logic), `AccountScreen` (missing, simple), resolve
   `MeloChatSheet`/`melo/screens/MeloChat.tsx` duplication, confirm `MeloScreen` uses
   `melo/mascot/MeloPhoenix.tsx` not a reinvented version.
6. **Intake / import** — `SheetHiddenReview` (missing); mostly PORTED-OK, lightest batch.
7. **Review + recovery + misc** — `SheetAffordCheck` (missing), `SheetShelf` (missing, check
   store slice first), `SheetHouseholdSetup` (missing, low priority, defer to after lens batch
   lands).

---

## Reuse map — melo/* assets confirmed available for the batches above

- `melo/mascot/MeloPhoenix.tsx`, `melo/mascot/fenice.tsx`, `melo/mascot/wardrobe.tsx`,
  `melo/mascot/forms/{cat,fox,gecko,ghost}.tsx`, `melo/mascot/assets/phoenix-{celebrate,concern,hero,protect,think}.png`
  — batch 5 (Melo hub, plumage/vitality system).
- `melo/state/meloStore.tsx`, `melo/state/derive.ts`, `melo/state/demoStates.ts`,
  `melo/state/presets.ts` — batch 5 (chat + gateway client state; check for overlap/duplication
  with `folio/store.ts`).
- `melo/screens/MeloChat.tsx`, `melo/screens/Premium.tsx` — legacy pre-Folio-port screens;
  candidates to retire once `folio/sheets/MeloChatSheet.tsx` and a real `PaywallScreen` land,
  not to keep building on.
- `melo/components/{WeatherSky,RunwayStrip,NextBestActionCard,WhatChangedCard,StateViews,MoneyModeSelector,BrandPreviews}.tsx`
  — potential reuse for TodayMode's per-lens hero panels (batch 2) and Insights (batch 7);
  evaluate per-lens during batch 2 rather than assuming direct drop-in, since these were built
  for the older `melo/` surface's own layout.
