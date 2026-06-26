# C11 Optional AI

## Phase / task IDs

Phase 11. Primary task range: T149 through T159.

## Result

Phase 11 is complete for provider-agnostic optional-AI contracts and a synthetic-labelled Expo
Today shell. It is not complete for release claims requiring a deployed AI gateway, live provider
connection, server-side key handling, real model call, on-device model proof, approved DPIA,
processor review, passed model/prompt evaluation, monitoring, rollback, support runbook or strict
AI beta operations.

AI remains a language and convenience layer over deterministic finance. The app remains complete
with AI disabled.

## What was built

- Expanded `@folio/ai-contracts` from a boundary stub into the Phase 11 pure contract package.
- Versioned AI task schemas and typed model-output validation.
- Provider registry state for lifecycle, configurable pricing and data-use metadata.
- Gateway readiness state for auth, quotas, redaction, routing, server-side provider calls, no
  provider key in app, no database credential and invalid-output rejection.
- Minimal context builder that selects only current workspace records, allowed kinds/fields and
  local aliases for identifiers.
- On-device capability abstraction with fallback when platform models are unavailable.
- Registry-routed cloud small-model route and strong-route rejection for regulated/advisory/write
  tasks.
- Weighted quota/cost ledger with free system-failure retries and an operator-only 1000-user cost
  scenario.
- Model evaluation gate covering schema validity, intent, faithfulness, advice boundary, tone,
  workspace leakage, prompt injection and clarification limits.
- Melo AI integration contract proving AI can only draft wording/parse proposals and AI-off keeps
  the same financial conclusion.
- First-cloud-AI consent contract with local/manual denial path.
- Strict AI beta gate carrying evaluation, monitoring, rollback and support blockers.
- `apps/mobile/src/phase11` mobile evidence adapter and integrated Expo Today section.

## Task coverage

| Task                                   | Status                      | Evidence                                                                      |
| -------------------------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| T149 AI task schemas/provider registry | Implemented and tested      | Versioned tasks, lifecycle, pricing and data-use metadata are registry-driven |
| T150 AI gateway                        | Implemented as contract     | Auth/quota/redaction/typed validation modelled; real gateway not deployed     |
| T151 Minimal context builder           | Implemented and tested      | Workspace-scoped, field-limited, identifier-redacted context                  |
| T152 On-device model adapters          | Implemented as abstraction  | Capability check and fallback contract; real iOS/Android adapters blocked     |
| T153 Cloud small-model route           | Implemented as contract     | Small route selected through registry, not mobile bundle                      |
| T154 Rare strong-model route           | Implemented as policy       | Regulated advice and authoritative-write tasks rejected                       |
| T155 Quota and cost ledger             | Implemented and tested      | Weighted units, free system retry and 1000-user operator scenario             |
| T156 Model evaluation pipeline         | Implemented as blocker gate | Synthetic unsafe case blocks deployment                                       |
| T157 Optional AI in Melo               | Implemented and tested      | Wording/parse proposal only; AI-off conclusion unchanged                      |
| T158 First-cloud-AI consent            | Implemented and tested      | Task explanation, minimisation and local/manual denial path                   |
| T159 AI beta strict quotas             | Blocked for release         | Evaluation, support runbook, monitoring and rollback remain blockers          |

## Verification evidence

Focused checks completed on 2026-06-21:

- `pnpm --filter @folio/ai-contracts typecheck`: passed.
- `pnpm --filter @folio/mobile typecheck`: passed.
- `pnpm exec vitest run packages/ai-contracts/test/ai-contracts.test.ts apps/mobile/src/phase11/optionalAiEvidence.test.ts --passWithNoTests`: passed, 2 files and 24 tests.

Full gates completed on 2026-06-21:

- `pnpm run ci`: passed; includes lint, typecheck, 28 test files and 258 tests, and
  contract validation.
- `pnpm lint:boundaries`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 28 files and 258 tests.
- `pnpm validate:contracts`: passed with 75 files, 15,681 lines, 192 tasks, 32 risks,
  18 forecast vectors, 15 import vectors and 14 independently checked fixture cases.
