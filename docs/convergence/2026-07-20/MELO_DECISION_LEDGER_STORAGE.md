# Decision Ledger storage

Status: Phase D storage scaffold plus encrypted AppState compatibility slice.

## Authority

AppState remains compatibility and rollback authority during Phase D. Normalised SQL is the declared persistence direction, not the runtime source of truth yet.

## AppState slice

`apps/mobile/src/folio/store.ts` adds:

```ts
decisionLedger?: DecisionLedgerEntry[];
```

Migration `v17` adds an empty ledger for existing users. It does not reconstruct history from timeline events, transactions, reviews, chats, cycle records, or imports.

## SQL tables scaffolded

`packages/storage/src/canonical-sqlite-schema.ts` schema version `9` declares:

- `decision_ledger_entries`
- `decision_ledger_scenarios`
- `decision_ledger_outcomes`
- `decision_ledger_corrections`
- `decision_ledger_audit_events`
- `forecast_evaluations`

Each table carries `workspace_id`; entry tables also carry `workspace_kind`. Business writes are blocked in the Phase D service unless explicitly enabled by a future migration flag.

## Retention

Unresolved material decisions are not silently capped or evicted. User deletion removes the user-facing entry and optional learning from exportable state. Security/audit retention, if later required, must be separated, minimised and documented before implementation.

## Backup and restore

Backups that lack `decisionLedger` restore through the v17 migration with an empty ledger. Backups that include `decisionLedger` preserve entries as-is. Rollback to pre-Phase-D state is documented in `MELO_PHASE_D_MIGRATION.md`.

## Export shape

The JSON export includes full `decisionLedger` entries. `decision-ledger.csv` is intentionally a readable summary, not the complete fidelity format.
