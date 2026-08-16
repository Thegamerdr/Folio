# Phase E critical journeys

Status: implemented as Trusted Core seams for Personal only. No Phase F semantic AI, navigation migration, Business expansion or Open Banking production work started.

## Canonical journeys

| Journey                      | Entry points                                       | Current seam                                                      | Phase E result                                                                                                  | Ledger rule                                               |
| ---------------------------- | -------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| First trustworthy answer     | Start, Onboarding, empty Today                     | Safe Range adapter existed; first-answer continuity did not       | `buildProvisionalFirstAnswer` creates a provisional Safe Range with entered facts, unknowns and next best input | no receipt on view; receipt only after a material choice  |
| Material financial change    | WhatChangedRow, Timeline, Review, statement import | row/import summaries existed; causal before/after did not persist | `MaterialFinancialChange` persists deterministic causality and feeds WhatChangedRow                             | affected receipts are listed, not rewritten               |
| Financial decision           | WhatIf, Recovery, Pots, Subs, Payday Ritual        | Decision Ledger existed; duplicate submit could demote status     | scenario comparison helper plus idempotent material-decision wrapper with explicit consent                      | one immutable receipt per idempotency key                 |
| Pressure and recovery        | Today pressure card, Recovery, Shortfall           | recovery actions existed as isolated writes                       | supported recovery moves are derived only from actual state; spend hold writes a receipt awaiting outcome       | required for confirmed recovery                           |
| Payday and cycle close       | Payday Ritual                                      | cycle close already wrote a payday-plan receipt                   | forecast accountability helper classifies inside/conservative/outside without score                             | receipt created on confirmed cycle close                  |
| Correction and recalculation | Review, Timeline, Decision Receipt, source sheet   | transaction edits existed; decision impact was not explicit       | `CorrectionImpactRecord` preserves original/corrected values and marks affected receipts corrected              | historical receipt is corrected, never silently rewritten |

## Current versus target map

| Journey         | Working                                                                                    | Partial                                                                          | Missing / deferred                                                   |
| --------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| First answer    | provisional Safe Range, unknowns, persistence, no ledger-on-view                           | UI entry remains existing Start/Onboarding/Today seams                           | dedicated first-answer screen polish; bank-connect bypass copy audit |
| Material change | causal record, before/after snapshots, WhatChangedRow integration, relaunch persistence    | automatic recording is exposed as a store seam; not attached to every writer yet | source-specific UI sheets and bulk simultaneous-change grouping      |
| Decision        | baseline/proposed/modified comparison, immutable scenarios, consent, duplicate idempotency | receipt placement remains Decision History under More                            | full scenario input UI                                               |
| Recovery        | protection order, state-supported move filter, spend-hold receipt                          | move bundle confirmation remains existing recovery UI                            | full multi-move preview sheet                                        |
| Payday          | forecast accountability helper and payday receipt                                          | existing ritual UI still drives cycle close                                      | richer “what Melo got wrong” UI                                      |
| Correction      | original/corrected preserved; affected decisions marked corrected                          | correction UI still uses existing edit/review surfaces                           | source re-import reconciliation sheet                                |

## Files enforcing this phase

- `packages/domain/src/trustedCore.ts`
- `apps/mobile/src/folio/lib/criticalJourneys.ts`
- `apps/mobile/src/folio/store.ts`
- `apps/mobile/src/folio/lib/whatChanged.ts`
- `apps/mobile/src/folio/ui/WhatChangedRow.tsx`
- `apps/mobile/src/folio/lib/export.ts`
- `apps/mobile/src/folio/lib/criticalJourneys.test.ts`
