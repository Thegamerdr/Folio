# Import and Indexing Pipeline

## Purpose

The fastest path to real value is to turn records the user already has into a trustworthy local financial model. Import is therefore a core product experience, not a settings utility.

The pipeline must be:

- local-first;
- resumable;
- explainable;
- idempotent;
- reviewable;
- tolerant of messy bank exports;
- incapable of silently changing the user's facts.

## Supported acquisition paths

### Launch paths

1. **Manual quick start** — current available balance, next income date, next important outgoing.
2. **CSV import** — bank, card, loan, savings and payment-service exports.
3. **OFX/QFX import** — use the official OFX structure when supplied.
4. **QIF import** — legacy best-effort adapter with explicit limitations.
5. **PDF/image statement import** — on-device text/table extraction followed by review.
6. **Receipt/document capture** — attach and extract candidate data.

### Optional cloud path

7. **Open Banking adapter** — explicit consent, selected accounts and provider-scoped permissions.

No path is required for the others to work.

## Import state machine

```text
selected
→ copied into encrypted app storage
→ fingerprinted
→ format detected
→ parsed
→ normalised
→ candidate records produced
→ reconciled
→ exceptions/questions produced
→ user review
→ atomic commit
→ index/event/forecast rebuild
→ source retained or deleted according to user choice
```

Every stage is restartable. An interrupted import must never leave half-committed domain records.

## Provenance is mandatory

Every imported fact stores:

- import job ID;
- source document/file ID;
- source row/page reference;
- parser and parser version;
- original text/amount/date;
- normalised value;
- confidence;
- review status;
- timestamp;
- any later correction.

The original source is never overwritten by a cleaned representation.

## Money and date normalisation

- Store monetary amounts as signed integer minor units.
- Preserve source currency.
- Never infer exchange rates silently.
- Preserve source timezone/date text and the normalised instant/local date separately.
- Detect debit/credit conventions per source.
- Never use binary floating point for money.
- Locale detection is proposed, then confirmed if ambiguous.

## Deduplication and pending-to-posted matching

Use a layered identity strategy:

1. provider transaction ID when stable;
2. source file + source row hash;
3. account + amount + date + normalised description + running balance;
4. pending-to-posted matcher using amount/date/merchant tolerance;
5. user-confirmed merge.

A possible duplicate remains visible until resolved. Do not drop rows merely because they look similar.

## Reconciliation

Where a source provides balances:

```text
opening balance
+ signed imported movements
= expected closing balance
```

The import reports exact match, explained mismatch, or unresolved mismatch. A mismatch never blocks a user from reviewing the data, but it prevents the import from being labelled fully reconciled.

Transfers are linked as two movements and excluded from income/spending totals after confirmation. They remain transactions because cash location matters.

## Classification

Classification order:

1. user-created rule;
2. known counterparty mapping;
3. deterministic bundled rule;
4. optional on-device classifier;
5. optional cloud model;
6. unresolved.

The system may propose category, counterparty, recurring status, workspace and event meaning. It never commits uncertain business/personal classification without review when tax reporting could be affected.

## Questions with an end goal

Import questions are grouped and prioritised. Melo should ask only questions that materially improve the current result.

Examples:

- “These two rows look like the same card payment. Keep both or merge them?”
- “This payment uses your usual rent reference but is £18 higher. One-off charge, new regular amount or something else?”
- “This appears to be a transfer between your accounts. Link them?”

Default conversational cap: three questions in one sequence. Remaining issues move to a Review queue that can be completed later.

## Privacy behavior

Before the picker opens, state plainly:

> Folio will process the files you select on this device. Nothing is uploaded unless you later choose a cloud feature that says so.

The user chooses whether the original file is retained, retained until verified, or deleted after extraction. Business documents default to retained because evidence may be needed later.

## Performance targets

On a representative mid-range supported phone:

- first import feedback within 2 seconds;
- stream progress for large files;
- 10,000 CSV rows parsed without blocking the UI thread;
- cancellation leaves no committed partial import;
- repeated import of the same file is idempotent;
- search and Today briefing usable while background indexing continues.

## Acceptance gates

- A supplied import test corpus produces deterministic normalised rows.
- Duplicate and transfer tests do not inflate totals.
- Every imported record can trace back to source.
- User correction changes future suggestions without rewriting source history.
- A failed parser cannot expose file content in logs.
