# Folio V2 True Overnight Factory Evidence - 2026-06-23

## Scope

This pack covers the implementation pass that made the live mobile app less shell-like while preserving the canonical model.

The pass did not add Business UI, cloud sync, Open Banking, AI gateway, billing, app-store release work, full OCR, final Melo runtime, tax filing, debt advice, investment advice, social features, streaks or a redesign.

## Product Code Evidence

- `apps/mobile/app/index.tsx` dropped from 6,387 lines to 6,062 lines.
- Extracted surface modules live under `apps/mobile/src/surfaces`.
- Live route imports and renders the extracted surfaces.
- `tooling/scripts/check-product-canonical-gates.mjs` now scans `apps/mobile/src/surfaces`.

## Files In This Pack

- `implementation-evidence.md`: product surfaces changed and component extraction inventory.
- `runtime-notes.md`: runtime attempts, blockers and web export result.
- `scenario-fixtures.md`: 14 deterministic product fixtures.
- `accessibility-notes.md`: accessibility improvements and device-verification gaps.

## Command Evidence

- Focused product checks: passed, 3 files and 37 tests.
- `pnpm check:product-gates`: passed.
- `pnpm --filter @folio/mobile doctor`: passed, 21/21 checks.
- `pnpm --filter @folio/mobile exec expo config --json`: passed.
- `pnpm --filter @folio/mobile exec expo export --platform web --output-dir ..\..\docs\release-evidence\true-overnight-factory-2026-06-23\web-export`: passed; generated bundle was removed after recording the result.
- Full CI: passed on this host. Boundary checks, V1 boundary proof, synthetic-data policy, constitution gate, canonical product gates, format check, typecheck, 53 Vitest files / 488 tests and contract validation all passed.
- CI still reports operations, store declarations and public release as `BLOCKED` readiness states; those are expected release gates, not command failures.

## Canonical Conflict Review

No canonical conflict is expected from this pass. The code path still preserves:

- local-first ownership;
- optional cloud, AI and Open Banking;
- review before financial reality;
- rejected evidence outside financial reality;
- no fake scores;
- no advice or shame language;
- no direct Melo writes;
- separate transactions, events, expectations, plans, scenarios and decisions;
- Personal/Business boundary enforcement.
