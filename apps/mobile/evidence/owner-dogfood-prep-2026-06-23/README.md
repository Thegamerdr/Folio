# Owner Dogfood Prep Evidence

Date: 2026-06-23

This folder records the pre-dogfood instrumentation pass for real Android owner testing.

Included:

- `ANDROID_INSTALL_FOR_OWNER.md`
- `ANDROID_OWNER_DOGFOOD_SCRIPT.md`
- `DOGFOOD_BUG_REPORT_TEMPLATE.md`
- `DIAGNOSTIC_BUNDLE.md`
- `SCENARIO_SEED_LIST.md`
- `KNOWN_LIMITATIONS.md`
- `CI_RESULT.md`

Implemented evidence:

- Internal/test Dogfood Mode is available from `More -> Dogfood mode`.
- Dogfood Mode exposes reset, synthetic scenario seeds, canonical object counts and redacted diagnostic export.
- Diagnostic export writes local JSON and Markdown files only.
- Safety gates live in `apps/mobile/src/local/dogfoodMode.test.ts`.
