# Folio V2 Native Evidence Review + Critical Fix Pass

Date: 2026-06-23

Artifact reviewed: `apps/mobile/evidence/interactive-object-reality-pass-2026-06-23`

Result: Android native evidence reviewed, evidence-backed P0/P1/P2 copy and reality-label issues fixed, refreshed Android screenshots/XML captured for changed surfaces.

## Executive Summary

Folio's Android V2 surfaces are product-real enough for internal human testing after this pass. The main weakness found in the native evidence was not layout failure; it was language that could make internal implementation states look like user-facing truth.

The most serious issue was the empty local workspace route: a placeholder zero balance could still appear as confirmed in route/search wording. That has been corrected to "needs source" / "empty local baseline, not a confirmed bank balance." Import Review and Data Control also had empty-state wording that implied records or sources existed when they did not. Timeline/Today accessibility copy exposed internal "canonical repository" language; those strings now speak in user terms: local records, review items, source, balance record, plan impact.

No new product scope was added. No Business UI, sync, Open Banking, AI gateway, final Melo runtime, billing, OCR, or visual redesign was built.

## Evidence Reviewed

- Original evidence reviewed: 92 PNG screenshots and 92 XML dumps.
- Original location: `apps/mobile/evidence/interactive-object-reality-pass-2026-06-23/screenshots` and `apps/mobile/evidence/interactive-object-reality-pass-2026-06-23/logs`.
- Review helper contact sheets: 4 PNGs in `native-evidence-review-2026-06-23/contact-sheets`.
- Updated review evidence now captured: 36 screenshots and 37 XML dumps in `native-evidence-review-2026-06-23`.
- One black startup capture, `review-current-launch.*`, was not used as product evidence; it caught the app before React Native finished rendering.

Final refreshed captures used for verification:

- `screenshots/review-today-final-copy.png` and `logs/review-today-final-copy.xml`
- `screenshots/review-timeline-final-copy.png` and `logs/review-timeline-final-copy.xml`
- `screenshots/review-plans-final-copy.png` and `logs/review-plans-final-copy.xml`
- `screenshots/review-more-final-copy.png` and `logs/review-more-final-copy.xml`
- `screenshots/review-import-empty-final-copy.png` and `logs/review-import-empty-final-copy.xml`
- `screenshots/review-data-control-empty-final-copy.png` and `logs/review-data-control-empty-final-copy.xml`
- `screenshots/review-data-control-empty-controls-final-copy.png` and `logs/review-data-control-empty-controls-final-copy.xml`

Final XML checks found no matches for the stale critical strings:

- `canonical repository`
- `canonical changes`
- `directly reported truth`
- `Opening balance`
- `user confirmed`
- `confirmed - Empty`
- `Current source: Local statement`
- `Folio keeps this staged`
- `REVEAL`
- `MAKE REAL`
- `make records real`
- `linked canonical`

## Score Legend

Columns: `Read` readability, `Touch` touch target clarity, `Scroll` scroll behavior, `Safe` emotional safety, `Src` source/provenance clarity, `NoShame` no-shame language, `NoAdvice` advice avoidance, `Review` review-before-write clarity, `Local` local-first clarity, `Hier` hierarchy, `Melo` Melo appropriateness, `Native` Android/native feel.

Scores are 1-10 and based on the reviewed Android screenshot/XML evidence.

