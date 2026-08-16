# Melo Phase B decisions

Status: approved Phase B contract pending final test/build evidence. Phase C must not reopen these decisions unless a blocker is recorded.

## Decisions made

| ID | Decision | Enforcement |
| --- | --- | --- |
| B-001 | Melo Personal IA centers on Today, Calendar, Review/Activity, Plans, Melo, Trust/Data and Account. | `MELO_INFORMATION_ARCHITECTURE.md`, `MELO_SCREEN_DISPOSITION.md` |
| B-002 | Melo Business has separate IA: Business Today, Activity/Review, Calendar, Runway, Clients/Invoices, Obligations/Filings, Business Melo, Business Data/Account. | `MELO_INFORMATION_ARCHITECTURE.md`, `MELO_SCREEN_DISPOSITION.md` |
| B-003 | Current screens have explicit treatment; no critical screen remains unresolved. | `MELO_SCREEN_DISPOSITION.md` |
| B-004 | `@folio/domain` owns Truth classes, Safe Range result interface, Decision Ledger interface, workspace boundary checks and responsibility-owner constants. | `packages/domain/src/trustedCore.ts`, `packages/domain/test/trusted-core.test.ts` |
| B-005 | `@folio/finance-engine` owns forecast calculation. App/local code adapts inputs and device state. | `trustedCoreResponsibilityOwners`, `MELO_ENGINE_CONVERGENCE_PLAN.md` |
| B-006 | `@folio/storage` owns persistence/normalised SQL direction; full AppState generations remain compatibility authority until per-slice migration proof exists. | `trustedCoreResponsibilityOwners`, `MELO_DATA_MIGRATION_PLAN.md` |
| B-007 | Legacy Safe Zone engines are compatibility inputs only. New source/freshness/confidence semantics belong in `TrustedSafeRangeResult`. | Deprecated comments, `tooling/phaseBArchitecture.test.ts` |
| B-008 | Decision Ledger is a bounded material-decision record, not app-wide event sourcing. | `DecisionLedgerRecord`, `MELO_DECISION_LEDGER.md` |
| B-009 | Keep `FolioShell` custom navigation through Phase C; do not migrate to new Expo route groups yet. | `MELO_NAVIGATION_TRANSITION.md` |
| B-010 | Phase B migration scaffolding is non-destructive and has no user-visible behaviour change. | `trustedCoreMigrationPlan`, tests |

## Decisions still blocked

| Topic | Blocker | Required before changing code |
| --- | --- | --- |
| Final permanent tab count | Needs journey evidence after Safe Range contract is visible. | Phase E navigation/journey proof. |
| Exact SQL schema columns | Needs storage implementation design after contract acceptance. | Phase C/D migration ticket. |
| Open Banking as beta route | Requires provider credentials, callback proof and identity config. | External provider proof. |
| iOS document reading | User deferred iOS creation. | Native iOS build and reader proof. |
| Business launch scope | Business remains separate product. | Business-specific convergence phase. |

## New interfaces and boundaries

- `TrustedCoreTruthClass`
- `TrustedCoreFactRef`
- `TrustedCoreProvenanceSnapshot`
- `TrustedSafeRangeResult`
- `DecisionLedgerRecord`
- `trustedCoreResponsibilityOwners`
- `trustedCoreMigrationPlan`
- `evaluateWorkspaceBoundary`
- `TrustedCoreForecastIntegrationInput`

## Phase C starting point

Start Phase C by building an adapter that consumes existing Personal AppState/finance-engine inputs and returns `TrustedSafeRangeResult` without changing Today UI first. Then wire Today to display the result contract once adapter tests pass.

