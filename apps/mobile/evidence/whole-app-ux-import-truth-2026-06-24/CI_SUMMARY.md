# CI Summary

Date: 2026-06-24

Status: full CI passed.

Focused checks already run:

```text
pnpm vitest run packages/import-engine/test/import-engine.test.ts apps/mobile/src/local/importTruthChain.test.ts apps/mobile/src/local/routeSurfaceTruth.test.ts apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts apps/mobile/src/surfaces/uiTrustReviewCopy.test.ts apps/mobile/src/local/canonicalExperienceSqlite.test.ts --passWithNoTests
```

Result:

```text
6 test files passed
63 tests passed
```

Full CI command:

```text
pnpm run ci
```

Full CI result:

```text
exit code 0
66 test files passed
555 tests passed
Prettier format check passed
docs/source-package validation passed
fixture consistency validation passed
```

Known non-failing readiness reports still printed during CI:

- operations readiness is blocked by tabletop, rotation drill and vulnerability disclosure work.
- store declarations are blocked until submitted-binary and console review work exists.
- public release remains blocked by the existing release blocker register.

Those are outside this pass and do not mark the owner Android dogfood APK as public-ready.
