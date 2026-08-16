# Melo convergence matrix

Status: working treatment table for Trusted Core. Classifications are not implementation commits.

Legend: Preserve = keep as-is for now; Correct = fix harm/drift; Evolve = keep foundation and improve; Redesign = replace experience against journey spec; Consolidate = merge duplicate concepts; Remove = delete after migration; Defer = keep out of Trusted Core; Unknown = insufficient evidence.

## Product surfaces

| Element | Current implementation | Design intent | Audit recommendation | Treatment | Reason | Dependencies | Risk changing | Risk leaving |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Onboarding/Start | `StartScreen.tsx`, `OnboardingSheet.tsx`, `IntakeScreen.tsx` | Lovable first-run and calm entry | First answer must be trustworthy fast | Redesign | Needs first trustworthy answer journey, not generic setup | Truth Model, Safe Range | User may lose current familiar path | Continued weak first value |
| Today | `TodayScreen.tsx`, Today variants, `MoneyPath.tsx` | Design hero answer and calm money path | Core surface but too single-number oriented | Evolve | Best foundation for Trusted Safe Range | Safe Range contract | Breaks primary route | Overconfident/unclear answer |
| Safe Zone | Current safe/tightest path concepts in store/screens/widget | Lovable safe/today framing | Replace with Trusted Safe Range | Redesign | Needs range, sources, freshness, uncertainty | Truth Model, forecast version | Engine churn | False certainty |
| Calendar | `CalendarScreen.tsx`, `SheetDayDetail.tsx`, `calendarIcs.ts` | Future commitments | Keep as explanation surface | Evolve | Useful when linked to sources and forecasts | Calendar derivation owner | Route regressions | Hidden future risk |
| Review | `ReviewScreen.tsx`, `EditTxnSheet.tsx` | Review-before-truth | Trust-critical | Preserve/Evolve | Already enforces confirmation pattern | Truth classes | Import friction | Observed facts may remain ambiguous |
| Timeline/Activity | Timeline references in shell/store; Business activity partial | History/what changed | Consolidate with Review/Decision history | Consolidate | Avoid duplicate "past" concepts | IA, ledger | User loses trail if hidden too soon | Fragmented evidence |
| Accounts | `AccountScreen.tsx`, account model in `store.ts` | Data/account control | Source and freshness needed | Evolve | Current position is core input | Provenance | Balance migration risk | Stale/sourceless answers |
| Bills | Add/edit/event/bill sheets, recurring logic | Recurring commitments | Core input | Evolve | Needs truth/freshness and review | Recurrence engine | Commitment regressions | Unsafe floor |
| Income | Add entry/income caught/payday ritual | Payday/cycle | Core input | Evolve | Income drives horizon | Cycle engine | Bad payday assumptions | Bad Safe Range |
| Debts | `AddDebtSheet.tsx`, debt engine test, debt schedule sheet | Pressure + obligations | Include as core commitment | Evolve | Debt changes safety | Debt truth model | Mis-model debt | Understates obligations |
| Subscriptions | `SubscriptionsScreen.tsx`, sub caught sheet | Recurring spend and reversible actions | Useful pressure lever | Evolve | Pause/cancel can be reversible move | Undo/ledger | UX churn | Missed recurring pressure |
| Pots | `PotsScreen.tsx`, pot borrow/repay logic | Protect money | Core but must not fake bank money | Evolve | Good commitment/protection metaphor | Ledger/provenance | Pot semantics confusion | Unsafe "available" |
| What If | `WhatIfScreen.tsx`, `PlansScreen.tsx` | Scenario exploration | Decision journey | Redesign/Evolve | Must not mutate facts | Scenario contract | Scenario regression | Planning remains toy |
| Recovery | `RecoveryScreen.tsx`, `ShortfallScreen.tsx` | Pressure relief | Keep but source every option | Evolve | High-value journey | Safe Range, ledger | Missed pressure route | Shame/fake options |
| Payday Ritual | `PaydayRitualScreen.tsx` | Cycle close/rebirth | Include with forecast-vs-actual | Evolve | Corrects assumptions | Cycle close | Ritual overreach | Assumptions never improve |
| Insights | `InsightsScreen.tsx` | Pattern explanation | Defer unless tied to truth | Defer/Evolve | Insights without provenance are decorative | Truth Model | Loss of nice surface | Generic dashboard drift |
| Melo Personal | `MeloScreen.tsx`, `MeloChatSheet.tsx`, local Melo files | Companion | Keep bounded | Evolve | Strong differentiator if trustworthy | Tool boundary, truth | Overcorrect companion | Generic/unsafe AI |
| Trust/privacy/data | `PrivacyScreen.tsx`, `MoreScreen.tsx`, release-store docs | Trust centre | Central to company moat | Evolve | Needs source, export, delete clarity | Security/export | More IA complexity | Trust gap |
| Export/restore | `export.ts`, `exportNative.ts` | User ownership | Core | Correct/Evolve | Plaintext retention contained; restore proof still needed | Storage | Export bugs | Data ownership gap |
| Notifications | Partial/native future | Timely support | Defer | Not core until answers reliable | Safe Range | Missing timely nudge | Notification spam risk if rushed |
| Account/subscription | Paywall/billing files | Paid tiers | Defer product changes | Scope/pricing not Trusted Core | Product approval | Revenue path delay | Monetisation drift |
| Personal/Business switching | Workspace control/store slices | Separate contexts | Keep explicit boundary | Evolve | Must prevent cross-workspace leakage | Workspace truth | Switcher regressions | Mixed financial truth |

