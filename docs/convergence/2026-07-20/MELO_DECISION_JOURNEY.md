# Financial decision journey

## Contract

Question → current Safe Range → baseline/proposed/modified scenario comparison → assumptions/unknowns → user choice → confirmation → Decision Receipt → later outcome.

## Phase E implementation

- `buildDecisionScenarioComparison` creates three comparable rows:
  - Do nothing
  - Proposed option
  - User-modified option
- `recordMaterialDecision` now:
  - preserves idempotent duplicate submissions
  - does not demote chosen/resolved receipts back to presented
  - records explicit consent for material choices
- Scenarios are stored in the Decision Ledger entry.

## Covered fields

- immediate cash effect
- tightest-point effect
- expected-range effect
- conservative-boundary effect
- essential commitment risk
- reversibility
- confidence
- forecast horizon

## Deferred

- Full scenario portfolio.
- Permanent navigation change for Decision History.
