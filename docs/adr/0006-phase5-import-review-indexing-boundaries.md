# ADR 0006: Phase 5 Import Review And Indexing Boundaries

Date: 2026-06-21

Status: Accepted; Android local OCR amendment proven 2026-07-14

## Context

Phase 5 starts the import/review/indexing pipeline. The source package requires local-first,
resumable, explainable and reviewable import work, but several capabilities still depend on
native/vault evidence that is not available yet.

Encrypted source-file staging depends on T018. The original decision also treated PDF/image OCR as
blocked on T017. The current Android app now includes and bundles its native capture/OCR adapter,
while encrypted source retention, iOS Vision and vault-backed accepted-row storage remain separate
unproven capabilities.

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
- Keep native OCR inside `apps/mobile/modules/folio-reader`; pure import packages receive text and
  metadata, never Android or ML Kit dependencies.
- Read image/PDF input locally first. Optional cloud reading may run only after a per-document
  explanation and explicit user choice; denial keeps the local/manual route.
- Treat every OCR row as a low-confidence proposal. It may move into Review, but never directly
  into ledger truth.
- Surface partial PDF coverage when the Android renderer reaches its 15-page local safety cap.

## Consequences

Phase 5 can advance parser, review-state and indexing contracts while retaining honest release
boundaries.

The production Android image picker/camera and bundled ML Kit recogniser are now connected and
live-proven. The proof produced five statement candidates and routed them to Review without
accepting them. Synthetic proof data was cleared from the emulator afterward.

This amendment does not approve encrypted source-document storage, iOS OCR, silent cloud fallback,
model classification, real vault commit or real-data Today briefing. The UI must distinguish those
capabilities rather than allowing one proof to imply the others.

## Evidence

- `packages/import-engine/src/index.ts`
- `packages/import-engine/test/import-engine.test.ts`
- `packages/storage/src/import-commit.ts`
- `packages/storage/test/import-commit.test.ts`
- `apps/mobile/src/phase5/importReviewAdapter.ts`
- `apps/mobile/src/phase5/importReviewAdapter.test.ts`
- `apps/mobile/modules/folio-reader`
- `apps/mobile/src/local/localOcrCandidates.ts`
- `apps/mobile/src/local/localOcrCandidates.test.ts`
- `apps/mobile/src/folio/screens/IntakeScreen.tsx`
- `apps/mobile/app/index.tsx`
- `docs/release-evidence/C5-import-review-indexing.md`
- `artifacts/ocr-proof/03-local-ocr-success.png`
- `artifacts/ocr-proof/04-local-ocr-review.png`
- `artifacts/ocr-proof/melo-local-ocr-x86_64-release.apk`
- `docs/release-evidence/figma-phase5-evidence.png`
- `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=7-3`
