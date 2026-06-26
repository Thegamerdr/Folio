# Architecture Decision Records

## ADR-001: Greenfield repository

**Decision:** Build V2 in a new repository. V1 is donor material only.  
**Why:** Prevent architectural anchoring and patching.  
**Consequence:** Existing users migrate through an import adapter.

## ADR-002: Local encrypted database is authoritative

**Decision:** Every core read/write goes to the on-device encrypted SQLite vault.  
**Why:** Offline availability, latency, ownership and privacy.  
**Consequence:** Sync is a replicated optional service, not the source of truth.

## ADR-003: Facts, expectations and hypotheticals are separate

**Decision:** Posted transactions never become forecast rules and scenarios never mutate facts.  
**Why:** Explainability and correction safety.  
**Consequence:** Derived views reconcile related entities.

## ADR-004: Typed commands and proposals

**Decision:** All writes use commands; Melo/AI/imports create typed proposals.  
**Why:** Auditability, invariants and no agent direct writes.  
**Consequence:** More initial structure, much lower long-term risk.

## ADR-005: Personal/business workspace isolation

**Decision:** Shared engines, isolated data/context/navigation/reporting/keys.  
**Why:** Tax accuracy and user clarity.  
**Consequence:** Cross-workspace transfers are explicit linked movements.

## ADR-006: AI optional and provider-agnostic

**Decision:** Deterministic templates first; on-device/cloud models through registry.  
**Why:** Offline promise, cost control and model lifecycle volatility.  
**Consequence:** Every AI task has a manual fallback and evaluation contract.

## ADR-007: Authentication separate from vault recovery

**Decision:** Apple/Google/passkey login cannot be the only decryption recovery path.  
**Why:** Authentication does not recreate a zero-knowledge key.  
**Consequence:** Recovery code/passphrase/device-transfer UX is required.

## ADR-008: Internal calendar first

**Decision:** Folio stores its own calendar; system calendar integration is optional and scoped.  
**Why:** Offline consistency and permission minimisation.  
**Consequence:** Local notification scheduling occurs when facts change.

## ADR-009: Business tax filing is a later compliance module

**Decision:** Launch with preparation/export, not direct HMRC filing.  
**Why:** Filing has separate API, legal and operational obligations.  
**Consequence:** Tax records include provenance and policy-pack versions from day one.

## ADR-010: No dashboard as primary shell

**Decision:** Today briefing/Melo/timeline/calendar form the primary experience.  
**Why:** Users seek answers and progress, not widget interpretation.  
**Consequence:** Analytical dashboards are optional deeper views.

## ADR-011: Mobile background execution is non-authoritative

**Decision:** Correctness never depends on an exact future background wake.  
**Why:** iOS/Android schedule opportunistically.  
**Consequence:** Persist jobs, schedule notifications ahead and refresh on foreground.

## ADR-012: Monetisation is capability-based

**Decision:** Domain records do not know price tiers. Entitlements map products to optional capabilities.  
**Why:** Business model is not yet locked and users must retain access to their data.  
**Consequence:** Subscription lapse reduces service convenience, not ownership.
