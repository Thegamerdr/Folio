# CI Summary

Updated: 2026-06-23

## Commands Run

Focused trust/copy tests:

`pnpm vitest run apps/mobile/src/surfaces/uiTrustReviewCopy.test.ts apps/mobile/src/local/routeSurfaceTruth.test.ts apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts apps/mobile/src/local/canonicalProductExperienceLoop.test.ts --passWithNoTests`

Result: passed, 4 test files, 42 tests.

Static evidence regeneration:

`pnpm exec vite-node tooling/scripts/render-mobile-shell-evidence.ts`

Result: passed, generated 13 evidence pages.

Full CI:

`pnpm run ci`

Result: passed.

Details:

- Dependency boundaries passed.
- V1 boundary proof passed: 211 V2 runtime/package files checked against 859 V1 hashes.
- Synthetic-data policy passed.
- Product constitution gate passed.
- Canonical product gates passed.
- Formatting passed.
- Typecheck passed.
- Vitest passed: 65 test files, 542 tests.
- Source-package validation passed: 75 files, 15,822 lines, 70,114 words, 82 database tables, 192 tasks, 32 risks, 51 research sources.
- Fixture consistency validation passed: 14 checked cases, 0 failures.

Important nuance:

- CI exits successfully, but the release-readiness scripts intentionally print current non-dogfood blockers.
- Operations readiness remains blocked by tabletop, rotation-drill and vulnerability-disclosure evidence.
- Store declarations remain blocked by submitted-binary/store-console/privacy/processor/SDK evidence.
- Public release remains blocked by the existing release matrix.
- These blockers do not mean the UI trust review failed; they mean green CI is not public-release approval.
