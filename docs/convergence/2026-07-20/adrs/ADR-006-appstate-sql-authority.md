# ADR-006: AppState and normalised SQL authority

Status: Accepted for Phase B.

## Context

The app has full encrypted AppState generations and a normalised SQL/SQLCipher direction.

## Decision

Normalised SQL becomes canonical by slice only after tests and migration proof. Full AppState generations remain compatibility and rollback authority until then.

## Consequences

- No giant persistence rewrite in Phase B.
- Existing backups keep restoring.
- Projection disagreement does not silently overwrite user data.

## Enforcement

`MELO_DATA_MIGRATION_PLAN.md`, `MELO_ARCHITECTURE_AUTHORITY.md`, `trustedCoreMigrationPlan`.

