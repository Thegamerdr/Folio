# Melo Open Banking service

This Worker is Melo's provider isolation boundary for optional UK Open Banking. It targets
TrueLayer Data v3's hosted authorisation flow and never exposes TrueLayer client credentials,
access tokens, connection IDs, or provider account IDs to the mobile app.

The checked-in deployment is deliberately unconfigured. A healthy Worker may report
`providerConfigured: false`; that means the server and honest unavailable state are working, not
that a bank connection exists.

The current service requests account details and transactions only. It does not fetch account
balances. Do not describe the current build as live-balance refresh; the required contract and
activation work are in `docs/product-strategy/TRUELAYER_ACTIVATION_CHECKLIST.md`.

Production or sandbox connection work requires owner-controlled TrueLayer setup:

1. Approve TrueLayer procurement, processor terms, DPIA/privacy wording, and production use.
2. Register `https://melo-open-banking.tgdroppin.workers.dev/v1/callback` as an allowed return URI.
3. Set `TRUELAYER_CLIENT_ID` and `TRUELAYER_CLIENT_SECRET` with `wrangler secret put`.
4. Generate a random 32-byte key and set its base64 value as `CONNECTION_ENCRYPTION_KEY`.
5. Re-deploy and run the provider sandbox contract and consent-journey evidence pass.

Data v3 uses an application client-credentials token. The Worker keeps that token only in memory
until it expires. Provider connection and account IDs are encrypted with AES-256-GCM before KV
storage. New ciphertext authenticates the hashed user, opaque workspace reference and local
connection ID as associated data, so moving an encrypted record across those boundaries fails
decryption. KV keys use a SHA-256 digest of the Clerk user ID and a SHA-256 workspace reference;
raw workspace IDs never leave the device.

Every list, connect, callback, sync and disconnect path is workspace-bound. Current mobile clients
send `X-Melo-Workspace-Ref`; headerless historic clients map only to the immutable Personal
workspace, and old account-level records migrate only into Personal. Account deletion remains
account-wide and enumerates the complete hashed-user prefix so it removes every workspace's
encrypted provider records. These changes are checked in but are not a claim that the currently
unconfigured deployed Worker has been updated; deployment remains an owner-controlled release step.

Disconnecting deletes the encrypted provider identifiers so Melo cannot refresh again. TrueLayer's
current Data v3 OpenAPI does not expose a connection-revocation endpoint, so the UI must not claim
that this action also revoked the consent at the bank/provider. Imported local history is a separate
device-side choice.
