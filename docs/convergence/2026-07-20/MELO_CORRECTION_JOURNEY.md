# Correction and recalculation journey

## Contract

Challenge answer → show source/calculation → choose fact → preserve original → apply corrected value → recalculate → show before/after → mark affected decisions → remember if permitted.

## Phase E implementation

- Domain type: `CorrectionImpactRecord`.
- Helper: `deriveCorrectionImpact`.
- Store seam: `recordCorrectionImpact`.
- Affected Decision Ledger entries receive a correction and become `corrected`.
- Historical receipts are not silently rewritten.

## Covered correction targets

- balance
- transaction
- bill
- income
- debt
- subscription
- date
- recurrence
- truth classification
- source link
- forecast assumption

## Deferred

- Source re-import reconciliation UI.
- Duplicate-source link/overwrite sheet.
