# Data Model and API Contracts

## Modelling rules

- IDs are globally unique, opaque and generated locally.
- All workspace-bound rows include `workspace_id`.
- Money is signed integer minor units plus ISO currency.
- Dates distinguish instant, local date, timezone and source text.
- Records carry creation/update versions and provenance.
- Soft deletion uses tombstones where sync requires it.
- Facts, expectations and hypothetical scenario changes are separate entities.
- Derived rows name their input version/hash.

## Principal aggregates

### Workspace

Personal or business context, encryption subkey, preferences and policy jurisdiction.

### Account and balance

Where money/debt is held. A balance observation has date, source and reconciliation state; it is not overwritten by a transaction total.

### Transaction

An actual or pending movement. Stores source, status, signed amount, counterparty/reference, account and splits. A transfer links transactions.

### Recurring expectation / obligation / income stream

A rule that predicts future events. An actual transaction may fulfil, differ from or miss an expectation.

### Event

Human meaning over facts or expected occurrences: payday, bill due/paid, debt cleared, unexpected cost, plan milestone, invoice paid and so on.

### Plan

Optional user-defined intended outcome with target, rules, priority, schedule, milestones and versions.

### Budget

A user-selected allocation or spending boundary over a period. Budgets do not masquerade as bank balances.

### Scenario and forecast

A scenario contains hypothetical changes. A forecast snapshot is a deterministic projection from a named data version and assumption set.

### Calendar item/task/reminder

Time-aware user or system item, optionally linked to a financial event or plan.

### Document

Encrypted file metadata, provenance, extraction candidates and links.

### Melo proposal/memory

Reviewable suggested command and compact approved contextual memory. Chat is not a financial record.

### Business entities

Client, invoice, tax period/category, mileage and business profile, always business-workspace scoped.

## Command examples

```ts
recordTransaction(input)
confirmImportRows(input)
linkTransfer(input)
updateRecurringExpectation(input)
createEvent(input)
createPlan(input)
rebasePlan(input)
runScenario(input)
acceptMeloProposal(input)
moveRecordBetweenWorkspaces(input)
archiveRecord(input)
```

Every command returns:

```ts
{
  result,
  changedEntityIds,
  invalidatedProjectionKinds,
  auditEntryId,
  outboxSequence
}
```

## Query examples

```ts
getTodayBriefing(workspaceId, at)
getPositionBeforeDate(workspaceId, date, scenarioId?)
getTimeline(range, filters)
searchWorkspace(query)
getPlanProgress(planId, at)
getCalendarRange(workspaceId, range)
getImportReview(importJobId)
getBusinessTaxPeriod(workspaceId, periodId)
```

Queries never silently cross workspace boundaries.

## API principle

Most app/domain APIs are local in-process contracts. Network APIs are narrow adapters for optional services.

### Cloud vault API

- register/revoke device;
- upload/download encrypted envelope;
- upload/download encrypted snapshot;
- list sequence metadata;
- manage recovery metadata;
- delete account/cloud data.

The service cannot query financial domain fields.

### AI gateway API

- submit typed task with redacted structured context;
- return typed draft/proposal;
- report usage/quota;
- never receive a database credential.

### Open Banking adapter API

- start consent;
- receive callback;
- list consent/account state;
- fetch canonical provider rows;
- revoke/refresh consent.

## Schema migration

- Ordered SQL migrations with checksums.
- Pre-migration encrypted snapshot.
- Transactional migration where SQLite permits.
- Post-migration integrity and semantic checks.
- No destructive migration without verified reversible export.
- Migration fixtures from every released schema version.

## Audit log

Audit records include:

- command type;
- actor: user/Melo/import/sync/system;
- workspace;
- affected IDs;
- before/after field hashes or structured delta;
- source/proposal;
- timestamp/device;
- rollback/reversal link.

Do not duplicate full sensitive rows in logs.

## Data minimisation

Do not add a field “because it may be useful later.” Every sensitive field must state:

- purpose;
- visibility;
- retention;
- sync behavior;
- deletion behavior;
- whether AI may receive it.

## Acceptance gates

- The SQL schema compiles and constraints reject cross-workspace errors.
- JSON/OpenAPI contracts validate example payloads.
- All financial totals use minor-unit arithmetic.
- Every projection can name its facts and assumptions.
- Schema migration tests cover crash and rollback.
