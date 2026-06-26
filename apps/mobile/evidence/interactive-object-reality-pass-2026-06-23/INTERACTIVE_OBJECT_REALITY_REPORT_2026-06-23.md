# Folio V2 Interactive Object Reality Pass

Date: 2026-06-23

Scope: Make visible Folio mobile UI objects interactive, data-driven, source-backed, and emotionally clear without adding new product scope.

Out of scope by instruction:

- Business UI
- Cloud sync
- Open Banking
- AI gateway
- Billing
- OCR pipeline
- Final Melo character runtime
- Full brand redesign
- Generic budgeting dashboard

## Executive Summary

This pass moved the mobile shell away from static proof components and toward real Folio interaction objects.

The main product surfaces now expose source, state, provenance, authority, and next action for visible financial objects: route points, key money numbers, calendar days, timeline rows, plan cards, recovery previews, import review rows, Data Control tiles, Melo notes/proposals, and Personal/Local status chips.

The evidence bundle contains Android emulator screenshots and UI XML proving populated, staged, preview-only, and cleared/empty states. The after-clear evidence specifically distinguishes an empty workspace from a confirmed zero balance.

No Business UI, sync, Open Banking, AI gateway, billing, OCR pipeline, final Melo runtime, or visual redesign was added.

No canonical conflict was found or introduced.

## 1. Files Changed

Implementation:

- `apps/mobile/app/index.tsx`
- `apps/mobile/src/local/canonicalLedgerAdapter.ts`
- `apps/mobile/src/local/localLedger.ts`
- `apps/mobile/src/local/localCalendarAdapter.ts`
- `apps/mobile/src/local/localPlansAdapter.ts`
- `apps/mobile/src/local/localScenarioAdapter.ts`
- `apps/mobile/src/surfaces/mobileShell.tsx`
- `apps/mobile/src/surfaces/dataControlSurface.tsx`

Tests:

- `apps/mobile/src/local/localLedger.test.ts`
- `apps/mobile/src/local/localTodayAdapter.test.ts`
- `apps/mobile/src/local/canonicalBalanceAuthority.test.ts`
- `apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts`
- `apps/mobile/src/surfaces/interactiveObjectReality.test.ts`

Evidence/report:

- `apps/mobile/evidence/interactive-object-reality-pass-2026-06-23/screenshots/*.png`
- `apps/mobile/evidence/interactive-object-reality-pass-2026-06-23/logs/*.xml`
- `apps/mobile/evidence/interactive-object-reality-pass-2026-06-23/INTERACTIVE_OBJECT_REALITY_REPORT_2026-06-23.md`

Repository note: this checkout reports the whole repository as untracked, so `git diff --name-only` is not useful. The list above is the manually audited pass scope.

## 2. Breathing Room Route Implementation

The route is now a data-driven object surface rather than a placeholder chart.

Route points carry:

- date
- amount
- label/title
- point kind: confirmed, expected, commitment, plan, preview, shortfall
- review state
- source label
- provenance label
- authority label
- action label
- accessible label
- dependency/source links
- protected amount where available

Implemented behavior:

- Today route points are tappable.
- Tapping a point reveals why it exists, where it came from, and what action is available.
- Scenario/recovery points are labelled as preview-only and hypothetical.
- Empty workspaces are labelled as needing a source, not as confirmed zero-balance reality.
- Search prefers concrete local records before derived route points.

Used in:

- Today
- Calendar
- Minimal Manual Path / quick estimate
- Recovery Preview
- Money what-if

Evidence:

- `65-quick-estimate-values-entered-final.png`
- `66-quick-estimate-preview-after-scroll.png`
- `67-quick-estimate-save-area.png`
- `68-quick-estimate-saved-today.png`
- `69-today-saved-route-top.png`
- `77-money-saved-route-sources.png`
- `84-recovery-spend-from-more-saved-route.png`
- `85-recovery-spend-preview-filled.png`
- `92-today-after-clear-empty-route.png`

## 3. Preview / Reveal / Make Real State Model

The interaction language is now operational across touched surfaces.

States used:

- available
- disabled
- requires review
- preview only
- accepted
- rejected
- already real
- needs source
- needs user confirmation

