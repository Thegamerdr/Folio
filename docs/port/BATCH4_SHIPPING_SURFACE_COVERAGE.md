# Batch 4 shipping surface coverage

This is the narrow registry closure for the native shell at the Batch 4 start SHA. It classifies
the 54 `ScreenId` entries and 27 non-null `SheetId` entries in
`apps/mobile/src/folio/types.ts` (81 registered shipping surfaces total). The `null` sheet value is
shell state, not a surface, and is intentionally excluded. Screen-owned nested sheets remain
classified with their owning screen; they are not counted a second time.

| Registry | Surface                    | Classification | Native owner                  |
| -------- | -------------------------- | -------------- | ----------------------------- |
| Screen   | `start`                    | ported         | `StartScreen`                 |
| Screen   | `guided`                   | ported         | `GuidedCheckInScreen`         |
| Screen   | `intake`                   | ported         | `IntakeScreen`                |
| Screen   | `pdf-success`              | ported         | `PdfSuccessScreen`            |
| Screen   | `pdf-fallback`             | ported         | `PdfFallbackScreen`           |
| Screen   | `image-success`            | ported         | `ImageSuccessScreen`          |
| Screen   | `image-fallback`           | ported         | `ImageFallbackScreen`         |
| Screen   | `paste-success`            | ported         | `PasteSuccessScreen`          |
| Screen   | `visualizer`               | ported         | `VisualizerScreen`            |
| Screen   | `review`                   | ported         | `ReviewHubScreen`             |
| Screen   | `review-item`              | ported         | `ReviewScreen`                |
| Screen   | `today`                    | ported         | `TodayByMode`                 |
| Screen   | `today-mode`               | ported         | `TodayModeScreen`             |
| Screen   | `today-stability`          | ported         | `TodayStabilityScreen`        |
| Screen   | `today-after`              | ported         | `TodayAfterScreen`            |
| Screen   | `privacy`                  | ported         | `PrivacyScreen`               |
| Screen   | `melo`                     | ported         | `MeloScreen`                  |
| Screen   | `more`                     | ported         | `MoreScreen`                  |
| Screen   | `timeline`                 | ported         | `TimelineScreen`              |
| Screen   | `calendar`                 | ported         | `CalendarScreen`              |
| Screen   | `plan`                     | ported         | `PlanScreen`                  |
| Screen   | `plans`                    | ported         | `PlansScreen`                 |
| Screen   | `paywall`                  | ported         | `PaywallScreen`               |
| Screen   | `whatif`                   | ported         | `WhatIfScreen`                |
| Screen   | `recovery`                 | ported         | `RecoveryScreen`              |
| Screen   | `add-bill`                 | ported         | `AddEntryScreen(kind="bill")` |
| Screen   | `add-debt`                 | ported         | `AddEntryScreen(kind="debt")` |
| Screen   | `subs`                     | ported         | `SubscriptionsScreen`         |
| Screen   | `pots`                     | ported         | `PotsScreen`                  |
| Screen   | `ritual`                   | ported         | `PaydayRitualScreen`          |
| Screen   | `insights`                 | ported         | `InsightsScreen`              |
| Screen   | `shortfall`                | ported         | `ShortfallScreen`             |
| Screen   | `account`                  | ported         | `AccountScreen`               |
| Screen   | `connections`              | ported         | `ConnectionsScreen`           |
| Screen   | `business-entity-setup`    | ported         | `BusinessEntitySetupScreen`   |
| Screen   | `business-runway`          | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-clients`         | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-invoices`        | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-obligations`     | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-vat`             | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-corp-tax`        | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-payroll`         | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-dividends`       | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-dla`             | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-companies-house` | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-filings`         | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-filing-vat`      | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-filing-sa`       | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-filing-ct`       | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-filing-cs`       | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-filing-accounts` | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-filing-payroll`  | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-insights`        | ported         | `BusinessOperationsScreen`    |
| Screen   | `business-deductions`      | ported         | `BusinessOperationsScreen`    |
| Sheet    | `route-detail`             | ported         | `RouteDetailSheet`            |
| Sheet    | `edit-txn`                 | ported         | `EditTxnSheet`                |
| Sheet    | `appearance`               | ported         | `AppearanceSheet`             |
| Sheet    | `melo-chat`                | ported         | `MeloChatSheet`               |
| Sheet    | `share`                    | ported         | `ShareSheet`                  |
| Sheet    | `onboarding`               | ported         | `OnboardingSheet`             |
| Sheet    | `log-spend`                | ported         | `LogSpendSheet`               |
| Sheet    | `log-invoice`              | ported         | `LogInvoiceSheet`             |
| Sheet    | `log-payment`              | ported         | `LogPaymentSheet`             |
| Sheet    | `add-plan`                 | ported         | `AddPlanSheet`                |
| Sheet    | `declare-debt`             | ported         | `AddDebtSheet`                |
| Sheet    | `household-setup`          | ported         | `HouseholdSetupSheet`         |
| Sheet    | `sub-caught`               | ported         | `SubCaughtSheet`              |
| Sheet    | `income-caught`            | ported         | `IncomeCaughtSheet`           |
| Sheet    | `bill-caught`              | ported         | `BillCaughtSheet`             |
| Sheet    | `drift-caught`             | ported         | `DriftCaughtSheet`            |
| Sheet    | `annual-caught`            | ported         | `AnnualCaughtSheet`           |
| Sheet    | `add-event`                | ported         | `AddEventSheet`               |
| Sheet    | `calendar-export`          | ported         | `CalendarExportSheet`         |
| Sheet    | `calendar-connect`         | ported         | `CalendarConnectSheet`        |
| Sheet    | `safe-zone`                | ported         | `SafeZoneSheet`               |
| Sheet    | `shelf`                    | ported         | `ShelfSheet`                  |
| Sheet    | `afford-check`             | ported         | `AffordCheckSheet`            |
| Sheet    | `lens-picker`              | ported         | `LensPickerSheet`             |
| Sheet    | `chart-style`              | ported         | `ChartStyleSheet`             |
| Sheet    | `hidden-review`            | ported         | `HiddenReviewSheet`           |
| Sheet    | `day-detail`               | ported         | `SheetDayDetail`              |

Coverage count: 54 screens + 27 sheets = 81 registered surfaces; 81 ported, 0 intentionally
native-only, 0 deprecated/not shipping in the active registry, 0 open. The previous candidate
`EditItemSheet` pathway is deliberately outside the active registry: Review detail's inline draft
fields are the sole pre-truth candidate correction owner; Shortfall now routes to Subscriptions.
