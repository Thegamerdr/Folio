# Melo information architecture

Status: Phase B canonical IA target for Trusted Core planning. This is not a command to implement navigation changes yet.

## Melo Personal

Keep navigation minimal. Conceptual surfaces do not all need permanent tabs.

| Area | Final role | Current RN evidence | Target treatment |
| --- | --- | --- | --- |
| Today | Primary answer surface: Safe Range, what changed, next reversible move. | `TodayScreen.tsx`, `TodayAfterScreen.tsx`, `TodayModeScreen.tsx`, `TodayStabilityScreen.tsx`, `MoneyPath.tsx` | Evolve into Trusted Safe Range home. |
| Calendar | Commitment/future explanation surface, not a generic calendar clone. | `CalendarScreen.tsx`, `CalendarExportSheet.tsx`, `apps/mobile/src/local/calendarIcs.ts` | Preserve/evolve with source and confidence states. |
| Review/Activity | Gate where observed facts become truth; timeline can show history after truth. | `ReviewScreen.tsx`, `EditTxnSheet.tsx`, Timeline references in shell/store | Preserve as trust-critical; consolidate Review + Activity semantics. |
| Plans/scenarios | Decision exploration before action. | `WhatIfScreen.tsx`, `PlansScreen.tsx`, `RecoveryScreen.tsx` | Consolidate under "Plans" or contextual entry points. |
| Melo | Explainer and bounded tool proposer. | `MeloScreen.tsx`, `MeloChatSheet.tsx`, `apps/mobile/src/local/localMeloTurn.ts` | Preserve with stronger truth/source boundaries. |
| Data/trust/account | Source, export, privacy, account, billing, app lock. | `AccountScreen.tsx`, `PrivacyScreen.tsx`, `MoreScreen.tsx`, `AppLockGate.tsx` | Consolidate into Trust/Data/Account hierarchy. |
| Decision history | Accountability surface. | Not complete; audit/history fragments in store/export. | Add as Trusted Core foundation, not permanent tab initially. |
| Insights | Explanation of patterns and changes. | `InsightsScreen.tsx` | Defer or merge into Today/Decision History until truth model exists. |
| Debt/recurring commitments | Inputs and focused management surfaces. | `SubscriptionsScreen.tsx`, `PotsScreen.tsx`, debt engine tests, AddDebtSheet | Preserve as data/decision surfaces, not top-level clutter. |

## Proposed Personal hierarchy

```text
Personal
  Today
    Trusted Safe Range
    What changed
    Next move
    Source drawer
  Calendar
    Commitments
    Forecast path
    Day detail
  Review
    Found items
    Conflicts
    Corrections
    Activity after confirmation
  Plans
    What If
    Recovery
    Payday ritual
    Decision receipts
  Melo
    Ask/explain
    Confirmable tools
  Trust & Data
    Sources
    Privacy
    Export/restore
    Security
    Account/subscription
```

## Final Personal surface roles

| Surface | Final role | Permanent nav? | Phase B treatment |
| --- | --- | --- | --- |
| Today | Primary answer: Trusted Safe Range, what changed, source/freshness/uncertainty, one next move. | Yes | Evolve in place in Phase C. |
| Calendar | Future commitments and forecast explanation. | Yes or contextual from Today; final tab count decided in Phase E. | Evolve. |
| Review | Gate for observed facts, conflicts, corrections and activity requiring confirmation. | Yes as Review/Activity. | Preserve and evolve. |
| Plans | Scenario, recovery, payday and saved decision workbench. | Contextual or More-level, not necessarily permanent tab. | Merge WhatIf/Recovery/Payday entry points under one conceptual area. |
| Melo | Explain, ask for missing information, propose confirmable tools. | Yes as companion entry. | Preserve and constrain to truth contracts. |
| Decision History | Receipts for material decisions and forecast outcomes. | No permanent tab initially. | Add as Trust/Data or Review sub-surface in Phase D. |
| Trust/Data | Sources, provenance, export, restore, delete, privacy, permissions. | More-level hub. | Consolidate Privacy, source, and data controls. |
| Account | Identity, billing, subscription, app settings. | Under Trust/Data or More. | Preserve; keep separate from financial truth controls. |

