# ADR 0001: Greenfield Monorepo And Boundaries

Date: 2026-06-20

Status: Accepted

## Context

The source package requires Folio V2 to be implemented in a clean repository, with pure deterministic engines separated from UI, native storage, cloud, AI and provider SDKs. Phase 0 must prove the repository and architectural boundaries before product UI work or V1 donor use.

## Decision

Use a pnpm workspace with strict TypeScript project references. Keep mobile UI, pure engines, storage/crypto abstractions, optional services and implementation evidence in separate top-level workspaces. Add a custom dependency-boundary script that blocks mobile, Expo, React Native, SQLite, cloud, AI-provider and app/service imports from pure engine packages.

## Consequences

This favors explicit package contracts early and makes illegal coupling fail in CI. The first mobile app is only a shell until native database and crypto spikes select the production stack.

## Evidence

- Source package: `25_COMPLETE_BUILD_SEQUENCE_AND_ACCEPTANCE.md`
- Source package: `21_TECHNICAL_ARCHITECTURE.md`
- Guardrail: `tooling/scripts/check-boundaries.mjs`
