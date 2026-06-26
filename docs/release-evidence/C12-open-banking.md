# C12 Open Banking

## Phase / task IDs

Phase 12. Primary task range: T160 through T168.

## Result

Phase 12 is complete for provider-neutral Open Banking contracts and a synthetic-labelled Expo
Today shell. It is not complete for live release claims requiring regulated provider selection,
procurement/legal approval, live provider sandbox and production contract suites, backend token
adapter deployment, provider pilot acceptance, store/privacy review, support runbook, incident
monitoring or staged rollout operations.

Open Banking remains optional. Manual entry and file import remain available when no bank is
connected, when a provider is unavailable, and after consent is revoked.

## What was built

- Added pure `@folio/open-banking` package for Phase 12 contracts.
- Provider selection state with coverage, consent UX, security, processor, residency, pricing and
  exit-plan blockers.
- Provider-neutral `BankDataProvider` readiness surface for start, callback, list state, canonical
  rows, refresh and revoke behavior.
- Contextual consent journey contract: no first-launch bank prompt, explanation before redirect and
  provider tokens outside the mobile app.
- Consent dashboard state with provider, accounts, scopes, expiry, last refresh, revoke and
  workspace-mismatch guard rows.
- Canonical Open Banking row normalisation that stages through import review and never writes
  directly to financial transaction tables.
- Reconciliation signals for duplicate provider IDs, pending replacements, possible transfers and
  unmatched staged rows.
- Stale/gap feed state that keeps pending/posted visibility and manual/CSV gap filling available.
- Revocation state that stops future access, deletes the server token and separates retained local
  history from imported-history deletion.
- Staged rollout gate for sandbox pilot, production pilot, legal/store review, support runbook,
  incident monitoring and manual/import availability.
- `apps/mobile/src/phase12` mobile evidence adapter and integrated Expo Today section.

## Task coverage

| Task                                   | Status                        | Evidence                                                                     |
| -------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| T160 Regulated AISP provider           | Blocked for release           | Candidate model exists; regulated approval, procurement and legal blocked    |
| T161 BankDataProvider contract         | Implemented as fake contract  | Provider-neutral fake suite passes; sandbox and production contracts blocked |
| T162 Consent journey/token store       | Implemented as contract       | Contextual consent and server-token boundary modelled                        |
| T163 Consent dashboard                 | Implemented as shell contract | Provider, account, scope, expiry, refresh, revoke and workspace guard shown  |
| T164 Canonical row ingestion           | Implemented and tested        | Provider rows stage through import review; direct transaction writes false   |
| T165 Refresh/gap/stale state           | Implemented and tested        | Stale/gap state visible; manual gap fill remains available                   |
| T166 Revocation/deletion paths         | Implemented and tested        | Future access stops and local history choice remains separate                |
| T167 Provider sandbox/production pilot | Blocked for release           | Real provider sandbox and production pilot acceptance missing                |
| T168 Staged rollout                    | Blocked for release           | Legal/store review, support, incident monitoring and rollout not complete    |

## Verification evidence

Focused checks completed on 2026-06-21:

- `pnpm --filter @folio/open-banking typecheck`: passed.
- `pnpm --filter @folio/mobile typecheck`: passed.
- `pnpm exec vitest run packages/open-banking/test/open-banking.test.ts apps/mobile/src/phase12/openBankingEvidence.test.ts --passWithNoTests`: passed, 2 files and 19 tests.

Full gates completed on 2026-06-21:

- `pnpm run ci`: passed; includes lint, typecheck, 30 test files and 277 tests, and
  contract validation.
- `pnpm lint:boundaries`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 30 files and 277 tests.
- `pnpm validate:contracts`: passed with 75 files, 15,681 lines, 192 tasks, 32 risks,
  18 forecast vectors, 15 import vectors and 14 independently checked fixture cases.
- `pnpm --filter @folio/mobile doctor`: passed, 21/21 checks.
- `pnpm --filter @folio/mobile exec expo install --check`: passed.
- `pnpm check:v1-boundary`: passed; 123 authored V2 runtime/package files checked against 859
  V1 freeze hashes.
- Non-ASCII scan of touched text files: passed, no matches.

