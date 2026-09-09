# Melo clean-profile release — 9 September 2026

**GO-WITH-LIMITATIONS for handing version 0.0.5 to the girlfriend for fresh manual setup today.** The production profile starts with **zero sample financial data**. Complete setup from accurate current figures. Use a true fresh install or the existing confirmed local-clear flow when replacing a profile previously used for demos.

## Root causes and closed entry points

The previous release already attempted to start fresh installs empty, but production still contained several routes for turning examples into financial truth. Its seeded `DEFAULTS` remained available to partial hydration, migration and reset. Old sample subscriptions acquired renewal fields before whole-record matching, so the cleanup failed to recognize them. This was especially relevant to an APK upgraded over an existing demo profile. The guided check-in also replaced an empty balance with **£1,240**, which Continue could save as user money. The live paste doorway offered fake transactions through the ordinary import/review path.

| Production entry point | Closure |
| --- | --- |
| First launch, default state, missing fields, migration, future-schema fallback | Shared empty state: £0 balance, no income, bills, debts, transactions, pots, plans or fixture history, and £0 protected buffer until chosen. A neutral Main account shell at £0 remains for canonical account binding; it is not a funded account or sample balance. |
| `resetAll`, `resetToEmpty`, durable Privacy reset | Reset never reseeds. Confirmed local clear still uses the existing three confirmations. Money, setup identity, imports, cache/history and derived state clear; app preferences, purchases and read allowance survive the durable write. |
| Persisted old samples and migrations | Recognized sample balances, seeded debts/plans/transactions, exact pot/cycle fingerprints, anchored sample subscriptions, migrated £2,180 salary, associated backfill/edit remnants and an untouched sample £100 buffer are removed. Explicit real same-name bills, completed/manual setup, real buffers and subscription edits are preserved. |
| Calendar, Today, Plan, Shortfall, calendar export, day detail and nudge preview | Calendar derivation defaults to no examples and all live callers explicitly exclude them. Test calls must opt in; no source flag on financial records enables demo bills in production. |
| Guided check-in, paste and review | No £1,240 fallback or importable sample-text button. Review no longer fills missing real dates/categories from merchant-keyed example metadata. |
| Initial screen calculations and What If | Removed sample pressure amounts and 11-day fallback. Empty What If requires money setup. Empty screens point to setup instead of labelling the real profile “Sample numbers”. |
| Melo context | Empty profiles remain onboarding-driven, including after reset/restart; the presence of a £0 account shell is not financial knowledge. |
| QA activation and native build cache | Explicit QA activation only; ordinary deep links/direct activation cannot mutate the real profile. Capture environment variables are bundle-task inputs, preventing a cached fixture bundle from being reused when returning to production. |

`SEEDING_PATHS.md` provides the complete audited source inventory, including dormant local-ledger/dogfood helpers, startup, native/legacy/back-up hydration, one-time archived Melo import and reset artifacts.

## Demo and test isolation

There is **no customer demo mode in the production app**. Automated fixtures remain in test scope (`folio/test/sampleFixture.ts`); existing tests explicitly import them. Recognition-only legacy fingerprints remain in production solely to remove old samples, never to populate a profile.

The developer visual capture experience remains available as **Melo QA**, using `com.folio.v2.greenfield.capture`, `folio-qa`, separate OS storage/keychain/provider authorities, and disabled OTA. The real app keeps `com.folio.v2.greenfield` and `folio`. QA skips the normal startup persistence path and cannot configure real-account sign-in, cloud backup/sync, Open Banking or purchases. Ordinary app service behavior is preserved. A real native manifest build verified the separate package and all ten provider authorities; no QA APK was installed on the S9. The following production build regenerated its JS bundle after that QA build.

## Tests and preservation

**2325/2325 tests passed across 236 files**, **54 net new regression tests** relative to the prior 2,271. The final suite includes all mobile tests and domain, finance, Today, Plan and calendar-engine tests. Combined package/mobile TypeScript and formatting checks passed.

New coverage includes cold production initialization; missing entities across schema versions 1–13; future-schema fallback; £500 entered cash / £100 bill / £50 buffer = £350 safe; cold module restart; both reset APIs; settings retained through native persistence; bound native snapshot non-resurrection; legacy matching and same-name preservation; empty calendar/Melo/What If; and build/runtime/remote QA separation. Existing parser and financial test fixtures remain intact. One intermediate unlimited-worker run had a cold-import timeout in a new isolation test; the final four-worker run passed every test without extending timeouts.

| Prior corrected numeric scenario | Current release source result |
| --- | --- |
| Payday, cash already includes salary | **£350 safe** |
| Unpaid overdue £950 rent | **£500 safe** |
| Correct £40 debt payment to £100 | **£1,700 cash / £220 debt / £280 safe** |
| Delete and Undo corrected payment | Prior reconciliation tests still pass |

