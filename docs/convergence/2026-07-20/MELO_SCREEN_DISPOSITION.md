# Melo screen disposition

Status: Phase B canonical screen treatment. This does not approve visual parity or start redesign.

Treatment values: Preserve, Correct, Evolve, Redesign, Merge, Remove, Defer.

## Personal screens

| Area | RN screen | Lovable screen | Current role | Target role | Treatment | Engine dependencies | Lovable redesign needed | RN can evolve in place | Migration risk | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | `apps/mobile/src/folio/screens/StartScreen.tsx` | `src/components/folio/screens/ScreenStart.tsx` | Personal first-run doorway. | Start first trustworthy answer journey. | Evolve | Truth facts, onboarding state. | Yes, for unknown/source states. | Yes | Medium | No user sees a decisive answer before minimum source/freshness is known. |
| Guided check-in | `GuidedCheckInScreen.tsx` | `ScreenGuided.tsx` | Rough-number check-in. | Smallest-question flow feeding first answer. | Merge | Account/income fact refs. | Yes | Yes | Medium | User-entered estimates are marked estimated/assumed. |
| Intake | `IntakeScreen.tsx` | `ScreenIntake.tsx` | Add/import entry point. | Data intake with platform-honest capabilities. | Evolve | Review queue, source records, native readers. | Minor | Yes | Medium | Unsupported provider/platform paths fail closed. |
| PDF success | `PdfSuccessScreen.tsx` | `ScreenPdfSuccess.tsx` | Reader success and preview path. | Observed document facts routed to Review. | Merge | Intake, review candidates, evidence storage. | Minor | Yes | Medium | No document candidate affects truth before confirmation. |
| PDF fallback | `PdfFallbackScreen.tsx` | `ScreenPdfFallback.tsx` | Unsupported/unreadable PDF path. | Honest saved/unreadable source state. | Evolve | Evidence storage. | Minor | Yes | Low | Copy states exactly what was and was not read. |
| Image success | `ImageSuccessScreen.tsx` | `ScreenImageSuccess.tsx` | Photo read success. | Observed receipt/photo facts routed to Review. | Merge | Native document reader, review queue. | Minor | Yes | Medium | Photo facts remain observed until confirmed. |
| Image fallback | `ImageFallbackScreen.tsx` | `ScreenImageFallback.tsx` | Unsupported/unreadable image path. | Honest saved/unreadable source state. | Evolve | Evidence storage. | Minor | Yes | Low | No parity claim without native proof. |
| Paste success | `PasteSuccessScreen.tsx` | `ScreenPasteSuccess.tsx` | Text paste success. | Observed text facts routed to Review. | Merge | Import parser, review queue. | Minor | Yes | Low | Pasted values are not truth until confirmed. |
| Visualizer | `VisualizerScreen.tsx` | No exact standalone Lovable peer | One-shot candidate preview. | Review staging/preview adapter. | Merge | Review queue, dedupe, source refs. | Yes, into Review. | Yes | Medium | Accept-all remains explicit and auditable. |
| Review | `ReviewScreen.tsx` | `ScreenReview.tsx` | Confirm imported/caught facts. | Truth gate for observed, contradicted and corrected facts. | Evolve | Truth classes, review queue, corrections. | Yes, for truth classes. | Yes | High | Every candidate has source/freshness and confirm/edit/dismiss path. |
| Timeline | `TimelineScreen.tsx` | `ScreenTimeline.tsx` | Persistent ledger/activity surface. | Activity plus Decision History entry. | Evolve | Ledger, Decision Ledger, source refs. | Yes | Yes | Medium | Timeline distinguishes fact, decision, correction and import source. |
| Today | `TodayScreen.tsx` | `ScreenToday.tsx` | Survival-mode home with money path/Safe Zone. | Trusted Safe Range home. | Redesign/Evolve | TrustedSafeRangeResult, forecast, truth classes. | Yes | Yes | High | Shows range, confidence, freshness, missing info, sources, next move. |
| Today Mode | `TodayModeScreen.tsx` | `ScreenTodayMode.tsx` | Lens-specific hero shell. | Lens framing over same Trusted Safe Range contract. | Merge | Lens, Safe Range result. | Yes | Yes | Medium | Lens copy cannot change source truth. |
| Today Stability | `TodayStabilityScreen.tsx` | `ScreenTodayStability.tsx` | Stability lens home. | Stability framing over same Trusted Safe Range contract. | Merge | Lens, Safe Range result. | Yes | Yes | Medium | Same answer contract as Today. |
| Today After | `TodayAfterScreen.tsx` | `ScreenTodayAfter.tsx` | After-change route view. | Something-changed receipt and recalculation explanation. | Evolve | What Changed, Safe Range result, Decision Ledger. | Yes | Yes | Medium | Shows changed fact and affected answer. |
| Calendar | `CalendarScreen.tsx` | `ScreenCalendar.tsx` | Calendar/commitment view. | Future commitment and forecast explanation. | Evolve | Calendar engine, forecast, truth classes. | Yes | Yes | Medium | Day detail shows source and confidence for each item. |
| What If | `WhatIfScreen.tsx` | `ScreenWhatIf.tsx` | Spend/scenario preview. | Non-mutating decision scenario flow. | Redesign/Evolve | Scenario engine, Safe Range result, Decision Ledger. | Yes | Yes | High | Scenario cannot mutate live facts. |
| Plans | `PlansScreen.tsx` | `ScreenPlans.tsx` | Upcoming plans list. | Plans/scenarios/recovery workbench. | Merge | Plans, scenarios, Decision Ledger. | Yes | Yes | Medium | Plans link to assumptions and outcomes. |
| Shortfall | `ShortfallScreen.tsx` | `ScreenShortfall.tsx` | Shortfall state. | Pressure path with protected essentials and safe options. | Evolve | Safe Range, recovery engine. | Yes | Yes | High | Negative state blocks false reassurance and offers confirmable moves. |
| Recovery | `RecoveryScreen.tsx` | `ScreenRecovery.tsx` | Recovery moves. | Pressure recovery journey. | Evolve | Recovery engine, Decision Ledger, undo. | Yes | Yes | High | No fabricated moves; every move sourced and confirmed. |
| Add Entry | `AddEntryScreen.tsx` | `ScreenAddEntry.tsx` | Add bill/debt form. | Confirmed commitment/debt entry. | Evolve | Truth facts, recurring obligations, debts. | Minor | Yes | Medium | Created facts are user_confirmed with source. |
| Pots | `PotsScreen.tsx` | `ScreenPots.tsx` | Pot goals and borrow/repay. | Protected money and reversible moves. | Evolve | Ledger, pot ledger, Decision Ledger. | Minor | Yes | Medium | Pot money never masquerades as bank balance. |
| Subscriptions | `SubscriptionsScreen.tsx` | `ScreenSubscriptions.tsx` | Recurring charges and pause/cancel. | Recurring commitment management. | Evolve | Recurrence, undo, Decision Ledger. | Minor | Yes | Medium | Pause/cancel is reversible or clearly confirmed. |
| Payday Ritual | `PaydayRitualScreen.tsx` | `ScreenPaydayRitual.tsx` | Cycle/payday ritual. | Cycle close, forecast-vs-actual, assumption correction. | Evolve | Cycle close, forecast error, Decision Ledger. | Yes | Yes | High | Forecast misses become correction opportunities. |
| Insights | `InsightsScreen.tsx` | `ScreenInsights.tsx` | Pattern and lens insight screen. | Pattern explanation only after truth contracts. | Defer/Evolve | Truth classes, what changed. | Yes | Yes | Low | No generic insight without source/cause. |
| Melo | `MeloScreen.tsx` | `ScreenMelo.tsx` | Companion surface. | Truth-aware explainer and confirmable tool launcher. | Evolve | Melo tools, Truth Model, Decision Ledger. | Yes | Yes | High | Melo cannot write without confirm; cannot invent numbers. |
| Melo Memory | `MeloMemoryScreen.tsx` | No Lovable peer | RN memory management. | Trust/Data sub-surface for companion memory. | Evolve | Melo memory, privacy, deletion. | Yes | Yes | Medium | User can see/delete memories and learning permission. |
| Melo Moves | `MeloMovesScreen.tsx` | No Lovable peer | RN move history. | Decision History or Melo sub-surface. | Merge | Decision Ledger, Melo tools. | Yes | Yes | Medium | Moves link to decision records. |
| More | `MoreScreen.tsx` | `ScreenMore.tsx` | Hub. | Trust/Data/Account/secondary surface hub. | Evolve | IA, account, privacy. | Yes | Yes | Medium | No permanent-tab clutter; clear Personal/Business boundary. |
| Privacy | `PrivacyScreen.tsx` | `ScreenPrivacy.tsx` | Privacy/data page. | Trust/Data centre. | Merge | Export/delete/provenance/security. | Yes | Yes | Medium | User can inspect sources, export, delete and recovery state. |
| Paywall | `PaywallScreen.tsx` | `ScreenPaywall.tsx` | Plans/pricing. | Account/subscription surface outside trust answer. | Defer | Billing entitlements. | Yes later | Yes | Low | No paywall blocks core safety/truth obligations before policy approval. |
| Account | `AccountScreen.tsx` | `ScreenAccount.tsx` | Account/settings. | Identity, billing, app settings. | Preserve/Evolve | Auth, billing, app settings. | Minor | Yes | Low | Account does not host financial truth controls unless linked to Trust/Data. |

