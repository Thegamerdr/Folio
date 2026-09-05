

===== docs/ui-review/2026-09-05-lovable/00-evidence-index.md =====

# One consolidated Lovable review - evidence index

Source: c857321, with a capture-only route allowlist extension and a non-visual sync-journal integrity guard being checked. This is implementation evidence, not release or visual approval.

`melo-native-ui-review-2026-09-05.pdf` contains 34 unedited Android screenshots on 17 paired light/dark pages: Today, Plan, Review, More, Account, Calendar, Intake, empty Review item, Search, Debts, Paywall, Transfer, Refund, Melo chat, returning onboarding, Log spend, and Declare debt. Key screens are also attached separately at original resolution. All money/person names are synthetic `confirmed-safe` fixture data, fixed at 18 August 2026. Capture device: Android 35 emulator, 1080x2220 pixels, density 480 (360x740 logical dp), font scale 1.0. The Expo tools overlay was turned off, not erased from images. No S9 owner data, secrets or credentials are included.

The pack deliberately preserves visible defects: Account's first greeting obscures its heading; Calendar's captured agenda crosses the status bar; Review has a recurring-charge prompt above a contradictory empty-state message; Today places payday twice because event geometry uses 28 days while the actual interval is 10; returning onboarding implies existing money is empty. Judge density/oversized headings, sheets, unnecessary whitespace, hierarchy, CTA wrapping, dark contrast and companion behavior against the existing Lovable project source.

Coverage limits: these are representative current native surfaces, not exhaustive interaction screenshots. Transfer has one account and shows its prerequisite state; Refund has no incoming credit and shows its prerequisite state. Their actual full form source is attached so the review can specify corrections there too. Chat is keyboard-closed, not a voice recognition proof. Review item is empty, not an accepted import. Cloud Sync full source is attached, but authenticated trusted-device/conflict states, provider bank connection and real billing cannot be represented as live without configured services. Business, large-text, permissions and every confirmation/error combination are not visually certified by this pack. Existing Business financial boundaries must be preserved.

Read the implementation context and source guide for backend/native contracts and exact visual values; read the review brief for requested output. Return ONE prioritized, actionable review with exact native file/style/token adjustments. Do not edit this Lovable project, deploy, create a new design, or call the product release-ready. Preserve the original product character while making the native result compact and coherent. The owner explicitly wants one batch review, then Codex implements the findings; no individual screen review requests.


===== docs/ui-review/2026-09-05-lovable/01-implementation-context.md =====

# Implementation context for Lovable review

## Status and source of truth

This is a full-stack handoff for the current Melo/Folio implementation. The working tree started
from `2effcd7365237728ae98485101728c4f8aa341f2` in
`C:\dev\melo-native-today-batch1-2026-08-24`; the current source checkpoint is `c857321` (the
final amended integration checkpoint, replacing transient `e13e2d32`). The native app is an
Expo/React Native TypeScript app. Its visual
layer lives under `apps/mobile/src/folio`, using the existing theme tokens, Fraunces/Inter font
mapping, React Native Reanimated, react-native-svg, safe-area context, and the shared native Sheet
primitive. Domain and money behavior is supplied by the existing packages/store/native persistence
adapters rather than a new UI data model. Cloud authority is a Cloudflare Worker with SQLite
Durable Objects; mobile backup/sync callers are local-first and encrypted. The reviewed banking
source is `c25640e`; the final sync source integration, including the root-owned runner and Sheet,
is included in checkpoint `c857321`. These are source checkpoints, not release approvals.

The Lovable connector project is `d8323aca-d14c-4f6d-bb89-6d41bcefab7b`, latest SHA
`ad90b4fee36c58be156e145e8663d8c6be1bf0eb`. The pinned `design-surfaces.json` explicitly says no
surface owner is approved. Lovable is now the UI/UX authority for this review, but the existing RN
facts are implementation evidence, not a visual brief. Treat the pinned design surface and its
source files as the starting point for review, not as prior owner approval.

