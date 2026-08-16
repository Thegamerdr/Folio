# What Changed contract

## Canonical type

Owner: `@folio/domain`.

Type: `MaterialFinancialChange`.

Minimum fields:

- `id`
- `workspaceId`
- `occurredAt`
- `detectedAt`
- `type`
- `sourceIds`
- `truth`
- optional `before` and `after` Safe Range snapshots
- optional monetary/range effects
- `causes`
- `affectedDecisionIds`
- `reviewRequired`
- `userActionRequired`
- `explanationCode`

## Phase E behaviour

- Material changes are persisted in `AppState.materialChanges`.
- `WhatChangedRow` now prefers material-change causality over generic timeline/import wording.
- Timeline rows and statement imports remain fallback compatibility.
- No unlimited generic activity feed was added.
- No duplicate AppState snapshots are persisted.

## Non-material rule

`deriveMaterialFinancialChange` returns `null` when a change has no material movement, no review requirement and no affected receipt.

## Deferred

- Automatic material-change recording from every writer.
- Multi-change explanation grouping UI.
