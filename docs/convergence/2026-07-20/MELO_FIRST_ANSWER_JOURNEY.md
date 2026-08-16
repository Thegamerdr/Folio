# First trustworthy answer journey

## Contract

Start → urgent question → minimum facts → provisional Safe Range → unknowns → one more fact → recalculation → explanation → optional save/setup continuation.

## Phase E implementation

- Pure helper: `buildProvisionalFirstAnswer` in `apps/mobile/src/folio/lib/criticalJourneys.ts`.
- Persisted record: `ProvisionalAnswerRecord` in `@folio/domain`.
- Store seam: `recordProvisionalAnswer`.
- Migration: schema v18 adds `provisionalAnswers: []` without fabrication.

## States covered

- empty user
- manual current balance
- balance plus payday
- missing income
- unknown essential bills / regular commitments
- low-confidence/provisional reliance
- exit without saving
- save/setup continuation as a stored provisional record
- no Decision Ledger entry merely for viewing

## Deferred

- Dedicated polished first-answer UI.
- Voice/open-ended Melo prompt is intentionally excluded.
- Production bank-connect path remains outside Phase E.