Repository references for the visual baseline are `plans/rn-port/BUILD_PLAN.md`,
`plans/rn-port/specs/_theme-primitives.md`, and the screen/sheet specs for More, Plans, Today,
Calendar, Review, Intake, MeloChat, onboarding, edit transaction, and log spend. Those documents
record the original Lovable source path and numeric tokens: sheet top radius 28 and roughly 82vh,
36x3 grip, Melo sizes 18/28/40/64/120, 68px tab bar, and the typography/radius/spacing scale.

## Current visual and behavioral changes

- Today, Plan, and Calendar now use a shared day clock refreshed on foreground/day rollover. Date
  engines receive a local-day-to-UTC-midnight representation; true transaction instants remain
  unchanged. Plan has a fixed top safe-area viewport around scrolling content. Its real action rows
  open Debts, subscriptions, declaration, transfer, and refund routes/sheets.
- More keeps its grouped quiet-hub composition, but Search Melo opens a real local search route.
  Notifications is an explicit native Switch showing persisted setting plus OS permission state,
  with busy/error/denied copy. More and Account move the top safe inset to a fixed viewport instead
  of scrollable content. A newly added Search screen uses a 44px back target, 28/32 heading,
  14/22 supporting text, 48px search field, and 56px result rows. A newly added Debts screen uses
  the same fixed inset, 28/32 heading, 64px debt rows, and a 48px declaration CTA.
- Plan has no changed core typography or money/card dimensions in this lane; the visible change is
  the safe viewport boundary and reachable action rows. Calendar and Today likewise retain their
  existing visual geometry; their changes are date-anchor behavior.
- Review's empty state now explains that a statement must be added and offers a 52px “Add a
  statement” CTA. Intake copy describes native picker/on-device preparation and review-before-add;
  it no longer describes prototype examples as the product.
- Returning onboarding shows only owned payday/income fields (name, cadence, payday, income), with
  four progress pips; first-run still contains the full setup. Saved cadence, amount, anchor, and
  day are seeded on return. Completion/skip paths are intended to preserve populated workspaces.
- Account gained Cloud Sync and durable bank-inbox entry points. Add/edit account forms use strict
  complete GBP parsing, validate name and amount before either mutation, visibly reject malformed
  or blank edits, allow explicitly signed non-card balances, and normalize credit-card magnitude.
- MeloChat keeps its own internal transcript scroll, reduces the body minimum from 360px to 0 for
  keyboard fit, and enlarges Send/Stop from 32x32 to 44x44. Transfer and Refund are explicit
  review/confirm sheets with 44–52px controls; transfer copy records an already-made internal
  transfer and does not claim to move bank money.
- Paywall now renders exact returned product/offer metadata and localized price availability rather
  than hardcoded prices. CloudBackup adds discovery/catalog and recovery state presentation.
  Bank connection remains read-only and provider/auth gated.
- The shell includes lifecycle wiring for sync and mounts the new transfer/refund sheets. Companion
  placement/suppression and duplicate-bird behavior still require screenshot review against the
  Lovable source.

## Current review evidence and known truth gaps

The current checkpoint has 36 focused selected checks passing, plus the SQLite runtime exercise and
the mobile no-emit TypeScript check. There is no physical-device, live-provider, deployed-service,
or production-credential proof in this pack. Banking source is at `c25640e`; sync source is at
`c857321`, but source integration and selected checks must not be read as acceptance of live
banking, billing, or sync behavior.

Two root amount/date corrections are in place. Underlying chronology still needs correction and
visual judgment: Today can feel crowded around date/status content, the chart can leave a large
blank region, Today and Tightest can overlap, the chart geometry is 28-day while the actual payday
period differs, the full 35-day tight point may be plotted before payday, and a mode verdict can
claim “next week” when the low point is today. These are review targets, not requests to invent a
new financial model.

## Contracts that must remain visible in review

