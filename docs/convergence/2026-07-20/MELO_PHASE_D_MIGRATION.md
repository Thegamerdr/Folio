# Phase D migration

Status: implemented as non-destructive AppState migration plus SQL schema scaffold.

## Forward path

- Store schema moves from v16 to v17.
- Existing users receive `decisionLedger: []`.
- No historical entries are fabricated.
- Existing encrypted local state and backups remain readable.
- Workspace partition creation/reset starts with an empty ledger.
- Normalised SQL schema moves to version 9 and adds ledger tables.

## Rollback path

Pre-Phase-D app versions ignore unknown `decisionLedger` data in restored AppState blobs. If a strict older build rejects schema v17, restore from the pre-Phase-D backup/checkpoint or export user data first and re-import supported financial slices.

## Compatibility rules

- Timeline events are not converted into decisions.
- Transactions are not converted into decisions.
- Melo chat is not converted into decisions.
- Prior consent is not reconstructed.
- Deleted decision content is not left in exportable user-facing state.
- Business ledger records are blocked unless a future migration explicitly enables them.

## Restore behaviour

Restoring a Phase D backup preserves ledger entries. Restoring a pre-Phase-D backup creates an empty ledger. Awaiting-outcome entries remain awaiting after restart because they are stored in the encrypted AppState slice.
