# Decision UI states

Status: minimal RN surface implemented.

## Location

Decision History lives under `More`. It is not a permanent tab.

## List groups

- Awaiting outcome
- Recently resolved
- Draft or cancelled

Each row shows decision text, date, status, expected effect and outcome. State is visible in text, not colour only.

## Receipt

The receipt renders deterministic lines from `receiptSummary`:

- decision
- decision type
- status
- Safe Range caution when applicable
- outcome
- forecast evaluation

The receipt works without AI-generated text.

## Controls

The screen exposes:

- Correct
- Export
- Disable learning
- Remove learning
- Delete receipt

Controls use minimum 44px touch targets. The Business workspace shows an explicit empty state because Business Decision Ledger is not in Phase D.

## Remaining UI risk

The receipt is intentionally simple. A later phase should add a fuller receipt sheet with facts/sources, unknowns, assumptions, scenarios, consent and corrections in separate sections.
