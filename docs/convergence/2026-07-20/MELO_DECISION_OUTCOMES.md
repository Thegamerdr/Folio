# Decision outcomes

Status: implemented in the domain contract and service.

## Entry statuses

- `draft`
- `presented`
- `chosen`
- `declined`
- `awaiting-outcome`
- `resolved`
- `corrected`
- `cancelled`
- `expired`
- `deleted`

`corrected` and `deleted` are Phase D operational states. Deleted entries are returned only as immediate redacted tombstones and are removed from durable exportable state.

## Outcome states

- `as-expected`
- `better-than-expected`
- `worse-than-expected`
- `partially-observed`
- `not-observed`
- `invalidated-by-new-information`
- `user-reversed`
- `unknown`
- `expired`

Silence is never success. A decision becomes resolved only when user confirmation, ledger evidence, cycle close, recalculated Safe Range, reviewed import, or explicit system evidence supplies an outcome.

## Reversal

Cancellation maps to entry status `cancelled` and outcome `user-reversed`. Undo hooks that already reverse the underlying financial mutation remain legacy; a later phase should link undo callbacks to the specific decision entry.