Operational meaning:

- Preview simulates without writing.
- Reveal exposes source, assumptions, and consequences.
- Make real requires user confirmation before writing to local/canonical reality.

Examples now visible in product:

- Import Review: staged rows can be accepted, edited, or rejected; no-staged state no longer overclaims.
- Recovery: preview first, inspect protected items/pressure, save only after review.
- Data Control: inspect/export/clear with clear gated behind arming.
- Melo: asks/explains/proposes but does not write.
- Today/Money: key values expose source and review state.

Evidence:

- `35-import-statement-text-entered-visible.png`
- `36-import-row-staged.png`
- `46-import-review-row-states.png`
- `47-import-review-row-actions.png`
- `77-money-saved-route-sources.png`
- `84-recovery-spend-from-more-saved-route.png`
- `85-recovery-spend-preview-filled.png`
- `87-data-control-before-clear.png`
- `89-data-control-clear-buttons.png`
- `90-data-control-clear-armed.png`
- `91-data-control-after-clear-empty.png`

## 4. Calendar Improvements

Calendar now shows money-aware day meaning rather than plain date boxes.

Calendar rows and selected days expose:

- income/payday days
- commitment/bill days
- review/pressure states
- route and plan-linked days
- source/state/action labels
- selected-day route balance and linked route item count

Tapping a day reveals linked canonical-derived items and selected-day route context.

Evidence:

- `70-calendar-saved-route-days.png`
- `71-calendar-day-grid-saved-route.png`
- `72-calendar-bill-day-selected.png`

## 5. Timeline Improvements

Timeline now reads as a financial story surface instead of a long canonical debug list.

Rows are grouped into:

- Now
- Needs review
- Coming up
- Plan movement
- History

Each visible row carries:

- human title
- one-line explanation
- status/authority label
- source/action metadata
- optional expanded details

Long details are shortened by default and revealed on tap.

Evidence:

- `73-timeline-saved-route-groups.png`
- `74-timeline-row-revealed.png`

## 6. Plan Card Improvements

Plan cards now behave like inspectable commitment objects.

Visible card content includes:

- plan title
- intention
- protected amount/rule
- current visible state
- due/review date
- next expected movement
- affected-by source
- linked evidence
- assumptions
- authority/review/source labels

Tapping exposes rule, evidence, assumption, and route-dependency details.

Reality boundary: this pass did not add a full plan creation/editing UI. It made the visible plan object source-backed and inspectable.

Evidence:

- `75-plans-saved-route-top.png`
- `76-plans-row-revealed.png`

## 7. Recovery Improvements

Recovery is now framed as a safe preview before any negative consequence becomes the emotional centre.

The surface visibly establishes:

- this is a preview
- nothing has changed yet
- user reviews before saving
- protected items remain visible
- pressure and after-spend route are inspectable
- saving only happens after user confirmation

Runtime evidence captured preview/no-mutation behavior. Accepted recovery save was not captured in this pass.

Evidence:

- `84-recovery-spend-from-more-saved-route.png`
- `85-recovery-spend-preview-filled.png`

Note: the emulator input captured the recovery title as `Car%20repair`; that is an ADB text-input artifact, not product copy.

## 8. Import Review Improvements

Import rows now behave like review objects.

Staged rows expose:

- original source text/value
- possible Folio interpretation
- review state
- source/provenance
- consequences of accepting/editing/rejecting

Implemented/represented states include:

- staged / needs review
- ready for user confirmation
- accepted
- edited
- rejected/dismissed
- duplicate/review reasons
- parser issue/review reasons

The known risk was fixed: when no staged rows exist, Import Review now says `No import rows waiting.` and explains that nothing becomes accepted reality until review.

Evidence:

- `35-import-statement-text-entered-visible.png`
- `36-import-row-staged.png`
- `37-import-row-state-card.png`
- `45-import-review-open-with-staged-row.png`
- `46-import-review-row-states.png`
- `47-import-review-row-actions.png`
- `83-import-review-no-staged-saved-route.png`

## 9. Data Control Improvements

Data Control tiles are now live trust objects.

Tiles include:

