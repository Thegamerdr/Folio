# Melo billing entitlements

This Worker is the trust boundary between Google Play Billing and Melo's on-device entitlement
state. The app sends an allowed product ID and the Play purchase token after the platform reports
`purchased`. The Worker verifies that proof with the Google Play Developer API, stores only a
SHA-256 token hash, signs a short entitlement grant, and then attempts acknowledgement.

The deployed foundation is intentionally unavailable until all of the following exist:

- the Play application and products;
- a service account with the minimum Play Console order/subscription permissions;
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` Worker secrets;
- an Ed25519 signing key and matching public JWK;
- the `ENTITLEMENTS` KV binding.

The private Google key and entitlement signing key must never be placed in the app, repository,
Wrangler variables, logs, or release evidence. The APK receives only the Worker URL and Ed25519
public key. A client-created or unsigned entitlement is never accepted.

## Readiness commands

Run the non-destructive preflight from the repository root:

```text
pnpm billing:preflight
```

It checks the deployed health endpoint, current sellable catalog, KV binding, signer state and
secret names without printing secret values. Missing provider credentials are reported as `WAIT`
and do not fail the preflight. The strict activation check is:

```text
pnpm billing:readiness
```

That command exits non-zero until the Play service-account secrets are present and the Worker
reports `providerConfigured: true`. Install the two missing Play values without placing them in a
shell argument, file, log or commit:

```text
pnpm billing:secret:google-email
pnpm billing:secret:google-private-key
pnpm billing:readiness
```

Wrangler prompts for each value and writes it directly to the deployed Worker secret store. Use
only a Google Play license-testing account for E2E; the repository contains no purchase tokens or
customer data.
