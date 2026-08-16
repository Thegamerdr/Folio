# Plan 004: Delete plaintext imported documents after encrypted retention

> **Executor instructions**: Follow the steps in order. This plan owns picker-cache lifecycle only;
> do not redesign the encrypted document vault. Run every verification command and update
> `advisor-plans/README.md` when done unless a reviewer owns the index.
>
> **Drift check (run first)**:
> `git diff --stat f7b91c7..HEAD -- apps/mobile/src/local/nativeDocumentImport.ts apps/mobile/src/folio/lib/evidencePicker.ts apps/mobile/src/folio/lib/documentVault.ts apps/mobile/src/folio/lib/documentVault.test.ts apps/mobile/src/folio/screens/IntakeScreen.tsx apps/mobile/src/folio/sheets/EditTxnSheet.tsx apps/mobile/app/index.tsx`
> Stop if source URIs are already consumed after the call sites described below.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none; execute after plan 003 in the requested sequence
- **Category**: security
- **Planned at**: commit `f7b91c7`, 2026-08-16

## Why this matters

Statements, receipts and photos are copied into app cache before local reading and encrypted vault
retention. The retained copy is encrypted, but the picker copy is never deleted. Money data and PII
can therefore remain as plaintext until OS eviction. The lifecycle must give Melo ownership of a
narrow staging location, delete exact owned files on success and failure, and never delete a user's
original library/document URI.

## Current state

- `apps/mobile/src/local/nativeDocumentImport.ts:38-43` uses
  `DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true })` and returns its URI.
- `apps/mobile/src/local/nativeDocumentImport.ts:69-111` reads or extracts the selected file before
  returning the candidate result.
- `apps/mobile/src/folio/lib/evidencePicker.ts:18-36` and `:40-93` return document/image picker URIs
  marked `copied_to_app_cache`.
- `apps/mobile/src/folio/lib/documentVault.ts:129-187` reads, encrypts and atomically retains the
  source, but intentionally does not own picker cleanup.
- `apps/mobile/src/folio/screens/IntakeScreen.tsx:372-422` retains a statement before using the
  already-extracted text; it does not need the URI after `retainSource` returns.
- `apps/mobile/src/folio/sheets/EditTxnSheet.tsx:371-409` retains an attachment and likewise does not
  use its source URI afterward.
- `apps/mobile/src/folio/lib/documentVault.test.ts:29-61` is the filesystem-mock exemplar. It tracks
  exact reads, writes, moves and deletes.

## Commands you will need

| Purpose                      | Command                                                                                                                                                                                                                                                                                                                              | Expected on success                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Focused tests                | `pnpm exec vitest run apps/mobile/src/folio/lib/documentVault.test.ts apps/mobile/src/folio/lib/pickerCache.test.ts --passWithNoTests`                                                                                                                                                                                               | exit 0                                                                             |
| Typecheck                    | `pnpm typecheck`                                                                                                                                                                                                                                                                                                                     | exit 0                                                                             |
| Mobile install compatibility | `pnpm mobile:install-check`                                                                                                                                                                                                                                                                                                          | exit 0 or a documented pre-existing Expo mismatch; no new package should be needed |
| Formatting                   | `pnpm exec prettier --check apps/mobile/src/local/nativeDocumentImport.ts apps/mobile/src/folio/lib/evidencePicker.ts apps/mobile/src/folio/lib/pickerCache.ts apps/mobile/src/folio/lib/pickerCache.test.ts apps/mobile/src/folio/screens/IntakeScreen.tsx apps/mobile/src/folio/sheets/EditTxnSheet.tsx apps/mobile/app/index.tsx` | exit 0                                                                             |

## Scope

**In scope**:

- Create `apps/mobile/src/folio/lib/pickerCache.ts`
- Create `apps/mobile/src/folio/lib/pickerCache.test.ts`
- `apps/mobile/src/local/nativeDocumentImport.ts`
- `apps/mobile/src/folio/lib/evidencePicker.ts`
- `apps/mobile/src/folio/screens/IntakeScreen.tsx`
- `apps/mobile/src/folio/sheets/EditTxnSheet.tsx`
- `apps/mobile/app/index.tsx`
- `apps/mobile/src/folio/lib/documentVault.test.ts` only if an integration assertion belongs there

**Read-only reference**:

- `apps/mobile/src/folio/lib/documentVault.ts` — the encrypted retained-original boundary

**Out of scope**:

- Changing vault encryption, keys, filenames or evidence metadata.
- Deleting any URI outside an explicitly Melo-owned cache staging directory.
- Treating the whole cache directory as disposable.
- Uploading documents or adding cloud cleanup.
- Retaining plaintext to make retries automatic.

## Git workflow

- Branch: `advisor/004-picker-cache-cleanup`.
- Commit example: `fix(security): remove plaintext picker staging files`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Create a narrow owned staging boundary

Create `pickerCache.ts` using `expo-file-system/legacy`. Define one dedicated directory/prefix under
`FileSystem.cacheDirectory`, for example `melo-import-staging/`. Export small functions to:

- stage one picker URI into a cryptographically/randomly named owned file while preserving only a
  safe extension;
- delete one exact owned staged URI idempotently;
- sweep files only inside the owned staging directory on startup.

If the picker already returned an app-cache URI, do not assume it is safe to delete broadly. Copy it
into the owned directory, then delete the exact picker URI only when it is provably beneath
`FileSystem.cacheDirectory`; never delete `content://`, document-library, media-library or external
paths. If copying succeeds but cleanup fails, retain the owned URI for the startup sweep. Reject path
traversal and prefix-confusion (`/cache-other` is not `/cache/`).