| Surface              | Read | Touch | Scroll | Safe | Src | NoShame | NoAdvice | Review | Local | Hier | Melo | Native | State                                              |
| -------------------- | ---: | ----: | -----: | ---: | --: | ------: | -------: | -----: | ----: | ---: | ---: | -----: | -------------------------------------------------- |
| First launch         |    8 |     8 |      8 |    9 |   8 |      10 |       10 |      9 |     9 |    8 |    7 |      7 | Working                                            |
| Sample briefing      |    7 |     7 |      7 |    8 |   8 |      10 |       10 |      9 |     8 |    7 |    7 |      6 | Working, text-heavy                                |
| Import entry         |    8 |     8 |      7 |    9 |   9 |      10 |       10 |      9 |     9 |    8 |    6 |      7 | Fixed                                              |
| Staged import review |    8 |     8 |      7 |    8 |   9 |      10 |       10 |      9 |     9 |    8 |    6 |      7 | Working                                            |
| Accepted import      |    8 |     8 |      7 |    8 |   9 |      10 |       10 |      9 |     9 |    8 |    6 |      7 | Working                                            |
| Edited import        |    7 |     8 |      7 |    8 |   9 |      10 |       10 |      9 |     9 |    7 |    6 |      7 | Working                                            |
| Rejected import      |    8 |     8 |      7 |    8 |   9 |      10 |       10 |      9 |     9 |    7 |    6 |      7 | Working                                            |
| Minimal manual path  |    7 |     8 |      7 |    8 |   8 |      10 |       10 |      9 |     9 |    7 |    6 |      7 | Working                                            |
| Today                |    8 |     8 |      7 |    9 |   9 |      10 |       10 |      9 |     9 |    8 |    7 |      7 | Fixed                                              |
| Timeline             |    8 |     8 |      7 |    8 |   8 |      10 |       10 |      8 |     8 |    7 |    6 |      7 | Fixed                                              |
| Calendar             |    8 |     8 |      7 |    8 |   8 |      10 |       10 |      8 |     8 |    7 |    6 |      7 | Fixed copy                                         |
| Plans                |    8 |     8 |      7 |    8 |   8 |      10 |       10 |      8 |     8 |    7 |    6 |      7 | Fixed copy                                         |
| Recovery preview     |    8 |     8 |      7 |    8 |   8 |      10 |       10 |      9 |     8 |    7 |    6 |      7 | Working, still dense                               |
| Accepted recovery    |    7 |     7 |      7 |    8 |   8 |      10 |       10 |      9 |     8 |    7 |    6 |      7 | Not present as a final refreshed 92-folder capture |
| Data Control         |    8 |     8 |      7 |    9 |   9 |      10 |       10 |      9 |    10 |    8 |    6 |      7 | Fixed                                              |
| Melo                 |    7 |     8 |      7 |    8 |   8 |      10 |       10 |      9 |     8 |    7 |    7 |      6 | Working, text-heavy                                |
| Status chips         |    8 |     8 |      8 |    8 |   8 |      10 |       10 |      8 |     9 |    8 |    6 |      7 | Working                                            |
| Breathing room route |    8 |     8 |      7 |    8 |   9 |      10 |       10 |      8 |     8 |    7 |    6 |      7 | Fixed                                              |
| Interaction states   |    8 |     8 |      7 |    8 |   8 |      10 |       10 |      9 |     8 |    7 |    6 |      7 | Fixed                                              |
| Empty/cleared state  |    8 |     8 |      7 |    9 |   9 |      10 |       10 |      9 |    10 |    8 |    6 |      7 | Fixed                                              |

## P0 Findings Fixed

1. Empty workspace baseline could look confirmed.

Evidence: original Today/status/XML dumps exposed empty route points as "Confirmed" or old manual opening-balance language in some states.

Fix:

- Empty route point now renders as `Needs source`.
- Search/detail wording says `needs source - Empty workspace - No source yet`.
- Today route copy says the zero is an empty local baseline, not a confirmed bank balance.
- Breathing route accessibility says one point still needs a source.

Verified by:

- `logs/review-today-final-copy.xml`
- `logs/review-timeline-final-copy.xml`
- Focused tests in `localLedger.test.ts`, `localTimelineAdapter.test.ts`, and `localTodayAdapter.test.ts`.

## P1 Findings Fixed

1. Import Review empty state implied a source existed.

Evidence: original empty Import Review exposed `Current source: Local statement` and "Folio keeps this staged..." even when no row was staged.

Fix:

- Empty Import Review no longer defaults to `Local statement`.
- Trust copy now says `Rows stay staged until you review them.`
- Final capture shows `No import rows waiting` and no phantom current source.

Verified by:

- `logs/review-import-empty-final-copy.xml`
- `screenshots/review-import-empty-final-copy.png`

