# ADR-007: Navigation transition

Status: Accepted for Phase B.

## Context

The app uses Expo Router at entry and a custom in-memory `FolioShell` router for screens and sheets.

## Decision

Keep `FolioShell` through Phase C. Do not introduce new navigation or route groups until Trusted Safe Range and critical journeys are proven.

## Consequences

- Phase C avoids navigation churn.
- Current app remains operational.
- Route migration is deferred to Phase E if journey tests justify it.

## Enforcement

`MELO_NAVIGATION_TRANSITION.md`.

