# Phase E migration

## Schema

Mobile AppState schema: v18.

Added fields:

- `provisionalAnswers`
- `materialChanges`
- `correctionImpacts`
- `criticalJourneyContinuity`

## Rules

- Migration is non-destructive.
- Existing users receive empty arrays.
- Historical material changes are not fabricated.
- Existing Decision Ledger, Safe Range, transactions, evidence documents and encrypted backups remain compatible.
- Workspace row guards own every new row by `workspaceId`.
- Rollback path: ignore v18 journey arrays and retain Safe Range / Decision Ledger paths.

## Export

New CSVs:

- `provisional-answers.csv`
- `material-changes.csv`
- `correction-impacts.csv`
- `critical-journey-continuity.csv`
