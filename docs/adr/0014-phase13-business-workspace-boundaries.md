# ADR 0014: Phase 13 Business Workspace Boundaries

## Status

Accepted for Phase 13 synthetic contract evidence.

## Context

Phase 13 exposes the optional business workspace promised by the source package. Business must be a
distinct user-facing workspace, not a filter over personal records. It introduces clients, invoices,
receipts, business calendar items, tax preparation records, reports, exports, mileage and business
Melo context while preserving the personal workspace as the default experience.

Business tax and compliance surfaces are high-risk. The source package requires traceable exports
with workspace, period, policy version, source evidence, unresolved items and timestamp, but direct
tax filing is explicitly deferred to a later compliance programme.

## Decision

Add pure package `@folio/business-workspace` for business workspace contracts and release gates. The
package models:

- optional workspace switcher with persistent label, distinct navigation and no personal onboarding
  pressure;
- business-scoped account and transaction query boundaries;
- client and invoice lifecycle state with expected cash-flow events;
- proposed invoice/payment matching where ambiguous matches require review;
- receipt/document evidence retention and tax review queue;
- tax period records with jurisdiction, policy pack, source evidence and unresolved items;
- tax reserve estimates that carry assumptions and avoid final-bill language;
- business calendar, business Melo context, reports, exports and mileage state;
- tax/legal review, workspace isolation attack suite and business beta gate blockers.

The Expo shell renders synthetic-labelled business evidence only. It does not create a real
business, store real client data, capture native documents, file taxes, connect payment providers,
perform billing entitlement checks or make beta release claims.

## Consequences

- Phase 13 can prove business workspace separation and internal product contracts without tax,
  legal, billing or native document release claims.
- T180 and T182 remain blocked for release until UK tax/business claims, recordkeeping, MTD
  readiness, legal signoff, entitlement, support and accessibility review are complete.
- T176 carries native alert proof as a follow-up before native scheduling claims.
- Any future direct filing, accountant collaboration, live entitlement, real business data import or
  native capture implementation must update this ADR, the compatibility matrix, privacy evidence and
  release checklist.

## Rejection

Do not ship:

- business mode as a color-only filter over personal records;
- combined personal/business tax ledger exports;
- direct HMRC or MTD filing from this phase;
- final-tax-bill wording, fake tax authority badges or fake accountant confidence;
- business beta claims before tax/legal, entitlement, support, accessibility and isolation gates
  close.