## Business screens

| Area | RN screen | Lovable screen | Current role | Target role | Treatment | Engine dependencies | Lovable redesign needed | RN can evolve in place | Migration risk | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Business entity setup | `BusinessEntitySetupScreen.tsx` | `BusinessEntitySetup.tsx` | Choose business/entity details. | Business workspace setup. | Preserve/Evolve | Workspace boundary, entity model. | Minor | Yes | Medium | Entity facts never leak into Personal. |
| Business Today | `BusinessTodayScreen.tsx` | No single Lovable file; related Business surfaces | Runway/business home. | Business runway home. | Evolve | Business runway, invoices, filings. | Yes | Yes | High | No silent draft creation; runway sources visible. |
| Business Review | `BusinessReviewScreen.tsx` | `BusinessReviewSurfaces.tsx` | Business review. | Business truth gate. | Evolve | Business review queue, evidence. | Yes | Yes | High | Observed business facts require confirmation. |
| Business Activity | `BusinessReviewScreen.tsx` / operations fragments | `BusinessReviewSurfaces.tsx` | Activity/review overlap. | Business Activity/Review combined. | Merge | Business ledger, Decision Ledger later. | Yes | Yes | Medium | Activity does not mix Personal facts. |
| Business Money | `BusinessOperationsScreen.tsx`, `business/BusinessMoneyScreens.tsx` | `BusinessMoneySurfaces.tsx` | Runway, clients, invoices, obligations. | Business money workbench. | Defer/Evolve | Business workspace engines. | Yes | Yes | High | Explicit actions only; no generated invoice drafts. |
| Business Ltd | `business/BusinessLtdScreens.tsx` | `BusinessLtdSurfaces.tsx` | UK limited company tax/company surfaces. | Business-only compliance workbench. | Defer | CT, dividends, DLA, payroll, Companies House. | Yes | Yes | High | No compliance claim without source/proof. |
| Business Filings | `business/BusinessFilingScreens.tsx` | `BusinessFilingSurfaces.tsx` | Filing working copies. | Business-only filing prep. | Defer | VAT, CT, SA, RTI, confirmation statement. | Yes | Yes | High | Filing states are working copies unless submitted/confirmed. |
| Business Planning | `business/BusinessPlanningScreens.tsx` | No exact Lovable peer | Business calendar/plans. | Business calendar and plan workbench. | Defer/Evolve | Deadline/calendar engines. | Yes | Yes | Medium | Statutory deadlines separated from self reminders. |
| Business Insights | `BusinessOperationsScreen.tsx` route | `BusinessInsightsSurfaces.tsx` | Business insights route. | Business pattern explanation after truth. | Defer | Business truth/runway. | Yes | Yes | Medium | No generic dashboard claims. |
| Business More | `BusinessMoreScreen.tsx` | No exact Lovable peer | Business hub/settings. | Business data/account hub. | Evolve | Workspace/entity/export. | Yes | Yes | Medium | Clearly scoped to active business entity. |
| Business Melo | `BusinessMeloScreen.tsx` | No exact Lovable peer | Business companion. | Business-only explainer. | Defer/Evolve | Business Melo tools, truth classes. | Yes | Yes | High | Cannot read Personal state; cannot write without confirm. |
| Business UI helpers | `business/BusinessUi.tsx`, `useBusinessOperations.ts` | Shared Business Lovable components | Shared screen primitives/hooks. | Business adapters/components. | Preserve/Evolve | Business operations. | No | Yes | Medium | Helper hooks do not mutate on render. |

## Lovable-only and RN-only notes

| File | Status | Treatment | Acceptance criteria |
| --- | --- | --- | --- |
| Lovable `BusinessInsightsSurfaces.tsx` | No dedicated RN screen file; surfaced through business operation routes. | Defer | Do not port until Business truth contracts exist. |
| RN `TimelineScreen.tsx` | RN has a persistent timeline not present in early Personal inventory. | Evolve | Becomes Activity/Decision History entry with truth labels. |
| RN `MeloMemoryScreen.tsx` | RN-only memory management. | Evolve | Must move under Trust/Data/Melo privacy controls. |
| RN `MeloMovesScreen.tsx` | RN-only move history. | Merge | Merge with Decision Ledger once Phase D starts. |
| RN `today/TodayNudges.tsx`, `TodayRecentTxns.tsx`, `TodaySpendStrip.tsx`, `TodayWeekTiles.tsx` | Screen fragments, not standalone screens. | Evolve | Must consume Trusted Safe Range/What Changed outputs through Today adapter. |
| Lovable `today/TodayNudges.tsx`, `TodayRecentTxns.tsx` | Design fragments. | Evolve | Use as design evidence only; not automatic product authority. |

