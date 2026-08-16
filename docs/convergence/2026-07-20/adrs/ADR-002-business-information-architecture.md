# ADR-002: Business information architecture

Status: Accepted for Phase B.

## Context

Business requirements must not distort Personal Trusted Core.

## Decision

Business IA is separate: Business Today, Activity/Review, Calendar, Runway, Clients/Invoices, Obligations/Filings, Business Melo, Business Data/Account.

## Consequences

- Business can share Truth Model, security, export, design system and workspace infrastructure.
- Business runway is not Personal Safe Range.
- Business tax/filing surfaces are deferred from Personal Trusted Core.

## Enforcement

Workspace boundaries are declared in `trustedCoreResponsibilityOwners` and documented in `MELO_INFORMATION_ARCHITECTURE.md`.

