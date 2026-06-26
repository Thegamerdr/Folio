# C3 Storage Foundation

## Phase / task IDs

Phase 3. Primary task range: T048 through T059.

## What was built

- Checksummed ordered migration definitions and migration planning.
- Canonical schema snapshot/validation against `docs/source-package/schemas/database.sql`.
- `DatabaseDriver` abstraction for execute/query/transaction and an in-memory contract driver.
- Workspace-scoped repository guardrails that fail closed when SQL omits `workspace_id`.
- Typed command bus with atomic transaction handling and compact audit-entry creation.
- Compact audit delta helpers.
- Projection invalidation by workspace/data version.
- Workspace-scoped FTS index writer/rebuilder contract.
- Resumable local job checkpoints.
- Portable vault export shape and validation.
- Vault health checks and 10-year scale risk estimate helper.

## Task coverage

| Task                            | Status                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| T048 Migration framework        | Implemented and tested                                                                      |
| T049 Canonical schema           | Implemented and tested against source schema                                                |
| T050 DatabaseDriver abstraction | Implemented and tested with in-memory contract driver                                       |
| T051 Repositories               | Implemented as workspace-scoped storage guardrails                                          |
| T052 Command bus                | Implemented and tested with rollback behavior                                               |
| T053 Compact audit log          | Implemented and tested through command audit entries                                        |
| T054 Projection invalidation    | Implemented and tested                                                                      |
| T055 FTS index writer/rebuilder | Implemented and tested                                                                      |
| T056 Resumable local jobs       | Implemented and tested                                                                      |
| T057 Complete local export      | Implemented as portable vault shape/validation; real encrypted archive awaits native crypto |
| T058 Vault health service       | Implemented and tested with integrity/index/backup status reporting                         |
| T059 10-year scale benchmark    | Implemented as deterministic estimate; physical-device benchmark remains future hardening   |

## Test evidence

Latest targeted run on 2026-06-20:

- `pnpm typecheck`: passed.
- `pnpm test`: passed.
- Phase 3 package tests included in the run: 13 tests.

Package test files:

- `packages/storage/test/migrations-schema.test.ts`
- `packages/storage/test/application-foundation.test.ts`
- `packages/storage/test/command-workspace.test.ts`

## Boundary conclusion

Phase 3 storage foundation is complete as a pure storage/application layer. Native encrypted
storage is selected through ADR 0004 and will be wired behind `DatabaseDriver` only after the
remaining native platform blockers are retired.
