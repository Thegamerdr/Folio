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
