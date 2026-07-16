# C10 Cloud Account, Encrypted Backup And Sync

## Phase / task IDs

Phase 10. Primary task range: T134 through T148.

## Result

Phase 10 now includes a real optional Clerk email-code account, client-encrypted snapshot backup,
recovery-code restore and account/cloud purge foundation in the Android app and Cloudflare Worker,
in addition to the older deterministic contracts. It is not complete for release claims requiring
deployed production credentials, signed create/backup/restore/delete E2E proof, a public web
deletion route, bank-side consent revocation, multi-device sync, qualified cryptographic review,
DPIA/privacy declaration approval, an independent cloud-vault/auth pen-test or staged operations.

## What was built

- Expanded `@folio/sync` from a single envelope type into the Phase 10 pure contract package.
- Optional account state proving the local vault remains usable while signed out.
- Account/provider rows for passkey, Apple and Google, with real provider wiring blocked.
- Key hierarchy state for master, workspace, document and sync-envelope keys.
- Recovery setup state for recovery code/passphrase/trusted-device methods and zero-knowledge copy.
- Device registry state for public-key fingerprints, revocation and active-device sequence cursors.
- Versioned encrypted envelope contract with idempotency keys and ciphertext-only service metadata.
- Inbox apply state that rejects duplicate and malformed envelopes before command application.
- Deterministic conflict policy for transactions, plans, rules, tasks, documents, deletes and
  workspace assignment.
- Encrypted snapshot state with generation, hash and decryptability checks.
- Safe compaction state that waits for active-device acknowledgements.
- Device/recovery manager UI state with 48dp controls and no secret exposure.
- Account deletion state for web route, in-app entrypoint, token revocation and local-vault
  preservation.
- Cloud data inventory/status state for payload type, location, processor role and delete controls.
- Multi-device conflict-suite, external security review and encrypted-backup/sync beta gates.
- `apps/mobile/src/phase10` mobile evidence adapter and integrated Expo Today section.
- Production `CloudBackupSheet` and `cloudBackupNative.ts` encrypt the complete local state before
  upload, verify it locally, retain two opaque server generations and require the recovery code for
  restore; the Worker never receives the recovery key or plaintext.
- The signed-in Account surface exposes a three-confirmation account deletion path. It attempts the
  cloud-vault and Open Banking purges before calling Clerk identity deletion, keeps the identity
  when either service cannot confirm deletion, and deliberately leaves local money for the
  separately gated device-clear flow.

## Task coverage

| Task                                | Status                        | Evidence                                                                 |
| ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------ |
| T134 Optional account/auth          | Implemented; release blocked  | Clerk email-code flow exists; production config and signed E2E blocked   |
| T135 Crypto key hierarchy           | Blocked for release           | Subkeys modelled; Keychain/Keystore proof and crypto review blocked      |
| T136 Recovery setup                 | Blocked for release           | Recovery methods and zero-knowledge copy modelled; clean restore blocked |
| T137 Cloud device registry          | Blocked for release           | Device rows/revocation modelled; cloud backend and revoke drill blocked  |
| T138 Encrypted outbox envelopes     | Implemented and tested        | Append-only, idempotent, ciphertext-only envelope contract               |
| T139 Inbox apply pipeline           | Implemented and tested        | Duplicate and malformed envelopes are rejected safely                    |
| T140 Conflict policies              | Implemented and tested        | Deterministic policies avoid universal last-write-wins                   |
| T141 Encrypted backup snapshots     | Implemented; release blocked  | Real client encryption/two generations; deployed clean restore blocked   |
| T142 Compaction ack cursors         | Implemented as contract       | Compaction waits for every active-device acknowledgement                 |
| T143 Device/recovery manager UI     | Implemented as shell contract | No secret exposure, accessible controls and reduced-motion copy          |
| T144 Account deletion               | Partially implemented         | In-app + service purge built/tested; public web route and E2E blocked    |
| T145 Cloud data inventory/status    | Implemented as contract       | Payload, processor, delete and local-vault-disable rules visible         |
| T146 Multi-device offline conflict  | Blocked for release           | Contract rows modelled; true restore/revoke drill blocked                |
| T147 Cloud vault/auth/sync pen-test | Blocked for release           | External assessment required; high/critical findings must close          |
| T148 Encrypted backup/sync beta     | Blocked for release           | Beta gate waits for T134-T147, support runbook and restore telemetry     |

## Verification evidence

Focused checks completed on 2026-06-21:

- `pnpm --filter @folio/sync typecheck`: passed.
- `pnpm --filter @folio/mobile typecheck`: passed.
- `pnpm exec vitest run packages/sync/test/sync-readiness.test.ts apps/mobile/src/phase10/cloudSyncEvidence.test.ts`: passed, 2 files and 20 tests.

Full gates completed on 2026-06-21:

- `pnpm run ci`: passed; includes lint, typecheck, 26 test files and 234 tests, and
  contract validation.
- `pnpm lint:boundaries`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 26 files and 234 tests.
- `pnpm validate:contracts`: passed with 75 files, 15,681 lines, 192 tasks, 32 risks,
  18 forecast vectors, 15 import vectors and 14 independently checked fixture cases.