2. Data Control empty state implied a clear action could be performed.

Evidence: original empty/cleared data control still used "needs user confirmation", `Arm clear`, `Clear records`, `REVEAL`, or `MAKE REAL` style labels in disabled clear states.

Fix:

- Empty clear tile state is `disabled`.
- Empty buttons render `Already empty` / `No records`.
- Disabled intent eyebrow renders `No action`.
- Empty interaction strip says inspect/export/already empty rather than clear-confirmation language.

Verified by:

- `logs/review-data-control-empty-final-copy.xml`
- `logs/review-data-control-empty-controls-final-copy.xml`

3. Today/Timeline exposed implementation language.

Evidence: original and intermediate XML exposed phrases such as "canonical repository collections", "canonical current balance", and "derived from canonical inputs".

Fix:

- Today assumptions now say local records and review items.
- Timeline briefing now says timeline rows from local records and review items.
- Balance evidence says balance source / reviewed balance record.
- Plan, calendar, decision, audit, and evidence summaries use user-facing local-record wording.

Verified by:

- `logs/review-today-final-copy.xml`
- `logs/review-timeline-final-copy.xml`
- `logs/review-calendar-clean-final.xml`
- focused tests blocking these strings in serialized surface models.

## P2 Findings Fixed

1. Remaining interaction jargon.

Evidence: final-copy recapture before patch still showed uppercase `REVEAL` on Plans and More button eyebrows.

Fix:

- Shared button intent helper now uses:
  - `Try first`
  - `Show sources`
  - `Open`
  - `Record after review`
  - `No action`
- Interaction ribbons now use `Review first`, `Show source`, `Try first`, and `Show sources` where applicable.
- Old "make records real" accessibility sentences were replaced with "record only after review."

Verified by:

- `logs/review-plans-final-copy.xml`
- `logs/review-more-final-copy.xml`
- `logs/review-import-empty-final-copy.xml`

2. Timeline event copy sounded generated/internal.

Fix:

- Money-event and balance-event details now speak as recorded money movement, planned money movement, balance source, and balance record.
- Timeline empty rows now title `Balance needs source`.

Verified by:

- `screenshots/review-timeline-final-copy.png`
- `logs/review-timeline-final-copy.xml`

## P3 / Remaining Evidence Gaps

- Melo is policy-safe but still text-heavy. Final Melo character runtime is intentionally out of scope.
- Accepted recovery was not captured as a final refreshed screen in this pass's current empty workspace state; original evidence and model tests cover the flow, but a dedicated native accepted-recovery replay should be part of the next Android evidence pass.
- Some original XML dumps contain clipped offscreen nodes at scroll boundaries. The controls themselves are usable, but tap-target proof should be repeated with a scripted viewport matrix in a future pass.
- Android evidence is stronger than iOS evidence. An iOS evidence pass is still needed before external mobile testing.
- Several surfaces are still dense. This pass intentionally did not redesign them.

## Files Changed

Implementation:

- `apps/mobile/src/local/canonicalExperienceEvidence.ts`
- `apps/mobile/src/local/localCalendarAdapter.ts`
- `apps/mobile/src/local/localLedger.ts`
- `apps/mobile/src/local/localPlansAdapter.ts`
- `apps/mobile/src/local/localTimelineAdapter.ts`
- `apps/mobile/src/local/localTodayAdapter.ts`
- `apps/mobile/src/local/productExperienceEvidence.ts`
- `apps/mobile/src/local/productExperienceLoop.ts`
- `apps/mobile/src/surfaces/dataControlSurface.tsx`
- `apps/mobile/src/surfaces/mobileShell.tsx`

Tests:

- `apps/mobile/src/local/canonicalProductExperienceLoop.test.ts`
- `apps/mobile/src/local/localLedger.test.ts`
- `apps/mobile/src/local/localTimelineAdapter.test.ts`
- `apps/mobile/src/local/localTodayAdapter.test.ts`
- `apps/mobile/src/surfaces/interactiveObjectReality.test.ts`