## Android live preview evidence

The Phase 12 mobile shell is integrated into `apps/mobile/app/index.tsx`. Android development-client
preview was verified on `emulator-5554` using Metro on port `8090`.

Actual artifacts:

- `docs/release-evidence/metro-phase12-live-preview-lan.log`
- `docs/release-evidence/android-live-preview-phase12-open-banking.png`
- `docs/release-evidence/android-window-phase12-open-banking.xml`
- `docs/release-evidence/android-live-preview-phase12-consent-staging.png`
- `docs/release-evidence/android-window-phase12-consent-staging.xml`
- `docs/release-evidence/android-live-preview-phase12-stale-revocation.png`
- `docs/release-evidence/android-window-phase12-stale-revocation.xml`
- `docs/release-evidence/android-live-preview-phase12-blockers.png`
- `docs/release-evidence/android-window-phase12-blockers.xml`
- `docs/release-evidence/android-live-preview-phase12-gate.png`
- `docs/release-evidence/android-window-phase12-gate.xml`
- `docs/release-evidence/android-live-preview-phase12-coverage-mid.png`
- `docs/release-evidence/android-window-phase12-coverage-mid.xml`
- `docs/release-evidence/android-live-preview-phase12-gate-bottom.png`
- `docs/release-evidence/android-window-phase12-gate-bottom.xml`

The Metro log records `Android Bundled 2761ms node_modules\expo-router\entry.js (1703 modules)`
and a later one-module bundle refresh. PNG captures decode as valid `1080x2400` images. The log
also contains the expected forced-stop tail from shutting down the background Metro process after
capture; the successful bundle lines appear before that shutdown tail.

UI tree proof:

- Open Banking viewport confirms provider selection, provider-neutral fake contract, no first-launch
  bank prompt, server token boundary and no app token/log rows.
- Consent/staging viewport confirms consent dashboard controls and canonical rows staged through
  import review with direct transaction writes false.
- Stale/revocation viewport confirms stale visible, gap ranges, pending/posted visibility, manual
  gap fill, revoked consent, stopped future access, deleted server token and no app token.
- Blockers viewport confirms rollout is not ready while sandbox pilot, production pilot and
  legal/store review remain blocked, plus Huashu hierarchy/craft rows.
- Gate viewport confirms Phase 12 coverage counts of 5 implemented or reviewable rows and 4 blocked
  rows.
- Middle and lower coverage viewports confirm T164 through T168, with provider pilot and staged
  rollout still blocked.

The preview proves only that the synthetic Phase 12 shell renders in the Android development
client. It does not prove a real provider redirect, bank login, token exchange, bank-row fetch,
backend token adapter, provider sandbox contract, production pilot, legal/store approval or beta
readiness.

## Figma evidence

Editable Figma evidence was created from the Phase 12 repo contracts and mobile shell.

Figma board:

- `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=17-2`

Local rendered board:

- `docs/release-evidence/figma-phase12-evidence.png` (`1260x1688`)

Figma is review evidence only. The repository, tests and emulator artifacts remain the source of
truth.

## Huashu UI/UX critique

Huashu review outcome:

- Manual/import mode stays first; connect-bank copy is contextual and optional.
- Token boundary, consent scope, stale feed, revoke and manual fallback appear before rollout.
- Plain evidence rows avoid fake provider logos, fake uptime, balance hero moments and bank-grade
  claims.
- Stale/gap and revoked states are visible in the same flow as readiness blockers.
- Release blockers are explicit rather than hidden behind a celebratory connected-bank state.

Issues carried forward:

- Real provider consent screens need the same hierarchy after procurement and legal review.
- Manual TalkBack/VoiceOver, large text and reduced-motion review remains required.
- Backend token adapter, provider pilot acceptance, DPIA/processor review, store disclosures,
  support runbook and incident monitoring remain release blockers.

## Boundary conclusion

Phase 12 is complete for deterministic Open Banking boundaries, provider-neutral contracts,
consent/staging/revocation state and synthetic mobile shell evidence. It remains blocked for live
Open Banking release until regulated provider, backend, legal/privacy, provider-pilot, support and
staged-rollout gates close. No V1 donor runtime code or assets were used.
