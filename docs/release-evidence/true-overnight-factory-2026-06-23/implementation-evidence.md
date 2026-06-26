# Implementation Evidence

## Extracted Components

The live mobile route now imports and renders these extracted surfaces:

| Surface area         | Component                     | Purpose                                               |
| -------------------- | ----------------------------- | ----------------------------------------------------- |
| First Minute         | `FirstMinuteWelcomeSurface`   | Warm Melo-led opening, local-first promises, actions. |
| Sample Briefing      | `SampleBriefingValueSurface`  | Labelled sample loop and source-separation copy.      |
| Minimal Manual Entry | `ManualPathThreeFactsPanel`   | Three-fact path framing.                              |
| Today                | `TodayCalmAnswerSurface`      | Calm answer, source access and what-if actions.       |
| Timeline             | `TimelineMeaningSurface`      | Human legend for facts, expected items and review.    |
| Calendar             | `CalendarPlannerIntro`        | Money-aware planner framing.                          |
| Import Review        | `ImportReviewDecisionGuide`   | Accept/edit/reject consequences before mutation.      |
| Melo                 | `MeloBoundarySurface`         | Interpreter-not-authority framing.                    |
| Plans                | `PlansPathSurface`            | User-owned plan framing and linked evidence copy.     |
| Recovery             | `RecoveryPathSurface`         | No-shame path-forward copy.                           |
| Data Control         | `DataControlOwnershipSurface` | Local ownership, export and evidence counts.          |

## Visible UX Improvements

- First launch now shows local-first, review-first and no-account promises as scannable chips.
- Sample mode now has a clearer sample/evidence/source layout and direct next actions.
- Manual entry now names the three facts instead of asking for a broad profile.
- Today now groups the primary answer into where/next/why.
- Timeline now explains row meaning before the list.
- Calendar now states that it is a money-aware planner.
- Import Review now shows all review actions and consequences in one guide.
- Plans now state intention, protected money, movement and linked evidence before the rows.
- Data Control now groups accepted reality, staged data, rejected evidence and source files before export.
- Melo now shows its boundary before the question composer.
- Recovery now leads with review-before-saving path-forward copy.

## Guard Evidence

- Route truth tests assert the extracted components are imported by the live route.
- Canonical product gates scan `apps/mobile/src/surfaces`.
- Focused tests continue to prove sample isolation, import review semantics and route evidence.
