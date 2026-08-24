# Release Blocker Register

## Current authority — Melo release completion (2026-08-24)

The machine-readable register at `tooling/config/release-blockers.json` is the live authority. The
historical Folio/V2 tables below are retained as evidence history and must not override this section.

Current product truth:

- Product name is **Melo**; owner brand decision is settled.
- Android package and iOS bundle are deliberately `com.folio.v2.greenfield`; do not reopen the
  package-ID decision from stale checklists.
- Current version is `0.0.1`; Android versionCode is `1`.
- Billing is `folio.full` (one-time Full) plus `folio.live.monthly`/`folio.live.yearly` (Live
  subscriptions). `folio.plus.*`/`folio.pro.*` are restore-only legacy IDs, not products to sell.
- The local core is usable without an account. Cloud Vault/Clerk and billing are optional; Open
  Banking is disabled in the current candidate and requires an explicit approved-build flag. Raw-
  data AI transport is retired and the enum-only route is future/optional.
- Current DPIA/privacy/store drafts are in `docs/source-package/release/DPIA_CURRENT_MELO_2026-08-24.md`,
  `PRIVACY_POLICY.md` and `docs/release-store/CURRENT_STORE_SUBMISSION_PACKAGE_2026-08-24.md`.
- The internal tabletop and safe rotation dry-runs are executed in `docs/release-operations/`.
  Vulnerability disclosure is process-ready but requires the owner to confirm a real contact route.
- The upload-signed arm64 Android AAB is bundletool/manifest/signature verified at SHA-256
  `3354FB6F69B589BC15776520820AD3E66ECD62DAEB0CB72F7A1E97F7EC326FF1`; a matching signed
  x86_64 tester passed current emulator runtime, 200% text, reduced-motion and real TalkBack smoke.

Every live blocker has an exact disposition in `blockerDispositions`: `CLOSED`, `BLOCKED EXTERNAL`
or `BLOCKED OWNER DECISION`, with a concrete action. Independent security, accessibility,
privacy/legal and store-console sign-offs remain external and are not self-closed.

The single owner handoff is [OWNER_ACTION_PACK.md](OWNER_ACTION_PACK.md). It covers the public
contact/URL choice, Play developer verification and billing/listing proof, optional production
deletion/provider E2E, independent review signatures and remaining physical/iOS evidence.

Date: 2026-06-23

Updated 2026-06-30 (evening) — commits eb6e0a0/3783c9c/a3f81c9 (+ 7147884 AUDIT.md). Reviewed
against tonight's RN faithful-port work (`claude/folio-rn-faithful-port`). That work was app-behavior
correctness — sample-data purge/gating, Melo mood wiring, a dark-mode fix, scroll fixes, a real
"start fresh", import-date fix, and the AI cost split. None of it produces the device/iOS/legal/store/
security-review evidence these gates require, so **no blocker row below is marked resolved by it**;
the gates stand. See "Tonight's RN work vs these gates" under the status summary.

Purpose: make release blockers auditable without claiming Folio V2 is public-release-ready.

### 2026-07-16 storage-authority update

The final dual-ABI Android release artifact now proves lossless SQLCipher AppState/root authority,
whole-database recovery, atomic schema-v8 canonical mirroring for all 44 durable AppState fields and
privacy-minimal typed-command writes for mapped shipping mutation paths.
The mapped balance command was read back from the encrypted database, survived a cold start and was
then removed through the product's three-stage clear. See
`docs/release-evidence/ANDROID_TYPED_COMMAND_BRIDGE_2026-07-16.md`.

All durable AppState fields now have a generation-bound boot read candidate: canonical SQLCipher is
adopted only when its current snapshot binding and inverse projection match the exact encrypted
AppState generation. Otherwise the exact generation remains the lossless recovery authority. See
`docs/release-evidence/ANDROID_CANONICAL_FULL_APPSTATE_AUTHORITY_2026-07-16.md`.

This does not close public release: the remaining import/restore/endurance matrix, iOS, production
account deletion/providers, independent reviews, store submissions and operations evidence remain
open.

Status summary:

- Owner Android dogfood: not blocked by public-release gates; still needs physical Android evidence.
- External beta: blocked by device, security, privacy, accessibility, research and support evidence.
- Public release: blocked by store, legal, security, billing, iOS, cloud/account and operational evidence.

### Tonight's RN work vs these gates (2026-06-30 evening)

The RN faithful-port fixes (commits eb6e0a0/3783c9c/a3f81c9) improve the app's pre-device correctness
but do not satisfy any evidence requirement in the tables below:

- **Clean reset / start-fresh** (Owner Dogfood — "Clean reset and seed repeatability"): More -> "Start
  fresh" previously called `resetAll`, which **reseeded the demo** ("it all came back"); it now calls
  `resetToEmpty` behind a one-tap confirm (commit a3f81c9). This makes a clean reset actually clear to
  empty, but the row's evidence (reset screenshot + canonical counts after reset, **on the phone**) is
  still pending, so the row stays open.
