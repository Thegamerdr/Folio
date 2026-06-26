# UI Recovery Audit - 2026-06-21

## Reason

The Android app was opened with `apps/mobile/app/index.tsx` rendering a long engineering
evidence/status surface. That surface was useful as proof material, but it was not a product UI
and should not have been presented as UX completion.

## Source Of Truth

- `docs/ui-source/Folio_UI_Deep_Research_Mock_2026-06-21/00_DEEP_UI_RESEARCH_SYNTHESIS.md`
- `docs/ui-source/Folio_UI_Deep_Research_Mock_2026-06-21/01_RESEARCH_SOURCE_REGISTER.md`
- `docs/ui-source/Folio_UI_Deep_Research_Mock_2026-06-21/folio_ui_research_direction.html`
- `docs/ui-source/Folio_UI_Deep_Research_Mock_2026-06-21/folio_ui_research_direction.png`
- `docs/ui-source/Folio_UI_Deep_Research_Mock_2026-06-21/folio_first_minute_research_direction.html`
- `docs/ui-source/Folio_UI_Deep_Research_Mock_2026-06-21/folio_first_minute_research_direction.png`
- `docs/ui-source/Folio_UI_Deep_Research_Mock_2026-06-21/folio_interaction_prototype.html`
- `C:/Users/User/Downloads/folio_interaction_prototype.html`

The governing direction is: feel the route, not a dashboard. Calm means visible control,
provenance, undo and what happens next. The first screen must answer one human question before
showing implementation evidence.

## Huashu Review

Huashu app-UI judgement prioritizes functionality and craft before visual decoration. The previous
default route failed that standard because it:

- made evidence the product surface;
- created an effectively endless status list;
- mixed phase completion, blockers and product content in one viewport;
- hid the core Folio answer behind proof panels;
- implied UX completion where the repo only had contracts, fixtures and synthetic shells.

## Fix Applied

- Moved the old evidence harness from `apps/mobile/app/index.tsx` to
  `apps/mobile/app/evidence.tsx`.
- Rebuilt `apps/mobile/app/index.tsx` as a bounded product shell using the supplied research and
  interaction prototype:
  - Today answer with breathing-room horizon;
  - Calendar route view;
  - Melo conversation with source/provenance rows;
  - what-if purchase test that does not save;
  - bad-month recovery mode;
  - More screen with evidence clearly separated from daily product use.
- Second recovery pass added the research-backed first-minute path:
  - private sample before permissions or import;
  - playable route-change proof;
  - import-as-discovery progress;
  - first answer before perfect data;
  - direct Today source/provenance sheet;
  - import review screen with original wording, Folio interpretation, confidence, status and undo.
- Removed engineering evidence from the product More surface. The later route-surface cleanup
  removed `/evidence` from the Expo app entirely; phase evidence remains in docs and test adapters,
  not as a user-facing APK route.
- Third recovery pass fixed interaction gaps found during Huashu review:
  - Android hardware back now closes sheets first, steps back through the first-minute path, and
    returns secondary product tabs to Today.
  - First-minute progress now lives in the root app state instead of being trapped inside a child
    component.
  - Import review actions now give explicit feedback instead of rendering fake buttons.
- Fourth recovery pass superseded the third-pass reconstruction and re-anchored the app to the
  supplied zip package:
  - `packages/ui/src/tokens.ts` now uses the prototype's exact warm paper, deep ink, green, amber
    and coral token values.
  - `apps/mobile/app/index.tsx` now follows the zip's first-minute sequence: Welcome to Folio,
    "Show me in 20 seconds", private playable proof, import-as-discovery and first relief answer.
  - Today now leads with the direct answer, breathing-room amount, confidence, tight point, visible
    route and Melo note rather than an evidence dashboard.
  - Import review now uses "I found enough to start", original bank wording, review actions and
    explicit feedback.
  - Bad-month recovery now uses "The repair changes July. It doesn't erase the plan" and preserves
    dignity through route facts.
  - Figma now has a canonical zip-reference page with both supplied PNG boards. Earlier generated
    Figma parity frames are retained only as superseded work history.

## Huashu Score After Zip-Canonical Pass

Overall: 8.1/10. This is now a credible zip-aligned interactive prototype, not final product UX.

- Functionality: 8.2/10. The core promise is playable: first relief, route change, source discovery,
  Today, import review, recovery and Android back behavior.
- Craft quality: 7.8/10. Typography, touch targets and spacing are controlled; remaining issues are
  native motion polish, real drag interaction and dev-client overlay noise in screenshots.
- Visual hierarchy: 8.3/10. The first answer, money state, confidence and consequence rows are now
  the primary viewport instead of evidence/status material.
- Philosophy alignment: 8.8/10. The app now follows "feel the route, not a dashboard", "calm through
  visible control" and "bad month changes the route" directly from the zip.
- Originality: 7.4/10. The route/provenance model is distinctive; final product UX still needs
  richer native motion and tested interaction details.

Remaining critical issues: no real persistence, no live data, no production accessibility audit, no
large-text recording, no reduced-motion recording and no full production component parity in Figma.
The Expo dev-client Tools overlay is not app UI and must not be judged as product surface.

## Current UI Readiness

Status: zip-aligned interactive prototype, not final UX.

This is now a better starting point because the default app follows the supplied research boards and
interaction prototype instead of generated evidence screens. It still needs native accessibility
recordings, large-text verification, reduced-motion verification, user testing, real data and
production Figma/component parity before UX can be called ready.

## Non-UI Phase Audit

