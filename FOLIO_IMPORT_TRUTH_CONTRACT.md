# Folio Import Truth Contract

Date: 2026-06-24

This contract describes what the current deterministic import path must produce before any imported row can affect the money view.

## Inputs

Supported deterministic inputs in this pass:

- CSV
- pasted statement text
- OFX/QFX
- QIF as legacy best effort

Not supported as a finished input in this pass:

- OCR automation
- image-only screenshot import
- Open Banking
- PDF statement extraction

## Required Output Shape

For each import source, Folio must expose:

- Source record: import job id, source file id, source kind, account id, parser/read method, parsed time and row count.
- Staged rows: one reviewable row per parsed source claim.
- Parse/read warnings: formula-like text, ambiguous dates, ambiguous amounts, missing required fields, balance mismatch, and legacy format limits.
- Uncertainty state: evidence level and review reasons without fake certainty.
- Review status: every row starts review-first unless it is explicitly safe for user confirmation.
- Accepted transactions: created only after review acceptance.
- Possible duplicates: grouped as review warnings and not double counted.
- Possible recurring patterns: surfaced as possible meanings, not final commitments.
- Possible transfers: linked movement candidates, not income or spending.
- Possible refunds: possible refund/correction meanings for review.
- Possible income: possible income meanings for review.
- Unresolved rows: unclear merchants and low-certainty rows remain review-only.

## Contract Mapping In Code

- Source record: `ImportParseResult.metadata`, `ImportReviewPacket.importJobId`, `ImportReviewPacket.sourceFileId`, `ImportReviewPacket.format`, `ImportReviewPacket.parser`.
- Staged rows: `ImportReviewPacket.rows`.
- Parse/read warnings: `ImportParseResult.issues`, `CanonicalImportRow.reviewState.reasons`, `ImportReviewPacket.rows[].reasons`.
- Review status: `ImportReviewPacket.rows[].reviewStatus` and `ImportReviewPacket.rows[].decisionState`.
- Accepted rows preview: `ImportReviewPacket.commitPreview.acceptedRows`.
- Deferred rows: `ImportReviewPacket.commitPreview.deferredRowIds`.
- Duplicates: `ImportReviewPacket.duplicates`.
- Transfers: `ImportReviewPacket.transfers`.
- Balance mismatch: `ImportReviewPacket.reconciliation`.
- Income/spending/transfer movement totals: `ImportReviewPacket.cashflow`.
- Meaning/event proposals: `buildImportMeaningIndex`.

## Review Rule

Rows are staged before acceptance. Staged rows are claims, not money rows.

Only accepted rows can become saved transactions. Meaning/event proposals remain possible unless user confirmation or an explainable deterministic rule permits promotion.

## Tests

Current proof lives in:

- `packages/import-engine/test/import-engine.test.ts`
- `apps/mobile/src/local/importTruthChain.test.ts`
- `apps/mobile/src/surfaces/uiTrustReviewCopy.test.ts`
