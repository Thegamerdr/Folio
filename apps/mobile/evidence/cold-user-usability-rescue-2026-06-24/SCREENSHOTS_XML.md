# Screenshots And XML

Date: 2026-06-24

## Screenshot Files

- `screenshots/calendar.png`
- `screenshots/apk-launch.png`
- `screenshots/data-control.png`
- `screenshots/empty-first-launch.png`
- `screenshots/first-real-today-briefing.png`
- `screenshots/import-entry.png`
- `screenshots/melo-surface.png`
- `screenshots/minimal-manual-path.png`
- `screenshots/plans.png`
- `screenshots/recovery-preview.png`
- `screenshots/rejected-import-state.png`
- `screenshots/review-rows.png`
- `screenshots/sample-briefing.png`
- `screenshots/start.png`
- `screenshots/timeline.png`

## XML Files

- `xml/calendar.xml`
- `xml/data-control.xml`
- `xml/empty-first-launch.xml`
- `xml/first-real-today-briefing.xml`
- `xml/import-entry.xml`
- `xml/melo-surface.xml`
- `xml/minimal-manual-path.xml`
- `xml/plans.xml`
- `xml/recovery-preview.xml`
- `xml/rejected-import-state.xml`
- `xml/review-rows.xml`
- `xml/sample-briefing.xml`
- `xml/start.xml`
- `xml/timeline.xml`

## Capture Method

`pnpm exec vite-node tooling/scripts/render-mobile-shell-evidence.ts` generated HTML/XML. Chrome headless captured PNGs from the generated HTML pages.

`screenshots/apk-launch.png` was captured from the rebuilt release APK after installing it on `emulator-5554`.
