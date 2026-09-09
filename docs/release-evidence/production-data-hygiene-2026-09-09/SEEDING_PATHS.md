# Production financial-data source audit — 2026-09-09

Scope: the current native Melo repository, continuing financial-correctness release `9ef29b96`. This inventory describes code paths and automated checks. It does **not** claim that an APK was built, signed, installed, or verified on the Galaxy S9. The final release report and native evidence own those results.

## Production invariant

A new production process and a cleared personal partition start with zero cash, zero income, no debts, commitments, subscriptions, transactions, pots, plans, history, review candidates, spending holds or imported financial evidence. The canonical storage model retains a neutral `Main` account shell with a £0 balance; this is not an example balance or an imported bank account. The default payday number is structural and projects no payday event while income is zero. Buffer and mode-specific financial allowances are zero until entered.

The inventory of persisted financial/history collections is maintained in [workspaceRows.ts](../../../apps/mobile/src/folio/lib/workspaceRows.ts): pots, subscriptions, cycles, pot ledger, transactions, corrections, calendar events, debts, plans, tiny wins, timeline events, review queues, bank import inbox, income sources, drift dismissals, statement imports, evidence documents, accounts, cancelled subscriptions and What If holds. Transient reader candidates and caches are also empty. Scalars and maps such as balance, income, buffer, mode extras, spend hold, merchant memory and sub overrides are cleared independently of that collection list.

## Sources that previously introduced examples

| Entry path | Prior behaviour | Closure |
| --- | --- | --- |
| Store initialization / no persisted blob | `DEFAULTS` included £720 sample cash, £2,180 monthly income, six subscriptions, three funded pots, two historical cycles, two debts and one savings plan. `seedTransactions()` supplied eleven recent example transactions. | [store.ts](../../../apps/mobile/src/folio/store.ts) constructs both defaults and first-run state from `createEmptyWorkspacePartition`. Transaction fixture creation moved to [test/sampleFixture.ts](../../../apps/mobile/src/folio/test/sampleFixture.ts), outside production imports. |
| Missing properties during hydration | Missing array or balance properties could fall back to sample defaults. | Missing values now resolve to empty collections or neutral zero balances. Corrupt/degraded and unsupported-future-schema handling falls back to the empty first-run state rather than a prototype. |
| Older schema migration | Missing balance could become sample cash; pre-v4 debts/plans could be populated from demo defaults; v1 pot backfill could manufacture history for example pots; income migration could create a source without declared income. | Missing balance/debts/plans are neutral; known example pots do not receive historical deposit backfill; income sources are synthesized only for existing positive declared income. |
| Reset / fresh profile | The exported `resetAll` entry point repopulated the demo dataset. | `resetAll` now calls the empty reset. `resetToEmpty` and workspace creation use the same empty partition builder. |
| Calendar derivation | `deriveCalendarEvents` defaulted `includeSampleBills` to true, injecting Octopus Energy £118.40, Council Tax £162, BT Broadband £38, Rent £540, a Klarna review and generic personal deadlines. Live callers also enabled this from a balance's `sample` marker. | [calendarEvents.ts](../../../apps/mobile/src/folio/lib/calendarEvents.ts) defaults false. Every live route/screen/export caller passes false. The nudge helper explicitly passes false in both hypothetical projections. Pure historical fixture tests may opt in; dedicated captures provide their own fixture events. |
| Guided balance check-in | A fresh zero balance displayed £1,240; Continue persisted that amount as user-entered even without editing it. | [guidedBalance.ts](../../../apps/mobile/src/folio/lib/guidedBalance.ts) starts fresh/sample/invalid values at zero. [GuidedCheckInScreen.tsx](../../../apps/mobile/src/folio/screens/GuidedCheckInScreen.tsx) uses that helper. Existing real balances remain available as the rough check-in value. |
| Paste intake sample link | “or try the sample” populated Tesco −£42.30, Salary +£1,200, Rent −£750 and Boots −£8.40 in the normal import flow, where keeping them could create real-profile history. | The live sample link and its embedded financial rows were removed from [PasteSuccessScreen.tsx](../../../apps/mobile/src/folio/screens/PasteSuccessScreen.tsx). Parsing and review continue to accept the user's own text. |
| Merchant-keyed intake presentation | Matching merchant names could inherit fixture dates/categories/metadata from Paste or Visualizer examples. | The fixture metadata maps were removed from Paste and [VisualizerScreen.tsx](../../../apps/mobile/src/folio/screens/VisualizerScreen.tsx); real candidate metadata drives the display and correction flow. |
| Empty Melo context | A cleared £0 balance had a non-sample source, which was alone sufficient to claim a real financial picture. | [meloSnapshot.ts](../../../apps/mobile/src/folio/lib/meloSnapshot.ts) also requires `hasConfiguredMoneyPicture`. Empty/reset/restarted state yields zero totals and “not set up yet” context. |

