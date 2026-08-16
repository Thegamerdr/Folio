# ADR-013 — Decision Ledger materiality thresholds

## Status

Accepted in Phase D.

## Decision

Phase D records only material financial decisions using deterministic thresholds:

- £10 cash effect
- £5 buffer/protected-money effect
- 1 day date shift
- £50 income-assumption change
- any shortfall-state change
- payday/cycle close accountability

Confirmation alone does not create a ledger entry.

## Rationale

The ledger must be useful accountability, not surveillance or a generic event log. Small noise would weaken trust and retention value.

## Consequences

- Tiny confirmed Melo actions can mutate the requested financial record without creating a Decision Ledger entry.
- Material confirmed Melo actions create exactly one entry through the store boundary.
- Threshold changes require test/doc updates.
