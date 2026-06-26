# Plans, Budgets, Forecasting and Scenarios

## Plans are optional

A plan is something the user is trying to make true. It is not required to use Folio and it is not a score of the person's worth.

Plan examples:

- clear a debt;
- build a £1,000 reserve;
- fund a holiday or major purchase;
- prepare for an annual bill;
- get one pay cycle ahead;
- build a business tax pot.

## Plan configuration

A plan can define:

- target amount or target state;
- optional target date;
- linked accounts/debts/categories;
- priority;
- minimum/maximum contribution;
- protected balance floor;
- funding frequency;
- dependencies or parent plan, if the user enables hierarchy;
- pause/recovery rules;
- missed-contribution behavior;
- Melo accountability style;
- celebration/milestone preferences.

Flat plans are the default. Hierarchy is optional, not imposed.

## Plan proposals

Melo can draft a plan after gathering only the facts needed for that plan. The draft shows assumptions, feasibility and the first scheduled actions. The user accepts or edits it. Once accepted, all plan changes are versioned.

## Plans do not fail

When actual events make a plan infeasible:

- retain the original history;
- create a rebased version;
- show what changed;
- calculate the new target date or gap;
- let the user keep, alter, pause or remove rules.

Use words such as `needs review`, `off the previous path` or `rebased`, not `failed`.

## Budgets

Budgets are optional control tools, not the product identity. Support:

- one flexible spending amount for a period;
- category allocations;
- bill/obligation reserves;
- rollover policy;
- personal or business workspace scope;
- user-selected weekly, payday or monthly periods.

Budget remaining is:

```text
accepted allocation
- posted spending
- user-selected reserved scheduled spending
± explicit rollovers/adjustments
```

The calculation exposes included transactions and exclusions.

## Forecast engine

The engine builds a dated ledger from:

- current confirmed account balances;
- pending and posted transactions;
- confirmed scheduled items;
- accepted recurring expectations;
- user-approved plan contributions;
- optional inferred occurrences;
- scenario changes.

Each occurrence is sorted by effective date and deterministic tie-break rules, then applied to account and consolidated balances.

### Forecast views

- **Known:** actual and confirmed items only.
- **Expected:** known items plus user-accepted recurring expectations.
- **Scenario:** an isolated hypothetical change.
- **Range:** optional uncertainty band when amount/date varies.

The UI defaults to the most useful expected view while making known/uncertain components inspectable.

## “Available before payday” calculation

Do not rely on a static subtraction formula. Simulate the period and find the maximum discretionary outflow that preserves the protections selected by the user:

- required bills/obligations remain funded on due dates;
- minimum debt payments selected as protected remain funded;
- designated account floors remain intact;
- already reserved plan/budget amounts are treated according to user rules.

Use monotonic search against the deterministic forecast to calculate the boundary. Present it as a projection with assumptions, not permission or advice.

## Scenario engine

A scenario clones the current projection, inserts one or more hypothetical changes and returns a diff:

- lowest projected balance and date;
- obligations affected;
- plan dates moved;
- budget remaining changed;
- debt payoff projection changed;
- certainty/assumptions.

No hypothetical writes to actual records until the user explicitly converts it into an accepted event, task or plan change.

## Debt simulations

Folio may neutrally model:

- contractual minimums;
- fixed extra amount;
- highest-rate-first;
- lowest-balance-first;
- user-defined order;
- pause/rebase scenarios.

The user selects the rule. The output compares dates, total modeled interest and cash-flow effects. Folio does not label a strategy “best for you.”

## Calculation precision

- integer minor units for money;
- decimal/rational math for rates;
- explicit rounding policy per product/currency;
- dates interpreted in workspace time zone;
- recurrence based on RFC 5545-compatible rules;
- deterministic versioned engine outputs.
