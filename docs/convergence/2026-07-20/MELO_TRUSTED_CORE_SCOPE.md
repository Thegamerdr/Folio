# Trusted Core scope

Status: proposed shippable scope. Anything marked out is not rejected forever; it is outside the next trustworthy product slice.

## In scope

| Item | Why included | Current evidence |
| --- | --- | --- |
| Manual-first onboarding | Gives first answer without provider dependency. | `StartScreen.tsx`, `OnboardingSheet.tsx`, `IntakeScreen.tsx` |
| Accounts/current position | Required for any safe answer. | `store.ts`, `AccountScreen.tsx` |
| Income/payday | Drives horizon and cycle close. | `PaydayRitualScreen.tsx`, finance/store code |
| Bills and recurring commitments | Defines committed floor. | Bill/sub sheets, `SubscriptionsScreen.tsx` |
| Debts | Material obligation and pressure input. | Debt sheet/tests |
| Calendar | Makes future cashflow legible. | `CalendarScreen.tsx` |
| Review-before-truth | Prevents observed facts becoming settled facts silently. | `ReviewScreen.tsx`, `EditTxnSheet.tsx` |
| Trusted Safe Range | Core product answer. | New contract in this packet |
| What Changed | Explains causal movement in answer. | `WhatChangedRow.tsx`, Today/Review foundations |
| Scenarios | Enables decisions without mutation. | `WhatIfScreen.tsx`, `PlansScreen.tsx` |
| Recovery | Handles pressure safely. | `RecoveryScreen.tsx`, `ShortfallScreen.tsx` |
| Payday ritual | Closes loop and improves assumptions. | `PaydayRitualScreen.tsx` |
| Correction/provenance | Trust and user agency. | Review/edit/source paths |
| Export and restore | Data ownership. | `export.ts`, `exportNative.ts`, persistence |
| Local-first security | Trust requirement. | App lock/storage/privacy docs |
| Deterministic Melo explanation/tools | Differentiation without unsafe AI writes. | `MeloChatSheet.tsx`, `localMeloTurn.ts`, `toolContract.ts` |
| Decision Ledger foundation | Accountability and moat. | New ledger contract |
| Forecast-vs-actual foundation | Calibration and honesty. | Payday/cycle foundations |
| Android production path | Existing proof path. | Android artifacts and release docs |

## Out of Trusted Core for now

| Item | Decision | Reason |
| --- | --- | --- |
| Open Banking | Out as default, optional gated | No production provider/callback proof in current evidence. |
| Cloud sync | Out | Security/trust model not proven. |
| iOS | Out | User said iOS will be created later; Android path first. |
| Business | Out of Personal core | Separate product experience; can share infrastructure. |
| AI semantic reasoning | Out | Deterministic truth first; AI may explain only. |
| Human escalation | Out | Requires operational model. |
| Shared households/partner mode | Out | Privacy/consent complexity. |
| Tax tools | Out | Business-specific and compliance-heavy. |
| Widgets | Out | Must wait for Trusted Safe Range. |
| Cosmetics/mascot expansion | Out | Not trust-critical. |
| Voice | Out | Device-only backlog later. |
| Filing integrations | Out | Business product and regulatory proof. |

## Visible mock rule

Do not call a feature Trusted Core if it is a visible mock, requires unavailable credentials, relies on sample data, or has no tested source/freshness story.

