# Melo execution roadmap

Status: proposed execution order. Stop after Phase A until human approval.

## Phase A: Evidence and containment

| Field | Plan |
| --- | --- |
| Goal | Preserve pre-convergence state and contain immediate trust/harm defects. |
| Included | Checkpoint branch/tag, convergence docs, silent recurring invoice containment, contrast guard, export cleanup, platform-accurate intake copy, provider/mascot/Melo confirmation verification. |
| Excluded | Broad redesign, migrations, new screens, Business rewrite. |
| Files/modules affected | `docs/convergence/2026-07-20`, `BusinessTodayScreen.tsx`, `noFabricatedContent.test.ts`, `exportNative.ts`, `exportNative.test.ts`, `IntakeScreen.tsx`, token-using screens/sheets, `darkModeFoundation.test.ts`. |
| Migrations | None. |
| Tests | Focused containment tests, typecheck, full test/build after docs. |
| Device evidence | Not required beyond existing Android evidence unless UI contrast needs screenshots. |
| Risks | Commits must not mix dirty preexisting work; use checkpoint-based commit branch. |
| Rollback | Revert containment commits or reset to snapshot branch/tag. |
| Entry criteria | Dirty worktree preserved. |
| Exit criteria | Checkpoint recoverable, docs written, containment tests pass, commits created. |
| Suggested commits | One docs/checkpoint commit plus separate containment commits. |

## Phase B: Product and architecture convergence

| Field | Plan |
| --- | --- |
| Goal | Turn these docs into executable specs and acceptance tests. |
| Included | Final route map, truth model schema, architecture authority interfaces, Lovable target comparison for critical journeys. |
| Excluded | Large UI rewrite and storage migration. |
| Files/modules affected | Product docs, `packages/domain`, `packages/finance`, `apps/mobile/src/folio/lib`, tests. |
| Migrations | None; introduce contracts. |
| Tests | Contract tests for truth classes, source/freshness propagation. |
| Device evidence | None unless IA prototype is produced. |
| Risks | Over-documentation without code boundaries. |
| Rollback | Keep docs as proposal; do not merge contracts. |
| Entry criteria | Phase A complete and approved. |
| Exit criteria | Implementable tickets with acceptance tests. |
| Suggested commits | Contracts, tests, doc alignment. |

## Phase C: Trusted Safe Range

| Field | Plan |
| --- | --- |
| Goal | Replace Safe Zone answer semantics with sourceable range/reliance model. |
| Included | Engine contract, source/freshness/confidence, Today source drawer, stale/missing/negative states. |
| Excluded | AI calculation, widgets, Open Banking default. |
| Files/modules affected | Finance packages, `TodayScreen.tsx`, `MoneyPath.tsx`, `CalendarScreen.tsx`, `SafeZoneWidget.tsx` gated/deferred. |
| Migrations | Adapter from current forecast route to Safe Range output. |
| Tests | Missing/stale/contradicted/estimated scenarios; accessibility source labels. |
| Device evidence | Android screenshots for high/low/missing/stale states. |
| Risks | User-facing core route regression. |
| Rollback | Feature flag old Today path. |
| Entry criteria | Truth contracts accepted. |
| Exit criteria | Trusted Safe Range works from manual data and review-confirmed data. |
| Suggested commits | Engine, adapter, Today UI, tests, device evidence. |

## Phase D: Decision Ledger and accountability

| Field | Plan |
| --- | --- |
| Goal | Record material decisions with facts, assumptions, consent and outcomes. |
| Included | Ledger domain/storage model, decision receipt, Melo tool ledger hooks, export format. |
| Excluded | Generic event sourcing, personal profiling. |
| Files/modules affected | `packages/domain`, `packages/storage`, `MeloChatSheet.tsx`, `WhatIfScreen.tsx`, export modules. |
| Migrations | New bounded table/store slice with adapter. |
| Tests | Decision record creation, delete/export, no emotional overcapture. |
| Device evidence | Decision receipt flow. |
| Risks | Privacy/storage bloat. |
| Rollback | Disable ledger write adapter; keep existing actions. |
| Entry criteria | Safe Range forecast version IDs exist. |
| Exit criteria | Material decisions export and correct. |
| Suggested commits | Domain, storage, UI receipt, export, tests. |

## Phase E: Complete critical journeys

| Field | Plan |
| --- | --- |
| Goal | Ship coherent end-to-end Personal journeys A-F; data outage if provider path remains visible. |
| Included | First answer, something changed, decision, pressure, payday, correction, outage states. |
| Excluded | Business redesign and iOS. |
| Files/modules affected | Personal screens/sheets, IA/shell, Lovable-derived design specs. |
| Migrations | Navigation consolidation only with acceptance tests. |
| Tests | Journey tests and Android evidence for each path. |
| Device evidence | Full route walkthrough video/screens. |
| Risks | Screen replacement regressions. |
| Rollback | Keep old screens behind route flag until accepted. |
| Entry criteria | Safe Range and ledger foundation. |
| Exit criteria | Each journey has acceptance proof. |
| Suggested commits | One journey per commit stack. |

## Phase F: Production hardening

| Field | Plan |
| --- | --- |
| Goal | Prove privacy, reliability, accessibility and release readiness. |
| Included | Encryption proof, restore/delete, crash/error handling, performance, battery, monitoring/analytics minimisation, accessibility, store docs. |
| Excluded | Growth experiments and engagement optimisation. |
| Files/modules affected | Storage, export/restore, release-store docs, app config, tests, CI. |
| Migrations | Storage hardening as needed. |
| Tests | E2E restore/delete, security checks, accessibility, performance smoke. |
| Device evidence | Clean install, upgrade, clear/delete, offline. |
| Risks | Late platform bugs. |
| Rollback | Keep closed beta internal. |
| Entry criteria | Critical journeys complete. |
| Exit criteria | Release gates green with evidence. |
| Suggested commits | Security, restore, telemetry, accessibility, release evidence. |

## Phase G: Closed beta

| Field | Plan |
| --- | --- |
| Goal | Test comprehension and forecast safety with a small real-user cohort. |
| Included | Android beta, support loop, measured comprehension, forecast miss review, user deletion/export checks. |
| Excluded | Broad marketing, paid acquisition, Business launch. |
| Files/modules affected | Release config, support docs, beta instrumentation. |
| Migrations | None unless beta finds blockers. |
| Tests | Beta entry checklist and incident response. |
| Device evidence | Store/internal testing proof. |
| Risks | Real user trust failure. |
| Rollback | Stop beta, revoke build, preserve user export/delete. |
| Entry criteria | Production hardening complete. |
| Exit criteria | Users understand answer/source/uncertainty and no material harm defects. |
| Suggested commits | Beta config, docs, fixes only. |

