# Forecast accountability UI

Surface: `apps/mobile/src/folio/screens/PaydayRitualScreen.tsx`

Shared surface: `ForecastAccountabilitySummary` in `apps/mobile/src/folio/ui/TrustedCoreSurfaces.tsx`

Engine seam: `evaluatePaydayForecastAccountability` in `apps/mobile/src/folio/lib/criticalJourneys.ts`

## Presentation

| Required item                   | Status                                                               |
| ------------------------------- | -------------------------------------------------------------------- |
| Forecast shown at cycle start   | Rendered from Trusted Safe Range snapshot                            |
| Actual closing outcome          | Rendered from cycle actuals/spare input                              |
| Inside expected range           | Rendered as evaluation state                                         |
| Conservative boundary breached  | Rendered separately from range fit                                   |
| Confidence at the time          | Rendered                                                             |
| Main source of forecast error   | Rendered                                                             |
| Missing/stale information       | Rendered                                                             |
| Corrections made                | Rendered when present                                                |
| What Melo changes going forward | Only shown as permissioned next assumptions; no silent cash movement |
| No universal score              | Preserved                                                            |

## Decision Ledger rule

Cycle-close receipts remain preserved through the Payday Ritual decision path. Forecast accountability is explanatory and does not replace the receipt.
