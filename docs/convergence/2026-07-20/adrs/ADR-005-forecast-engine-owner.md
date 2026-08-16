# ADR-005: Forecast engine owner

Status: Accepted for Phase B.

## Context

Forecast behaviour appears in package engines, app-local selectors and native adapters.

## Decision

`@folio/finance-engine` owns deterministic forecast calculation. App/local code adapts current state into forecast inputs and later into `TrustedSafeRangeResult`.

## Consequences

- The LLM never calculates forecasts.
- UI screens do not own forecast maths.
- Legacy Safe Zone can feed compatibility adapters but not new product semantics.

## Enforcement

`trustedCoreResponsibilityOwners['forecast-engine']` and `MELO_ENGINE_CONVERGENCE_PLAN.md`.

