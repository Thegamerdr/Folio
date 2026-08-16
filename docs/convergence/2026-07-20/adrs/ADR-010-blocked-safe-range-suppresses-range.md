# ADR-010 — Blocked Safe Range suppresses numeric range

## Status

Accepted in Phase C.

## Decision

`insufficient_data` and `workspace_blocked` results must return `expectedRange.basis: unavailable` with null range endpoints.

## Rationale

Zeros and fallback dates are not financial truth. Returning a numeric range while a material blocker exists would recreate the prototype shortcut Phase C is removing.

## Consequences

- Today can still show current position and missing facts.
- Melo does not present a rely-on-able spending boundary from missing information.
- Legacy route values may still exist internally but are not surfaced as Trusted Safe Range.