These are current-source regression results; the S9 checks below describe the separate native acceptance performed for this build. The financial engine and corrected payday/payment-ledger calculation sources remain unchanged from `9ef29b96`.

The app shell and its **56 screens / 29 sheets** remain intact; shell registry and dispatch source files are unchanged. 71 source/test/tooling files changed, including mechanical test-fixture imports. All **20 pre-existing tracked changes** have an identical binary patch, and all **2153 pre-existing untracked entries** remain. This was a data-hygiene closure, with no unrelated redesign.

## Galaxy S9 evidence

Tested the signed replacement on **SM-G960F**, serial `2af26a2c19017ece`. App data was cleared for a true fresh profile, and the installed APK SHA-256 was checked against the artifact. The device used production UI and manual inputs, without a fixture deep link, database injection or capture mode.

**29 native assertions passed.** Screenshots, UI hierarchy files and timestamped assertions are in the evidence archive. `native-results.md` records the exact steps and limitations, including the synthetic manually entered profile, Today/Plan result, offline force-stop/restart, and final reset state.

On the S9, entered £500 cash, £1,000 monthly income on day 28, one £100 Manual rent bill on day 12, £0 weekly essentials and a £50 buffer, with no debts or pots. Today and Plan both showed **£350 safe**. Offline restart preserved that result and only that bill. Cancelling clear preserved the profile; completing all three confirmations removed it. Guided balance returned to **£0**, and another offline restart kept Today and Plan empty. Phone settings were restored and the device was left ready for fresh setup. The first post-clear launch outlasted the shell's roughly 10.7-second wait but rendered successfully; later offline cold launches completed in 3.5 and 2.9 seconds. Animation scales were temporarily disabled for hierarchy capture and restored afterwards.

## Signed replacement artifact

| Field | Value |
| --- | --- |
| APK | `C:\Users\User\Documents\Codex\2026-09-09\referenced-chatgpt-conversation-this-is-an-3\outputs\Melo-clean-profile-0.0.5-ab263310-arm64-x86_64.apk` |
| Package / version / code | `com.folio.v2.greenfield` / `0.0.5` / `5` |
| Size | **155,791,075 bytes** |
| SHA-256 | `21e46ad403a30002eadd5328c095117b2ca266bcfafab2e1b26c3ee47e5aa1c3` |
| Architectures | `arm64-v8a, x86_64` |
| Signature | APK Signature Scheme v2 verified; RSA 2048; CN=Folio, OU=Folio, O=Folio, L=Verona, C=IT |
| Signing certificate SHA-256 | `547396e1fd99681c2a6d768b8b7d1b4484b5f42a17597cad6c495221267a5488` |
| APK source commit | `ab263310887a6eec57bb2ba9dbe9979f08c5e325` |
| Final local SHA | `Recorded after this evidence commit in the distributed report and final-git.json` |
| Final verified remote SHA | `Recorded after push verification in the distributed report and final-git.json` |
| Remote branch | `origin/codex/melo-manual-release-2026-09-09` |

The final evidence commit follows the APK source commit and records test/device/artifact verification. The distributed report and archive include the final verified Git SHAs; this repository copy is generated before its own evidence commit. This is a new signed APK, not the old 0.0.4 artifact renamed.

## Remaining limitations and handoff decision

- **Use fresh manual setup.** A historical sample that was edited or imported as an ordinary record without provenance can be indistinguishable from a real record. The migration removes recognizable samples conservatively; it cannot safely infer every old record's origin. The existing confirmed local clear resolves this ambiguity. Do not reuse an unreviewed old demo profile.
- Enter accurate current balances, income dates, bills/debt minimums, essentials and a chosen buffer. Explicitly resolve already-paid obligations as in the previous corrected release. Missing historic payment information cannot be reconstructed.
- S9 acceptance covers the documented fresh/manual/offline/reset flows. It does not establish visual parity or end-to-end operation of every screen. Open Banking, cloud account services and store distribution are outside this manual handoff acceptance; no emulator pass is claimed.

**GO-WITH-LIMITATIONS for the fresh APK and manual setup today.** The locally solvable production sample-data paths identified by this audit are closed, and the prior financial corrections remain passing.

## Complete changed-file list