## Business surfaces

| Element | Current implementation | Design intent | Audit recommendation | Treatment | Reason | Dependencies | Risk changing | Risk leaving |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Business Today | `BusinessTodayScreen.tsx` | Business runway home | Separate product | Correct/Evolve | Silent recurring invoice mutation contained | Business truth | Business regressions | False business state |
| Business Review | `BusinessReviewScreen.tsx` | Confirm business facts | Preserve separate | Evolve | Same review principle | Business provenance | Confirmation friction | Unconfirmed facts |
| Business Activity | Business operations/review fragments | Trail | Consolidate later | Defer | Not Personal core | Business IA | Hidden activity | Fragmentation |
| Runway | Business operations/package logic | Business safety answer | Keep Business-only | Evolve later | Not Personal Safe Range | Business truth | Wrong business answer | Distorts Personal if mixed |
| Clients | Operations package/screen evidence | Client CRM | Defer | Separate product | Business scope | CRM gap | Bloat in Personal |
| Invoices | Business operations, recurring engine retained | Receivables | Correct/defer | No silent drafts; later explicit invoice flow | Business review | Revenue-flow regression | False drafts |
| Obligations | Business filing/ltd screens | Statutory deadlines | Defer | Important but not Personal core | Business filings | Compliance risk | Scope creep |
| Filings | `BusinessFilingScreens.tsx`, business packages | VAT/CT/SA/RTI/MTD | Defer separate | Needs specialist proof | Tax engines | Wrong filing claim | Legal/trust risk |
| Business Calendar | Business filing/calendar surfaces | Deadline calendar | Defer | Separate IA | Deadline truth | Deadline regressions | Hidden deadline risk |
| Business Data/Account | Entity setup/more screens | Entity context | Preserve | Needed for isolation | Workspace model | Entity breakage | Cross-context confusion |
| Business Melo | `BusinessMeloScreen.tsx` | Business companion | Defer/Evolve | Needs separate memory/tools | Business truth | Unsafe suggestions | Generic business chat |

## Engines and infrastructure

