# Phase E.2 runtime journeys

Evidence label: Android emulator evidence.

Test profile: dedicated `CloseLedger_Phone` emulator profile, package `com.melomoney.app`.

## Journey matrix

| Journey | Native evidence | Result | Notes |
| --- | --- | --- | --- |
| First Trustworthy Answer empty state | `first-answer-clean-empty-2.png`, `window-first-answer-clean-empty-2.xml` | Passed | Empty state displayed. |
| First Trustworthy Answer minimum manual inputs | `first-answer-clean-minimum.png`, `window-first-answer-clean-minimum.xml` | Passed | Current amount and payday entered. |
| Provisional Safe Range | `first-answer-clean-actions-2.png`, `today-clean-baseline.png` | Passed | Provisional/blocked state surfaced honestly. |
| Missing fact | `first-answer-clean-actions-2.png`, `today-clean-baseline.png` | Passed | Income and material commitments called out. |
| Recalculation after adding fact | `first-answer-recalculated.png`, `window-first-answer-recalculated.xml` | Passed | Recalculation copy appeared after new fact. |
| Continue setup | `first-answer-clean-saved.png`, `today-clean-baseline.png` | Passed | Values carried into Today. |
| Safe Range shortfall | `payday-ritual-finished.png`, `relaunch-persistence-today.png` | Passed | Shortfall state, source/truth details and unknowns visible. |
| Material bill/sub change | `plans-after-second-material-change.png`, `b8bb846-timeline-material-change-fixed.png` | Passed after fix | Timeline now shows material-change card even with no ordinary transaction rows. |
| Financial decision | `first-answer-afford-actions.png`, `first-answer-decision-recorded.png` | Passed | Decision receipt creation shown. |
| Decision History purchase receipt | `decision-history-receipt.png` | Passed | Awaiting outcome and receipt details visible. |
| Recovery preview | `b8bb846-recovery-open.png` | Passed | Shortfall and bundle preview visible. |
| Recovery multiple selected moves | `b8bb846-recovery-two-selected.png` | Passed | Both move cards selected and combined preview updated. |
| Recovery complete recovery | `b8bb846-recovery-rebuild-button.png`, `b8bb846-recovery-committed-today.png` | Passed | Rebuild CTA enabled and commit returned to Today-after state. |
| Recovery persistence | `b8bb846-recovery-persistence-after-relaunch.png` | Passed | Force-stop/relaunch preserved recovery result. |
| Recovery receipt access | `b8bb846-decision-history-after-recovery.png` | Passed | Recovery receipt appears with selected move IDs. |
| Payday accountability | `payday-ritual-start.png`, `payday-ritual-step2-exact.png`, `payday-ritual-step3-exact.png`, `payday-ritual-step4-exact.png`, `payday-ritual-finished.png` | Passed | Forecast accountability, pot step and cycle finish exercised. |
| Correction/recalculation | `first-answer-recalculated.png`, `b8bb846-timeline-material-change-fixed.png`, `b8bb846-decision-history-after-recovery.png` | Partial native, source-tested | Native proof shows recalculation/material-change surfaces and Correct affordance. Direct edit/save correction needs a transaction fixture; automated correction tests remain the proof for immutable correction write. |
| Relaunch persistence | `relaunch-persistence-today.png`, `b8bb846-recovery-persistence-after-relaunch.png` | Passed | Persisted after force-stop/relaunch. |
| No Business leakage into Personal | `workspace-sheet-personal-isolation-2.png` | Passed | Workspace sheet states Personal and business stay apart. |

## Runtime fix made during E.2

Problem: Timeline returned the empty state when `rows.length === 0`, hiding material-change cards if there were no ordinary transaction rows.

Fix:

- `b8bb846 fix(mobile): surface material changes in timeline`
- Added `apps/mobile/src/folio/lib/timelineVisibility.ts`.
- Added `apps/mobile/src/folio/lib/timelineVisibility.test.ts`.
- `TimelineScreen` now treats material-change cards as visible timeline facts.

Native proof after fix:

- Before fix: `timeline-material-change.png` showed empty Timeline.
- After fix: `b8bb846-timeline-material-change-fixed.png` shows the `What changed` card.

## Fixture notes

The deterministic manual fixture intentionally created:

- current balance: `£720`
- payday day: `31`
- missing income
- duplicate `Untitled` recurring commitments
- a shortfall that Recovery can close

Some labels are therefore fixture-noisy (`Untitled`, duplicate recurring amount contradiction), but the underlying journey behaviour is valid.