Financial facts are posted transactions; planned events, subscriptions, pots, debts, and route
forecasts remain distinct projections. Internal transfer legs retain structural linked metadata,
stay in account history, and are excluded from spend/income inference. Refund pairing links an
existing incoming credit to an original outflow without creating money; partial refunds are bounded
by the remaining original amount. Every financial write is explicit and reviewable, and scoped undo
must not overwrite later edits.

The app is local-first: offline and signed-out states retain local data and show truthful unavailable
or pending states. Statement/photo/paste and bank-provider results are claims staged for Review;
nothing becomes a posted financial fact until the user accepts it. Encrypted local SQL/persistence
is the authority for local state. Cloud backup/sync must not be presented as complete merely because
helpers or status UI exist.

A06 sync source is included in `c857321`, with the current runner/Sheet integration and focused
native/runtime coverage described above. Do not use source or selected checks as proof of a deployed or physically
verified synchronization service. Real Apple/Google purchases, renewals, restores, provider bank
connections, and production credentials remain unproven external gates; localized/catalog handling
and server verification code do not constitute live provider evidence.

## Capture coverage wishlist (pending an evidence index)

The following is the desired capture wishlist, not a claim that these images have been captured.
Create an evidence index first, then capture each feasible state with the build/source checkpoint
and state identified for every image. Mark unavailable or gated states explicitly instead of
silently omitting them:

- Today populated/empty, Plan at top and after scrolling, tight-point text, companion placement,
  and every Plan action; Calendar Month/Week/Agenda after noon Monday and a week jump.
- More at top and scrolled, status-bar boundary, Notifications off/on/denied/error, Search with
  results/no results and keyboard open, Review empty and populated, and Intake first-use copy.
- Account Personal and Business, valid add/edit, malformed/blank edit with visible error, bank
  inbox, and Cloud Sync entry; Debts empty/populated; Transfer and Refund review, confirm, error,
  and partial-refund states.
- First-run and returning onboarding; Melo chat with keyboard open, visible header/composer, 44px
  send target, internal scrolling, and exactly one companion; Paywall per-SKU available/unavailable
  and localized price states; CloudBackup discovery/recovery states.
- Repeat representative captures in light/dark theme and with large text where practical. Include
  offline, signed-out, disabled-feature, permission-denied, and pending/recovery states rather than
  implying unavailable provider/device work is live.

The evidence pack should distinguish source comparison from implementation behavior. A filename,
helper export, route stub, status label, or checklist classification is not proof of an end-to-end
financial, sync, billing, voice, or provider integration.


===== docs/ui-review/2026-09-05-lovable/02-review-brief.md =====

# Lovable review brief

Lovable is the UI/UX authority for this one complete native-app review. Judge the current native
implementation against the existing Lovable source and prescribe exact compact fixes; do not add
features, replace the financial model, or treat implementation evidence as prior visual approval.

Please return one prioritized response covering the full capture pack, with concrete per-screen and
per-file guidance for font sizes/weights, line heights, spacing, safe-area boundaries, card/chart
geometry, companion placement, and keyboard behavior. Prefer existing theme tokens and the smallest
source changes that restore hierarchy and legibility.

Pay particular attention to:

- Today’s crowded date/status area, the large blank chart region, Today/Tightest overlap, and whether
  the chart period visually agrees with the actual payday period.
- The full 35-day tight-point presentation, including the case where the low point is today rather
  than next week.
- Plan, Calendar, More, Account, Search, Debts, Review, Intake, onboarding, chat, transfer/refund,
  and Paywall states across top/scroll/keyboard/denied/offline variants.
- Companion overlap or duplicate-bird rendering, fixed viewport safe areas, and minimum touch targets.

Preserve the existing contracts: local SQL/persistence remains the authority; review precedes posted
financial facts; transfers and refunds remain structural/account-safe; offline and signed-out states
stay truthful. The current evidence is 36 focused checks, a SQLite runtime exercise, and mobile
no-emit TypeScript; there is no physical-device, live-provider, deployed-service, or production-secret
proof. Do not call the product release-ready or reduce these gaps to “all secrets only.”

