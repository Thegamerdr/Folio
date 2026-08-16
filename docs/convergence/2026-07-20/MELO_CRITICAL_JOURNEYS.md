# Melo critical journeys

Status: target journeys. Screens should be redesigned only in service of these journeys.

## Journey A: First trustworthy answer

| Part | Target |
| --- | --- |
| Entry points | Start/onboarding, Today empty state, Add Entry, Import/Intake. |
| Screens/sheets | `StartScreen.tsx`, `OnboardingSheet.tsx`, `IntakeScreen.tsx`, `TodayScreen.tsx`, `ReviewScreen.tsx`, Lovable Start/Today. |
| States | No data, partial quick estimate, missing payday, missing commitments, provisional Safe Range, confirmed Safe Range. |
| Engine reads/writes | Write only user-confirmed account/income/commitment facts; compute Safe Range deterministically. |
| Confirmations | Current position, payday/income, commitments, import candidates. |
| Error recovery | If missing or stale, show useful provisional answer plus smallest next question. |
| Accessibility | Plain text answer, source labels, keyboard-safe forms, 44px controls. |
| Melo behaviour | Calmly explain unknowns; never pretend the answer is final. |
| Notifications | None before user grants permission. |
| Exit state | User has a provisional or reliable Safe Range with visible sources. |
| Acceptance tests | Missing account blocks reliance; confirmed quick estimate produces provisional answer; source drawer lists inputs. |

## Journey B: Something changed

| Part | Target |
| --- | --- |
| Entry points | Import, manual edit, provider refresh, bill/sub change, payday arrival. |
| Screens/sheets | Today, Calendar, Review, Timeline/Activity, EditTxnSheet, WhatChangedRow. |
| States | New fact observed, review pending, confirmed change, contradiction, stale provider. |
| Engine reads/writes | Recompute affected Safe Range and forecast version after confirmed change. |
| Confirmations | Required before observed facts become truth. |
| Error recovery | Conflict routes to Review; stale route offers manual confirmation. |
| Melo behaviour | Explain cause and effect: what changed, why, and confidence impact. |
| Exit state | User can see revised answer and the source that caused it. |
| Acceptance tests | Import candidate cannot affect committed floor before confirm; corrected fact updates affected answers. |

## Journey C: A financial decision

| Part | Target |
| --- | --- |
| Entry points | What If, Today CTA, Calendar day, Melo question, Recovery option. |
| Screens/sheets | `WhatIfScreen.tsx`, `PlansScreen.tsx`, `RecoveryScreen.tsx`, `MeloChatSheet.tsx`, future Decision Receipt. |
| States | Question, assumptions, scenario A/B, comparison, choice, saved/deferred, outcome follow-up. |
| Engine reads/writes | Scenario engine reads facts and assumptions; writes only saved decision and explicit confirmed action. |
| Confirmations | Required for bill moves, pot borrow, subscription pause/cancel, accepted recovery move. |
| Error recovery | Low confidence explains what is missing; no action if contradiction exists. |
| Melo behaviour | Translate assumptions and compare, not calculate from scratch. |
| Exit state | Decision receipt with facts, assumptions, forecast version, chosen move. |
| Acceptance tests | Scenario does not mutate live ledger; decision record references forecast version. |

## Journey D: Financial pressure

| Part | Target |
| --- | --- |
| Entry points | Safe Range below zero, shortfall date, debt pressure, overdue commitment. |
| Screens/sheets | `ShortfallScreen.tsx`, `RecoveryScreen.tsx`, `PotsScreen.tsx`, `SubscriptionsScreen.tsx`, Calendar. |
| States | Pressure detected, essentials protected, options ranked, confirmable move, follow-up. |
| Engine reads/writes | Recovery engine calculates options; store writes only confirmed reversible moves. |
| Confirmations | Always for material moves. |
| Error recovery | If no safe move, say so and show missing info/human next step without shame. |
| Melo behaviour | Low-cognitive-load copy; no scolding, no fake certainty. |
| Exit state | User has one safe option, a saved plan, or a clear blocked explanation. |
| Acceptance tests | Negative path shows protected commitments and confirm gate. |

## Journey E: Payday and cycle close

| Part | Target |
| --- | --- |
| Entry points | Income detected/confirmed, payday ritual, app foreground near payday. |
| Screens/sheets | `PaydayRitualScreen.tsx`, Today, Calendar, Review. |
| States | Income arrived, commitments protected, forecast vs actual, assumption correction, next cycle. |
| Engine reads/writes | Cycle close writes confirmed outcomes and forecast error; ritual writes only chosen actions. |
| Confirmations | Protect/move/repay actions require user confirmation. |
| Error recovery | If income amount differs, ask to confirm and recalc. |
| Melo behaviour | Acknowledge misses and uncertainty without blame. |
| Exit state | Next cycle has updated assumptions and source freshness. |
| Acceptance tests | Forecast miss creates correction opportunity, not silent drift. |

## Journey F: Correction

| Part | Target |
| --- | --- |
| Entry points | User taps source, challenges Melo, edit sheet, Review conflict. |
| Screens/sheets | Source drawer, `EditTxnSheet.tsx`, Review, Account/Data. |
| States | Source shown, before/after edit, affected answers preview, confirm, recompute. |
| Engine reads/writes | Correction writes new fact version; affected forecasts and decisions marked superseded/recomputed. |
| Confirmations | Required for every correction that changes material state. |
| Error recovery | Undo where reversible; otherwise preserve audit and create opposite correction. |
| Melo behaviour | "You were right to check"; no defensive copy. |
| Exit state | Corrected source and affected answers visible. |
| Acceptance tests | Correction record links prior fact and recomputed Safe Range. |

## Journey G: Data outage

| Part | Target |
| --- | --- |
| Entry points | Provider stale, callback failure, identity config missing, import failure. |
| Screens/sheets | BankConnectionSheet, Intake, Today, Trust/Data. |
| States | Provider unavailable, stale, manual recovery, restored, reconciliation review. |
| Engine reads/writes | Stale provider downgrades confidence; manual facts require confirmation. |
| Confirmations | Manual replacement/refresh confirmation. |
| Error recovery | Fail closed; do not show unavailable provider as live. |
| Melo behaviour | Explain affected answers, not generic outage copy. |
| Exit state | User sees which answers are provisional until data is restored. |
| Acceptance tests | Missing Open Banking URL returns service_not_configured; stale source downgrades reliance. |

