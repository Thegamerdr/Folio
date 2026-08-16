# Phase D.1 accessibility closure

Status: Closed for automated accessibility gates on 2026-07-20.

Scope: Phase D.1 only. No Phase E implementation, no Safe Range redesign, no lowered threshold, no skipped test.

## Root cause

`t.inverse` is literal white (`#FFFFFF`) but was used as a general "filled control text" token across folio screens, folio sheets and pressure-map primitives.

That was unsafe because:

- white on accent fails AA normal text:
  - `#FFFFFF` on light accent `#DC5E33` = `3.69:1`
  - `#FFFFFF` on dark accent `#EE754C` = `2.88:1`
- white on dark-mode `ink` also fails because dark-mode `ink` is a light foreground token:
  - `#FFFFFF` on dark `ink` `#F4EDDF` = `1.16:1`

The fix is the pairing, not the brand accent:

- accent fills use `t.accentInk`
- calmStrong fills use `t.canvas`
- ink / knockout fills use `t.canvas`
- `t.inverse` is no longer allowed as app UI text foreground

## Canonical contrast pairings

| Surface | Background | Foreground | Ratio | Requirement | Status |
|---|---:|---:|---:|---:|---|
| Accent fill, light | `t.calm` / `#DC5E33` | `t.accentInk` / `#1B1815` | `4.79:1` | `4.5:1` | Pass |
| Accent fill, dark | `t.calm` / `#EE754C` | `t.accentInk` / `#1B1815` | `6.13:1` | `4.5:1` | Pass |
| calmStrong fill, light | `t.calmStrong` / `#B84A24` | `t.canvas` / `#F6F4EE` | `4.72:1` | `4.5:1` | Pass |
| calmStrong fill, dark | `t.calmStrong` / `#F79A78` | `t.canvas` / `#1B1613` | `8.41:1` | `4.5:1` | Pass |
| Ink fill, dark | `t.ink` / `#F4EDDF` | `t.canvas` / `#1B1613` | `15.40:1` | `4.5:1` | Pass |
| Accent fill, light before | `t.calm` / `#DC5E33` | `t.inverse` / `#FFFFFF` | `3.69:1` | `4.5:1` | Failed before D.1 |
| Accent fill, dark before | `t.calm` / `#EE754C` | `t.inverse` / `#FFFFFF` | `2.88:1` | `4.5:1` | Failed before D.1 |
| Ink fill, dark before | `t.ink` / `#F4EDDF` | `t.inverse` / `#FFFFFF` | `1.16:1` | `4.5:1` | Failed before D.1 |

## Component evidence table

