# ADR-015: Phase E uses bounded journey records, not a generic activity feed

## Status

Accepted.

## Decision

Phase E stores only bounded, workspace-owned records required to resume/explain critical journeys:

- `provisionalAnswers`
- `materialChanges`
- `correctionImpacts`
- `criticalJourneyContinuity`

It does not create a generic unbounded activity feed or persist duplicate AppState snapshots.

## Consequences

- Relaunch explanations work for material changes and corrections.
- Rollback can ignore Phase E arrays.
- Future SQL migration has clear row-shaped targets.
- Automatic recording from every writer remains incremental work.
