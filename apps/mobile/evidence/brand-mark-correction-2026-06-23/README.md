# Brand Mark Correction Evidence

Date: 2026-06-23

## What Changed

The live product no longer uses the serif `F` placeholder mark. Folio now uses a temporary folded
local-record mark with a route line in the app header, first-minute surface, Data Control surface,
lock overlay, splash placeholder and static evidence-board renderer.

This is a correction pass, not final brand design.

## Build Evidence

- APK build log: `logs/native-apk-android.log`
- Install log: `logs/adb-install.log`
- Clear-data log: `logs/pm-clear.log`
- Launch log: `logs/launch.log`

Build result: local Android release APK rebuilt successfully with `:app:assembleRelease`.

## Static Evidence Board

The mobile-shell static evidence board was regenerated through an esbuild-bundled render script:

```powershell
$tmp = Join-Path $env:TEMP 'folio-render-mobile-shell-evidence.mjs'
pnpm exec esbuild tooling/scripts/render-mobile-shell-evidence.ts --bundle --platform=node --format=esm --outfile=$tmp
node $tmp
Remove-Item -LiteralPath $tmp -Force
```

Generated board:

- `apps/mobile/evidence/mobile-shell-visual-pass/index.html`
- `apps/mobile/evidence/mobile-shell-visual-pass/manifest.json`
- `apps/mobile/evidence/mobile-shell-visual-pass/pages/*.html`

## Native Screenshot Evidence

| Screenshot                                 | Purpose                                                               |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `screenshots/01-first-minute-new-mark.png` | First Minute with the new Folio mark beside the Folio word.           |
| `screenshots/02-data-control-new-mark.png` | Data Control with the new header mark and ownership-panel mark.       |
| `screenshots/03-today-header-new-mark.png` | Today with the new shared header mark.                                |
| `screenshots/04-melo-header-new-mark.png`  | Melo surface with Melo `M` preserved and Folio mark in shared header. |

Matching UIAutomator XML:

- `xml/01-first-minute-new-mark.xml`
- `xml/02-data-control-new-mark.xml`
- `xml/03-today-header-new-mark.xml`
- `xml/04-melo-header-new-mark.xml`

The XML exposes the accessibility label:

```text
Folio temporary brand mark: folded local record with a route line
```

## Old Mark Guard

Deprecated splash hash:

```text
DA7614F11B6A08D32DD9C1F6918A47F67CD33441F2281722B19FEC50B9160FD3
```

The focused regression test confirms the current splash asset no longer matches this hash and the
old inline lock-overlay `F` pattern is absent from live product surfaces.
