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
