# Recovery bundle implementation

Surface: `apps/mobile/src/folio/screens/RecoveryScreen.tsx`

Shared surface: `RecoveryBundlePreview` in `apps/mobile/src/folio/ui/TrustedCoreSurfaces.tsx`

Engine input: `buildRecoveryRoutePreview` in `apps/mobile/src/folio/lib/recoveryPreview.ts`

## Completed flow

| Requirement                              | Status                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| Identify shortfall/protected-buffer risk | Existing Recovery route engine                                           |
| Present only supported moves             | Uses live pausable subscription, flexible bill and spend-hold capability |
| Multi-select one or more moves           | Implemented                                                              |
| Combined before/after Safe Range preview | Implemented                                                              |
| Consequence per move                     | Implemented in move cards and bundle preview                             |
| One confirmation                         | Implemented                                                              |
| One Decision Ledger receipt              | Implemented via bundle receipt and per-move receipt suppression          |
| Apply selected moves                     | Implemented through existing writers                                     |
| Partial recovery                         | Shows remaining gap and keeps the journey open in-place                  |
| Complete recovery                        | Routes back to Today-after without celebration/streak language           |

## Supported move types

- Move a genuinely flexible recurring charge by the existing bounded nudge window.
- Pause an actually present optional subscription.
- Set a bounded spending hold based on real discretionary average.

## Not invented

- No creditor flexibility is assumed.
- No cancellation success is assumed.
- No fabricated fallback bill/subscription is shown.

## Atomicity

The bundle confirmation records one receipt and then applies selected synchronous store writes. This is recoverable but not yet one durable SQL transaction.
