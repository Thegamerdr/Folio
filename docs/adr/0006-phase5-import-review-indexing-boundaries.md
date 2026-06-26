# ADR 0006: Phase 5 Import Review And Indexing Boundaries

Date: 2026-06-21

Status: Accepted with explicit blockers

## Context

Phase 5 starts the import/review/indexing pipeline. The source package requires local-first,
resumable, explainable and reviewable import work, but several capabilities still depend on
native/vault evidence that is not available yet.

Encrypted file staging depends on T018. PDF/image OCR depends on T017 and the native capture/OCR
adapter. The real review UI and accepted-row commit path depend on T061/T062 vault create/unlock
work and a vault-backed transaction repository.

## Decision

Implement the unblocked Phase 5 slices without claiming the blocked native pieces:

- Put CSV, OFX/QFX, QIF, provenance, duplicate, transfer, reconciliation, categorisation,
  search-entry and bounded-question logic in pure `@folio/import-engine`.
- Keep `@folio/import-engine` free of React, React Native, Expo, SQLite, cloud SDKs, AI SDKs,
  app code and V1 runtime dependencies.
- Add a mobile import-review shell that renders choices, staging blockers, row states and totals
  without requesting file permissions.
- Add a storage import-commit command-bus handler for atomic search/jobs/audit evidence, while
  explicitly caveating that domain row writes await the vault-backed transaction repository.
- Treat Figma as review evidence only; the repository, emulator and tests remain source of truth.

## Consequences

Phase 5 can advance parser, review-state and indexing contracts while retaining honest release
boundaries.

The mobile shell may show sample review rows only as labelled proof of state handling. It must not
present them as imported user data. Native file pickers, encrypted file copy, OCR, cloud model
classification, real vault commit and real-data Today briefing remain blocked until their upstream
tasks have evidence.

## Evidence

- `packages/import-engine/src/index.ts`
- `packages/import-engine/test/import-engine.test.ts`
- `packages/storage/src/import-commit.ts`
- `packages/storage/test/import-commit.test.ts`
- `apps/mobile/src/phase5/importReviewAdapter.ts`
- `apps/mobile/src/phase5/importReviewAdapter.test.ts`
- `apps/mobile/app/index.tsx`
- `docs/release-evidence/C5-import-review-indexing.md`
- `docs/release-evidence/figma-phase5-evidence.png`
- `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=7-3`