- `pnpm --filter @folio/mobile doctor`: passed, 21/21 checks.
- `pnpm --filter @folio/mobile exec expo install --check`: passed.
- `pnpm check:v1-boundary`: passed; 114 authored V2 runtime/package files checked against
  859 V1 freeze hashes.

Production-path checks completed on 2026-07-15:

- `pnpm vitest run apps/mobile/src/folio/lib/remoteAccountDeletion.test.ts services/cloud-vault/src/index.test.ts services/open-banking/src/index.test.ts`: passed, 3 files and 15 tests.
- `pnpm --filter @folio/mobile typecheck`, `pnpm --filter @melo/cloud-vault typecheck` and
  `pnpm --filter @melo/open-banking-service typecheck`: passed.
- Cloud `DELETE /v1/account` is idempotent and deletes both backup generations.
- Open Banking `DELETE /v1/account` removes every indexed connection record and encrypted provider
  credential. It cannot revoke the separate provider/bank consent; pending callback metadata holds
  no provider secret and expires within 1,200 seconds.
- No production account was destructively exercised in this local pass; deployed signed E2E proof
  remains required.
- Non-ASCII scan of touched text files: passed, no matches.

## Android live preview evidence

The Phase 10 mobile shell is integrated into `apps/mobile/app/index.tsx`. Android development-client
preview was verified on `emulator-5554` (`sdk_gphone64_x86_64`) using Metro on port `8088`.

Actual artifacts:

- `docs/release-evidence/metro-phase10-live-preview-lan.log`
- `docs/release-evidence/android-live-preview-phase10-top.png`
- `docs/release-evidence/android-window-phase10-top.xml`
- `docs/release-evidence/android-live-preview-phase10-cloud.png`
- `docs/release-evidence/android-window-phase10-cloud.xml`
- `docs/release-evidence/android-live-preview-phase10-sync.png`
- `docs/release-evidence/android-window-phase10-sync.xml`
- `docs/release-evidence/android-live-preview-phase10-gate.png`
- `docs/release-evidence/android-window-phase10-gate.xml`
- `docs/release-evidence/android-live-preview-phase10-gate-bottom.png`
- `docs/release-evidence/android-window-phase10-gate-bottom.xml`

The Metro log records `Android Bundled 12769ms node_modules\expo-router\entry.js (1700 modules)`.
PNG captures decode as valid `1080x2400` images.

UI tree proof:

- Top viewport confirms `PERSONAL WORKSPACE`, `Local mode`, `Today` and first-minute rows after
  the Phase 10 integration.
- Cloud viewport confirms `PHASE 10 CLOUD ACCOUNT AND ENCRYPTED SYNC`, `Cloud beta`, blocker
  count, synthetic no-account/no-cloud/no-secret/no-real-records copy, and account/recovery rows.
- Sync viewport confirms `DEVICES AND ENCRYPTED ENVELOPES`, encrypted outbox, ciphertext-only
  backend payload and inbox rejection copy.
- Gate viewport confirms `PHASE 10 GATE` and the top proof rows starting at T134.
- Lower gate viewport confirms T148 encrypted backup/sync beta remains blocked.

The preview proves only that the synthetic Phase 10 shell renders in the Android development
client. It does not prove real cloud service operation, provider auth, restore, deletion,
independent security review or beta readiness.

## Figma evidence

Editable Figma evidence was created from the Phase 10 repo contracts and mobile shell.

Figma board:

- `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=15-2`

Local rendered board:

- `docs/release-evidence/figma-phase10-evidence.png` (`1260x1712`)

Figma is review evidence only. The repository, tests and emulator artifacts remain the source of
truth.

## Huashu UI/UX critique

Huashu review outcome:

- The cloud section starts with local-vault safety and beta blockers, not a celebratory sync state.
- Account authentication is visually separated from vault recovery.
- Recovery choices are shown as status rows, but recovery secret material is never displayed.
- Device revocation and account deletion sit in the same flow as setup, making risk controls
  inspectable.
- The UI uses plain rows, restrained status colour and existing 48dp touch-target policy rather
  than shield icons, fake trust badges, invented uptime stats or decorative security theatre.
- Remaining blockers are visible inside the shell: provider wiring, clean-device restore, web
  deletion, independent pen-test and beta operations.

Issues carried forward:

- Clerk production settings, a public web deletion route and signed account lifecycle E2E remain.
- Manual TalkBack/VoiceOver, large text and reduced-motion review remains required.
- Deployed cloud-vault restore must prove server-blind operation and no plaintext logs.
- Bank-side provider-consent revocation is not supported by the current adapter. Melo deletes its
  stored credential and stops future access, while the user must also revoke the permission at the
  bank when immediate provider-side revocation is required.

## Boundary conclusion

Phase 10 has a real Android optional-account, encrypted-backup/restore and fail-closed account-purge
foundation alongside its deterministic contracts. It remains blocked for public release until
production configuration, web deletion, provider revocation policy, destructive E2E, multi-device,
legal/privacy, independent-security and operations gates close. No V1 donor runtime code or assets
were used.
