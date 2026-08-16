# ADR-014 — Decision Ledger privacy and retention

## Status

Accepted in Phase D.

## Decision

Decision Ledger records retain only decision-relevant snapshots. They do not store full AppState, chat transcripts, semantic memory, psychological inference, raw documents, or cross-workspace context.

Deleted entries are removed from durable exportable state. Optional learning can be disabled or removed per decision.

## Rationale

The product moat is trusted private financial intelligence. Trust requires visible accountability, minimised retention and user-controlled learning.

## Consequences

- Unresolved material decisions must not be silently evicted.
- Any future legal/security audit retention must be separate and minimised.
- Future sync must preserve workspace isolation and deletion semantics.
