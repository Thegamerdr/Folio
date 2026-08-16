# ADR-012 — Decision Ledger command boundary

## Status

Accepted in Phase D.

## Decision

All durable Decision Ledger writes must go through `apps/mobile/src/folio/lib/decisionLedger.ts` and the store wrapper in `apps/mobile/src/folio/store.ts`.

## Rationale

Melo needs accountability without creating hidden activity logging. A single boundary makes materiality, workspace isolation, idempotency, consent, outcome handling, export and deletion enforceable.

## Consequences

- Screens and sheets may read ledger entries.
- Screens and sheets must not construct durable ledger records directly.
- Melo chat cannot create ledger entries directly.
- Architecture tests scan for direct app-local writes.
