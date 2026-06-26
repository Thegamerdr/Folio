# ADR 0012: Phase 11 Optional AI Boundaries

Date: 2026-06-21

Status: Accepted with explicit blockers

## Context

Phase 11 introduces optional AI routes for typed intent parsing, friendly explanations, low-risk
extraction/classification, Melo wording variation, quotas, model evaluation and future staged beta
operations. The source package is explicit that AI is a convenience layer over deterministic
finance: it is not the financial source of truth, it cannot decide which action is best, and it
cannot write domain records directly.

Several Phase 11 requirements cannot be completed by a pure TypeScript package or synthetic Expo
screen. A real server-side gateway, provider procurement, provider data-use review, model/prompt
evaluation, DPIA/processor approval, cost/error monitoring, rollback, beta operations and cloud
security evidence are still required before any live model route can be released.

## Decision

Extend `@folio/ai-contracts` as the Phase 11 pure contract package:

- Model versioned AI task schemas with typed output validation.
- Model provider registry metadata for lifecycle, configurable pricing and data-use policy without
  pinning a launch provider in the mobile bundle.
- Model AI gateway readiness for auth, quota, redaction, server-side provider calls, no database
  credentials and invalid-output rejection.
- Model minimal context building so task inputs are workspace-scoped, field-limited and
  identifier-redacted by default, with no full-database route.
- Model on-device capability checks with deterministic/manual fallback when a platform model is
  unavailable.
- Model cloud small and rare strong routes through the registry, while rejecting regulated advice
  and authoritative-write tasks.
- Model cloud AI quota and operator-only cost scenarios without tying core finance to paid units.
- Model evaluation gates for schema validity, intent, faithfulness, advice boundary, tone,
  workspace leakage, prompt injection and clarification limits.
- Model Melo integration so AI can draft wording or parse proposals only; AI-off behavior keeps the
  same financial conclusion.
- Model first-cloud-AI consent and strict beta readiness.

Add `apps/mobile/src/phase11` as a synthetic-labelled evidence adapter and render it in the Expo
Today shell after Phase 10. The shell may show routes, blockers and review evidence, but it must
not claim a real provider connection, provider key, model call, gateway deployment, full-vault
context, live cloud consent or AI beta readiness.

## Consequences

Phase 11 can now prove provider-agnostic AI contracts, local/manual fallback, typed validation,
minimal context, quota accounting, evaluation blocking and honest mobile UX for optional AI.

Phase 11 remains blocked for live release until:

- The server-side AI gateway is implemented, authenticated, rate-limited and reviewed.
- Provider/model procurement and data-use review select a concrete launch route.
- Provider keys stay server-side and no database credential is available to the AI gateway.
- Cloud AI DPIA, processor inventory and store/privacy declarations are approved.
- Model/prompt evaluation passes schema validity, faithfulness, advice-boundary, workspace-leakage
  and prompt-injection thresholds.
- On-device adapter behavior is proven on supported iOS/Android platforms.
- Cost/error/correction monitoring, budget caps, support runbook and rollback are operational.
- Strict AI beta proves no core degradation and no unsafe model output.

Huashu and Figma remain review evidence. Repository code, tests and emulator artifacts remain the
source of truth.

## Evidence

- `packages/ai-contracts/src/index.ts`
- `packages/ai-contracts/test/ai-contracts.test.ts`
- `apps/mobile/src/phase11/optionalAiEvidence.ts`
- `apps/mobile/src/phase11/optionalAiEvidence.test.ts`
- `apps/mobile/app/index.tsx`
- `docs/release-evidence/C11-optional-ai.md`
