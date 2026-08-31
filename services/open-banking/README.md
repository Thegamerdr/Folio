# Melo Open Banking service

This Worker is Melo's provider isolation boundary for optional UK Open Banking. It targets
TrueLayer Data v3's hosted authorisation flow and never exposes TrueLayer client credentials,
access tokens, connection IDs, or provider account IDs to the mobile app.

The checked-in deployment is deliberately disabled and unconfigured. `OPEN_BANKING_ENABLED=false`
keeps every non-health route dark even if provider credentials are accidentally present. A healthy
Worker reports both `featureEnabled: false` and (normally) `providerConfigured: false`; that means
the server and honest unavailable state are working, not that a bank connection exists.

The current service requests account details and transactions only. It does not fetch account
balances. Do not describe the current build as live-balance refresh; the required contract and
activation work are in `docs/product-strategy/TRUELAYER_ACTIVATION_CHECKLIST.md`.

## Credential-ready state

The hardened dark-gated Worker was deployed on 2026-08-31 as version
`68a50f69-b841-479f-97e6-75fdf10cf75d`. Its public health response reports
`configurationReady: true`, `providerConfigured: false`, `activationReady: false`, and
`featureEnabled: false`. The checked-in readiness command verifies local non-secret configuration,
the deployed health contract, and remote secret **names** without reading or printing any value:

```powershell
pnpm open-banking:preflight
```

The remaining sandbox credential installation is intentionally interactive:

```powershell
pnpm open-banking:secret:client-id
pnpm open-banking:secret:client-secret
pnpm open-banking:secret:encryption-key
pnpm open-banking:readiness
```

The first two commands use Wrangler's secret prompt. The encryption-key command generates a random
32-byte key and pipes it directly to Wrangler without displaying it. It refuses to replace an
existing key because an unplanned replacement could orphan encrypted connections. The final command
requires all three secret names and a deployed `providerConfigured: true` result while still
requiring the Worker feature gate to remain off.

For local development, copy `.dev.vars.example` to the gitignored `.dev.vars` and supply sandbox
values there. Never use live credentials in local files. Adding credentials alone does not expose
the feature: the Worker gate remains off, and the mobile build independently requires both
`EXPO_PUBLIC_MELO_OPEN_BANKING_ENABLED=true` and an HTTPS
`EXPO_PUBLIC_MELO_OPEN_BANKING_URL`.

Production or sandbox connection work requires owner-controlled TrueLayer setup:

1. Approve TrueLayer procurement, processor terms, DPIA/privacy wording, and production use.
2. Register `https://melo-open-banking.tgdroppin.workers.dev/v1/callback` as an allowed return URI.
3. Set `TRUELAYER_CLIENT_ID` and `TRUELAYER_CLIENT_SECRET` with `wrangler secret put`.
4. Generate a random 32-byte key and set its base64 value as `CONNECTION_ENCRYPTION_KEY`.
5. Re-deploy and run the provider sandbox contract and consent-journey evidence pass.
6. Set `OPEN_BANKING_ENABLED=true` only after provider, privacy, legal and store approval; setting
   the provider secrets alone must not activate the route.

The Worker pins sandbox and live configuration to TrueLayer's documented host pairs, rejects an
invalid encryption key before reporting configured, limits provider responses, applies a provider
timeout, and accepts hosted authorization URLs only from the matching TrueLayer hosted-page domain.
For user-initiated connection and refresh calls it forwards Cloudflare's validated
`CF-Connecting-IP` value as `Tl-User-IP`; malformed values are discarded.

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
encrypted provider records. These boundaries are present in the deployed dark-gated Worker; live
provider activation remains a separate owner-controlled release step.

Disconnecting deletes the encrypted provider identifiers so Melo cannot refresh again. TrueLayer's
current Data v3 OpenAPI does not expose a connection-revocation endpoint, so the UI must not claim
that this action also revoked the consent at the bank/provider. Imported local history is a separate
device-side choice.
