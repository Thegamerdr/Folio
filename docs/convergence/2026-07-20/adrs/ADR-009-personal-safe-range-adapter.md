# ADR-009 — Personal Trusted Safe Range adapter

## Status

Accepted in Phase C.

## Decision

Create `apps/mobile/src/folio/lib/trustedSafeRange.ts` as the Personal runtime adapter from legacy AppState to `TrustedSafeRangeResult`.

## Rationale

Phase C needs a stable integration seam without rewriting persistence, navigation or Today. A pure adapter lets existing data feed the new contract while keeping future storage migration possible.

## Consequences

- AppState remains compatibility authority in Phase C.
- Domain owns result shape.
- Finance engine owns forecast calculation.
- Today reads the result instead of inventing display semantics.
