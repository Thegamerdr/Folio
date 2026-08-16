# Melo data migration plan

Status: Phase B migration contract. No user-visible migration is executed in Phase B.

## Authority decision

Existing encrypted AppState generations remain the compatibility authority until a domain slice has:

1. canonical domain type,
2. storage projection,
3. migration/read adapter,
4. rollback path,
5. export/restore proof,
6. tests covering Personal/Business isolation.

Normalised SQL becomes canonical slice by slice. It does not replace the full AppState snapshot in one step.

## Required migrations

| Migration | Phase | Source | Target | User-visible behaviour in Phase B | Forward path | Rollback path |
| --- | --- | --- | --- | --- | --- | --- |
| Truth/provenance | Phase C | AppState facts, review candidates, import/evidence metadata | `TrustedCoreFactRef`, `TrustedCoreProvenanceSnapshot`, storage fact/provenance tables | None | Build adapter that classifies existing facts without changing screens | Ignore derived truth records; keep AppState reads |
| Safe Range result | Phase C | Legacy Safe Zone, finance forecast, calendar commitments | `TrustedSafeRangeResult` | None | Adapter returns new result from old engine inputs plus truth refs | Route Today back to legacy Safe Zone adapter |
| Decision Ledger | Phase D | Review decisions, Melo confirmations, corrections, plans/scenarios | `DecisionLedgerRecord` | None | New append-only bounded ledger table/store slice | Disable ledger writer; existing actions still work |
| Corrections | Phase D | Store edit/correction logs, review edits | Correction fact refs linked to prior fact and affected answers | None | Add correction provenance and recompute affected outputs | Keep existing edit history |
| Evidence files | Phase D/F | `evidenceDocuments`, statement imports, native files | Source/evidence repository refs | None | Migrate metadata first, raw files later | Retain existing evidenceDocument rows and local files |
| Persistence authority | Phase F | Full AppState generations and local storage | SQLCipher repositories plus snapshot rollback | None | Domain-by-domain dual-write then dual-read | AppState generation remains restore source |

## Compatibility rules

- Existing local state must load unchanged.
- Encrypted backups restore legacy AppState first.
- New projections are rebuildable from the AppState snapshot until the slice exit criteria is met.
- A projection mismatch never silently overwrites user data.
- Business and Personal data are migrated per workspace; no cross-workspace repair.
- Evidence files keep their existing refs until source records are proven.
- Export includes both legacy and new records during compatibility windows.
- Restore accepts old backups that lack Truth Model, Safe Range result, or Decision Ledger records.

## Schema scaffolding in code

`packages/domain/src/trustedCore.ts` declares:

- `trustedCoreMigrationPlan`
- `TrustedCoreFactRef`
- `TrustedCoreProvenanceSnapshot`
- `TrustedSafeRangeResult`
- `DecisionLedgerRecord`

These are interfaces and migration descriptions only. They do not execute a database migration.

## Data risk register

| Risk | Control |
| --- | --- |
| AppState and SQL disagree | AppState wins during compatibility; mismatch is review evidence. |
| Old backup lacks new records | Rebuild derived records or mark missing; do not block restore. |
| Truth class wrong on migrated fact | Show source/correction path; do not silently upgrade. |
| Decision Ledger stores too much personal detail | Store decision context only; no unnecessary emotional detail. |
| Business state leaks into Personal | Workspace ID required on every migrated record; boundary tests remain mandatory. |
| Evidence file missing after restore | Mark source missing/stale; lower reliance. |

