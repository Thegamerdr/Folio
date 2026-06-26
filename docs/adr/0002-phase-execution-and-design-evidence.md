# ADR 0002: Phase Execution And Design Evidence

Date: 2026-06-20

Status: Accepted

## Context

The source package requires phase discipline, checkpoint evidence, V1 donor audit controls and accessible mobile UI before later native/database work. The founder also requires whole-phase execution, Huashu review for UI/UX and Figma usage for design evidence.

## Decision

Execute Folio V2 by whole phases. Phase 0 remains active until T001 through T012 are complete or explicitly blocked with evidence. Use parallel agents only where ownership is disjoint. Use Huashu as the mandatory UI/UX critique gate. Use Figma as an editable evidence canvas for token and screen proof, while keeping repository contracts and source-package policy as source of truth.

The Phase 0 Figma evidence file is:

https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2

## Consequences

This prevents attractive product UI work from jumping ahead of native feasibility, donor isolation and accessibility proof. Figma artifacts are useful for review, but implementation remains driven by TypeScript tokens, tests, ADRs and release evidence.

## Evidence

- `docs/phase-execution-protocol.md`
- `docs/source-package/25_COMPLETE_BUILD_SEQUENCE_AND_ACCEPTANCE.md`
- `docs/source-package/agent/AGENT_CHECKPOINTS.md`
- Figma file: `Folio V2 Phase 0 Design Evidence`
