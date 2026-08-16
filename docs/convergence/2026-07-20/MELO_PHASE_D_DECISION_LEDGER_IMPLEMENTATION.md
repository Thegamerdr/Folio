# Phase D — Decision Ledger implementation

Status: implemented as a bounded Personal foundation. Business Decision Ledger remains explicitly out of scope.

## Scope

Phase D adds accountability for material Personal decisions only. It records what the user was deciding, the immutable Safe Range/forecast context, assumptions, scenarios, choice, consent, outcome, corrections and learning controls.

It does not add semantic AI, vector memory, full event sourcing, SQL authority cutover, navigation redesign, Business ledger, or whole-app redesign.

## Canonical files

| Responsibility               | File                                                      |
| ---------------------------- | --------------------------------------------------------- |
| Domain contract              | `packages/domain/src/trustedCore.ts`                      |
| Service/command boundary     | `apps/mobile/src/folio/lib/decisionLedger.ts`             |
| AppState compatibility slice | `apps/mobile/src/folio/store.ts`                          |
| Normalised SQL direction     | `packages/storage/src/canonical-sqlite-schema.ts`         |
| Export                       | `apps/mobile/src/folio/lib/export.ts`                     |
| UI entry point               | `apps/mobile/src/folio/screens/DecisionHistoryScreen.tsx` |
| Navigation location          | `More -> Decision history`                                |

## Implemented boundary

All durable ledger writes flow through the service/store boundary:

- create draft
- attach Safe Range
- attach scenarios
- mark presented
- record choice
- record consent
- mark awaiting outcome
- resolve outcome
- add correction
- evaluate forecast
- cancel or expire
- disable learning
- remove learning
- delete
- export

`MeloChatSheet.tsx` does not write the ledger. Confirmed Melo tools are captured only after the existing store confirmation path mutates the financial record.

## Integrated flows

| Flow                                   | Decision type                 | Capture point                      |
| -------------------------------------- | ----------------------------- | ---------------------------------- |
| What If hold                           | `scenario-choice`             | `addWhatIfHold`                    |
| Recovery spending hold                 | `spending-hold`               | `setSpendHold`                     |
| Recovery bill-date move                | `bill-date-change`            | `nudgeSub`                         |
| Payday Ritual close                    | `payday-plan`                 | `addCycle`                         |
| Melo spend/income/refund/transfer tool | `melo-confirmed-action`       | `applyMeloTool` after confirmation |
| Pot deposit                            | `pot-contribution`            | `addToPot` when material           |
| Pot borrow                             | `pot-borrow`                  | `borrowFromPot` when material      |
| Subscription pause/resume              | `recurring-commitment-change` | `togglePaused` when material       |

## Non-integrated in Phase D

- ordinary Melo conversation
- screen opens
- dismissed non-material UI
- notifications merely delivered
- Business runway/filing choices
- Review/correction replacement flows beyond correction interface scaffolding
- SQL authority cutover

## Acceptance evidence

See `MELO_PHASE_D_EVIDENCE.md`.
