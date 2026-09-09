# Melo manual finance release — 9 September 2026

**Ready for the intended user's manual finance path today.** The existing Android app is preserved. Luna workers implemented the changes; root reviewed the source, rejected unsafe shortcuts, and tested signed native builds. Open Banking is optional.

## Repository and delivery

| Required handoff item | Result |
| --- | --- |
| 1. Authoritative worktree | `C:\dev\melo-native-today-batch1-2026-08-24` |
| 2. Original branch | `codex/melo-native-true-parity-2026-08-25` |
| 3. Pre-change SHA | `0ff5d9c3a0af64f7b44f0be4b5e9711d8dfd94a5` |
| 4. Previous handoff | `4693c9ae7dd54a7e03ae1f420ad38decb69f53c4` exists locally and in remote ancestry; superseded by 186 commits. |
| 5. Unpushed work | Authoritative branch was 0 ahead/0 behind after fetch. Older worktrees, dirty work and stashes were inventoried and preserved. |
| 6. Safety reference | `safety/melo-pre-manual-release-2026-09-09`, at the pre-change SHA. |
| 7. Implementation branch | `codex/melo-manual-release-2026-09-09` |
| 8. APK source SHA | `c74daf58c9c1f0c7c231d4a85c557ee60764c7d1`. Final evidence commit: see `GIT_HANDOFF.json` supplied alongside the APK. |
| 9. Remote verification | `https://github.com/Thegamerdr/Folio.git`, same implementation branch; source SHA verified with `git ls-remote` after push. Final evidence SHA is recorded in `GIT_HANDOFF.json`. |

The common repository is `C:\dev\folio-v2-greenfield\.git`. The old July checkout had 224 dirty entries and was preserved. Existing parity images, Open Banking plans and later release plans remain uncommitted deliberately; see `pre-existing-status.txt`. No reset, force push, stash drop, branch deletion or removal of another session's work occurred.

## 10–12. Changes and financial authority

- Added a pure integer-pence engine in `packages/finance-engine/src/financialPlan.ts` and one mobile adapter in `apps/mobile/src/folio/lib/financialPlan.ts`.
- Dated income, commitments, debt minimums, essentials, protected pots/holds and the chosen buffer determine safe-to-spend, shortfalls and extra-payment affordability. Monthly dates use calendar months. Weekly, monthly and irregular fixtures use the same engine.
- Debt ordering covers balanced, avalanche, quick win, cash-flow relief, arrears, promotional expiry and user preference. Repayment projections cascade released minimums. Unknown interest prevents an invented payoff promise; one-off payments are not repeated monthly.
- Today, Plan, Debts, affordability, What If, Recovery, Shortfall and Melo use the shared plan. The separate Today modes were corrected to preserve the same money. Automatic savings suggestions exclude rent and other protected or ambiguous commitments.
- Manual onboarding and the returning editor accept exact balances, income, payday, living allowance and buffer, including explicit zero. Bundled rent/bills keep a durable identity through repeated edits. Debt edits preserve APR uncertainty, arrears and promotional metadata.
- Live spends and income receipts update cash exactly once. A durable transaction marker preserves edit/remove/undo behavior across canonical persistence; historical imports remain ledger-only. Existing legacy AppState account fields named `balanceMinor` still hold pounds; conversion to pence happens at the adapter boundary.
- Conversation follows interpretation → structured proposal/query → deterministic validation → confirmation → canonical update → recalculation. Affordability questions do not record payments. Ambiguous income/debt corrections ask for the missing record rather than guessing. The last source change corrects the confirmation label to “received income”.
- Timeline initially renders 50 entries with explicit increments of 50 and memoized grouping. Stored data is retained. The complete ledger is still projected before slicing; no Android large-corpus speed claim is made.

All 56 screen IDs and 29 non-null sheet IDs remain unchanged. Business, Open Banking, PDF/import, settings and existing navigation remain in the product.

## 13. Exact synthetic fixtures

Calculations are fixed to 9 September 2026 unless a regression case declares another date. No live financial credentials were used.

| Fixture | Inputs and expected results |
| --- | --- |
| A: weekly, variable | Cash £1,000; receipts £450 Sep 11 and £600 Sep 18; transport £120 Sep 12, insurance £180 Sep 16, essentials £200 Sep 17; debt minimums £50/£60/£70 Sep 10/16/20; buffer £150. Safe before first income £800; £300 extra affordable; £120 shock leaves £680. |
| B: monthly, manual | Cash £1,800; income £1,800 Sep 28; bundled rent/bills £950 Sep 12; essentials £70/week = £190 over 19 days; minimums £80; buffer £200; no car. £1,220 protected plus buffer; safe £380. £120 spend leaves £260; £400 purchase is unsafe by £20; zero buffer leaves £580. Core fixture has two debts (£60/£20 minimums); native/store fixture has Klarna £320, known 0% APR, £80 minimum Sep 18. |
| C: irregular | Cash £700; client receipts £350 Sep 14 and £220 Sep 25; childcare £250 Sep 12; essentials £120 Sep 13; buffer £100; no debt. Safe £230 before first receipt. |

