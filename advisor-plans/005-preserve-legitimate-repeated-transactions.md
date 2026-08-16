# Plan 005: Preserve legitimate repeated transactions with stable row identity

> **Executor instructions**: Execute after plan 004 because both touch statement intake. Keep review
> before truth: ambiguous duplicates may be shown for confirmation but may not be silently discarded
> or silently posted. Update `advisor-plans/README.md` when done unless a reviewer owns it.
>
> **Drift check (run first)**:
> `git diff --stat f7b91c7..HEAD -- apps/mobile/src/folio/lib/importSheet.ts apps/mobile/src/local/statementReaderParse.ts apps/mobile/src/local/statementReaderDedup.ts apps/mobile/src/local/statementReaderDedup.test.ts apps/mobile/src/folio/store.ts apps/mobile/src/folio/store.test.ts apps/mobile/src/folio/lib/canonicalAppStateReadProjection.ts apps/mobile/src/folio/lib/canonicalAppStateReadProjection.test.ts`
> Reconcile plan 004's intake changes. Stop if candidate IDs are no longer deterministic row IDs.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `advisor-plans/004-remove-plaintext-picker-cache.md`
- **Category**: correctness, data integrity
- **Planned at**: commit `f7b91c7`, 2026-08-16

## Why this matters

Two real transactions can share a date, amount and merchant—two identical train fares or card
payments are ordinary. The current natural-key dedup treats them as the same row and can discard one;
if both reach the store, both receive the same transaction ID. The existing parsers already create
deterministic IDs containing row position, so the smallest safe fix is to make stable candidate row
identity authoritative for idempotency and keep natural-key similarity non-destructive.

## Current state

- `apps/mobile/src/folio/lib/importSheet.ts:52-69` includes required `CandidateMoneyItem.id`.
- `apps/mobile/src/folio/lib/importSheet.ts:388-400` generates deterministic sheet IDs from row index,
  merchant and amount.
- `apps/mobile/src/local/statementReaderParse.ts:222-235` generates deterministic reader IDs from
  source, parsed-row index, merchant and amount.
- `apps/mobile/src/local/statementReaderDedup.ts:18-31` defines date/amount/merchant as the dedup key
  and explicitly acknowledges legitimate collisions.
- `apps/mobile/src/local/statementReaderDedup.ts:43-56` drops every later matching natural key,
  including a distinct row.
- `apps/mobile/src/folio/store.ts:5783-5790` derives imported transaction IDs only from that natural
  key.
- `apps/mobile/src/folio/store.ts:5891-5913` filters against existing IDs once, then maps all incoming
  rows; distinct same-key rows can collide inside the same batch.
- `apps/mobile/src/folio/store.test.ts:4311-4365` is the re-import idempotency pattern.
- Canonical read projection requires stable unique transaction source IDs; preserve that invariant.

## Commands you will need

| Purpose     | Command                                                                                                                                                                                                                                                                                                                                                                                                                | Expected on success |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Dedup tests | `pnpm exec vitest run apps/mobile/src/local/statementReaderDedup.test.ts apps/mobile/src/folio/store.test.ts apps/mobile/src/folio/lib/canonicalAppStateReadProjection.test.ts --passWithNoTests`                                                                                                                                                                                                                      | exit 0              |
| Typecheck   | `pnpm typecheck`                                                                                                                                                                                                                                                                                                                                                                                                       | exit 0              |
| Full tests  | `pnpm test`                                                                                                                                                                                                                                                                                                                                                                                                            | exit 0              |
| Formatting  | `pnpm exec prettier --check apps/mobile/src/folio/lib/importSheet.ts apps/mobile/src/local/statementReaderParse.ts apps/mobile/src/local/statementReaderDedup.ts apps/mobile/src/local/statementReaderDedup.test.ts apps/mobile/src/folio/store.ts apps/mobile/src/folio/store.test.ts apps/mobile/src/folio/lib/canonicalAppStateReadProjection.ts apps/mobile/src/folio/lib/canonicalAppStateReadProjection.test.ts` | exit 0              |

## Scope

**In scope**:

- `apps/mobile/src/folio/lib/importSheet.ts`
- `apps/mobile/src/local/statementReaderParse.ts`
- `apps/mobile/src/local/statementReaderDedup.ts`
- `apps/mobile/src/local/statementReaderDedup.test.ts`
- `apps/mobile/src/folio/store.ts`
- `apps/mobile/src/folio/store.test.ts`
- `apps/mobile/src/folio/lib/canonicalAppStateReadProjection.ts` only if an explicit duplicate-ID
  guard is missing
- `apps/mobile/src/folio/lib/canonicalAppStateReadProjection.test.ts`

**Out of scope**:

- Fuzzy transaction matching or a general entity-resolution engine.
- Provider-specific IDs that the current readers do not possess.
- Silent automatic posting of possible duplicates.
- Changing transaction retention limits or canonical storage architecture.
- Rewriting statement parsers.

## Git workflow

- Branch: `advisor/005-stable-import-row-identity`.
- Commit example: `fix(import): preserve repeated statement rows`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Document and enforce candidate ID semantics

