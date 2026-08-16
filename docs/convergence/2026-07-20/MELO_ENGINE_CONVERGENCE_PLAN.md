# Melo engine convergence plan

Status: Phase B engine ownership and migration contract. No complete Safe Range engine is implemented in Phase B.

## Canonical owners

| Responsibility | Canonical owner | Legacy/current inputs | Phase B decision |
| --- | --- | --- | --- |
| Account model | `@folio/domain` | `apps/mobile/src/folio/store.ts` account/current balance fields | Domain owns model; store remains adapter. |
| Ledger | `@folio/storage` | Store transactions, pot ledger, debts, subs | Storage owns persistence; AppState compatibility remains. |
| Recurring obligations | `@folio/domain` | Subs, bills, income sources, local recurrence helpers | Domain owns facts; engines derive occurrences. |
| Forecast engine | `@folio/finance-engine` | `buildForecast`, local adapters | Finance engine calculates projections; app adapters feed it. |
| Truth classification | `@folio/domain` | Existing authority/review/source fields | Domain vocabulary is canonical. |
| Safe Range result | `@folio/domain` | Legacy Safe Zone and forecast outputs | Domain result shape is canonical; Phase C adapter fills it. |
| Decision Ledger | `@folio/domain` | Existing decision/audit fragments | Domain record shape is canonical; Phase D storage writes it. |
| Review queue | `@folio/domain` | Store review queue/import drafts | Domain owns candidate/truth state; store remains adapter. |
| Persistence | `@folio/storage` | `persist.ts`, full AppState generations | Storage becomes canonical by slice; snapshot remains rollback. |
| Corrections | `@folio/domain` | Edits, import corrections, balance corrections | Domain correction refs link prior/next facts. |
| Melo tools | `@folio/domain` | `toolContract.ts`, `applyMeloTool`, local Melo turn | Domain owns tool contract; UI/store keep confirm gate. |
| Workspace boundaries | `@folio/domain` | Store workspace fields and storage tests | Domain owns boundary check; adapters enforce. |

## Migration away from overlap

| Overlap | Direction | Compatibility window |
| --- | --- | --- |
| `packages/finance-engine` vs app-local Safe Zone math | Keep finance engine as forecast owner; mark app-local Safe Zone compatibility-only. | Through Phase C. |
| `packages/melo-engine` Safe Zone copy vs RN app Safe Zone | Mark both legacy; do not add new semantics. | Through Phase C adapter acceptance. |
| `folio/lib` engines vs packages | App-local code becomes adapter/selector layer when package owner exists. | Per engine. |
| `apps/mobile/src/local` engines vs packages | Native/local code hosts device adapters and repository integration, not product truth vocabulary. | Per adapter. |
| AppState snapshot vs SQL storage | AppState wins until slice migration proof exists. | Through Phase F for remaining slices. |
| Personal and Business concepts | Shared domain vocabulary; separate engine inputs and workspace records. | Permanent boundary. |

## Phase C Safe Range input boundary

Phase C must consume `TrustedCoreForecastIntegrationInput` and return `TrustedSafeRangeResult`. It may adapt legacy Safe Zone values, but the final result must include:

- source breakdown,
- freshness,
- confidence,
- assumptions,
- missing material information,
- reliance,
- forecast version id,
- provenance id.

The LLM may explain the result but must not calculate it.

## Phase D Decision Ledger boundary

Phase D must write `DecisionLedgerRecord` only for material decisions. It must not event-source every app action. It must connect to:

- Review confirmations,
- corrections,
- scenario choices,
- recovery moves,
- Melo confirmed tools,
- forecast-vs-actual outcomes.

## Acceptance gates

| Gate | Required proof |
| --- | --- |
| Domain contract | `packages/domain/test/trusted-core.test.ts` passes. |
| Architecture boundary | `tooling/phaseBArchitecture.test.ts` passes. |
| Legacy Safe Zone containment | Deprecated compatibility annotations remain in both legacy Safe Zone files. |
| No app-local duplicate contracts | Architecture test blocks local redefinition of Trusted Safe Range and Decision Ledger types. |
| Existing app operational | Full typecheck, tests and build pass. |

