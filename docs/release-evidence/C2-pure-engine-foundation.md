# C2 Pure Engine Foundation

## Phase / task IDs

Phase 2. Primary task range: T025 through T047.

## What was built

- `@folio/domain`: Money, local date/time, UTC instants, time zones, IDs, entity versions,
  workspaces, accounts, balance observations, transactions, splits, transfers and actual
  versus expectation reconciliation.
- `@folio/calendar-engine`: bounded recurrence parsing/expansion and Europe/London DST
  local-time stability checks.
- `@folio/event-engine`: event taxonomy validation, workspace constraints and severity
  derivation.
- `@folio/finance-engine`: dated forecast engine, certainty layers, available-before-income
  boundary, workspace isolation, FX guardrails, scenario isolation and debt schedules.
- `@folio/plan-engine`: budget rollover, plan completion projection, non-failure rebase and
  scenario isolation.
- `@folio/melo-policy`: advice-language and escalation-trigger classifier for blocked
  recommendation, suitability, guarantee, shame and tax/legal certainty wording.

## Task coverage

| Task                                    | Status                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| T025 Money value object                 | Implemented and tested                                                                       |
| T026 Time value objects                 | Implemented and tested                                                                       |
| T027 IDs and entity versions            | Implemented and tested                                                                       |
| T028 Workspace aggregate                | Implemented and tested                                                                       |
| T029 Account and balance model          | Implemented and tested                                                                       |
| T030 Transaction model                  | Implemented and tested                                                                       |
| T031 Splits and transfer links          | Implemented and tested                                                                       |
| T032 Facts versus expectations          | Implemented and tested                                                                       |
| T033 RFC recurrence engine              | Implemented and tested for bounded subset/DST vectors                                        |
| T034 Event aggregate and taxonomy       | Implemented and tested                                                                       |
| T035 Actual-to-expectation matching     | Implemented through reconciliation/forecast vectors                                          |
| T036 Dated ledger engine                | Implemented and tested through forecast vectors                                              |
| T037 Certainty views                    | Implemented and tested                                                                       |
| T038 Available-before-income boundary   | Implemented and tested                                                                       |
| T039 Debt schedule primitives           | Implemented and tested                                                                       |
| T040 Neutral debt scenarios             | Implemented without suitability language                                                     |
| T041 Budget periods and allocations     | Implemented and tested                                                                       |
| T042 Plan aggregate                     | Implemented and tested                                                                       |
| T043 Plan projection and rebase         | Implemented and tested                                                                       |
| T044 Isolated scenario engine           | Implemented and tested                                                                       |
| T045 Advice-language classifier         | Implemented and tested                                                                       |
| T046 Jurisdiction policy-pack interface | Deferred to policy-pack adapter package; no hardcoded domain dependency added                |
| T047 Pure-engine property suite         | Deterministic suite in Node passes; broader fuzz/property expansion remains future hardening |

## Test evidence

Latest targeted run on 2026-06-20:

- `pnpm typecheck`: passed.
- `pnpm test`: passed.
- Phase 2 package tests included in the run: 46 tests.
- No Phase 2 package imports React, React Native, Expo, SQLite, OP-SQLite or mobile runtime code.

Package test files:

- `packages/domain/test/money.test.ts`
- `packages/domain/test/core-domain.test.ts`
- `packages/calendar-engine/test/recurrence.test.ts`
- `packages/event-engine/test/taxonomy.test.ts`
- `packages/finance-engine/test/forecast.test.ts`
- `packages/finance-engine/test/debt.test.ts`
- `packages/plan-engine/test/plans.test.ts`
- `packages/melo-policy/test/advice-language.test.ts`

## Boundary conclusion

Phase 2 pure engine work is ready for Phase 3 storage integration. Native Phase 1 blockers do
not contaminate these packages because the engines are deterministic TypeScript and stay inside
the pure package boundary.