Tests must cover app cache, external/content URI, path traversal, idempotent delete, copy failure,
delete failure and a sweep that leaves unrelated cache entries untouched.

**Verify**:
`pnpm exec vitest run apps/mobile/src/folio/lib/pickerCache.test.ts --passWithNoTests`
→ exit 0.

### Step 2: Route statement and evidence pickers through owned staging

Update `nativeDocumentImport.ts` so all text reads and native extraction use the owned staged URI.
Update `evidencePicker.ts` so returned `LocalDocumentStageInput.uri` is the owned staged URI for
documents, library images and camera captures. Preserve filename, media type, byte size and
`storageState` semantics.

If staging fails, return the existing calm unsupported/denied behavior; do not fall back to retaining
an unowned plaintext URI. Do not add a dependency—the repository already has Expo FileSystem and
Crypto.

Add pure/mocked tests for the picker adapters if current test infrastructure supports their Expo
mocks without a React renderer. Otherwise keep lifecycle tests in `pickerCache.test.ts` and cover the
callers in the next step.

**Verify**: `pnpm typecheck` → exit 0.

### Step 3: Delete staged plaintext in caller-owned `finally` blocks

The vault cannot delete its input because other readers may still need it. Keep cleanup at the
highest caller that knows consumption is complete:

- In `IntakeScreen.retainSource`, delete the owned staged URI in `finally` after retention succeeds or
  fails. The extracted text is already held in memory, so later parsing must not reread the file.
- In `EditTxnSheet.attachPickedEvidence`, retain the picked source reference outside the `try`, then
  delete its owned staged URI in `finally` after vault retention/attachment or any failure.

Cleanup failure must not delete the encrypted retained original or roll back a successful attachment;
the startup sweep is the fallback. Do not log source URI, filename or file bytes.

**Verify**:
`pnpm exec vitest run apps/mobile/src/folio/lib/documentVault.test.ts apps/mobile/src/folio/lib/pickerCache.test.ts --passWithNoTests`
→ exit 0.

### Step 4: Sweep interrupted owned staging files on startup

Call the owned-directory sweep once during app startup before normal intake can begin. Await it or
explicitly `void` it with a safe catch; it must never block access to already-encrypted financial
state. The sweep may delete only files created by the new staging helper.

Add a test proving an interrupted owned file is removed on the next startup call while unrelated
cache and evidence-view cache are untouched.

**Verify**: `pnpm typecheck` → exit 0.

### Step 5: Run security regression gates

Run focused tests and inspect the diff. Search for all picker calls and confirm each plaintext URI is
either outside Melo's ownership or enters the new staging lifecycle.

**Verify**:
`rg -n "copyToCacheDirectory: true|launchImageLibraryAsync|launchCameraAsync" apps/mobile/src`
→ every shipping result is routed through the owned staging helper.

## Test plan

- New filesystem-mock suite in `pickerCache.test.ts`, modeled on `documentVault.test.ts`.
- Success: staged file is readable through vault retention and absent afterward.
- Vault failure: staged file is still deleted; no evidence metadata is added.
- Cleanup failure: encrypted success remains, then startup sweep removes the orphan.
- Safety: external/content/library URI and unrelated cache files are never deleted.
- Size/empty-file failures retain existing user copy and leave no owned plaintext behind.

## Done criteria

- [x] Every picked statement/evidence source consumed by Melo uses an owned staging URI.
- [x] Exact staged plaintext is deleted on success and failure.
- [x] Interrupted owned files are swept on next startup.
- [x] No broad cache deletion or external-original deletion is possible.
- [x] Vault encryption and metadata contracts are unchanged.
- [x] Focused tests and typecheck pass.

## Execution evidence

- `pickerCache.ts` owns one `melo-import-staging/` directory, uses 128-bit random filenames with a
  safe extension, and requires exact direct-child/generated-name containment before deletion.
- Statement files, statement images/camera captures, receipt files/images/camera captures and the
  existing restore picker now read only from owned staged URIs. Consumer `finally` blocks remove the
  exact staging file; app startup sweeps interrupted helper-created files before hydration.
- The filesystem-mock suite covers app-cache originals, external/content originals, traversal,
  prefix confusion, idempotent deletion, copy failure, original cleanup failure, caller cleanup
  failure plus next-start sweep, and unrelated cache/evidence-view preservation.
- Focused vault, staging, native-reading and restore suites: 36 tests passed. `pnpm typecheck`,
  targeted Prettier and `git diff --check`: passed. The full root suite passed 237 Vitest files /
  2,739 tests followed by all 45 companion Node tests.
- `pnpm mobile:install-check` reported the pre-existing Expo patch-version mismatch (including
  FileSystem and ImagePicker) and exited 1. No package or dependency changed for this plan.

## STOP conditions

- Expo returns a URI whose ownership cannot be established and the proposed fix would delete it.
- A reader still needs the source URI after the planned `finally` block.
- Safe staging would require a new native module or permission.
- Cleanup requires scanning/deleting the entire cache directory.
- A test or log would include real financial document content.

## Maintenance notes

New picker/camera flows must use this helper rather than returning raw cache URIs. Reviewers should
check ownership containment before every delete. Temporary decrypted viewing files remain governed by
the separate `melo-evidence-view-` lifecycle in `documentVault.ts`.
