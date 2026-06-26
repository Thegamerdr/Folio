# C7 Melo Deterministic System

## Phase / task IDs

Phase 7. Primary task range: T099 through T110.

## Result

Phase 7 is complete for deterministic Melo contracts, language-policy blocking, no-AI acceptance
and a synthetic-labelled Expo Today shell. It is not complete for release claims requiring native
voice capture, transcript review, vault-backed domain commits, qualified legal review or manual
TalkBack/large-text/reduced-motion recordings.

## What was built

- Expanded `@folio/melo-policy` from advice-language checks into the Phase 7 deterministic Melo
  contract package.
- Bounded intent registry with required slots, max questions, stop conditions and fallbacks.
- Deterministic briefing and tone-mode rendering with model/network disabled.
- Typed proposal lifecycle: create, edit, accept, reject and command-envelope commit handoff.
- Proactive intervention ranking with fatigue, dismissal, confidence, quiet-hour and cap controls.
- Bad-month mode with facts, affected items, stable items, recovery options and playful-output
  suppression.
- Compact Melo memory records with visibility, deletion, expiry, sensitivity and provenance.
- Accepted correction learning that preserves the original inference for audit.
- Voice-to-proposal blocker metadata.
- Language-policy blocking for advice, suitability, final tax/legal claims, guarantees, shame,
  false reassurance and certainty overclaims.
- No-AI acceptance helper proving core Melo paths do not require model or network access.
- `apps/mobile/src/phase7` mobile evidence adapter and integrated Expo Today section.

## Task coverage

| Task                          | Status                                      | Evidence                                                  |
| ----------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| T099 Intent registry          | Implemented and tested                      | `meloIntentRegistry`, `planNextMeloQuestion`              |
| T100 Deterministic language   | Implemented and tested                      | `renderDeterministicMeloBriefing`, tone variants          |
| T101 Proposal lifecycle       | Implemented and tested                      | `createMeloProposal`, `commitAcceptedMeloProposal`        |
| T102 Tone modes               | Implemented and tested                      | gentle, balanced and accountability invariant tests       |
| T103 Proactive ranking        | Implemented and tested                      | `rankMeloInterventions`, dismissal and quiet-hour tests   |
| T104 Bad-month mode           | Implemented and tested                      | `buildBadMonthBriefing`, no shame/false reassurance tests |
| T105 Compact memory store     | Implemented as pure record contract         | `createMeloMemoryRecord`, `visibleMeloMemories`           |
| T106 User correction learning | Implemented as accepted-correction contract | `buildCorrectionLearningRecord`                           |
| T107 Voice-to-proposal path   | Blocked with explicit requirements          | `describeVoiceToProposalStatus`                           |
| T108 Melo UI states/animation | Implemented as static reduced-motion shell  | `apps/mobile/src/phase7`, Expo Today section              |
| T109 Language-policy suite    | Implemented and tested                      | expanded `advice-language.test.ts`                        |
| T110 No-AI acceptance         | Implemented and tested                      | `runNoAiMeloAcceptance`, focused tests                    |

## Verification evidence

Focused checks completed on 2026-06-21:

- `pnpm --filter @folio/melo-policy typecheck`: passed.
- `pnpm --filter @folio/mobile typecheck`: passed.
- `pnpm vitest run apps/mobile/src/phase7/meloShellEvidence.test.ts packages/melo-policy/test/advice-language.test.ts`: passed, 40 tests.

Final gates completed on 2026-06-21:

- `pnpm run ci`: passed, including format, boundaries, typecheck, tests, contract validation,
  source-package validation and V1 runtime dependency proof.
- `pnpm lint:boundaries`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 21 files and 166 tests.
- `pnpm validate:contracts`: passed, 75 source-package files, 192 tasks and 14 fixture cases.
- `pnpm --filter @folio/mobile doctor`: passed, 21/21 Expo checks.
- `pnpm --filter @folio/mobile exec expo install --check`: passed.

## Android live preview evidence

The Phase 7 mobile shell is integrated into `apps/mobile/app/index.tsx` and was rendered in the
Android Expo development client on `CloseLedger_Phone` on 2026-06-21.

Preview artifacts:

- `docs/release-evidence/metro-phase7-live-preview-lan.log`
- `docs/release-evidence/android-live-preview-phase7-top.png`
- `docs/release-evidence/android-window-phase7-top.xml`
- `docs/release-evidence/android-live-preview-phase7-heading.png`
- `docs/release-evidence/android-window-phase7-heading.xml`
- `docs/release-evidence/android-live-preview-phase7-visible.png`
- `docs/release-evidence/android-window-phase7-visible.xml`
- `docs/release-evidence/android-live-preview-phase7-gate.png`
- `docs/release-evidence/android-window-phase7-gate.xml`

Metro bundled `node_modules\expo-router\entry.js` with 1694 modules on port `8085`. The top
accessibility dump confirms `Phase 7 Melo` and `Melo deterministic mode`. The mid-section capture
shows proposal review and tone modes. The gate dump confirms `Phase 7 gate`, `Intent registry`,
`Melo proposals`, `No-AI gate`, `Voice path`, `Manual a11y` and `Native diagnostics`.

The screenshots include the Expo dev-client floating control; that is development tooling, not
product UI.

This preview proves only that the synthetic Phase 7 shell renders in the Android development
client. It does not prove native voice capture, vault-backed command commits or release-grade
offline operation.

## Figma evidence

Editable Figma evidence is created from the Phase 7 repo contracts and mobile shell.

- `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=10-2`

Local rendered board:

- `docs/release-evidence/figma-phase7-evidence.png`

Figma is review evidence only. The repository, tests and emulator artifacts remain the source of
truth.

## Huashu UI/UX critique

Huashu review outcome:

- Melo is presented as a persistent accountability layer, not a compulsory chat screen.
- The section is a restrained linear proof flow: state, briefing, bounded intents, proposal review,
  tone modes, proactive ranking, bad-month mode, memory/correction and policy gates.
- The UI avoids mascot spectacle around hardship. Bad-month mode suppresses playful output and uses
  calm consequence language.
- Tone modes change wording only; facts and calculations stay invariant.
- Proposal review copy makes the command-envelope boundary visible.
- Voice and accessibility blockers are visible instead of implied as complete.

Issues carried forward:

- Native voice capture and transcript review are blocked.
- Vault-backed command commits are blocked until the vault/command adapter can accept real rows.
- Manual TalkBack, large text and reduced-motion checks remain required before release claims.
- Qualified legal/compliance review remains required before public regulated-boundary claims.

## Boundary conclusion

Phase 7 is complete for deterministic Melo policy contracts, language-policy blocking, model-off
acceptance and synthetic mobile shell evidence. Real voice-to-proposal, real vault-backed commits,
legal sign-off and manual accessibility evidence remain explicit blockers. No V1 donor runtime code
or assets were used.