The calendar caller audit covers [storeRoute.ts](../../../apps/mobile/src/folio/lib/storeRoute.ts), [TodayScreen.tsx](../../../apps/mobile/src/folio/screens/TodayScreen.tsx), [CalendarScreen.tsx](../../../apps/mobile/src/folio/screens/CalendarScreen.tsx), [PlansScreen.tsx](../../../apps/mobile/src/folio/screens/PlansScreen.tsx), [ShortfallScreen.tsx](../../../apps/mobile/src/folio/screens/ShortfallScreen.tsx), [CalendarConnectSheet.tsx](../../../apps/mobile/src/folio/sheets/CalendarConnectSheet.tsx), [CalendarExportSheet.tsx](../../../apps/mobile/src/folio/sheets/CalendarExportSheet.tsx), and [SheetDayDetail.tsx](../../../apps/mobile/src/folio/sheets/SheetDayDetail.tsx). The canonical financial plan and Melo snapshot already supplied false and continue to do so. The singular Plan hub reads the canonical financial plan rather than a second seeded plan model.

## Persisted legacy examples and cleanup

[legacySampleData.ts](../../../apps/mobile/src/folio/lib/legacySampleData.ts) retains recognition fingerprints, not an initializer. Normal profile hydration calls `stripSeedData` even for an untouched old prototype. The cleaner removes marked sample cash and transactions, `seed-*` debts/plans, matching shipped pots/subscriptions/cycles, dependent sample transaction edits, and matching sample pot backfill. Recognized sample income and its migrated source are removed only alongside sample evidence and unfinished unchanged setup. The old default £100 buffer is neutralized when attributable to an unfinished legacy sample profile.

Subscription recognition accounts for automatically derived renewal dates/day counts; an automatic hydration anchor is not evidence of a deliberate user edit. Real same-name subscriptions are preserved by evaluating individual records, and name-keyed settings are retained when a surviving real row owns that name. Cleanup must inspect explicit pause/payment/user fields before expiration sweeps erase them. This ordering was independently reviewed during closure and receives targeted regression coverage.

A main account is zeroed as sample only when its identity, historical sample balance and historical date identify the old placeholder. A different balance or date may represent user input and must not be silently discarded.

### Limits of old data reconstruction

The original prototype did not attach unambiguous provenance to every value. A user can edit an example until it is indistinguishable from a real entry, or independently create an exact match for an example. The cleaner uses explicit markers and conservative fingerprints; it cannot determine the origin of every arbitrary old record, restore missing payment history, or infer which already-paid obligations a user intended to settle. Completed/modified setup data and ambiguous financial records require manual review. The guaranteed handoff path is a true fresh install / cleared profile followed by manual setup with current figures, not an assurance that every arbitrary old import can be repaired without review.

## Bootstrap, storage and migration reachability

