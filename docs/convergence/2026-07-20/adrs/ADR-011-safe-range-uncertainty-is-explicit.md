# ADR-011 — Safe Range uncertainty is explicit

## Status

Accepted in Phase C.

## Decision

Expected Safe Range may widen only from named, quantified sources.

## Rationale

Melo must explain what changed and why the user should trust or distrust the answer. Arbitrary padding would hide uncertainty rather than disclose it.

## Consequences

- Stale-balance uncertainty requires daily-spend history.
- Variable bills use an explicit 20% band.
- Pending review, refunds and pot borrows use their exact amounts.
- Unknown but unquantified inputs lower confidence instead of changing the range.
