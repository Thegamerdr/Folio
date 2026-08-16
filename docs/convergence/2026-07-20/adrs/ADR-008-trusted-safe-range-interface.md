# ADR-008: Trusted Safe Range interface

Status: Accepted for Phase B.

## Context

Safe Zone currently returns a legacy number without the full Truth Model contract.

## Decision

Phase C must return `TrustedSafeRangeResult` from `@folio/domain`. Legacy Safe Zone remains a compatibility input only.

## Consequences

- Safe Range result includes confidence, freshness, source breakdown, assumptions, missing material info, reliance and forecast version.
- Screens cannot invent a local Safe Range type.
- Legacy Safe Zone code is marked deprecated rather than removed.

## Enforcement

`packages/domain/src/trustedCore.ts`, Safe Zone deprecation annotations, `tooling/phaseBArchitecture.test.ts`.

