# C8 Plans, Progress, Fun And Recovery

## Phase / task IDs

Phase 8. Primary task range: T111 through T121.

## Result

Phase 8 is complete for deterministic plan/recovery contracts and a synthetic-labelled Expo Today
shell. It is not complete for release claims requiring real vault-backed plan commits, native
ritual notifications, native animation evidence, real-data end-to-end recovery, or manual TalkBack,
large-text and reduced-motion recordings.

## What was built

- Expanded `@folio/plan-engine` from Phase 2 plan primitives into the Phase 8 deterministic
  contract package.
- Optional plan draft creation with flat hierarchy by default and review before commit.
- Reversible plan-rule edits for priority, contribution, protected floor, pause/recovery and
  accountability style.
- Accessible progress journey rows with static reduced-motion equivalent.
- Dynamic unexpected-event cascade metadata across forecast, budget, plan, calendar and briefing.
- Recovery rebase briefing with keep, alter, pause, edit and leave-unchanged choices.
- Budget remaining experience with included and excluded record disclosure.
- Real-progress momentum that does not use daily-loss streaks.
- Controlled fun framework that can be disabled and suppresses bad-month celebration.
- Inspectable and resettable retention preferences without hidden sensitive profiling.
- Optional payday, weekly and month-close ritual candidates controlled by notification policy.
- Good, bad and quiet month emotional-safety checks.
- `apps/mobile/src/phase8` mobile evidence adapter and integrated Expo Today section.

## Task coverage

| Task                       | Status                         | Evidence                                                  |
| -------------------------- | ------------------------------ | --------------------------------------------------------- |
| T111 Optional plan creator | Implemented and tested         | `createPlanDraft`, mobile optional draft proof            |
| T112 Rule editor           | Implemented and tested         | `editPlanRules`, reversible diff rows                     |
| T113 Progress journey      | Implemented and tested         | `buildPlanProgressJourney`, accessible milestone rows     |
| T114 Dynamic cascade       | Implemented and tested         | `applyDynamicPlanCascade`, invalidated projections        |
| T115 Rebase experience     | Implemented and tested         | `buildRecoveryRebaseExperience`, non-failure choices      |
| T116 Budget remaining      | Implemented and tested         | `buildBudgetRemainingExperience`, included/excluded rows  |
| T117 Momentum              | Implemented and tested         | `buildMomentumState`, no daily-loss streak                |
| T118 Controlled fun        | Implemented and tested         | `buildControlledFunState`, bad-month suppression          |
| T119 Retention preferences | Implemented and tested         | retention create/update/reset helpers                     |
| T120 Rituals               | Implemented as policy contract | `buildRitualPlan`, native notification blocker visible    |
| T121 Quality journeys      | Implemented and tested         | `runPhase8EmotionalSafetyReview`, good/bad/quiet journeys |

## Verification evidence

Focused checks completed on 2026-06-21:

- `pnpm --filter @folio/plan-engine typecheck`: passed.
- `pnpm --filter @folio/mobile typecheck`: passed.
- `pnpm vitest run packages/plan-engine/test/plans.test.ts apps/mobile/src/phase8/planRecoveryEvidence.test.ts`: passed, 30 tests.

Full gates completed on 2026-06-21:

- `pnpm run ci`: passed; includes lint, typecheck, 22 test files and 191 tests, and
  contract validation.
- `pnpm lint:boundaries`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 22 files and 191 tests.
- `pnpm validate:contracts`: passed with 75 files, 15,681 lines, 192 tasks, 32 risks,
  18 forecast vectors, 15 import vectors and 14 independently checked fixture cases.
- `pnpm --filter @folio/mobile doctor`: passed, 21/21 checks.
- `pnpm --filter @folio/mobile exec expo install --check`: passed.
- `pnpm check:v1-boundary`: passed; 105 authored V2 runtime/package files checked against
  859 V1 freeze hashes.

## Android live preview evidence

The Phase 8 mobile shell is integrated into `apps/mobile/app/index.tsx`. Android
development-client preview was verified on `emulator-5554` (`sdk_gphone64_x86_64`) using Metro on
port `8086`.

Actual artifacts:

- `docs/release-evidence/metro-phase8-live-preview-lan.log`
- `docs/release-evidence/android-live-preview-phase8-top.png`
- `docs/release-evidence/android-window-phase8-top.xml`
- `docs/release-evidence/android-live-preview-phase8-rebase.png`
- `docs/release-evidence/android-window-phase8-rebase.xml`
- `docs/release-evidence/android-live-preview-phase8-journey.png`
- `docs/release-evidence/android-window-phase8-journey.xml`
- `docs/release-evidence/android-live-preview-phase8-gate.png`
- `docs/release-evidence/android-window-phase8-gate.xml`

The Metro log records `Android Bundled 1781ms node_modules\expo-router\entry.js (1696 modules)`.
PNG captures decode as valid `1080x2400` images.

UI tree proof:

- Top viewport confirms `PERSONAL WORKSPACE`, `Local mode`, `Today` and first-minute rows.
- Phase 8 entry confirms `PHASE 8 PLANS AND RECOVERY`, `Synthetic sample`, `OPTIONAL PLAN DRAFT`,
  `RULE EDITOR`, reversible review rows and `UNEXPECTED EVENT CASCADE`.
- Journey viewport confirms rebase choices, `PROGRESS JOURNEY`, milestone text and budget
  remaining rows.
- Gate viewport confirms `PHASE 8 GATE`, `Plan creator`, `Cascade/rebase`, `Recovery copy`,
  `Fun/personalisation`, `Native/vault` blockers and `Manual a11y` blockers.

The dev-client tools control is visible in Android captures. It is development-client chrome, not
Folio product UI.

This preview proves only that the synthetic Phase 8 shell renders in the Android development client.
It does not prove real vault-backed plan commits, native ritual notifications, native animation or
release-grade offline recovery.

## Figma evidence

Editable Figma evidence was created from the Phase 8 repo contracts and mobile shell.

Figma board:

- `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=11-2`

Local rendered board:

- `docs/release-evidence/figma-phase8-evidence.png`

Figma is review evidence only. The repository, tests and emulator artifacts remain the source of
truth.

## Huashu UI/UX critique

Huashu review outcome:

- The plan surface is optional and appears after the current Today/Melo context, so it does not
  turn Folio into a goal-setting gate.
- The recovery section uses calm consequence language: changed facts, protected items, changed
  dates and reviewable options.
- "Failed" language is absent from user-visible recovery copy; the plan is rebased rather than
  judged.
- Progress is backed by an accessible text equivalent and static reduced-motion display.
- Momentum is earned from real actions and recovery, not daily attendance streaks.
- Fun, rituals and personalisation are visibly disableable/resettable and suppressed in bad-month
  context.

Issues carried forward:

- Real plan commits remain blocked until vault-backed command adapters can write plan rows.
- Native ritual notifications remain blocked until scheduling, quiet hours and lock-screen privacy
  are proven.
- Native animation and manual reduced-motion accessibility evidence remain blocked.
- Manual TalkBack and large-text checks remain required before release accessibility claims.

## Boundary conclusion

Phase 8 is complete for deterministic plan/recovery contracts, emotional-safety checks and
synthetic mobile shell evidence. Real vault-backed plan commits, native ritual notifications,
native animation, real-data end-to-end recovery and manual accessibility evidence remain explicit
blockers. No V1 donor runtime code or assets were used.
