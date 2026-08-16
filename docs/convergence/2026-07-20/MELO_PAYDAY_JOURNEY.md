# Payday and cycle-close journey

## Contract

Income arrives → prior forecast vs actual → major misses → unresolved items → next-cycle choices → confirm → cycle closes → new Safe Range → baseline stored.

## Phase E implementation

- `evaluatePaydayForecastAccountability` compares a prior Safe Range snapshot with closing actuals.
- Classifications:
  - `inside_range`
  - `conservative`
  - `outside_range`
  - `unverifiable`
- No global “Melo accuracy score” is produced.
- Existing `addCycle` creates a resolved `payday-plan` receipt with forecast evaluation.

## Deferred

- More compact ritual UI.
- Richer “what Melo got wrong” review surface.
