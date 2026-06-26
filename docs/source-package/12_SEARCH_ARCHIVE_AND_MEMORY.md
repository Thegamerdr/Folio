# Search, Archive and Memory

## Product role

Folio becomes more valuable as it remembers what happened, what changed, how the user responded and how far they have come. The archive is not a passive dump; it is a private, searchable financial memory.

## Universal search

Search spans the active workspace only by default:

- transactions;
- events;
- accounts and counterparties;
- plans and milestones;
- calendar items and tasks;
- documents and extracted text;
- invoices and business records;
- Melo summaries and accepted memories.

Personal and business results never appear together unless the user deliberately chooses “All spaces,” which must carry a visible mixed-context warning and must never be available inside tax exports.

## Search forms

### Direct search

- merchant/reference;
- date/range;
- amount/range;
- category;
- account;
- event type;
- plan;
- document text;
- business tax period.

### Natural-language search

Examples:

- “When did I clear Klarna?”
- “Show every insurance payment last year.”
- “Find the March invoice from Acme.”
- “What changed after my overtime stopped?”

Natural language is translated into a typed query. The query is shown and editable. A model is optional; deterministic parsing covers common patterns.

## Local index

Use SQLite FTS5 for text and normal indices for structured filters. Index only decrypted local content while the vault is open. Do not upload the search index.

The FTS index is rebuildable from authoritative domain tables and document extractions. It is not itself a source of truth.

## Archive lifecycle

Records move through:

```text
active → completed/settled → archived → optionally purged
```

Archiving changes visibility, not truth. It must not alter historical forecasts or reports.

Retention controls:

- keep indefinitely;
- keep by record type;
- auto-archive completed plans;
- purge extracted OCR while retaining the original;
- delete original document after extraction;
- destroy selected memories while preserving financial records;
- full workspace export and deletion.

Business retention guidance is jurisdiction-specific and must be displayed as guidance with a verification date, not silently enforced.

## Melo memory model

Melo memory is not an unbounded chat transcript. It contains compact, typed, inspectable facts:

- preference;
- recurring pattern;
- user correction;
- accountability style;
- important event summary;
- plan commitment;
- user-approved personal context.

Each memory has:

- scope: personal/business/global preference;
- provenance;
- reason it is useful;
- sensitivity;
- expiry/review date;
- user visibility;
- delete control.

Memory levels:

- **Minimal:** current task and essential interface preferences.
- **Normal:** recurring patterns, corrections, plans and selected events.
- **Deep:** richer user-approved history and reflection.

No memory level permits hidden profiling for advertising, credit scoring or model training.

## Corrections and learning

A correction creates a durable rule or counterexample only when the user accepts it.

Example:

```text
Melo inferred “salary”
user says “refund”
→ transaction corrected
→ correction record stored
→ equivalent future inference down-weighted
```

The system retains both the original inference and correction for auditability.

## Long-term reflection

Folio may generate local, reviewable retrospective views:

- first month versus current month;
- debts cleared;
- difficult periods recovered from;
- income or obligation changes;
- plan changes and milestones;
- decisions explored and actual outcomes.

The narrative must be grounded in records and never invent causality.

## Archive scale targets

Design and test for:

- 10 years of daily use;
- 250,000 transactions/events combined;
- 20,000 documents or extracted items;
- sub-300 ms common structured search on a representative device;
- progressive/streamed rendering for large result sets;
- resumable index rebuild.

## Acceptance gates

- Search respects workspace boundaries.
- Every natural-language result displays its applied filters.
- Deleting Melo memory does not delete financial truth unless explicitly selected.
- Export includes provenance and human-readable formats.
- Search works fully offline.
