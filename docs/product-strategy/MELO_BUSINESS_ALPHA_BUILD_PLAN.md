# Melo Business alpha build plan

Status: the Stage A isolation and lifecycle foundation is implemented through schema v11. It now
includes schema-v9 Personal ownership, schema-v10 row ownership/scoped repositories, explicit
secondary persistence/remote-service workspace seams, encrypted per-workspace state files, opaque
per-workspace SQLCipher databases with derived keys, atomic create/switch/rename/archive/restore
operations, and a persistent accessible workspace control. Empty Business Today, More and Melo
surfaces are checked in without sample financial data. This is not yet the complete manual Business
alpha: real Business record intake, evidence, dated cash flow and accountant-ready export still need
end-to-end completion and current device evidence. Last reconciled: 2026-07-15.

## Starting point

`@folio/business-workspace` is a pure TypeScript contract/evaluator package. It models workspace
separation, clients, invoices, receipts, tax periods, exports, mileage and release gates, but it
does not persist data, render the current native app, call native modules or connect a bank. The old
synthetic Phase 13 shell is absent from the current app and is not a product base.

The authoritative implementation base is the current native mobile app under `apps/mobile/src`.
Its Zustand store and screens are personal-first. Business must be added there as a real separated
workspace; it must not be recreated from historical synthetic screens or filled with sample data.

The Stage A slices connect those existing contracts to production. Schema v9 makes the current
top-level mobile data explicitly owned by one immutable Personal workspace with a dedicated subkey
identifier. Schema v10 assigns that owner to every independently addressable AppState row, guards
every live state read/write/persist boundary and exposes an explicit scoped row repository. Schema
v11 turns that logical boundary into a real workspace registry whose active partition is stored in
its own authenticated encrypted file. Each workspace also receives an opaque SQLCipher filename
and a distinct HKDF-derived database key; only Personal may perform the one-time legacy database
migration. Creation provisions empty encrypted file and native database state before committing the
manifest; switch, rename, archive, restore, recovery and account-wide deletion preserve the same
boundary. Backup/recovery, Open Banking, notifications, companion cache/widget, export/restore and
deletion require or cryptographically bind workspace ownership. Cloud backup and Open Banking can
store disjoint opaque workspace scopes, although neither Worker change was deployed in this pass.

## First customer and product boundary

Build for a UK sole trader, freelancer or one-owner service business that:

- has irregular personal and business cash flow;
- wants receipts, income, expected invoices and tax preparation separated from Personal;
- may use a dedicated business account but can begin manually;
- does not need payroll, inventory, multiple legal entities or in-app tax filing.

The alpha supports one optional Business workspace per user. Personal remains the default and
Business creation never appears in mandatory onboarding. `Melo` remains in primary navigation; its
local snapshot and memory are strictly scoped to the active workspace.

## Information architecture

The persistent workspace control displays the word `Personal` or the business trading name. Within
Business, use the existing native shell with business-specific destinations rather than a generic
SME dashboard:

| Surface  | Business job                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------- |
| Today    | Cash position/runway, invoices due, next commitments, receipt/tax items needing attention.                          |
| Review   | Imported or extracted rows, receipt links, category proposals and ambiguous payment matches before truth.           |
| Activity | Business accounts, confirmed transactions, search and source evidence.                                              |
| Invoices | Clients, draft/issued/part-paid/paid/overdue lifecycle and expected-cash events.                                    |
| Receipts | On-device capture/import, extraction review, original evidence and unresolved links.                                |
| Tax prep | Period organisation, user-controlled reserve estimate, assumptions and unresolved queue; no filing claim.           |
| Calendar | Invoice due dates, tax deadlines, client tasks, subscriptions and follow-ups.                                       |
| Exports  | Accountant-ready CSV/JSON/PDF package labelled by workspace, period, policy version, evidence and unresolved items. |
| Melo     | Local business summary and what-if questions with no Personal snapshot, memory or content.                          |

