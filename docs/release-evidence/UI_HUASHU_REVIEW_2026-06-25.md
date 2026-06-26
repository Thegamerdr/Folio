# Folio Mobile UI Huashu Review — 2026-06-25

Reviewer: Claude (product UX takeover)
Method: Huashu design critique workflow — real on-device captures (`emulator-5554`, debug build over
Metro, density 420dpi) plus `uiautomator` view-tree dumps for the touch-target / section audit.
Lens: remove AI slop, avoid decorative data, preserve system identity, one composed surface; score by
philosophy, hierarchy, craft, function, originality; RN rules (Pressable, safe-area ScrollView, stable
dimensions, no clipped text, 44–48dp touch targets).

This review supersedes `UI_10_10_HUASHU_REVIEW_2026-06-21.md`, whose 9.1 score rested on
mockup/HTML evidence, not the real RN app. Scores here are against the actual rendered app and are
**deliberately not 10/10** — they reflect what the screenshots prove.

## Capture evidence (real app)

All under `apps/mobile/evidence/claude-ux-takeover-2026-06-24/`:
Start `07`/`13`, guided input `11`, Today incomplete-route `06`, Review row `09`/`10`, Review sheet
`03`/`04`, Review empty `12`, More `02`/`14`, plus `uiautomator` dumps `huashu-more*.xml`.

## Huashu rubric (current, honest)

Weighted: ~8.4 / 10. A calm, honest, identity-true route reader. The gap is bespoke visual craft,
not structure.

- **Philosophy alignment — 9.0/10.** One answer, one route, provenance beside automation, recovery
  without failure language. The app no longer "shows all features at once": dev tools are gated,
  Start has one dominant path, the route shows an honest incomplete state rather than a fake line.
- **Visual hierarchy — 8.5/10.** Each screen now has a clear first read — the £ answer on Today, the
  single hero on Start, the human question on each review row. Same-weight panel repetition is much
  reduced (progress console hidden when empty, six fallback buttons collapsed to one).
- **Craft quality — 7.5/10.** _The weak dimension._ Cards now carry a shared soft elevation instead
  of flat translucent washes, and the small top-bar chips were lifted from 26dp to 34dp + ~58dp
  hit-slop. But this is not yet a bespoke design language: still system fonts, no deliberate type
  pairing, no editorial/bento composition, uniform radius.
- **Functionality — 9.0/10.** Import, row-by-row review, source inspection, Today, what-if, recovery,
  bills/debt all reachable with Pressable controls and Android back behaviour.
- **Originality — 8.0/10.** The breathing-room horizon stays Folio's signature object; Melo is quiet
  and contextual (one note on Today, not two). Voice is calm-serious, not generic fintech.

## Keep

- First action is a useful first win, not a profile form.
- The route asks "Will I make it to payday?" and tells the truth when it can't answer yet.
- Review is a row-by-row decision feed ("Is this Coffee?"), not a ledger console.
- Provenance is inspectable on tap, never a permanent "Source: Current picture" label.
- Melo is specific and quiet; recovery says what changed and what stays protected.

## Fixed in this pass (Huashu lens)

1. **AI slop removed — important.** Killed the decorative "interaction language" ribbon, the duplicate
   Melo block, the 0%/"Waiting for a statement" progress console on empty Review, and the
   ten-equal-button review sheet (→ Add/Edit/Ignore + More options).
2. **Decorative data removed — important.** Today no longer draws a flat/fabricated route line with
   no income or must-pay item; it shows an honest incomplete state. Object counts and the "Test" chip
   no longer leak into normal UI.
3. **System identity preserved — important.** The breathing-room horizon, Melo, and the calm voice
   are intact; banned technical language ("Internal test mode", "Source: Current picture", "local
   ledger", Preview/Known/Review badges) replaced with human wording (Confirmed/Estimate/Check,
   "Show why", "your records on this device").
