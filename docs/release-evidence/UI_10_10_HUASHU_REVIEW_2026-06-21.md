# Folio Mobile UI 10/10 Huashu Review - 2026-06-21

## Sources Applied

- Canonical source of truth: `docs/ui-source/Folio_UI_Deep_Research_Mock_2026-06-21`.
- Priority screens inspected: research direction board, first-minute board, and interaction prototype.
- Huashu lens: remove AI slop, avoid decorative data, preserve system identity, and score the result by philosophy, hierarchy, craft, function and originality.
- React Native lens: Pressable controls, safe-area-friendly ScrollView behavior, stable dimensions and no clipped text.

## Current Score

Overall: 9.1/10 local UI production-candidate, with public-release UX still blocked by native
accessibility, real-device motion, large-text, reduced-motion and user-testing evidence.

Post accessibility/security pass: local accessibility UX is recorded separately as 9.4/10 in
`A11Y_SECURITY_10_10_LOCAL_CANDIDATE_2026-06-21.md`. That score covers source-controlled semantics
and Android emulator XML evidence, not independent VoiceOver/TalkBack certification.

- Philosophy alignment: 9/10. The app now follows the thesis that calm is visible control: one answer, one route, provenance beside automation, and recovery without failure language.
- Visual hierarchy: 9.2/10. Today, first relief, import discovery and recovery each have a clear first read. The bottom navigation now supports the hierarchy instead of competing with it.
- Craft quality: 8.8/10. Money glyphs, chevrons and tab symbols are centralized through stable escape constants; card-heavy import review was flattened into rows; live Android screenshots confirm the hierarchy fits the emulator viewport.
- Functionality: 9.2/10. Playable proof, import review, source inspection, Today, direct what-if and recovery remain reachable with Pressable controls and Android back behavior.
- Originality: 9/10. The breathing-room horizon is treated as Folio's signature object rather than a generic dashboard graph; Melo is contextual and quiet.

## Keep

- First minute begins with relief and curiosity, not a financial profile form.
- The sample what-if interaction lets the user touch consequence before sharing data.
- Import progress uses narrative discoveries and original wording rather than a dead percentage.
- Recovery says what changed, what remains protected and when breathing room returns.
- Melo remains useful and specific without fake intimacy.

## Fixed In This Pass

1. Broken glyph risk - important
   - Current: currency, chevrons and tab glyphs could render as mojibake depending on environment.
   - Fix: centralized rendered symbols with escaped constants and routed money through `formatPounds`.

2. Horizon looked like a progress bar - important
   - Current: the breathing-room object was a straight filled bar, which weakened the signature Folio language.
   - Fix: rebuilt it as a layered route with soft underlay, traced line, event dots and compact axis labels.

3. Import review felt too much like card UI - important
   - Current: automation evidence was trapped in repeated bordered cards.
   - Fix: flattened review and source inspection into provenance rows with visible confidence/status.

4. Bottom navigation drifted from the canonical phones - important
   - Current: nav was chunky, central Melo changed style when active, and the top control was visually oversized.
   - Fix: tightened tab dimensions, preserved the central dark Melo mark, and added hit slop to compact controls.

5. Android viewport and clipping risk - important
   - Current: first-minute minimum height and large typography increased small-screen crowding risk.
   - Fix: reduced minimum canvas height, tightened display type and added safe ScrollView behavior.

## Remaining Fixes

- Replace the RN-view horizon with a true native drawing primitive later if the visual route needs smoother curves.
- Add automated visual assertions once the app has an agreed screenshot harness.
- Run TalkBack, large-text and reduced-motion recordings on Android, and VoiceOver on iOS once macOS/signing access exists.

## Review Verdict

This is aligned with the zip direction and no longer reads as an engineering evidence wall or a
decorative finance dashboard. It is a calm route reader with provenance, reversible automation and
bad-month recovery. The remaining work is production validation and native polish, not a restart of
the design direction.

## Emulator Evidence

- First minute: `android-ui-10-10-first-minute.png`
- Playable route: `android-ui-10-10-playable.png`
- Playable moved: `android-ui-10-10-playable-moved.png`
- What-if sheet: `android-ui-10-10-what-if.png`
- Import discovery: `android-ui-10-10-import-discovery.png`
- First answer: `android-ui-10-10-first-answer.png`
- Today: `android-ui-10-10-today.png`
- Source sheet: `android-ui-10-10-sources.png`
- Import review: `android-ui-10-10-import-review.png`
- Review action feedback: `android-ui-10-10-import-review-confirmed.png`
- Recovery: `android-ui-10-10-recovery.png`
