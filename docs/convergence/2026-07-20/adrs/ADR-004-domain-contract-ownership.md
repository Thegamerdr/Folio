# ADR-004: Domain contract ownership

Status: Accepted for Phase B.

## Context

The repo had overlapping package, app-local and native/local concepts.

## Decision

`@folio/domain` owns canonical Truth classes, provenance refs, Safe Range result shape, Decision Ledger record shape, workspace boundary checks and responsibility ownership constants.

## Consequences

- App code can adapt but must not redefine these contracts.
- Phase C implements adapters against stable domain interfaces.
- Product vocabulary is testable.

## Enforcement

`packages/domain/src/trustedCore.ts`, `packages/domain/test/trusted-core.test.ts`, and `tooling/phaseBArchitecture.test.ts`.

