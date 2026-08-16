# ADR-009: Decision Ledger boundary

Status: Accepted for Phase B.

## Context

The product needs accountability without rewriting the app as generic event sourcing.

## Decision

Use `DecisionLedgerRecord` only for material decisions. Do not record every UI event as a decision.

## Consequences

- Material decisions can preserve question, facts, truth classes, assumptions, scenarios, consent, outcome and correction refs.
- Privacy risk is lower than broad event capture.
- Phase D can add bounded storage and receipts.

## Enforcement

`packages/domain/src/trustedCore.ts`, `MELO_DECISION_LEDGER.md`, `MELO_ENGINE_CONVERGENCE_PLAN.md`.

