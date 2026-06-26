# Personal and Business Workspaces

## Core rule

> Same underlying engines, different user-facing worlds.

A user must never wonder whether a transaction, plan, calendar item, report, document or Melo statement belongs to personal life or a business.

## Personal workspace

Personal includes:

- paydays and personal income;
- rent/mortgage and bills;
- personal debt;
- budgets, savings and reserves;
- life events and plans;
- personal calendar and tasks;
- personal documents;
- personal Melo memory and briefings.

## Business workspace

Each business workspace has a legal/trading identity and separate:

- accounts;
- transaction categories;
- clients and invoices;
- receipts and documents;
- cash-flow forecast;
- plans and budgets;
- calendar/tasks;
- tax periods, categories, estimates and exports;
- Melo context;
- encryption subkey and future membership policy.

A business workspace is optional. It must not appear as an onboarding interrogation for users who only need personal Folio.

## Structural separation

Every domain record carries a non-null `workspace_id`. Repositories require workspace scope. Cross-workspace queries are prohibited except approved transfer, account overview or export orchestration services.

An account belongs to one workspace. A movement between personal and business is represented as two linked records, preserving each workspace's classification and audit trail.

## Visual separation

Workspace switching changes:

- explicit title and icon;
- navigation labels;
- Today briefing context;
- calendar source;
- category set;
- reports and search scope;
- Melo memory scope.

Do not rely on color alone. A persistent text label such as `Personal` or the business name appears on every top-level screen and review sheet.

## Tax integrity

Business tax exports include only business-scoped records that meet the selected period and classification criteria. Personal data cannot leak into the export through shared category IDs, global search, document links or transfers.

All tax outputs show:

- source records;
- inclusion/exclusion rules;
- unresolved items;
- jurisdiction and policy-pack version;
- generated timestamp;
- clear statement that the output is preparation information, not a guaranteed final tax position.

## Future shared access

The schema anticipates workspace members and roles, but collaboration is not enabled until encrypted key sharing, audit, permission and conflict behavior are independently tested. Household/shared personal finance is a separate product module, not automatic reuse of business collaboration.
