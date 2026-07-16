# ADR 0014: Phase 13 Business Workspace Boundaries

## Status

Accepted. The synthetic Phase 13 contract is retained as historical evidence. The production
schema-v11 isolation, lifecycle and empty native surface foundation is implemented; the complete
manual Business alpha and its release evidence are not.

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

The historical Expo shell rendered synthetic-labelled evidence only and is not the production
base. The authoritative React Native app now provisions one optional empty Business workspace in a
separate authenticated state file and separately keyed SQLCipher database, supports atomic
create/switch/rename/archive/restore, and renders scoped empty Today, More and Melo surfaces. It does
not seed sample company or financial records, file taxes, connect payment providers automatically,
or make beta release claims.

The first real target is a UK sole trader, freelancer or owner-operator who needs personal and
business money kept visibly separate. Melo remains in primary navigation and changes to a strictly
business-scoped local context when the workspace changes. The sellable MVP and commercial sequence
are defined in `docs/product-strategy/MELO_BUSINESS_AND_OPEN_BANKING.md`; that document does not turn
the synthetic Phase 13 shell into a completed product.

## Consequences

- Phase 13 can prove business workspace separation and internal product contracts without tax,
  legal, billing or native document release claims.
- Production schema v11 makes the workspace boundary physical as well as logical. The encrypted
  manifest is the commit record; per-workspace state and SQLCipher stores are opaque and separately
  keyed; Personal alone can migrate the historic database.
- Melo stays in primary navigation. The workspace control is a separate labelled utility surface,
  so changing workspace changes Melo's local context rather than removing the companion.
- The manual Business alpha is not complete until real Business intake/review, evidence, cash-flow,
  export and device/accessibility gates pass without cross-workspace leakage.
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
