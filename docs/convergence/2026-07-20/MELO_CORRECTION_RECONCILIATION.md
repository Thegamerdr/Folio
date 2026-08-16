# Correction and reconciliation

Store seams: `recordCorrectionImpact`, `editTransaction`, material-change capture in `apps/mobile/src/folio/store.ts`

Surfaces: `CorrectionImpactSheet`, `MaterialChangeCard`, `DecisionReceipt` in `apps/mobile/src/folio/ui/TrustedCoreSurfaces.tsx`

## Completed behaviour

| Requirement                                             | Status                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| Preserve original value                                 | Implemented in `CorrectionImpactRecord.original`                            |
| Preserve corrected value                                | Implemented in `CorrectionImpactRecord.corrected`                           |
| Recalculate before/after                                | Implemented through Safe Range snapshots where material                     |
| Mark affected decisions                                 | Implemented through `recordCorrectionImpact` and affected ids               |
| Do not rewrite old receipt                              | Implemented; receipts are marked affected/corrected                         |
| Show updated current position separately                | Implemented through What Changed / Decision History cards                   |
| Backup conflict never silently overwrites correction    | Explicit backup restore records review-required material change             |
| Re-import conflict never silently overwrites correction | Current review/candidate paths stage/resolve; no silent override path added |

## Entry points currently surfaced

- What Changed / Timeline material changes.
- Decision History selected receipt.
- Transaction edit path through `editTransaction`.
- Backup restore via restore UI path.

## Remaining narrow gap

The dedicated modal named `SafeRangeExplanationSheet` / `TruthAndSourceSheet` / `UnknownsAndContradictionsSheet` is not a separate route yet. E.1 adds the reusable content surfaces and embeds them in current screens.
