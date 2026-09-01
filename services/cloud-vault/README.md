# Melo Cloud Vault

This Worker stores opaque, client-encrypted Melo backup snapshots in Workers KV. It never receives a
plaintext money record or an unwrapped recovery key.

## Routes

- `GET /health` — unauthenticated deployment check.
- `GET /delete-account` — public deletion readiness/instructions page. It links to a configured
  HTTPS support/deletion route when one exists and otherwise says browser self-service is not
  configured; visiting the page never deletes an account.
- `GET /v1/backup` — metadata for the signed-in user's latest snapshot.
- `PUT /v1/backup` — upload one bounded encrypted snapshot and rotate the previous generation.
- `GET /v1/backup/content` — download the latest encrypted snapshot.
- `DELETE /v1/backup` — delete both retained generations for the signed-in user.
- `DELETE /v1/account` — purge every retained generation across every workspace for the signed-in
  account; this is the route used before Clerk identity deletion.
- `GET|POST /v1/sync/devices` — list/register opaque public-key device records.
- `POST /v1/sync/devices/:deviceId/revoke` — revoke a device while advancing the sync-key epoch;
  the client supplies an opaque wrapped next key for every remaining active device.
- `GET|POST /v1/sync/operations` — page or append checksum-verified encrypted operation envelopes.
- `POST /v1/sync/acknowledgements` — advance the current device's monotonic replay cursor.
- `GET|PUT /v1/sync/snapshot` — read/register an encrypted-backup checkpoint whose checksum must
  match the current client-encrypted `/v1/backup` object.
- `POST /v1/sync/compaction` — delete replay operations only through the snapshot cursor and the
  minimum acknowledgement of every active device.

All `/v1/*` routes require a valid Clerk session JWT in `Authorization: Bearer …`. KV keys use a
SHA-256 digest of the Clerk user ID, so the provider object key does not expose the raw account ID.

## Provisioning

1. Create and bind the `VAULTS` Workers KV namespace. Melo's 4 MiB cap is below KV's 25 MiB value limit.
2. Apply the checked-in `SyncWorkspaceDurableObject` migration. The Durable Object serialises
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

The repository proves the coordinator and authenticated client contracts locally. It does not prove
production Clerk configuration, deployed bindings, clean-device replay, lost-device rotation on
physical devices, browser identity deletion, or external security/privacy approval.
