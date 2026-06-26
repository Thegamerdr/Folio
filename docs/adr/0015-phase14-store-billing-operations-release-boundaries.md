# ADR 0015: Phase 14 Store Billing Operations Release Boundaries

## Status

Accepted for Phase 14 synthetic contract evidence.

## Context

Phase 14 is the final store, billing, operations and release-governance slice in the executable
backlog. It covers Apple/Google declarations, capability entitlements, store billing behavior,
support and incident runbooks, final penetration/privacy review, regression/store builds, limited
UK launch, outcome measurement and future roadmap gates.

These surfaces are release-critical and depend on external evidence: submitted binary behavior,
StoreKit 2, Google Play Billing, backend receipt verification, account deletion routes, DPIA,
processor inventory, legal signoff, penetration testing, accessibility review, support operations
and production monitoring. The source package also names later expansions such as household
collaboration, direct HMRC MTD and additional jurisdictions as separate programmes with new
privacy, threat and regulatory review.

## Decision

Add pure package `@folio/store-release` for Phase 14 contracts and release gates. The package
models:

- Apple/Google declaration readiness against actual binary/data flows;
- capability-based entitlements that do not bind core data, existing records or full export to a
  price tier;
- StoreKit/Play Billing/native/backend receipt proof blockers;
- incident/support runbook coverage for calculation, sync, provider, AI, tax, security and store
  removal incidents;
- final penetration, DPIA, processor, legal, privacy, security and accessibility review blockers;
- final regression, golden-vector, migration, offline E2E, account-deletion and store-build proof
  blockers;
- limited UK production launch flags, cohort, rollback, operations and monitoring gates;
- outcome research protocol without hidden profiling;
- roadmap guardrails for household collaboration, direct HMRC MTD, accountant collaboration,
  multiple businesses and additional jurisdictions.

The Expo shell renders synthetic-labelled Phase 14 evidence only. It does not submit to app stores,
call billing SDKs, verify real purchases, enable production launch, file taxes, start household
collaboration or launch any new jurisdiction.

## Consequences

- Phase 14 can prove release-governance contracts and the visible blocker model without claiming
  public launch readiness.
- T183 through T188 remain blocked for release until real external store, billing, legal, security,
  privacy, accessibility, support and launch evidence exists.
- T189 is implemented as a privacy-safe measurement protocol, not as real research evidence.
- T190 through T192 remain evaluation-only guardrails; no implementation may start without a
  separate programme, signed review and go/no-go decision.
- Any future real store submission, billing SDK integration, production launch, household
  collaboration, HMRC MTD or jurisdiction rollout must update this ADR, the compatibility matrix,
  privacy evidence, source/licence register and release checklist.

## Rejection

Do not ship:

- fake Apple, Google, HMRC, accountant or compliance approval badges;
- pricing cards that imply locked products before entitlement and billing proof exists;
- subscription behavior that hides existing records or a basic full export;
- production launch claims before final legal/security/privacy/accessibility gates close;
- household collaboration, direct HMRC filing or additional jurisdictions inside this phase.
