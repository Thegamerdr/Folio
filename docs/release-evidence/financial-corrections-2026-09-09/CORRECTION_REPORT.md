# Melo financial correction release — 9 September 2026

**GO-WITH-LIMITATIONS for the girlfriend's fresh manual setup on version 0.0.4.** All three exact financial reproductions passed on the Galaxy S9 replacement APK. Enter accurate current cash and explicitly resolve occurrences already paid. The earlier 0.0.2 and 0.0.3 candidates are superseded.

## Scope and preservation

This corrected payday protection, unpaid obligations and debt-payment reconciliation. The existing shell remains: **56 screens and 29 sheets**, with unchanged registries. Open Banking remains optional and untouched.

| Repository item | Evidence |
| --- | --- |
| Worktree | `C:\dev\melo-native-today-batch1-2026-08-24` |
| Starting remote SHA | `ce2fdcebad15996a04fe3fa47cd504ad28ebba9e` |
| Branch | `codex/melo-manual-release-2026-09-09` |
| Verified 0.0.4 source commit | `1d3dcdce7ca6ef7a70c865442796c717038b7be1` |
| Final local release/evidence commit | Release evidence commit containing this report; exact local SHA recorded in delivered `GIT_HANDOFF.json` |
| Final verified remote SHA | Exact remote SHA recorded in delivered `GIT_HANDOFF.json` |

The 20 pre-existing tracked dirty files retain a byte-identical patch. The 2,153 pre-existing untracked entries were preserved outside the intended change scope. Preservation and shell inventories are recorded in `git-preservation.json` and `shell-inventory.json`.

## Three corrected causes

**Payday:** the adapter supplied today's inclusive payday as the next-income boundary, while the engine credited today's scheduled salary again. Current balances now explicitly include posted movements through today; neither posted history nor today's unreceived scheduled income increases cash again. The horizon uses the next strictly future receipt, excluding that receipt from pre-income safe spending. Monthly, weekly and irregular income share this rule. The route also evaluates the complete financial horizon while retaining its shorter visual chart.

**Unpaid obligations:** recurrence rolling replaced overdue bill and minimum dates before the engine received them. A durable occurrence anchor and dated resolution records now separate overdue unpaid cycles from subsequent scheduled cycles. Partial payments reserve only the remainder; paid, settled and cancelled occurrences release their own protection. Debt schedule edits preserve accrued dates and amounts. A one-cycle pause respects its recorded end date and cannot cancel subsequent months. Confirming an already-paid occurrence does not subtract cash again and supports Undo.

The follow-up retention audit found that adding a 101st calendar item silently discarded the oldest event, including an unpaid obligation. Calendar insertion now retains that obligation; a regression checks the £950 rent through insertion, hydration and canonical readback. Passage of time and unrelated calendar activity cannot substitute for explicit payment or removal.

**Debt corrections:** payment creation changed cash and principal but saved an ordinary transaction without reversible effects. New payments carry canonical debt/link/principal metadata and durable posting order. Edit reverses the prior effects and applies the replacement once; delete and restore reconcile cash, debt, ledger and later capped payments together. Metadata-only changes do not replay money. Earlier principal ceilings preserve independent balance corrections. No displayed-balance workaround was introduced.

The follow-up call-site audit found that the visible LogPaymentSheet still called an older debt-only writer. The manual sheet, confirmed Melo payment and account-based linked-card payment now share the canonical posting. The sheet checks success before closing, selects a paying cash account when needed and uses the exact returned undo. Full cash outflow and capped principal are distinct for overpayments. The legacy undo entry point can reverse only an unambiguous recorded effect; it cannot create an arbitrary balance increase.

TodayMode, TodayStability and Debts now use the shared local-day clock so payday and overdue calculations refresh at midnight and when the app returns to the foreground. Mounted screens no longer depend on remounting or an unrelated store write to advance their date.

