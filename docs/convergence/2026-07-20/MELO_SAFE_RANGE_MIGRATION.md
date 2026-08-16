# Melo Safe Range migration

## Migration shape

Phase C is a runtime adapter migration, not a persisted data rewrite.

Existing local state remains readable:

- current AppState snapshots;
- old schema snapshots;
- encrypted backups;
- existing statement imports;
- existing evidence metadata;
- existing review queues;
- existing pots, subs, debts and calendar events.

## Forward path

| Source | Phase C treatment |
|---|---|
| Legacy `currentBalance` | Wrapped as `currentPosition` and source breakdown |
| Legacy accounts | Read through bank-only selector |
| Legacy route engine | Compatibility path and graph source |
| Calendar events | Forecast expectations |
| Debts | Added as debt-minimum forecast expectations |
| Review queue | Missing/uncertainty source, never posted facts |
| Old schema `<16` | Caution issue: old truth metadata missing |
| Restored encrypted backup | Caution issue: restored snapshot |

## Rollback path

Rollback is non-destructive:

1. Today can stop rendering `TrustedSafeRangeCard`.
2. Hero can read `routeFromStore` only.
3. Legacy Safe Zone sheet remains available.
4. AppState snapshots remain unchanged.
5. No persisted Safe Range rows need removal because Phase C does not write them.

## Compatibility rule

The adapter may read legacy data but may not mutate it.

## Phase D handoff

Phase D may write Decision Ledger records using this result, but Phase C does not create those records.