Keep `CandidateMoneyItem.id` required. Strengthen its documentation: it is a deterministic identity for
one source row, stable when the same input is parsed again, and distinct for distinct row positions
even when money/date/merchant match.

Add parser tests proving:

- reparsing identical CSV/text yields identical candidate IDs;
- two identical financial rows at different row positions get different IDs;
- no parser uses `Date.now()` or randomness for candidate identity.

Do not add file content hashes or a database migration in this plan.

**Verify**:
`pnpm exec vitest run apps/mobile/src/folio/lib/importSheet.test.ts apps/mobile/src/local/statementReaderParse.test.ts --passWithNoTests`
→ exit 0 (use the actual existing parser test filename if it differs, and update the plan status note).

### Step 2: Make chunk merging identity-based and non-destructive

Change `mergeChunkCandidates` so only the same deterministic candidate ID may be removed as the same
source row. Never drop a distinct ID merely because date, amount and merchant match. Retain
`dedupeKey` only as a similarity/review helper if a current caller needs it; otherwise remove it.

Update `statementReaderDedup.test.ts`:

- same ID repeated across chunks -> one row;
- same natural key with different IDs in one chunk -> both rows;
- same natural key with different IDs across chunks -> both rows;
- order remains stable;
- missing-date identical amounts still survive when IDs differ.

If the product needs a warning, attach a non-authoritative “possible duplicate” note for Review; do
not suppress the row. Do not expand into new UI unless an existing candidate note is sufficient.

**Verify**:
`pnpm exec vitest run apps/mobile/src/local/statementReaderDedup.test.ts --passWithNoTests`
→ exit 0.

### Step 3: Derive landed transaction IDs from stable row identity

Change `importedTransactionId` to hash a canonical string containing at least candidate `source`,
candidate `id`, and the normalized natural key. The candidate ID distinguishes repeated rows; the
remaining fields make accidental cross-parser ID reuse fail safely. Continue using the `imp-` prefix.

Build a per-batch set while mapping candidates. Before mutating state, assert all generated IDs are
unique; on collision, reject the batch with an explicit error rather than partially writing. Existing
persisted `imp-` IDs remain valid and require no migration.

Update re-import tests to use explicit stable candidate IDs rather than random helper defaults.
Required cases:

- exact same candidates reimported -> all skipped;
- same natural key but different candidate IDs -> both land with unique IDs;
- partial overlap by candidate identity -> only the repeated row is skipped;
- a forced generated-ID collision -> zero mutation;
- canonical projection round-trips both legitimate rows.

**Verify**:
`pnpm exec vitest run apps/mobile/src/folio/store.test.ts apps/mobile/src/folio/lib/canonicalAppStateReadProjection.test.ts --passWithNoTests`
→ exit 0.

### Step 4: Run full import regression coverage

Run all main tests and typecheck. Inspect summary counts: `duplicatesSkipped` must count repeated source
identities, not natural-key similarities. Preserve one-confirm bulk landing and review-before-truth.

**Verify**: `pnpm test` and `pnpm typecheck` → both exit 0.

## Test plan

- Parser identity tests in existing import/parser suites.
- Identity-based chunk merge tests in `statementReaderDedup.test.ts`.
- Store idempotency, legitimate duplicate and pre-mutation collision tests in `store.test.ts`.
- Canonical projection test with two same-day/same-merchant/same-amount rows and distinct IDs.
- Test fixtures must use deterministic literal IDs; remove randomness from the re-import fixtures that
  assert idempotency.

## Done criteria

- [x] Distinct candidate row IDs are never discarded because their natural keys match.
- [x] Exact reimports remain idempotent.
- [x] Every landed transaction ID is unique before state mutation.
- [x] Two legitimate identical financial rows round-trip through canonical storage.
- [x] `duplicatesSkipped` has identity-based semantics.
- [x] Focused tests, full tests and typecheck pass.

## Execution evidence

- Completed on branch `codex/melo-one-app-convergence-2026-08-15` after plan 004.
- Candidate IDs are documented and tested as deterministic source-row identities; repeated natural
  facts remain distinct when their row identities differ.
- Chunk merging removes only repeated candidate IDs. The date/amount/merchant natural key remains a
  similarity helper and is never deletion authority.
- Imported transaction IDs bind source, candidate ID and normalized natural facts. The complete
  batch is checked for generated-ID collisions before any state mutation, and collision rejection is
  covered by a byte-identical persistence assertion.
- Exact reimport, partial-overlap, legitimate-repeat and canonical round-trip cases are covered.
- Focused verification passed 5 files and 358 tests. `pnpm test` passed 237 Vitest files / 2,747
  tests and the 45-test companion suite; `pnpm typecheck`, owned-file Prettier and
  `git diff --check` passed.

## STOP conditions

- A production parser emits nondeterministic candidate IDs.
- Candidate ID stability cannot be established for a supported source.
- The only proposed solution is to keep the natural-key drop and add a manual-entry workaround.
- Fixing uniqueness would require rewriting already-persisted transaction IDs.
- The canonical repository silently overwrites duplicate IDs instead of rejecting them and cannot be
  guarded within scope.

## Maintenance notes

If a future provider supplies a durable provider transaction ID, incorporate it into candidate row
identity. Natural keys remain useful for review hints but must never again be deletion authority.
