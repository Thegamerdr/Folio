# End-To-End Import Proof

Date: 2026-06-24

## Scenario

Required scenario:

```text
messy bank input
-> staged rows
-> review screen
-> accept income
-> accept bill
-> reject duplicate
-> mark transfer
-> keep unclear merchant for review
-> Today updates only from accepted rows
-> Timeline explains accepted changes
-> Plan/recovery updates only after accepted rows
```

## Current Proof

Automated proof:

- `packages/import-engine/test/import-engine.test.ts`
- `apps/mobile/src/local/importTruthChain.test.ts`
- `apps/mobile/src/local/routeSurfaceTruth.test.ts`
- `apps/mobile/src/surfaces/uiTrustReviewCopy.test.ts`

Specific assertions:

- Pasted text stages three rows and does not alter Today totals.
- Rejected duplicate evidence does not create transactions, Today totals, confirmed timeline facts or plan rows.
- Accepted income and bill rows become transactions and affect Today/Timeline/Plans.
- Transfer candidates are excluded from income/spending when confirmed.
- Possible meanings remain review-only unless user confirmation is supplied.

## Evidence Captures

Screenshots and XML are stored under:

```text
apps/mobile/evidence/whole-app-ux-import-truth-2026-06-24/screenshots/
apps/mobile/evidence/whole-app-ux-import-truth-2026-06-24/xml/
```
