# Runtime Dependency Proof

## Scope

This proof covers Phase 0 Agent A, T009/T010:

- V1 was frozen outside the V2 repository.
- V1 donor material was inventoried without copying V1 runtime source into V2 runtime workspaces.
- V2 runtime-owned paths were searched for V1 path/name references.
- Practical V1 donor checks and V2 baseline checks were run where possible.

## Snapshot proof commands

| Command                                                                                                                                                      | Result                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `git rev-parse --show-toplevel; git rev-parse HEAD; git status --short` in `C:\dev\apps\close-ledger-frontend`                                               | Failed: source path is not a Git repository. Recorded in `FREEZE.md`. |
| `robocopy C:\dev\apps\close-ledger-frontend C:\dev\folio-v1-freezes\folio-v1-close-ledger-frontend-0.5.2-2026-06-19 /E ...`                                  | Completed.                                                            |
| Remove `release\win-unpacked`, `release\Folio-0.5.2-ready-pack`, and log-style files from the owned snapshot path                                            | Completed after path-prefix verification.                             |
| Generate `docs/v1-donor-audit/freeze-manifest.csv` with SHA-256 for every snapshot file                                                                      | Completed: 961 manifest rows.                                         |
| Set all snapshot files read-only                                                                                                                             | Completed: 961 read-only files, 0 writable files.                     |
| Exclusion check for `node_modules`, `dist`, `logs`, `release\win-unpacked`, `release\Folio-0.5.2-ready-pack`, `*.log`, `*.err.log`, `*.out.log`, and `*.err` | Passed: 0 excluded directory hits, 0 log file hits.                   |

## V1 donor checks

These commands were run from the read-only snapshot path:

| Command                     | Result                                                                                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:finance`      | Passed. Covered business summary, micro-entity checks, personal transfers, website booking reconciliation, fixture totals, category learning, row filters, PDF text rows, indexes/calendar hints, money/date parsing. |
| `npm run test:calendar`     | Passed. Covered schema marker, generated calendar items, recurrence/project/document/contact/reminder projections, saved metadata, ICS metadata, and Google metadata round trip.                                      |
| `npm run test:planner`      | Passed. Covered planner schema version, admin planner symbols, calendar planner ID/entity preservation, and hybrid planner source contract.                                                                           |
| `npm run test:proof-ledger` | Passed. Covered proof-ledger fields, visible Proof tab/workspace, planner migration, evidence item metadata, project story metadata, and legacy migration coverage.                                                   |
| `npm run test:transfer`     | Passed. Covered saved copy parser variants and invalid-copy failure.                                                                                                                                                  |
| `npm run test:product`      | Passed. Covered corrupt local data quarantine, transfer validation, large ledger summary timings, filter predictability, Android low-paint/data-safety markers, icon-button and input accessibility contracts.        |

Full `npm run test:release` was not run because it rebuilds/repackages release material and includes checks outside the supplied V1 read path, including an Android WebView project reference. The targeted source-contract tests above were practical and non-mutating.

## V2 boundary checks

Commands were run from `C:\dev\folio-v2-greenfield` unless noted.

| Command                   | Result                                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint:boundaries`    | Passed: dependency boundaries passed.                                                                                                                           |
| `pnpm check:v1-boundary`  | Passed: 57 authored V2 runtime/package files checked against 859 unique V1 freeze hashes; no V1 markers or hash intersections found.                            |
| `pnpm check:samples`      | Passed: synthetic-data policy passed.                                                                                                                           |
| `pnpm check:constitution` | Passed: product constitution gate passed.                                                                                                                       |
| `pnpm typecheck`          | Passed.                                                                                                                                                         |
| `pnpm test`               | Passed: 2 test files and 8 tests.                                                                                                                               |
| `pnpm validate:contracts` | Passed: 75 files, 15,681 lines, 192 tasks, 32 risks, 18 forecast vectors, 15 import vectors, no errors or warnings; fixture validation passed 14 checked cases. |
| `pnpm run ci`             | Passed after integrating the pnpm build-approval policy and formatting updates.                                                                                 |

## Boundary conclusion

No V1 runtime source, schema, route, state-management implementation, release binary, or dependency graph was copied into V2 runtime workspaces by this task.

The only V1-derived material created inside the V2 repository is documentation and audit evidence under `docs/v1-donor-audit/`, including the hashed manifest of the external snapshot.

## Blockers and residual risk

- The supplied V1 source path has no Git metadata, so this freeze cannot record a V1 commit hash.
- Donor classifications are audit decisions only. They do not approve copying into runtime modules; future reuse still needs target V2 contracts and approval.
