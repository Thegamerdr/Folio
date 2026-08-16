# ADR 0011: Phase 10 Cloud Account, Encrypted Backup And Sync Boundaries

Date: 2026-06-21

Status: Accepted with explicit blockers

## Context

Phase 10 introduces optional account, encrypted backup, multi-device sync, key recovery, device
registry, encrypted envelopes/snapshots, restore/device migration and account deletion. The source
package is explicit that Folio remains local-first: the local encrypted vault is authoritative, an
account is not required for the personal core, and account authentication is not decryption.

Several Phase 10 requirements cannot be completed by a pure TypeScript package or synthetic Expo
screen. Passkey/Apple/Google providers, Keychain/Keystore wrapping, Argon2id benchmarking,
server-blind restore, lost-device revoke/key rotation, web deletion, DPIA approval, external
pen-test and staged beta operations need native, cloud, legal and security evidence.

## Decision

Extend `@folio/sync` as the Phase 10 pure contract package:

- Model optional account state so signed-out local use stays available and accounts are required
  only after cloud features are selected.
- Model vault key hierarchy for master, workspace, document and sync-envelope keys while keeping
  the server from receiving unwrapped vault keys.
- Model recovery methods, zero-knowledge copy, verify-recovery status and clean-device restore
  blockers without rendering recovery secrets.
- Model device registry, public-key fingerprints, revocation, future key-rotation blockers and
  active-device acknowledgement cursors.
- Model encrypted outbox envelopes and inbox application so service-visible payloads contain only
  ciphertext and permitted routing metadata.
- Model deterministic conflict policies for transactions, plans, rules, tasks, documents,
  workspace assignment and deletes without universal last-write-wins.
- Model encrypted snapshots, cloud inventory/status, account deletion, multi-device drills,
  independent security review and encrypted-backup/sync beta readiness.

Add `apps/mobile/src/phase10` as a synthetic-labelled evidence adapter and render it in the Expo
Today shell after Phase 9. The shell may show local contracts and blockers, but it must not claim a
real account session, provider sign-in, cloud connection, server-blind restore, external deletion
route, independent pen-test or encrypted backup/sync beta readiness.

## Consequences

Phase 10 can now prove local-first cloud boundaries, ciphertext-only envelope contracts,
deterministic conflict policy, safe compaction rules, cloud inventory disclosure and honest mobile
UX for blocked cloud launch requirements.

Phase 10 remains blocked for release until:

- Passkey, Apple and Google account providers are wired and tested.
- Native key wrapping, recovery wrapping, KDF parameters and qualified crypto review are complete.
- Clean-device restore from snapshot plus operations passes without server plaintext.
- Lost-device revoke, session revocation and future sync-key rotation are tested.
- Web account deletion, token revocation, export/delete choices and purge schedule are live.
- Cloud DPIA, processor inventory, privacy/store declarations and account deletion review pass.
- Multi-device offline conflict, recovery and revoke drills pass.
- Independent cloud vault/auth/sync pen-test closes all high/critical findings.
- Support runbook, restore telemetry and staged opt-in beta operations are ready.

Huashu and Figma remain review evidence. Repository code, tests and emulator artifacts remain the
source of truth.

## Evidence

- `packages/sync/src/index.ts`
- `packages/sync/test/sync-readiness.test.ts`
- `apps/mobile/src/phase10/cloudSyncEvidence.ts`
- `apps/mobile/src/phase10/cloudSyncEvidence.test.ts`
- `apps/mobile/app/index.tsx`
- `docs/release-evidence/C10-cloud-account-encrypted-backup-sync.md`

## 2026-07-15 implementation update

The production Android branch now implements the subset that can be proven locally without
inventing provider credentials:

- Optional Clerk email-code sign-in remains outside the local core.
- The client encrypts a complete snapshot with a 256-bit recovery key before upload; the Cloudflare
  vault stores only the opaque envelope and keeps a latest/previous generation.
- Restore decrypts and validates locally before applying through the normal migration path.
- In-app account deletion attempts the cloud-vault and Open Banking account purges before Clerk
  identity deletion. Local financial data remains a separate choice.
- Open Banking credential deletion stops Melo's future access but does not currently revoke the
  separate bank/provider consent. The UI and evidence state this limitation.

This update does not close the public web-deletion, deployed lifecycle E2E, multi-device sync,
provider-revocation, DPIA, independent security or operations blockers above.
