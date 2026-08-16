# ADR 0013: Phase 12 Open Banking Boundaries

## Status

Accepted and implemented as a provider-neutral runtime foundation. Provider/legal/pilot release
gates remain open.

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

The current native app uses `expo-web-browser` for TrueLayer's hosted authorisation, calls the
authenticated `services/open-banking` Worker, maps provider-neutral accounts to local Melo accounts
and stages returned rows into Review. The Worker encrypts provider identifiers before KV storage;
provider credentials and access tokens never enter the app.

Workspace ownership is part of the provider boundary, not a UI filter. The mobile client hashes the
validated workspace ID and sends only the opaque reference. Worker indexes and records use that
scope; OAuth callback state carries it; list, sync and disconnect verify it. New provider-secret
ciphertext authenticates hashed user, workspace and local connection as AES-GCM associated data.
Headerless historic clients and account-level records map only to Personal. Account deletion is
intentionally account-wide and enumerates the complete hashed-user prefix.

The checked-in deployment remains provider-unconfigured until owner-controlled procurement,
privacy/DPIA review and TrueLayer sandbox setup are complete. This is an intentional truthful state,
not a simulated connection.

The workspace-bound implementation is checked in and locally verified but is not deployed by this
decision update. Deployment and provider activation remain separate owner-controlled gates.

Provider decision (2026-07-15): TrueLayer Data API v3 is the primary launch integration because the
runtime isolation service and hosted-authorisation flow are already implemented against it.
GoCardless Bank Account Data is the fallback if TrueLayer fails production access, UK/sole-trader
coverage, commercial, processor-term or pilot reliability gates. Do not build both in parallel.
The commercial target, workspace sequence and decision gates are canonicalised in
`docs/product-strategy/MELO_BUSINESS_AND_OPEN_BANKING.md`.

## Consequences

- Deterministic boundaries, the backend isolation adapter, mobile consent entry point and
  Review-before-truth path are implemented without requiring fake bank data.
- T160, the live-provider part of T161, T167 and T168 remain blocked for release until provider
  procurement, live sandbox/production contract suites, pilot acceptance, legal/store review,
  support runbook and incident monitoring are complete.
- Provider-side consent revocation must not be claimed unless the selected provider exposes and Melo
  executes a verified revocation mechanism. Disconnect currently stops Melo access and deletes its
  encrypted provider identifiers; local-history deletion stays separate.
- Any future provider SDK or cloud implementation must stay outside pure packages and must update
  this ADR, the compatibility matrix, privacy evidence and release checklist.

## Rejection

Do not ship:

- first-launch bank permission prompts;
- bank tokens in the JavaScript bundle, mobile local preferences or logs;
- provider rows writing directly to financial domain tables;
- fake provider logos, fake coverage, fake uptime or bank-level security claims;
- claims that disconnect revoked consent at the bank/provider when the API cannot prove it;
- Open Banking beta claims before regulated partner/legal/store gates pass.