The repo already records that Phase 4 through Phase 14 are mostly deterministic contracts,
fixtures, shell previews and release blockers. The compatibility matrix and release blocker register
must remain the authority for readiness claims:

- `docs/release-compatibility-matrix.md`
- `tooling/config/release-blockers.json`
- `STATUS.md`

Do not describe later phases as production-complete until their blockers close with external or
native evidence.

## Verification

- Android 10/10 local-candidate first-minute proof:
  `docs/release-evidence/android-ui-10-10-first-minute.png`.
- Android 10/10 local-candidate playable proof:
  `docs/release-evidence/android-ui-10-10-playable.png`.
- Android 10/10 local-candidate playable moved proof:
  `docs/release-evidence/android-ui-10-10-playable-moved.png`.
- Android 10/10 local-candidate what-if proof:
  `docs/release-evidence/android-ui-10-10-what-if.png`.
- Android 10/10 local-candidate import discovery proof:
  `docs/release-evidence/android-ui-10-10-import-discovery.png`.
- Android 10/10 local-candidate first answer proof:
  `docs/release-evidence/android-ui-10-10-first-answer.png`.
- Android 10/10 local-candidate Today proof:
  `docs/release-evidence/android-ui-10-10-today.png`.
- Android 10/10 local-candidate source sheet proof:
  `docs/release-evidence/android-ui-10-10-sources.png`.
- Android 10/10 local-candidate import review proof:
  `docs/release-evidence/android-ui-10-10-import-review.png`.
- Android 10/10 local-candidate review action proof:
  `docs/release-evidence/android-ui-10-10-import-review-confirmed.png`.
- Android 10/10 local-candidate recovery proof:
  `docs/release-evidence/android-ui-10-10-recovery.png`.
- Figma 10/10 local-candidate board proof:
  `docs/release-evidence/figma-10-10-local-candidate.png`.
- `pnpm --filter @folio/mobile typecheck`: passed after the route split.
- `pnpm run ci`: passed after formatting the recovered route and excluding archived UI source
  artifacts from Prettier checks.
- Android first-screen proof:
  `docs/release-evidence/android-open-app-ui-recovery.png`.
- Android what-if sheet proof:
  `docs/release-evidence/android-open-app-ui-recovery-what-if.png`.
- Android UI tree proof:
  `docs/release-evidence/android-open-app-ui-recovery.xml`.
- Android first-minute proof:
  `docs/release-evidence/android-ui-first-minute-recovery.png`.
- Android playable proof:
  `docs/release-evidence/android-ui-first-minute-playable.png`.
- Android playable moved proof:
  `docs/release-evidence/android-ui-first-minute-playable-moved.png`.
- Android import discovery proof:
  `docs/release-evidence/android-ui-first-minute-import-discovery.png`.
- Android first answer proof:
  `docs/release-evidence/android-ui-first-minute-first-answer.png`.
- Android Today after first-minute proof:
  `docs/release-evidence/android-ui-today-after-first-minute.png`.
- Android source sheet proof:
  `docs/release-evidence/android-ui-source-sheet-recovery.png`.
- Android import review proof:
  `docs/release-evidence/android-ui-import-review-recovery.png`.
- Android More surface proof:
  `docs/release-evidence/android-ui-more-recovery.png`.
- Android third-pass UI tree proof:
  `docs/release-evidence/android-ui-current-after-third-pass.xml`.
- Android third-pass first-minute proof:
  `docs/release-evidence/android-ui-first-minute-third-pass.png`.
- Android third-pass playable proof:
  `docs/release-evidence/android-ui-playable-third-pass.png`.
- Android third-pass playable moved proof:
  `docs/release-evidence/android-ui-playable-moved-third-pass.png`.
- Android third-pass hardware-back proof:
  `docs/release-evidence/android-ui-hardware-back-third-pass.png`.
- Android third-pass Today proof:
  `docs/release-evidence/android-ui-today-third-pass.png`.
- Android third-pass More proof:
  `docs/release-evidence/android-ui-more-third-pass.png`.
- Android third-pass import review proof:
  `docs/release-evidence/android-ui-import-review-before-action-third-pass.png`.
- Android third-pass import review action proof:
  `docs/release-evidence/android-ui-import-review-action-third-pass.png`.
- Android third-pass import review back-to-Today proof:
  `docs/release-evidence/android-ui-import-review-back-to-today-third-pass.png`.
- Figma canonical zip-reference proof:
  `docs/release-evidence/figma-canonical-zip-reference.png`.
- Android zip-canonical first-minute proof:
  `docs/release-evidence/android-ui-zip-canonical-first.png`.
- Android zip-canonical playable proof:
  `docs/release-evidence/android-ui-zip-canonical-playable.png`.
- Android zip-canonical playable moved proof:
  `docs/release-evidence/android-ui-zip-canonical-playable-moved.png`.
- Android zip-canonical import discovery proof:
  `docs/release-evidence/android-ui-zip-canonical-import-discovery.png`.
- Android zip-canonical first answer proof:
  `docs/release-evidence/android-ui-zip-canonical-first-answer.png`.
- Android zip-canonical Today proof:
  `docs/release-evidence/android-ui-zip-canonical-today-opaque-nav.png`.
- Android zip-canonical More proof:
  `docs/release-evidence/android-ui-zip-canonical-more.png`.
- Android zip-canonical import review proof:
  `docs/release-evidence/android-ui-zip-canonical-import-review.png`.
- Android zip-canonical import review action proof:
  `docs/release-evidence/android-ui-zip-canonical-import-review-action.png`.
- Android zip-canonical bad-month recovery proof:
  `docs/release-evidence/android-ui-zip-canonical-recovery.png`.
