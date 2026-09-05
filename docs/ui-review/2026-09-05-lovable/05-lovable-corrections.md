# Melo native UI/UX review — one consolidated correction list

Native checkpoint `c857321` reviewed against Lovable source `ad90b4fee36c58be156e145e8663d8c6be1bf0eb`.
Evidence read: `full-stack-review-context.md`, `02-review-brief.md`, `03-source-guide.md`,
`native-sheet-source.txt`, the 17-page capture pack (34 Android light/dark captures,
1080x2220, density 480 / logical 360x740, font scale 1.0, synthetic fixture 18 Aug 2026),
and the six key PNGs.

Scope note: this is a review plan only — no edits to this project. Prerequisite, empty and
auth-disabled captures are treated as labelled states, not defects, and not as proof of
device, provider, purchase, sync or production behaviour. Nothing here is a release-readiness
claim. Financial contracts (posted facts vs projections, Review as the acceptance boundary,
structural transfers, bounded refunds, local-first truth) are preserved by every item below.

## P0 — breaks truth or legibility

**1. Today chart chronology contradicts the hero (double payday)** — `apps/mobile/src/folio/ui/MoneyPathChart.tsx`, consumed by `TodayScreen.tsx`
Header states "10 days to payday" and the axis reads "TODAY → PAYDAY · 28 AUG", but event x-positions are laid out over a fixed 28-day span, so the payday station is drawn twice and the tight point lands after payday.
Fix: derive the domain from the real interval — `x = 30 + (370-30) * (dayIndex / daysToPayday)` with `daysToPayday` from the same selector the header uses; drop the 28-day constant. Clamp all events to `dayIndex <= daysToPayday` and render exactly one terminal payday station. Keep plot constants x=30..370, baseline y=214.

**2. Tight-point verdict can say "next week" when the low point is today** — `TodayScreen.tsx` verdict string + `PlanScreen.tsx` narrative
Fix: branch the phrasing on `tightDayIndex` (0 → "today", 1 → "tomorrow", else weekday), sourced from the same tight-point selector as the chart so all three surfaces agree.

**3. Calendar agenda crosses the status bar** — `apps/mobile/src/folio/screens/CalendarScreen.tsx`
The heading renders inside the system status bar in the light agenda capture.
Fix: adopt the `MoreScreen`/`PlanScreen` pattern — apply `paddingTop: insets.top` on a fixed viewport wrapper outside the scroll view (not on scroll content), then `contentContainerStyle` `paddingTop: 8`. Reset agenda scroll offset to 0 on mode change so the initial render cannot start under the inset.

**4. Account greeting bubble covers the heading** — `AccountScreen.tsx` + companion greeting layer
The "Hi, I'm Melo" bubble and phoenix sit on top of the Fraunces 26/30 headline.
Fix: exclude the Account heading block from companion placement (register it as an owned exclusion rect) and clamp the greeting to the region below the headline with a 12px gap; on Account only, use the quiet inline perch rather than the floating bubble. Never overlay a first-greeting on a screen title.

**5. Review shows a live prompt above "Nothing waiting to be checked"** — `ReviewScreen.tsx`
The recurring-charge suggestion and the empty-state copy contradict each other.
Fix: make the empty state conditional on `pendingClaims + suggestions === 0`. When a suggestion exists, replace the empty block with a quiet single line ("Nothing else waiting.", 13px muted, no illustration, no CTA) and keep the 52px "Add a statement" CTA only in the true-empty case.

**6. Returning onboarding claims Today stays empty when data exists** — onboarding sheet
Capture shows four owned fields with "Skip if you need to. Today stays empty…".
Fix: branch the skip copy on whether the workspace already holds accounts/income — returning users get "Skip if you need to. Nothing you've already added changes." Keep 15/22 copy sizing.

## P1 — hierarchy and density

**7. Today crowding and blank chart region** — `TodayScreen.tsx`, `MoneyPathChart.tsx`
Header row keeps 24px inset / 44px min row / 12.5px date-state text / 24px disc in a 44px target; reduce the date+state to one line and demote "you corrected this" to 11px muted on its own line beneath the amount.
Chart: after the domain fix (item 1), the empty right region closes. Additionally reduce `viewBox` height slack from `0 36 400 204` to a tight `0 60 400 180` at height 164 when there are ≤3 events, and lift `See the working →` to sit 12px under the chart baseline instead of floating in the gap.

