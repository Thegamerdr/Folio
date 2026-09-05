# Lovable correction disposition

Date: 2026-09-05

Review input: `05-lovable-corrections.md` (one Lovable request, 15 findings; tool cost one credit).

Status: implementation disposition for the current native diff, not a release-readiness claim.

The following records the bounded disposition of all 15 findings. Financial projections, posted
facts, Review acceptance, local-first writes, and business differences remain unchanged.

1. **Today chart chronology — implemented.** `TodayScreen.tsx`, `today/todayPathGeometry.ts`,
   `ui/MoneyPathChart.tsx`, and `lib/moneyPath.ts` now share the payday-clipped display selector.
   The actual calendar dates map to x=30..370, the payday endpoint is rendered once, and the
   curve is monotone between its stations (no decorative overshoot below its low). Interior labels are omitted when crowded without moving the
   underlying point. The route engine still retains all 35 days; a later 35-day low is a separate
   warning rather than a relabelled payday low.

2. **Tight-point wording — implemented.** `lib/moneyPath.ts` supplies `tightPointDayLabel` from
   the same payday selector used by Today and Plan. Copy now says today, tomorrow, or the actual
   weekday/date; it does not hardcode “next week.”

3. **Calendar status-bar overlap — implemented.** `CalendarScreen.tsx` uses a fixed viewport with
   `paddingTop: insets.top` outside the `ScrollView`, eight pixels of content top padding, and the
   required 24px horizontal gutters. Agenda scroll resets only when display mode changes, while
   the accidental initial auto-jump was removed so explicit Go There/date jumps remain authoritative.

4. **Account greeting overlap — implemented.** `AccountScreen.tsx` and the companion layer use an
   inline 32px bird in a 44px target for Account; the floating Account perch/bubble is suppressed,
   keeping the heading clear.

5. **Review empty-state contradiction — implemented.** `ReviewScreen.tsx`/`ReviewHubScreen.tsx`
   distinguish a true empty queue from a suggestion or spillover. The queue and spillover are both
   counted, so a live prompt never appears above “Nothing waiting,” and the landing does not use a
   remount key to hide the contradiction.

6. **Returning onboarding copy — implemented.** `sheets/OnboardingSheet.tsx` makes Skip truthful
   for returning workspaces: existing accounts/income are not claimed to disappear or leave Today
   empty.

7. **Today crowding and chart slack — implemented.** `TodayScreen.tsx` keeps the 24px inset and
   44px header target, places the date/horizon on one line, and demotes the correction note to
   muted 11px copy below the amount. `MoneyPathChart.tsx`/Today use the tighter small-event plot
   and place “See the working” 12px below the chart; the link opens Calendar. SafeZone remains a
   separate bill/buffer budget with an explicit actual date and no financial-engine change.

8. **Plan CTA density — implemented.** `PlanScreen.tsx` uses `useWindowDimensions` to stack the
   two card CTAs below 380dp. Labels remain one line at 14/20 with no font shrinking; the 45.375px
   minimum, 12px radius, and 16px horizontal padding remain. The dominant card top margin is 16px,
   hero money is 36/40, and the narrative has no artificial 259px max width. Its tight narrative
   uses the payday-specific selector and the true date.

9. **Calendar event-card density — implemented.** `CalendarScreen.tsx` uses the 11px day eyebrow,
   12.5px balance, 64px minimum event rows, 16px padding, and 12px corners. Nudge and pause
   controls are hidden until an explicit row/action expansion, then share a 44px action row. The
   full-35-day banner is explicitly labelled “Lowest in next 35 days.”

10. **Sheet typography — dispositioned.** `TransferSheet.tsx` and `RefundSheet.tsx` use 26/32
   titles and 14/20 prerequisite copy. `CloudSyncSheet.tsx` already has the accepted 24px title,
   so it was retained rather than enlarged; its 44px card controls are an intentional compact
   exception.

11. **Duplicate sheet dismissals — implemented.** The shared `surfaces/pressureMap/Sheet.tsx`
   owns one 44px close target plus the grip. Per-sheet duplicates were removed, including the extra
   X in `sheets/AddDebtSheet.tsx`; shared-sheet consumers retain their guarded close behavior.

12. **Bottom-tab height and contrast — implemented/measured.** `surfaces/pressureMap/kit.tsx`
   uses a 60px content band with the system bottom inset extending the background, 20px icons, and
   11px labels. The dark muted foreground measured 6.22:1 and light measured 6.50:1; active tabs
   use the accent token rather than weight alone.

13. **Companion duplication — corrected in reviewed compositions.** Account’s floating perch is suppressed in favor of its inline target; the integrated
   birds on Review empty, More, and Today remain distinct and do not cover headings, money heroes,
   or the tab band.

14. **Hit-target policy — implemented/documented.** Standalone Today and SafeZone primary actions
   are 48px. Plan’s 45.375px in-card CTA is the recorded compact exception, as are the 44px Calendar
   nudge/action rows and sheet/form choice rows. The exception is intentional rather than a global
   token change.

15. **Copy/type and money glyph noise — checked in the reviewed surfaces.** Touched Calendar, Today, and
   Plan surfaces use the existing `weightFamily`/Inter Tight mapping and tabular money styles, with
   the shared `formatGBP` path used for corrected forecast copy. `app/_layout.tsx` registers the static
   Inter Tight Medium/SemiBold/Bold fonts before the app renders. The supplied typo-like strings were
   OCR observations, not confirmed source literals; real GBP glyphs were checked in the captures.
   Exhaustive font/glyph behavior across every state and large-text setting is not certified.

## Coverage and verification boundary

The controller's final scoped mobile no-emit check passed, as did four selected files / 27 tests after
the Calendar fade removal. Final light/dark Calendar captures visibly show the heading below the
system bar and the agenda painted; Account captures show no heading overlap. Additional capture files
containing intermediate repaint/portal artifacts are not accepted evidence. Build/signing/device proof
is recorded separately. Known unproven states from
the review remain: authenticated/conflict/provider/billing Cloud Sync, Business, large text,
permissions, confirmation/error paths, keyboard-open chat, real purchases, bank providers, deployed
sync, and production credentials.

## Device follow-up

After the main correction pass, `516ee6b` corrects Calendar's local-row versus scroll-content jump
coordinates, retries a requested jump after layout without replaying completed requests, and finds
the nearest dated agenda group when a low date has no event. S9 also exposed a scrollable onboarding
panel exceeding its keyboard-reduced viewport; the shared panel can now shrink, preserving the top
safe area. Transfer/refund were added to Search's real action index, with keyboard dismissal before
navigation. Three selected files / nine cases and mobile no-emit passed. These are local follow-up
corrections, not a second Lovable review or an independent sign-off.