4. **Craft / depth — important.** Shared soft card elevation so surfaces lift off the warm canvas
   instead of reading as repeated white walls (`reviewRow`, `importPastePanel`, `routePressureGrid`,
   `menuRow`). Evidence: `14-more-card-depth.png` vs the flat `02-more-after-fix.png`.
5. **Touch comfort (finding #5) — important.** uiautomator audit found the top-bar chips at 26dp
   (69px) tall on every screen. Raised to 34dp visible + ~58dp effective via `hitSlop`, keeping the
   pills visually compact per the hit-target token (`expandsInvisibleHitSlop`).

## P0 robustness finding — launch crash on a future-dated row (found via on-device testing)

The Huashu device pass surfaced a **launch crash**, not a visual issue. With a stale local picture
that contains a transaction dated after today, `canonicalLedgerAdapter.ts:732` flags it as a "future
fact", `createCanonicalRepositoryForMobileSnapshot` throws, and the whole screen render fails. It
reproduces once the device clock passes a seeded/imported row's date (the seed in
`localLedger.ts:createInitialLocalLedgerState` date-shifts rent/payday rows, and
`refreshLocalLedgerAsOfDate` re-seeds them to today). The graceful `loadCanonicalLocalLedgerState`
fallback does not cover the post-refresh render path.

Done this pass:

- Added a **hydration guard** (`app/index.tsx`) that runs the strict check before committing a loaded
  ledger and recovers to empty if it would throw.
- Added a route-level **`ErrorBoundary`** (`app/index.tsx`) so the app shows a calm "Let's start
  fresh" recovery screen instead of a hard crash / red box. Verified on-device — the boundary renders
  (the dev LogBox is only a development overlay; a release build shows the recovery screen directly).

Still open (focused follow-up, data layer):

- "Start fresh" reset is incomplete for already-corrupt persisted data: `saveCanonicalLocalLedgerState`
  rewrites normalized rows **per workspace id**, and an empty state's workspace id differs from the
  seed's, so the stale normalized rows survive a reload. Clear all workspaces (or wipe the normalized
  tables) on reset.
- Make the seed/example date-safe so it never produces a future-dated _transaction_ (future
  _commitments_ are fine), or relax the validation to allow confirmed protected future commitments.

## Remaining fixes (next Huashu passes)

- **Pass A — bespoke type & composition (the real 7.5→9 craft jump):** a deliberate display/body type
  pairing, stronger scale contrast on the hero answer, and one editorial/bento moment instead of a
  uniform card stack. Needs an agreed style direction (dark-luxury vs editorial vs Swiss).
- **Pass B — density sweep on the longer screens** (Calendar, Plans, Money/what-if) with full-scroll
  section inventory, targeting < ~3.5 screens before data, per the methodology.
- **Pass C — remaining touch targets**: re-audit RouteRow (~35dp) and segmented controls once Metro
  render is stable; raise any sub-44dp view bounds.
- **Production validation**: TalkBack / large-text / reduced-motion recordings still remain.
- **Release APK — RESOLVED (2026-06-25):** the Windows `assembleRelease` "Invalid file path" was NOT
  a foojay/NDK toolchain issue. Root cause was a malformed `apps/mobile/android/local.properties`
  (`sdk.dir=C:\Users\...` with single backslashes, which a Java `.properties` file silently mangles to
  `C:UsersUser...`); `SdkLocator.validateSdkPath` then rejected it. Earlier passes built only because
  `ANDROID_HOME` was set, masking the bad file. Fixed `sdk.dir` to forward slashes →
  `:app:assembleRelease` BUILD SUCCESSFUL (~2m), and the standalone release APK installed and
  smoke-launched clean on `emulator-5554` (no Metro, no crash).

## Review verdict

Aligned with the Folio thesis — a calm route reader with inspectable provenance, reversible
automation and bad-month recovery. It no longer reads as a form, a calculator, a menu, or an
engineering-evidence wall. The honest gap is bespoke visual craft (type, composition), which is a
deliberate design pass, not a structural restart. Not a 10/10, and not claimed as one.
