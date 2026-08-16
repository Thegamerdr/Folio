# Melo dark-mode contrast evidence

Status: Phase D.1 evidence captured on 2026-07-20.

## Tokens checked

| Token | Light value | Dark value | Role |
|---|---:|---:|---|
| `t.canvas` | `#F6F4EE` | `#1B1613` | App background / on-ink foreground |
| `t.ink` | `#1B1815` | `#F4EDDF` | Primary text / ink-fill background |
| `t.calm` | `#DC5E33` | `#EE754C` | Melo accent fill |
| `t.calmStrong` | `#B84A24` | `#F79A78` | Strong accent fill |
| `t.accentInk` | `#1B1815` | `#1B1815` | Text/icon foreground on accent |
| `t.inverse` | `#FFFFFF` | `#FFFFFF` | Literal white; not valid as generic UI text |

## Required pairings

| Pairing | Light ratio | Dark ratio | Required | Result |
|---|---:|---:|---:|---|
| `t.accentInk` on `t.calm` | `4.79:1` | `6.13:1` | `4.5:1` | Pass |
| `t.canvas` on `t.calmStrong` | `4.72:1` | `8.41:1` | `4.5:1` | Pass |
| `t.canvas` on `t.ink` | `16.07:1` | `15.40:1` | `4.5:1` | Pass |
| `t.ink` on `t.canvas` | `16.07:1` | `15.40:1` | `7:1` | Pass |

## Banned pairings proven unsafe

| Pairing | Light ratio | Dark ratio | Required | Result |
|---|---:|---:|---:|---|
| `t.inverse` on `t.calm` | `3.69:1` | `2.88:1` | `4.5:1` | Fail |
| `t.inverse` on `t.calmStrong` | `4.46:1` | `2.13:1` | `4.5:1` | Fail in dark mode |
| `t.inverse` on `t.ink` | `18.37:1` | `1.16:1` | `4.5:1` | Fail in dark mode |

## Gate coverage

The D.1 gate covers source-level regressions, not screenshots:

- scans folio screens, folio sheets, folio UI and pressure-map surfaces
- fails if any app UI text style uses `color: t.inverse`
- verifies safe semantic pair ratios
- verifies white-on-accent remains below AA normal text, so future use cannot be treated as acceptable

Command:

```powershell
pnpm exec vitest run apps/mobile/src/surfaces/pressureMap/darkModeFoundation.test.ts --reporter=dot
```

Result:

- Passed.
- 1 file.
- 9 tests.

## Lovable parity note

The RN fix intentionally follows the frozen accessibility decision: accent remains the brand accent, but white/paper text on accent is not valid for normal-size UI text.

If Lovable still contains `text-white` / `text-paper` on the Melo accent, the parity correction belongs at the Lovable token/component pairing level, not by weakening RN contrast.