Native checks on candidate 0.0.3 exposed two remaining consumers of the old forecast semantics. Plan's list used an inclusive calendar payday boundary, so it could list £0 on payday despite unpaid September rent and October rent inside the actual next-income horizon. Plan now lists the engine's canonical pending obligations, including original overdue dates, partial balances and capped minimums, under the same exclusive income boundary as safe-to-spend. It also retains obligations before irregular income beyond the old 35-day calendar list.

Shortfall used the chart's cash minimum, omitting the buffer, and divided closing cash on the next payday—including future salary—into a daily allowance. With both £950 rent occurrences unpaid, it displayed a £400 gap and £33/day while Today correctly held a £600 protected shortfall. Shortfall now derives its gap and extra-spending allowance from canonical safe-to-spend: £600 gap and £0/day. Essentials remain reserved, and the card explains that zero extra spending does not resolve the gap. Shortfall also uses the shared local-day clock.

## Exact source reproductions

These are deterministic source/test-runner results. The native checklist below independently verifies the replacement APK.

| Reproduction | Unsafe release observed | Corrected source result |
| --- | --- | --- |
| Sep 28 payday; £1,800 cash already includes salary; one £950 upcoming bill occurrence; prior September rent resolved; £70/week essentials; £200 buffer | £1,600 safe | **£350 safe** |
| Sep 13; £950 rent due Sep 12, unpaid; otherwise same monthly inputs | £1,450 safe | **£500 safe** |
| Same overdue rent after hydration/date rolling | £1,450 safe | **£500 safe** |
| Unpaid £950 rent after adding a 101st calendar item | £1,450 safe after silent eviction | **£500 safe; rent retained through hydration and canonical readback** |
| £80 minimum due Sep 12, calculated Sep 13 | £0 minimum protected | **£80 protected** |
| Fixture B: record £40, correct to £100 | £1,760 cash / £280 debt / £340 safe | **£1,700 cash / £220 debt / £280 safe** |
| Delete that corrected payment | £1,760 cash / £280 debt / £340 safe | **£1,800 cash / £320 debt / £380 safe** |
| Undo deletion | Not reached in failing baseline | **£1,700 cash / £220 debt / £280 safe** |
| Visible LogPaymentSheet API: record £40 | £1,800 cash / £280 debt / £380 safe; no transaction | **£1,760 cash / £280 debt / £340 safe; canonical transaction posted** |
| Correct that manual-sheet payment to £100, then delete | No editable payment transaction | **£1,700 / £220 / £280 after edit; £1,800 / £320 / £380 after deletion** |
| Sep 28 with unpaid Sep 12 and Oct 12 rent: Plan's pending list | Candidate 0.0.3 native list showed £0 | **£1,900 listed: both £950 occurrences; canonical safe remains −£600** |
| Same two-rent case: Shortfall recovery | Candidate 0.0.3 native/source £400 gap / £33 daily cap | **£600 gap / £0 daily extra-spending cap; essentials retained** |
| September rent explicitly paid; October still protected | Candidate Shortfall used future-payday cash | **£350 safe / £11 daily extra-spending cap; no active shortfall** |

The new regressions reproduced all three defects before their corresponding fixes. Detailed inputs, failing output and implementation evidence are in `payday-notes.md`, `payday-before.txt`, `obligations-notes.md` and `debt-ledger-notes.md`. The later Shortfall reproduction and correction are recorded in `shortfall-cap-notes.md`, `shortfall-cap-before.txt` and `shortfall-cap-after.txt`; `planModel.canonical.test.ts` proves the corrected Plan list and boundary.

## Changes and tests

Changed files are grouped by responsibility; `changed-source-files.txt` provides the complete list.

