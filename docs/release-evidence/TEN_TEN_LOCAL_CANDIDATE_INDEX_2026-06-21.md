# 10/10 Local Candidate Index - 2026-06-21

## Scope

This index records the one-go push toward a 10/10 local production-candidate. It does not convert
Folio V2 into a public release candidate.

## Evidence Set

- `LOCAL_PRODUCTION_CANDIDATE_2026-06-21.md`: bounded local readiness claim.
- `PRODUCT_10_10_READINESS_GAP_2026-06-21.md`: honest gap register for public 10/10 release.
- `UI_RECOVERY_AUDIT_2026-06-21.md`: Huashu UX audit and current zip-aligned prototype status.
- `FIGMA_UI_PARITY_2026-06-21.md`: canonical Figma/UI parity record.
- `A11Y_SECURITY_10_10_LOCAL_CANDIDATE_2026-06-21.md`: local accessibility/security hardening,
  emulator XML evidence and external-audit boundaries.
- `LOCAL_TESTER_APK_STANDALONE_2026-06-21.md`: standalone Android tester APK, install, launch,
  release logcat and product-flow evidence.
- `C15-android-local-use-hardening.md`: final Android local-use hardening pass with SecureStore
  keying, app-lock overlay, system picker staging and SVG route proof.
- `figma-10-10-local-candidate.png`: Figma local-candidate evidence board render.
- `tooling/config/release-blockers.json`: authoritative public release blocker register.

## Live Emulator Capture Set

Captured on Android `emulator-5554` against the Expo development client
`com.folio.v2.greenfield` with Metro on port `8084`:

- `android-ui-10-10-first-minute.png`: first product minute, no engineering status wall.
- `android-ui-10-10-playable.png`: private sample route before saving anything.
- `android-ui-10-10-playable-moved.png`: route after the repair moves.
- `android-ui-10-10-what-if.png`: reversible purchase test sheet.
- `android-ui-10-10-import-discovery.png`: import as pattern discovery with original source.
- `android-ui-10-10-first-answer.png`: first relief answer before perfect data.
- `android-ui-10-10-today.png`: default Today product surface.
- `android-ui-10-10-sources.png` and `.xml`: confidence/source sheet.
- `android-ui-10-10-more.png` and `.xml`: compact controls surface.
- `android-ui-10-10-import-review.png` and `.xml`: original wording plus review actions.
- `android-ui-10-10-import-review-confirmed.png`: review action feedback.
- `android-ui-10-10-recovery.png` and `.xml`: bad-month route recovery.
- `android-a11y-security-first-minute.png` and `.xml`: grouped first-minute accessibility labels.
- `android-a11y-security-today.png` and `.xml`: route chart and tab accessibility labels.
- `android-a11y-security-sources.png` and `.xml`: modal source/provenance hierarchy.
- `android-a11y-security-more.png` and `.xml`: More-controls hierarchy.
- `android-a11y-security-import-review.png` and `.xml`: review action labels.
- `android-a11y-security-import-review-action.png` and `.xml`: live review-action notice.

The grey Expo Tools control visible in some captures is development-client tooling, not Folio UI.

## Standalone Tester APK Capture Set

Captured on Android `emulator-5554` against the standalone release APK
`apps/mobile/android/app/build/outputs/apk/release/app-release.apk`:

- `android-standalone-release-root.png` and `.xml`: product first-minute entry.
- `android-standalone-release-playable-moved.png` and `.xml`: playable route moved before saving.
- `android-standalone-release-first-answer.png` and `.xml`: import discovery first answer.
- `android-standalone-release-today-main.png` and `.xml`: Today route and local events.
- `android-standalone-release-more-vault.png` and `.xml`: local vault row summary and data version.
- `android-standalone-release-import-review-real.png` and `.xml`: import review original wording and actions.
- `android-standalone-release-import-melo-suggest.png` and `.xml`: Melo suggestion remains review-gated.
- `android-standalone-release-whatif.png` and `.xml`: bad-month route recovery.
- `c15-final-apk-launch-rendered.png` and `.xml`: final rebuilt APK renders with honest import copy.
- `c15-more.png` and `.xml`: SecureStore key active plus local app-lock posture.
- `c15-document-picker-2.png` and `.xml`: Android system picker opens from Folio.
- `c15-import-file-staged.png` and `.xml`: text statement staged with filename, MIME, size,
  cache-copy state and digest.
- `c15-import-file-row-actions.png` and `.xml`: review actions sit above the nav.
- `c15-import-after-confirm.png` and `.xml`: file-imported row commits only after confirmation.

Release logcat scan found no Metro/dev-launcher/fatal runtime markers after launch.
Final C15 bundle/source scans found no legacy hardcoded DB key.

## Candidate Standard

Local candidate means:

- app opens directly to the product experience, not an engineering evidence wall;
- first minute matches the supplied zip direction before any extra invention;
- Android local-use security has SecureStore key proof and an app-lock overlay;
- text statement import uses the Android system picker and remains review-gated;
- deterministic package tests and contract validation pass;
- Android emulator evidence is captured after code changes;
- cold relaunch recovers to the product first-minute route after the Expo dev-client paint window;
- real/private sample files are not committed;
- external Apple, banking, store, legal, security, privacy, accessibility and operations blockers
  remain open until independently proven.

## Current Release Label

Use:

> Local production-candidate implementation and evidence pack; public release blocked pending
> platform, provider, store, legal, security, privacy, accessibility, operations and real/private
> vault-backed evidence.

Do not use:

> Public-release-ready 10/10 product.
