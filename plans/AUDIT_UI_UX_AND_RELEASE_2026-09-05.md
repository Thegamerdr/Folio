# Melo UI, UX and release audit — 5 September 2026

## Verdict

**Not finished. Not release-ready. Not at “only add secrets” stage.**

There is a substantial foundation worth continuing: a coherent visual identity, real native entry paths, a local-first architecture, explicit review before financial writes, and a large passing regression suite. That does not outweigh confirmed data-safety defects, incomplete product wiring, and visible interaction/layout failures.

The previous “zero local engineering blockers” assessment was incorrect. The release tool reports zero blockers *classified* as local; it does not establish that the application has no local defects. This audit identifies local work that must be reopened. Use this candidate for supervised, synthetic-data evaluation, not as a trusted finished financial product.

This is an internal product/code audit, not an independent security, accessibility, regulatory or store sign-off. No implementation fixes were made.

## Scope and fresh evidence

- Source reviewed: branch `codex/melo-native-true-parity-2026-08-25`, HEAD `2effcd7365237728ae98485101728c4f8aa341f2`.
- Physical device: Samsung Galaxy S9 SM-G960F, connected by USB. Inspected the actual installed app, not only screenshots from earlier work.
- Installed package: `com.folio.v2.greenfield`, version `0.0.1`, version code `1`; last update 1 September 2026, 10:40:29.
- On-device APK SHA-256 matches the [September 1 candidate](C:/dev/melo-native-today-batch1-2026-08-24/release-artifacts/melo-0.0.1-2026-09-01/melo-0.0.1-1-arm64-release.apk) and [candidate record](C:/dev/melo-native-today-batch1-2026-08-24/docs/release-evidence/MELO_ANDROID_RELEASE_CANDIDATE_2026-09-01.md:13): `5763D05B50F4BA47B3DBA8F7266C265AF1C2B3F4ADE5777A1E87140C918FAF1D`. This proves APK identity; active OTA JavaScript identity was not independently extracted.
- `pnpm test --reporter=dot`: **249 test files, 2,726 tests passed**.
- Mobile TypeScript: `pnpm --filter @folio/mobile exec tsc --noEmit --incremental false --composite false` passed. The initial command without `--composite false` was rejected because a composite project cannot disable incremental; that was a command-option issue, not an application type error.
- `pnpm release:status`: **BLOCKED**, public release flag disabled, 23/23 open ledger items: 14 release, 6 beta, 3 roadmap.
- `pnpm store:status`: **BLOCKED**, declarations 7/7 prepared, 0/7 submitted, 3/7 binary-matched, 10 blockers; privacy-policy-current flag false.
- `pnpm audit --prod --json` produced no result during the bounded attempt and was interrupted. Dependency-vulnerability status is **inconclusive**, not clean.
- Reproduced concurrent sync write loss using the actual coordinator source transpiled in memory with clone-on-read/write storage. No deployed service was contacted.

On S9 I inspected Today, Plan and its expanded actions, Review, More, the Add a bill form, Search Melo/chat with and without keyboard, Money sources, and Intake. Debts and Log a transfer were tapped and did not navigate. Add a bill opened its form. The statement action opened Android's real document picker; it was cancelled without selecting a file. Sources explicitly reported provider connections off in this build.

No financial records were added or removed; no workspace reset, backup replacement, purchase, bank connection, microphone session, permission change, account mutation, build, install or deployment was performed. Existing unrelated workspace changes were preserved. Populated financial scenarios were traced in source rather than seeded onto the owner's phone.

## What is already good

- Keep the warm cream/terracotta palette and serif/sans typography. The identity is consistent and distinctive.
- The Today first-use primary action is understandable. The native Add a bill form has a clear purpose and large numeric controls.
- Native statement acquisition is real: the device opens the system picker. Provider connections do not falsely appear connected on this candidate.
- Local-first storage and review-before-commit are sound product principles. The existing tests provide useful protection for many pure-domain and persistence rules.
- There is meaningful release preparation and explicit gating. The problem is the completeness of the implementation and evidence, not a need to discard the project.

## Priority findings

Priority P1 means fix before releasing the affected capability. P2 means a meaningful correctness/UX improvement before a polished beta. Effort S/M/L is relative scope, not a promised duration. “Fix risk” describes the risk of introducing regressions while repairing the issue.

### A01 — P1: Editing payday/income can erase the workspace

