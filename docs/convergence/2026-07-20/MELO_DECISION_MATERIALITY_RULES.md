# Decision materiality rules

Status: executable in `apps/mobile/src/folio/lib/decisionLedger.ts`.

## Thresholds

| Rule id                       | Threshold                                        |
| ----------------------------- | ------------------------------------------------ |
| `cash-effect-gte-10gbp`       | absolute cash effect >= £10                      |
| `safe-buffer-effect-gte-5gbp` | absolute protected/safe-buffer effect >= £5      |
| `date-shift-gte-1-day`        | commitment date changes by at least 1 day        |
| `changes-shortfall-state`     | decision can affect whether a shortfall exists   |
| `income-assumption-gte-50gbp` | income assumption changes by at least £50        |
| `cycle-close-accountability`  | payday/cycle close always records accountability |

## Important rule

User confirmation alone is not enough. A confirmed Melo tool action must still cross a materiality threshold, affect a shortfall, or be a cycle-close accountability moment. This prevents the ledger becoming chat history or generic activity logging.

## Included decision types

- `purchase-affordability`
- `recurring-commitment-change`
- `debt-payment`
- `pot-contribution`
- `pot-borrow`
- `spending-hold`
- `recovery-plan`
- `payday-plan`
- `income-assumption`
- `bill-date-change`
- `scenario-choice`
- `manual-financial-adjustment`
- `melo-confirmed-action`

## Excluded events

Opening a screen, changing theme, typing without submitting, viewing an insight, ordinary Melo chat, non-material dismissals, delivered notifications, and cosmetic changes are never material decisions.
