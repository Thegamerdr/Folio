# Melo Safe Range rules

## Definition

Trusted Safe Range answers:

> Given what Melo knows, what range of money is safe to rely on before the tightest point?

It is not a budget category. It is not a bank balance. It is a decision boundary with truth, source, freshness and reliance metadata.

## Workspace rule

Personal Safe Range reads only the active Personal workspace. If a Business workspace or mismatched data workspace is passed, the adapter returns:

- `status: workspace_blocked`
- `reliance: blocked`
- no expected range
- a blocking missing input explaining the workspace boundary

## Opening position

Opening position is bank-only:

`Σ(non-liability account balances)`

Credit-card balances are excluded because they are borrowing, not spendable cash.

## Spendable forecast opening

The forecast opening is:

`bank-only balance − Σ(saved pot balances)`

Saved pots are already earmarked. They reduce spendable cash immediately.

## Forecast events

The forecast includes:

- resolved payday income;
- income-source cadences;
- active subscriptions;
- manual outflows/inflows;
- pot top-ups;
- What If holds;
- Recovery spend hold;
- debt minimum payments.

The adapter does not count pending review items as posted facts.

## Known committed floor

Known committed floor is the lowest forecast closing amount before uncertainty is applied.

## Expected range

Expected range is:

- `min = known committed floor − quantified downside uncertainty`
- `max = known committed floor + quantified upside uncertainty`

The adapter does not add arbitrary padding.

## Quantified uncertainty sources

| Source | Direction | Amount |
|---|---:|---:|
| Stale balance with daily-spend history | Down | stale days × historical daily spend |
| Variable or estimated bill | Down | 20% of the explicit bill amount |
| Pending review outflows | Down | exact pending outflow total |
| Pending review income | Up | exact pending income total |
| Pending refund | Up | exact pending refund amount |
| Borrowed pot funds | Down | open borrow minus repayment |

If a source cannot be quantified, it lowers confidence but does not widen the range.

## Blocked range rule

When blockers exist, Melo must not turn zeros or defaults into a trusted range.

Blocked statuses set expected range to unavailable:

- `insufficient_data`
- `workspace_blocked`

## Status precedence

First match wins:

1. workspace blocked
2. blocker missing input
3. contradiction
4. shortfall
5. stale
6. sample demo
7. caution
8. ready

## Shortfall

Shortfall is positive money:

`abs(expectedRange.min)` when `expectedRange.min < 0`

## Legacy Safe Zone

Legacy Safe Zone is a compatibility input only. It must not gain new product semantics.