- `pnpm --filter @folio/mobile doctor`: passed.
- `pnpm --filter @folio/mobile exec expo install --check`: passed.
- `pnpm check:v1-boundary`: passed; 117 authored V2 runtime/package files checked against 859 V1
  freeze hashes.
- Non-ASCII scan of touched text files: passed, no matches.

## Android live preview evidence

The Phase 11 mobile shell is integrated into `apps/mobile/app/index.tsx`. Android development-client
preview was verified on `emulator-5554` (`sdk_gphone64_x86_64`) using Metro on port `8089`.

Actual artifacts:

- `docs/release-evidence/metro-phase11-live-preview-lan.log`
- `docs/release-evidence/android-live-preview-phase11-top.png`
- `docs/release-evidence/android-window-phase11-top.xml`
- `docs/release-evidence/android-live-preview-phase11-ai.png`
- `docs/release-evidence/android-window-phase11-ai.xml`
- `docs/release-evidence/android-live-preview-phase11-routes.png`
- `docs/release-evidence/android-window-phase11-routes.xml`
- `docs/release-evidence/android-live-preview-phase11-blockers.png`
- `docs/release-evidence/android-window-phase11-blockers.xml`
- `docs/release-evidence/android-live-preview-phase11-gate.png`
- `docs/release-evidence/android-window-phase11-gate.xml`
- `docs/release-evidence/android-live-preview-phase11-gate-bottom.png`
- `docs/release-evidence/android-window-phase11-gate-bottom.xml`

The Metro log records `Android Bundled 12288ms node_modules\expo-router\entry.js (1702 modules)`.
PNG captures decode as valid `1080x2400` images. The log also contains the expected forced-stop
tail from stopping the background Metro process after capture; the successful bundle line appears
before that shutdown tail.

UI tree proof:

- Top viewport confirms the Expo Today shell still opens in local mode after the Phase 11
  integration.
- AI viewport confirms `AI OFF STATE`, `Complete`, synthetic no-provider/no-model/no-network/no
  database/no-domain-write copy, registry and gateway rows.
- Routes viewport confirms redacted context, local aliases, `ROUTES, QUOTA AND EVALUATION`, route
  ladder, quota and 1000-user configured-cost scenario.
- Blockers viewport confirms Huashu review rows and `AI BETA BLOCKERS`.
- Gate viewport confirms `PHASE 11 GATE` and the top proof rows starting at T149.
- Lower gate viewport confirms T153 through T159, with T159 beta still blocked.

The preview proves only that the synthetic Phase 11 shell renders in the Android development
client. It does not prove a real provider connection, gateway deployment, model call, production
evaluation pass, DPIA approval, monitoring or beta readiness.

## Figma evidence

Editable Figma evidence was created from the Phase 11 repo contracts and mobile shell.

Figma board:

- `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=16-2`

Local rendered board:

- `docs/release-evidence/figma-phase11-evidence.png` (`1260x1688`)

Figma is review evidence only. The repository, tests and emulator artifacts remain the source of
truth.

## Huashu UI/UX critique

Huashu review outcome:

- The section starts with AI-off completeness before any model route detail.
- Deterministic conclusion, redaction, consent, quota and evaluation gates are presented before
  beta blockers.
- The UI uses restrained proof rows and status colour, not a chatbot-first layout.
- Regulated advice and authoritative-write rejection appears in the same flow as route selection.
- There are no fake benchmarks, provider uptime claims, AI mascots, glowing success states or
  decorative AI theatre.

Issues carried forward:

- Real provider consent screens need the same hierarchy after gateway and procurement work.
- Manual TalkBack/VoiceOver, large text and reduced-motion review remains required.
- Cloud AI DPIA, processor review and store/privacy declarations remain release blockers.
- Real evaluation, monitoring, rollback and support operations must pass before strict beta.

## Boundary conclusion

Phase 11 is complete for deterministic optional-AI boundaries, provider registry, gateway/context
contracts, route policy, quota accounting, evaluation blocking, Melo integration, consent and
synthetic mobile shell evidence. It remains blocked for live cloud/on-device AI release until
provider, gateway, privacy/legal, model-evaluation and beta-operations gates close. No V1 donor
runtime code or assets were used.
