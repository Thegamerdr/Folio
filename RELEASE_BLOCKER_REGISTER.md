# Release Blocker Register

Date: 2026-06-23

Updated 2026-06-30 (evening) — commits eb6e0a0/3783c9c/a3f81c9 (+ 7147884 AUDIT.md). Reviewed
against tonight's RN faithful-port work (`claude/folio-rn-faithful-port`). That work was app-behavior
correctness — sample-data purge/gating, Melo mood wiring, a dark-mode fix, scroll fixes, a real
"start fresh", import-date fix, and the AI cost split. None of it produces the device/iOS/legal/store/
security-review evidence these gates require, so **no blocker row below is marked resolved by it**;
the gates stand. See "Tonight's RN work vs these gates" under the status summary.

Purpose: make release blockers auditable without claiming Folio V2 is public-release-ready.

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
pass on an emulator; iOS (needs a Mac/EAS — unbuildable on the Windows dev box); the gateway redeploy +
an OpenRouter spend cap.

## Owner Dogfood Blockers

| Blocker                                  | Severity | Status                                             | Why it matters                                                              | Evidence required                                                        | Files/systems affected                                                                                  | Windows? | Android device? | macOS/Xcode? | Legal/business? | Recommended next action                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | -------- | -------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------- | --------------- | ------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Physical Android install and launch      | P0       | open                                               | Owner dogfood cannot be trusted until the current APK runs on a real phone. | install log, launch screenshot, first screen screenshot, APK hash        | `apps/mobile/android`, owner device, `ANDROID_INSTALL_FOR_OWNER.md`                                     | yes      | yes             | no           | no              | Install current APK on physical Android and capture launch evidence.                                                                                                                                                                                                                                                                 |
| Clean reset and seed repeatability       | P0       | repo fix landed (reseed bug), device proof pending | Owner must be able to reset and repeat scenarios without stale data.        | Dogfood reset screenshot, canonical counts after reset                   | `apps/mobile/src/local/dogfoodMode.ts`, Data Control, `apps/mobile/src/folio/store.ts` (`resetToEmpty`) | yes      | helpful         | no           | no              | Verify `More -> Dogfood mode -> Reset local data` on phone. (2026-06-30: More -> "Start fresh" reseeded the demo via `resetAll`; fixed to `resetToEmpty` + confirm, commit a3f81c9. Sample data also purged/gated to `currentBalance.source === 'sample'`, commits eb6e0a0/3783c9c. Device counts-after-reset proof still required.) |
| Redacted diagnostic export               | P0       | implemented, device proof pending                  | Bugs need useful evidence without exposing raw financial data.              | exported JSON/Markdown, redaction review, file path proof                | `nativeDogfoodDiagnosticExport.ts`, `dogfoodMode.ts`                                                    | yes      | yes             | no           | no              | Export bundle on phone and inspect for raw source text.                                                                                                                                                                                                                                                                              |
| Local storage and key behavior on device | P0       | repo implemented, physical proof missing           | Owner data should not silently fall back or vanish unexpectedly.            | secure-store/key state screenshot, restart persistence, clear-data proof | `nativeLocalSecurity.ts`, `nativeLedgerStore.ts`, SQLCipher                                             | partly   | yes             | no           | no              | Run save, restart, app-lock and clear-data checks on physical Android.                                                                                                                                                                                                                                                               |
| Crash or blank-screen recovery           | P1       | open                                               | Dogfood must produce useful recovery evidence if the app fails.             | logcat capture, reinstall/clear instructions verified                    | APK, `ANDROID_INSTALL_FOR_OWNER.md`                                                                     | yes      | yes             | no           | no              | Test failure recovery path with ADB/logcat and phone-only fallback.                                                                                                                                                                                                                                                                  |

## External Beta Blockers

