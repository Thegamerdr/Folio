# CI Result

Status: passed.

Full command:

```text
pnpm run ci
```

Result:

```text
Exit code: 0
63 test files passed
535 tests passed
Contract validation passed
```

Focused checks run before full CI:

```text
pnpm --filter @folio/mobile typecheck
pnpm vitest run apps/mobile/src/local/dogfoodMode.test.ts --passWithNoTests
pnpm vitest run apps/mobile/src/local/productExperienceFixtures.test.ts apps/mobile/src/local/routeSurfaceTruth.test.ts --passWithNoTests
```

Non-failing readiness notices still printed:

- operations readiness remains blocked for external readiness work;
- store declarations remain blocked for submitted-binary/store-console work;
- public release gate remains blocked for existing release, native, security, privacy, accessibility, billing and cloud blockers.