- Local data
- Accepted reality
- Staged data
- Rejected evidence
- Audit history
- Exports
- Clear data

Each tile exposes a scope, count/value, object state, and reveal detail.

The known clear-data risk was addressed:

- clearing is gated behind an arm step
- clear removes local records, staged rows, rejected evidence, source names, and local history
- after clear, the workspace is described as empty
- the zero route point is described as a placeholder/baseline, not confirmed zero balance
- the canonical Today source trail now labels the empty baseline as estimated and needing review, not user-confirmed

Evidence:

- `11-data-control-tiles-empty-vs-zero.png`
- `12-data-control-tile-reveal.png`
- `80-more-data-control-saved-state.png`
- `81-data-control-saved-records.png`
- `87-data-control-before-clear.png`
- `88-data-control-clear-controls.png`
- `89-data-control-clear-buttons.png`
- `90-data-control-clear-armed.png`
- `91-data-control-after-clear-empty.png`
- `92-today-after-clear-empty-route.png`

## 10. Melo Pattern Improvements

Melo now sits beside system state rather than acting as authority.

Standard states are visible:

- Melo noticed
- Melo checked
- Melo needs review
- Melo can explain
- Melo proposes
- User decides

Melo behavior remains policy-gated through `@folio/melo-policy` via the local adapter. Melo output does not directly write financial state, hide source/evidence, claim false certainty, give advice, shame, or nag.

Evidence:

- `78-melo-saved-route-policy.png`
- `79-melo-answer-policy-gated.png`

## 11. Status Chip Improvements

Personal and Local chips now behave as reveal controls.

Personal reveals:

- current workspace is Personal
- Business remains separate
- Business UI is not built in this pass

Local reveals:

- records are local to the device
- cloud, AI, and Open Banking are optional enhancements
- sync is not implied

Evidence:

- `02-status-personal-local-reveal.png`
- `03-status-local-reveal.png`
- `86-local-status-chip-revealed-saved-state.png`
- `92-today-after-clear-empty-route.png`

## 12. Money Number Source/Reveal Improvements

Key amounts now have source/reveal paths.

Covered amounts include:

- available now
- lowest point
- protected amount
- after-spend amount
- current position
- route balance by day
- export preview amount

Important money numbers expose:

- what the number means
- source/provenance
- review/authority state
- dependency route point or linked object
- what changes next where available

Evidence:

- `69-today-saved-route-top.png`
- `71-calendar-day-grid-saved-route.png`
- `72-calendar-bill-day-selected.png`
- `75-plans-saved-route-top.png`
- `77-money-saved-route-sources.png`
- `81-data-control-saved-records.png`
- `85-recovery-spend-preview-filled.png`
- `92-today-after-clear-empty-route.png`

## 13. Screenshots / Evidence Paths

Evidence root:

`apps/mobile/evidence/interactive-object-reality-pass-2026-06-23`

Captured artifacts:

- 92 screenshots
- 92 matching UI XML dumps

Evidence groups:

- `01` to `15`: initial object-reality surfaces in empty/local state
- `16` to `34`: navigation and import-entry setup
- `35` to `47`: staged import row and import review
- `48` to `67`: quick-estimate entry, preview, and save
- `68` to `69`: saved Today route
- `70` to `72`: saved Calendar
- `73` to `74`: saved Timeline
- `75` to `76`: saved Plans
- `77`: Money what-if preview
- `78` to `79`: Melo policy-gated interpretation
- `80` to `81`: More/Data Control saved state
- `82` to `83`: Import review after saved route
- `84` to `85`: Recovery preview guardrails
- `86`: Local status chip reveal on saved state
- `87` to `92`: Data Control clear path and after-clear empty route

## 14. Tests Added / Updated

Added:

- `apps/mobile/src/surfaces/interactiveObjectReality.test.ts`

Updated:

- `apps/mobile/src/local/localLedger.test.ts`
- `apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts`

Test coverage added/confirmed:

- Breathing Room Route points carry source/state/action/provenance metadata.
- Route reacts to commitments, income, plans, scenarios, shortfall, and preview states.
- Preview and shortfall states are marked correctly.
- Calendar identifies bill/commitment, route, plan, and pressure-style day meanings.
- Timeline rows are grouped and use concise default text.
- Plan cards expose rules, impacts, evidence, assumptions, and authority state.
- Recovery preview includes preview framing before consequences.
- Import Review no-staged state is not overconfident.
- Cleared/empty Data Control state is not confused with zero balance.
- Empty Today source evidence does not label a cleared baseline as user-confirmed.
- Melo copy is policy-gated.
- Status chips do not imply unavailable sync or Business UI.
- Key amounts have source/reveal access.
- No fake score/confidence/advice/shame/streak wording appears in touched surfaces.

## 15. CI Result

Command:

```text
pnpm run ci
```

Latest result on the current pass state: passed.

- 55 test files passed.
- 502 tests passed.
- Formatting passed.
- Typecheck passed.
- Boundary checks passed.
- V1 boundary checks passed.
- Sample-data checks passed.
- Product constitution checks passed.
- Canonical product gates passed.
- Contract validation passed.

CI printed existing release-readiness blockers but exited successfully:

- Operations readiness still blocked by tabletop, rotation drill, and vulnerability disclosure gaps.
- Store declarations still blocked by unsubmitted/unreviewed store declarations and privacy/SDK/deletion review gaps.
- Public release gate still blocked by 23 release items including iOS native smoke, secure key proof, native documents/OCR proof, vault real-data E2E, independent security/privacy/accessibility review, account deletion, store declarations, and native billing proof.

## 16. Remaining Interaction Gaps

- Full plan creation/editing remains outside this pass.
- Accepted recovery save was not captured as emulator evidence; preview/no-mutation behavior was captured.
- Import Review has staged/accept/edit/reject semantics, but wrong-workspace/internal-transfer classifications need richer fixture evidence if they become a focus.
- Business workspace UI remains intentionally absent.
- Cloud sync, Open Banking, AI gateway, billing, OCR, and final Melo runtime remain intentionally absent.
- Evidence is Android emulator evidence only; no iOS capture was produced.
- The More tab can preserve a child screen while navigating, which made evidence capture awkward. It was observed, not fixed, because navigation persistence was outside this pass.

## 17. Remaining Visual Design Gaps

- This was not a redesign pass, so visual hierarchy is functional rather than final.
- Long, evidence-rich cards can require awkward scrolling on Android.
- Some emulator XML bounds show off-screen/truncated text during scrolled captures; the content exists, but the visual rhythm still needs polish.
- The clear/status overlays and deep More child screens can stack in ways that are understandable but visually busy.
- Iconography remains utilitarian and not final brand expression.

## 18. Canonical Conflicts Found

None found.

Canonical constraints reinforced:

- Facts, interpretation, and preview states stay separate.
- Melo interprets/proposes but does not write reality.
- Empty local data is not treated as confirmed zero financial reality.
- Scenario/recovery previews do not mutate records before user acceptance.
- Personal and Business are presented as separate worlds.
- Cloud, AI, and Open Banking are optional enhancements, not requirements.
- No fake scores, confidence percentages, advice wording, shame language, or streak mechanics were added.
- Import review keeps staged rows reviewable before they become accepted reality.
- Data Control keeps accepted records, staged data, rejected evidence, audit history, export, and clear actions distinct.

## 19. Recommended Next Pass

Run a focused native evidence hardening pass, not a new product-scope pass:

- capture accepted recovery save and its resulting route/timeline/audit effects
- capture richer import review classifications if needed
- capture iOS runtime evidence for the same interaction objects
- tighten More child-screen navigation persistence
- polish dense evidence cards only where readability blocks proof

Do not use that pass to add Business UI, cloud sync, Open Banking, AI gateway, billing, OCR, final Melo runtime, or a visual redesign unless the scope changes explicitly.

## Bottom Line

The requested interaction-object pass is now real at the mobile surface layer. Folio's visible financial objects can answer what they are, where they came from, whether they are confirmed/staged/expected/preview/rejected/user-confirmed, what tapping does, what changes on acceptance/rejection/editing where that action exists, and what evidence is attached.

The pass is bounded: it made current Folio objects inspectable and source-backed; it did not expand product scope.