- `apps/mobile/app.config.ts`
- `apps/mobile/plugins/captureIsolation.test.ts`
- `apps/mobile/plugins/withCaptureIsolation.cjs`
- `apps/mobile/profileBuild.test.ts`
- `apps/mobile/src/folio/freshProductionProfile.test.ts`
- `apps/mobile/src/folio/lib/billing/billingVerification.ts`
- `apps/mobile/src/folio/lib/billing/entitlements.test.ts`
- `apps/mobile/src/folio/lib/billing/iap.ts`
- `apps/mobile/src/folio/lib/billing/readAllowance.test.ts`
- `apps/mobile/src/folio/lib/calendarEvents.test.ts`
- `apps/mobile/src/folio/lib/calendarEvents.ts`
- `apps/mobile/src/folio/lib/captureBuild.ts`
- `apps/mobile/src/folio/lib/captureServices.test.ts`
- `apps/mobile/src/folio/lib/caughtAnnual.test.ts`
- `apps/mobile/src/folio/lib/caughtBillsOrdering.test.ts`
- `apps/mobile/src/folio/lib/caughtDrift.test.ts`
- `apps/mobile/src/folio/lib/caughtOrderingExtended.test.ts`
- `apps/mobile/src/folio/lib/clerkAuth.ts`
- `apps/mobile/src/folio/lib/cloudBackupNative.test.ts`
- `apps/mobile/src/folio/lib/cloudBackupNative.ts`
- `apps/mobile/src/folio/lib/guidedBalance.test.ts`
- `apps/mobile/src/folio/lib/guidedBalance.ts`
- `apps/mobile/src/folio/lib/income.test.ts`
- `apps/mobile/src/folio/lib/legacySampleData.ts`
- `apps/mobile/src/folio/lib/lens.test.ts`
- `apps/mobile/src/folio/lib/meloAccountSelection.test.ts`
- `apps/mobile/src/folio/lib/meloCalculations.test.ts`
- `apps/mobile/src/folio/lib/meloSnapshot.test.ts`
- `apps/mobile/src/folio/lib/meloSnapshot.ts`
- `apps/mobile/src/folio/lib/meloToneGuidance.test.ts`
- `apps/mobile/src/folio/lib/notifyState.test.ts`
- `apps/mobile/src/folio/lib/openBankingConfig.ts`
- `apps/mobile/src/folio/lib/persist.test.ts`
- `apps/mobile/src/folio/lib/persist.ts`
- `apps/mobile/src/folio/lib/persistRecovery.test.ts`
- `apps/mobile/src/folio/lib/recoveryPreview.test.ts`
- `apps/mobile/src/folio/lib/restore.test.ts`
- `apps/mobile/src/folio/lib/storeRoute.test.ts`
- `apps/mobile/src/folio/lib/storeRoute.ts`
- `apps/mobile/src/folio/lib/widgetSnapshot.test.ts`
- `apps/mobile/src/folio/meloFinanceTools.test.ts`
- `apps/mobile/src/folio/parity/normalBuildPurity.test.ts`
- `apps/mobile/src/folio/parity/parityHarness.test.ts`
- `apps/mobile/src/folio/parity/parityHarness.ts`
- `apps/mobile/src/folio/screens/CalendarScreen.tsx`
- `apps/mobile/src/folio/screens/GuidedCheckInScreen.tsx`
- `apps/mobile/src/folio/screens/PasteSuccessScreen.tsx`
- `apps/mobile/src/folio/screens/PlanScreen.tsx`
- `apps/mobile/src/folio/screens/PlansScreen.tsx`
- `apps/mobile/src/folio/screens/PotsScreen.tsx`
- `apps/mobile/src/folio/screens/PrivacyScreen.cleanSlate.test.ts`
- `apps/mobile/src/folio/screens/productionEntryPoints.test.ts`
- `apps/mobile/src/folio/screens/reviewCategoryLearning.test.ts`
- `apps/mobile/src/folio/screens/ShortfallScreen.tsx`
- `apps/mobile/src/folio/screens/today/TodayNudges.test.ts`
- `apps/mobile/src/folio/screens/TodayModeScreen.tsx`
- `apps/mobile/src/folio/screens/TodayScreen.tsx`
- `apps/mobile/src/folio/screens/TodayStabilityScreen.tsx`
- `apps/mobile/src/folio/screens/VisualizerScreen.addAll.test.ts`
- `apps/mobile/src/folio/screens/VisualizerScreen.tsx`
- `apps/mobile/src/folio/screens/WhatIfScreen.tsx`
- `apps/mobile/src/folio/sheets/CalendarConnectSheet.tsx`
- `apps/mobile/src/folio/sheets/CalendarExportSheet.tsx`
- `apps/mobile/src/folio/sheets/editTxnSave.test.ts`
- `apps/mobile/src/folio/sheets/logSpendCategoryLearning.test.ts`
- `apps/mobile/src/folio/sheets/onboardingComplete.test.ts`
- `apps/mobile/src/folio/sheets/SheetDayDetail.tsx`
- `apps/mobile/src/folio/store.test.ts`
- `apps/mobile/src/folio/store.ts`
- `apps/mobile/src/folio/test/sampleFixture.ts`
- `docs/parity-recovery/tooling/capture-native-batch.mjs`
