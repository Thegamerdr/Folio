# Real Product UX Rebuild Evidence

Date: 2026-06-24

This folder records the Folio V2 real product UX rebuild evidence. It is not a claim of public-release readiness.

## Contents

- `index.html`: static evidence board generated from local product copy and ledger models.
- `pages/`: 28 individual static HTML surface states.
- `xml/`: 28 XML/plain-text surface captures.
- `screenshots/`: 28 PNG captures from the static evidence states.
- `actual-app-screenshots/`: Android emulator screenshots and one tap-through recording from the release APK.
- `manifest.json`: generated static evidence manifest.

## Actual Android Evidence

- `actual-app-screenshots/android-launch-smoke.png`
- `actual-app-screenshots/android-payday-flow.png`
- `actual-app-screenshots/android-review-flow.png`
- `actual-app-screenshots/android-more.png`
- `actual-app-screenshots/android-tap-through.mp4`

## Generation

Static evidence was generated with:

```text
FOLIO_EVIDENCE_OUTPUT_DIR=apps/mobile/evidence/real-product-ux-rebuild-2026-06-24
pnpm exec vite-node tooling/scripts/render-mobile-shell-evidence.ts
```

Screenshots were captured with headless Chrome at `430x920`.

Android smoke evidence was captured from `emulator-5554` after installing the release APK.
