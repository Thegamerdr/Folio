# Financial Truth, Transactions and Events

## Three distinct concepts

### Transaction

A financial fact or bank-reported pending item: amount, date, account, counterparty and provenance.

### Event

The human meaning or consequence attached to a date: payday received, rent paid, insurance renewal, debt cleared, invoice due, plan changed.

### Expectation

A rule or prediction about the future: recurring rent, expected wage, likely subscription, planned contribution.

They can be linked but must never be collapsed into one ambiguous object.

## Truth hierarchy

1. Confirmed posted transaction.
2. User-confirmed event or correction.
3. User-entered recurring rule or scheduled item.
4. Provider/import metadata not yet confirmed.
5. System-inferred pattern.
6. Estimate or hypothetical scenario.

Higher-priority truth does not erase lower-priority history. It supersedes it for current calculations and leaves provenance.

## Example: rent changed

```text
Recurring expectation: £735 on the 10th
Actual posted transaction: £738 with recognised rent reference
```

The actual transaction becomes the spent amount. Folio creates a variance event and Melo asks a bounded question:

> Rent was £3 higher than the amount we expected. Is £738 the new regular amount, a one-off fee, or something else?

The answer updates the future expectation or annotates the one-off event. It never edits the historical transaction to match the old plan.

## Transaction invariants

- Amount is an integer in currency minor units.
- Currency uses ISO 4217 code and stored minor-unit metadata.
- Posted transaction history is append-only from the audit perspective.
- Corrections create a new revision/reversal link.
- Transfers create linked debit/credit records and are neutral in consolidated cash flow.
- Pending transactions are matched to posted transactions and retired, not double-counted.
- Every imported record has source, import job, raw row hash and confidence/provenance.
- Splits sum exactly to the parent transaction.
- Duplicate detection never silently deletes; it groups candidates for deterministic or user-confirmed resolution.

## Event certainty

- `actual` — occurred and evidenced.
- `confirmed` — user/provider-confirmed future item.
- `expected` — accepted recurring expectation.
- `inferred` — detected pattern not yet accepted.
- `hypothetical` — scenario only.

## Event status

- proposed;
- accepted;
- scheduled;
- occurred;
- superseded;
- cancelled;
- dismissed.

## Event generation

Events may originate from:

- a transaction;
- a recurring rule occurrence;
- a plan milestone;
- a user-created calendar item;
- a business invoice/tax deadline;
- a document;
- a scenario;
- a deterministic detector;
- a Melo proposal accepted by the user.

## Corrections and learning

A user correction records both the old interpretation and the accepted interpretation. Local categorisation and recurring-pattern rules learn from confirmed corrections. AI output is never labelled user-confirmed until accepted.

## Reconciliation

For structured statements, Folio attempts:

```text
opening balance + signed transactions = closing balance
```

Pending items, fees, foreign-exchange entries and missing rows are accounted for explicitly. A mismatch marks the import as unreconciled and blocks claims of completeness; it does not block the user from viewing provisional results.