**Evidence:** [PlanScreen.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/screens/PlanScreen.tsx:300) exposes “Payday and income” as an editor and opens onboarding. [AccountScreen.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/screens/AccountScreen.tsx:1062) also offers the route. In [OnboardingSheet.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/sheets/OnboardingSheet.tsx:519), completion unconditionally calls `resetToEmpty()`; “Skip for now” does the same at line 605. [store.ts](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/store.ts:5896) clears transactions, accounts, pots, subscriptions, review/evidence metadata, debts, plans and income sources.

**Impact:** A returning user intending to edit income, or skip the form, can lose their existing money history. This is not merely sample cleanup: the entry routes are available to returning users. Deliberately not triggered on S9.

**Improve:** Separate first-run/sample cleanup from returning-user editing. Cancellation must not mutate money data. Test both save and skip against a populated workspace, including another workspace remaining isolated.

**Effort M · Fix risk MED · Confidence HIGH — source-confirmed.**

### A02 — P1: Plan's headline amount covers a different period from its label

**Evidence:** [planModel.ts](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/screens/planModel.ts:18) selects all outgoing events in the calendar window; the comment explicitly describes a 35-day window not truncated at payday. [PlanScreen.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/screens/PlanScreen.tsx:192) totals those rows, while line 341 says “Between now and payday” and line 359 labels the amount as over the days to payday. The payday-period label is visible on S9.

**Impact:** Commitments after the next payday can be represented as due before it, particularly for weekly/fortnightly earners. A passing test enforcing the 35-day model does not make the label correct.

**Improve:** Make the total, count, date list, tight-point period and captions agree. Test commitments immediately before, on and after payday.

**Effort M · Fix risk MED · Confidence HIGH — source-confirmed; populated mismatch not run on the owner's phone.**

### A03 — P1: A fresh device can overwrite a recoverable cloud backup

**Evidence:** [CloudBackupSheet.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/sheets/CloudBackupSheet.tsx:44) knows when a remote backup exists but the local recovery code does not. Its primary backup action remains enabled at line 216. [cloudBackupNative.ts](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/lib/cloudBackupNative.ts:83) generates a new recovery code when none is stored and uploads the current local workspace. [index.ts](C:/dev/melo-native-today-batch1-2026-08-24/services/cloud-vault/src/index.ts:161) serves the current backup; PUT rotates the generations at line 215.

**Impact:** On a fresh device, “Back up now” can replace the remote head with an empty/new workspace encrypted under a different code. A previous generation initially exists, but the normal restore route does not let the user select it; subsequent replacement can rotate away the original.

**Improve:** Require an explicit restore-or-replace decision when remote data exists without a local key; default to recovery. Protect replacement with generation preconditions and expose safe generation recovery.

**Effort M · Fix risk MED · Confidence HIGH — source-confirmed, conditional on cloud configuration.**

### A04 — P1: Concurrent sync uploads can both succeed while only one survives

**Evidence:** [sync-workspace.ts](C:/dev/melo-native-today-batch1-2026-08-24/services/cloud-vault/src/sync-workspace.ts:82) loads state before asynchronous request parsing/checksum work. The upload path allocates `headCursor + 1` and writes operation, idempotency and state separately around lines 210–220. The outer Durable Object wrapper does not serialize that application-level mutation.

**Reproduction:** Two registered devices each upload a distinct operation at sequence 1 concurrently. With the actual source and clone-on-read/write memory storage, both return HTTP 201, `duplicate:false,cursor:1,headCursor:1`; only **one operation** remains stored. This was reproduced independently within the audit, without artificial scheduling delays.

**Impact:** The coordinator can acknowledge an operation that disappears. This is a module-level reproduction, not evidence that a deployed Cloudflare service has lost user data.

**Improve:** Serialize the read/validate/allocate/write mutation or use a suitably atomic transaction. Add concurrent upload, revoke/upload and retry tests with faithful storage value semantics. The existing test mock returns a shared object on get at [sync-workspace.test.ts](C:/dev/melo-native-today-batch1-2026-08-24/services/cloud-vault/src/sync-workspace.test.ts:8).

**Effort M · Fix risk MED · Confidence HIGH for the module defect; deployed-runtime concurrency validation still required.**

### A05 — P1: Sync device revocation can be bypassed by claiming another device ID

**Evidence:** [index.ts](C:/dev/melo-native-today-batch1-2026-08-24/services/cloud-vault/src/index.ts:399) validates the account session, not proof of possession of a registered device key. It forwards caller-supplied device headers at line 286. [sync-workspace.ts](C:/dev/melo-native-today-batch1-2026-08-24/services/cloud-vault/src/sync-workspace.ts:84) exposes the device list within that account; write/revocation authorization trusts the header-selected device.