For each finding, identify the affected source file/screen and the exact token or compact geometry
adjustment, then rank the response by user-visible impact while preserving financial truth.


===== docs/ui-review/2026-09-05-lovable/03-source-guide.md =====

# Melo native source guide for one Lovable review

This is a compact source map for a single UI/UX review of the Expo/React Native TypeScript app.
The source checkpoint is `c857321`, amended from transient integration checkpoint `e13e2d32`.
The review should judge the current source and any captured evidence together; these numbers are
existing implementation facts, not new design instructions. Do not infer release readiness from a
source path, a route, or a passing focused check.

## Shared visual system

- `apps/mobile/src/surfaces/pressureMap/kit.tsx` is the visual primitive source; `apps/mobile/src/folio/theme.ts` re-exports it. Fraunces is the display family (`Fraunces_400Regular`, italic, and medium); Inter Tight is the sans family, with static weight-family mappings.
- `packages/ui/src/tokens.ts` defines the spacing scale: 0, 1, 2, 4, 8, 12, 16, 24, 32, 48, and 64 dp (`none` through `huge`). The compact layout insets are 16 and 24; content/section gaps are 16 and 24. The interaction policy declares a 48dp minimum hit target, while some legacy/source parity controls use a 44dp minimum that should be called out in review.
- Current radii in the kit are 8 (`sm`), 12 (`md`), 18 (`lg`), 24 (`xl`), 32 (`xxl`), and 999 (`pill`). Common kit display values are 31/37, 29/36, 27/33, and hero money 52/56 (font size/line height). The canonical primary kit CTA uses 18px vertical padding, 24px horizontal padding, and an 18px radius.
- `apps/mobile/src/surfaces/pressureMap/Sheet.tsx` is shared by the sheet family: 28px top corners, 36x3px grip, maximum height 82% of the window, 450ms entrance timing, and safe-area/keyboard handling in the shared avoider. The close target is 44x44 with a 28/30 glyph. Individual sheets should not add a second scrolling or keyboard wrapper.
- `BottomNav` in `kit.tsx` uses a 68px product tab band, extending only its background through the reported system bottom inset. Labels are 11px with 0.275px tracking; icons are 20px. The four personal tabs are Today, Plan, Review, and More.

## Screen and component map

### Today and chart

- `apps/mobile/src/folio/screens/TodayScreen.tsx` owns the populated/first-run Today composition. The regular header has 24px horizontal padding, a 44px minimum row, 12px column spacing, 12.5px date/state text, and a 24px weather disc in a 44px target. The first-run title is Fraunces 32/36 with -0.5 tracking; body is 14.5/21; the primary first-run action is 54px high with a 24px radius. The top safe inset is applied at the screen boundary, not as a scrolling status-bar substitute.
- `apps/mobile/src/folio/ui/MoneyPathChart.tsx` renders the SVG money path at `viewBox="0 36 400 204"`, width 100%, height 184. Its plot constants are x=30..370 and baseline y=214. Normal/low value labels are 11/13px; date labels are 8.5px; named event labels are 8px; focus label is 9.5px. Stroke widths are 1.6 in minimal mode and 2.6 otherwise. Lovable should inspect the actual chart geometry and chronology, including the known blank region and tight-point/date overlap, rather than prescribing a new financial model.

### Plan

- `apps/mobile/src/folio/screens/PlanScreen.tsx` uses a fixed `viewportSafeArea` above its scrolling content. The frame/content horizontal inset is 24px. Its marker is 6px with an 8px gap; eyebrow is 13px; heading Fraunces is 28/32 with -0.56 tracking; narrative is 14/21.7 with an existing 259px max width. The dominant card is 24px radius, 1px border, 24px top margin, and 24px padding. Action buttons use 12px radius, 45.375px minimum height, and 16px horizontal padding; money sizes are 16/24 and 40/40. Plan routes Debts, subscriptions, declaration, and the real Transfer/Refund sheets.

### More, Account, Search, and Debts