- Shared calculations: finance-engine `financialPlan.ts` including canonical pending obligations, new `obligations.ts`, exports, and domain payment/occurrence metadata.
- Mobile authority: `financialPlan.ts`, `storeRoute.ts`, `renewalMath.ts`, new `obligationState.ts`, `debtPaymentLedger.ts` and `shortfallBudget.ts`, `store.ts`, `editTxn.ts`, canonical write/read projections and the state-authority manifest.
- Existing interfaces: subscription paid confirmation, debt-minimum paid confirmation, linked-debt transaction correction, the manual LogPaymentSheet's canonical posting/account selection/undo, readable correction failures, canonical Plan pending rows and Shortfall amounts, and local-day refresh in TodayMode, TodayStability, Debts and Shortfall.
- Regression coverage: 17 shared payday tests, six mobile payday tests, three interest-minimum tests, six shared and 16 mobile obligation tests, 18 payment-ledger tests, two independent conservation-model tests, three shared-day-clock lifecycle tests, five canonical Plan tests and seven Shortfall budget tests. Coverage includes repeated edits, changed debt, caps, Undo, restart ordering, persistence, invalid atomic rejection, 101-item calendar retention, legacy uncertainty, mounted-screen midnight/foreground transitions, irregular horizons, boundary exclusions, future-income independence and preservation of essentials.

**Final relevant suite: 2,271/2,271 tests passed across 230 files** for the corrected 0.0.4 source. The final combined TypeScript and targeted Prettier checks passed. This suite includes the visible payment-sheet correction, calendar retention, shared-day-clock follow-ups and native-discovered Plan/Shortfall corrections; it supersedes the earlier candidates' test results. Coverage spans domain, finance, Today, Plan, calendar and mobile, including prior A/B/C fixtures, monthly bundled-bills/no-car Fixture B, weekly income, shortfall/recovery, affordability, cascade, manual corrections and persistence. Detailed outputs are in `final-tests.json`, `final-tests.log` and `final-typecheck.log`; `added-tests.json` records new regression-file counts from that final run.

## Release gates and native acceptance

| Gate | Assessment | Evidence |
| --- | --- | --- |
| G2 Financial correctness | **PASS for the scoped corrections** | Final S9 payday £350, overdue £500, edited payment £1,700 cash / £220 debt / £280 safe; Plan and Shortfall agree |
| G3 Conversation | **PASS for tested supported finance actions** | Final S9 proposal waits for confirmation; confirmed £40 payment and Undo reconcile balances; existing conversation tests pass |
| G4/G5 Setup/adaptability | **PASS-WITH-LIMITATIONS** | Fresh synthetic manual Fixture B entered on 0.0.2, preserved through upgrades and verified across Today/Debts/Plan on 0.0.4; A/B/C and weekly fixtures pass in source |
| G6 Stability/persistence | **PASS for tested lifecycle** | Corrected payment and explicit paid occurrence survive final S9 offline cold restarts; canonical roundtrip/recovery tests pass |
| G8 Installable release | **PASS on Galaxy S9** | Distinct signed 0.0.4/code 4 APK installed; installed hash matches artifact; v2 signature and both architectures verified |

| Galaxy S9 replacement-APK check | Result/evidence |
| --- | --- |
| Manual Fixture B; Today/Debts/Plan | **PASS after upgrade.** Final baseline £1,800 cash / £320 debt / £380 safe. After the £100 correction, offline Plan lists £950 bills + £80 minimum = £1,030 and £280 safe |
| Same-day payday and overdue unpaid bill | **PASS.** Sep 13 unpaid rent: £500 safe. Sep 28 after September is explicitly paid: £350 safe, £1,800 cash, 30 days to next payday |
| Create → edit → delete → Undo debt payment | **PASS.** £40 gives £1,760 / £280 / £340; edit to £100 gives £1,700 / £220 / £280; delete restores £1,800 / £320 / £380; Undo restores £1,700 / £220 / £280 (cash / debt / safe) |
| Two unpaid rent cycles; shortfall/recovery | **PASS.** Plan lists separate September/October £950 rows, £1,900 total and −£600 safe; Today shows £0 available / £600 shortfall; Shortfall shows £600 gap / £0 extra per day; £40 What-if produces −£640 and does not fit |
| Restart and offline state consistency | **PASS.** Corrected payment is unchanged after offline restart. Explicit paid occurrence survives a verified force-stop/no-PID and offline cold launch (7,294 ms), retaining Plan £950 / £350 safe |
| Emulator supplemental checks | **BLOCKED by storage.** Earlier 0.0.2 replacement install failed; final 0.0.4 was not installed there. No emulator replacement-build pass is claimed |

