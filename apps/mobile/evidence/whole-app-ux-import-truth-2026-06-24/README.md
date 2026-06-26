# Whole-App UX Import Truth Evidence

Date: 2026-06-24

This folder records the whole-app UX rescue and deterministic import truth pass.

It contains:

- IA before/after notes.
- Import truth contract.
- Synthetic bank fixture list.
- End-to-end proof notes.
- Rendered surface pages.
- PNG screenshots.
- XML surface state summaries.
- Deferred issues.
- CI summary.

Rendered proof was generated from local models and app surface copy with:

```text
FOLIO_EVIDENCE_OUTPUT_DIR=apps/mobile/evidence/whole-app-ux-import-truth-2026-06-24 pnpm exec vite-node tooling/scripts/render-mobile-shell-evidence.ts
```

Screenshots were captured from the rendered local HTML pages with Chrome headless.
