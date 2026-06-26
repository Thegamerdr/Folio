# ADR 0008: Phase 7 Melo Deterministic Boundaries

Date: 2026-06-21

Status: Accepted with explicit blockers

## Context

Phase 7 introduces Melo as a deterministic accountability and explanation layer. The source
package requires bounded intents, typed proposals, personality modes, proactive ranking, review and
commit flow, bad-month mode and local templates. It also requires Melo to work when all model and
network access is disabled.

Melo must not act as a financial adviser, debt counsellor, accountant, therapist, bank
representative or omniscient agent. Melo can propose reviewed changes, but cannot directly write to
domain tables. Voice-to-proposal, real vault commits and manual accessibility recordings are not
available yet.

## Decision

Expand `@folio/melo-policy` as the Phase 7 pure contract package:

- Add a bounded intent registry with required slots, maximum question counts, stop conditions and
  structured fallbacks.
- Add deterministic briefing and tone-mode rendering that works without model or network access.
- Add typed proposal lifecycle helpers that produce command envelopes only after user acceptance.
- Add proactive intervention ranking with fatigue, dismissal and quiet-hour controls.
- Add bad-month mode, compact memory records, correction learning and voice-to-proposal blocker
  metadata.
- Expand language-policy blocking for advice, suitability, tax/legal certainty, guarantees, shame,
  false reassurance and certainty overclaims.
- Add no-AI acceptance evidence for core Melo behavior.

Add `apps/mobile/src/phase7` as a synthetic-labelled UI evidence adapter and render it in the Expo
Today shell. The UI must show Melo as present and helpful without making chat mandatory or blocking
normal controls.

## Consequences

Phase 7 can prove deterministic Melo behavior, advice-language blocking, proposal boundaries and a
mobile evidence shell. It cannot claim voice capture, native audio transcription, real vault-backed
commits, regulated legal review or manual accessibility completion.

Figma and Huashu remain design-review evidence. Repository code, tests and emulator artifacts remain
the source of truth.

## Evidence

- `packages/melo-policy/src/index.ts`
- `packages/melo-policy/test/advice-language.test.ts`
- `apps/mobile/src/phase7/meloShellEvidence.ts`
- `apps/mobile/src/phase7/meloShellEvidence.test.ts`
- `apps/mobile/app/index.tsx`
- `docs/release-evidence/C7-melo-deterministic-system.md`
- `docs/release-evidence/android-live-preview-phase7-top.png`
- `docs/release-evidence/android-live-preview-phase7-gate.png`
- `docs/release-evidence/figma-phase7-evidence.png`
