# Figma UI Parity - 2026-06-21

## Canonical Source

The supplied UI direction package is the source of truth:

- `docs/ui-source/Folio_UI_Deep_Research_Mock_2026-06-21/folio_ui_research_direction.png`
- `docs/ui-source/Folio_UI_Deep_Research_Mock_2026-06-21/folio_first_minute_research_direction.png`
- `docs/ui-source/Folio_UI_Deep_Research_Mock_2026-06-21/folio_interaction_prototype.html`
- `docs/ui-source/Folio_UI_Deep_Research_Mock_2026-06-21/00_DEEP_UI_RESEARCH_SYNTHESIS.md`

Earlier generated Figma parity frames are superseded by the zip package. They remain in the file
only as work history.

## Figma File

- File: `Folio V2 UI Parity - 2026-06-21`
- URL: `https://www.figma.com/design/Gva1xXjMk8ifmyJ8L7Tpki`
- Canonical page: `Canonical Zip Reference - 2026-06-21`
- Local Figma screenshot: `docs/release-evidence/figma-canonical-zip-reference.png`
- Local-candidate page: `Folio 10/10 Local Candidate - 2026-06-21`
- Local-candidate board screenshot:
  `docs/release-evidence/figma-10-10-local-candidate.png`

## App Alignment

The Expo live preview now implements the zip's core UI moments in
`apps/mobile/app/index.tsx`:

- first-minute welcome choices;
- playable route change;
- import-as-discovery progress;
- first relief answer;
- Today route answer;
- import review with original wording and review actions;
- bad-month recovery.

Supporting tokens were aligned in `packages/ui/src/tokens.ts`.

The local-candidate Figma page is review evidence only. The Android emulator captures remain the
interaction proof, and the repository remains the source of truth for production behavior.

## Huashu Gate

Huashu review outcome after the live emulator pass: acceptable as a strong local UI candidate, not a
public-release UX claim. Remaining work is production accessibility testing, reduced-motion and
large-text recordings, native motion polish, real drag interaction and full component parity in
Figma.