**Impact:** A revoked device retaining a valid account session can present another active device's ID and bypass device-level control checks. This is an authorization/integrity problem; it does not establish plaintext decryption or cross-account access.

**Improve:** Bind requests to an authenticated device identity/proof and define a trusted enrollment/rotation process. Test a revoked device using an active device ID and a stale session.

**Effort L · Fix risk HIGH · Confidence HIGH — source-confirmed, fix before enabling sync.**

### A06 — P1: Cloud sync exists as helpers, not a wired mobile feature

**Evidence:** [cloudSyncNative.ts](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/lib/cloudSyncNative.ts:15) exports authenticated API, encryption and replay helpers. Searching shipping `apps/mobile/src` and `apps/mobile/app` finds no production callers of these exports. The visible cloud entry is the manual backup sheet, not device enrollment plus ongoing mutation/replay integration.

**Impact:** Adding cloud secrets does not make multi-device sync work. Missing product integration includes the device/key lifecycle, durable outgoing operations, replay application and user-visible state.

**Improve:** Complete one end-to-end two-device workflow, including offline edits, restart, replay, conflict handling and revocation. Keep manual backup distinct from sync in claims and UI.

**Effort L · Fix risk HIGH · Confidence HIGH — source/reachability-confirmed.**

### A07 — P1: Bank import advances before the phone durably receives the rows

**Evidence:** [index.ts](C:/dev/melo-native-today-batch1-2026-08-24/services/open-banking/src/index.ts:441) uses an initial 90-day range, then a 3-day refresh overlap. It advances cursor/refresh state at lines 481–491 and persists the connection at line 525 before returning candidates. [BankConnectionSheet.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/sheets/BankConnectionSheet.tsx:167) puts the response into React state; only the later “send to review” action at line 221 enqueues it durably.

**Impact:** Closing/reopening the sheet, restarting the app, retrying refresh, or losing the response can discard an already-advanced batch. Older rows may not return on the next refresh. This matters even after TrueLayer credentials are provided.

**Improve:** Implement retryable batch delivery with durable staging and acknowledgment. Preserve review-before-acceptance; durable receipt is not permission to add transactions automatically. Test response loss and process death before review.

**Effort L · Fix risk MED · Confidence HIGH — source-confirmed; live banking remains disabled.**

### A08 — P1: Valid subscription grants with fractional seconds are rejected

**Evidence:** [google.ts](C:/dev/melo-native-today-batch1-2026-08-24/services/billing-entitlements/src/google.ts:128) preserves the provider's expiry milliseconds. [signing.ts](C:/dev/melo-native-today-batch1-2026-08-24/services/billing-entitlements/src/signing.ts:30) floors JWT expiry to seconds, while [entitlementGrant.ts](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/lib/billing/entitlementGrant.ts:110) requires exact millisecond equality with `graceUntil`.

**Impact:** A genuine subscription expiry such as a timestamp ending in `.123Z` yields a validly signed grant that the mobile verifier rejects. Google's API explicitly permits fractional-second expiry timestamps. [Google expiryTime contract](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2#SubscriptionPurchaseLineItem).

**Improve:** Define one canonical time precision shared by issuer and verifier. Test an actual backend-signed token through mobile verification, including fractional expiry and grace boundaries.

**Effort S · Fix risk LOW · Confidence HIGH — source-confirmed.**

### A09 — P1: Android subscription purchase requests omit the selected offer token

