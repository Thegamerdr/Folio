# ADR 0009: Phase 8 Plans, Progress, Fun And Recovery Boundaries

Date: 2026-06-21

Status: Accepted with explicit blockers

## Context

Phase 8 introduces optional plans, editable plan rules, progress journeys, dynamic rebasing, budget
remaining views, momentum, controlled fun, retention preferences and rituals. The source package
gate requires an unexpected event to cascade through forecast, calendar and plan outputs while
presenting a non-shaming updated path.

Plans are optional. They are not a score of the user's worth, and they do not fail. Fun and
retention features must be disableable, inspectable and suppressed during hardship. Native
notifications, real vault-backed plan commits, real-data end-to-end journeys and manual
accessibility recordings are not available yet.

## Decision

Expand `@folio/plan-engine` as the Phase 8 pure contract package:

- Add optional plan draft creation with flat hierarchy by default and review before commit.
- Add reversible plan-rule edits for priority, contribution, floor, pause/recovery and
  accountability style.
- Add accessible progress journey rows and static reduced-motion equivalents.
- Add deterministic dynamic cascade metadata for unexpected events across forecast, budget, plan,
  calendar and briefing projections.
- Add recovery rebase choices with no failed-verdict language and no immediate writes.
- Add budget remaining experience outputs with included and excluded records.
- Add momentum from real progress signals, explicitly without daily-loss streaks.
- Add controlled fun decisions that can be disabled and suppress bad-month celebration.
- Add inspectable/resettable retention preferences without hidden sensitive profiling.
- Add optional ritual candidates controlled by notification policy.
- Add good, bad and quiet month emotional-safety checks.

Add `apps/mobile/src/phase8` as a synthetic-labelled evidence adapter and render it in the Expo
Today shell after Phase 7. The shell is proof of deterministic view-model behavior, not proof of
real vault-backed writes or native notification scheduling.

## Consequences

Phase 8 can prove the whole T111-T121 deterministic contract slice and an Android-rendered
synthetic shell. It cannot claim real persisted plan commits, native ritual notifications, native
animation quality, real-data end-to-end recovery or manual accessibility completion.

Huashu and Figma remain review evidence. Repository code, tests and emulator artifacts remain the
source of truth.

## Evidence

- `packages/plan-engine/src/index.ts`
- `packages/plan-engine/test/plans.test.ts`
- `apps/mobile/src/phase8/planRecoveryEvidence.ts`
- `apps/mobile/src/phase8/planRecoveryEvidence.test.ts`
- `apps/mobile/app/index.tsx`
- `docs/release-evidence/C8-plans-progress-fun-recovery.md`
- `docs/release-evidence/android-live-preview-phase8-top.png`
- `docs/release-evidence/android-live-preview-phase8-rebase.png`
- `docs/release-evidence/android-live-preview-phase8-journey.png`
- `docs/release-evidence/android-live-preview-phase8-gate.png`
- `docs/release-evidence/figma-phase8-evidence.png`
- `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=11-2`