The evidence index and exact limitations are in `native-results.md`; all 22 final assertions in `s9-final-assertions.jsonl` pass. Final native files use `s9-final-*`; older candidate evidence is separated under `pre-final-0.0.2` and `pre-final-0.0.3`. Final 0.0.4 was an in-place upgrade, not a cleared-data onboarding rerun. The already-paid confirmation itself passed on 0.0.4; its short-lived Undo toast expired before retesting. That Undo passed on 0.0.3 and remains covered by source tests. Original clock, network and animation settings were restored and verified in `s9-restored-settings.json`.

## Artifact and remaining limits

| Artifact field | Verified value |
| --- | --- |
| APK | `C:\Users\User\Documents\Codex\2026-09-09\referenced-chatgpt-conversation-this-is-an-2\outputs\Melo-finance-corrected-0.0.4-1d3dcdce-arm64-x86_64.apk` |
| Package / version / code | `com.folio.v2.greenfield` / `0.0.4` / `4` |
| Size | 155,793,518 bytes |
| SHA-256 | `967ba15e5e2e14648268db933f16d870800711b0a776dfa05cdefcb91f240f00` |
| APK source SHA | `1d3dcdce7ca6ef7a70c865442796c717038b7be1` |
| Signature | APK Signature Scheme v2 verified; RSA 2048; `CN=Folio, OU=Folio, O=Folio, L=Verona, C=IT` |
| Certificate SHA-256 | `547396e1fd99681c2a6d768b8b7d1b4484b5f42a17597cad6c495221267a5488` |
| Architectures | `arm64-v8a`, `x86_64` |
| Build / installation | `assembleRelease` PASS, 3m11s; S9 installed `base.apk` hash equals the artifact |

Details are recorded in `ARTIFACT.json`, `apk-signature.txt`, `apk-package.txt` and `s9-installed-apk.json`. This is the distinct replacement artifact; the unsafe APK must not be used.

Older builds may already have discarded unpaid subscription dates; tracking begins at the earliest surviving anchor. Legacy debts without an anchor begin with the current month's due date, without invented older arrears. Older debt-payment rows lack recoverable effect metadata: ambiguous monetary edit/delete is blocked without changing money, while explicit current cash/debt correction remains available. New payments support reversible correction. Extra payments do not implicitly settle a minimum. Partial obligation payments are supported canonically; the compact confirmation UI marks the remaining occurrence already paid.

The internal `payCreditCardFromBank` API now requires a configured linked debt/payoff record so it can persist reversible principal effects. No current live UI calls an unlinked variant; the call-site audit found only tests for this account-based API. Ordinary manual and linked-card payments remain available through the existing payment sheet.

Future minimums with positive or unknown interest remain conservatively scheduled rather than prematurely stopping at current principal; confirmed interest-free schedules use principal caps. The tested native flows do not establish every historical visual comparison. Future-date PNG capture was unreliable on the device, so those acceptance checks use native UI XML and timestamped assertions.

Shortfall's explanatory low-point date and named event still come from the shorter 35-day chart. For a distant irregular income horizon, that explanation may not identify the full canonical protected gap; the gap, extra-spending cap and Plan obligations use the complete financial horizon.

**Recommendation: GO-WITH-LIMITATIONS for handing version 0.0.4 to the girlfriend as a daily money/debt planner with fresh manual setup.** Confirm current cash, debt balances and upcoming dates, and explicitly mark already-paid occurrences. The three reported blockers and the subsequently exposed payment, Plan and Shortfall defects are closed in source and the tested S9 flows. This recommendation does not imply that historical information already lost by an older build can be reconstructed.
