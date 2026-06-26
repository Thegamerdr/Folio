# Folio Brand Mark Direction

Date: 2026-06-23

Status: temporary correction direction, not final brand identity.

## Purpose

This pass replaces the previous serif `F` mark direction because it reads too close to Forbes,
luxury editorial finance and old-money prestige. Folio V2 needs a temporary mark that supports the
actual product: local-first financial clarity that helps people face reality safely.

## Current Usage Audit

Live product and build locations found:

| Location                                          | Previous state                                                                                                                     | Correction                                                            |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/mobile/assets/splash.png`                   | Serif `F` in dark circle with a green stroke. Deprecated hash: `DA7614F11B6A08D32DD9C1F6918A47F67CD33441F2281722B19FEC50B9160FD3`. | Replaced with folded-record route mark.                               |
| `apps/mobile/app.config.ts`                       | Splash plugin points to `./assets/splash.png`. No separate app icon, favicon or wordmark configured.                               | Kept path; replacement asset is now behind the same config.           |
| `apps/mobile/app/index.tsx`                       | Header showed workspace/status controls but no Folio mark.                                                                         | Added temporary Folio mark beside the Personal workspace chip.        |
| `apps/mobile/src/surfaces/mobileShell.tsx`        | Lock overlay used a standalone serif-like `F` text mark. Bottom nav uses product icons and Melo `M`, not a Folio logo.             | Replaced lock overlay with shared temporary Folio mark.               |
| `apps/mobile/src/surfaces/firstMinuteSurface.tsx` | First-minute top row used text wordmark `Folio` plus Melo `M`; no Folio symbol.                                                    | Added shared temporary Folio mark beside the Folio text.              |
| `apps/mobile/src/surfaces/dataControlSurface.tsx` | Data Control had ownership copy but no Folio symbol.                                                                               | Added shared temporary Folio mark to the ownership panel.             |
| `tooling/scripts/render-mobile-shell-evidence.ts` | Evidence board and phone frames used text-only Folio labels; no mark.                                                              | Added the temporary mark to board header and rendered phone top bars. |

Historical/reference locations intentionally not migrated:

- `docs/v1-donor-audit/**` includes V1 donor brand/icon references and screenshot hashes. These are
  audit history, not live V2 product surfaces.
- `docs/ui-source/**` includes research/mock/prototype HTML and images. These remain reference
  material, not runtime source.
- Prior `docs/release-evidence/**` and `apps/mobile/evidence/**` screenshots may show older UI
  states because they are historical evidence. New evidence for this pass supersedes them.

## What The Mark Should Communicate

- Local ownership: the user's records live with them first.
- Financial clarity: the mark should feel like a record that can be understood.
- Privacy / protected space: a contained shape, not public prestige.
- Time / money movement / future: a money line through the record.
- Review before truth: the record metaphor should imply inspection before commitment.
- Personal calm: no threat, hype or performance signalling.

## What To Avoid

- Serif Forbes-style `F`.
- Bank shield.
- Coin.
- Piggy bank.
- Graph arrow.
- AI sparkle.
- Generic fintech circle.
- Aggressive luxury.
- Childish mascot face.

## Preferred Directions

1. Folded page / folio shape.
2. Folded page + money line.
3. Soft pocket / protected record.
4. Local vault / private folder.
5. Route window / breathing room mark.

## Temporary Mark Chosen

Direction chosen: folded page + money line.

The implemented temporary mark is a simple folded local record with a calm money line running across
it. It is intentionally abstract enough to work small, monochrome and in headers, while still
pointing at Folio's actual product world: reviewed records, local ownership and what happens next.

Implementation:

- Component: `apps/mobile/src/surfaces/brandMark.tsx`
- Splash placeholder: `apps/mobile/assets/splash.png`
- Accessibility label: `Folio temporary brand mark: folded local record with a money line`

## Non-Final Rules

- This mark is a correction and holding shape, not the final logo.
- Do not build a brand system around the old serif `F`.
- Do not interpret the mark as a bank, publisher, luxury finance product or AI mascot.
- Future work may explore a more ownable mark, but it should stay within the local record, route,
  protected-space and calm clarity territory unless the canonical model changes.
