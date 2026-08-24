# Melo Cloud Vault

This Worker stores opaque, client-encrypted Melo backup snapshots in Workers KV. It never receives a
plaintext money record or an unwrapped recovery key.

## Routes

- `GET /health` — unauthenticated deployment check.
- `GET /v1/backup` — metadata for the signed-in user's latest snapshot.
- `PUT /v1/backup` — upload one bounded encrypted snapshot and rotate the previous generation.
- `GET /v1/backup/content` — download the latest encrypted snapshot.
- `DELETE /v1/backup` — delete both retained generations for the signed-in user.
- `DELETE /v1/account` — purge every retained generation across every workspace for the signed-in
  account; this is the route used before Clerk identity deletion.

All `/v1/*` routes require a valid Clerk session JWT in `Authorization: Bearer …`. KV keys use a
SHA-256 digest of the Clerk user ID, so the provider object key does not expose the raw account ID.

## Provisioning

1. Create and bind the `VAULTS` Workers KV namespace. Melo's 4 MiB cap is below KV's 25 MiB value limit.
2. Run `pnpm --filter @melo/cloud-vault types` after any binding change.
3. Confirm `CLERK_ISSUER` and `CLERK_JWKS_URL` match the Clerk environment used by the app.
4. Deploy with `pnpm --filter @melo/cloud-vault deploy`.

The checked-in Clerk host is the current development instance. A production Clerk environment must
replace it before a public build.

Account deletion is idempotent: a missing backup still returns `{ "deleted": true }`, while any KV
failure returns a service error and the client keeps the identity so deletion can be retried. Local
encrypted state and recovery secrets are intentionally separate; the mobile flow clears those only
after the remote purge is confirmed.