| Element | Current implementation | Design intent | Audit recommendation | Treatment | Reason | Dependencies | Risk changing | Risk leaving |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Financial ledger | `store.ts`, domain/storage packages | Transaction truth | Make repository canonical over time | Consolidate/Evolve | Avoid duplicated truth | Storage migration | Data loss | Blob lock-in |
| Account model | `store.ts` account fields and balance timestamps | Current position | Add provenance | Evolve | Core Safe Range input | Truth Model | Balance bugs | Stale balance risk |
| Current position | `setCurrentBalance` path | Known now | Make sourced/fresh | Evolve | No consequential answer without it | Account model | Regression | False "now" |
| Forecast | package/local helpers feeding routes | Future path | Deterministic core | Evolve | LLM cannot calculate | Safe Range | Math regressions | Weak intelligence |
| Safe-to-spend | Safe Zone/tightest route | Safe answer | Replace with Trusted Safe Range | Redesign | Needs range/source/confidence | Truth Model | User confusion | False certainty |
| Calendar derivation | screen/store/calendar local code | Future events | Move to engine boundary | Consolidate | Screens should not own truth | Calendar tests | Route issues | Duplicate date logic |
| Recurring obligations | subs/bills/recurrence logic | Commitments | Keep reviewed | Evolve | Floor depends on recurrences | Review | Missed recurrence | Bad floor |
| Debt | debt engine test and sheets | Debt pressure | Include | Evolve | Material obligations | Truth class | Wrong payoff logic | Debt omitted |
| Scenario engine | WhatIf/Plans helpers | Compare choices | Make non-mutating | Evolve | Decision system core | Ledger | Scenario breakage | Toy planning |
| Recovery | recovery preview/store actions | Pressure options | Source and ledger | Evolve | High trust moment | Safe Range | Bad suggestions | Harmful advice |
| Cycle close | payday/stage/store logic | Forecast-vs-actual | Include Personal | Evolve | Calibrates future | Ledger | Cycle bugs | No learning |
| Review queue | store/review candidates | Truth gate | Preserve | Preserve/Evolve | Already aligned | Truth Model | Import slower | Silent false facts |
| Intake | `IntakeScreen.tsx`, local parsing | Bring in facts | Correct claims | Evolve | Android-only proof handled | Native proof | Import regressions | Unsupported claims |
| Deduplication | store/import comments/tests | Avoid duplicates | Preserve/evolve | Evolve | Trust-critical | Review | False duplicate | Duplicate facts |
| Decision history | Incomplete | Accountability | Add bounded ledger | Redesign | Moat/trust | Truth+Safe Range | More storage | No accountability |
| Melo tools | `toolContract.ts`, `applyMeloTool` | Confirmable actions | Keep confirmation | Evolve | Good boundary | Ledger | Tool breakage | Unsafe if widened |
| AI gateway | local/retired adapter files | Companion intelligence | Keep bounded | Defer/Evolve | No generic chat | AI policy | AI regression | Hollow Melo |
| Persistence | `persist.ts`, snapshots, storage package | Local-first | Strangler migration | Consolidate | Avoid multiple sources of truth | Storage | Migration risk | Scaling blocker |
| SQLCipher | packages/storage/native direction | Encrypted store | Production proof needed | Evolve | Security requirement | Device tests | Storage issues | Trust blocker |
| Evidence storage | import/file metadata | Source records | Add canonical fact refs | Evolve | Needed for truth | Truth Model | Data model churn | Sourceless answers |
| Cloud backup | sheets/copy partial | Backup | Defer | Not core until security proof | Encryption | No backup | Trust risk if fake |
| Sync | Not verified production | Multi-device | Defer | Not core | Auth/security | Single device only | Unsafe sync if rushed |
| Authentication | sign-in sheets/account | Identity | Defer from local core | Keep optional | Local-first can work without auth | Billing/cloud | Account confusion | Blocks use |
| Open Banking | `openBankingNative.ts`, service packages | Provider import | Keep fail-closed | Correct/Defer | No production config proof | Provider creds/callback | Provider bugs | Manual burden |
| Billing | billing packages/services/paywall | Paid tiers | Defer product decision | Evolve later | Pricing not core | Store/IAP | Revenue delay | Premature paywall |
| Notifications | Partial | Timely help | Defer | Needs reliable truth | Safe Range | Missed nudge | Bad nudges |
| Widget | `SafeZoneWidget.tsx` | Glanceable answer | Defer | Cannot show old Safe Zone | Safe Range | Widget loss | Misleading widget |
| Analytics | Not verified complete | Learning/ops | Defer minimal | Privacy risk | Policy | Less telemetry | Surveillance drift |
| Audit logging | Comments/export fragments | Accountability | Add ledger/audit | Evolve | Trust moat | Ledger | Storage complexity | No proof trail |
| Security | App lock/privacy/storage | Trust | Harden | Evolve | Production blocker | SQLCipher/export/delete | Regression | Trust gap |
| Accessibility | Tests/tokens plus mixed surfaces | Inclusive trust | Correct as gate | Evolve | Financial answers must be readable | Design system | Slower UI work | Exclusion/legal risk |
| Release engineering | tests/build/release docs/artifacts | Store readiness | Preserve gates | Evolve | Android evidence exists | CI/device | Slower releases | False readiness |

## Containment-specific classifications

| Known defect | Treatment | Current result |
| --- | --- | --- |
| Silent recurring invoice drafts | Correct | Screen lifecycle write removed; guard added. |
| Accent contrast | Correct | Paper/white-on-accent repaired and guarded. |
| Plaintext export retention | Correct | Main native export stages in cache and deletes after share. |
| Provider mock visibility | Correct/Defer | Verified fail-closed/gated; no production claim. |
| Android/iOS document reading parity | Correct | Copy now platform-specific. |
| Mascot fallback | Preserve | Runtime uses Melo/Phoenix canonical assets. |
| Open Banking callback/identity production readiness | Defer | Gated until provider proof. |
| Stale/sample consequential numbers | Evolve | Source guards exist for demo strings; full Truth Model pending. |
| Companion material writes | Preserve/Evolve | Confirm boundary verified; ledger pending. |

