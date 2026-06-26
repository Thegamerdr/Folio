# Issues Fixed

The pass fixed only high-confidence P1 trust/copy issues.

## UI-TRUST-001

Heavy "financial reality" and "becomes reality" wording was replaced with calmer money-view wording.

Changed examples:

- First minute: "nothing affects your money view until you review it"
- Import Review: "Review decides what affects your money view."
- Import Review decision strip: "Accept adds this to your money view."
- Data Control: "Accepted money rows"

## UI-TRUST-002

Visible technical repository/import language was removed from user-facing surfaces.

Changed examples:

- "Canonical local repository" -> "Local records on this device"
- "Canonical object counts" -> "Local record counts"
- "Source and parser details" -> "Source and review details"
- "Source looked parseable" -> "Source looked readable"
- "Parser error" -> "Read wrong"
- Parser limitation labels -> source/import wording

## Evidence Recaptured

The static mobile-shell evidence pages were regenerated and after-fix screenshots were captured into `after-screenshots/`.

Focused tests passed after the changes:

`pnpm vitest run apps/mobile/src/surfaces/uiTrustReviewCopy.test.ts apps/mobile/src/local/routeSurfaceTruth.test.ts apps/mobile/src/surfaces/mobileSurfaceExtraction.test.ts apps/mobile/src/local/canonicalProductExperienceLoop.test.ts --passWithNoTests`
