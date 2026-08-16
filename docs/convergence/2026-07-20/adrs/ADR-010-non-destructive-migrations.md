# ADR-010: Non-destructive migrations

Status: Accepted for Phase B.

## Context

Existing users may have encrypted local data, backups, evidence files and partial projections.

## Decision

Truth Model, Safe Range and Decision Ledger migrations are non-destructive scaffolds until their phases implement tested forward and rollback paths.

## Consequences

- Existing local state remains operational.
- Old backups can restore without new records.
- New projections can be rebuilt or ignored until canonical.

## Enforcement

`trustedCoreMigrationPlan`, `MELO_DATA_MIGRATION_PLAN.md`, and full test/build gates.