Evidence/report:

- `apps/mobile/evidence/interactive-object-reality-pass-2026-06-23/native-evidence-review-2026-06-23/NATIVE_EVIDENCE_REVIEW_CRITICAL_FIX_REPORT_2026-06-23.md`
- refreshed screenshots/XML in `native-evidence-review-2026-06-23/screenshots` and `native-evidence-review-2026-06-23/logs`

## Tests Added Or Updated

Added/updated assertions prove:

- Empty workspace baseline does not serialize as user-confirmed opening balance.
- Empty route search details do not say `confirmed - Empty workspace`.
- Timeline empty balance rows say `Balance needs source`.
- Today and Timeline serialized surfaces do not expose canonical repository/current-balance/balance-observation wording.
- Import empty trust copy uses staged-row wording without implying a phantom source.
- Interaction object source checks still cover route, recovery, import, data control, Melo, status chips, and money rows.
- No shame/advice/fake-score wording appears in the tested surfaces.

Focused test results before full CI:

- `pnpm vitest run apps/mobile/src/local/localTodayAdapter.test.ts apps/mobile/src/local/localTimelineAdapter.test.ts apps/mobile/src/local/localCalendarAdapter.test.ts apps/mobile/src/local/localPlansAdapter.test.ts apps/mobile/src/local/canonicalProductExperienceLoop.test.ts apps/mobile/src/surfaces/interactiveObjectReality.test.ts`
- Result: 6 files passed, 36 tests passed.

- `pnpm vitest run apps/mobile/src/surfaces/interactiveObjectReality.test.ts apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts apps/mobile/src/local/localTodayAdapter.test.ts apps/mobile/src/local/localTimelineAdapter.test.ts`
- Result: 4 files passed, 25 tests passed.

## CI Result

Full CI passed.

Command: `pnpm run ci`

Passed:

- Dependency boundaries
- V1 boundary proof
- Synthetic-data policy
- Product constitution gate
- Canonical product gates
- Prettier format check
- TypeScript build/typecheck
- Vitest: 55 test files passed, 503 tests passed
- Source-package validation and fixture consistency validation

Important note: the CI command prints existing operations/store/public-release blockers as status reports:

- operations readiness is blocked by incomplete tabletop exercise, missing rotation drills, and missing vulnerability disclosure channel
- store declarations are blocked by missing submitted-binary/store-console/privacy/processor/SDK proof
- public release remains blocked by the known release-readiness list, including iOS native smoke, secure keys proof, document/OCR proof, vault real-data E2E, independent security review, DPIA/legal signoff, independent accessibility audit, cloud account deletion, store declarations, and native billing proof

Those blockers pre-existed this pass and did not cause the CI command to fail.

## Remaining Blockers

No blocker remains for this pass. Remaining gaps are evidence coverage gaps, not implementation blockers.

## Canonical Model Conflicts Found

No canonical model conflict was introduced. The fixes reduce conflict by making user-facing surfaces respect the model distinction between local facts, review items, source evidence, and placeholder baseline records.

The canonical repository remains the implementation source of truth, but the UI no longer exposes "canonical repository" as user language.

## Summary Of What Was Implemented

- Empty route/balance evidence now consistently says "needs source" instead of confirmed.
- Import Review empty state no longer implies staged rows or a current statement source.
- Data Control empty state is disabled/no-action instead of armed/clearable.
- Today, Timeline, Calendar, Plans, and evidence summaries use local-record language instead of implementation terminology.
- Button intent eyebrows no longer show `REVEAL` or `MAKE REAL`; they use `Open`, `Show sources`, `Try first`, `Record after review`, and `No action`.
- Fresh Android screenshots/XML were captured for the changed surfaces and checked against stale wording.

## Readiness

Ready for internal human Android testing: yes.

Ready for external user testing: not yet. The product still needs an iOS evidence pass, accepted-recovery native replay, and a focused manual usability pass for density/tap comfort.

Recommended next pass: Android accepted-recovery replay plus iOS evidence pass using the same XML/screenshot scoring method.
