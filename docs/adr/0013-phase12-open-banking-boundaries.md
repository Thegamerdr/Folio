# ADR 0013: Phase 12 Open Banking Boundaries

## Status

Accepted for Phase 12 synthetic contract evidence.

## Context

Phase 12 introduces Open Banking as an optional automation adapter. The source package requires
provider adapter contracts, a consent dashboard, canonical row ingestion, reconciliation, stale/gap
state and revocation, while the release gate remains regulated partner/legal/store review with
manual mode unchanged.

Open Banking must not become the foundation of Folio. Manual entry and statement import remain
complete without a bank connection, account, internet session or provider availability.

## Decision

Add pure package `@folio/open-banking` for provider-neutral contracts and release gates. The
package models:

- regulated provider selection criteria and blockers;
- `BankDataProvider` start/callback/list/rows/refresh/revoke readiness;
- contextual consent journey with provider tokens held only by an encrypted backend adapter;
- user-visible consent dashboard state;
- canonical provider rows staged through import review, never direct transaction writes;
- reconciliation signals for duplicate provider IDs, pending replacements and possible transfers;
- stale/gap feed state that keeps local manual/import workflows available;
- revocation that stops future access while keeping retained local history as a separate choice;
- sandbox, production pilot, legal, store, support and incident-monitoring gates.

The Expo shell renders synthetic-labelled Open Banking evidence only. It does not perform provider
redirects, bank login, network calls, token storage, real bank-row fetches or transaction writes.

## Consequences

- Phase 12 can prove deterministic Open Banking boundaries and UI hierarchy without a regulated
  provider.
- T160, T161, T167 and T168 remain blocked for release until provider procurement, live provider
  contract suites, sandbox/production pilot acceptance, legal/store review, support runbook and
  incident monitoring are complete.
- T162 is contract-proven only; live release still needs the backend token adapter and security
  review.
- Any future provider SDK or cloud implementation must stay outside pure packages and must update
  this ADR, the compatibility matrix, privacy evidence and release checklist.

## Rejection

Do not ship:

- first-launch bank permission prompts;
- bank tokens in the JavaScript bundle, mobile local preferences or logs;
- provider rows writing directly to financial domain tables;
- fake provider logos, fake coverage, fake uptime or bank-level security claims;
- Open Banking beta claims before regulated partner/legal/store gates pass.