- **Sample-data purge** strengthens the same reset story: a cleared app now shows only the user's data
  (fabricated chart/summary/calendar/reader rows are gone or gated behind `currentBalance.source ===
'sample'`). Again: improves dogfood quality, does not produce on-device evidence.
- Everything else tonight (Melo mood wiring, dark-mode/scroll/import-date fixes, AI cost split) is
  unrelated to the gate evidence and is documented in `AUDIT.md` §0.

Still open after tonight (owner/QA, not RN bugs): exhaustive per-screen dark-mode + cross-device visual
pass on an emulator; iOS (needs a Mac/EAS — unbuildable on the Windows dev box). Gateway status
(2026-07-11): redeploy DONE with metering live (model allow-list to the two cheap Gemini tiers,
per-device 40 reads/mo backstop, global 500 reads/day + 2,000 chats/day) — the remaining piece is the
key-level spend limit in the OpenRouter dashboard, which only the owner can set (credentials).

### 2026-07-11 update — night run landed; dogfood rows re-scoped to the SHIPPED persistence stack

The 12-plan night run (`plans/101-112`, commits `c2e2d06`..`9fb7f8b`) plus the stability
truth fix (`a210de8`) landed: hydration degraded-load→backup recovery + a 10-scenario
recovery test matrix, root/screen error boundaries with Sentry capture, durable ProGuard
rules, trial-ended acknowledgement, mode-aware headers, and a ~34.5k-line dead-code
excision. The release APK (R8-shrunk, arm64) was **installed in place on the owner's
physical phone with data preserved and launched clean** — see the first Owner Dogfood row.

The Owner Dogfood rows below previously pointed at the `src/local/` canonical-ledger stack
(`dogfoodMode.ts`, `nativeLedgerStore.ts`, SQLCipher, `nativeDogfoodDiagnosticExport.ts`).
That layer is NOT in the shipped binary (held back behind an owner decision — dead weight
vs staged migration target). The shipped app persists via the encrypted single-blob stack:
`apps/mobile/src/folio/lib/persist.ts` (atomic write + proven-good backup + parked
unreadable blob + degraded-load recovery) with the key in expo-secure-store
(`lib/vaultKey.ts`). Rows re-scoped accordingly; the diagnostic-export row's old
"implemented" status was false for the shipped binary and is corrected.

That 2026-07-11 persistence description is now historical. As of 2026-07-16, the shipping
`persist.ts` path commits the encrypted exact recovery generation together with a schema-v8
SQLCipher canonical snapshot and generation binding. All 44 durable AppState fields have
generation-bound/inverse-parity read authority; only the diagnostic-export observation above remains
held back. The current proof is
`docs/release-evidence/ANDROID_CANONICAL_FULL_APPSTATE_AUTHORITY_2026-07-16.md`.

## Owner Dogfood Blockers