## Melo Business

Business is separate. It shares infrastructure but must not distort Personal Trusted Core.

| Area | Role | Current RN evidence | Target treatment |
| --- | --- | --- | --- |
| Business Today | Runway and urgent business state. | `BusinessTodayScreen.tsx` | Preserve after silent recurring invoice containment; redesign later around runway truth. |
| Activity | Business transaction/activity trail. | Business screen set and store slices | Consolidate with Review/Operations. |
| Review | Confirm business observed facts. | `BusinessReviewScreen.tsx` | Preserve; ensure no Personal leakage. |
| Calendar | Statutory and cashflow obligations. | Business filing/calendar code in business screens/packages | Evolve separately. |
| Runway | Primary business answer. | `BusinessOperationsScreen.tsx`, `packages/business-workspace` | Preserve as Business-specific counterpart, not Personal Safe Range. |
| Clients/invoices | Business receivables workflow. | Operations package/screen code | Defer from Personal Trusted Core. |
| Obligations/filings | VAT, CT, SA, confirmation statement, RTI, MTD ITSA. | `BusinessFilingScreens.tsx`, `BusinessLtdScreens.tsx`, business packages | Defer; keep Business lane. |
| Business Melo | Business explainer. | `BusinessMeloScreen.tsx` | Separate context and memory. |
| Business data/account | Entity setup, export, business settings. | `BusinessEntitySetupScreen.tsx`, `BusinessMoreScreen.tsx` | Separate workspace/account. |

## Final Business surface roles

| Surface | Final role | Permanent nav? | Phase B treatment |
| --- | --- | --- | --- |
| Business Today | Runway, urgent filing/receivable state, business next move. | Yes in Business workspace. | Preserve after containment; later redesign around business truth. |
| Activity | Business ledger/recent actions. | Yes or Review-adjacent. | Consolidate with Business Review. |
| Review | Confirm observed business facts before they affect runway/filings. | Yes. | Preserve and evolve separately. |
| Calendar | Statutory deadlines and business cashflow dates. | Yes or contextual. | Evolve separately. |
| Runway | Business counterpart to Personal safety answer. | Yes as Today/Runway core. | Keep Business-only. |
| Clients/invoices | Receivables and CRM-lite workflows. | Workbench surface, not Personal. | Defer from Personal Trusted Core. |
| Obligations/filings | VAT, CT, SA, payroll, Companies House, MTD ITSA. | Workbench surface. | Defer until specialist proof. |
| Business Melo | Explain business state and propose confirmable business tools. | Companion entry. | Keep separate memory/context. |
| Business data/account | Entity, export, tax settings, permissions. | More-level. | Preserve boundary. |

## Workspace switching

- Switcher must make context explicit.
- Personal and `business.<entityId>` facts, stage, streak, review candidates, and decision records are isolated.
- Shared identity and design do not imply shared financial state.
- Business cannot read Personal Safe Range; Personal cannot read business runway.

## Shared foundation

| Foundation | Shared? | Boundary |
| --- | --- | --- |
| Identity/brand | Yes | Same Melo/Phoenix identity, different product context. |
| Trust Centre | Yes | Workspace-specific data views. |
| Permissions | Yes | Permission grants shown per data source/workspace. |
| Truth Model | Yes | Same vocabulary, different engines. |
| Decision Ledger | Yes | Same schema, separate workspace records. |
| Evidence storage | Yes | Source refs never cross workspaces. |
| Export | Yes | Export by workspace and all-data export with clear labels. |
| Security | Yes | Local-first encryption, app lock, deletion. |
| Sync | Later | Must preserve workspace isolation. |
| AI policy | Yes | Same confirmation and non-calculation boundary. |
| Design system | Yes | Tokens, accessibility, motion; no screen parity assumption. |