**Evidence:** [iap.ts](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/lib/billing/iap.ts:104) queries subscription products but discards offer metadata. Purchase at line 179 sends only Google SKUs. The installed expo-iap 4.3.6 wrapper forwards an empty offer list when none is provided; there is no application offer selection. Android subscriptions require offer tokens from product discovery. [OpenIAP subscription contract](https://www.openiap.dev/docs/features/subscription).

**Impact:** A reachable/listed store does not imply the Live subscription can actually be purchased with this request.

**Improve:** Retain the eligible base plan/offer selected by the user and pass its token. Validate with licensed Play testers using the signed candidate.

**Effort M · Fix risk MED · Confidence HIGH — source and installed-library contract checked; no purchase attempted.**

### A10 — P1: Renewal and pending-purchase reconciliation is missing

**Evidence:** `refreshAfter` is issued by [index.ts](C:/dev/melo-native-today-batch1-2026-08-24/services/billing-entitlements/src/index.ts:154) and parsed by the mobile verifier, but has no scheduling consumer in the app. [iap.ts](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/lib/billing/iap.ts:156) removes purchase listeners when resolving the initial outcome, including `pending`. Store queries are tied to purchase/manual restore rather than an ongoing reconciliation lifecycle.

**Impact:** A paid renewal can outlive the cached grant and become locked after its grace period. A pending purchase later approved may not unlock automatically without manual restore.

**Improve:** Reconcile on start/foreground, at grant refresh time, and on later purchase updates; keep verification before acknowledgment/unlock. Test renewal, pending-to-purchased, cancellation, offline grace and restore.

**Effort M · Fix risk MED · Confidence HIGH — source-confirmed.**

### A11 — P1 for iOS launch: Billing remains Google-only

**Evidence:** iOS is a configured target, but [iap.ts](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/lib/billing/iap.ts:95) can report store availability without an iOS capability gate; line 179 constructs only a Google purchase request. [PaywallScreen.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/screens/PaywallScreen.tsx:368) follows Google verification; the billing backend exposes Google verification, not an Apple receipt/transaction path.

**Impact:** This is missing implementation, not merely missing an iPhone or Apple secrets.

**Improve:** Either explicitly exclude/gate iOS purchasing for an Android-only release, or implement and test the Apple purchase/verification/restore lifecycle.

**Effort L to implement, S to explicitly gate · Fix risk MED · Confidence HIGH — source-confirmed.**

### A12 — P1 before OTA publication: Native changes share an unchanged runtime identity

**Evidence:** [app.config.ts](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/app.config.ts:76) retains version `0.0.1`, uses the appVersion runtime policy and enables production updates. Native voice/passkey additions were introduced while that version stayed unchanged. Older and newer native binaries can therefore share the same update compatibility identity.

**Impact:** An OTA bundle needing a new native module can be offered to an older binary that lacks it. No incompatible OTA publication was performed or demonstrated in this audit. Expo requires runtime compatibility to track native changes. [Expo runtime-version guidance](https://docs.expo.dev/eas-update/runtime-versions/).

**Improve:** Establish a new compatible runtime boundary and rebuild before publication; use a robust native-change/version check or fingerprint policy.

**Effort S · Fix risk LOW for configuration, rebuild/device checks required · Confidence HIGH — source/history-confirmed.**

### A13 — P1 for Business backup promise: Clean-device recovery has no complete activation path

**Evidence:** [persist.ts](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/lib/persist.ts:1236) creates a random Business workspace ID. A recent Personal backup **can** retain that ID through the serialized workspace registry in [store.ts](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/store.ts:1980). However, [restoreNative.ts](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/lib/restoreNative.ts:81) restores the selected partition only. On a clean device the missing Business partition returns first-run at persist.ts line 450; switching rejects because it was not activated at line 1320. The cloud restore sheet only targets the active workspace.

**Impact:** Recovering the registry is not sufficient to reach and restore the missing Business partition. If only Business was backed up, its original locator also lacks a discovery path. This is not a claim that every Business ID is unrecoverable.

**Improve:** Provide an authenticated workspace recovery selector/activation path that can safely restore a missing partition without creating a conflicting new ID. Test Business-only and Personal-then-Business clean-device recovery.

**Effort L · Fix risk HIGH · Confidence HIGH in source tracing; full clean-device drill outstanding.**

### A14 — P2: Visible navigation promises exceed the actual handlers

**Evidence:** On S9, Plan's Debts and Log a transfer rows did not navigate when tapped. [PlanScreen.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/screens/PlanScreen.tsx:285) leaves Debts, Sub check-in, Log a transfer and Pair a refund without handlers while rendering normal action rows. More's “Search Melo — jump to pots, subscriptions, settings and actions” opens chat, confirmed live and in [MoreScreen.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/screens/MoreScreen.tsx:141).

**Impact:** Users cannot distinguish complete actions from unfinished ones; the supposed search doorway does not provide the promised search UI.

**Improve:** Wire the destinations, or explicitly label/hide unavailable capabilities. A chat/help shortcut should be named as such unless it genuinely implements navigational search.

**Effort M overall · Fix risk LOW–MED · Confidence HIGH — live plus source.**

### A15 — P2: Scrolling and companion placement obscure the interface

**Evidence:** On S9 Plan, scrolling puts “The next few dates” over the system clock/status icons. [PlanScreen.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/screens/PlanScreen.tsx:328) applies the top inset to scrolling content, not an opaque/non-overlapping viewport boundary. The floating Melo character visibly covers tight-point prose, the Add something label and refund actions. [ShellMeloCompanion.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/ui/ShellMeloCompanion.tsx:212) positions the companion in an absolute overlay. Review additionally displays an embedded empty-state companion at [ReviewScreen.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/screens/ReviewScreen.tsx:706), producing two birds at once.

**Impact:** Content becomes less readable and actions appear obstructed. These are actual S9 rendering failures, not a preference for a different brand.

**Improve:** Reserve the safe status-bar region; give the companion a non-obscuring slot, content-aware exclusion regions or a suppression rule. Do not duplicate it where an inline empty-state companion already communicates the state.

**Effort M · Fix risk MED · Confidence HIGH — live and source.**

### A16 — P2: Chat keyboard layout clips the header and composer

**Evidence:** More → Search Melo automatically opens chat with the keyboard on S9. The header is clipped at the top and the Voice/input/Send row is visibly cut at its lower edge. Dismissing the keyboard restores the normal sheet. Relevant constraints are [Sheet.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/surfaces/pressureMap/Sheet.tsx:273) and [MeloChatSheet.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/sheets/MeloChatSheet.tsx:1464). Separately, the Send/Stop Pressable has a 32×32 visual child and no enlarged hit target at lines 1255 and 1289.

**Impact:** The primary conversation surface is not reliably legible or comfortable when users are actually typing.

**Improve:** Validate available keyboard height, safe-area and nested scrolling as one layout contract; retain visible header/close/composer and enlarge the Send/Stop target. Recheck on S9, smaller screens and large text.

**Effort M · Fix risk MED · Confidence HIGH for observed clipping/target size; exact layout correction requires implementation testing.**

### A17 — P2: Notifications looks like navigation but silently toggles a setting

**Evidence:** [MoreScreen.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/screens/MoreScreen.tsx:174) presents “Notifications — what Melo may say, and when” as a chevron row, but invokes `reminders.toggleEnabled`. The row displays neither current enabled state nor the result/permission state.

**Impact:** Tapping what looks like a settings destination changes reminders without clear feedback.

**Improve:** Open a settings screen, or present an explicit labeled switch with permission-denied and enabled/disabled states. Not toggled on the owner's phone during the audit.

**Effort S–M · Fix risk LOW · Confidence HIGH — source and visible row.**

### A18 — P2: First-use guidance includes stale prototype claims

**Evidence:** [IntakeScreen.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/screens/IntakeScreen.tsx:714) says files/photos are read “in the mobile app” and show worked examples “for now”—inside the native app, whose statement action actually opened Android's picker during this audit. Review's empty state offers no immediate add/import action and says newly found items will appear, while the S9 sources screen explicitly reports provider connections off.

**Impact:** Users receive contradictory explanations about what is real and insufficient guidance about how to get the first useful result.

**Improve:** Replace prototype-specific copy with the actual acquisition/review contract. Make empty Review distinguish “no source added” from “everything reviewed,” with a relevant next action.

**Effort S · Fix risk LOW · Confidence HIGH — live plus source.**

### A19 — P2: Date-driven views can remain anchored to yesterday

**Evidence:** [TodayScreen.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/screens/TodayScreen.tsx:182), [PlanScreen.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/screens/PlanScreen.tsx:147) and [CalendarScreen.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/screens/CalendarScreen.tsx:321) set their clock only at mount. [FolioShell.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/shell/FolioShell.tsx:646) refreshes some subscription state on foreground, but not those screen clocks.

**Impact:** A screen kept mounted across midnight/background resume can retain the wrong “today,” payday distance and derived timeline until remounted.

**Improve:** Use a shared day/clock signal refreshed at foreground/day rollover, with timezone-change and payday-boundary tests.

**Effort M · Fix risk LOW–MED · Confidence HIGH — source-confirmed; no device clock changed.**

### A20 — P2 before live billing: Displayed prices and availability are not SKU-specific

**Evidence:** [PaywallScreen.tsx](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/screens/PaywallScreen.tsx:88) hardcodes GBP prices and uses them in its price model at line 333. [iap.ts](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/lib/billing/iap.ts:104) treats any returned product as sufficient overall availability. The metadata query helper has no consumer supplying localized prices to the paywall.

**Impact:** Real store prices/regions can differ from the app's displayed offer; a partial catalog can expose unavailable SKUs.

**Improve:** Render localized prices and sale eligibility for the exact returned product/offer, and gate each CTA independently.

**Effort M · Fix risk LOW · Confidence HIGH — source-confirmed; no store transaction performed.**

### A21 — P2: Voice success evidence and permission failure handling are insufficient

**Evidence:** The stored [listening screenshot](C:/dev/melo-native-today-batch1-2026-08-24/docs/release-evidence/s9-2026-09-01-voice-listening.png) and [transcript screenshot](C:/dev/melo-native-today-batch1-2026-08-24/docs/release-evidence/s9-2026-09-01-voice-transcript.png) both show an idle chat composer, not captured speech. Their filenames are not proof of successful listening/transcription. [useMeloVoiceTranscript.ts](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/lib/useMeloVoiceTranscript.ts:125) awaits native permission calls outside its try/catch after setting the phase to starting; permission-call rejection lacks phase recovery there.

**Impact:** Voice cannot be called end-to-end proven by those artifacts. A native permission exception can leave an unsuccessful start without the intended recovery UI. Whether a particular OS permission dialog also triggers the lifecycle-generation cancellation needs device-specific testing; that possibility is not counted as a reproduced defect.

**Improve:** Catch permission-request failures and restore a usable state. Capture a deliberate spoken phrase, transcript review, cancel/retry and app-background interruption on real devices, without recording bystanders.

**Effort M · Fix risk MED · Confidence HIGH for evidence gap and uncaught permission call; OS-dialog behavior unverified.**

## Why the green tests did not establish completion

The 2,726 passing tests are valuable, but their scope matters. For example, [PaywallScreen.test.ts](C:/dev/melo-native-today-batch1-2026-08-24/apps/mobile/src/folio/screens/PaywallScreen.test.ts:28) checks helpers/copy rather than rendering a purchase journey. The onboarding test reproduces reset/setup logic around a sample fixture instead of protecting a returning user's populated workspace through the actual UI handler. The sync mock's shared-reference reads hide the lost-update scenario reproduced above.

Add release acceptance tests around real boundaries: returning-user edit/cancel, interrupted bank delivery, two-device concurrency, signer-to-mobile grants, listed-product purchase/renewal/restore, and keyboard/safe-area UI. A screenshot with a successful-sounding filename, a route stub, a helper export, or a checklist classification is not end-to-end evidence.

Do not raise a “mobile excluded from typechecking” defect: the root package typecheck includes mobile, and the explicit mobile check passed.

## UI/UX direction, separate from defects

1. **Keep the identity; reduce repeat-use overhead.** Retain typography and palette, but make Plan/More introductions more compact after first use so useful content appears sooner. Validate the change with task completion/scrolling observations, not taste alone.
2. **Make state obvious.** Present connected/not configured, enabled/disabled, empty/all reviewed, available/not yet supported as distinct user-readable states. Every chevron should lead somewhere.
3. **Make the first useful result easy.** Provide one clear route from an empty app to adding information, reviewing it, and understanding the resulting money picture. Avoid implying automatic discovery when no source is connected.
4. **Give Melo a deliberate role.** One companion per context, never over money or controls; match empty-state conversation to the actual amount of known data.

## Recommended order and acceptance bar

1. Protect existing data: A01, A03, A04, A05, A07 and clean-device recovery.
2. Correct financial meaning and time: A02 and A19.
3. Close actual feature contracts: sync enrollment/replay, billing lifecycle, deliberate platform scope and runtime compatibility.
4. Repair the directly observed S9 UI failures and navigation mismatches; add interaction tests for them.
5. Re-run a populated, isolated test-device matrix plus provider/store sandbox journeys; then address production credentials, deployment, external reviews and store submission.

Secrets can be prepared in parallel, but cannot substitute for this implementation work. Remaining external gates still include real provider proof, iOS evidence if shipping, independent security/accessibility review, operational ownership, privacy/legal approval and store verification.

### Limits of this audit

No comprehensive populated visual matrix, full iOS run, real bank connection, purchase/renewal, large-file/OCR endurance test, performance benchmark, independent penetration test, TalkBack/VoiceOver sign-off, legal/tax validation, or full dependency vulnerability result was obtained. The findings are prioritized evidence, not a guarantee that these are the only defects.

Only this report was created. The improve skill kept the work advisory and separated confirmed findings from optional design direction; no source fixes or provider/device data changes were made. Implementation plans should be selected from this prioritized audit rather than treating every cosmetic suggestion as a release blocker.