| Blocker                                  | Severity | Status                                                             | Why it matters                                                              | Evidence required                                                 | Files/systems affected                                                                                                                       | Windows? | Android device? | macOS/Xcode? | Legal/business? | Recommended next action                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | -------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------- | ------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Physical Android install and launch      | P0       | **resolved 2026-07-11**                                            | Owner dogfood cannot be trusted until the current APK runs on a real phone. | install log, launch screenshot, first screen screenshot, APK hash | `apps/mobile/android`, owner device, `ANDROID_INSTALL_FOR_OWNER.md`                                                                          | yes      | yes             | no           | no              | DONE: arm64 release APK (commit `a210de8`, SHA-256 `C1E76B76947F899A01DA470F28D20B875550895FE30529ED5E9C4110B1C56279`) installed in place on the owner's Galaxy S9 (`install -r` Success, data preserved), launched clean (process alive, zero FATAL in logcat), first-screen screenshot captured showing the owner's real hydrated state. Repeatable per new build. |
| Clean reset and seed repeatability       | P0       | repo fix + release-emulator proof; physical proof pending          | Owner must be able to reset and repeat scenarios without stale data.        | Dogfood reset screenshot, empty-state proof after reset           | `apps/mobile/src/folio/store.ts` (`resetToEmpty`), More/Privacy/Account screens                                                              | yes      | helpful         | no           | no              | Release-built emulator proof now covers the three-stage clear, canonical/rollback/parked-family removal and honest empty doorway with no demo reseed. Repeat the shipped reset on the physical phone before owner-dogfood signoff.                                                                                                                                   |
| Redacted diagnostic export               | P0       | **not in shipped binary** (status corrected 2026-07-11)            | Bugs need useful evidence without exposing raw financial data.              | exported JSON/Markdown, redaction review, file path proof         | held-back layer only (`nativeDogfoodDiagnosticExport.ts` — unreachable from the shipped app)                                                 | yes      | yes             | no           | no              | Decide: wire a redacted export into the shipped app (small feature: store snapshot minus raw statement text/merchants), or accept adb logcat + Sentry (plan 109) as the dogfood evidence channel and move this row to the External Beta tier.                                                                                                                        |
| Local storage and key behavior on device | P0       | schema-v8 repo + release-emulator proof; physical key-loss pending | Owner data should not silently fall back or vanish unexpectedly.            | restart persistence, clear-data proof, key-loss behaviour         | `apps/mobile/src/folio/lib/persist.ts`, `canonicalStateProjection.ts`, `canonicalAppStateReadProjection.ts`, `vaultKey.ts`, `@folio/storage` | partly   | yes             | no           | no              | Release-built proof covers exact+canonical atomic writes, SQL-only restart, corrupt-family quarantine/rebuild, interrupted migration, cold start and full local clear. Earlier physical in-place update preserved data. Still owed: physical clear/reinstall and secure-store key-loss drill.                                                                        |
| Crash or blank-screen recovery           | P1       | repo hardened (plan 109), device drill pending                     | Dogfood must produce useful recovery evidence if the app fails.             | logcat capture, reinstall/clear instructions verified             | `app/_layout.tsx` RootErrorBoundary + FolioShell ScreenErrorBoundary (both Sentry-captured), APK, `ANDROID_INSTALL_FOR_OWNER.md`             | yes      | yes             | no           | no              | Landed: a render crash now shows a recoverable error screen (root + per-screen boundaries, zero folio imports in the root one) and reports to Sentry instead of a silent blank screen. Still owed: a forced-crash drill on the phone proving the boundary + a captured logcat.                                                                                       |

## External Beta Blockers

| Blocker                          | Severity | Status                                                                               | Why it matters                                                   | Evidence required                                                  | Files/systems affected                                                  | Windows? | Android device? | macOS/Xcode? | Legal/business?      | Recommended next action                                                                                                                                                                     |
| -------------------------------- | -------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------- | --------------- | ------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Physical Android dogfood signoff | P0       | open                                                                                 | Trusted testers should not see issues owner testing would catch. | completed dogfood script, bug reports, diagnostic bundles          | `ANDROID_OWNER_DOGFOOD_SCRIPT.md`, evidence folders                     | partly   | yes             | no           | no                   | Complete owner dogfood and close P0/P1 findings.                                                                                                                                            |
| iOS smoke evidence               | P0       | blocked                                                                              | Beta across iOS cannot start without install/launch proof.       | simulator or device install/launch evidence                        | iOS build config, Expo/EAS, `STATUS.md`                                 | no       | no              | yes          | maybe                | Use macOS/Xcode or EAS signing evidence.                                                                                                                                                    |
| Secure key/storage review        | P0       | open; Android SQLCipher behavior proven, independent review pending                  | External testers need confidence local data is protected.        | key generation review, SQLCipher proof, app-lock proof, log review | `nativeLocalSecurity.ts`, `persist.ts`, `vaultKey.ts`, `@folio/storage` | partly   | yes             | yes for iOS  | yes if risk accepted | Complete physical key-loss/app-lock proof, iOS parity and independent key/storage review.                                                                                                   |
| Accessibility baseline           | P1       | signed-candidate Android emulator pass; physical/iOS and independent audit pending   | Beta testers need usable controls and clear destructive actions. | TalkBack pass, large text screenshots, reduced-motion check        | mobile surfaces, `ACCESSIBILITY_AUDIT_FOUNDATION.md`                    | partly   | yes             | yes for iOS  | no                   | Repeat the prepared exact-candidate package on physical Android/iOS and obtain independent review.                                                                                          |
| Privacy/legal copy review        | P1       | in-app disclosure + policy draft landed, legal sign-off pending (updated 2026-07-11) | External testers need accurate boundary and privacy statements.  | reviewed copy, privacy policy draft, advice boundary signoff       | privacy/legal docs, app copy                                            | yes      | no              | no           | yes                  | In-app disclosure copy and `PRIVACY_POLICY.md` draft landed 2026-07-05 (commits `82bab68`, `050b3af`). Still needs `PRIVACY_AND_LEGAL_COPY_FOUNDATION.md` review with legal/business owner. |
| Support/contact route            | P1       | open                                                                                 | Testers need a safe way to report issues and attach diagnostics. | support address/process, bug template, data handling note          | docs, support process                                                   | yes      | no              | no           | yes                  | Choose support/contact path and diagnostic handling rules.                                                                                                                                  |

## Public Release Blockers