| Component or screen | Background token/value | Foreground token/value | Dark-mode contrast ratio | Required ratio | Shared source or primitive | Proposed correction |
|---|---|---|---:|---:|---|---|
| AccountScreen accent action labels | `t.calm` / `#EE754C` | before `t.inverse` / `#FFFFFF`; after `t.accentInk` / `#1B1815` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio accent-filled CTA usage | Corrected to `t.accentInk` |
| AddEntryScreen accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio accent-filled CTA usage | Corrected to `t.accentInk` |
| CalendarScreen accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio accent-filled CTA usage | Corrected to `t.accentInk` |
| GuidedCheckInScreen accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio accent-filled CTA usage | Corrected to `t.accentInk` |
| ImageFallbackScreen accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio accent-filled CTA usage | Corrected to `t.accentInk` |
| ImageSuccessScreen accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio accent-filled CTA usage | Corrected to `t.accentInk` |
| PasteSuccessScreen accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio accent-filled CTA usage | Corrected to `t.accentInk` |
| PaydayRitualScreen accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio accent-filled CTA usage | Corrected to `t.accentInk` |
| PdfFallbackScreen accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio accent-filled CTA usage | Corrected to `t.accentInk` |
| PdfSuccessScreen accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio accent-filled CTA usage | Corrected to `t.accentInk` |
| PlansScreen accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio accent-filled CTA usage | Corrected to `t.accentInk` |
| PotsScreen accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio accent-filled CTA usage | Corrected to `t.accentInk` |
| ReviewScreen accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio accent-filled CTA usage | Corrected to `t.accentInk` |
| ShortfallScreen accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio accent-filled CTA usage | Corrected to `t.accentInk` |
| WhatIfScreen accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio accent-filled CTA usage | Corrected to `t.accentInk` |
| AddDebtSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| AddEventSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| AddPlanSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| AffordCheckSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| AnnualCaughtSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| BankConnectionSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| BillCaughtSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| CalendarConnectSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| CalendarExportSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| CloudBackupSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| DriftCaughtSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| EditItemSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| HouseholdSetupSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| IncomeCaughtSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| LogInvoiceSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| LogPaymentSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| LogSpendSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| RouteDetailSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| ShareSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| SheetDayDetail accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| ShelfSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| SignInSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| SubCaughtSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| WorkspaceSheet accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio sheet accent action | Corrected to `t.accentInk` |
| BulkStatementLanding accent action labels | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` | `2.88:1` -> `6.13:1` | `4.5:1` | Folio upload landing action | Corrected to `t.accentInk` |
| AppLockGate unlock button | `t.calmStrong` / `#F79A78` | before `t.inverse`; after `t.canvas` / `#1B1613` | `2.13:1` -> `8.41:1` | `4.5:1` | calmStrong security action | Corrected to `t.canvas` |
| PrivacyScreen export button | `t.calmStrong` / `#F79A78` | before `t.inverse`; after `t.canvas` / `#1B1613` | `2.13:1` -> `8.41:1` | `4.5:1` | calmStrong data-export action | Corrected to `t.canvas` |
| PressureMap kit nav badge | `t.calmStrong` / `#F79A78` | before `t.inverse`; after `t.canvas` / `#1B1613` | `2.13:1` -> `8.41:1` | `4.5:1` | Shared pressure-map kit badge | Corrected to `t.canvas` |
| MoneyPath selected band chip | `t.ink` / `#F4EDDF` | before `t.inverse`; after `t.canvas` / `#1B1613` | `1.16:1` -> `15.40:1` | `4.5:1` | Selected chip on ink | Corrected to `t.canvas` |
| UndoToast snackbar label | `t.ink` / `#F4EDDF` | before `t.inverse`; after `t.canvas` / `#1B1613` | `1.16:1` -> `15.40:1` | `4.5:1` | Ink knockout toast | Corrected to `t.canvas` |
| EditTxnSheet selected category chip | `t.ink` / `#F4EDDF` | before `t.inverse`; after `t.canvas` / `#1B1613` | `1.16:1` -> `15.40:1` | `4.5:1` | Selected chip on ink | Corrected to `t.canvas` |
| InsightsScreen CTA label | `t.ink` / `#F4EDDF` | before `t.inverse`; after `t.canvas` / `#1B1613` | `1.16:1` -> `15.40:1` | `4.5:1` | Ink CTA label | Corrected to `t.canvas` |
| SubscriptionsScreen selected sort chip | `t.ink` / `#F4EDDF` | before `t.inverse`; after `t.canvas` / `#1B1613` | `1.16:1` -> `15.40:1` | `4.5:1` | Selected chip on ink | Corrected to `t.canvas` |
| MeloChatSheet submit arrow | `t.ink` / `#F4EDDF` | before `t.inverse`; after `t.canvas` / `#1B1613` | `1.16:1` -> `15.40:1` | `4.5:1` | Ink circular submit control | Corrected to `t.canvas` |
| MeloChatSheet loading stop icon | `t.calm` / `#EE754C` | before `t.inverse`; after `t.accentInk` / `#1B1815` | `2.88:1` -> `6.13:1` | `3:1` non-text; `4.5:1` if interpreted as text | Icon primitive in accent control | Corrected to `t.accentInk` |

## Screens and surfaces named by the D.1 gate

Validated by source guard and focused tests:

- Primary/secondary CTAs: all previous `t.inverse` CTA labels now use `t.accentInk`, `t.canvas`, or existing `t.ink`/`t.muted` pairings.
- Accent controls: accent-fill labels now use `t.accentInk`; accent identity remains unchanged.
- Selected chips/tabs: selected ink chips now use `t.canvas`.
- Warning/shortfall actions: ShortfallScreen accent labels now use `t.accentInk`; warning text tokens were not changed.
- Today/Safe Range: no Safe Range visual redesign was done; the pressure-map kit guard now prevents reintroducing inverse text.
- Decision History/Receipt: no `t.inverse` text foregrounds were present; status text remains non-colour-only.
- Business surfaces: no failing Business UI inverse foregrounds were found by the D.1 source scan; existing Business primary buttons use semantic canvas-on-ink pairings.
- Disabled states: no disabled opacity model was changed; the base foreground/background pairings now meet the gate before opacity.
- Large text: no fixed-size text redesign was introduced.
- Screen-reader labels: no accessibility labels or user-visible copy were changed.
- Reduced motion: unaffected.

## Enforcement

Updated:

- `apps/mobile/src/surfaces/pressureMap/darkModeFoundation.test.ts`

New guard:

- `t.inverse` is banned as a text foreground in `apps/mobile/src/folio` and `apps/mobile/src/surfaces/pressureMap`.
- The contrast test now asserts:
  - `t.accentInk` on accent passes.
  - `t.canvas` on calmStrong passes.
  - white on accent fails and must not be used.

Current source scan:

- `rg -n "color:\s*t\.inverse" apps/mobile/src/folio apps/mobile/src/surfaces/pressureMap -g "*.tsx" -g "*.ts"`
- Result: no app UI offenders; only the scanner string inside the test remains.

## Automated verification

Passed:

- `pnpm exec vitest run apps/mobile/src/surfaces/pressureMap/darkModeFoundation.test.ts --reporter=dot`
  - 1 file, 9 tests.
- Phase C/D focused regression suite:
  - 12 files, 421 tests.
- `pnpm test -- --reporter=dot`
  - 232 files, 2684 tests.
- `pnpm typecheck`
- `pnpm --filter @folio/mobile build`

## Not done

- No Phase E work.
- No Safe Range screen redesign.
- No global accent identity change.
- No threshold weakening.
- No repo-wide formatting rewrite.
