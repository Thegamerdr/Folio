# Folio V2 Overnight Factory Evidence - 2026-06-22

## Scope

This pack covers the Product Experience + Evidence + Hardening pass for the current mobile-first Folio V2 loop:

```text
empty first launch
-> sample or minimal entry/import
-> review staged information
-> accept/edit/reject
-> Today updates
-> Timeline explains what changed
-> Plans/Recovery show consequence
-> Calendar reflects dates
-> Melo interprets without taking authority
-> Data Control proves ownership
```

The pass did not add Business UI, cloud sync, Open Banking, AI gateway, billing, App Store release work, full OCR, final Melo runtime, tax filing, debt advice, investment advice, social features, streaks, or a redesign.

## Files In This Pack

- `runtime-notes.md`: runtime attempts, blockers and web export result.
- `route-surface-evidence.md`: 17 route/surface captures represented as deterministic route evidence.
- `scenario-fixtures.md`: 12 synthetic product fixtures now backed by testable code.

## Source Evidence

- Route evidence source: `apps/mobile/src/local/productExperienceEvidence.ts`
- Fixture source: `apps/mobile/src/local/productExperienceFixtures.ts`
- Product loop tests: `apps/mobile/src/local/canonicalProductExperienceLoop.test.ts`
- Fixture tests: `apps/mobile/src/local/productExperienceFixtures.test.ts`
- Route guard tests: `apps/mobile/src/local/routeSurfaceTruth.test.ts`

## Current Command Evidence

- `pnpm --filter @folio/mobile doctor`: passed, 21/21 checks.
- `pnpm --filter @folio/mobile exec expo config --json`: passed and reports iOS/Android Expo app configuration.
- `pnpm --filter @folio/mobile exec expo export --platform web --output-dir ..\..\docs\release-evidence\overnight-factory-2026-06-22\web-export`: passed; generated bundle was removed after recording the result to avoid committing generated artifacts.
- Focused product experience checks: passed, 7 files and 52 tests.
- Full CI: passed on this host. Boundary checks, synthetic-data policy, constitution gate, canonical product gates, format check, typecheck, 53 Vitest files / 487 tests and contract validation all passed.
- CI still reports operations, store declarations and public release as `BLOCKED` readiness states; those are expected release gates, not command failures.

## Known Limitations

- Android emulator/device screenshots were not captured in this run because `adb` and `emulator` were not on PATH.
- iOS simulator screenshots were not captured because `xcrun` was not available on this Windows host.
- The web export proves the bundle path, not native device interaction.
- Import row source display is derived from the current staged document/import context; canonical provenance remains the durable source of truth.
- True device checks for touch traversal, keyboard behavior, safe-area edges and local file export still require a native runtime.

## Canonical Conflict Review

No canonical conflict was introduced by this pass. The evidence and tests preserve:

- local-first ownership;
- review before financial reality;
- rejected evidence retained outside reality;
- no fake scores;
- no advice or shame language;
- no direct Melo writes;
- separate transactions, events, expectations, plans, scenarios and decisions;
- enforceable Personal/Business boundary at the model level.