Do not crowd every destination into the bottom bar. Keep the current primary structure, make Melo
stable, and place lower-frequency Business tools behind a clear Business hub/More hierarchy.

## Data foundation before screens

Implement these boundaries before rendering a populated Business dashboard:

1. A durable `Workspace` entity with one immutable Personal workspace, zero/one Business workspace,
   active workspace ID, text label, create/rename/archive state and schema migration.
2. A non-null `workspaceId` on every account, transaction, review candidate, document, source,
   search row, plan/calendar item, notification, export record and Melo memory/snapshot row.
3. Workspace-scoped repository functions. Screens must not fetch a global array and filter it after
   render; the query boundary itself receives the active workspace.
4. A distinct encryption subkey identifier and derived subkey for Business records/documents. Never
   reuse Personal companion memory or plaintext indexes across workspaces.
5. A Personal-to-Business transfer represented as two linked records with explicit source and
   destination workspace IDs. Deleting or editing one side must surface the relationship.
6. Migration that assigns existing personal data only to the immutable Personal workspace. It must
   never infer Business ownership from merchant names, categories or sample fixtures.
7. Export, backup, deletion and recovery routines that preserve the workspace boundary and can
   operate on one workspace without silently touching the other.

## Alpha implementation sequence

### A. Foundation and isolation

- Implemented first slice (2026-07-15): durable Personal workspace registry, active/data-partition
  IDs, stable Personal subkey identifier, v8-to-v9 migration, switcher-contract adapter and
  fail-closed Melo/export reader guards. See
  `../release-evidence/BUSINESS_WORKSPACE_FOUNDATION_2026-07-15.md`.
- Implemented second slice (2026-07-15): schema-v10 ownership on every independently addressable
  production AppState row and staged reader candidate, migration/write stamping, complete-row
  assertions, an explicit workspace-scoped row repository and write refusal after a crafted switch.
  No mismatched collection is filtered after read.
- Implemented secondary seam pass (2026-07-15): explicit workspace parameters and fail-closed
  ownership checks for native/file persistence, export/restore/deletion, notification schedules and
  runtime state, companion read cache/widget projection and cloud recovery; opaque workspace paths
  and cross-workspace attack tests for cloud backup and Open Banking; confirmed existing scoped
  search/storage and transient-only native document extraction.
- Implemented physical isolation/lifecycle pass (2026-07-15): schema-v11 encrypted workspace
  manifest, authenticated per-workspace state files, opaque per-workspace SQLCipher filenames,
  HKDF-derived SQLCipher keys, Personal-only legacy migration, atomic create/switch/rename/archive/
  restore, account-wide clear/recovery and interrupted-write reconciliation.
- Implemented first native surface pass (2026-07-15): a persistent labelled workspace control in
  `apps/mobile/src/folio/shell/FolioShell.tsx`, an accessible management sheet, and genuine empty
  Business Today/More/Melo surfaces. Melo remains in the four-item primary bar and changes context
  with the active workspace.
- Continue connecting the `@folio/business-workspace` record contracts to production state instead
  of synthetic objects; the workspace and isolation contracts are connected, but client/invoice/
  receipt/tax-period record workflows are not yet a completed native alpha.
- Implemented current Android proof (2026-07-15): dual-ABI release artifact, in-place emulator and
  Galaxy S9 updates, create/switch/rename/archive/restore/relaunch, empty Business Today/Melo/More,
  Personal preservation and a physical-runtime selector fix. Screen-reader, large-text and iOS
  coverage for the new surfaces remain release gates.
- Keep every new search, review, calendar, notification, backup/export, deletion and Melo path on
  the now-explicit workspace contract; do not reintroduce an account-global convenience path.
- Ship attack tests for IDs, storage, search, sync, local companion, export and calendar before any
  Business screen is treated as real.

### B. Useful manual alpha

- Create, rename and archive one Business workspace.
- Add manual business accounts and present balance without touching Personal accounts.
- Reuse on-device PDF/image extraction, but require Business Review confirmation and retain the
  source link.