- [app/index.tsx](../../../apps/mobile/app/index.tsx) holds the splash until hydration completes. Ordinary startup loads the manifest-selected workspace, performs the eligible one-time archived-Melo import, then starts persistence, reminders and widgets. No financial example initializer runs on that path.
- [persist.ts](../../../apps/mobile/src/folio/lib/persist.ts) hydrates SQLCipher generations first, then scoped or legacy encrypted file generations as appropriate. Temporary/backup recovery uses the same store hydration pipeline. A missing generation is a first-run outcome, not a request for demo content.
- `tryApplyBoundCanonicalMoneyProjection` verifies parity against the already-hydrated exact state before publishing a SQL canonical projection. An old canonical snapshot that still contains removed examples fails parity and is not applied. This guards the second stage of native hydration against restoring removed data.
- The archived `melo.state.v1.json` continuity import is considered only for an eligible empty personal state. It uses the store's defensive mapper and renames the source to an imported latch. Local data deletion enumerates both the unimported and imported archive filenames, preventing a deliberate fresh profile from reimporting those local bytes.
- Business workspace creation uses a separate owned partition and empty business operations. The personal Main account shell is not synthesized into an empty business partition. Workspace ownership is asserted before reads/writes; the canonical model is not a global demo array filtered by UI flags.
- Android app backup remains disabled in [app.config.ts](../../../apps/mobile/app.config.ts), avoiding automatic OS restoration being mistaken for an empty reinstall. An explicit user restore remains a separate data-bearing action and runs hydration/validation.

## Existing confirmed reset flow

[PrivacyScreen.tsx](../../../apps/mobile/src/folio/screens/PrivacyScreen.tsx) preserves its three independently cancellable confirmation steps. No new one-tap destructive reset was introduced. Only the final confirmed branch invokes [localDataDeletion.ts](../../../apps/mobile/src/folio/lib/localDataDeletion.ts).

The deletion flow quiesces persistence, clears per-workspace native ledger data, quarantined vaults and notification runtime state, enumerates/removes local artifacts while their evidence metadata still exists, publishes the empty state and commits an empty workspace set before resuming normal writes. The store reset clears financial state and setup identity, while retaining appropriate non-financial preferences, purchase unlocks and current read-allowance counters. Financial reader caches and history are cleared. Sign-in, remote backup and bank consent retain their existing separate controls.

## Explicit developer capture isolation

The retained sample experience is the developer visual-capture harness, not a user-profile demo toggle:

1. `EXPO_PUBLIC_MELO_PARITY_CAPTURE=true` must be baked into a deliberately configured bundle. [parityHarness.ts](../../../apps/mobile/src/folio/parity/parityHarness.ts) remains inert without it, including direct activation and capture deep links.
2. Capture initialization returns before normal user persistence/reminder/widget startup; the fixture store is rebuilt in that process on launch.
3. [app.config.ts](../../../apps/mobile/app.config.ts) gives captures a separate application identity (`com.folio.v2.greenfield.capture`), “Melo QA” app label, and `folio-qa` URL scheme. The ordinary app keeps `com.folio.v2.greenfield` and `folio`. These OS identities provide separate app storage/keychain namespaces, so a capture APK does not update or read the installed real app's canonical vault.
4. [withCaptureIsolation.cjs](../../../apps/mobile/plugins/withCaptureIsolation.cjs) derives Android application identity and manifest placeholders from the same capture flag even for direct Gradle builds. Capture-related flags are declared as JS bundle task inputs so a previous capture bundle cannot be reused unchanged when flags return to production.
5. Capture OTA updates are disabled. The ordinary app's update/runtime configuration remains part of the final APK inspection.

These are source-level and automated guarantees. The final release process must inspect the generated APK identity and verify a real fresh installation; this document does not substitute for those artifact/device checks.

## Retained samples that cannot populate the current production profile

| Retained code/data | Reachability/result |
| --- | --- |
| `folio/test/sampleFixture.ts` and ordinary automated test fixtures | Only test imports construct the old sample state. Static production-import regression tests reject imports of this helper from live code. Tests may explicitly install sample data into their isolated Node process. |
| `folio/parity/fixtures.json`, business acceptance fixtures and capture reader fixtures | Reachable only through explicitly enabled capture activation. Captures use the separate app identity described above. |
| `local/localLedger.ts` `createInitialLocalLedgerState` / `refreshLocalLedgerAsOfDate` | Legacy pure helpers remain for tests. Repository import/call-site search found no invocation from the current live app bootstrap or screens. Production storage creation uses the empty helper. |
| `local/productExperienceFixtures.ts`, `productExperienceLoop.ts`, `dogfoodMode.ts` | Legacy evidence/test graphs; no current Folio screen or bootstrap invokes their sample scenario loader. |
| `FOLIO_CSV_TEMPLATE` in `folio/lib/importSheet.ts` | Exported example constant has no live app consumer. Current intake does not offer it as a production sample insertion path. Parser tests remain intact. |
| `ChartStyleSheet.tsx` sample chart points | Non-financial illustration to compare chart styles; only the chart-style preference is saved, never the points or money records. |
| `EditItemSheet.tsx` fallback named `SAMPLE` | Name, amount and date are empty. With no candidate and callback, Save only closes the sheet. |
| `EditTxnSheet`, `BillCaughtSheet`, `IncomeCaughtSheet`, image/PDF success screens | Missing targets resolve to empty/inert surfaces; they do not supply a synthetic payable transaction or obligation. |
| Onboarding pot templates | User-selectable goals; no preselection on the empty store and no funded saved balance. Explicitly selecting a goal creates the user's chosen goal with saved amount zero. |
| Melo conversation `seed` parameters | Opening text/context, not seeded finance data. Existing call sites use user/workspace-derived context or nonnumeric workflow wording. |