**8. Plan CTA wrapping and card density** — `PlanScreen.tsx`
"See what's coming" / "Try a change" wrap at 360dp.
Fix: stack the two actions vertically below 380dp (`flexDirection` switch on window width), keep 45.375px min height, 12px radius, 16px horizontal padding, and set label to 14/20 with `numberOfLines={1}` `adjustsFontSizeToFit` off. Dominant card: keep 24px radius/24px padding but reduce top margin 24 → 16 and the hero money 40/40 → 36/40 so "over the 10 days to payday" is not orphaned. Narrative `maxWidth` 259 → unset with 24px insets so lines break naturally.

**9. Calendar event cards are oversized for their content** — `CalendarScreen.tsx`
Fix: day-group header 11px eyebrow / 12.5px right-aligned balance; event row 64px min with 16px padding and 12px radius; collapse the "-1d / +1d / +3d" nudge row and "PAUSE THIS MOVE" into a single 44px action row revealed on row tap rather than always-on inside every card. Keep the lowest-point banner as the only emphasised element above the list.

**10. Sheets read oversized at 360dp** — `TransferSheet.tsx`, `RefundSheet.tsx`, `CloudSyncSheet.tsx`
Titles at Fraunces 30/36 dominate short prerequisite bodies.
Fix: title 30/36 → 26/32 for these three; keep 24px body inset and 12px rhythm; copy 15/22; keep 44–52px controls and the shared `Sheet` (28px corners, 36x3 grip, 82% max height, 450ms). Prerequisite messages ("Add two active cash accounts…", "There is no incoming credit to pair yet…") become 14/20 muted rather than body-weight.

**11. Duplicate dismiss affordances on sheets** — shared `apps/mobile/src/surfaces/pressureMap/Sheet.tsx`
Captures show both a grip and a per-sheet close glyph, and in places two close targets.
Fix: the shared `Sheet` owns exactly one 44x44 close target with a 28/30 glyph plus the grip; remove any per-sheet close button in `TransferSheet`, `RefundSheet`, `CloudSyncSheet`, log-spend and declare-debt.

**12. Tab band height and dark contrast** — `BottomNav` in `apps/mobile/src/surfaces/pressureMap/kit.tsx`
68px band plus system inset reads tall, and inactive dark labels sit near the AA floor.
Fix: band 68 → 60px content height with the background still extending through the reported bottom inset; icons 20px, labels 11px / 0.275px tracking retained; raise the inactive dark label/icon colour to the muted-ink token that measures ≥4.5:1 on the dark tab surface, and give the active tab the accent token rather than weight alone.

## P2 — consistency and polish

**13. Companion duplication and placement** — companion layer
Confirm exactly one bird per screen across the pack (Review empty state, Account greeting, More perch, Today hero). Rule: one integrated character per screen; suppress the floating companion whenever a screen owns a 64x64 perch, and never place it over a heading, a money hero, or the tab band.

**14. Hit-target policy split** — `packages/ui/src/tokens.ts` consumers
Policy declares 48dp while parity controls use 44dp. Keep 44dp only for compact in-card controls (calendar nudges, sheet choice rows) and raise standalone primary actions to 48dp minimum; record the exception list rather than leaving it implicit.

**15. Small copy/type noise**
"Tvpe it vourself"-class rendering and mixed money glyphs ("f1292" vs "£1292") appear in agenda and intake captures — verify the Inter Tight static weight mapping is loaded on those screens and that money always renders through the single formatter with tabular figures.

## Coverage gaps (not defects, must not be read as certified)

Transfer/Refund are prerequisite states; chat is keyboard-closed; the review item is empty;
Cloud Sync authenticated/conflict/provider/billing states, Business, large text, permissions,
and every confirmation/error state are absent from the pack. Real purchases, provider bank
connections, deployed sync and production credentials remain unproven external gates.

## Suggested implementation order

1, 2, 3, 4, 5, 6 → 7, 8, 9, 10, 11, 12 → 13, 14, 15.
Re-capture Today (light/dark), Calendar agenda, Account, Review with-suggestion, Plan at 360dp,
and one sheet after each block.