`BEHAVIOR_COVERAGE.md` maps all 30 requested scenarios to repeatable assertions. `../MELO_FINANCE_BEHAVIOR_MATRIX_2026-09-09.md` records exact changes for income, bills, buffer, arrears, debt correction/payment/cascade, refunds, rejection and undo.

## 14. Release gates

| Gate | Result | Evidence |
| --- | --- | --- |
| G0 Git integrity | PASS | Authority, fetch/divergence, previous SHA, safety ref and preservation captured before coding. |
| G1 Baseline inventory | PASS | Existing tests run; baseline failures recorded; before/after screen and sheet inventory retained. |
| G2 Financial engine | PASS | A/B/C, protection, calendar dates, affordability, shortfall and cascade checks; real cash lifecycle and native recalculation. |
| G3 Conversation | PASS | Queries and confirmed mutations tested; native affordability, bill change and received-income correction. |
| G4 Manual new user | PASS | Fixture B completed manually without Open Banking; final APK also opened fresh manual setup in a separate profile. |
| G5 Adaptability | PASS | A/B/C use the same engine without person-specific branches. |
| G6 Stability/performance | PASS | Tested manual path, restart, saved edits and offline launch work. Import parser is outside manual setup; Timeline rendering is bounded. Remaining full-ledger projection cost is documented. |
| G7 Full shell | PASS | 56 screens/29 sheets retained, registry coverage including Business and previously passing selected critical checks preserved. Native critical destinations exercised; not a claim of exhaustive pixel parity. |
| G8 Installable release | PASS | Signed c74 APK installed and launched on emulator and Galaxy S9; fresh profile and retained-state launch visually checked. |
| G9 Git completion | PASS | Intended source committed, pushed and remote-verified; evidence commit and final remote identity accompany the handoff. Only documented pre-existing work remains dirty. |

## 15. Baseline versus final checks

Baseline: six existing files, **119 passed / 6 failed (125 total)**; mobile TypeScript passed. The six failures were stale shell-inventory and native-save-argument contracts and were corrected without removing runtime coverage.

An intermediate 13-file run had **173 passed / 2 failed**; both Recovery failures were investigated and fixed. Affected engine/onboarding/canonical-read/Recovery rerun: **39/39 passed**. Further focused runs: core/adapter edges **18/18**, store behavior matrix **21/21**, Stability **8/8**, Recovery/discretionary selection **3/3**, import endurance **20/20** including 100,000 parser rows. Final cash-posting review: **20/20 across four files**; live default-account lifecycle: **1/1**; final existing proposal file: **4/4**. Mobile no-emit TypeScript passed before the final one-line copy correction. The final signed build passed afterward.

These runs overlap and are not added as unique cases. No selected failure remains unresolved. The full repository suite and every historical visual comparison were not rerun. JSON results and typecheck outputs are stored beside this report.

## 16–17. Limitations and blockers

**No remaining blocker was found in the supported manual release path.** Large imported ledgers still incur full projection work before the bounded list is sliced; the parser endurance result is not an Android performance benchmark. One Plan caption can clip its final word at the tested layout, while the buffer and safe amount remain explicit elsewhere. Existing external release requirements for store distribution, purchases, cloud identity/deletion, hosted calendars and Open Banking provider activation remain separate. Existing animation/parity gaps were preserved, not certified as fixed.

Native review caught and fixed candidate defects that tests missed: Today £650 versus canonical £380, unsafe rent savings suggestions, and a live £120 spend that originally failed to reduce cash. Intermediate failure evidence is retained. Final native results supersede those candidates.

QA incident: an earlier worker targeted a newly attached locked handset and tried one guessed PIN, which was rejected. Root stopped the attempt and disclosed it to the owner. No financial state was saved during that incident. No further unlock attempts occurred; root later installed and launched the app on the unlocked handset without clearing its data.

## 18–20. Artifact, installation and readiness

**APK:** `C:\dev\melo-release-artifacts-2026-09-09\Melo-manual-c74daf58-arm64-x86_64.apk`

- Size: **155,752,170 bytes**; package `com.folio.v2.greenfield`; ABIs `arm64-v8a`, `x86_64`.
- SHA-256: `fee8888e004264fd828cea7be17cac0514ad277416b1665197b52d895acba71c`.
- Signing certificate SHA-256: `547396e1fd99681c2a6d768b8b7d1b4484b5f42a17597cad6c495221267a5488`, matching the previous release.
- `assembleRelease`: **PASS, 1m49s**; signature verification passed; embedded manifest/fingerprint present. See `handoff-release-build.log` and `ARTIFACT.json`.
- `adb install -r`: **Success on both emulator and Galaxy S9**. Final emulator cold launch: **4,857 ms**; S9 warm launch: **3,956 ms**, both `Status: ok` and actual UI inspected. No phone financial figures were entered or app data cleared.
- Final offline cold launch: **9,179 ms**, retained cash **£1,780**, safe-to-spend **£360**, future income **£1,800**, bill **£950**, buffer **£200**. Fresh profile 11 reached empty manual setup after Android finished initializing the new user. See `DEVICE_ACCEPTANCE.md` for the actual sequence and screenshots.

**Suitable to hand to the intended new user today: YES, for local manual finance and debt planning.** Install the APK, enter real figures through manual setup, and review the protected money and debt plan. All original product areas remain available; external integrations are not required for this path.