## Verification references

The source audit used repository-wide searches for `sample`, `demo`, `fixture`, `seed`, reset entry points, initializers, calendar derivation calls and imports of legacy helpers, followed by inspection of the actual mutation/hydration paths. Comment text was not treated as proof: the Guided and paste examples both contradicted comments claiming they were presentation-only.

Automated coverage relevant to this closure:

- [freshProductionProfile.test.ts](../../../apps/mobile/src/folio/freshProductionProfile.test.ts): cold module bootstrap, missing fields across schema versions, unsupported future schema, entered £500 cash / £100 bill / £50 buffer yielding £350 safe, module restart, both resets, retained non-financial preferences, legacy cleanup and fixture import boundaries.
- [calendarEvents.test.ts](../../../apps/mobile/src/folio/lib/calendarEvents.test.ts): default empty calendar, only entered income/subscription events, and empty nudge previews; historical demo coverage requires explicit opt-in.
- [meloSnapshot.test.ts](../../../apps/mobile/src/folio/lib/meloSnapshot.test.ts): reset/restart remains onboarding-driven with either onboarding completion flag; £100 entered cash with a £20 buffer yields £80 safe and no unrelated entities.
- [guidedBalance.test.ts](../../../apps/mobile/src/folio/lib/guidedBalance.test.ts) and [productionEntryPoints.test.ts](../../../apps/mobile/src/folio/screens/productionEntryPoints.test.ts): no £1,240 substitution, no live paste sample link, no merchant-keyed fixture metadata, no mutating fixture import in live source.
- [normalBuildPurity.test.ts](../../../apps/mobile/src/folio/parity/normalBuildPurity.test.ts) and [captureIsolation.test.ts](../../../apps/mobile/plugins/captureIsolation.test.ts): inert production capture routes/direct calls, separate QA scheme, native build identity and cache-input binding.
- [persistRecovery.test.ts](../../../apps/mobile/src/folio/lib/persistRecovery.test.ts), existing reset/deletion tests and canonical read-projection tests cover durable/recovery boundaries; final release evidence records the relevant run totals.
- [debtPaymentLedger.test.ts](../../../apps/mobile/src/folio/debtPaymentLedger.test.ts), [meloReleaseBehaviorMatrix.test.ts](../../../apps/mobile/src/folio/meloReleaseBehaviorMatrix.test.ts), and finance-engine financial-plan tests retain the prior numeric correctness scenarios.

During this audit, the focused Calendar/store-route/widget/Melo/parity run passed **76 tests in 5 files**. A subsequent focused fresh-profile run passed **22 tests in 1 file** while implementation was still being completed. These are intermediate observed results, not final suite totals and not native evidence. Final report totals should be taken from the last completed release verification run.

## Final isolation verification

Capture builds also disable Clerk, cloud backup/sync, Open Banking and billing/purchase entry points at their configuration boundaries, even if environment or Expo extras contain real service configuration. The retired remote AI client remains inert. The native QA manifest was built and verified as com.folio.v2.greenfield.capture, with all ten content provider authorities isolated; no QA APK was installed. The following production build re-executed its JS bundle task after this QA build, exercising the environment-sensitive cache boundary.

The final relevant suite passed 2,325 tests in 236 files, including 54 net new tests. Earlier counts above describe intermediate runs only. The signed artifact and native acceptance are recorded in HYGIENE_REPORT.md and native-results.md.
