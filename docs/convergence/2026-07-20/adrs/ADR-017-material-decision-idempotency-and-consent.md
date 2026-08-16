# ADR-017: Material decisions require idempotency and explicit consent

## Status

Accepted.

## Decision

The store-level `recordMaterialDecision` wrapper is responsible for:

- refusing to create duplicate receipts for the same idempotency key
- preserving chosen/resolved receipts on repeat submission
- recording explicit consent for material choices

## Consequences

- Duplicate taps/restarts cannot demote a receipt back to `presented`.
- Callers do not need a second consent mutation for ordinary material decisions.
- Existing outcome semantics remain: recovery can await follow-up; payday can resolve immediately on cycle close.
