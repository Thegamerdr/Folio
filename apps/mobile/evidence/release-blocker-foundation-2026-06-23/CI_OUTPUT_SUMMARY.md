# CI Output Summary

Status: passed.

Command:

```text
pnpm run ci
```

Result:

- Dependency boundaries passed.
- V1 boundary proof passed.
- Synthetic-data policy passed.
- Product constitution gate passed.
- Canonical product gates passed.
- Operations readiness gate reported blocked release operations but did not fail internal CI.
- Store declaration gate reported blocked public store readiness but did not fail internal CI.
- Public release gate reported blocked public release, 23 open blockers, 14 release-blocking,
  6 beta-blocking and 3 roadmap-blocking blockers; gate remained non-failing for internal CI.
- Release foundation gate passed.
- Prettier format check passed.
- TypeScript project build passed.
- Vitest passed: 64 test files, 540 tests.
- Source package validation passed: 75 files, 15,822 lines, 70,114 words, 82 database tables,
  192 tasks, 32 risks, 51 research sources, 18 forecast vectors, 15 import vectors.
- Fixture consistency validation passed: 14 checked cases, 0 failures.

Important release-readiness interpretation:

- This CI pass proves the release blocker foundation is structured and machine-visible.
- It does not prove Folio is ready for public release.
- It does not clear physical Android, iOS, legal, security, accessibility, billing or store-console
  blockers.