| Blocker                                  | Severity | Status                                            | Why it matters                                                                | Evidence required                                                              | Files/systems affected                                         | Windows? | Android device?        | macOS/Xcode?  | Legal/business?    | Recommended next action                                                                                                                                                                                                                                                                            |
| ---------------------------------------- | -------- | ------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- | -------- | ---------------------- | ------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App Store / Play Store declarations      | P0       | Android candidate matched; console/iOS blocked    | Store forms must match the submitted binary and data flows.                   | Apple privacy answers, Google Data safety, SDK inventory, binary hash review   | `docs/release-store`, `tooling/config/store-declarations.json` | partly   | yes for Android binary | yes for Apple | yes                | Complete Play developer verification, publish owner URLs, submit/review Android forms, then repeat against the future iOS binary.                                                                                                                                                                  |
| Billing/subscription readiness           | P0       | implemented + owner-approved (updated 2026-07-11) | Paid distribution cannot launch without native billing proof.                 | StoreKit/Play Billing implementation, receipt validation, restore tests        | store release package, native projects                         | partly   | yes                    | yes           | yes                | Billing/entitlements shipped (`lib/billing/{iap,entitlements,entitlementsLogic,ctaMode,readAllowance}.ts` + PaywallScreen) and prices owner-approved 2026-07-11 (Full £29.99 one-time, Live £2.99/mo–£24.99/yr). Remaining gate: Play Console listing + billing SKUs configured before submission. |
| Independent security review              | P0       | blocked                                           | Financial data handling needs external security review before public release. | threat review, MASVS, penetration review, no open high/critical findings       | native app, storage, diagnostics, cloud if added               | partly   | yes                    | yes           | yes                | Commission independent review after dogfood fixes.                                                                                                                                                                                                                                                 |
| DPIA/legal/regulatory signoff            | P0       | blocked                                           | Public claims and data handling need legal/privacy approval.                  | DPIA, processor inventory, regulated-claims review, privacy policy             | docs, product copy, store declarations                         | yes      | no                     | no            | yes                | Complete legal review before external beta/public release.                                                                                                                                                                                                                                         |
| Independent accessibility audit          | P0       | blocked                                           | Store-quality accessibility cannot be self-declared from source checks only.  | TalkBack, VoiceOver, large text, reduced motion, cognitive accessibility audit | mobile UI, native platforms                                    | partly   | yes                    | yes           | yes for acceptance | Run independent audit on release candidate.                                                                                                                                                                                                                                                        |
| iOS native release proof                 | P0       | blocked                                           | Public release requires iOS install/launch proof and store build evidence.    | signed iOS build, install, launch, smoke screenshots/logs                      | iOS native project, EAS/Xcode                                  | no       | no                     | yes           | maybe              | Obtain macOS/Xcode or EAS path.                                                                                                                                                                                                                                                                    |
| Cloud/account deletion readiness         | P0       | blocked                                           | Store rules require deletion paths if accounts exist.                         | provider auth, in-app/web deletion, purge proof                                | cloud/account systems                                          | no       | maybe                  | maybe         | yes                | Keep not applicable until account/cloud scope is built; block public release if built.                                                                                                                                                                                                             |
| Open Banking/provider readiness          | P0       | blocked/not in V2 dogfood                         | Regulated integrations require provider, consent and legal proof.             | provider contract, sandbox/prod proof, consent/deletion review                 | Open Banking package, legal docs                               | no       | yes for app proof      | yes for iOS   | yes                | Keep out of current build; treat as future blocked scope.                                                                                                                                                                                                                                          |
| Public release regression and operations | P0       | blocked                                           | Launch requires full regression, incident, support and rollback evidence.     | CI, device matrix, resilience drills, incident tabletop, disclosure route      | CI, release operations docs                                    | partly   | yes                    | yes           | yes                | Burn down after dogfood/beta evidence exists.                                                                                                                                                                                                                                                      |

## Can Be Cleared Before Device Access

- Documentation structure and evidence requirements.
- Static checks for no obvious hardcoded secrets.
- Diagnostic redaction tests.
- Dogfood no-upload tests.
- Privacy/legal copy foundation draft.
- Store declaration prep checklist.
- Accessibility source-level checks for labels, disabled wording and destructive copy.

## Requires Physical Android

- Owner dogfood signoff.
- Physical install/launch/restart/clear proof.
- Secure key behavior on Android hardware.
- OEM-specific TalkBack speech, font metrics and reduced-motion parity beyond the completed emulator pass.
- Android diagnostic export file retrieval.

## Requires macOS/Xcode

- iOS simulator smoke.
- iOS physical device proof.
- VoiceOver evidence.
- iOS store/archive evidence.

## Requires Legal/Business Decision

- Privacy policy and DPIA approval.
- Financial advice/disclaimer language approval.
- Support/contact route and diagnostic retention handling.
- Store declaration answers.
- Billing/subscription model.
- External beta eligibility and tester data handling.
