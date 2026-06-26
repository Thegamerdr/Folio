# Local Production Candidate - 2026-06-21

## Claim

Folio V2 is a local production-candidate for source-controlled implementation readiness, Android
development-client demonstration, deterministic contract coverage, zip-aligned prototype UX evidence
and release-blocker traceability.

This is not a store-release, public beta, Open Banking, cloud-sync, AI-provider, billing or legal
clearance claim.

## What Is Locally Ready

| Area                   | Local candidate evidence                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source package         | `docs/source-package/VALIDATION_REPORT.md` passes for structure, contracts, fixtures and checksums.                                                                        |
| Product boundary       | Source package locks local-first, account-optional, Open-Banking-optional and AI-optional behavior.                                                                        |
| Deterministic engines  | Pure packages and tests cover money/date/domain, import, daily loop, plans, Melo policy, sync contracts, AI contracts, Open Banking contracts and store/release contracts. |
| Android preview        | Android development-client smoke and phase screenshots exist in `docs/release-evidence`.                                                                                   |
| UI proof               | `UI_RECOVERY_AUDIT_2026-06-21.md` and `FIGMA_UI_PARITY_2026-06-21.md` show zip-aligned app and Figma evidence.                                                             |
| Accessibility/security | `A11Y_SECURITY_10_10_LOCAL_CANDIDATE_2026-06-21.md` records local semantics, reduced motion, modal containment, evidence-gate hardening and emulator XML proof.            |
| Store/release gate     | `R0-public-release-blocker-gate.md` and `release-blockers.json` keep public release blocked until evidence exists.                                                         |
| Privacy posture        | Synthetic-data policy and telemetry/sample baseline prevent real financial content from entering repo evidence.                                                            |

## Local Production Candidate Boundaries

- Local core must launch without account, Open Banking, cloud AI, billing or sync.
- Manual/import-only mode must remain complete when Open Banking is absent.
- AI-off mode must remain complete and deterministic.
- Demo/reviewer data committed to the repo must remain synthetic and labelled.
- Real/private local samples are allowed only as private local test inputs if present, per the user's
  Q5/Q6 answer. They must not be committed, copied into screenshots, logs or diagnostics unless fully
  sanitised.
- Figma is accepted as UI evidence, not as final native accessibility or interaction proof.
- Public release remains disabled by policy until external blockers close.

## Remaining Local Evidence To Produce

1. Vault-backed real/private-sample E2E: import or manual entry writes to the local vault, renders the
   first real-data briefing, survives airplane mode and proves export/restore without silent loss.
2. Destructive/resilience drills: migration interruption, app kill during import, corruption,
   low-storage/full-disk and restore drills.
3. Full release regression: repeatable local command bundle for all packages plus mobile offline E2E.
4. Store release builds: signed or reproducible iOS/Android release build artifacts when credentials
   and platform access are available.
5. Operations evidence: tabletop exercise, rotation drill and vulnerability disclosure readiness
   records.
6. Native accessibility recordings: TalkBack/VoiceOver, large text, reduced motion and cognitive
   accessibility on supported devices.

## Local Accessibility And Security Evidence

The 2026-06-21 accessibility/security pass added local accessibility semantics in the Expo shell,
security-evidence contracts in `@folio/release-readiness`, and external-signoff enforcement in
`@folio/release-gate` plus the root release-blocker script.

Evidence is recorded in `A11Y_SECURITY_10_10_LOCAL_CANDIDATE_2026-06-21.md`.

## Final Local UI Evidence

The one-go local candidate pass captured the product shell live on Android emulator
`emulator-5554` using Expo dev client package `com.folio.v2.greenfield` and Metro port `8084`.

Primary captures:

- `android-ui-10-10-first-minute.png`
- `android-ui-10-10-playable.png`
- `android-ui-10-10-playable-moved.png`
- `android-ui-10-10-what-if.png`
- `android-ui-10-10-import-discovery.png`
- `android-ui-10-10-first-answer.png`
- `android-ui-10-10-today.png`
- `android-ui-10-10-sources.png`
- `android-ui-10-10-import-review.png`
- `android-ui-10-10-import-review-confirmed.png`
- `android-ui-10-10-recovery.png`

Figma review evidence:

- `figma-10-10-local-candidate.png`
- `https://www.figma.com/design/Gva1xXjMk8ifmyJ8L7Tpki`

## External Blockers Preserved

The following remain explicit blockers and were not closed:

- Apple developer/macOS/Xcode/EAS signing and iOS device/build evidence.
- Open Banking provider credentials, legal/provider acceptance and backend token adapter proof.
- Store accounts, submitted-binary review, Apple/Google declarations and native billing flows.
- Legal, privacy, DPIA, regulated-claims, security/MASVS/pen-test and accessibility signoff.
- Cloud account providers, account deletion web route, token revocation and purge proof.
- Production launch operations, monitoring, support, rollback and launch thresholds.

## Validation Snapshot

`node tooling/scripts/check-release-blockers.mjs --json` on 2026-06-21 reports:

- register valid: yes;
- ready for public release: no;
- public release flag: disabled;
- open blockers: 23 of 23;
- release-blocking: 14;
- beta-blocking: 6;
- roadmap-blocking: 3;
- external open: 17;
- local machine-check open: 2;
- local docs/evidence open: 1;
- missing current-evidence files: 0.

`release-blockers.json` was not edited because its current external blocker states are already
specific and correctly blocked.

## Honest Product Label

Use this label:

> Local production-candidate implementation and evidence pack; public release blocked pending
> platform, provider, store, legal, security, privacy, accessibility, operations and real/private
> vault-backed evidence.

Do not use this label yet:

> 10/10 production-ready public release.