| Blocker                          | Severity | Status          | Why it matters                                                   | Evidence required                                                  | Files/systems affected                                            | Windows? | Android device? | macOS/Xcode? | Legal/business?      | Recommended next action                                                  |
| -------------------------------- | -------- | --------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- | -------- | --------------- | ------------ | -------------------- | ------------------------------------------------------------------------ |
| Physical Android dogfood signoff | P0       | open            | Trusted testers should not see issues owner testing would catch. | completed dogfood script, bug reports, diagnostic bundles          | `ANDROID_OWNER_DOGFOOD_SCRIPT.md`, evidence folders               | partly   | yes             | no           | no                   | Complete owner dogfood and close P0/P1 findings.                         |
| iOS smoke evidence               | P0       | blocked         | Beta across iOS cannot start without install/launch proof.       | simulator or device install/launch evidence                        | iOS build config, Expo/EAS, `STATUS.md`                           | no       | no              | yes          | maybe                | Use macOS/Xcode or EAS signing evidence.                                 |
| Secure key/storage review        | P0       | open            | External testers need confidence local data is protected.        | key generation review, SQLCipher proof, app-lock proof, log review | `nativeLocalSecurity.ts`, `nativeLedgerStore.ts`, storage package | partly   | yes             | yes for iOS  | yes if risk accepted | Run security/key proof checklist and schedule independent review.        |
| Accessibility baseline           | P1       | partial         | Beta testers need usable controls and clear destructive actions. | TalkBack pass, large text screenshots, reduced-motion check        | mobile surfaces, `ACCESSIBILITY_AUDIT_FOUNDATION.md`              | partly   | yes             | yes for iOS  | no                   | Run manual TalkBack and large-text audit on Android.                     |
| Privacy/legal copy review        | P1       | in-app disclosure + policy draft landed, legal sign-off pending (updated 2026-07-11) | External testers need accurate boundary and privacy statements.  | reviewed copy, privacy policy draft, advice boundary signoff       | privacy/legal docs, app copy                                      | yes      | no              | no           | yes                  | In-app disclosure copy and `PRIVACY_POLICY.md` draft landed 2026-07-05 (commits `82bab68`, `050b3af`). Still needs `PRIVACY_AND_LEGAL_COPY_FOUNDATION.md` review with legal/business owner. |
| Support/contact route            | P1       | open            | Testers need a safe way to report issues and attach diagnostics. | support address/process, bug template, data handling note          | docs, support process                                             | yes      | no              | no           | yes                  | Choose support/contact path and diagnostic handling rules.               |

## Public Release Blockers

| Blocker                                  | Severity | Status                    | Why it matters                                                                | Evidence required                                                              | Files/systems affected                                         | Windows? | Android device?        | macOS/Xcode?  | Legal/business?    | Recommended next action                                                                |
| ---------------------------------------- | -------- | ------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- | -------- | ---------------------- | ------------- | ------------------ | -------------------------------------------------------------------------------------- |
| App Store / Play Store declarations      | P0       | blocked                   | Store forms must match the submitted binary and data flows.                   | Apple privacy answers, Google Data safety, SDK inventory, binary hash review   | `docs/release-store`, `tooling/config/store-declarations.json` | partly   | yes for Android binary | yes for Apple | yes                | Prepare declarations; do not submit until binary review.                               |
| Billing/subscription readiness           | P0       | implemented + owner-approved (updated 2026-07-11) | Paid distribution cannot launch without native billing proof.                 | StoreKit/Play Billing implementation, receipt validation, restore tests        | store release package, native projects                         | partly   | yes                    | yes           | yes                | Billing/entitlements shipped (`lib/billing/{iap,entitlements,entitlementsLogic,ctaMode,readAllowance}.ts` + PaywallScreen) and prices owner-approved 2026-07-11 (Full £29.99 one-time, Live £2.99/mo–£24.99/yr). Remaining gate: Play Console listing + billing SKUs configured before submission. |
| Independent security review              | P0       | blocked                   | Financial data handling needs external security review before public release. | threat review, MASVS, penetration review, no open high/critical findings       | native app, storage, diagnostics, cloud if added               | partly   | yes                    | yes           | yes                | Commission independent review after dogfood fixes.                                     |
| DPIA/legal/regulatory signoff            | P0       | blocked                   | Public claims and data handling need legal/privacy approval.                  | DPIA, processor inventory, regulated-claims review, privacy policy             | docs, product copy, store declarations                         | yes      | no                     | no            | yes                | Complete legal review before external beta/public release.                             |
| Independent accessibility audit          | P0       | blocked                   | Store-quality accessibility cannot be self-declared from source checks only.  | TalkBack, VoiceOver, large text, reduced motion, cognitive accessibility audit | mobile UI, native platforms                                    | partly   | yes                    | yes           | yes for acceptance | Run independent audit on release candidate.                                            |
| iOS native release proof                 | P0       | blocked                   | Public release requires iOS install/launch proof and store build evidence.    | signed iOS build, install, launch, smoke screenshots/logs                      | iOS native project, EAS/Xcode                                  | no       | no                     | yes           | maybe              | Obtain macOS/Xcode or EAS path.                                                        |
| Cloud/account deletion readiness         | P0       | blocked                   | Store rules require deletion paths if accounts exist.                         | provider auth, in-app/web deletion, purge proof                                | cloud/account systems                                          | no       | maybe                  | maybe         | yes                | Keep not applicable until account/cloud scope is built; block public release if built. |
| Open Banking/provider readiness          | P0       | blocked/not in V2 dogfood | Regulated integrations require provider, consent and legal proof.             | provider contract, sandbox/prod proof, consent/deletion review                 | Open Banking package, legal docs                               | no       | yes for app proof      | yes for iOS   | yes                | Keep out of current build; treat as future blocked scope.                              |
| Public release regression and operations | P0       | blocked                   | Launch requires full regression, incident, support and rollback evidence.     | CI, device matrix, resilience drills, incident tabletop, disclosure route      | CI, release operations docs                                    | partly   | yes                    | yes           | yes                | Burn down after dogfood/beta evidence exists.                                          |

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
- Android TalkBack/large text/reduced-motion evidence.
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
