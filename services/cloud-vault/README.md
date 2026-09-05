# Melo Cloud Vault

This Worker stores opaque, client-encrypted Melo backup snapshots in an account-scoped SQLite
Durable Object. It never receives a plaintext money record or an unwrapped recovery key. KV is only
used as a one-time migration source for existing Personal and Business backups. Both retained
generations are adopted atomically, then removed from KV. Old clients cannot mutate either authority;
the production entry point fails closed if its Durable Object binding is missing.

## Routes

- `GET /health` — unauthenticated deployment check.
- `GET /delete-account` — public deletion readiness/instructions page. It links to a configured
  HTTPS support/deletion route when one exists and otherwise says browser self-service is not
  configured; visiting the page never deletes an account.
- `GET /v1/backup` — metadata for the signed-in user's latest snapshot.
- `GET /v1/backups` — list ciphertext-only workspace references for clean-device discovery.
- `PUT /v1/backup` — upload one bounded encrypted snapshot with `If-None-Match: *` or an exact
  `If-Match` generation. Retries of the current ciphertext are idempotent.
  After deletion, create-only uploads must also carry the `X-Melo-Backup-Revision` returned by
  status. A delayed pre-delete upload cannot recreate the backup.
- `GET /v1/backup/content` — download the current, previous, or explicit old-key anchor generation.
- `DELETE /v1/backup` — delete all retained generations for the selected workspace.
- `DELETE /v1/account` — purge every retained generation across every workspace for the signed-in
  account; this is the route used before Clerk identity deletion.
- `GET|POST /v1/sync/devices` — list/register opaque public-key device records.
- `POST /v1/sync/enrollment` — signed first-phone discovery or this phone's own registration
  status. An unapproved phone cannot list other device identifiers, labels or key boxes.
- `POST /v1/sync/devices/:deviceId/revoke` — revoke a device while advancing the sync-key epoch;
  the client supplies an opaque wrapped next key for every remaining active device and the opaque
  backward key transition in the SAME atomic request. A separate later key-history write is not
  sufficient. Registered device history is bounded to 32 device identities per workspace.
- `GET /v1/sync/key-transitions?afterEpoch=N` — bounded pages of 64 opaque backward key boxes.
- `GET|POST /v1/sync/operations` — page or append checksum-verified encrypted operation envelopes.
- `POST /v1/sync/acknowledgements` — advance the current device's monotonic replay cursor.
- `GET|PUT /v1/sync/snapshot` — read/register an encrypted-backup checkpoint whose checksum must
  match the current client-encrypted `/v1/backup` object.
- `POST /v1/sync/compaction` — delete replay operations only through the snapshot cursor and the
  minimum acknowledgement of every active device.

All `/v1/*` routes require a valid Clerk session JWT in `Authorization: Bearer …`. KV keys use a
SHA-256 digest of the Clerk user ID, so the provider object key does not expose the raw account ID.

## Provisioning

1. Create and bind the `VAULTS` Workers KV namespace for legacy migration only. New backup
   generations are stored by the `BACKUP_WORKSPACES` SQLite Durable Object binding.
2. Apply the checked-in `SyncWorkspaceDurableObject` and `BackupWorkspaceDurableObject` migrations.
   The Durable Objects serialise
   device, operation cursor, acknowledgement, rotation and compaction changes per account/workspace.
3. Run `pnpm --filter @melo/cloud-vault types` after any binding change.
4. Confirm `CLERK_ISSUER` and `CLERK_JWKS_URL` match the Clerk environment used by the app.
5. Set `PUBLIC_ACCOUNT_DELETION_URL` to an owner-controlled HTTPS deletion/support journey only
   after its Clerk domain/config is live. Empty is an honest readiness state, not a placeholder URL.
6. Deploy with `pnpm --filter @melo/cloud-vault deploy`.

The checked-in Clerk host is the current development instance. A production Clerk environment must
replace it before a public build.

Account deletion is idempotent: a missing backup still returns `{ "deleted": true }`, while any KV
failure returns a service error and the client keeps the identity so deletion can be retried. Local
encrypted state and recovery secrets are intentionally separate; the mobile flow clears those only
after the remote purge is confirmed.

Sync admission is recorded in the account SQLite authority before the workspace coordinator is
reached. Account deletion fences admission first. Each coordinator removes its device/key metadata,
purges ciphertext/idempotency/history rows in resumable bounded batches, and retains only a minimal
permanent tombstone. Every normal mutation rechecks this fence inside its transaction, including
requests that finished signature verification before deletion. Legacy KV sync markers are drained
alongside the durable inventory and removed only after acknowledged purges; new requests no longer
create KV markers. Production activation must account for the old deployment's KV consistency and
drain outstanding legacy writers before claiming a migration/deletion audit complete.

Native wrapping binds key material to the account, workspace, recipient device/fingerprint and
epoch. First enrollment and device removal retain exact pending requests across lost responses;
the actual registered key box is opened before caching a key. Key rotation and backward history
commit together. Native calls use a 20-second per-API-instance deadline and a 2 MiB streamed response
limit; operation pages are bounded below that limit and requests are limited to 128 KiB.

An explicit recovery-key replacement retains the old-key generation as an anchor until the next
explicit replacement or deletion; ordinary backups never evict it. Native key material is saved
before upload, and a lost-response retry checks the current ciphertext before promoting a pending
key. Merely previewing an older generation does not replace the active recovery key. Account deletion
leaves a minimal permanent fence for that identity so late writes cannot resurrect its cloud data.

The repository proves the coordinator and authenticated client contracts locally. It does not prove
production Clerk configuration, deployed bindings, clean-device replay, lost-device rotation on
physical devices, browser identity deletion, or external security/privacy approval.

Current local evidence: `tooling/tests/cloud-sync-enrollment.test.ts` exercises native signing,
wrapping, transport and the coordinator for two synthetic phones, first-enrollment response loss,
account key separation, and lost revocation responses with old-key recovery. The small
`tooling/scripts/check-sync-coordinator-runtime.mjs` check verifies actual SQLite transactions,
atomic rotation/history, ciphertext purge and deletion fences in workerd.

The integrated mobile runner captures never-sent intent with ordinary SQLCipher saves, coalesces it
without rewriting sent ciphertext, and binds its journal to one explicit account/workspace.
Download progress is separate from the contiguous replay/acknowledgement cursor. Large changes are
reassembled and checked as one atomic money patch; signed key history permits old-epoch replay.
Both conflict alternatives remain available for a deliberate whole-workspace choice and export.
Original attachments, bank credentials, purchases and device settings are not portable sync data.
Pausing preserves the journal; re-enabling captures edits made while paused.

Four runner cases use real patch generation and authenticated ciphertext for lost responses,
second-phone adoption, edits during upload, prior remote replay, split-group restart and scope
cancellation. Four selected native persistence cases cover transactional capture, restart/CAS,
coalescing and an edit during replay commit. This is reviewed local integration, not a physical
two-phone, deployed migration, or external security/privacy sign-off.
