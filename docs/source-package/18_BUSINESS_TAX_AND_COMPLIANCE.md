# Business, Tax and Compliance Architecture

## Product position

Business is a first-class optional workspace, not a filter over personal finances. It is represented in the data architecture from the start, while the full business UI may ship after the personal debt-focused launch.

Folio helps a user organise records, understand business cash flow, estimate and prepare. It is not an accountant or final tax authority.

## Workspace boundary

A business workspace has its own:

- accounts and transactions;
- categories and tax mappings;
- clients/suppliers;
- invoices and receipts;
- calendar/tasks;
- plans/budgets/forecasts;
- documents;
- Melo memory and briefing;
- reports and exports;
- encryption subkey.

There is no combined tax ledger. Transfers between personal and business are linked cross-workspace movements with explicit owner-draw/contribution meaning, not merged transactions.

## Business core

- income and expenses;
- invoice lifecycle;
- receipt capture;
- cash-flow forecast;
- outstanding receivables;
- recurring business commitments;
- tax-period organisation;
- mileage records;
- export for accountant/software;
- deadline calendar.

Inventory, payroll, double-entry general ledger, multi-entity consolidation and direct tax filing are later modules unless a launch segment requires them.

## Tax records

Each tax-relevant record stores:

- jurisdiction;
- tax year/period;
- business entity/workspace;
- category and mapping version;
- source evidence;
- review status;
- user/accountant adjustment;
- export history.

Tax rules are versioned jurisdictional policy packs with effective dates. A rule pack is never silently retroactive.

## UK launch considerations

The architecture should be ready for:

- Self Assessment record organisation;
- VAT record fields where applicable;
- Making Tax Digital digital-record requirements;
- quarterly update periods;
- authorised software/API integration later.

Thresholds and dates are volatile. Folio displays a “verified on” date and links to official guidance. Eligibility is never inferred as final legal status from incomplete data.

Direct HMRC filing requires a dedicated compliance programme:

- HMRC developer registration;
- production credentials;
- fraud-prevention headers;
- conformance/sandbox tests;
- user authorisation;
- immutable submission receipts;
- error/correction flow;
- legal review and support process.

It must not be smuggled into the normal export feature.

## Invoices

Invoice lifecycle:

```text
draft → issued → viewed/unknown → part-paid → paid → overdue → void/credited
```

Invoices generate events, expected cash-flow items, reminders and document artifacts. A payment match is proposed, not silently applied when ambiguous.

## Estimates and tax pots

Folio may show consequence-based estimates:

> Based on records currently marked taxable and the assumptions shown, the estimated amount to reserve is £X.

It must not say:

> Your final tax bill is £X.

The user can configure a reserve percentage or official rule pack. Estimates display exclusions and uncertainty.

## Exports

- human-readable PDF summary;
- CSV/JSON data export;
- accountant package with evidence links;
- tax-period audit trail;
- invoice register;
- optional standard/API formats later.

Every export identifies workspace, period, currency basis, generated time, rule-pack version and unresolved items.

## Acceptance gates

- Personal data cannot enter a business tax export.
- Workspace moves are audited and reversible.
- Every tax figure traces to records and policy assumptions.
- Direct filing is disabled until all compliance gates pass.
- Business mode can be omitted from an early UI build without changing the core schema.
