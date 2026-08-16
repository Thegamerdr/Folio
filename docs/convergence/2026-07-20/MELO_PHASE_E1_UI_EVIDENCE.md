# Phase E.1 UI evidence map

This file maps user-visible Phase E.1 surfaces to files. Android screenshots/logs are tracked separately in `MELO_PHASE_E1_ANDROID_EVIDENCE.md`.

| Surface                           | File                                                                                                          | Evidence status                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| FirstAnswerFlow                   | `apps/mobile/src/folio/screens/FirstAnswerScreen.tsx`                                                         | Implemented; reachable from Start, Today, More                   |
| SafeRangeBeforeAfter              | `apps/mobile/src/folio/ui/TrustedCoreSurfaces.tsx`                                                            | Implemented; used by material changes, recovery, corrections     |
| DecisionComparison                | `apps/mobile/src/folio/ui/TrustedCoreSurfaces.tsx`, `apps/mobile/src/folio/screens/WhatIfScreen.tsx`          | Implemented                                                      |
| DecisionReceipt                   | `apps/mobile/src/folio/ui/TrustedCoreSurfaces.tsx`, `apps/mobile/src/folio/screens/DecisionHistoryScreen.tsx` | Implemented                                                      |
| RecoveryBundlePreview             | `apps/mobile/src/folio/ui/TrustedCoreSurfaces.tsx`, `apps/mobile/src/folio/screens/RecoveryScreen.tsx`        | Implemented                                                      |
| ForecastAccountabilitySummary     | `apps/mobile/src/folio/ui/TrustedCoreSurfaces.tsx`, `apps/mobile/src/folio/screens/PaydayRitualScreen.tsx`    | Implemented                                                      |
| CorrectionImpactSheet             | `apps/mobile/src/folio/ui/TrustedCoreSurfaces.tsx`, `apps/mobile/src/folio/screens/DecisionHistoryScreen.tsx` | Implemented                                                      |
| What Changed material change card | `apps/mobile/src/folio/screens/TimelineScreen.tsx`                                                            | Implemented                                                      |
| Truth/source/unknowns surfaces    | `apps/mobile/src/folio/ui/TrustedCoreSurfaces.tsx`                                                            | Implemented as embedded reusable surfaces, not standalone sheets |

## Visual principles checked in implementation

- Financial information appears before Melo explanatory copy.
- Melo remains optional/secondary on Trusted Core surfaces.
- No colour-only meaning is used for status.
- Tap targets use the existing app button/card primitives.
- Surfaces render without animation-specific dependency.
