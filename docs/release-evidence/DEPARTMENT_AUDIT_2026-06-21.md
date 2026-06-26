# Department Audit 2026-06-21

This audit covers the installed Android APK after the real-route graph pass and Huashu UI check.
It separates local APK test readiness from public/beta release readiness.

## Fresh Evidence

- APK installed from `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
- Cold launch on emulator: `2441ms`.
- Fresh captures: `docs/release-evidence/department-audit-2026-06-21/`.
- Huashu finding fixed in this pass: the source sheet no longer renders under the Android status bar and its evidence rows scroll.
- Source/fresh evidence search found no runtime matches for the old fake phrases: `Barclays`, `124 transactions`, `Andrea`, `Melo local AI`, `AI safety`, `Position updated`, `confirmed today`, or `cash minus protected`.

## Local APK Scoreboard

| Department             | Local APK score | Current state                                                                                                                                      |
| ---------------------- | --------------: | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today / live route     |          8.8/10 | Uses local route points for the graph, headline, source sheet and live route rows. Starter data is labelled synthetic.                             |
| Money / what-if        |          8.6/10 | Test spend updates the plotted route and projected balances without saving until the user acts.                                                    |
| Calendar               |          8.2/10 | Calendar route graph and agenda derive from the same route/ledger state; review rows stay marked as review.                                        |
| Import review          |          8.0/10 | CSV/TXT staging, review/confirm/edit/dismiss affordances and source wording are present. PDF/image OCR remains blocked.                            |
| Melo                   |          6.8/10 | Local rules explain, classify and suggest actions from the current ledger. This is not a live cloud-model call.                                    |
| Recovery               |          8.0/10 | Repair preview rebuilds the route before saving, and saving records a real local transaction.                                                      |
| Security / local vault |          7.4/10 | SecureStore key state and lock caveat are visible. Real-device key wrapping and biometric/app-lock proof remain blocked.                           |
| UI / UX craft          |          8.1/10 | Core screens match the relief-first direction and avoid fake data claims. Remaining polish needs long-run device testing and prototype-to-code QA. |
| Accessibility          |          7.3/10 | Labels, roles, touch targets and source explanations are present. Independent TalkBack/VoiceOver and large-text audit remain blocked.              |
| Performance / build    |          8.4/10 | Release APK builds, installs and cold-launches on emulator. No deep profiling or real-device endurance pass yet.                                   |
| Testing / contracts    |          8.7/10 | `pnpm run ci`, boundaries, typecheck, tests and contracts pass. Real-data/offline/endurance E2E is still a release blocker.                        |

## Public/Beta Release Scoreboard

| Department           | Release score | Why it is not release-ready                                                                                                      |
| -------------------- | ------------: | -------------------------------------------------------------------------------------------------------------------------------- |
| iOS native           |        2.0/10 | No macOS/Xcode or EAS-signed iOS install/launch proof.                                                                           |
| Open Banking         |        3.0/10 | Provider-neutral contracts exist, but no regulated provider, sandbox/production token adapter or legal/provider proof.           |
| Cloud account / sync |        3.4/10 | Contracts and shell evidence exist, but no live provider, deletion route, multi-device restore or cloud backend proof.           |
| Optional AI          |        4.0/10 | Registry/gateway/consent contracts exist, but no deployed gateway, provider call, model evaluation pass, monitoring or rollback. |
| OCR / documents      |        4.6/10 | CSV/TXT import works locally; encrypted native file storage and OCR proof are not closed.                                        |
| Billing / store      |        2.0/10 | Store declarations are prepared, not submitted or matched to a reviewed binary; billing proof is absent.                         |
| Operations / support |        4.0/10 | Runbooks exist, but tabletop, rotation drills and vulnerability disclosure channel are not complete.                             |
| Legal / privacy      |        3.5/10 | DPIA/checklists/policies exist, but external legal/privacy approval is missing.                                                  |
| Security release     |        4.0/10 | Local posture is visible, but independent threat/MASVS/pen test signoff is missing.                                              |

## Verification

- `pnpm lint:boundaries` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed: 37 files, 353 tests.
- `pnpm validate:contracts` passed.
- `pnpm --filter @folio/mobile doctor` passed: 21/21 checks.
- `pnpm run ci` exited 0. It reports public-release blockers by design.

## Current Truth

The Android APK is ready for local functional testing of the local-first slice: Today, Money,
Calendar, Import Review, Melo local rules, Recovery and local lock posture.

It is not a 10/10 whole product yet. The biggest non-local gaps are live cloud AI, Open Banking,
iOS proof, OCR, real-device security, independent accessibility/security/legal review, billing,
store submission and operations drills.
