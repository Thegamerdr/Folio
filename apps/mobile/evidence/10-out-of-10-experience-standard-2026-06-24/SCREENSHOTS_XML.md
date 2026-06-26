# Screenshots And XML

Date: 2026-06-24

## Screenshot Files

- `screenshots/apk-launch.png`
- `screenshots/calendar.png`
- `screenshots/data-control.png`
- `screenshots/empty-first-launch.png`
- `screenshots/first-real-today-briefing.png`
- `screenshots/first-value-moments.png`
- `screenshots/import-entry.png`
- `screenshots/melo-surface.png`
- `screenshots/minimal-manual-path.png`
- `screenshots/plans.png`
- `screenshots/recovery-preview.png`
- `screenshots/rejected-import-state.png`
- `screenshots/review-only-file.png`
- `screenshots/review-rows.png`
- `screenshots/sample-briefing.png`
- `screenshots/start.png`
- `screenshots/timeline.png`
- `screenshots/why-inspect-route.png`

## XML Files

The `xml/` folder contains one XML text capture for each generated HTML screenshot. `screenshots/apk-launch.png` is native emulator evidence and does not have a generated HTML XML companion.

## Capture Method

```text
FOLIO_EVIDENCE_OUTPUT_DIR=apps/mobile/evidence/10-out-of-10-experience-standard-2026-06-24 pnpm exec vite-node tooling/scripts/render-mobile-shell-evidence.ts
```

Chrome headless then captured the generated `pages/*.html` files at a mobile viewport.
