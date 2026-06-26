# ADR 0010: Phase 9 Security, Export And Local Launch Readiness Boundaries

Date: 2026-06-21

Status: Accepted with explicit blockers

## Context

Phase 9 moves Folio from feature-shell proof toward local-only beta readiness. The source package
requires document handling, extraction review, privacy controls, export/delete, threat modelling,
MASVS, DPIA, independent accessibility review, diagnostics, a synthetic reviewer vault,
migration/corruption/low-storage drills and private-beta signoff.

Several requirements need independent review, native file handling, platform key wrapping or
destructive device drills. Those are not available inside a pure TypeScript package or synthetic
Expo screen. Treating them as complete would create security theatre and false release confidence.

## Decision

Add `@folio/release-readiness` as the Phase 9 pure contract package:

- Model document-library metadata, retention, linking, local search, delete affordances and native
  encrypted-file blockers.
- Model extraction-review candidates with field, value, source, confidence and a no
  low-confidence commit gate.
- Model privacy/data-centre routes for data location, permissions, cloud status, export/delete and
  memory reset.
- Model human export surfaces for CSV, JSON and PDF-style summaries without cloud or subscription
  gates.
- Model threat controls, MASVS checks, DPIA processor routes, independent accessibility audit
  status, diagnostic signals, synthetic reviewer vault isolation, resilience drills and local-only
  beta readiness.

Add `apps/mobile/src/phase9` as a synthetic-labelled mobile evidence adapter and render it in the
Expo Today shell after Phase 8. The shell may show implemented local contracts and blockers, but it
must not claim native document encryption, app lock, independent MASVS clearance, DPIA approval,
independent accessibility completion, destructive-drill success or private-beta readiness.

## Consequences

Phase 9 can prove deterministic local-launch readiness contracts, no-cloud/no-subscription export
surfaces, sanitised diagnostics, and a synthetic reviewer vault. It cannot claim release readiness
until external and native gates close:

- Native encrypted document storage and workspace document subkeys.
- Keychain/Keystore app lock and timeout proof.
- Independent threat-model and MASVS review with no high/critical open findings.
- DPIA and processor-inventory approval.
- Independent VoiceOver/TalkBack/large text/reduced-motion/cognitive accessibility audit.
- Native migration interruption, corruption, full-disk/low-storage, kill-during-import and restore
  drills.
- Private beta operations and user-research signoff.

Huashu and Figma remain review evidence. Repository code, tests and emulator artifacts remain the
source of truth.

## Evidence

- `packages/release-readiness/src/index.ts`
- `packages/release-readiness/test/release-readiness.test.ts`
- `apps/mobile/src/phase9/releaseReadinessEvidence.ts`
- `apps/mobile/src/phase9/releaseReadinessEvidence.test.ts`
- `apps/mobile/app/index.tsx`
- `docs/release-evidence/C9-security-export-local-launch-readiness.md`