- `apps/mobile/src/folio/screens/MoreScreen.tsx` has a fixed top safe-area viewport around the scroll view. Content uses the 24px (`gap.xl`) horizontal inset. The hero perch is 64x64; heading Fraunces is 28/32.2 with -0.56 tracking; section gaps are 32px; grouped lists use an 18px radius, 1px border, 16px horizontal padding, and 44px minimum rows with 12px vertical padding. Row labels are 14/21.7 and metadata 12.5/18.75.
- `apps/mobile/src/folio/screens/AccountScreen.tsx` has the same fixed viewport safe-area boundary. Content uses 24px horizontal padding; the main headline is Fraunces 26/30; the tier card is 24px radius, hairline border, 16px top margin, and 16px padding. Account also exposes bank inbox and Cloud Sync entry points. Add/edit account validation is strict and must remain visibly non-destructive on invalid input.
- `apps/mobile/src/folio/screens/MoreSearchScreen.tsx` is the local Search Melo route. It uses a 44px back target, 24px horizontal inset, 11px uppercase eyebrow, Fraunces heading 28/32, supporting text 14/22, a 48px rounded search field, and 56px result rows. Results navigate to actual screens/sheets; this is not a chat replacement.
- `apps/mobile/src/folio/screens/DebtsScreen.tsx` uses the same 24px inset, 44px back target, 11px eyebrow, Fraunces heading 28/32, 14/22 subhead, 64px debt rows, and a 48px declaration CTA. “Add a debt” must open the declaration flow, not the recurring-payment form.

### Transfer, Refund, and Cloud Sync sheets

- `apps/mobile/src/folio/sheets/TransferSheet.tsx` records an already-made internal transfer; it does not move money at a bank. The sheet body is 24px padded with 12px gaps; title Fraunces 30/36; copy 15/22; choices are 44px minimum with 12px radius; amount input is 48px minimum and 18px text; review is Fraunces 20/28; confirm is 48px minimum with a 12px radius.
- `apps/mobile/src/folio/sheets/RefundSheet.tsx` pairs an existing incoming credit with its original outflow without creating money. It uses the same 24px body inset/12px rhythm; title 30/36; copy 15/22; search input 48px; choice rows 52px with 12px radius; review 20/28; confirm 48px.
- `apps/mobile/src/folio/sheets/CloudSyncSheet.tsx` is the actual local-first sync control surface. It uses shared `Sheet`, `Surface`, and `gap` tokens; visible buttons are 44px minimum, the opening title is 24px, body copy is 14/20, queued/status copy is 13px, and the approval identity field is at least 60px high. It exposes enable/pause, Sync now, trusted-device approval/revocation, and concrete local-vs-received conflict differences. Offline, signed-out, pending approval, and conflict states must remain truthful.

## Architecture and financial truth contracts

The app is local-first. Store/domain selectors derive money facts from posted transactions; plans,
events, subscriptions, pots, and debts remain projections. Encrypted local SQL/persistence is the
local authority. Cloud backup/sync is encrypted and account/workspace scoped, with durable replay,
approval, conflict, and deletion-fence semantics; source integration is not proof of a deployed or
physically verified service.

Review is the boundary for imported statements, images, pasted data, and bank-provider batches:
they are staged claims until the user accepts them. Internal transfer legs remain in account
history with structural linked metadata, but are excluded from spend/income inference. Refund
pairing links an existing credit to an original outflow, permits bounded partial refunds, and never
credits a second transaction. Explicit writes and scoped undo must preserve unrelated later edits.

## One-review request

Please return one prioritized, concrete review keyed to these paths: exact typography/spacing/card/
chart/sheet/tab-bar adjustments per screen, preserving financial truth and the existing token
system. Include Today chronology/blank-space/overlap, Plan density, More/Account top-inset behavior,
Search/Debts hierarchy, Transfer/Refund clarity, and CloudSync pending/conflict states. The desired
capture list is a wishlist pending an evidence index; no physical device, live provider, deployed
service, production credential, or real purchase proof is implied here.
