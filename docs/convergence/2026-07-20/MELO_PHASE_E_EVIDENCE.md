# Phase E evidence

Phase E foundation completion, Phase E.1 source journey completion and Phase E.2 Android runtime proof are separate evidence sets.

- Phase E foundation: this document.
- Phase E.1 journey completion: `MELO_PHASE_E1_EVIDENCE.md` and the Phase E.1 companion documents in this folder.
- Phase E.2 Android runtime proof: `MELO_PHASE_E2_EVIDENCE.md` and `artifacts/phase-e2-android-emulator-20260721/`.

## Implementation summary

- Added Phase E domain contracts for six critical journeys.
- Added v18 AppState migration and workspace-owned bounded records.
- Integrated material-change causality into WhatChangedRow.
- Added export CSVs for Phase E records.
- Fixed material-decision duplicate submission so a repeated command cannot demote a chosen receipt.
- Added explicit consent recording in the store material-decision wrapper.

## Focused automated verification

Passed:

`pnpm test -- criticalJourneys whatChanged appStateAuthorityManifest workspaceRows trusted-core store.test.ts`

Result:

- 9 test files passed
- 352 tests passed

Passed:

`pnpm --filter @folio/mobile typecheck`

## Final automated verification

Passed:

`pnpm test -- --reporter=dot`

Result:

- 233 test files passed
- 2696 tests passed

Passed:

- `pnpm typecheck`
- `pnpm --filter @folio/mobile build`
- `git diff --check`

Formatting:

- `pnpm exec prettier --write` completed for touched Phase E files.

Note: `git diff --check` emitted CRLF conversion warnings only; no whitespace errors were reported.

## Android

Phase E.2 unblocked Android emulator evidence without committing generated native projects.

- Final emulator artifact source commit: `b8bb84697a0634c1bc442a86ae38ed9fed18db96`
- Package: `com.melomoney.app`
- APK SHA-256: `45811A0847A2695C15B59A7876A986D930306F4783162FEE401B628D162B6E49`
- Evidence directory: `artifacts/phase-e2-android-emulator-20260721/`

See `MELO_PHASE_E2_EVIDENCE.md`.

## Remaining Phase E risks

- Dedicated first-answer UI is deferred.
- Automatic material-change recording is not wired into every writer.
- Full recovery bundle preview is deferred.
- Source re-import reconciliation UI is deferred.
- Direct native edit/save correction still needs a transaction fixture in Phase F/pre-release validation, although the source correction path is covered by automated tests.
