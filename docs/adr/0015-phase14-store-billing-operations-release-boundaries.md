# ADR 0015: Phase 14 Store Billing Operations Release Boundaries

## Status

Accepted and amended on 2026-07-14 for the real Android billing foundation. Public billing remains
blocked on external Play configuration and purchase proof.

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

The original Expo shell remains synthetic evidence, but it is no longer the complete billing
implementation. The production Android app now calls `expo-iap`, distinguishes pending from
purchased transactions, and sends purchased tokens to a dedicated Worker. The Worker uses only a
fixed package/product allowlist, verifies with the Google Play Developer API, stores only a
SHA-256 token hash, signs Ed25519 entitlement grants, and attempts acknowledgement. The app verifies
the signed grant before persisting or unlocking and finishes a transaction only after that step.

Full and Live remain independent. Full is a permanent one-time ownership grant. Live uses the Play
expiry plus a 72-hour offline grace. Legacy Plus/Pro subscription products map to permanent Full
only after Google verifies them. Local core, existing records, export and the one-cycle Full preview
remain usable without billing or an account.

The Worker is deployed with signing and hash-only KV storage, but Google provider credentials are
intentionally absent because no authoritative Play listing/service account exists. The paywall
therefore remains in its honest unavailable-store/preview state and no live purchase is claimed.

## Consequences

- Phase 14 can prove release-governance contracts and the visible blocker model without claiming
  public launch readiness.
- The former unsigned on-device `source: store` tier label is not accepted as ownership.
- A pending, unknown, mismatched, expired or unverified purchase cannot unlock or be finished.
- Android source/server verification tests can pass before Play proof, but they do not close T184.
- T183 through T188 remain blocked for release until real external store, billing, legal, security,
  privacy, accessibility, support and launch evidence exists.
- T189 is implemented as a privacy-safe measurement protocol, not as real research evidence.
- T190 through T192 remain evaluation-only guardrails; no implementation may start without a
  separate programme, signed review and go/no-go decision.
- Any future real store submission, production launch, household
  collaboration, HMRC MTD or jurisdiction rollout must update this ADR, the compatibility matrix,
  privacy evidence, source/licence register and release checklist.

## Rejection

Do not ship:

- fake Apple, Google, HMRC, accountant or compliance approval badges;
- pricing cards that imply locked products before entitlement and billing proof exists;
- subscription behavior that hides existing records or a basic full export;
- production launch claims before final legal/security/privacy/accessibility gates close;
- household collaboration, direct HMRC filing or additional jurisdictions inside this phase.
