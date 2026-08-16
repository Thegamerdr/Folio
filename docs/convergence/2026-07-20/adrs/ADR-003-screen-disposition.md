# ADR-003: Screen disposition

Status: Accepted for Phase B.

## Context

RN and Lovable do not map one-to-one, and not every designed surface belongs in Trusted Core.

## Decision

Every current RN and Lovable screen is assigned a treatment in `MELO_SCREEN_DISPOSITION.md`: Preserve, Correct, Evolve, Redesign, Merge, Remove or Defer.

## Consequences

- Phase C can work on Today/Safe Range without relitigating unrelated screens.
- Business screens remain separate.
- RN-only Timeline/Melo Memory/Melo Moves are not deleted; they are evolved or merged under target IA.

## Enforcement

The architecture test requires `MELO_SCREEN_DISPOSITION.md` to exist in the versioned packet.