- Confirm business income/expense, category, account and receipt state through Review.
- Show dated cash position/runway and recurring commitments on Business Today.
- Add receipts, unresolved evidence and accountant-ready CSV/JSON export. Add PDF only after the
  generated document is visually and semantically verified.
- Add business-scoped local Melo summaries/what-if answers from aggregate minor-unit values only.
- Add manual mileage only if it fits the alpha schedule; no background location collection.

This stage is the first credible internal alpha. It works without Open Banking and contains no
runtime sample company, sample clients, sample invoices or sample transactions.

### C. Business beta

- Clients and invoice lifecycle, including expected cash and overdue events.
- Proposed transaction-to-invoice matching; ambiguous matches always require Review.
- Tax-period organisation and a user-controlled reserve estimate with dated assumptions and an
  unresolved queue.
- Business calendar and local notifications verified on physical Android and iOS devices.
- Accountant-ready evidence package, encrypted backup/recovery, Business entitlement, support
  operations and full accessibility review.
- UK tax/legal and recordkeeping review before public claims.

### D. Live business banking

Do not connect business accounts during the first Business alpha. Add them only after the Personal
TrueLayer pilot passes and TrueLayer confirms the required business-account/provider coverage in
writing. Account selection must explicitly choose the Business workspace before any row reaches
Review. A connected personal account must never be remapped implicitly into Business.

## Commercial test

Test GBP 9.99/month as willingness-to-pay for the Business service; it is not a final store price.
Set the actual price only after TrueLayer quotes, store fees, encrypted-service cost, support load,
tax/legal cost and expected churn are in a unit-economics sheet. Subscription lapse stops recurring
services; it does not delete or ransom local records or basic exports.

## Explicitly deferred

- direct HMRC/MTD filing;
- payroll and employee expenses;
- inventory and cost-of-goods workflows;
- full double-entry bookkeeping or statutory accounts;
- accountant collaboration/permissions;
- multiple Business workspaces or legal entities;
- payment initiation and automatic invoice chasing;
- automatic/background mileage tracking.

Each needs its own product, security, support and compliance programme; none should appear as a
disabled promise in the alpha.

## No-sample-data rule

- New Business workspaces start genuinely empty and teach through empty-state actions.
- Runtime source must not seed fake balances, transactions, clients, invoices, receipts or tax
  figures.
- Synthetic fixtures are allowed only in automated tests or clearly labelled release-evidence
  files. They must never migrate into a user's persisted store, screenshots presented as real
  accounts or a physical device after evidence capture.
- Screenshot/e2e setup creates isolated temporary state and removes it during teardown.

## Definition of done

Business alpha is done only when all of these are true on current Android and iOS builds:

- a user can create, rename, switch to and archive one Business workspace without onboarding
  pressure on Personal users;
- existing Personal data migrates without loss and no Personal row appears in any Business surface,
  search result, export, notification, backup or Melo response;
- a user can add/import, review and confirm real Business records, attach receipt evidence, see
  dated cash flow and export the workspace without sample data;
- app relaunch, backup/restore, failed migration, locked device, deletion and subscription lapse
  preserve the specified isolation and ownership rules;
- the isolation attack suite covers IDs, persistence, search, sync, companion, export and calendar
  and reports zero leakage;
- keyboard/screen-reader, large text, reduced motion, small phone and tablet checks pass;
- tax/legal language, support runbook, entitlement and store declarations have owners and evidence;
- no screen or document claims direct tax filing, accountant assurance or a final tax bill.

## Attack and recovery tests

At minimum, attempt wrong-workspace IDs, stale active-workspace state, deep links opened after a
workspace switch, cross-workspace search terms, duplicate imports, transfer deletion, archive with
open invoices, backup restore over newer data, corrupted workspace migration, notification taps,
Melo questions after rapid switching, export during switching and account deletion. A UI filter that
hides leaked data does not pass; the underlying query, export and snapshot must exclude it.
