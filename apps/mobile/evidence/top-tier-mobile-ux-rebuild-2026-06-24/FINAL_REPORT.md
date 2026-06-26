# Top-Tier Mobile UX Rebuild Evidence

Date: 2026-06-24

## Verdict

This pass should be judged as a rebuilt, evidence-backed cold-user candidate, not as a declared universal 10/10. The strongest improvements are now visible in the final APK: one dominant Start action, guided first-number entry, review-before-save rows, row-specific action sheet, honest PDF fallback, route pressure facts with source/status labels, and a debt flow that no longer opens as a dense form.

## APK

- Path: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- SHA256: `C70EBA2F9FA02C30857CB30744F935877103C1C6D352AB1C6217669DF0CEB65D`
- Installed and launched on emulator: `emulator-5554`
- Package: `com.folio.v2.greenfield`

## Actual APK Evidence

Folder: `apps/mobile/evidence/top-tier-mobile-ux-rebuild-2026-06-24/actual-apk`

- `01-start.png`: dominant first action plus secondary paths.
- `02-guided-step-1.png`: one-question guided first-number entry.
- `03-guided-after-value.png`: entered value state.
- `04-debt-flow.png`: debt flow rebuilt as step 1 of 5 with visible Continue.
- `05-import-entry.png`: bank activity entry with review-before-save copy.
- `06-pdf-fallback.png`: real native PDF picker return; file attached, no rows added.
- `07-review-queue.png`: seeded review row waiting before save.
- `08-row-bottom-sheet.png`: row-specific Add/Edit/Ignore/category action sheet.
- `09-today.png`: Today route headline and pressure facts.
- `10-route.png`: protected buffer and route pressure point.
- `11-route-point-reveal.png`: tapped route point detail and source/status rows.
- `12-more.png`: More surface.
- `13-data-privacy.png`: local data inspection/export/clear framing.
- `tap-through.mp4`: short final APK tap-through.

## Static Evidence

Generated 28 static evidence pages in this folder with `tooling/scripts/render-mobile-shell-evidence.ts`. Files were formatted with Prettier after generation.

## Verification

- `pnpm --filter @folio/mobile exec tsc --noEmit --pretty false`: passed.
- Focused UX tests: passed.
- Release APK build: passed.
- Full `pnpm run ci`: passed.

CI still prints public-release blockers for operations/store/security/legal/accessibility readiness. Those are retained as release-governance blockers and do not mean this owner-dogfood UX pass is public-release ready.
